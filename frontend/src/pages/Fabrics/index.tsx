import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from 'antd';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface YarnOption {
  id: string;
  yarnType: string;
  lotNumber: string;
  unitPrice: string;
}

interface RollDetail {
  id: string;
  barcodeNumber: string;
  lengthM: number;
  netWeightKg: number;
  weightGsm: number;
  costPrice: number;
  status: string; // 'available', 'reserved', 'sold'
  notes: string;
}

interface OcrRecord {
  id: string;
  fabricType: string;
  lengthM: number;
  netWeightKg: number;
  colorCode: string;
  colorName: string;
  quality: string;
  fileName: string;
}

interface FabricCard {
  id: string;
  fabricType: string;
  pricePerMeter: number;
  imageUrl?: string | null;
  colorMapping?: Record<string, string> | null;
}

interface OcrAccount {
  id: string;
  code: string;
  name: string;
  ocrPrompt?: string;
}

interface GroupedFabric {
  fabricType: string;
  code: string;
  pricePerMeter: number;
  colors: {
    [colorName: string]: {
      rolls: RollDetail[];
    };
  };
  totalRolls: number;
  totalLength: number;
  colorCount: number;
}

const generateBarcode = () => {
  return `BAR-KM-${Math.floor(100000 + Math.random() * 900000)}`;
};

const generateUniqueId = () => {
  return `record_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const Fabrics: React.FC = () => {
  const { tenant } = useAuth();
  const [rolls, setRolls] = useState<RollDetail[]>([]);
  const [yarnStocks, setYarnStocks] = useState<YarnOption[]>([]);
  const [loading, setLoading] = useState(false);

  // OCR & Hızlı Giriş Modal State'leri
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [ocrFabricName, setOcrFabricName] = useState('');
  const [presetFabricName, setPresetFabricName] = useState<string | null>(null);
  const [colorMappings, setColorMappings] = useState<{ [key: string]: string }>({
    '1': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
    '6': '',
    '7': '',
    '8': '',
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [detectedData, setDetectedData] = useState<OcrRecord | null>(null);
  const [fabricCardsMap, setFabricCardsMap] = useState<Record<string, FabricCard>>({});
  const [accounts, setAccounts] = useState<OcrAccount[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [selectedFabricForColor, setSelectedFabricForColor] = useState<string>('');
  const [localColorMapping, setLocalColorMapping] = useState<{ [key: string]: string }>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<OcrRecord[]>([]);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [scanLogs, setScanLogs] = useState<{ time: string; text: string; type: 'success' | 'error' | 'warning' }[]>([]);

  // Expanded card state
  const [expandedFabric, setExpandedFabric] = useState<string | null>(null);

  // Modals/Drawers
  const [modalOpen, setModalOpen] = useState(false);
  
  // Price Edit Modal
  const [editPriceModalOpen, setEditPriceModalOpen] = useState(false);
  const [selectedFabricForPriceEdit, setSelectedFabricForPriceEdit] = useState<GroupedFabric | null>(null);
  const [editPriceValue, setEditPriceValue] = useState(150);

  // Add Roll Modal
  const [addRollModalOpen, setAddRollModalOpen] = useState(false);
  const [selectedFabricForRollAdd, setSelectedFabricForRollAdd] = useState<GroupedFabric | null>(null);
  const [selectedColorForRollAdd, setSelectedColorForRollAdd] = useState<string | null>(null);

  // Form states for Single Roll Add
  const [singleLengthM, setSingleLengthM] = useState(100);
  const [singleNetWeightKg, setSingleNetWeightKg] = useState(30);
  const [singleAtkiYarnId, setSingleAtkiYarnId] = useState('');
  const [singleAtkiWeight, setSingleAtkiWeight] = useState(150);
  const [singleCozguYarnId, setSingleCozguYarnId] = useState('');
  const [singleCozguWeight, setSingleCozguWeight] = useState(200);

  // Form states for "Yeni Kumaş Girişi"
  const [fabricName, setFabricName] = useState('');
  const [pricePerMeter, setPricePerMeter] = useState(150);
  const [widthCm, setWidthCm] = useState(150);
  const [colorsInput, setColorsInput] = useState<{
    colorName: string;
    rolls: { lengthM: number; netWeightKg: number }[];
  }[]>([]);
  const [newColorName, setNewColorName] = useState('');

  // Yarns for Recipe
  const [atkiYarnId, setAtkiYarnId] = useState('');
  const [atkiWeight, setAtkiWeight] = useState(150);
  const [cozguYarnId, setCozguYarnId] = useState('');
  const [cozguWeight, setCozguWeight] = useState(200);
  const [hasRecipeInput, setHasRecipeInput] = useState(false);
  const [singleHasRecipeInput, setSingleHasRecipeInput] = useState(false);

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/rolls', { 
        params: { 
          limit: 1000, 
          includeRecipe: 'false' 
        } 
      });
      setRolls(response.data.data);
    } catch (error) {
      console.error('Kumaş topları yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchYarns = useCallback(async () => {
    try {
      const res = await apiClient.get('/yarn-stocks', { params: { limit: 100 } });
      const list = res.data.data.map((item: { id: string; yarnType: string; lotNumber: string; unitPrice: string }) => ({
        id: item.id,
        yarnType: item.yarnType,
        lotNumber: item.lotNumber,
        unitPrice: item.unitPrice,
      }));
      setYarnStocks(list);
    } catch (error) {
      console.error('İplik stokları yüklenemedi:', error);
    }
  }, []);

  const fetchFabricCards = useCallback(async () => {
    try {
      const res = await apiClient.get('/fabric-cards');
      const cardsMap = res.data.reduce((acc: Record<string, FabricCard>, card: FabricCard) => {
        acc[card.fabricType.toUpperCase().trim()] = card;
        return acc;
      }, {});
      setFabricCardsMap(cardsMap);
    } catch (err) {
      console.error('Kumaş kartelaları yüklenemedi:', err);
    }
  }, []);

  const fetchAccountsForOcr = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounts', { params: { limit: 1000 } });
      setAccounts(res.data.data || []);
    } catch (err) {
      console.error('Cariler yüklenemedi:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (active) {
        await Promise.all([
          fetchRolls(),
          fetchYarns(),
          fetchFabricCards(),
        ]);
      }
    };
    void loadData();
    return () => {
      active = false;
    };
  }, [fetchRolls, fetchYarns, fetchFabricCards]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scan') === 'true') {
      const timer = setTimeout(() => {
        void fetchAccountsForOcr();
        setOcrModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [fetchAccountsForOcr]);

  const handleUploadCardImage = async (fabricType: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const uploadRes = await apiClient.post('/fabric-cards/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = uploadRes.data.imageUrl;
      
      await apiClient.post('/fabric-cards', {
        fabricType,
        imageUrl,
      });
      
      await fetchFabricCards();
      alert('Kartela görseli başarıyla yüklendi.');
    } catch (err) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj.response?.data?.message || 'Görsel yükleme başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenColorMappingModal = (fabricType: string) => {
    setSelectedFabricForColor(fabricType);
    const card = fabricCardsMap[fabricType.toUpperCase().trim()];
    
    if (card && card.colorMapping) {
      setLocalColorMapping(card.colorMapping);
    } else {
      setLocalColorMapping({
        '1': '',
        '2': '',
        '3': '',
        '4': '',
        '5': '',
        '6': '',
        '7': '',
        '8': '',
      });
    }
    setColorModalOpen(true);
  };

  const handleAddLocalColorRow = () => {
    setLocalColorMapping(prev => {
      const keys = Object.keys(prev).map(Number);
      const nextKey = keys.length > 0 ? Math.max(...keys) + 1 : 1;
      return {
        ...prev,
        [String(nextKey)]: ''
      };
    });
  };

  const handleUpdateLocalColorValue = (key: string, value: string) => {
    setLocalColorMapping(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveColorMapping = async () => {
    setLoading(true);
    try {
      await apiClient.post('/fabric-cards', {
        fabricType: selectedFabricForColor,
        colorMapping: localColorMapping,
      });
      await fetchFabricCards();
      setColorModalOpen(false);
      alert('Renk tanımları başarıyla kaydedildi.');
    } catch (err) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      console.error('Renk tanımları kaydedilemedi:', err);
      alert(errorObj.response?.data?.message || 'Renk tanımları kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const backendUrl = apiBase.replace(/\/api$/, '');
      return `${backendUrl}${url}`;
    }
    return url;
  };

  // İki metin arasındaki benzerliği hesaplayan Levenshtein mesafe algoritması
  const getSimilarity = (s1: string, s2: string): number => {
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

  // OCR ile okunan kumaş adını sistemdeki kumaşlar arasından fuzzy eşleştirme ile düzeltir
  const findBestFabricMatch = (detectedName: string): string => {
    if (!detectedName) return '';
    let bestMatch = detectedName;
    let highestSim = 0;

    groupedFabrics.forEach(fabric => {
      const sim = getSimilarity(detectedName, fabric.fabricType);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = fabric.fabricType;
      }
    });

    // Eğer benzerlik %65 veya daha fazlaysa otomatik olarak kayıtlı ismi kullan
    return highestSim >= 0.65 ? bestMatch : detectedName;
  };

  // Kamera cihazlarını listele
  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        const backCam = videoDevices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('arka') || 
          d.label.toLowerCase().includes('environment')
        );
        setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Kamera cihazları alınamadı:', err);
    }
  };

  // Kamerayı başlat
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    setIsCameraActive(false);
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    const targetId = deviceId || selectedCameraId;
    const constraints: MediaStreamConstraints = {
      video: targetId 
        ? { deviceId: { exact: targetId } }
        : { facingMode: 'environment' }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        videoRef.current.play().catch(e => console.warn('Video play error:', e));
      }
    } catch (err) {
      console.warn('Birinci kamera denemesi başarısız, basit mod deneniyor:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          setIsCameraActive(true);
          videoRef.current.play().catch(e => console.warn('Fallback video play error:', e));
        }
      } catch (fallbackErr) {
        console.error('Kamera tamamen başlatılamadı:', fallbackErr);
        setCameraError('Kameraya erişilemedi. Lütfen tarayıcı/uygulama kamera izinlerinizi kontrol edin.');
      }
    }
  };

  // Kamerayı durdur
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Eşleştirmeye yeni renk/numara satırı ekle
  const handleAddColorMappingRow = () => {
    setColorMappings(prev => {
      const keys = Object.keys(prev).map(Number);
      const nextKey = keys.length > 0 ? Math.max(...keys) + 1 : 1;
      return {
        ...prev,
        [String(nextKey)]: ''
      };
    });
  };

  // Eşleştirme değerini güncelle
  const handleUpdateColorMappingValue = (key: string, value: string) => {
    setColorMappings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const addScanLog = (text: string, type: 'success' | 'error' | 'warning') => {
    const time = new Date().toLocaleTimeString();
    setScanLogs(prev => [{ time, text, type }, ...prev]);
  };

  // Görseli Canvas kullanarak maksimum 800px genişlik/yükseklikte ve %70 kalitede WebP olarak sıkıştırır
  const compressImage = (fileOrBlob: File | Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(fileOrBlob);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(fileOrBlob);
              }
            },
            'image/webp',
            0.70
          );
        };
        img.onerror = () => resolve(fileOrBlob);
      };
      reader.onerror = () => resolve(fileOrBlob);
    });
  };

  // Backend PaddleOCR Servisi ile OCR analizi yapan ortak fonksiyon
  const processOCR = async (fileOrBlob: File | Blob, fileName: string) => {
    try {
      addScanLog(`${fileName} sıkıştırılıyor...`, 'warning');
      const compressedBlob = await compressImage(fileOrBlob);
      addScanLog(`Sıkıştırıldı: ${Math.round(compressedBlob.size / 1024)} KB`, 'warning');

      const formData = new FormData();
      formData.append('file', compressedBlob, fileName.endsWith('.webp') ? fileName : `${fileName}.webp`);
      if (selectedCustomerId) {
        formData.append('customerId', selectedCustomerId);
      }

      const response = await apiClient.post('/rolls/ocr', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;
      if (data.error) {
        throw new Error(data.error);
      }

      const detectedFabric = data.fabricType || '';
      let finalFabric = detectedFabric;

      if (presetFabricName) {
        finalFabric = presetFabricName;
        addScanLog(`Kumaş tipi ön tanımlı (${presetFabricName}) olarak kilitlendi, etiket okuması atlandı.`, 'success');
      } else {
        const expectedFabric = ocrFabricName ? ocrFabricName.trim() : '';
        if (expectedFabric) {
          // Girdiğimiz isim ile okunan ismi karşılaştır (Büyük/küçük harf duyarsız veya benzerlik >= 0.75)
          const isMatch = (detectedFabric.toLowerCase() === expectedFabric.toLowerCase()) || 
                          (getSimilarity(detectedFabric, expectedFabric) >= 0.75);
          if (isMatch) {
            finalFabric = expectedFabric;
            addScanLog(`Etiketteki kumaş adı girdiğiniz ile eşleşti: ${expectedFabric}`, 'success');
          } else {
            // Eşleşmedi, ayarlardan eklenen listeye (fabricCardsMap) bakalım
            const settingsMatch = findBestFabricMatch(detectedFabric);
            const hasSettingsMatch = settingsMatch && !!fabricCardsMap[settingsMatch.toUpperCase().trim()];
            
            if (hasSettingsMatch) {
              finalFabric = settingsMatch;
              addScanLog(`Uyarı: Okunan kumaş (${detectedFabric}) girdiğiniz (${expectedFabric}) ile eşleşmedi fakat tanımlı listenizde bulunduğu için (${settingsMatch}) olarak eklendi.`, 'warning');
            } else {
              // Ayarlar listesinde de yoksa, uyarı ver
              finalFabric = expectedFabric;
              addScanLog(`UYARI: Okunan kumaş (${detectedFabric}) girdiğiniz (${expectedFabric}) ile eşleşmiyor ve tanımlı listenizde yok!`, 'error');
              alert(`Uyarı: Okunan kumaş '${detectedFabric}', girdiğiniz '${expectedFabric}' ile eşleşmiyor ve tanımlı kumaş listenizde bulunamadı!`);
            }
          }
        } else {
          // Beklenen isim girilmemişse standart fuzzy eşleme yap
          if (detectedFabric) {
            finalFabric = findBestFabricMatch(detectedFabric);
          }
        }
      }

      const detectedColorNum = data.colorCode || '';
      let matchedColorName = '';
      
      const targetFabricUpper = (finalFabric || '').toUpperCase().trim();
      const card = fabricCardsMap[targetFabricUpper];
      if (card && card.colorMapping && card.colorMapping[detectedColorNum]) {
        matchedColorName = `Renk ${detectedColorNum} - ${card.colorMapping[detectedColorNum]}`;
      } else {
        matchedColorName = detectedColorNum 
          ? (isNaN(Number(detectedColorNum)) ? detectedColorNum : `Renk ${detectedColorNum}`) 
          : 'Bilinmeyen Renk';
      }

      let currentScore = 0;
      if (data.lengthM > 0) currentScore += 10;
      if (data.netWeightKg > 0) currentScore += 10;
      if (detectedColorNum) currentScore += 10;
      if (finalFabric && finalFabric !== 'Bilinmeyen Kumaş') currentScore += 10;

      return {
        fabricType: finalFabric || 'Bilinmeyen Kumaş',
        lengthM: data.lengthM || 0,
        netWeightKg: data.netWeightKg || 0,
        colorCode: detectedColorNum,
        colorName: matchedColorName,
        quality: '1',
        rawText: data.rawText || '',
        score: currentScore,
      };
    } catch (err) {
      const errorObj = err as Error;
      console.error('OCR API Hatası:', err);
      addScanLog(`Hata: ${fileName} işlenemedi. ${errorObj.message || ''}`, 'error');
      return null;
    }
  };

  // Fotoğraf çek ve kılavuz çerçeveyi kırparak OCR analizi yap
  const captureAndProcessOCR = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setOcrLoading(true);

    const video = videoRef.current;
    const rawCanvas = canvasRef.current;
    
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    
    // Kılavuz hizalama oranları (genişlik %55, yükseklik %90)
    const cropW = videoW * 0.55;
    const cropH = videoH * 0.90;
    const cropX = (videoW - cropW) / 2;
    const cropY = (videoH - cropH) / 2;

    rawCanvas.width = cropW;
    rawCanvas.height = cropH;

    const ctx = rawCanvas.getContext('2d');
    if (!ctx) {
      setOcrLoading(false);
      return;
    }
    
    // Sadece kılavuz alanındaki görüntüyü keserek canvas'a çiziyoruz (gürültüyü önler ve hızı artırır)
    ctx.drawImage(
      video,
      cropX, cropY, cropW, cropH, // Kaynak alan (video üzerindeki kırpma koordinatları)
      0, 0, cropW, cropH          // Hedef alan (canvas'ın tamamı)
    );

    rawCanvas.toBlob(async (blob) => {
      if (!blob) {
        addScanLog('Kamera görüntüsü yakalanamadı.', 'error');
        setOcrLoading(false);
        return;
      }

      try {
        addScanLog('Kamera görüntüsü taranıyor...', 'warning');
        const result = await processOCR(blob, 'capture.jpg');

        if (result) {
          const newRecord = {
            id: generateUniqueId(),
            fabricType: result.fabricType,
            lengthM: result.lengthM,
            netWeightKg: result.netWeightKg,
            colorCode: result.colorCode,
            colorName: result.colorName,
            quality: result.quality,
            fileName: 'Kamera Yakalaması',
          };

          setDetectedItems(prev => {
            const isDuplicate = prev.some(item => Number(item.lengthM) === Number(newRecord.lengthM) && item.fabricType === newRecord.fabricType);
            if (isDuplicate) {
              alert(`Dikkat: Listede aynı metraja (${newRecord.lengthM} mt) sahip başka bir ${newRecord.fabricType} rulosu zaten var! (Mükerrer 2. kayıt olabilir)`);
            }
            const updated = [...prev, newRecord];
            setDetectedData(newRecord);
            setActiveEditIndex(updated.length - 1);
            return updated;
          });

          addScanLog(`Kamera Taraması Başarılı! Skor: ${result.score}/40. Metre: ${result.lengthM}, Ağırlık: ${result.netWeightKg}`, 'success');

          if (result.fabricType && ocrFabricName && result.fabricType.toLowerCase() !== ocrFabricName.toLowerCase()) {
            addScanLog(`Uyarı: Etiketteki kumaş adı (${result.fabricType}) girdiğiniz (${ocrFabricName}) ile uyuşmuyor!`, 'warning');
          }
        } else {
          addScanLog('Kamera etiketinden veri okunamadı.', 'error');
        }
      } catch (err) {
        console.error(err);
        addScanLog('Kamera OCR işlemi sırasında hata oluştu.', 'error');
      } finally {
        setOcrLoading(false);
      }
    }, 'image/jpeg', 0.95);
  };

  // Galeriden Seçilen Çoklu Görselleri Analiz Et
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setOcrLoading(true);
    addScanLog(`${files.length} adet dosya yükleniyor, toplu analiz başlatıldı...`, 'warning');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      addScanLog(`Analiz ediliyor (${i + 1}/${files.length}): ${file.name}`, 'warning');

      try {
        const result = await processOCR(file, file.name);
        if (result) {
          const newRecord = {
            id: generateUniqueId(),
            fabricType: result.fabricType,
            lengthM: result.lengthM,
            netWeightKg: result.netWeightKg,
            colorCode: result.colorCode,
            colorName: result.colorName,
            quality: result.quality,
            fileName: file.name,
          };

          setDetectedItems(prev => {
            const isDuplicate = prev.some(item => Number(item.lengthM) === Number(newRecord.lengthM) && item.fabricType === newRecord.fabricType);
            if (isDuplicate) {
              alert(`Dikkat: Listede aynı metraja (${newRecord.lengthM} mt) sahip başka bir ${newRecord.fabricType} rulosu zaten var! (Mükerrer 2. kayıt olabilir)`);
            }
            const updated = [...prev, newRecord];
            if (updated.length === 1) {
              setDetectedData(newRecord);
              setActiveEditIndex(0);
            } else if (activeEditIndex === null) {
              setDetectedData(newRecord);
              setActiveEditIndex(updated.length - 1);
            }
            return updated;
          });

          addScanLog(`Başarılı: ${file.name} (Skor: ${result.score}/40). Metre: ${result.lengthM}, Ağırlık: ${result.netWeightKg}`, 'success');
        } else {
          addScanLog(`Hata: ${file.name} etiketinden veri okunamadı.`, 'error');
        }
      } catch (err) {
        console.error(`Dosya işleme hatası (${file.name}):`, err);
        addScanLog(`Hata: ${file.name} işlenemedi.`, 'error');
      }
    }

    setOcrLoading(false);
    // Reset file input value so same files can be re-uploaded if needed
    e.target.value = '';
  };

  // Listeden bir kaydı sil
  const handleRemoveItemFromDetectedList = (index: number) => {
    setDetectedItems(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setDetectedData(null);
        setActiveEditIndex(null);
      } else {
        const newIndex = index >= updated.length ? updated.length - 1 : index;
        setActiveEditIndex(newIndex);
        setDetectedData(updated[newIndex]);
      }
      return updated;
    });
  };

  // Listeden bir kaydı seçip düzenle
  const handleSelectActiveEditItem = (index: number) => {
    setActiveEditIndex(index);
    setDetectedData(detectedItems[index]);
  };

  // Form verisi değiştikçe dizide ve aktif state'te güncelle
  const handleUpdateActiveOcrField = (field: string, value: string | number) => {
    if (activeEditIndex === null || !detectedData) return;

    const updatedRecord = { ...detectedData, [field]: value };
    if (field === 'colorCode') {
      updatedRecord.colorName = colorMappings[value] || (value ? `Renk ${value}` : 'Bilinmeyen Renk');
    }

    setDetectedData(updatedRecord);
    setDetectedItems(prev => prev.map((item, idx) => idx === activeEditIndex ? updatedRecord : item));
  };

  // Taranan ruloların tamamını kaydet
  const handleSaveAllOcrRolls = async () => {
    if (detectedItems.length === 0) return;

    const invalidItems = detectedItems.filter(item => item.lengthM <= 0 || item.netWeightKg <= 0 || !item.fabricType);
    if (invalidItems.length > 0) {
      alert(`Listede metraj, ağırlık veya kumaş adı hatalı/eksik olan ${invalidItems.length} adet kayıt bulunmaktadır. Lütfen kaydetmeden önce bu kırmızı alanları düzeltin.`);
      return;
    }

    setLoading(true);
    addScanLog(`Toplu kayıt işlemi başlatıldı (${detectedItems.length} top)...`, 'warning');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < detectedItems.length; i++) {
      const item = detectedItems[i];
      try {
        const grammage = calculateGrammage(item.lengthM, item.netWeightKg);
        const existingFabric = groupedFabrics.find(f => f.fabricType.toLowerCase() === item.fabricType.toLowerCase());
        const price = existingFabric ? existingFabric.pricePerMeter : 150;

        const notesObj = { pricePerMeter: price };
        const notesStr = JSON.stringify(notesObj);

        const payload = {
          barcodeNumber: generateBarcode(),
          fabricType: item.fabricType,
          color: item.colorName,
          widthCm: 150,
          weightGsm: grammage,
          lengthM: item.lengthM,
          netWeightKg: item.netWeightKg,
          quality: '1',
          notes: notesStr,
        };

        await apiClient.post('/rolls', payload);
        successCount++;
      } catch (err) {
        console.error(`Top kaydedilemedi:`, err);
        failCount++;
      }
    }

    setLoading(false);
    if (successCount > 0) {
      addScanLog(`Toplu Kayıt Başarılı! ${successCount} top envantere eklendi. ${failCount > 0 ? `${failCount} top başarısız.` : ''}`, 'success');
      alert(`Toplu kayıt işlemi tamamlanmıştır. Başarılı: ${successCount} rulo, Başarısız: ${failCount} rulo.`);
      setDetectedItems([]);
      setDetectedData(null);
      setActiveEditIndex(null);
      fetchRolls();
    } else {
      addScanLog('Toplu kayıt başarısız oldu.', 'error');
      alert('Toplu stok kaydı gerçekleştirilemedi. Lütfen sağ alttaki İşlem Günlüğü detaylarını inceleyin.');
    }
  };

  // Group rolls by fabricType
  const groupRolls = (rollsList: (RollDetail & { fabricType?: string; color?: string })[]): GroupedFabric[] => {
    const groups: { [key: string]: GroupedFabric } = {};

    rollsList.forEach((roll) => {
      const type = roll.fabricType || 'Bilinmeyen';
      if (!groups[type]) {
        let price = 150;
        try {
          if (roll.notes) {
            const parsed = JSON.parse(roll.notes);
            if (parsed && typeof parsed.pricePerMeter === 'number') {
              price = parsed.pricePerMeter;
            }
          }
        } catch {
          const num = Number(roll.notes);
          if (!isNaN(num) && num > 0) {
            price = num;
          }
        }

        groups[type] = {
          fabricType: type,
          code: `KM-${type.replace(/\s+/g, '-').toUpperCase()}`,
          pricePerMeter: price,
          colors: {},
          totalRolls: 0,
          totalLength: 0,
          colorCount: 0,
        };
      }

      const rawColor = roll.color || 'Bilinmeyen';
      let color = rawColor;
      const targetFabricUpper = type.toUpperCase().trim();
      const card = fabricCardsMap[targetFabricUpper];
      if (card && card.colorMapping) {
        if (card.colorMapping[rawColor]) {
          color = `Renk ${rawColor} (${card.colorMapping[rawColor]})`;
        } else {
          const cleanKey = rawColor.replace(/Renk\s*/i, '').trim();
          if (card.colorMapping[cleanKey]) {
            color = `Renk ${cleanKey} (${card.colorMapping[cleanKey]})`;
          }
        }
      }

      if (!groups[type].colors[color]) {
        groups[type].colors[color] = { rolls: [] };
      }

      groups[type].colors[color].rolls.push({
        id: roll.id,
        barcodeNumber: roll.barcodeNumber,
        lengthM: Number(roll.lengthM),
        netWeightKg: Number(roll.netWeightKg),
        weightGsm: Number(roll.weightGsm || 0),
        costPrice: Number(roll.costPrice || 0),
        status: roll.status,
        notes: roll.notes || '',
      });

      groups[type].totalRolls += 1;
      groups[type].totalLength += Number(roll.lengthM);
    });

    return Object.values(groups).map((g) => {
      g.colorCount = Object.keys(g.colors).length;
      return g;
    });
  };

  const groupedFabrics = groupRolls(rolls);



  // Yeni Kumaş Girişi: Renk Ekleme
  const handleAddColorToInput = () => {
    if (!newColorName.trim()) {
      alert('Lütfen eklemek istediğiniz renk ismini giriniz.');
      return;
    }
    if (colorsInput.some(c => c.colorName.toLowerCase() === newColorName.toLowerCase())) {
      alert('Dikkat: Bu renk zaten listenize eklenmiştir.');
      return;
    }

    let defaultM = 100;
    let defaultKg = 30;

    const firstColor = colorsInput[0];
    if (firstColor && firstColor.rolls.length > 0) {
      const firstRoll = firstColor.rolls[0];
      const firstM = Number(firstRoll.lengthM);
      const firstKg = Number(firstRoll.netWeightKg);
      if (firstM > 0 && firstKg > 0) {
        defaultM = firstM;
        const baseGrammage = firstKg / firstM;
        defaultKg = Number((defaultM * baseGrammage).toFixed(2));
      }
    }

    setColorsInput(prev => [
      ...prev,
      {
        colorName: newColorName,
        rolls: [{ lengthM: defaultM, netWeightKg: defaultKg }]
      }
    ]);
    setNewColorName('');
  };

  const handleRemoveColorFromInput = (index: number) => {
    setColorsInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddRollToColorInput = (colorIndex: number) => {
    setColorsInput(prev => {
      let defaultM = 100;
      let defaultKg = 30;

      const firstColor = prev[0];
      if (firstColor && firstColor.rolls.length > 0) {
        const firstRoll = firstColor.rolls[0];
        const firstM = Number(firstRoll.lengthM);
        const firstKg = Number(firstRoll.netWeightKg);
        if (firstM > 0 && firstKg > 0) {
          defaultM = firstM;
          const baseGrammage = firstKg / firstM;
          defaultKg = Number((defaultM * baseGrammage).toFixed(2));
        }
      }

      return prev.map((colorObj, cIdx) => {
        if (cIdx === colorIndex) {
          return {
            ...colorObj,
            rolls: [...colorObj.rolls, { lengthM: defaultM, netWeightKg: defaultKg }]
          };
        }
        return colorObj;
      });
    });
  };

  const handleRemoveRollFromColorInput = (colorIndex: number, rollIndex: number) => {
    setColorsInput(prev => {
      return prev.map((colorObj, cIdx) => {
        if (cIdx === colorIndex) {
          return {
            ...colorObj,
            rolls: colorObj.rolls.filter((_, i) => i !== rollIndex)
          };
        }
        return colorObj;
      });
    });
  };

  const handleRollValueChange = (colorIndex: number, rollIndex: number, field: 'lengthM' | 'netWeightKg', value: number) => {
    setColorsInput(prev => {
      // Create a deep copy of prev to avoid mutating state directly
      const next = prev.map((colorObj, cIdx) => ({
        ...colorObj,
        rolls: colorObj.rolls.map((roll, rIdx) => {
          if (cIdx === colorIndex && rIdx === rollIndex) {
            return { ...roll, [field]: value };
          }
          return { ...roll };
        })
      }));

      const firstColor = next[0];
      if (firstColor && firstColor.rolls.length > 0) {
        const firstRoll = firstColor.rolls[0];
        const firstM = Number(firstRoll.lengthM);
        const firstKg = Number(firstRoll.netWeightKg);

        if (firstM > 0 && firstKg > 0) {
          const baseGrammage = firstKg / firstM;

          // If the very first roll is modified, recalculate weights of all other rolls
          if (colorIndex === 0 && rollIndex === 0) {
            next.forEach((col, cIdx) => {
              col.rolls.forEach((r, rIdx) => {
                if (cIdx !== 0 || rIdx !== 0) {
                  r.netWeightKg = Number((r.lengthM * baseGrammage).toFixed(2));
                }
              });
            });
          } else {
            // If a subsequent roll's length is changed, calculate its weight based on baseGrammage
            if (field === 'lengthM') {
              next[colorIndex].rolls[rollIndex].netWeightKg = Number((value * baseGrammage).toFixed(2));
            }
          }
        }
      }

      return next;
    });
  };

  // Calculate Grammage dynamically (kg / m)
  const calculateGrammage = (m: number, kg: number) => {
    if (!m || !kg) return 0;
    return Number((kg / m).toFixed(3)); // Divide kg by metre
  };

  // Submit Bulk Fabric Entries (multiple rolls)
  const handleSubmitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fabricName.trim()) {
      alert('Lütfen kumaş kartelası oluşturmak için kumaş adını giriniz.');
      return;
    }
    if (colorsInput.length === 0) {
      alert('Lütfen kumaş kaydı için en az bir adet renk ve rulo (top) ekleyiniz.');
      return;
    }
    if (hasRecipeInput && (!atkiYarnId || !cozguYarnId)) {
      alert('Maliyet hesabı seçeneği açık. Lütfen Atkı ve Çözgü ipliklerini ve ağırlıklarını doldurunuz.');
      return;
    }

    setLoading(true);
    try {
      const notesObj = { pricePerMeter };
      const notesStr = JSON.stringify(notesObj);

      // Collect all rolls to create
      interface NewRollPayload {
        barcodeNumber: string;
        fabricType: string;
        color: string;
        widthCm: number;
        weightGsm: number;
        lengthM: number;
        netWeightKg: number;
        quality: string;
        notes: string;
        warpYarnId?: string;
        weftYarnId?: string;
        warpKg?: number;
        weftKg?: number;
      }
      const rollsToCreate: NewRollPayload[] = [];
      colorsInput.forEach((colorObj) => {
        colorObj.rolls.forEach((rollObj) => {
          const grammage = calculateGrammage(rollObj.lengthM, rollObj.netWeightKg);
          const rollPayload: NewRollPayload = {
            barcodeNumber: generateBarcode(),
            fabricType: fabricName,
            color: colorObj.colorName,
            widthCm: widthCm,
            weightGsm: grammage, // Save the kg/m value here
            lengthM: rollObj.lengthM,
            netWeightKg: rollObj.netWeightKg,
            quality: '1',
            notes: notesStr,
          };

          if (hasRecipeInput) {
            rollPayload.warpYarnId = cozguYarnId;
            rollPayload.weftYarnId = atkiYarnId;
            rollPayload.warpKg = (cozguWeight * rollObj.lengthM) / 1000;
            rollPayload.weftKg = (atkiWeight * rollObj.lengthM) / 1000;
          }

          rollsToCreate.push(rollPayload);
        });
      });

      // Submit all in parallel
      await Promise.all(rollsToCreate.map((payload) => apiClient.post('/rolls', payload)));

      setModalOpen(false);
      // Reset form
      setFabricName('');
      setColorsInput([]);
      setNewColorName('');
      setHasRecipeInput(false);
      fetchRolls();
      alert('Kumaş kartelası ve tüm top stokları başarıyla envantere kaydedilmiştir.');
    } catch (err) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      console.error(err);
      alert(errorObj.response?.data?.message || 'Kumaş giriş hatası. Lütfen iplik stoklarınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Roll
  const handleDeleteRoll = (id: string) => {
    Modal.confirm({
      title: 'Kumaş Topunu Sil',
      content: 'Bu kumaş topunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      okText: 'Evet, Sil',
      okType: 'danger',
      cancelText: 'Vazgeç',
      onOk: async () => {
        setLoading(true);
        try {
          await apiClient.delete(`/rolls/${id}`);
          fetchRolls();
          alert('Kumaş topu başarıyla silindi.');
        } catch (err) {
          const errorObj = err as { response?: { data?: { message?: string } } };
          alert(errorObj.response?.data?.message || 'Top silinemedi.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Open price edit modal
  const handleOpenPriceEdit = (fabric: GroupedFabric, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFabricForPriceEdit(fabric);
    setEditPriceValue(fabric.pricePerMeter);
    setEditPriceModalOpen(true);
  };

  // Submit price per meter update to all rolls in fabric type
  const handleUpdatePrice = async () => {
    if (!selectedFabricForPriceEdit) return;
    setLoading(true);
    try {
      const rollsToUpdate: RollDetail[] = [];
      Object.values(selectedFabricForPriceEdit.colors).forEach((col: { rolls: RollDetail[] }) => {
        col.rolls.forEach((r: RollDetail) => {
          rollsToUpdate.push(r);
        });
      });

      await Promise.all(
        rollsToUpdate.map((roll) => {
          let parsedNotes: Record<string, unknown> = {};
          try {
            if (roll.notes) {
              parsedNotes = JSON.parse(roll.notes);
            }
          } catch {
            parsedNotes = {};
          }
          parsedNotes.pricePerMeter = editPriceValue;

          return apiClient.put(`/rolls/${roll.id}`, {
            notes: JSON.stringify(parsedNotes),
          });
        })
      );

      setEditPriceModalOpen(false);
      fetchRolls();
      alert('Metre satış fiyatı güncellendi.');
    } catch (err) {
      console.error(err);
      alert('Fiyat güncellenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Open single roll add modal under a specific color
  const handleOpenAddRoll = (fabric: GroupedFabric, colorName: string) => {
    setSelectedFabricForRollAdd(fabric);
    setSelectedColorForRollAdd(colorName);
    
    // Calculate base grammage from existing rolls
    const existingRolls: RollDetail[] = [];
    Object.values(fabric.colors).forEach((col: { rolls: RollDetail[] }) => {
      col.rolls.forEach((r: RollDetail) => {
        existingRolls.push(r);
      });
    });

    let baseGrammage = 0.3;
    if (existingRolls.length > 0) {
      const firstRoll = existingRolls[0];
      const m = Number(firstRoll.lengthM);
      const kg = Number(firstRoll.netWeightKg);
      if (m > 0 && kg > 0) {
        baseGrammage = kg / m;
      }
    }

    const defaultLength = 100;
    setSingleLengthM(defaultLength);
    setSingleNetWeightKg(Number((defaultLength * baseGrammage).toFixed(2)));
    setAddRollModalOpen(true);
  };

  const handleSingleLengthChange = (m: number) => {
    setSingleLengthM(m);
    if (!selectedFabricForRollAdd) return;

    // Calculate base grammage
    const existingRolls: RollDetail[] = [];
    Object.values(selectedFabricForRollAdd.colors).forEach((col: { rolls: RollDetail[] }) => {
      col.rolls.forEach((r: RollDetail) => {
        existingRolls.push(r);
      });
    });

    let baseGrammage = 0.3;
    if (existingRolls.length > 0) {
      const firstRoll = existingRolls[0];
      const firstM = Number(firstRoll.lengthM);
      const firstKg = Number(firstRoll.netWeightKg);
      if (firstM > 0 && firstKg > 0) {
        baseGrammage = firstKg / firstM;
      }
    }

    setSingleNetWeightKg(Number((m * baseGrammage).toFixed(2)));
  };

  // Submit single roll creation
  const handleAddSingleRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFabricForRollAdd || !selectedColorForRollAdd) return;
    if (singleHasRecipeInput && (!singleAtkiYarnId || !singleCozguYarnId)) {
      alert('Lütfen maliyet hesabı için Atkı ve Çözgü ipliklerini seçiniz.');
      return;
    }

    setLoading(true);
    try {
      const grammage = calculateGrammage(singleLengthM, singleNetWeightKg);
      const notesObj = { pricePerMeter: selectedFabricForRollAdd.pricePerMeter };
      const notesStr = JSON.stringify(notesObj);

      interface AddRollPayload {
        barcodeNumber: string;
        fabricType: string;
        color: string;
        widthCm: number;
        weightGsm: number;
        lengthM: number;
        netWeightKg: number;
        quality: string;
        notes: string;
        warpYarnId?: string;
        weftYarnId?: string;
        warpKg?: number;
        weftKg?: number;
      }
      const payload: AddRollPayload = {
        barcodeNumber: generateBarcode(),
        fabricType: selectedFabricForRollAdd.fabricType,
        color: selectedColorForRollAdd,
        widthCm: 150,
        weightGsm: grammage,
        lengthM: singleLengthM,
        netWeightKg: singleNetWeightKg,
        quality: '1',
        notes: notesStr,
      };

      if (singleHasRecipeInput) {
        payload.warpYarnId = singleCozguYarnId;
        payload.weftYarnId = singleAtkiYarnId;
        payload.warpKg = (singleCozguWeight * singleLengthM) / 1000;
        payload.weftKg = (singleAtkiWeight * singleLengthM) / 1000;
      }

      await apiClient.post('/rolls', payload);
      setAddRollModalOpen(false);
      setSingleHasRecipeInput(false);
      fetchRolls();
      alert('Kumaş topu başarıyla eklendi.');
    } catch (err) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj.response?.data?.message || 'Top eklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-ust-baslik-md font-bold text-on-surface">Kumaş Envanter Yönetimi</h2>
          <p className="text-govde-metin text-on-surface-variant">Top stoklarını kumaş cinslerine ve renklere göre takip edin.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button 
            onClick={() => {
              setColorsInput([]);
              setFabricName('');
              setModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-secondary/15 hover:bg-secondary/25 border border-outline-variant rounded font-alt-baslik transition-all font-semibold active:scale-95 text-on-surface text-sm w-full sm:w-auto"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Yeni Kumaş Girişi</span>
          </button>
          
          {tenant?.plan !== 'STARTER' && (
            <button 
              onClick={() => {
                setPresetFabricName(null);
                void fetchAccountsForOcr();
                setOcrModalOpen(true);
                setOcrFabricName('');
                setScanLogs([]);
                setDetectedData(null);
                getCameraDevices();
              }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-bilgi-mavisi text-white rounded font-alt-baslik hover:opacity-90 transition-all shadow-sm font-semibold active:scale-95 text-sm w-full sm:w-auto"
            >
              <span className="material-symbols-outlined">photo_camera</span>
              <span>Kamera ile Hızlı Giriş</span>
            </button>
          )}
        </div>
      </div>

      {/* Grouped Fabrics Expanded Card List */}
      <div className="space-y-4">
        {loading && rolls.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant font-medium">Yükleniyor...</div>
        ) : groupedFabrics.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant bg-white border border-outline-variant rounded-xl shadow-sm italic">
            Kayıtlı kumaş topu bulunmamaktadır. Yeni kumaş girişi yaparak başlayın.
          </div>
        ) : (
          groupedFabrics.map((fabric) => {
            const isExpanded = expandedFabric === fabric.fabricType;
            return (
              <div 
                key={fabric.fabricType} 
                className="bg-white rounded-lg border border-outline-variant shadow-sm overflow-hidden transition-all duration-300"
              >
                {/* Header Row */}
                <div 
                  className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-surface-container-low transition-colors select-none ${
                    isExpanded ? 'bg-surface-container-low border-b border-outline-variant' : ''
                  }`}
                  onClick={() => setExpandedFabric(isExpanded ? null : fabric.fabricType)}
                >
                  <div className="flex items-center gap-6">
                    <span className="px-2.5 py-1 bg-bilgi-mavisi/10 text-bilgi-mavisi rounded font-bold text-xs font-etiket-mono border border-bilgi-mavisi/20 shrink-0">
                      {fabric.code}
                    </span>
                    <div>
                      <h4 className="font-bold text-base text-on-surface">{fabric.fabricType}</h4>
                      <p className="text-xs text-on-surface-variant">Kumaş Türü</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-between lg:justify-end w-full lg:w-auto">
                    <div className="text-center min-w-[60px] flex-1 sm:flex-none">
                      <span className="block font-bold text-on-surface text-sm">{fabric.colorCount}</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Renk</span>
                    </div>
                    <div className="text-center min-w-[70px] flex-1 sm:flex-none">
                      <span className="block font-bold text-on-surface text-sm">{fabric.totalRolls} Top</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Top</span>
                    </div>
                    <div className="text-center min-w-[90px] flex-1 sm:flex-none">
                      <span className="block font-bold text-on-surface text-sm text-basari-yesili">{fabric.totalLength.toFixed(1)} m</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Metraj</span>
                    </div>
                    <div className="text-center min-w-[100px] flex-1 sm:flex-none">
                      <span className="block font-bold text-on-surface text-sm text-bilgi-mavisi">₺{fabric.pricePerMeter} / m</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Metre Fiyatı</span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                      <button 
                        onClick={(e) => handleOpenPriceEdit(fabric, e)}
                        className="text-xs font-bold bg-secondary/15 hover:bg-secondary/25 px-2.5 py-1.5 rounded text-on-surface transition-all border border-outline-variant"
                      >
                        Fiyat Düzenle
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPresetFabricName(fabric.fabricType);
                          setOcrFabricName(fabric.fabricType);
                          void fetchAccountsForOcr();
                          setOcrModalOpen(true);
                          setScanLogs([]);
                          setDetectedData(null);
                          getCameraDevices();
                        }}
                        className="text-xs font-bold bg-bilgi-mavisi hover:bg-bilgi-mavisi/90 text-white px-2.5 py-1.5 rounded transition-all shadow-sm active:scale-95 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                        <span>Stok Ekle</span>
                      </button>
                      <button className="text-on-surface-variant hover:text-on-surface p-1">
                        <span className={`material-symbols-outlined transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          keyboard_arrow_down
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Side-by-Side Colors Cards */}
                {isExpanded && (
                  <div className="p-4 bg-arka-plan-gri/20 border-t border-outline-variant/40 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      
                      {/* Kartela ve Renk Tanımları Yönetimi Kartı */}
                      <div className="bg-white rounded-lg border border-outline-variant/60 shadow-sm p-4 flex flex-col justify-between min-h-[250px] shrink-0">
                        <div>
                          <h5 className="font-bold text-sm text-on-surface mb-3 flex items-center gap-1.5 border-b border-outline-variant/40 pb-2">
                            <span className="material-symbols-outlined text-sm text-secondary">photo_library</span>
                            Kumaş Kartelası
                          </h5>
                          <div className="flex justify-center items-center py-1">
                            {fabricCardsMap[fabric.fabricType.toUpperCase().trim()]?.imageUrl ? (
                              <div className="relative group rounded-lg overflow-hidden border border-outline-variant w-full h-44 bg-gray-50 flex items-center justify-center">
                                <img 
                                  src={getImageUrl(fabricCardsMap[fabric.fabricType.toUpperCase().trim()].imageUrl || null)} 
                                  alt={`${fabric.fabricType} Kartelası`} 
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-300"
                                  onClick={() => setLightboxImage(fabricCardsMap[fabric.fabricType.toUpperCase().trim()].imageUrl || null)}
                                />
                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <label className="bg-white/90 hover:bg-white p-1.5 rounded-full shadow-md cursor-pointer transition-all flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[16px] text-on-surface">edit</span>
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                          handleUploadCardImage(fabric.fabricType, e.target.files[0]);
                                        }
                                      }} 
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="border-2 border-dashed border-outline-variant hover:border-bilgi-mavisi/50 rounded-lg w-full h-44 flex flex-col items-center justify-center cursor-pointer transition-all bg-surface-container-low p-4 text-center">
                                <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-1">add_photo_alternate</span>
                                <span className="text-xs font-bold text-on-surface-variant">Kartela Görseli Yükle</span>
                                <span className="text-[10px] text-on-surface-variant/70 mt-1">Maksimum 10MB</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleUploadCardImage(fabric.fabricType, e.target.files[0]);
                                    }
                                  }} 
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="mt-2">
                          <button
                            onClick={() => handleOpenColorMappingModal(fabric.fabricType)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary/15 hover:bg-secondary/25 border border-outline-variant rounded font-semibold text-xs text-on-surface transition-all active:scale-95 w-full"
                          >
                            <span className="material-symbols-outlined text-[16px]">palette</span>
                            <span>Renk Tanımlarını Yönet ({Object.keys(fabricCardsMap[fabric.fabricType.toUpperCase().trim()]?.colorMapping || {}).length})</span>
                          </button>
                        </div>
                      </div>

                      {Object.keys(fabric.colors).map((colorName) => {
                      const colorGroup = fabric.colors[colorName];
                      return (
                        <div 
                          key={colorName} 
                          className="bg-white rounded-lg border border-outline-variant/60 shadow-sm p-4 flex flex-col min-h-[250px]"
                        >
                          <div className="flex justify-between items-center border-b border-outline-variant/40 pb-2 mb-3">
                            <h5 className="font-bold text-sm text-on-surface flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full border border-outline-variant bg-gray-200" title={colorName}></span>
                              {colorName}
                            </h5>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold bg-surface-container text-on-surface-variant px-2 py-0.5 rounded">
                                {colorGroup.rolls.length} Top
                              </span>
                              <span className="text-[11px] font-bold bg-basari-yesili/10 text-basari-yesili px-2 py-0.5 rounded border border-basari-yesili/20">
                                {colorGroup.rolls.reduce((sum, r) => sum + Number(r.lengthM), 0).toFixed(1)} m
                              </span>
                            </div>
                          </div>

                          {/* Rolls List */}
                          <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1">
                            {colorGroup.rolls.map((roll) => (
                              <div 
                                key={roll.id}
                                className="flex justify-between items-center bg-arka-plan-gri/40 p-2.5 rounded border border-outline-variant/35 text-xs group/item hover:border-bilgi-mavisi/50 transition-colors"
                              >
                                <div>
                                  <span className="font-semibold font-etiket-mono text-bilgi-mavisi block">
                                    {roll.barcodeNumber}
                                  </span>
                                  <span className="text-on-surface-variant text-[11px]">
                                    {roll.lengthM.toFixed(1)}m | {roll.netWeightKg.toFixed(1)}kg | {Number(roll.weightGsm).toFixed(3)} kg/m
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {roll.status === 'reserved' && (
                                    <span className="text-[9px] font-bold text-white bg-uyari-kehribar px-1.5 py-0.5 rounded uppercase">Rezerve</span>
                                  )}
                                  {roll.status === 'sold' && (
                                    <span className="text-[9px] font-bold text-white bg-on-surface-variant px-1.5 py-0.5 rounded uppercase">Satıldı</span>
                                  )}
                                  {roll.status === 'available' && (
                                    <span className="text-[9px] font-bold text-white bg-basari-yesili px-1.5 py-0.5 rounded uppercase">Mevcut</span>
                                  )}
                                  
                                  {roll.status === 'available' && (
                                    <button 
                                      onClick={() => handleDeleteRoll(roll.id)}
                                      className="text-hata-kirmizisi hover:bg-red-50 p-1 rounded transition-colors ml-1"
                                      title="Topu Sil"
                                    >
                                      <span className="material-symbols-outlined text-sm font-semibold">delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add Roll Options */}
                          <button 
                            onClick={() => handleOpenAddRoll(fabric, colorName)}
                            className="mt-3 w-full border border-dashed border-outline-variant hover:border-bilgi-mavisi hover:text-bilgi-mavisi py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            Top Ekle
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Yeni Kumaş Girişi */}
      {modalOpen && (
        <div className="fixed inset-0 bg-on-primary-fixed/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-arka-plan-gri border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-alt-baslik text-alt-baslik font-bold">Yeni Kumaş Giriş Kartı</h3>
              <button className="hover:bg-outline-variant/30 p-1 rounded-full transition-colors" onClick={() => setModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitBulk} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Row 1: Barcode & Fabric Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase">Barkod No (Otomatik)</label>
                  <input 
                    className="w-full border-outline-variant bg-gray-50 rounded px-3 py-2 text-sm font-semibold text-on-surface-variant" 
                    disabled 
                    value="Otomatik Oluşturulacak" 
                    type="text" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase">Kumaş Adı / Cinsi</label>
                  <input 
                    required
                    value={fabricName}
                    onChange={(e) => setFabricName(e.target.value)}
                    className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                    placeholder="Örn: Leon" 
                    type="text" 
                  />
                </div>
              </div>

              {/* Row 2: Price Per Meter & Width */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase">Metre Satış Fiyatı (₺)</label>
                  <input 
                    required
                    type="number"
                    min="0"
                    value={pricePerMeter}
                    onChange={(e) => setPricePerMeter(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    placeholder="Örn: 150"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase">En Bilgisi (cm)</label>
                  <input 
                    required
                    type="number"
                    min="10"
                    value={widthCm}
                    onChange={(e) => setWidthCm(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                  />
                </div>
              </div>

              {/* Recipe Toggle Checkbox */}
              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="hasRecipeInputCheckbox"
                  checked={hasRecipeInput}
                  onChange={(e) => setHasRecipeInput(e.target.checked)}
                  className="w-4 h-4 rounded text-bilgi-mavisi border-outline-variant focus:ring-bilgi-mavisi"
                />
                <label htmlFor="hasRecipeInputCheckbox" className="text-xs font-bold text-on-surface cursor-pointer select-none">
                  Maliyet Hesabı Yapılsın mı? (Atkı / Çözgü Reçetesi Gir)
                </label>
              </div>

              {/* Row 3: Weft & Warp Yarns (Recipe) */}
              {hasRecipeInput && (
                <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant space-y-4">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Maliyet Hesabı İçin Reçete</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Weft */}
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-on-surface-variant block">Atkı İpliği (Weft)</label>
                      <select 
                        required
                        value={atkiYarnId}
                        onChange={(e) => setAtkiYarnId(e.target.value)}
                        className="w-full border border-outline-variant rounded px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Atkı İpliği Seçin</option>
                        {yarnStocks.map(y => (
                          <option key={y.id} value={y.id}>
                            {y.yarnType} (Lot: {y.lotNumber}) - ${Number(y.unitPrice).toFixed(2)}/Kg
                          </option>
                        ))}
                      </select>
                      <input 
                        required
                        type="number"
                        value={atkiWeight}
                        onChange={(e) => setAtkiWeight(Number(e.target.value))}
                        className="w-full border border-outline-variant rounded px-3 py-2 text-xs"
                        placeholder="Atkı gr/metre (Örn: 150)"
                      />
                    </div>
                    {/* Warp */}
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-on-surface-variant block">Çözgü İpliği (Warp)</label>
                      <select 
                        required
                        value={cozguYarnId}
                        onChange={(e) => setCozguYarnId(e.target.value)}
                        className="w-full border border-outline-variant rounded px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Çözgü İpliği Seçin</option>
                        {yarnStocks.map(y => (
                          <option key={y.id} value={y.id}>
                            {y.yarnType} (Lot: {y.lotNumber}) - ${Number(y.unitPrice).toFixed(2)}/Kg
                          </option>
                        ))}
                      </select>
                      <input 
                        required
                        type="number"
                        value={cozguWeight}
                        onChange={(e) => setCozguWeight(Number(e.target.value))}
                        className="w-full border border-outline-variant rounded px-3 py-2 text-xs"
                        placeholder="Çözgü gr/metre (Örn: 200)"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4: Colors & Rolls builder */}
              <div className="space-y-4 pt-4 border-t border-outline-variant">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Renkler & Top Stokları</h4>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      placeholder="Renk Adı (Örn: Siyah)"
                      className="border border-outline-variant rounded px-3 py-1 text-xs outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddColorToInput}
                      className="bg-bilgi-mavisi text-white px-4 py-1 rounded text-xs font-semibold hover:bg-blue-600 transition-colors"
                    >
                      Renk Ekle
                    </button>
                  </div>
                </div>

                {colorsInput.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant border border-dashed border-outline-variant rounded bg-gray-50 italic text-xs">
                    Henüz renk eklenmedi. Lütfen yukarıdan renk adı girip "Renk Ekle" butonuna basınız.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {colorsInput.map((colorObj, cIdx) => (
                      <div key={cIdx} className="bg-arka-plan-gri/30 p-4 rounded-lg border border-outline-variant/60">
                        <div className="flex justify-between items-center border-b border-outline-variant/40 pb-2 mb-3">
                          <span className="font-bold text-sm text-on-surface">{colorObj.colorName}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveColorFromInput(cIdx)}
                            className="text-hata-kirmizisi text-xs hover:underline"
                          >
                            Rengi Kaldır
                          </button>
                        </div>

                        {/* Rolls */}
                        <div className="space-y-3">
                          {colorObj.rolls.map((roll, rIdx) => {
                            const calculatedGrammage = calculateGrammage(roll.lengthM, roll.netWeightKg);
                            const isFirstRoll = cIdx === 0 && rIdx === 0;
                            return (
                              <div key={rIdx} className="flex items-center gap-4 flex-wrap">
                                <div className="text-xs font-semibold text-on-surface-variant">Top #{rIdx + 1}</div>
                                <div className="flex items-center gap-1">
                                  <input 
                                    required
                                    type="number"
                                    min="1"
                                    value={roll.lengthM}
                                    onChange={(e) => handleRollValueChange(cIdx, rIdx, 'lengthM', Number(e.target.value))}
                                    className="w-24 px-2 py-1 border border-outline-variant rounded text-right text-xs focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                                    placeholder="Metre"
                                  />
                                  <span className="text-xs text-on-surface-variant">mt</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input 
                                    required
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={roll.netWeightKg}
                                    onChange={(e) => handleRollValueChange(cIdx, rIdx, 'netWeightKg', Number(e.target.value))}
                                    disabled={!isFirstRoll}
                                    className={`w-24 px-2 py-1 border border-outline-variant rounded text-right text-xs focus:ring-1 focus:ring-bilgi-mavisi outline-none ${
                                      isFirstRoll ? 'bg-white' : 'bg-gray-100 cursor-not-allowed text-on-surface-variant'
                                    }`}
                                    placeholder="Ağırlık (kg)"
                                  />
                                  <span className="text-xs text-on-surface-variant">kg</span>
                                </div>
                                <div className="bg-white px-3 py-1 rounded border border-outline-variant text-[11px] font-semibold text-on-surface-variant min-w-[120px]">
                                  Gramaj: {calculatedGrammage.toFixed(3)} kg/m
                                </div>

                                {colorObj.rolls.length > 1 && (
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveRollFromColorInput(cIdx, rIdx)}
                                    className="text-hata-kirmizisi hover:bg-red-50 p-1 rounded transition-colors text-xs font-bold"
                                  >
                                    Sil
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          <button 
                            type="button" 
                            onClick={() => handleAddRollToColorInput(cIdx)}
                            className="text-xs text-bilgi-mavisi font-semibold hover:underline flex items-center gap-1 mt-2"
                          >
                            + Başka Top Ekle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="px-6 py-4 bg-arka-plan-gri border-t border-outline-variant flex justify-end gap-3">
              <button 
                type="button" 
                className="px-4 py-2 text-sm font-medium hover:text-hata-kirmizisi transition-colors" 
                onClick={() => setModalOpen(false)}
              >
                İptal
              </button>
              <button 
                type="button" 
                onClick={handleSubmitBulk}
                disabled={colorsInput.length === 0 || loading}
                className="px-8 py-2 bg-bilgi-mavisi text-white rounded text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Kaydediliyor...' : 'Kumaş Kartını Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fiyat Düzenle */}
      {editPriceModalOpen && selectedFabricForPriceEdit && (
        <div className="fixed inset-0 bg-on-primary-fixed/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="px-6 py-4 bg-arka-plan-gri border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-alt-baslik text-alt-baslik font-bold">Fiyatı Güncelle: {selectedFabricForPriceEdit.fabricType}</h3>
              <button className="hover:bg-outline-variant/30 p-1 rounded-full transition-colors" onClick={() => setEditPriceModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase">Metre Satış Fiyatı (₺)</label>
                <input 
                  type="number"
                  min="0"
                  value={editPriceValue}
                  onChange={(e) => setEditPriceValue(Number(e.target.value))}
                  className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                />
                <p className="text-xs text-on-surface-variant">Bu fiyat güncellemesi bu kumaş türündeki tüm mevcut toplara uygulanacaktır.</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-arka-plan-gri border-t border-outline-variant flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm font-medium hover:text-hata-kirmizisi transition-colors" onClick={() => setEditPriceModalOpen(false)}>İptal</button>
              <button type="button" onClick={handleUpdatePrice} className="px-8 py-2 bg-bilgi-mavisi text-white rounded text-sm font-bold hover:opacity-90">Güncelle</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tekli Top Ekle */}
      {addRollModalOpen && selectedFabricForRollAdd && selectedColorForRollAdd && (
        <div className="fixed inset-0 bg-on-primary-fixed/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="px-6 py-4 bg-arka-plan-gri border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-alt-baslik text-alt-baslik font-bold">
                Yeni Top Ekle: {selectedFabricForRollAdd.fabricType} ({selectedColorForRollAdd})
              </h3>
              <button className="hover:bg-outline-variant/30 p-1 rounded-full transition-colors" onClick={() => setAddRollModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddSingleRoll} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase">Metraji (m)</label>
                  <input 
                    required
                    type="number"
                    min="1"
                    value={singleLengthM}
                    onChange={(e) => handleSingleLengthChange(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase">Ağırlık (kg)</label>
                  <input 
                    required
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={singleNetWeightKg}
                    disabled={true}
                    className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 bg-gray-100 cursor-not-allowed text-on-surface-variant"
                  />
                </div>
              </div>

              <div className="bg-surface-container-low p-3 rounded text-xs font-semibold text-on-surface-variant">
                Gramaj: {calculateGrammage(singleLengthM, singleNetWeightKg).toFixed(3)} kg/m
              </div>

              {/* Recipe Toggle Checkbox */}
              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="singleHasRecipeInputCheckbox"
                  checked={singleHasRecipeInput}
                  onChange={(e) => setSingleHasRecipeInput(e.target.checked)}
                  className="w-4 h-4 rounded text-bilgi-mavisi border-outline-variant focus:ring-bilgi-mavisi"
                />
                <label htmlFor="singleHasRecipeInputCheckbox" className="text-xs font-bold text-on-surface cursor-pointer select-none">
                  Maliyet Hesabı Yapılsın mı? (Atkı / Çözgü Reçetesi Gir)
                </label>
              </div>

              {/* Recipe/Cost Details */}
              {singleHasRecipeInput && (
                <div className="p-4 bg-surface-container-low rounded border border-outline-variant space-y-3">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase block">Reçete / Maliyet Detayı</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold">Atkı İpliği</label>
                      <select 
                        required
                        value={singleAtkiYarnId}
                        onChange={(e) => setSingleAtkiYarnId(e.target.value)}
                        className="w-full border border-outline-variant rounded p-1.5 text-xs bg-white"
                      >
                        <option value="">Atkı İpliği</option>
                        {yarnStocks.map(y => (
                          <option key={y.id} value={y.id}>{y.yarnType} (Lot: {y.lotNumber})</option>
                        ))}
                      </select>
                      <input 
                        required
                        type="number"
                        value={singleAtkiWeight}
                        onChange={(e) => setSingleAtkiWeight(Number(e.target.value))}
                        className="w-full border border-outline-variant rounded p-1 text-xs"
                        placeholder="Atkı gr/m"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold">Çözgü İpliği</label>
                      <select 
                        required
                        value={singleCozguYarnId}
                        onChange={(e) => setSingleCozguYarnId(e.target.value)}
                        className="w-full border border-outline-variant rounded p-1.5 text-xs bg-white"
                      >
                        <option value="">Çözgü İpliği</option>
                        {yarnStocks.map(y => (
                          <option key={y.id} value={y.id}>{y.yarnType} (Lot: {y.lotNumber})</option>
                        ))}
                      </select>
                      <input 
                        required
                        type="number"
                        value={singleCozguWeight}
                        onChange={(e) => setSingleCozguWeight(Number(e.target.value))}
                        className="w-full border border-outline-variant rounded p-1 text-xs"
                        placeholder="Çözgü gr/m"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 bg-arka-plan-gri border-t border-outline-variant flex justify-end gap-3 -mx-6 -mb-6 mt-4">
                <button type="button" className="px-4 py-2 text-sm font-medium hover:text-hata-kirmizisi" onClick={() => setAddRollModalOpen(false)}>İptal</button>
                <button type="submit" className="px-8 py-2 bg-bilgi-mavisi text-white rounded text-sm font-bold">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: OCR Hızlı Stok Girişi */}
      {ocrModalOpen && (
        <div className="fixed inset-0 bg-on-primary-fixed/60 backdrop-blur-sm z-[60] flex items-center justify-center lg:p-4 p-0">
          <div className="bg-white w-full max-w-6xl lg:rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col h-full lg:max-h-[95vh] rounded-none">
            <div className="px-6 py-4 bg-arka-plan-gri border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-bilgi-mavisi">photo_camera</span>
                <h3 className="font-alt-baslik text-alt-baslik font-bold">
                  Kamera OCR ile Hızlı Stok Girişi {presetFabricName ? `- ${presetFabricName}` : ''}
                </h3>
              </div>
              <button 
                className="hover:bg-outline-variant/30 p-1 rounded-full transition-colors" 
                onClick={() => {
                  stopCamera();
                  setPresetFabricName(null);
                  setOcrModalOpen(false);
                  setSelectedCustomerId('');
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-0">
              
              {/* Mobil için Ayarları Göster/Gizle Butonu */}
              <div className="lg:hidden col-span-1 border border-outline-variant/60 bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-secondary">settings</span>
                  Eşleştirme ve Kumaş Giriş Ayarları
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsExpanded(!settingsExpanded)}
                  className="px-3 py-1 bg-secondary text-on-secondary rounded text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
                >
                  {settingsExpanded ? "Gizle" : "Düzenle"}
                </button>
              </div>

              {/* SOL SÜTUN: Kurulum (Kumaş & Renk Eşleştirme) */}
              <div className={`lg:col-span-4 space-y-4 flex flex-col ${settingsExpanded ? 'flex' : 'hidden lg:flex'}`}>
                <div className="bg-arka-plan-gri/20 p-4 rounded-lg border border-outline-variant/60 space-y-4">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-2">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">settings</span>
                    Kumaş Giriş Ayarları
                  </h4>
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase">Eklenecek Kumaş Adı</label>
                    <input 
                      value={ocrFabricName}
                      onChange={(e) => setOcrFabricName(e.target.value)}
                      className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                      placeholder="Örn: EN LYCRA" 
                      type="text" 
                    />
                    <p className="text-[10px] text-on-surface-variant">Okutulan etiket ile karşılaştırmak için kullanılacaktır. Boş bırakılırsa etikette yazan isim otomatik açılır.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase">İlişkili Müşteri (Cari Hesap)</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white font-medium"
                    >
                      <option value="">Seçilmedi (Varsayılan Prompt Kullanılır)</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.code}) {acc.ocrPrompt ? '⚡ Özel Prompt' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-on-surface-variant">Seçilen müşteriye özel etiket okuma promptu tanımlanmışsa Gemini onu kullanacaktır.</p>
                  </div>
                </div>

                <div className="bg-arka-plan-gri/20 p-4 rounded-lg border border-outline-variant/60 flex-1 flex flex-col min-h-[250px]">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2 mb-3">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">palette</span>
                      Renk - Sayı Eşleştirmesi
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddColorMappingRow}
                      className="text-xs font-bold text-bilgi-mavisi hover:underline"
                    >
                      + Renk Ekle
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-1">
                    {Object.keys(colorMappings).sort((a, b) => Number(a) - Number(b)).map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-surface-container px-2.5 py-1.5 rounded border border-outline-variant min-w-[32px] text-center">
                          {key}
                        </span>
                        <input
                          type="text"
                          value={colorMappings[key]}
                          onChange={(e) => handleUpdateColorMappingValue(key, e.target.value)}
                          placeholder={`${key} Numaralı Renk Adı (Örn: Siyah)`}
                          className="flex-1 border border-outline-variant rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white"
                        />
                        {Number(key) > 7 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextMap = { ...colorMappings };
                              delete nextMap[key];
                              setColorMappings(nextMap);
                            }}
                            className="text-hata-kirmizisi hover:bg-red-50 p-1 rounded"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ORTA SÜTUN: Kamera Akışı ve Analiz */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-black rounded-lg overflow-hidden relative aspect-video flex items-center justify-center border border-outline-variant shadow-inner">
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? '' : 'hidden'}`}
                  />
                  
                  {/* Kamera Aktifken ve Analiz Yapılmıyorken Gösterilecek Hizalama Kılavuzu */}
                  {isCameraActive && !ocrLoading && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-[55%] h-[90%] border-2 border-dashed border-basari-yesili/70 rounded-lg relative flex flex-col justify-between p-3 bg-black/15">
                        {/* Köşe Süsleri */}
                        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-basari-yesili"></div>
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-basari-yesili"></div>
                        <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-basari-yesili"></div>
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-basari-yesili"></div>
                        
                        <div className="text-[8px] text-basari-yesili font-bold bg-black/50 px-1.5 py-0.5 rounded self-center tracking-wider text-center">
                          ETİKETİ BU ALANA HİZALAYIN
                        </div>
                        
                        {/* Şablon Kılavuz Katmanları (Yarı Saydam) */}
                        <div className="w-full flex-1 flex flex-col justify-between mt-1.5 opacity-40">
                          <div className="border border-white/30 rounded px-1 py-0.5 text-[7px] text-white/80 w-max bg-black/30">
                            İşletme No
                          </div>
                          
                          <div className="flex justify-between items-center w-full">
                            <div className="border border-white/30 rounded px-1 py-0.5 text-[7px] text-white/80 bg-black/30">
                              Kumaş Adı
                            </div>
                            <div className="border border-basari-yesili/40 border-dashed rounded px-1.5 py-0.5 text-[7px] text-basari-yesili bg-black/30 font-bold flex flex-col items-end">
                              <span>Metre (Mt)</span>
                              <span>Ağırlık (Kg)</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-end w-full">
                            <div className="border border-white/30 rounded px-1 py-0.5 text-[7px] text-white/80 bg-black/30">
                              Barkod Alanı
                            </div>
                            <div className="w-6 h-6 rounded-full border border-basari-yesili/50 border-dashed flex items-center justify-center text-[7px] text-basari-yesili bg-black/30 font-bold">
                              COLOR
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isCameraActive && (
                    <div className="text-center text-white p-6 space-y-3">
                      <span className="material-symbols-outlined text-5xl opacity-40">videocam_off</span>
                      <p className="text-xs text-gray-400">Kamera kapalı</p>
                      {cameraError && <p className="text-xs text-hata-kirmizisi px-4">{cameraError}</p>}
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-4 py-2 bg-bilgi-mavisi text-white rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
                      >
                        Kamerayı Başlat
                      </button>
                    </div>
                  )}

                  {ocrLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-2">
                      <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span className="text-xs font-semibold">Görsel analiz ediliyor...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 items-center justify-between flex-wrap">
                  <div className="flex gap-2 items-center flex-1 min-w-[150px] max-w-[50%]">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">photo_camera_front</span>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        if (isCameraActive) startCamera(e.target.value);
                      }}
                      className="border border-outline-variant rounded p-1 text-xs outline-none bg-white w-full"
                    >
                      {availableDevices.length === 0 ? (
                        <option value="">Kamera bulunamadı</option>
                      ) : (
                        availableDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Kamera ${device.deviceId.substring(0, 5)}...`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="flex gap-2 items-center">
                    <input 
                      type="file" 
                      id="ocr-file-upload" 
                      multiple 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="ocr-file-upload"
                      className="flex items-center gap-1 px-3 py-1.5 bg-secondary/15 hover:bg-secondary/25 border border-outline-variant rounded text-xs font-bold cursor-pointer transition-colors active:scale-95 select-none text-on-surface"
                    >
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      Galeriden Seç
                    </label>

                    {isCameraActive ? (
                      <>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-1.5 bg-arka-plan-gri border border-outline-variant hover:bg-outline-variant/10 rounded text-xs font-semibold"
                        >
                          Durdur
                        </button>
                        <button
                          type="button"
                          onClick={captureAndProcessOCR}
                          disabled={ocrLoading}
                          className="px-5 py-1.5 bg-bilgi-mavisi text-white hover:opacity-90 rounded text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">scan</span>
                          Etiketi Tara
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-4 py-1.5 bg-bilgi-mavisi text-white rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
                      >
                        Kamerayı Aç
                      </button>
                    )}
                  </div>
                </div>

                {/* Seçili Rulonun Düzenleme Formu */}
                {detectedData && (
                  <div className="bg-arka-plan-gri/20 p-4 rounded-lg border border-outline-variant/60 space-y-3 mt-2">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-2">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">edit_note</span>
                      Taranan Veriyi Düzenle
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase">Kumaş Adı</label>
                        <input 
                          type="text"
                          value={detectedData.fabricType}
                          onChange={(e) => handleUpdateActiveOcrField('fabricType', e.target.value)}
                          className="w-full border border-outline-variant bg-white rounded px-2.5 py-1.5 text-xs focus:ring-1 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase">Metre (mt)</label>
                        <input 
                          type="number"
                          value={detectedData.lengthM}
                          onChange={(e) => handleUpdateActiveOcrField('lengthM', Number(e.target.value))}
                          className="w-full border border-outline-variant bg-white rounded px-2.5 py-1.5 text-xs focus:ring-1 text-right outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase">Ağırlık (kg)</label>
                        <input 
                          type="number"
                          value={detectedData.netWeightKg}
                          onChange={(e) => handleUpdateActiveOcrField('netWeightKg', Number(e.target.value))}
                          className="w-full border border-outline-variant bg-white rounded px-2.5 py-1.5 text-xs focus:ring-1 text-right outline-none"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase">Renk Kodu</label>
                        <input 
                          type="text"
                          value={detectedData.colorCode}
                          onChange={(e) => handleUpdateActiveOcrField('colorCode', e.target.value)}
                          className="w-full border border-outline-variant bg-white rounded px-2.5 py-1.5 text-xs focus:ring-1 text-center font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/30">
                      <div className="bg-white px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-semibold text-on-surface-variant flex items-center justify-between">
                        <span>Eşleşen Renk:</span>
                        <span className="font-bold text-bilgi-mavisi">{detectedData.colorName}</span>
                      </div>
                      <div className="bg-white px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-semibold text-on-surface-variant flex items-center justify-between">
                        <span>Hesaplanan Gramaj:</span>
                        <span className="font-bold text-basari-yesili">{calculateGrammage(detectedData.lengthM, detectedData.netWeightKg).toFixed(3)} kg/m</span>
                      </div>
                    </div>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* SAĞ SÜTUN: OCR Sonuç & Onay & İşlem Logları */}
              <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
                <div className="bg-arka-plan-gri/20 p-4 rounded-lg border border-outline-variant/60 flex-1 flex flex-col min-h-[350px]">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-2 mb-3">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">check_circle</span>
                    Okuma Sonuçları & Onay
                  </h4>

                  {detectedItems.length > 0 ? (
                    <div className="flex-1 flex flex-col justify-between min-h-0 space-y-3">
                      
                      {/* Taranan Rulo Listesi */}
                      <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1.5">Taranan Etiketler ({detectedItems.length})</label>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 border border-outline-variant/40 rounded p-2 bg-arka-plan-gri/10 max-h-[380px]">
                          {(() => {
                            const renderOcrItemCard = (item: OcrRecord, idx: number) => {
                              const isActive = activeEditIndex === idx;
                              const isInvalid = item.lengthM <= 0 || item.netWeightKg <= 0 || !item.fabricType;
                              
                              const isDuplicateLength = detectedItems.some((x, i) => 
                                i !== idx && 
                                Number(x.lengthM) === Number(item.lengthM) && 
                                x.fabricType === item.fabricType
                              );
                              
                              return (
                                <div 
                                  key={item.id}
                                  onClick={() => handleSelectActiveEditItem(idx)}
                                  className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-1.5 relative ${
                                    isActive 
                                      ? 'bg-bilgi-mavisi/10 border-bilgi-mavisi/60 text-bilgi-mavisi font-semibold shadow-sm' 
                                      : isInvalid
                                      ? 'bg-hata-kirmizisi/5 border-hata-kirmizisi/35 hover:bg-hata-kirmizisi/10'
                                      : 'bg-white border-outline-variant/30 hover:bg-surface-container-low'
                                  }`}
                                >
                                  {/* Üst Bilgi Satırı */}
                                  <div className="flex justify-between items-start">
                                    <div className="truncate flex-1 pr-2">
                                      <span className="block truncate font-mono text-[9px] text-on-surface-variant/80" title={item.fileName}>
                                        {item.fileName}
                                      </span>
                                      <span className="block font-bold text-xs text-on-surface truncate">
                                        {item.fabricType || 'Kumaş Adı Yok'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      {isInvalid && (
                                        <span className="material-symbols-outlined text-sm text-hata-kirmizisi animate-pulse" title="Hatalı veya eksik bilgi!">
                                          warning
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveItemFromDetectedList(idx);
                                        }}
                                        className="text-hata-kirmizisi hover:bg-red-50 p-0.5 rounded transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-xs">close</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Rozetler (Badge) Satırı */}
                                  <div className="flex flex-wrap gap-1 text-[10px]">
                                    <span className={`px-1.5 py-0.5 rounded-md font-mono ${
                                      item.lengthM <= 0 
                                        ? 'bg-hata-kirmizisi/15 text-hata-kirmizisi font-bold' 
                                        : 'bg-surface-container text-on-surface-variant'
                                    }`}>
                                      {item.lengthM > 0 ? `${item.lengthM} mt` : '0 mt (Eksik)'}
                                    </span>

                                    <span className={`px-1.5 py-0.5 rounded-md font-mono ${
                                      item.netWeightKg <= 0 
                                        ? 'bg-hata-kirmizisi/15 text-hata-kirmizisi font-bold' 
                                        : 'bg-surface-container text-on-surface-variant'
                                    }`}>
                                      {item.netWeightKg > 0 ? `${item.netWeightKg} kg` : '0 kg (Eksik)'}
                                    </span>

                                    {item.colorCode && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-bilgi-mavisi/10 text-bilgi-mavisi font-medium" title={item.colorName}>
                                        R: {item.colorCode}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {isDuplicateLength && (
                                    <div className="text-[9px] text-uyari-kehribar font-bold flex items-center gap-0.5 mt-1 bg-uyari-kehribar/5 p-1 rounded border border-uyari-kehribar/20">
                                      <span className="material-symbols-outlined text-[11px]">warning</span>
                                      Dikkat: Aynı metraja sahip başka bir rulo var!
                                    </div>
                                  )}
                                  
                                  {isInvalid && (
                                    <div className="text-[9px] text-hata-kirmizisi font-bold">
                                      Lütfen sol formdan değerleri düzeltin.
                                    </div>
                                  )}
                                </div>
                              );
                            };

                            const existingStockItems = detectedItems.filter(item => {
                              const targetFabricUpper = (item.fabricType || '').toUpperCase().trim();
                              return !!fabricCardsMap[targetFabricUpper];
                            });

                            const newStockItems = detectedItems.filter(item => {
                              const targetFabricUpper = (item.fabricType || '').toUpperCase().trim();
                              return !fabricCardsMap[targetFabricUpper];
                            });

                            return (
                              <div className="space-y-4">
                                {/* Olan / Mevcut Stok Bölümü */}
                                {existingStockItems.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-basari-yesili uppercase tracking-wider flex items-center gap-1 bg-basari-yesili/5 p-1 rounded border border-basari-yesili/25">
                                      <span className="material-symbols-outlined text-xs">check_circle</span>
                                      Mevcut Stoklar ({existingStockItems.length})
                                    </div>
                                    <div className="space-y-1.5">
                                      {existingStockItems.map((item) => {
                                        const realIdx = detectedItems.findIndex(x => x.id === item.id);
                                        return renderOcrItemCard(item, realIdx);
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Yeni Stok Bölümü */}
                                {newStockItems.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-hata-kirmizisi uppercase tracking-wider flex items-center gap-1 bg-hata-kirmizisi/5 p-1 rounded border border-hata-kirmizisi/25">
                                      <span className="material-symbols-outlined text-xs">new_releases</span>
                                      Yeni Kumaş Türleri ({newStockItems.length})
                                    </div>
                                    <div className="space-y-1.5">
                                      {newStockItems.map((item) => {
                                        const realIdx = detectedItems.findIndex(x => x.id === item.id);
                                        return renderOcrItemCard(item, realIdx);
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAllOcrRolls}
                        disabled={loading}
                        className="w-full py-2 bg-basari-yesili text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">done_all</span>
                        {loading ? 'Kaydediliyor...' : `Tümünü Onayla ve Envantere Ekle (${detectedItems.length})`}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant bg-gray-50 rounded border border-dashed border-outline-variant/60 text-xs italic gap-2">
                      <span className="material-symbols-outlined text-3xl opacity-40">photo_library</span>
                      <p>Galeriden fotoğraf yükleyin veya kamerayla etiket taratın.</p>
                    </div>
                  )}
                </div>

                {/* LOG PANELI */}
                <div className="bg-arka-plan-gri/20 p-4 rounded-lg border border-outline-variant/60 h-[180px] flex flex-col min-h-0">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-2 mb-2">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">list_alt</span>
                    İşlem Günlüğü
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                    {scanLogs.length === 0 ? (
                      <div className="text-on-surface-variant italic text-center pt-8">İşlem kaydı yok</div>
                    ) : (
                      scanLogs.map((log, idx) => (
                        <div key={idx} className={`p-1.5 rounded border ${
                          log.type === 'success' ? 'bg-basari-yesili/5 border-basari-yesili/20 text-basari-yesili' :
                          log.type === 'warning' ? 'bg-uyari-kehribar/5 border-uyari-kehribar/20 text-uyari-kehribar' :
                          'bg-hata-kirmizisi/5 border-hata-kirmizisi/20 text-hata-kirmizisi'
                        }`}>
                          <span className="opacity-55 mr-1">[{log.time}]</span> {log.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal: Dinamik Renk Tanımları Yönetimi */}
      {colorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-surface-container-low border-b border-outline-variant/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">palette</span>
                <h3 className="font-bold text-base text-on-surface">Renk Tanımları - {selectedFabricForColor}</h3>
              </div>
              <button 
                onClick={() => setColorModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container p-1 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-on-surface-variant">
                Etiket üzerinde okunan sayısal renk kodlarına (1-8 veya daha fazla) karşılık gelen renk isimlerini tanımlayın.
              </p>
              
              <div className="space-y-3">
                {Object.keys(localColorMapping)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((key) => (
                    <div key={key} className="flex items-center gap-3 bg-surface-container-low p-2 rounded-lg border border-outline-variant/40">
                      <span className="font-mono font-bold text-xs bg-secondary/15 text-secondary px-2.5 py-1 rounded min-w-[32px] text-center">
                        {key}
                      </span>
                      <input 
                        type="text" 
                        value={localColorMapping[key] || ''}
                        onChange={(e) => handleUpdateLocalColorValue(key, e.target.value)}
                        className="flex-1 border border-outline-variant rounded px-2.5 py-1 text-xs outline-none bg-white focus:ring-1 focus:ring-secondary"
                        placeholder="Örn: Siyah, Koyu Gri, Bej"
                      />
                    </div>
                  ))}
              </div>

              <button
                type="button"
                onClick={handleAddLocalColorRow}
                className="w-full py-2 border-2 border-dashed border-outline-variant hover:border-secondary/50 rounded-lg text-xs font-bold text-on-surface-variant hover:text-secondary flex items-center justify-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Yeni Renk Kodu Ekle ({Object.keys(localColorMapping).length + 1})</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant/60 bg-surface-container-low flex justify-end gap-2 shrink-0">
              <button 
                type="button" 
                onClick={() => setColorModalOpen(false)}
                className="px-4 py-2 border border-outline-variant text-xs font-semibold rounded hover:bg-surface-container transition-colors"
              >
                İptal
              </button>
              <button 
                type="button" 
                onClick={handleSaveColorMapping}
                className="px-6 py-2 bg-secondary text-on-secondary text-xs font-bold rounded hover:opacity-95 shadow-sm active:scale-95 transition-all"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tam Ekran Görsel Görüntüleyici (Lightbox) */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
            <img 
              src={getImageUrl(lightboxImage)} 
              alt="Kartela Detaylı Görünüm" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
            />
            <button 
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white/75 hover:text-white flex items-center gap-1 text-sm bg-black/40 px-3 py-1.5 rounded-full border border-white/10"
            >
              <span className="material-symbols-outlined text-base">close</span>
              <span>Kapat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fabrics;
