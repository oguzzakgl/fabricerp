import os
os.environ["FLAGS_use_onednn"] = "0"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import numpy as np
# Monkey patch for imgaug compatibility with numpy 2.0
if not hasattr(np, "sctypes"):
    np.sctypes = {
        "float": [np.float16, np.float32, np.float64],
        "int": [np.int8, np.int16, np.int32, np.int64],
        "uint": [np.uint8, np.uint16, np.uint32, np.uint64],
        "bool": [bool]
    }

# Disable MKLDNN/OneDNN to prevent fused_conv2d error on Windows CPU
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["ONEDNN_PRIMITIVE_CACHE_CAPACITY"] = "0"



import cv2
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=False, lang="en", enable_mkldnn=False, cpu_threads=1, ocr_version="PP-OCRv4")

import glob
import re

def parse_decimal_string(str_val: str, max_limit: float) -> float:
    clean = re.sub(r'\s+', '', str_val)
    if '.' not in clean and ',' not in clean and len(clean) > 4:
        return 0.0
    if '.' not in clean and ',' not in clean and len(clean) >= 3:
        clean = clean[:-2] + '.' + clean[-2:]
    else:
        clean = clean.replace(',', '.')
    try:
        val = float(clean)
    except ValueError:
        return 0.0
    safety_counter = 0
    while val > max_limit and safety_counter < 5:
        val = val / 10.0
        safety_counter += 1
    return round(val, 2)

image_files = glob.glob("ornekocretiketleri/*.jpeg") + glob.glob("ornekocretiketleri/*.jpg")
for img_path in image_files:
    print(f"\n========================================\nDOSYA: {img_path}\n========================================")
    img = cv2.imread(img_path)
    print(f"Resim yuklendi mi? {img is not None}")
    if img is None:
        print("HATA: Resim okunamadi!")
        continue
    result = ocr.ocr(img)
    
    raw_texts = []
    if result and result[0]:
        for line in result[0]:
            raw_texts.append(line[1][0])
            
    full_text = "\n".join(raw_texts)
    
    # 1. Kumaş Adı Ayıklama (Gelişmiş Mantık)
    detected_fabric = ""
    for idx, text in enumerate(raw_texts):
        clean_text = text.strip()
        # KALİTE veya KALITE kelimesini arıyoruz (KALITE NO hariç)
        if re.search(r'\bKALİTE\b|\bKALITE\b', clean_text, re.IGNORECASE) and not re.search(r'\bNO\b', clean_text, re.IGNORECASE):
            val_match = re.search(r'(?:KALİTE|KALITE)\s*[:\-]*\s*([A-Za-zğüşöçİĞÜŞÖÇ]+)', clean_text, re.IGNORECASE)
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
            clean_alpha = re.sub(r'[^a-zA-ZğüşöçİĞÜŞÖÇ]', '', clean)
            if len(clean_alpha) >= 3:
                upper_clean = clean.upper()
                if not any(kwd in upper_clean for kwd in ["KALITE", "COLOR", "KUMAS", "PARTI", "TOPNO", "MAMUL", "ISLETME", "EDILMEZ", "REKLAM", "MALDAN", "KESILEN", "LYCRA", "MT", "KG"]):
                    # Sayı veya Mt/Kg birimleri içermesin
                    if not re.search(r'\d', clean) and not any(u in upper_clean for u in ["MT", "KG", "KILO"]):
                        detected_fabric = clean
                        break
                        
    # 2. Metre ve Ağırlık Ayıklama
    detected_length = 0.0
    detected_weight = 0.0
    
    length_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:Mt|mt|M|m|MI|Nt|nt|t|ME|Mf|MC|Me|MD)\b', full_text, re.IGNORECASE)
    weight_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:Kg|kg|Kilo|kilo|Kq|kq|Ky|ky|K9|K:|K\b)\b', full_text, re.IGNORECASE)
    
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
    
    # 3. Renk Numarası Tespiti (COLOR [sayı])
    detected_color_num = ""
    color_num_match = re.search(r'(?:COLOR|COL\s*OR|COL|Renk|renk|Color|color|Col|col|Cor|cor|CO|CL|CR)\s*[:\s-]*([1-7])\b', full_text, re.IGNORECASE)
    
    if color_num_match:
        detected_color_num = color_num_match.group(1)
    else:
        color_keyword_match = re.search(r'(?:COLOR|COL\s*OR|COL|Renk|Color|Col|Cor|cor|CO|CL|CR)[^0-9]{0,35}([1-7])\b', full_text, re.IGNORECASE)
        if color_keyword_match:
            match_str = color_keyword_match.group(0).upper()
            if "TOP" not in match_str:
                detected_color_num = color_keyword_match.group(1)
            
    print(f"Kumaş Adı (Kalite): {detected_fabric}")
    print(f"Metre: {detected_length}")
    print(f"Ağırlık: {detected_weight}")
    print(f"Renk Kodu: {detected_color_num}")
    print("--- RAW TEXT ---")
    print(full_text)



