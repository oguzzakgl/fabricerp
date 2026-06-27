import requests  # type: ignore
import os

url = "http://127.0.0.1:8000/ocr"
folder = "c:/Users/ouz/Desktop/fabricerp/ornekocretiketleri"

for filename in os.listdir(folder):
    if filename.endswith(".jpeg") or filename.endswith(".jpg"):
        filepath = os.path.join(folder, filename)
        with open(filepath, "rb") as f:
            files = {"file": (filename, f, "image/jpeg")}
            try:
                r = requests.post(url, files=files)
                res = r.json()
                print(f"File: {filename}")
                print(f"  Fabric: {res.get('fabricType')}")
                print(f"  ColorCode: {res.get('colorCode')}")
                print(f"  Length: {res.get('lengthM')}")
                print(f"  Weight: {res.get('netWeightKg')}")
                print("-" * 40)
            except Exception as e:
                print(f"Error on {filename}: {e}")
