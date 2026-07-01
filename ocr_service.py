import os
from dotenv import load_dotenv
dotenv_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

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
    setattr(np, "sctypes", {
        "float": [np.float16, np.float32, np.float64],
        "int": [np.int8, np.int16, np.int32, np.int64],
        "uint": [np.uint8, np.uint16, np.uint32, np.uint64],
        "bool": [bool]
    })

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from typing import Optional
import uvicorn
import io
import re
import cv2
import difflib
import google.generativeai as genai
from pydantic import BaseModel, Field
import json

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

# Gemini API Yapılandırması
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

class FabricOcrResult(BaseModel):
    fabricType: str = Field(description="Kumaş türü/adı (Örn: Rona, Croc, Ribana, İki İplik vb.). En uygun bilinen kumaş adını fuzzy match ederek veya doğrudan eşleştirerek belirle. KESİNLİKLE 'ADI', 'KUMAŞ ADI', 'KUMAS ADI', 'KUMAŞ', 'KALİTE', 'KALITE', 'LYCRA', 'LCYRA', 'LIKRA', 'EN LYCRA', 'ENLYCRA' gibi kelimelerin kendisini döndürme. Bu başlığın yanında/altında yazan gerçek kumaş adını (Örn: RONA, CROC, CORES vb.) döndür.")
    lengthM: float = Field(description="Metre cinsinden kumaş uzunluğu (ondalıklı sayı, Örn: 100.5, 45.2). Eğer bulunamazsa 0.0.")
    netWeightKg: float = Field(description="Kilogram cinsinden kumaş ağırlığı (ondalıklı sayı, Örn: 22.4, 15.0). Eğer bulunamazsa 0.0.")
    colorCode: str = Field(description="Renk kodu veya numarası (Örn: 055, 1024, 7). Eğer bulunamazsa boş string.")
    quality: str = Field(description="Kumaş kalitesi (varsayılan olarak '1'). Eğer bulunamazsa '1'.")
    barcodeNumber: str = Field(description="Barkod numarası veya benzersiz etiket/top numarası (Örn: IRS-2026-00001, 100234, K-1234). Eğer bulunamazsa boş string.")

# PaddleOCR Lazy-Loading yapısı
_ocr_model = None

def get_paddle_ocr():
    global _ocr_model
    if _ocr_model is None:
        print("PaddleOCR: Model RAM'e yukleniyor (Lazy-loading)...")
        _ocr_model = PaddleOCR(
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
    return _ocr_model

# Bilinen kumaş listesi (Fuzzy Matching için)
KNOWN_FABRICS = ["RONA", "CROC", "CORES", "SÜPREM", "SUPREM", "İKİ İPLİK", "IKI IPLIK", "ÜÇ İPLİK", "UC IPLIK", "KAŞKORSE", "KASKORSE", "RİBANA", "RIBANA", "İNTERLOK", "INTERLOK"]

def get_fuzzy_fabric_name(detected_name: str, custom_fabrics: Optional[list] = None) -> str:
    if not detected_name:
        return ""
    detected_upper = detected_name.upper().strip()
    lookup_list = custom_fabrics if (custom_fabrics and len(custom_fabrics) > 0) else KNOWN_FABRICS
    lookup_upper = [f.upper().strip() for f in lookup_list]
    matches = difflib.get_close_matches(detected_upper, lookup_upper, n=1, cutoff=0.7)
    if matches:
        matched_idx = lookup_upper.index(matches[0])
        return lookup_list[matched_idx]
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
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    return cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)

def run_ocr_predict(img_np):
    print("FastAPI: ocr.predict() basliyor...")
    ocr_instance = get_paddle_ocr()
    result = ocr_instance.predict(img_np)
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

_gemini_model = None
_last_api_key = None

def get_gemini_model(api_key: str):
    global _gemini_model, _last_api_key
    if _gemini_model is None or _last_api_key != api_key:
        print("FastAPI: Gemini modeli (re)config ediliyor...")
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel('gemini-2.5-flash')
        _last_api_key = api_key
    return _gemini_model

@app.post("/ocr")
async def do_ocr(file: UploadFile = File(...), fabric_types: Optional[str] = Form(None), gemini_api_key: Optional[str] = Form(None), custom_prompt: Optional[str] = Form(None)):
    filename = file.filename or ""
    print(f"FastAPI: Istek alindi. Dosya adi: {filename}")
    original_contents = await file.read()
    print(f"FastAPI: Dosya okundu. Boyut: {len(original_contents)} byte")
    
    # Gemini için optimize edilmiş kopya hazırlayalım (Görsel işleme optimizasyonu)
    gemini_contents = original_contents
    try:
        nparr = np.frombuffer(original_contents, np.uint8)
        img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_np is not None:
            # 1. Genişliği maksimum 600px yap (Okuma kalitesini bozmadan veri boyutunu minimize eder)
            img_resized = resize_if_needed(img_np, target_width=600)
            
            # 2. Ön İşleme (Grayscale + Kontrast Artırımı + Keskinleştirme)
            # Gri tonlama
            gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
            # CLAHE kontrast artırımı
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            gray_clahe = clahe.apply(gray)
            # Keskinleştirme (Sharpening)
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            sharpened = cv2.filter2D(gray_clahe, -1, kernel)
            
            # 3. WebP olarak %65 kalitede sıkıştır
            success, encoded_img = cv2.imencode('.webp', sharpened, [cv2.IMWRITE_WEBP_QUALITY, 65])
            if success:
                gemini_contents = encoded_img.tobytes()
                print(f"FastAPI: Görsel optimize edildi (600px, CLAHE, WebP 65). Yeni boyut: {len(gemini_contents)} byte")
    except Exception as img_err:
        print(f"UYARI: Görsel optimizasyonu yapılamadı, orijinal dosya kullanılacak: {img_err}")
    
    # Sanitize the incoming API key parameter
    raw_key = gemini_api_key.strip() if gemini_api_key else ""
    if raw_key in ["", "null", "undefined"]:
        raw_key = ""
    apiKey = raw_key if raw_key else os.environ.get("GEMINI_API_KEY")
    ocr_engine = os.environ.get("OCR_ENGINE", "gemini").lower()
    
    # Veritabanından gelen kumaş listesini prompt kuralına dönüştür
    fabric_list_instruction = ""
    user_fabrics = []
    if fabric_types:
        try:
            user_fabrics = json.loads(fabric_types)
            if user_fabrics and isinstance(user_fabrics, list):
                fabric_list_instruction = (
                    f"\nKRİTİK KURAL - kumaş türünü (fabricType) SADECE şu listede yer alan kayıtlı kumaş isimlerinden biriyle birebir eşleştirerek (veya en yakın olanına benzeterek) döndür:\n"
                    f"Kayıtlı Kumaş Listesi: {user_fabrics}\n"
                    "Listede olmayan hiçbir kumaş ismini döndürme. Eğer etiket üzerindeki kumaş adı bu listedeki hiçbir isimle makul ölçüde benzer değilse 'Bilinmeyen Kumaş' döndür."
                )
        except Exception as e:
            print(f"HATA: fabric_types parse edilemedi: {e}")
    
    if ocr_engine == "gemini" and apiKey:
        try:
            # API Anahtarı format doğrulaması (gRPC kilitlenmelerini önlemek için)
            if not re.match(r"^AIzaSy[a-zA-Z0-9_-]{33}$", apiKey):
                raise ValueError("Gecersiz Gemini API anahtari formati. Dogrulama atlaniyor.")
                
            print("FastAPI: Gemini Multimodal analizi basliyor...")
            model = get_gemini_model(apiKey)
            
            # Determine prompt instruction based on custom_prompt parameter
            sanitized_custom_prompt = custom_prompt.strip() if custom_prompt else ""
            if sanitized_custom_prompt in ["", "null", "undefined"]:
                sanitized_custom_prompt = ""
                
            if sanitized_custom_prompt:
                instruction = sanitized_custom_prompt
                if fabric_list_instruction:
                    instruction += f"\n{fabric_list_instruction}"
            else:
                instruction = (
                    "Sen tekstil etiketlerini analiz eden uzman bir yapay zekasın. Görseldeki etiket bilgilerini şu etiket şablonuna göre ayıkla:\n\n"
                    "ŞABLON:\n"
                    "- fabricType (Kumaş Adı / Kalite): Etiketteki 'KALİTE' veya 'KUMAŞ ADI' karşılığındaki gerçek kumaş cinsi (Örn: RONA, CROC, CORES, SÜPREM, RİBANA vb.). KESİNLİKLE 'LYCRA', 'LCYRA', 'LIKRA', 'EN LYCRA', 'ENLYCRA', 'ADI', 'KUMAŞ ADI', 'KUMAŞ', 'KALİTE', 'KALITE' kelimelerinin kendilerini buraya yazma. Bunların yanında veya altında yazan gerçek kumaş ismini bul.\n"
                    "- colorCode (Renk Kodu): Etiketteki 'COLOR' veya 'RENK' yanındaki sayısal/kısa kod (Örn: 4, 6, 12, 055. 1 ile 13 arası tam sayılara öncelik ver. Bulunamazsa boş bırak).\n"
                    "- lengthM (Metre / Uzunluk): Etiketteki 'Mt', 'MT', 'M' veya 'Metre' yanındaki sayısal uzunluk (Örn: 89.50, 73.90).\n"
                    "- netWeightKg (Net Ağırlık / Kg): Etiketteki 'Kg', 'KG', 'Kilo' veya 'Net' yanındaki sayısal net ağırlık (Örn: 25.30, 22.10).\n"
                    "- quality (Kalite Sınıfı): Etiketteki 'KALİTE' sınıfı (Genellikle '1'. Varsayılan: '1').\n"
                    "- barcodeNumber (Barkod / Top No): Etiketteki barkod çizgisi altında yazan veya 'TOPNO'/'BARCODE' yanındaki kod (Örn: 100234, IRS-2026-00001).\n\n"
                    "KURALLAR:\n"
                    f"{fabric_list_instruction}\n"
                )

            response = await model.generate_content_async(
                [
                    {"mime_type": "image/webp", "data": gemini_contents},
                    instruction
                ],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=FabricOcrResult,
                    temperature=0.0,
                ),
                request_options={"timeout": 30.0}
            )
            result_data = json.loads(response.text)
            print("FastAPI: Gemini Analizi Basarili:", result_data)
            return {
                "fabricType": result_data.get("fabricType") or "Bilinmeyen Kumaş",
                "lengthM": float(result_data.get("lengthM") or 0.0),
                "netWeightKg": float(result_data.get("netWeightKg") or 0.0),
                "colorCode": str(result_data.get("colorCode") or ""),
                "quality": str(result_data.get("quality") or "1"),
                "barcodeNumber": str(result_data.get("barcodeNumber") or ""),
                "rawText": f"Gemini API Analiz Sonucu\n{response.text}"
            }
        except Exception as e:
            print(f"HATA: Gemini API analizi sirasinda hata olustu: {e}")
            print("FastAPI: Otomatik olarak PaddleOCR fallback moduna geciliyor...")
            
    # Fallback durumunda orijinal yüksek çözünürlüklü veriyi byte olarak okumak için
    nparr = np.frombuffer(original_contents, np.uint8)
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
    
    # Eger user_fabrics tanımlıysa, önce okunan metinlerin içinde bu kumaş isimlerinden biri doğrudan geçiyor mu diye bakalım
    if user_fabrics:
        full_text_upper = full_text.upper()
        sorted_user_fabrics = sorted(user_fabrics, key=len, reverse=True)
        for fb in sorted_user_fabrics:
            fb_upper = fb.upper().strip()
            if fb_upper in full_text_upper:
                detected_fabric = fb
                break
                
    if not detected_fabric:
        for idx, text in enumerate(raw_texts):
            clean_text = text.strip()
            # İki nokta üst üste zorunlu olmayan esnek regex
            if re.search(r'\b(?:KALİTE|KALITE|QUALITY|KUMAS|KUMAŞ|CUMAS|CUMAŞ)\b', clean_text, re.IGNORECASE) and not re.search(r'\bNO\b', clean_text, re.IGNORECASE):
                val_match = re.search(r'(?:KALİTE|KALITE|QUALITY|KUMAS|KUMAŞ|CUMAS|CUMAŞ)\s*[:\-]?\s*([A-Za-zĞÜŞÖÇİğüşöçı\s]+)', clean_text, re.IGNORECASE)
                if val_match and val_match.group(1).strip():
                    val = val_match.group(1).strip()
                    if not val.isdigit() and len(val) > 2 and val.upper() not in ["ADI", "KUMAS", "KUMAŞ", "CUMAS", "CUMAŞ", "KALITE", "KALİTE", "QUALITY", "KUMASADI", "KUMAŞADI", "KUMSADI", "LYCRA", "LCYRA", "LIKRA", "EN LYCRA", "ENLYCRA"]:
                        detected_fabric = val
                        break
                
                # Alt satırlara bak (iki nokta üst üste alt satırda olabilir)
                for offset in range(1, 4):
                    if idx + offset < len(raw_texts):
                        next_line = raw_texts[idx + offset].strip()
                        next_line_clean = re.sub(r'^[:\-\s]+', '', next_line).strip()
                        if next_line_clean and not next_line_clean.isdigit():
                            upper_line = next_line_clean.upper()
                            if not any(kwd in upper_line for kwd in ["KALITE", "KALİTE", "COLOR", "COL", "RENK", "KUMAS", "KUMAŞ", "PARTI", "PARTİ", "TOPNO", "TOP NO", "TOP_NO", "NO", "MAMUL", "ISLETME", "İŞLETME", "ADI", "KUMSADI", "LYCRA", "LCYRA", "LIKRA", "EN LYCRA", "ENLYCRA"]):
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
                    if not any(kwd in upper_clean for kwd in ["KALITE", "KALİTE", "COLOR", "COL", "RENK", "KUMAS", "KUMAŞ", "PARTI", "PARTİ", "TOPNO", "TOP NO", "TOP_NO", "NO", "MAMUL", "ISLETME", "İŞLETME", "EDILMEZ", "EDİLMEZ", "REKLAM", "MALDAN", "KESILEN", "KESİLEN", "MT", "KG", "KILO", "ADI", "KUMSADI", "LYCRA", "LCYRA", "LIKRA", "EN LYCRA", "ENLYCRA"]):
                        if not re.search(r'\d', clean) and not any(u in upper_clean for u in ["MT", "KG", "KILO"]):
                            detected_fabric = clean
                            break
                            
    if detected_fabric:
        detected_fabric = get_fuzzy_fabric_name(detected_fabric, user_fabrics)
    
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
                        # Diğer etiket alanlarına geçildiyse aramayı durdur (örn: TOPNO, PARTINO)
                        next_line_upper = next_line.upper()
                        if any(hdr in next_line_upper for hdr in ["TOPNO", "TOP NO", "PARTI", "PARTİ", "MAMUL", "ISLETME", "İŞLETME", "KALITE", "KALİTE", "KUMAS", "KUMAŞ", "MT", "KG"]):
                            break
                        if not re.search(r'\d', next_line) and len(re.sub(r'[^a-zA-Z]', '', next_line)) > 1:
                            continue
                        next_line_clean = re.sub(r'^[:.\s-]+', '', next_line).strip()
                        next_line_clean = clean_ocr_number(next_line_clean)
                        if next_line_clean.isdigit():
                            detected_color_num = next_line_clean
                            break
                if detected_color_num:
                    break
                    
    # Fallback Renk Kodu: Metndeki bağımsız sayıları incele (Örn: 3, 4, 12, 055 vb.)
    if not detected_color_num:
        # Metndeki tüm 1-3 haneli bağımsız sayıları bul
        numbers = re.findall(r'\b\d{1,3}\b', full_text)
        for num in numbers:
            num_clean = num.strip()
            try:
                val_f = float(num_clean)
                if val_f != detected_length and val_f != detected_weight and num_clean != "150" and num_clean != "1":
                    # Eğer 1-13 arası geçerli bir tam sayıysa veya 3 haneli bir renk koduysa kabul et
                    if (1.0 <= val_f <= 13.0) or (100.0 <= val_f <= 999.0):
                        detected_color_num = num_clean
                        break
            except ValueError:
                continue

    # 4. Barkod Numarası Tespiti (Parti No veya Barkod)
    detected_barcode = ""
    barcode_match = re.search(r'\b(?:BARCODE|BARKOD|NO|PARTİ|PARTI|TOPNO|TOP NO)\s*[:.\s-]*([A-Z0-9-]+)\b', full_text, re.IGNORECASE)
    if barcode_match:
        detected_barcode = barcode_match.group(1).strip()
    else:
        irs_match = re.search(r'\b(IRS-\d{4}-\d{5})\b', full_text, re.IGNORECASE)
        if irs_match:
            detected_barcode = irs_match.group(1).strip()

    res = {
        "fabricType": detected_fabric or "Bilinmeyen Kumaş",
        "lengthM": detected_length,
        "netWeightKg": detected_weight,
        "colorCode": detected_color_num,
        "quality": "1",
        "barcodeNumber": detected_barcode,
        "rawText": full_text
    }
    print("FastAPI: PaddleOCR Fallback Sonucu:", res)
    return res

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
