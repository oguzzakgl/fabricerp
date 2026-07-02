FROM python:3.10-slim

WORKDIR /app

# Sistem kütüphaneleri
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Sadece Gemini tabanlı OCR için gerekli hafif bağımlılıklar
# PaddleOCR/PaddlePaddle kaldırıldı - Cloud Run'da çalışmıyor (Segfault)
RUN pip install --no-cache-dir \
    "numpy==1.26.4" \
    "fastapi==0.115.0" \
    "uvicorn==0.30.6" \
    "python-multipart==0.0.12" \
    "opencv-python-headless==4.10.0.84" \
    "google-generativeai>=0.8.0" \
    "Pillow>=10.0.0" \
    "python-dotenv==1.0.0" \
    "pydantic>=2.0.0"

# Kodları kopyala
COPY ocr_service.py .
COPY imghdr.py .

EXPOSE 8000

# Cloud Run dinamik PORT desteği
CMD ["sh", "-c", "uvicorn ocr_service:app --host 0.0.0.0 --port ${PORT:-8000}"]
