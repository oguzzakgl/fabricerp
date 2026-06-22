import os
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["ONEDNN_PRIMITIVE_CACHE_CAPACITY"] = "0"

import numpy as np
# Monkey patch for imgaug compatibility with numpy 2.0
if not hasattr(np, "sctypes"):
    np.sctypes = {
        "float": [np.float16, np.float32, np.float64],
        "int": [np.int8, np.int16, np.int32, np.int64],
        "uint": [np.uint8, np.uint16, np.uint32, np.uint64],
        "bool": [bool]
    }

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import uvicorn
import io
import re
import cv2
import difflib

app = FastAPI(title="Fabric ERP PaddleOCR Service")

# CORS izinleri
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PaddleOCR modelini RAM'de bir kez yüklüyoruz (en diliyle)
ocr = PaddleOCR(
    use_angle_cls=False, 
    lang="en", 
    enable_mkldnn=False,
    det_limit_side_len=960,
    cpu_threads=6
)

# Bilinen kumaş listesi (Fuzzy Matching için)
KNOWN_FABRICS = ["RONA", "CROC", "CORES", "SÜPREM", "SUPREM", "İKİ İPLİK", "IKI IPLIK", "ÜÇ İPLİK", "UC IPLIK", "KAŞKORSE", "KASKORSE", "RİBANA", "RIBANA", "İNTERLOK", "INTERLOK"]

def get_fuzzy_fabric_name(detected_name: str) -> str:
    if not detected_name:
        return ""
    detected_upper = detected_name.upper().strip()
    matches = difflib.get_close_matches(detected_upper, KNOWN_FABRICS, n=1, cutoff=0.7)
    if matches:
        return matches[0]
    return detected_name

def clean_ocr_number(val_str: str) -> str:
    # Sayısal değerlerde sık yapılan OCR hatalarını düzelt
    mapping = {
        'l': '1', 'I': '1', 'i': '1', '|': '1',
        'O': '0', 'o': '0',
        'S': '5', 's': '5',
        'B': '8'
    }
    cleaned = ""
    for char in val_str:
        if char.isdigit() or char in ['.', ',']:
            cleaned += char
        elif char in mapping:
            cleaned += mapping[char]
    cleaned = cleaned.replace(',', '.')
    return cleaned

def parse_decimal_string(str_val: str, max_limit: float) -> float:
    # Sayıyı temizle
    clean = clean_ocr_number(str_val)
    clean = re.sub(r'\s+', '', clean)
    
    # 4 haneden uzun düz sayıları eliyoruz (İşletme no vb.)
    if '.' not in clean and len(clean) > 4:
        return 0.0
        
    if '.' not in clean and len(clean) >= 3:
        clean = clean[:-2] + '.' + clean[-2:]
        
    try:
        val = float(clean)
    except ValueError:
        return 0.0
        
    safety_counter = 0
    while val > max_limit and safety_counter < 5:
        val = val / 10.0
        safety_counter += 1
        
    return round(val, 2)

def resize_if_needed(img_np, target_width=1500):
    h, w = img_np.shape[:2]
    if w < target_width:
        scale = target_width / w
        new_h = int(h * scale)
        resized = cv2.resize(img_np, (target_width, new_h), interpolation=cv2.INTER_CUBIC)
        return resized
    return img_np

def deskew_image(img_np):
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
    
    angles = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
            if -45 < angle < 45:
                angles.append(angle)
                
    if len(angles) > 0:
        median_angle = np.median(angles)
        if abs(median_angle) > 1.0:
            (h, w) = img_np.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
            rotated = cv2.warpAffine(img_np, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
    return img_np

def preprocess_image(img_np):
    # Gri tonlama
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    # CLAHE kontrast artırma
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    # Gürültü temizleme
    gray = cv2.medianBlur(gray, 3)
    # Keskinleştirme
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    return cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)

def calculate_average_confidence(ocr_result):
    if not ocr_result or not ocr_result[0]:
        return 0.0
    scores = []
    for line in ocr_result[0]:
        score = line[1][1]
        scores.append(score)
    return np.mean(scores) if scores else 0.0

@app.post("/ocr")
async def do_ocr(file: UploadFile = File(...)):
    # Resmi oku
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_np is None:
        return {
            "fabricType": "Bilinmeyen Kumaş",
            "lengthM": 0.0,
            "netWeightKg": 0.0,
            "colorCode": "",
            "quality": "1",
            "rawText": "HATA: Görsel kodu çözülemedi."
        }
    
    # 1. Görüntüyü Düzleştir (Deskew) ve Ölçeklendir (Resize)
    img_processed = deskew_image(img_np)
    img_processed = resize_if_needed(img_processed, 1500)
    
    # 2. Ön işlenmiş (Preprocessed) sürümünü oluştur
    img_enhanced = preprocess_image(img_processed)
    
    # 3. Paralel OCR Analizi
    result_orig = ocr.ocr(img_processed)
    result_enh = ocr.ocr(img_enhanced)
    
    conf_orig = calculate_average_confidence(result_orig)
    conf_enh = calculate_average_confidence(result_enh)
    
    print(f"Orijinal Görüntü Güven Skoru: {conf_orig:.4f}")
    print(f"Ön İşlenmiş Görüntü Güven Skoru: {conf_enh:.4f}")
    
    # En yüksek güven skoruna sahip olan sonucu seç
    if conf_enh > conf_orig and result_enh and result_enh[0]:
        result = result_enh
        print("-> Ön işlenmiş görüntü sonucu seçildi.")
    else:
        result = result_orig
        print("-> Orijinal/Düzleştirilmiş görüntü sonucu seçildi.")
        
    if not result or not result[0]:
        return {
            "fabricType": "Bilinmeyen Kumaş",
            "lengthM": 0.0,
            "netWeightKg": 0.0,
            "colorCode": "",
            "quality": "1",
            "rawText": ""
        }
        
    # Tüm okunan metinleri birleştirelim
    raw_texts = []
    for line in result[0]:
        text_val = line[1][0]
        raw_texts.append(text_val)
        
    full_text = "\n".join(raw_texts)
    print("PaddleOCR Okunan Ham Metin:\n", full_text)
    
    # 1. Kumaş Adı Ayıklama
    detected_fabric = ""
    for idx, text in enumerate(raw_texts):
        clean_text = text.strip()
        # İki nokta üst üste zorunlu ve sonrasında alfabetik karakterler alan regex
        # Örn: KALİTE: RONA veya KALİTE : RONA
        if re.search(r'\b(?:KALİTE|KALITE|QUALITY|KUMAS|KUMAŞ)\s*[:]\s*', clean_text, re.IGNORECASE) and not re.search(r'\bNO\b', clean_text, re.IGNORECASE):
            val_match = re.search(r'(?:KALİTE|KALITE|QUALITY|KUMAS|KUMAŞ)\s*[:]\s*([A-Za-zĞÜŞÖÇİğüşöçı\s]+)', clean_text, re.IGNORECASE)
            if val_match and val_match.group(1).strip():
                val = val_match.group(1).strip()
                if not val.isdigit() and len(val) > 2 and "LYCRA" not in val.upper():
                    detected_fabric = val
                    break
            
            # Alt satırlara bak
            for offset in range(1, 3):
                if idx + offset < len(raw_texts):
                    next_line = raw_texts[idx + offset].strip()
                    next_line_clean = re.sub(r'^[:\-]+', '', next_line).strip()
                    if next_line_clean and not next_line_clean.isdigit():
                        upper_line = next_line_clean.upper()
                        if not any(kwd in upper_line for kwd in ["KALITE", "COLOR", "KUMAS", "PARTI", "TOPNO", "MAMUL", "ISLETME", "LYCRA"]):
                            detected_fabric = next_line_clean
                            break
            if detected_fabric:
                break
                
    # Fallback Kumaş Adı
    if not detected_fabric:
        for text in raw_texts:
            clean = text.strip()
            clean_alpha = re.sub(r'[^a-zA-ZğüşöçİĞÜŞÖÇ\s]', '', clean).strip()
            if len(clean_alpha) >= 3:
                upper_clean = clean.upper()
                if not any(kwd in upper_clean for kwd in ["KALITE", "COLOR", "KUMAS", "PARTI", "TOPNO", "MAMUL", "ISLETME", "EDILMEZ", "REKLAM", "MALDAN", "KESILEN", "LYCRA", "MT", "KG"]):
                    if not re.search(r'\d', clean) and not any(u in upper_clean for u in ["MT", "KG", "KILO"]):
                        detected_fabric = clean
                        break
                        
    # Fuzzy Matching ile Kumaş Adını Düzelt
    if detected_fabric:
        detected_fabric = get_fuzzy_fabric_name(detected_fabric)
    
    # 2. Metre ve Ağırlık Ayıklama (\b kelime sınırları ile)
    detected_length = 0.0
    detected_weight = 0.0
    
    length_match = re.search(r'\b(\d+(?:[.,]\d+)?)\s*(?:Mt|mt|M|m|MI|Nt|nt|t|ME|Mf|MC|Me|MD|MT|Mt\.)\b', full_text, re.IGNORECASE)
    weight_match = re.search(r'\b(\d+(?:[.,]\d+)?)\s*(?:Kg|kg|Kilo|kilo|Kq|kq|Ky|ky|K9|K:|K|KG)\b', full_text, re.IGNORECASE)
    
    if length_match:
        detected_length = parse_decimal_string(length_match.group(1), 150.0)
    if weight_match:
        detected_weight = parse_decimal_string(weight_match.group(1), 50.0)
        
    # Fallback Metre / Ağırlık
    if detected_length == 0.0 or detected_weight == 0.0:
        decimal_numbers = []
        number_pattern = re.compile(r'(\d+[\.,]\d+|\b\d{2,4}\b)')
        matches = number_pattern.findall(full_text)
        
        number_index = 0
        for m in matches:
            current_limit = 150.0 if number_index == 0 else 50.0
            num = parse_decimal_string(m, current_limit)
            if num > 0.0:
                decimal_numbers.append(num)
                number_index += 1
                
        if len(decimal_numbers) >= 2:
            if detected_length == 0.0: detected_length = decimal_numbers[0]
            if detected_weight == 0.0: detected_weight = decimal_numbers[1]
        elif len(decimal_numbers) == 1:
            if detected_length == 0.0: detected_length = decimal_numbers[0]

    # Post-Processing Mantıksal Doğrulama
    # Metre başına ağırlık kontrolü (Kg/M oranı)
    if detected_length > 0.0 and detected_weight > 0.0:
        kg_per_m = detected_weight / detected_length
        if kg_per_m < 0.05 or kg_per_m > 1.50:
            print(f"UYARI: Metre/Ağırlık oranı tutarsız! Gelen oran: {kg_per_m:.4f} kg/m. (Metre: {detected_length}, Ağırlık: {detected_weight})")

    if detected_length > 150.0: detected_length = 0.0
    if detected_weight > 50.0: detected_weight = 0.0
    
    # 3. Renk Numarası Tespiti (Herhangi bir sayısal kod)
    detected_color_num = ""
    
    # Öncelikle tek satırda esnek ayraçlı eşleşmeleri ara
    color_line_match = re.search(r'(?:COLOR|COL|Renk|Color|Col|Cor|CO|CL|CR)\s*[:.\s-]*(\d+)\b', full_text, re.IGNORECASE)
    if color_line_match:
        detected_color_num = color_line_match.group(1)
            
    # Eğer tek satırda bulunamadıysa, satır bazlı analiz yapalım
    if not detected_color_num:
        for idx, text in enumerate(raw_texts):
            clean_text = text.strip()
            if re.search(r'\b(?:COLOR|COL|Renk|Color|Col|Cor|CO|CL|CR)\b', clean_text, re.IGNORECASE):
                val_match = re.search(r'(?:COLOR|COL|Renk|Color|Col|Cor|CO|CL|CR)\s*[:.\s-]*(\d+)\b', clean_text, re.IGNORECASE)
                if val_match:
                    detected_color_num = val_match.group(1)
                    break
                
                # Alt satırlara bak (maksimum 5 satır aşağı in)
                for offset in range(1, 6):
                    if idx + offset < len(raw_texts):
                        next_line = raw_texts[idx + offset].strip()
                        # Kelime filtresi: Rakam yoksa ve alfabetik karakter sayısı 1'den büyükse pas geç
                        if not re.search(r'\d', next_line) and len(re.sub(r'[^a-zA-Z]', '', next_line)) > 1:
                            continue
                        next_line_clean = re.sub(r'^[:.\s-]+', '', next_line).strip()
                        next_line_clean = clean_ocr_number(next_line_clean)
                        if next_line_clean.isdigit():
                            detected_color_num = next_line_clean
                            break
                if detected_color_num:
                    break

    return {
        "fabricType": detected_fabric or "Bilinmeyen Kumaş",
        "lengthM": detected_length,
        "netWeightKg": detected_weight,
        "colorCode": detected_color_num,
        "quality": "1",
        "rawText": full_text
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
