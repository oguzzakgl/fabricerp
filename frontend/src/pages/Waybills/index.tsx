import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface Account {
  id: string;
  name: string;
  code: string;
  taxOffice: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
}

interface Roll {
  id: string;
  barcodeNumber: string;
  fabricType: string;
  color: string;
  lengthM: number;
  status: string;
}

interface FabricCard {
  id: string;
  fabricType: string;
  pricePerMeter: number;
  imageUrl?: string | null;
  colorMapping?: Record<string, string> | null;
}

const Waybills: React.FC = () => {
  const { tenant } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Account | null>(null);
  
  const [availableRolls, setAvailableRolls] = useState<Roll[]>([]);
  const [selectedRolls, setSelectedRolls] = useState<Roll[]>([]);
  
  const [barcodeSearch, setBarcodeSearch] = useState<string>('');
  const [rollSearchText, setRollSearchText] = useState<string>('');
  
  // Stok pop-up seçici state'leri
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [expandedFabrics, setExpandedFabrics] = useState<string[]>([]);
  const [expandedColors, setExpandedColors] = useState<string[]>([]);
  const [priceInputs, setPriceInputs] = useState<{ [key: string]: string }>({});
  const [notes, setNotes] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fabricCardsMap, setFabricCardsMap] = useState<Record<string, FabricCard>>({});

  const getMappedColorName = (fabricType: string, colorVal: string) => {
    if (!colorVal) return 'Bilinmeyen Renk';
    const targetFabricUpper = (fabricType || '').toUpperCase().trim();
    const card = fabricCardsMap[targetFabricUpper];
    if (card && card.colorMapping) {
      if (card.colorMapping[colorVal]) {
        return `Renk ${colorVal} (${card.colorMapping[colorVal]})`;
      }
      const cleanKey = colorVal.replace(/Renk\s*/i, '').trim();
      if (card.colorMapping[cleanKey]) {
        return `Renk ${cleanKey} (${card.colorMapping[cleanKey]})`;
      }
    }
    return colorVal;
  };
  const [companySettings, setCompanySettings] = useState<{
    companyName: string;
    taxOffice: string;
    taxNumber: string;
    phone: string;
    email: string;
    address: string;
  }>({
    companyName: '',
    taxOffice: '',
    taxNumber: '',
    phone: '',
    email: '',
    address: '',
  });

  // Kamera State'leri
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Kamera başlatılamadı:', err);
      setCameraError('Kamera erişim izni verilmedi veya kamera bulunamadı.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (cameraModalOpen) {
        startCamera();
      } else {
        stopCamera();
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [cameraModalOpen]);

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

  const handleCaptureAndOcr = async () => {
    if (!videoRef.current || !isCameraActive) return;

    setCameraLoading(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Fotoğraf yakalanamadı.');
          setCameraLoading(false);
          return;
        }
        await processOcrBlob(blob, 'captured_barcode.jpg');
      }, 'image/jpeg', 0.85);
    } catch (err) {
      console.error(err);
      alert('Fotoğraf çekilirken hata oluştu.');
      setCameraLoading(false);
    }
  };

  const handleFileUploadAndOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraLoading(true);
    try {
      await processOcrBlob(file, file.name);
    } catch (err) {
      console.error(err);
      alert('Dosya okunurken hata oluştu.');
      setCameraLoading(false);
    }
  };

  const processOcrBlob = async (blob: Blob | File, fileName: string) => {
    try {
      const compressed = await compressImage(blob);
      const formData = new FormData();
      formData.append('file', compressed, fileName.endsWith('.webp') ? fileName : `${fileName}.webp`);

      const response = await apiClient.post('/rolls/ocr', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const ocrData = response.data;
      if (ocrData.error) {
        throw new Error(ocrData.error);
      }

      const detectedBarcode = ocrData.barcodeNumber?.trim();
      if (!detectedBarcode) {
        alert('Etiket üzerinde barkod numarası tespit edilemedi. Lütfen tekrar deneyin veya daha net çekin.');
        setCameraLoading(false);
        return;
      }

      const res = await apiClient.get('/rolls', { params: { search: detectedBarcode } });
      const apiRoll = res.data.data?.[0];

      if (apiRoll && apiRoll.status === 'available') {
        if (selectedRolls.some((r) => r.id === apiRoll.id)) {
          alert(`Barkod (${detectedBarcode}) zaten listeye eklenmiş.`);
        } else {
          setSelectedRolls((prev) => [...prev, apiRoll]);
          alert(`Kumaş topu başarıyla eklendi!\nKumaş: ${apiRoll.fabricType} (${apiRoll.color})\nMetraj: ${apiRoll.lengthM} mt`);
          setCameraModalOpen(false);
        }
      } else {
        alert(`Okunan barkod (${detectedBarcode}) sistemde bulunamadı veya müsait (stokta) değil.`);
      }
    } catch (err: unknown) {
      console.error('OCR Hatası:', err);
      const error = err as Error;
      alert(error.message || 'OCR analizi sırasında hata oluştu.');
    } finally {
      setCameraLoading(false);
    }
  };

  const fetchData = React.useCallback(async () => {
    try {
      const [accountsRes, rollsRes, settingsRes, cardsRes] = await Promise.all([
        apiClient.get('/accounts', { params: { limit: 1000 } }),
        apiClient.get('/rolls', { params: { status: 'available', limit: 1000 } }),
        apiClient.get('/settings'),
        apiClient.get('/fabric-cards'),
      ]);

      setAccounts(accountsRes.data.data || []);
      setAvailableRolls(rollsRes.data.data || []);
      
      const cardsMap = (cardsRes.data || []).reduce((acc: Record<string, FabricCard>, card: FabricCard) => {
        acc[card.fabricType.toUpperCase().trim()] = card;
        return acc;
      }, {});
      setFabricCardsMap(cardsMap);

      if (settingsRes.data) {
        setCompanySettings({
          companyName: settingsRes.data.companyName || '',
          taxOffice: settingsRes.data.taxOffice || '',
          taxNumber: settingsRes.data.taxNumber || '',
          phone: settingsRes.data.phone || '',
          email: settingsRes.data.email || '',
          address: settingsRes.data.address || '',
        });
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedCustomerId(val);
    const acc = accounts.find((a) => a.id === val) || null;
    setSelectedCustomer(acc);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;

    const matched = availableRolls.find(
      (r) => r.barcodeNumber.trim() === barcodeSearch.trim()
    );

    if (matched) {
      if (selectedRolls.some((r) => r.id === matched.id)) {
        alert('Bu kumaş topu zaten listeye eklenmiş.');
      } else {
        setSelectedRolls((prev) => [...prev, matched]);
      }
      setBarcodeSearch('');
    } else {
      apiClient
        .get('/rolls', { params: { search: barcodeSearch.trim() } })
        .then((res) => {
          const apiRoll = res.data.data?.[0];
          if (apiRoll && apiRoll.status === 'available') {
            if (selectedRolls.some((r) => r.id === apiRoll.id)) {
              alert('Bu kumaş topu zaten listeye eklenmiş.');
            } else {
              setSelectedRolls((prev) => [...prev, apiRoll]);
            }
          } else {
            alert('Aranan barkodlu müsait kumaş topu bulunamadı.');
          }
          setBarcodeSearch('');
        })
        .catch((err) => {
          console.error(err);
          alert('Top sorgulanırken bir hata oluştu.');
        });
    }
  };

  const handleSelectRoll = (roll: Roll) => {
    if (selectedRolls.some((r) => r.id === roll.id)) {
      alert('Bu kumaş topu zaten listeye eklenmiş.');
      return;
    }
    setSelectedRolls((prev) => [...prev, roll]);
    setRollSearchText('');
  };

  const handleRemoveRoll = (id: string) => {
    setSelectedRolls((prev) => prev.filter((r) => r.id !== id));
  };

  const handlePriceChange = (key: string, val: string) => {
    setPriceInputs((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const getGroupedItems = () => {
    const groups: { [key: string]: Roll[] } = {};
    selectedRolls.forEach((roll) => {
      const mappedColor = getMappedColorName(roll.fabricType, roll.color);
      const key = `${roll.fabricType} (${mappedColor})`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(roll);
    });
    return groups;
  };

  const groupedItems = getGroupedItems();
  const fabricKeys = Object.keys(groupedItems);
  const maxRows = fabricKeys.length > 0
    ? Math.max(...fabricKeys.map((key) => groupedItems[key].length), 0)
    : 0;

  const totalRollCount = selectedRolls.length;
  const totalMeters = selectedRolls.reduce((sum, item) => sum + Number(item.lengthM), 0);

  const handleCreateWaybill = async () => {
    if (!selectedCustomerId) {
      alert('Lütfen sevk edilecek bir Cari Hesap seçiniz.');
      return;
    }
    if (selectedRolls.length === 0) {
      alert('Lütfen en az bir kumaş topu seçiniz.');
      return;
    }

    try {
      const pricesPayload = Object.keys(priceInputs)
        .filter((key) => priceInputs[key] !== '')
        .map((key) => {
          const match = key.match(/^(.+?)\s*\((.+?)\)$/);
          const fabricType = match ? match[1] : key;
          const color = match ? match[2] : '';
          return {
            fabricType,
            color,
            unitPrice: Number(priceInputs[key]),
          };
        });

      const waybillPayload = {
        customerId: selectedCustomerId,
        issueDate: new Date(issueDate).toISOString(),
        notes,
        rollIds: selectedRolls.map((r) => r.id),
        prices: pricesPayload,
      };

      const res = await apiClient.post('/waybills', waybillPayload);
      const waybillNo = res.data.waybillNumber;

      setSuccessMessage(`İrsaliye başarıyla oluşturuldu: ${waybillNo}`);
      setSelectedRolls([]);
      setPriceInputs({});
      setNotes('');
      fetchData();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'İrsaliye oluşturulurken hata oluştu.');
    }
  };

  const handlePrintWaybill = () => {
    const printContent = document.getElementById('e-arsiv-waybill-container');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Lütfen pop-up engelleyicinizi devre dışı bırakın.');
      return;
    }

    let styles = '';
    const styleSheets = document.styleSheets;
    try {
      for (let i = 0; i < styleSheets.length; i++) {
        const rules = styleSheets[i].cssRules || styleSheets[i].rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            styles += rules[j].cssText;
          }
        }
      }
    } catch {
      // ignore style access errors
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>İrsaliye - Çeki Listesi</title>
          <style>
            ${styles}
            @media print {
              body {
                background: white;
                color: black;
                padding: 10px;
              }
              .no-print {
                display: none !important;
              }
            }
            body {
              font-family: sans-serif;
              padding: 20px;
              background-color: #fff;
            }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        </head>
        <body>
          <div>
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredAvailableRolls = availableRolls.filter((roll) => {
    const term = rollSearchText.toLowerCase();
    const mappedColor = getMappedColorName(roll.fabricType, roll.color).toLowerCase();
    return (
      roll.barcodeNumber.toLowerCase().includes(term) ||
      roll.fabricType.toLowerCase().includes(term) ||
      roll.color.toLowerCase().includes(term) ||
      mappedColor.includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-basari-yesili text-white p-4 rounded-xl shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <span className="material-symbols-outlined text-white hover:text-gray-200">close</span>
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-ust-baslik-md font-bold text-on-surface">Yeni İrsaliye (Adisyon)</h3>
          <p className="text-on-surface-variant text-govde-metin">
            Sipariş bağımsız, doğrudan kumaş topları seçerek fiyatsız irsaliye oluşturun.
          </p>
        </div>
      </div>

      {/* CARI & TARIH SEÇIMI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
        <div className="flex flex-col">
          <label className="text-kucuk-not font-semibold text-on-surface-variant mb-2 block uppercase tracking-wider">
            Cari Hesap (Müşteri)
          </label>
          <select
            value={selectedCustomerId}
            onChange={handleCustomerChange}
            className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2.5 text-govde-metin focus:ring-1 focus:ring-secondary outline-none font-medium"
          >
            <option value="">Seçiniz...</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-kucuk-not font-semibold text-on-surface-variant mb-2 block uppercase tracking-wider">
            İrsaliye Tarihi
          </label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2 text-govde-metin focus:ring-1 focus:ring-secondary outline-none font-medium"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-kucuk-not font-semibold text-on-surface-variant mb-2 block uppercase tracking-wider">
            İrsaliye Notu
          </label>
          <input
            type="text"
            placeholder="İrsaliye notu ekleyin..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2 text-govde-metin focus:ring-1 focus:ring-secondary outline-none font-medium"
          />
        </div>
      </div>

      {/* TOP EKLEME VE SEÇIM PANELİ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Barkod Okuyucu ve Arama */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm space-y-4">
          <h4 className="text-alt-baslik font-bold text-on-surface flex items-center gap-2 border-b pb-3 border-outline-variant">
            <span className="material-symbols-outlined text-secondary">qr_code_scanner</span>
            Barkod Okut veya Listeden Seç
          </h4>

          {/* Barkod Okutma Formu */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Barkod okutun veya yazın..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              className="flex-1 bg-arka-plan-gri border border-outline-variant rounded-lg p-2.5 text-govde-metin focus:ring-1 focus:ring-secondary outline-none font-medium"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-secondary text-on-secondary hover:bg-opacity-90 font-semibold rounded-lg shadow-sm transition-all"
            >
              Ekle
            </button>
            {tenant?.plan !== 'STARTER' && (
              <button
                type="button"
                onClick={() => setCameraModalOpen(true)}
                className="px-3.5 py-2 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high rounded-lg shadow-sm transition-all flex items-center justify-center"
                title="Kamera ile Barkod Okut"
              >
                <span className="material-symbols-outlined text-xl">photo_camera</span>
              </button>
            )}
          </form>

          {/* Listeden Arama ve Seçim */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-kucuk-not font-semibold text-on-surface-variant block uppercase tracking-wider">
                Listeden Kumaş Topu Ara
              </label>
              <button
                type="button"
                onClick={() => {
                  setTempSelectedIds([]);
                  setModalSearch('');
                  setStockModalOpen(true);
                }}
                className="text-[11px] font-bold text-secondary hover:underline flex items-center gap-1 bg-none border-none outline-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">inventory_2</span>
                Stoktan Seç (Pop-up)
              </button>
            </div>
            <input
              type="text"
              placeholder="Kumaş türü, renk veya barkod ile ara..."
              value={rollSearchText}
              onChange={(e) => setRollSearchText(e.target.value)}
              className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2 text-govde-metin focus:ring-1 focus:ring-secondary outline-none font-medium"
            />

            {rollSearchText && (
              <div className="max-h-60 overflow-y-auto border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant shadow-lg">
                {filteredAvailableRolls.length === 0 ? (
                  <p className="p-3 text-center text-on-surface-variant">Sonuç bulunamadı.</p>
                ) : (
                  filteredAvailableRolls.map((roll) => (
                    <div
                      key={roll.id}
                      onClick={() => handleSelectRoll(roll)}
                      className="p-3 hover:bg-arka-plan-gri/50 cursor-pointer flex justify-between items-center transition-all"
                    >
                      <div>
                        <p className="font-bold text-on-surface">
                          {roll.fabricType} ({getMappedColorName(roll.fabricType, roll.color)})
                        </p>
                        <p className="text-kucuk-not text-on-surface-variant">
                          Barkod: {roll.barcodeNumber}
                        </p>
                      </div>
                      <span className="font-semibold text-basari-yesili">
                        {Number(roll.lengthM).toFixed(2)} mt
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Seçilen Toplar Listesi */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm space-y-4">
          <h4 className="text-alt-baslik font-bold text-on-surface flex items-center gap-2 border-b pb-3 border-outline-variant">
            <span className="material-symbols-outlined text-secondary">assignment_turned_in</span>
            Seçilen Kumaş Topları ({selectedRolls.length} Top)
          </h4>

          <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant">
            {selectedRolls.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">
                  inventory_2
                </span>
                Henüz kumaş topu seçilmedi.
              </div>
            ) : (
              selectedRolls.map((roll) => (
                <div key={roll.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-on-surface">
                      {roll.fabricType} ({getMappedColorName(roll.fabricType, roll.color)})
                    </p>
                    <p className="text-kucuk-not text-on-surface-variant">
                      Barkod: {roll.barcodeNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-on-surface">
                      {Number(roll.lengthM).toFixed(2)} mt
                    </span>
                    <button
                      onClick={() => handleRemoveRoll(roll.id)}
                      className="text-hata-kirmizisi hover:opacity-85"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DETAYLI ÇEKİ LİSTESİ VE FİYATLANDIRMA PANELİ */}
      {selectedRolls.length > 0 && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
            <h4 className="text-alt-baslik font-bold text-on-surface flex items-center gap-2 border-b pb-3 border-outline-variant">
              <span className="material-symbols-outlined text-secondary">local_shipping</span>
              Sevk Edilecek Kumaş Çeki Listesi (Çeşit ve Metraj)
            </h4>

            {/* SÜTUNLU ÇEKİ LİSTESİ VE FİYAT INPUTLARI */}
            <div className="w-full space-y-4">
              <div className="overflow-x-auto border border-outline-variant rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container text-on-surface-variant border-b border-outline-variant text-[11px] font-bold uppercase tracking-wider">
                      {fabricKeys.map((key) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-center border-r border-outline-variant last:border-r-0"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-tablo-verisi font-tablo-verisi divide-y divide-outline-variant">
                    {Array.from({ length: maxRows }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-arka-plan-gri/20">
                        {fabricKeys.map((key) => {
                          const val = groupedItems[key][rowIndex];
                          return (
                            <td
                              key={key}
                              className="px-4 py-3.5 text-center border-r border-outline-variant last:border-r-0 font-medium"
                            >
                              {val !== undefined ? `${Number(val.lengthM).toFixed(2)} mt` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Fiyat Inputları Satırı (Yazdırmada görünmez) */}
                    <tr className="bg-surface-container-lowest border-t border-outline-variant no-print">
                      {fabricKeys.map((key) => (
                        <td
                          key={key}
                          className="px-4 py-3 text-center border-r border-outline-variant last:border-r-0"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                              Birim Fiyat (₺/mt)
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="İsteğe Bağlı"
                              value={priceInputs[key] || ''}
                              onChange={(e) => handlePriceChange(key, e.target.value)}
                              className="w-28 bg-arka-plan-gri border border-outline-variant rounded p-1 text-center font-semibold text-xs outline-none focus:ring-1 focus:ring-secondary"
                            />
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Toplam Top Adetleri Satırı */}
                    <tr className="bg-surface-container-low font-bold border-t border-outline-variant">
                      {fabricKeys.map((key) => (
                        <td
                          key={key}
                          className="px-4 py-3 text-center border-r border-outline-variant last:border-r-0 text-on-surface-variant"
                        >
                          {groupedItems[key].length} Top
                        </td>
                      ))}
                    </tr>

                    {/* Toplam Metre Satırı */}
                    <tr className="bg-surface-container-low font-bold">
                      {fabricKeys.map((key) => {
                        const sumMeters = groupedItems[key].reduce(
                          (sum, val) => sum + Number(val.lengthM),
                          0
                        );
                        return (
                          <td
                            key={key}
                            className="px-4 py-3 text-center border-r border-outline-variant last:border-r-0 text-basari-yesili"
                          >
                            {sumMeters.toFixed(2)} mt
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Genel Toplam Kartı */}
              <div className="flex flex-col sm:flex-row justify-between items-center bg-surface-container-lowest border border-outline-variant p-4 rounded-xl shadow-sm gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">layers</span>
                  <span className="font-semibold text-on-surface">Genel Toplam Top Sayısı:</span>
                  <span className="font-bold text-bilgi-mavisi">{totalRollCount} Top</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-basari-yesili">straighten</span>
                  <span className="font-semibold text-on-surface">Genel Toplam Metraj:</span>
                  <span className="font-bold text-basari-yesili">
                    {totalMeters.toFixed(2)} mt
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* EYLEM BUTONLARI */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high font-semibold rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Önizleme & Yazdır
            </button>
            <button
              onClick={handleCreateWaybill}
              className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary hover:bg-opacity-90 font-semibold rounded-lg shadow-md transition-all"
            >
              <span className="material-symbols-outlined text-sm">local_shipping</span>
              İrsaliye Oluştur
            </button>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {previewOpen && selectedCustomer && selectedRolls.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center backdrop-blur-xs p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low no-print">
              <h4 className="text-alt-baslik font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">visibility</span>
                İrsaliye Baskı Önizlemesi
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintWaybill}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary hover:bg-opacity-95 font-semibold text-sm rounded-lg transition-all"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Yazdır
                </button>
                <button
                  className="material-symbols-outlined text-outline hover:text-on-surface"
                  onClick={() => setPreviewOpen(false)}
                >
                  close
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-white flex-1">
              <div
                id="e-arsiv-waybill-container"
                className="bg-white text-black p-4 text-sm space-y-6"
              >
                {/* LOGO & COMPANY HEADER */}
                <div className="flex justify-between items-start border-b pb-6 border-gray-300">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold uppercase tracking-tight text-gray-800">
                      {companySettings.companyName || 'FABRİKA ERP'}
                    </h2>
                    <p className="text-xs text-gray-600 max-w-md leading-relaxed">
                      {companySettings.address}
                    </p>
                    <p className="text-xs text-gray-600">
                      Tel: {companySettings.phone} | E-posta: {companySettings.email}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <h1 className="text-2xl font-black tracking-widest text-red-600 uppercase">
                      SEVK İRSALİYESİ (ADİSYON)
                    </h1>
                    <p className="text-sm font-bold text-gray-700">
                      İrsaliye No: IRS-{new Date().getFullYear()}-XXXXX
                    </p>
                    <p className="text-xs text-gray-500">
                      Tarih: {new Date(issueDate).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>

                {/* CARI DETAIL & SHIPPED INFO */}
                <div className="grid grid-cols-2 gap-8 border-b pb-6 border-gray-300">
                  <div className="space-y-2">
                    <span className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                      ALICI / MÜŞTERİ
                    </span>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                      <p className="font-bold text-gray-800">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-600">{selectedCustomer.address}</p>
                      <p className="text-xs text-gray-600 font-semibold mt-1">
                        VD: {selectedCustomer.taxOffice} | VKN: {selectedCustomer.taxNumber}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                      SEVK DETAYLARI
                    </span>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1 text-xs">
                      <p>
                        <span className="font-semibold">Sevk Tarihi:</span>{' '}
                        {new Date(issueDate).toLocaleDateString('tr-TR')}
                      </p>
                      {notes && (
                        <p className="mt-1 leading-normal">
                          <span className="font-semibold text-red-600">Not:</span> {notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SÜTUNLU ÇEKİ LİSTESİ TABLOSU */}
                <div>
                  <span className="text-xs uppercase font-bold text-gray-500 tracking-wider mb-2 block">
                    SEVK EDİLEN MALLAR VE METRAJ DETAYI
                  </span>
                  
                  <div className="w-full space-y-4">
                    <div className="overflow-x-auto border border-gray-300 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700 border-b border-gray-300 text-[11px] font-bold uppercase tracking-wider">
                            {fabricKeys.map((key) => (
                              <th
                                key={key}
                                className="px-4 py-3 text-center border-r border-gray-300 last:border-r-0"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-gray-200">
                          {Array.from({ length: maxRows }).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                              {fabricKeys.map((key) => {
                                const val = groupedItems[key][rowIndex];
                                return (
                                  <td
                                    key={key}
                                    className="px-4 py-3 text-center border-r border-gray-300 last:border-r-0 font-medium"
                                  >
                                    {val !== undefined ? `${Number(val.lengthM).toFixed(2)} mt` : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Toplam Top Adetleri Satırı */}
                          <tr className="bg-gray-50 font-bold border-t border-gray-300">
                            {fabricKeys.map((key) => (
                              <td
                                key={key}
                                className="px-4 py-3 text-center border-r border-gray-300 last:border-r-0 text-gray-600"
                              >
                                {groupedItems[key].length} Top
                              </td>
                            ))}
                          </tr>

                          {/* Toplam Metre Satırı */}
                          <tr className="bg-gray-50 font-bold">
                            {fabricKeys.map((key) => {
                              const sumMeters = groupedItems[key].reduce(
                                (sum, val) => sum + Number(val.lengthM),
                                0
                              );
                              return (
                                <td
                                  key={key}
                                  className="px-4 py-3 text-center border-r border-gray-300 last:border-r-0 text-gray-800"
                                >
                                  {sumMeters.toFixed(2)} mt
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Genel Toplam Kartı */}
                    <div className="flex justify-between items-center border border-gray-300 p-4 rounded-xl gap-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Genel Toplam Top Sayısı:</span>
                        <span className="font-bold">{totalRollCount} Top</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Genel Toplam Metraj:</span>
                        <span className="font-bold">{totalMeters.toFixed(2)} mt</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SIGNATURES SECTION */}
                <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs">
                  <div className="space-y-12">
                    <p className="font-semibold text-gray-600">TESLİM EDEN</p>
                    <div className="border-t border-dashed border-gray-400 w-48 mx-auto pt-2 text-gray-400">
                      İmza
                    </div>
                  </div>
                  <div className="space-y-12">
                    <p className="font-semibold text-gray-600">TESLİM ALAN</p>
                    <div className="border-t border-dashed border-gray-400 w-48 mx-auto pt-2 text-gray-400">
                      İmza
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KAMERA OKUTMA MODALİ */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col">
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">photo_camera</span>
                Kamera ile Barkod Okut
              </h4>
              <button
                onClick={() => setCameraModalOpen(false)}
                className="material-symbols-outlined text-outline hover:text-on-surface"
              >
                close
              </button>
            </div>

            <div className="p-5 flex flex-col items-center gap-4">
              <div className="w-full bg-black rounded-lg overflow-hidden aspect-video relative flex items-center justify-center border border-outline-variant shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCameraActive ? '' : 'hidden'}`}
                />
                
                {isCameraActive && !cameraLoading && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[80%] h-[70%] border-2 border-dashed border-basari-yesili/70 rounded-lg relative flex flex-col justify-center p-3 bg-black/10">
                      <div className="text-[10px] text-basari-yesili font-bold bg-black/60 px-2 py-0.5 rounded self-center tracking-wider">
                        ETİKET BARKODUNU ORTALAYIN
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
                      onClick={startCamera}
                      className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-xs font-semibold hover:opacity-90 transition-all"
                    >
                      Kamerayı Başlat
                    </button>
                  </div>
                )}

                {cameraLoading && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span className="text-xs font-semibold">Barkod analiz ediliyor...</span>
                  </div>
                )}
              </div>

              {/* Kamera Kontrolleri */}
              <div className="flex gap-4 w-full">
                <button
                  type="button"
                  onClick={handleCaptureAndOcr}
                  disabled={!isCameraActive || cameraLoading}
                  className="flex-1 py-2.5 bg-secondary text-on-secondary font-bold rounded-lg shadow-md hover:bg-opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  Fotoğraf Çek ve Oku
                </button>

                <label className="flex-1 py-2.5 bg-surface-container border border-outline-variant text-on-surface font-bold rounded-lg hover:bg-surface-container-high cursor-pointer transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  Fotoğraf Yükle
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUploadAndOcr}
                    className="hidden"
                    disabled={cameraLoading}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STOK SEÇİM POPUP MODALİ */}
      {stockModalOpen && (() => {
        const unselectedAvailableRolls = availableRolls.filter(
          (roll) => !selectedRolls.some((sr) => sr.id === roll.id)
        );
        const filteredModalRolls = unselectedAvailableRolls.filter((roll) => {
          const searchLower = modalSearch.toLowerCase();
          const mappedColor = getMappedColorName(roll.fabricType, roll.color).toLowerCase();
          return (
            roll.barcodeNumber.toLowerCase().includes(searchLower) ||
            roll.fabricType.toLowerCase().includes(searchLower) ||
            roll.color.toLowerCase().includes(searchLower) ||
            mappedColor.includes(searchLower)
          );
        });

        // Kumaş türlerine ve ardından renklere göre gruplama
        const groupedFabrics: { [fabricType: string]: {
          fabricType: string;
          colors: { [colorName: string]: Roll[] };
          totalRolls: number;
        } } = {};

        filteredModalRolls.forEach((roll) => {
          const fType = roll.fabricType || 'Bilinmeyen Kumaş';
          const color = roll.color || 'Bilinmeyen Renk';
          
          if (!groupedFabrics[fType]) {
            groupedFabrics[fType] = {
              fabricType: fType,
              colors: {},
              totalRolls: 0,
            };
          }
          
          if (!groupedFabrics[fType].colors[color]) {
            groupedFabrics[fType].colors[color] = [];
          }
          
          groupedFabrics[fType].colors[color].push(roll);
          groupedFabrics[fType].totalRolls += 1;
        });

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <div>
                  <h4 className="text-xl font-bold flex items-center gap-2 text-on-surface">
                    <span className="material-symbols-outlined text-2xl text-secondary">inventory_2</span>
                    Kumaş Envanterinden Top Seç
                  </h4>
                  <p className="text-sm text-on-surface-variant">Stoktaki kumaş adına, rengine ve toplarına basarak seçim yapabilirsiniz.</p>
                </div>
                <button
                  className="material-symbols-outlined text-outline hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-container text-2xl"
                  onClick={() => setStockModalOpen(false)}
                >
                  close
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="p-5 bg-arka-plan-gri border-b border-outline-variant">
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-white border border-outline-variant rounded-lg text-base focus:ring-1 focus:ring-secondary outline-none shadow-sm"
                    placeholder="Kumaş türü, renk veya barkod no ile arayın..."
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Content Area (Grouped List) */}
              <div className="flex-1 overflow-y-auto p-6 bg-arka-plan-gri space-y-4">
                {Object.keys(groupedFabrics).length === 0 ? (
                  <div className="text-center py-16 text-on-surface-variant bg-white rounded-xl border border-outline-variant shadow-xs">
                    <span className="material-symbols-outlined text-5xl opacity-30 mb-3">layers_clear</span>
                    <p className="text-base">Stokta uygun kumaş topu bulunamadı.</p>
                  </div>
                ) : (
                  Object.values(groupedFabrics).map((fabric) => {
                    const isFabricExpanded = expandedFabrics.includes(fabric.fabricType);
                    return (
                      <div key={fabric.fabricType} className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                        {/* Kumaş İsmi Başlığı */}
                        <div
                          className="p-5 flex justify-between items-center cursor-pointer hover:bg-surface-container-low transition-colors select-none"
                          onClick={() => {
                            setExpandedFabrics(prev =>
                              prev.includes(fabric.fabricType)
                                ? prev.filter(f => f !== fabric.fabricType)
                                : [...prev, fabric.fabricType]
                            );
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span 
                              className="material-symbols-outlined text-outline text-2xl transition-transform duration-200"
                              style={{ transform: isFabricExpanded ? 'rotate(90deg)' : 'none' }}
                            >
                              chevron_right
                            </span>
                            <span className="text-lg font-bold text-on-surface">{fabric.fabricType}</span>
                          </div>
                          <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold">
                            {fabric.totalRolls} Top Müsait
                          </span>
                        </div>

                        {/* Renkler Listesi */}
                        {isFabricExpanded && (
                          <div className="border-t border-outline-variant divide-y divide-outline-variant bg-surface-container-lowest">
                            {Object.keys(fabric.colors).map((colorName) => {
                              const colorKey = `${fabric.fabricType}-${colorName}`;
                              const isColorExpanded = expandedColors.includes(colorKey);
                              const rollsOfColor = fabric.colors[colorName];
                              
                              const allSelected = rollsOfColor.every(r => tempSelectedIds.includes(r.id));
                              const someSelected = rollsOfColor.some(r => tempSelectedIds.includes(r.id));

                              return (
                                <div key={colorName} className="p-4 pl-8">
                                  {/* Renk Başlığı Satırı */}
                                  <div className="flex justify-between items-center py-2">
                                    <div
                                      className="flex items-center gap-2 cursor-pointer select-none"
                                      onClick={() => {
                                        setExpandedColors(prev =>
                                          prev.includes(colorKey)
                                            ? prev.filter(c => c !== colorKey)
                                            : [...prev, colorKey]
                                        );
                                      }}
                                    >
                                      <span 
                                        className="material-symbols-outlined text-outline text-xl transition-transform duration-200"
                                        style={{ transform: isColorExpanded ? 'rotate(90deg)' : 'none' }}
                                      >
                                        chevron_right
                                      </span>
                                      <span className="text-sm font-bold text-on-surface-variant">Renk: {getMappedColorName(fabric.fabricType, colorName)}</span>
                                      <span className="text-xs text-outline font-semibold">({rollsOfColor.length} Top)</span>
                                    </div>

                                    {/* Bu renkteki tümünü seç */}
                                    <div className="flex items-center gap-2">
                                      <label 
                                        className="text-xs font-bold text-on-surface-variant cursor-pointer select-none"
                                        htmlFor={`check-all-${colorKey}`}
                                      >
                                        Tümünü Seç
                                      </label>
                                      <input
                                        id={`check-all-${colorKey}`}
                                        type="checkbox"
                                        className="rounded text-secondary focus:ring-secondary border-outline-variant cursor-pointer w-4 h-4"
                                        checked={allSelected}
                                        ref={(el) => {
                                          if (el) {
                                            el.indeterminate = someSelected && !allSelected;
                                          }
                                        }}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setTempSelectedIds(prev => {
                                              const next = [...prev];
                                              rollsOfColor.forEach(r => {
                                                if (!next.includes(r.id)) next.push(r.id);
                                              });
                                              return next;
                                            });
                                          } else {
                                            setTempSelectedIds(prev =>
                                              prev.filter(id => !rollsOfColor.some(r => r.id === id))
                                            );
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Top Listesi Tablosu (Renk genişletilmişse) */}
                                  {isColorExpanded && (
                                    <div className="mt-3 ml-6 overflow-hidden border border-outline-variant rounded-lg shadow-xs bg-white">
                                      <table className="w-full text-left border-collapse">
                                        <thead>
                                          <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                                            <th className="py-3 px-4 w-12 text-center">Seç</th>
                                            <th className="py-3 px-4">Barkod No</th>
                                            <th className="py-3 px-4 text-right">Metraj (mt)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline-variant">
                                          {rollsOfColor.map((roll) => {
                                            const isChecked = tempSelectedIds.includes(roll.id);
                                            return (
                                              <tr
                                                key={roll.id}
                                                className="hover:bg-arka-plan-gri/20 transition-colors text-sm font-semibold text-on-surface cursor-pointer"
                                                onClick={() => {
                                                  setTempSelectedIds(prev =>
                                                    prev.includes(roll.id)
                                                      ? prev.filter(id => id !== roll.id)
                                                      : [...prev, roll.id]
                                                  );
                                                }}
                                              >
                                                <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                  <input
                                                    type="checkbox"
                                                    className="rounded text-secondary focus:ring-secondary border-outline-variant cursor-pointer w-5 h-5"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                      setTempSelectedIds(prev =>
                                                        e.target.checked
                                                          ? [...prev, roll.id]
                                                          : prev.filter(id => id !== roll.id)
                                                      );
                                                    }}
                                                  />
                                                </td>
                                                <td className="py-3.5 px-4 font-mono text-sm">{roll.barcodeNumber}</td>
                                                <td className="py-3.5 px-4 text-right text-base font-bold text-bilgi-mavisi">{roll.lengthM} mt</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
                <span className="text-sm text-on-surface-variant font-bold">
                  {tempSelectedIds.length} top seçildi
                </span>
                <div className="flex gap-3">
                  <button
                    className="px-5 py-2.5 border border-outline-variant rounded-lg text-xs font-bold bg-white hover:bg-arka-plan-gri transition-colors"
                    onClick={() => setStockModalOpen(false)}
                  >
                    Vazgeç
                  </button>
                  <button
                    className="px-6 py-2.5 bg-secondary text-on-secondary hover:brightness-105 rounded-lg text-xs font-bold shadow-md transition-all"
                    disabled={tempSelectedIds.length === 0}
                    onClick={() => {
                      const rollsToAdd = availableRolls.filter(r => tempSelectedIds.includes(r.id));
                      setSelectedRolls(prev => [...prev, ...rollsToAdd]);
                      setStockModalOpen(false);
                    }}
                  >
                    Seçilenleri İrsaliyeye Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Waybills;
