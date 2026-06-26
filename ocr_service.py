import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_DISABLE_ONEDNN"] = "1"
os.environ["FLAGS_prim_enable_dynamic"] = "1"
os.environ["FLAGS_enable_pir_api"] = "0"

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

@app.get("/")
def read_root():
    return {"status": "running", "service": "Fabric ERP PaddleOCR Service"}

# CORS izinleri
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PaddleOCR modelini RAM'de bir kez yüklüyoruz
ocr = PaddleOCR(
    lang="en",
    ocr_version="PP-OCRv4",
    use_textline_orientation=False,
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    text_det_limit_side_len=960,
    cpu_threads=1,
    device="cpu",
    enable_mkldnn=False
)

# Bilinen kumaş listesi (Fuzzy Matching için)
KNOWN_FABRICS = ["RONA", "CROC", "CORES", "SÜPREM", "SUPREM", "İKİ İPLİK", "IKI IPLIK", "ÜÇ İPLİK", "UC IPLIK", "KAŞKORSE", "KASKORSE", "RİBANA", "RIBANA", "İNTERLOK", "INTERLOK", "EN LYCRA"]

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

def resize_if_needed(img_np, target_width=1000):
    h, w = img_np.shape[:2]
    if w > target_width:
        scale = target_width / w
        new_h = int(h * scale)
        resized = cv2.resize(img_np, (target_width, new_h), interpolation=cv2.INTER_AREA)
        return resized
    return img_np

def preprocess_image(img_np):
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.medianBlur(gray, 3)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    return cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)

def run_ocr_predict(img_np):
    print("FastAPI: ocr.predict() basliyor...")
    result = ocr.predict(img_np)
    print("FastAPI: ocr.predict() tamamlandi.")
    raw_texts = []
    if result:
        for page_result in result:
            if page_result is None:
                continue
            if isinstance(page_result, dict):
                rec_texts = page_result.get("rec_texts", [])
                for t in rec_texts:
                    if t and t.strip():
                        raw_texts.append(t.strip())
            elif isinstance(page_result, list):
                for item in page_result:
                    if isinstance(item, dict):
                        rec_texts = item.get("rec_texts", [])
                        for t in rec_texts:
                            if t and t.strip():
                                            raw_texts.append(t.strip())
                    elif isinstance(item, (list, tuple)) and len(item) >= 2:
                        text_info = item[1]
                        if isinstance(text_info, (list, tuple)):
                            raw_texts.append(str(text_info[0]).strip())
                        else:
                            raw_texts.append(str(text_info).strip())
    return raw_texts

@app.post("/ocr")
def do_ocr(file: UploadFile = File(...)):
    print(f"FastAPI: Istek alindi. Dosya adi: {file.filename}")
    contents = file.file.read()
    print(f"FastAPI: Dosya okundu. Boyut: {len(contents)} byte")
    nparr = np.frombuffer(contents, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    print("FastAPI: cv2 imdecode tamamlandi.")
    
    if img_np is None:
        return {
            "fabricType": "Bilinmeyen Kumaş",
            "lengthM": 0.0,
            "netWeightKg": 0.0,
            "colorCode": "",
            "quality": "1",
            "rawText": "HATA: Görsel kodu çözülemedi."
        }
    
    img_processed = resize_if_needed(img_np, 1500)
    img_enhanced = preprocess_image(img_processed)
    
    raw_texts_orig = run_ocr_predict(img_processed)
    raw_texts_enh = run_ocr_predict(img_enhanced)
    
    print(f"Orijinal metin sayısı: {len(raw_texts_orig)}, Ön işlenmiş: {len(raw_texts_enh)}")
    
    if len(raw_texts_enh) >= len(raw_texts_orig):
        raw_texts = raw_texts_enh
        print("-> Ön işlenmiş görüntü sonucu seçildi.")
    else:
        raw_texts = raw_texts_orig
        print("-> Orijinal görüntü sonucu seçildi.")
    
    if not raw_texts:
        return {
            "fabricType": "Bilinmeyen Kumaş",
            "lengthM": 0.0,
            "netWeightKg": 0.0,
            "colorCode": "",
            "quality": "1",
            "rawText": ""
        }
        
    full_text = "\n".join(raw_texts)
    print("PaddleOCR Okunan Ham Metin:\n", full_text)
    
    # 1. Kumaş Adı Ayıklama
    detected_fabric = ""
    for idx, text in enumerate(raw_texts):
        clean_text = text.strip()
        # İki nokta üst üste zorunlu olmayan esnek regex
        if re.search(r'\b(?:KALİTE|KALITE|QUALITY|KUMAS|KUMAŞ|CUMAS|CUMAŞ)\b', clean_text, re.IGNORECASE) and not re.search(r'\bNO\b', clean_text, re.IGNORECASE):
            val_match = re.search(r'(?:KALİTE|KALITE|QUALITY|KUMAS|KUMAŞ|CUMAS|CUMAŞ)\s*[:\-]?\s*([A-Za-zĞÜŞÖÇİğüşöçı\s]+)', clean_text, re.IGNORECASE)
            if val_match and val_match.group(1).strip():
                val = val_match.group(1).strip()
                if not val.isdigit() and len(val) > 2:
                    detected_fabric = val
                    break
            
            # Alt satırlara bak (iki nokta üst üste alt satırda olabilir)
            for offset in range(1, 4):
                if idx + offset < len(raw_texts):
                    next_line = raw_texts[idx + offset].strip()
                    next_line_clean = re.sub(r'^[:\-\s]+', '', next_line).strip()
                    if next_line_clean and not next_line_clean.isdigit():
                        upper_line = next_line_clean.upper()
                        if not any(kwd in upper_line for kwd in ["KALITE", "KALİTE", "COLOR", "COL", "RENK", "KUMAS", "KUMAŞ", "PARTI", "PARTİ", "TOPNO", "TOP NO", "TOP_NO", "NO", "MAMUL", "ISLETME", "İŞLETME"]):
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
                if not any(kwd in upper_clean for kwd in ["KALITE", "KALİTE", "COLOR", "COL", "RENK", "KUMAS", "KUMAŞ", "PARTI", "PARTİ", "TOPNO", "TOP NO", "TOP_NO", "NO", "MAMUL", "ISLETME", "İŞLETME", "EDILMEZ", "EDİLMEZ", "REKLAM", "MALDAN", "KESILEN", "KESİLEN", "MT", "KG", "KILO"]):
                    if not re.search(r'\d', clean) and not any(u in upper_clean for u in ["MT", "KG", "KILO"]):
                        detected_fabric = clean
                        break
                        
    if detected_fabric:
        detected_fabric = get_fuzzy_fabric_name(detected_fabric)
    
    # 2. Metre ve Ağırlık Ayıklama (Kelime sınırı \b olmadan)
    detected_length = 0.0
    detected_weight = 0.0
    
    length_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:Mt|mt|M|m|MI|Nt|nt|t|ME|Mf|MC|Me|MD|MT|Mt\.)', full_text, re.IGNORECASE)
    weight_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:Kg|kg|Kilo|kilo|Kq|kq|Ky|ky|K9|K:|K|KG)', full_text, re.IGNORECASE)
    
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

    if detected_length > 150.0: detected_length = 0.0
    if detected_weight > 50.0: detected_weight = 0.0
    
    # 3. Renk Numarası Tespiti (Herhangi bir sayısal kod)
    detected_color_num = ""
    
    color_line_match = re.search(r'(?:COLOR|COL|Renk|Color|Col|Cor|CO|CL|CR)\s*[:.\s-]*(\d+)\b', full_text, re.IGNORECASE)
    if color_line_match:
        detected_color_num = color_line_match.group(1)
            
    if not detected_color_num:
        for idx, text in enumerate(raw_texts):
            clean_text = text.strip()
            if re.search(r'\b(?:COLOR|COL|Renk|Color|Col|Cor|CO|CL|CR)\b', clean_text, re.IGNORECASE):
                val_match = re.search(r'(?:COLOR|COL|Renk|Color|Col|Cor|CO|CL|CR)\s*[:.\s-]*(\d+)\b', clean_text, re.IGNORECASE)
                if val_match:
                    detected_color_num = val_match.group(1)
                    break
                
                for offset in range(1, 6):
                    if idx + offset < len(raw_texts):
                        next_line = raw_texts[idx + offset].strip()
                        if not re.search(r'\d', next_line) and len(re.sub(r'[^a-zA-Z]', '', next_line)) > 1:
                            continue
                        next_line_clean = re.sub(r'^[:.\s-]+', '', next_line).strip()
                        next_line_clean = clean_ocr_number(next_line_clean)
                        if next_line_clean.isdigit():
                            detected_color_num = next_line_clean
                            break
                if detected_color_num:
                    break
                    
    # Fallback Renk Kodu: Metnin en başında duran 3 haneli bağımsız bir sayı varsa (Örn: 055)
    if not detected_color_num:
        # Metindeki tüm 2-3 haneli bağımsız sayıları bul (örn: '055')
        numbers = re.findall(r'\b\d{2,3}\b', full_text)
        for num in numbers:
            num_clean = num.strip()
            # Bu sayı metre veya ağırlık veya top no olarak eşleşmemiş olsun
            val_f = float(num_clean)
            if val_f != detected_length and val_f != detected_weight and num_clean != "150" and num_clean != "1":
                detected_color_num = num_clean
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
