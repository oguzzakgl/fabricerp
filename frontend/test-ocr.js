import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = 'c:/Users/ouz/Desktop/fabricerp/ornekocretiketleri';

const parseDecimalString = (str, maxLimit) => {
  let clean = str.replace(/\s+/g, '');
  
  // İşletme No (örn: 26000558) gibi 4 haneden uzun düz sayıları eliyoruz
  if (!clean.includes('.') && !clean.includes(',') && clean.length > 4) {
    return 0;
  }

  if (!clean.includes('.') && !clean.includes(',') && clean.length >= 3) {
    clean = clean.slice(0, -2) + '.' + clean.slice(-2);
  } else {
    clean = clean.replace(',', '.');
  }
  let val = Number(clean);
  if (isNaN(val)) return 0;

  let safetyCounter = 0;
  while (val > maxLimit && safetyCounter < 5) {
    val = val / 10;
    safetyCounter++;
  }
  return Number(val.toFixed(2));
};

const getSimilarity = (s1, s2) => {
  let longer = s1.toLowerCase().trim();
  let shorter = s2.toLowerCase().trim();
  if (s1.length < s2.length) {
    longer = s2.toLowerCase().trim();
    shorter = s1.toLowerCase().trim();
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const costs = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  const distance = costs[shorter.length];
  return (longerLength - distance) / longerLength;
};

const KNOWN_FABRICS = ["EN LYCRA", "RONA"]; 
const findBestFabricMatch = (detectedName) => {
  if (!detectedName) return '';
  let bestMatch = detectedName;
  let highestSim = 0;

  KNOWN_FABRICS.forEach(fabric => {
    const sim = getSimilarity(detectedName, fabric);
    if (sim > highestSim) {
      highestSim = sim;
      bestMatch = fabric;
    }
  });

  return highestSim >= 0.65 ? bestMatch : detectedName;
};

async function runTest() {
  console.log("OCR Motoru başlatılıyor...");
  const worker = await createWorker('eng+tur');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.,:/-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
  });

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`${files.length} adet resim bulundu. Analiz başlatılıyor...\n`);

  for (const file of files) {
    const filePath = path.join(IMAGES_DIR, file);
    console.log(`----------------------------------------`);
    console.log(`Resim: ${file}`);
    
    try {
      const { data: { text } } = await worker.recognize(filePath);
      console.log("Ham Metin:\n" + text + "\n");

      // Kalite Ayıklama
      const qualityMatch = text.match(/(?:KALİTE|KALITE)(?!\s*NO)[^a-zA-Z0-9ğüşöçİĞÜŞÖÇ]*:\s*([A-Za-z0-9ğüşöçİĞÜŞÖÇ -]+)/i);
      let detectedQuality = qualityMatch ? qualityMatch[1].trim() : '';
      if (detectedQuality) {
        detectedQuality = findBestFabricMatch(detectedQuality);
      }

      // Metre / Kg Ayıklama
      let detectedLength = 0;
      let detectedWeight = 0;

      const lengthMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:Mt|mt|M|m|MI|Nt|nt|t|ME|Mf|MC|Me|MD)\b/i);
      const weightMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:Kg|kg|Kilo|kilo|Kq|kq|Ky|ky|K9|K:|K\b)\b/i);

      if (lengthMatch) {
        detectedLength = parseDecimalString(lengthMatch[1], 150);
      }
      if (weightMatch) {
        detectedWeight = parseDecimalString(weightMatch[1], 50);
      }

      // Fallback
      if (detectedLength === 0 || detectedWeight === 0) {
        const decimalNumbers = [];
        const numberPattern = /(\d+[\.,]\d+|\b\d{3,4}\b)/g;
        let match;
        let numberIndex = 0;
        while ((match = numberPattern.exec(text)) !== null) {
          const currentLimit = numberIndex === 0 ? 150 : 50;
          const num = parseDecimalString(match[1], currentLimit);
          if (!isNaN(num) && num > 0) {
            decimalNumbers.push(num);
            numberIndex++;
          }
        }
        if (decimalNumbers.length >= 2) {
          if (detectedLength === 0) detectedLength = decimalNumbers[0];
          if (detectedWeight === 0) detectedWeight = decimalNumbers[1];
        } else if (decimalNumbers.length === 1) {
          if (detectedLength === 0) detectedLength = decimalNumbers[0];
        }
      }

      if (detectedLength > 150) detectedLength = 0;
      if (detectedWeight > 50) detectedWeight = 0;

      // Renk Numarası Tespiti
      let detectedColorNum = '';
      const colorNumMatch = text.match(/(?:COLOR|COL\s*OR|COL|Renk|renk|Color|color|Col|col|Cor|cor|CO|CL|CR)\s*[:\s-]*([1-7])\b/i);
      if (colorNumMatch) {
        detectedColorNum = colorNumMatch[1];
      } else {
        const topNoMatch = text.match(/(?:TOP\s*NO|TOPNO)\s*[:\s]*(\d+)/i);
        const topNoVal = topNoMatch ? topNoMatch[1] : '';
        const colorKeywordMatch = text.match(/(?:COLOR|COL\s*OR|COL|Renk|Color|Col|Cor|CO|CL|CR)[^0-9]{0,15}([1-7])\b/i);
        if (colorKeywordMatch && colorKeywordMatch[1] !== topNoVal) {
          detectedColorNum = colorKeywordMatch[1];
        }
      }

      console.log(`  Kumaş Adı: ${detectedQuality || 'Bilinmeyen'}`);
      console.log(`  Metre    : ${detectedLength} mt`);
      console.log(`  Ağırlık  : ${detectedWeight} kg`);
      console.log(`  Renk Kodu: ${detectedColorNum || 'Bilinmeyen'}`);
      console.log(`  Kalite   : 1`);

    } catch (err) {
      console.error(`  Hata oluştu:`, err);
    }
  }

  await worker.terminate();
  console.log(`\nTest tamamlandı.`);
}

runTest();
