import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  taxOffice?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface OrderItem {
  id: string;
  barcode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ApiRoll {
  id: string;
  barcodeNumber: string;
  fabricType: string;
  color: string;
  lengthM: number | string;
  status: string;
  notes?: string;
  lockedBy?: string;
}

interface RollItem {
  id: string;
  barcode: string;
  description: string;
  fabricType: string;
  color: string;
  quantity: number;
  unitPrice: number;
  status: 'AVAILABLE' | 'LOCKED';
  lockedBy?: string;
}

const convertNumberToWords = (num: number): string => {
  const units = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const tens = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
  const hundreds = ['', 'Yüz', 'İki Yüz', 'Üç Yüz', 'Dört Yüz', 'Beş Yüz', 'Altı Yüz', 'Yedi Yüz', 'Sekiz Yüz', 'Dokuz Yüz'];
  
  const processPart = (part: number): string => {
    let text = '';
    const h = Math.floor(part / 100);
    const t = Math.floor((part % 100) / 10);
    const u = part % 10;
    
    if (h > 0) text += hundreds[h] + ' ';
    if (t > 0) text += tens[t] + ' ';
    if (u > 0) {
      text += units[u] + ' ';
    }
    return text.trim();
  };

  if (num === 0) return 'Sıfır Lira';
  
  const lira = Math.floor(num);
  const kurus = Math.round((num - lira) * 100);
  
  let liraText = '';
  
  const billions = Math.floor(lira / 1000000000) % 1000;
  const millions = Math.floor(lira / 1000000) % 1000;
  const thousands = Math.floor(lira / 1000) % 1000;
  const ones = lira % 1000;
  
  if (billions > 0) {
    liraText += processPart(billions) + ' Milyar ';
  }
  if (millions > 0) {
    liraText += processPart(millions) + ' Milyon ';
  }
  if (thousands > 0) {
    if (thousands === 1) {
      liraText += 'Bin ';
    } else {
      liraText += processPart(thousands) + ' Bin ';
    }
  }
  if (ones > 0) {
    liraText += processPart(ones) + ' ';
  }
  
  liraText = liraText.trim() + ' Lira';
  
  let kurusText = '';
  if (kurus > 0) {
    kurusText = processPart(kurus) + ' Kuruş';
  }
  
  return (liraText + (kurusText ? ' ' + kurusText : '')).trim();
};

const Orders: React.FC = () => {
  const { tenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [customers, setCustomers] = useState<Account[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<{
    companyName: string;
    taxOffice: string;
    taxNumber: string;
    phone: string;
    email: string;
    address: string;
    iban: string;
  }>({
    companyName: '',
    taxOffice: '',
    taxNumber: '',
    phone: '',
    email: '',
    address: '',
    iban: '',
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Account | null>(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [rollModalOpen, setRollModalOpen] = useState(false);

  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [availableRolls, setAvailableRolls] = useState<RollItem[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(false);

  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState(20);

  const [expandedFabrics, setExpandedFabrics] = useState<string[]>([]);
  const [expandedColors, setExpandedColors] = useState<string[]>([]);

  // Barkod Okutma & Kamera State'leri
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch functions wrapped with useCallback to avoid hook dependency lint warnings
  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const response = await apiClient.get('/accounts', { params: { limit: 100 } });
      const filtered = response.data.data.filter(
        (acc: Account) => acc.type === 'CUSTOMER' || acc.type === 'BOTH'
      );
      setCustomers(filtered);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const fetchAvailableRolls = useCallback(async () => {
    setLoadingRolls(true);
    try {
      const response = await apiClient.get('/rolls', { params: { status: 'available', limit: 100 } });
      const mapped = response.data.data.map((roll: ApiRoll) => {
        let price = 150.0;
        if (roll.notes) {
          try {
            const parsed = JSON.parse(roll.notes);
            if (parsed && typeof parsed.pricePerMeter === 'number') {
              price = parsed.pricePerMeter;
            }
          } catch (e) {
            console.warn('Notes parse warning', e);
          }
        }
        return {
          id: roll.id,
          barcode: roll.barcodeNumber,
          description: `${roll.fabricType} (${roll.color})`,
          fabricType: roll.fabricType,
          color: roll.color,
          quantity: Number(roll.lengthM),
          unitPrice: price,
          status: roll.status === 'available' ? 'AVAILABLE' : 'LOCKED',
          lockedBy: roll.lockedBy || '',
        };
      });
      setAvailableRolls(mapped);
    } catch (error) {
      console.error('Error fetching rolls:', error);
    } finally {
      setLoadingRolls(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await apiClient.get('/settings');
      if (response.data) {
        if (response.data.taxRate !== undefined) {
          setTaxRate(response.data.taxRate);
        }
        setCompanySettings({
          companyName: response.data.companyName || '',
          taxOffice: response.data.taxOffice || '',
          taxNumber: response.data.taxNumber || '',
          phone: response.data.phone || '',
          email: response.data.email || '',
          address: response.data.address || '',
          iban: response.data.iban || '',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  // Kamera yönetimi
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

  const [formattedDate] = useState(() => new Date().toLocaleDateString('tr-TR'));
  const [formattedDueDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR'));

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
      const formData = new FormData();
      formData.append('file', blob, fileName);

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
        if (orderItems.some((item) => item.id === apiRoll.id)) {
          alert(`Barkod (${detectedBarcode}) zaten siparişe eklenmiş.`);
        } else {
          let price = 150.0;
          if (apiRoll.notes) {
            try {
              const parsed = JSON.parse(apiRoll.notes);
              if (parsed && typeof parsed.pricePerMeter === 'number') {
                price = parsed.pricePerMeter;
              }
            } catch (e) {
              console.warn('Notes parse warning', e);
            }
          }
          setOrderItems((prev) => [
            ...prev,
            {
              id: apiRoll.id,
              barcode: apiRoll.barcodeNumber,
              description: `${apiRoll.fabricType} (${apiRoll.color})`,
              quantity: Number(apiRoll.lengthM),
              unitPrice: price,
              total: Number(apiRoll.lengthM) * price,
            },
          ]);
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

  const loadData = useCallback(() => {
    fetchCustomers();
    fetchAvailableRolls();
    fetchSettings();
  }, [fetchCustomers, fetchAvailableRolls, fetchSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);

    const handleSettingsChange = () => {
      fetchSettings();
    };
    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('settingsChanged', handleSettingsChange);
    };
  }, [loadData, fetchSettings]);

  // Handle URL parameters for quick-creating orders from Cari cards
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    const openStock = searchParams.get('openStock');

    if (customerId) {
      apiClient.get(`/accounts/${customerId}`)
        .then((res) => {
          setSelectedCustomer(res.data);
          if (openStock === 'true') {
            setRollModalOpen(true);
          }
        })
        .catch((err) => console.error('Hızlı sipariş cari bilgisi yüklenemedi:', err));
      
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const toggleFabricExpand = (fabricType: string) => {
    setExpandedFabrics((prev) =>
      prev.includes(fabricType)
        ? prev.filter((t) => t !== fabricType)
        : [...prev, fabricType]
    );
  };

  const toggleColorExpand = (fabricType: string, color: string) => {
    const key = `${fabricType}:${color}`;
    setExpandedColors((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const handleOpenCustomerModal = () => {
    fetchCustomers();
    setCustomerModalOpen(true);
  };

  const handleSelectCustomer = (customer: Account) => {
    setSelectedCustomer(customer);
    setCustomerModalOpen(false);
  };

  const handleToggleRollSelection = (id: string) => {
    setSelectedRollIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };

  const handleAddSelectedRolls = () => {
    const newItems: OrderItem[] = [];
    availableRolls.forEach((roll) => {
      if (selectedRollIds.includes(roll.id) && roll.status === 'AVAILABLE') {
        if (!orderItems.some((item) => item.id === roll.id)) {
          newItems.push({
            id: roll.id,
            barcode: roll.barcode,
            description: roll.description,
            quantity: roll.quantity,
            unitPrice: roll.unitPrice,
            total: roll.quantity * roll.unitPrice,
          });
        }
      }
    });

    if (newItems.length > 0) {
      setOrderItems((prev) => [...prev, ...newItems]);
    }
    setRollModalOpen(false);
    setSelectedRollIds([]);
  };

  const handleRemoveItem = (id: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItemPrice = (id: string, price: number) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, unitPrice: price, total: item.quantity * price }
          : item
      )
    );
  };

  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeSearch.trim()) return;

    try {
      const res = await apiClient.get('/rolls', { params: { search: barcodeSearch.trim() } });
      const apiRoll = res.data.data?.[0];

      if (apiRoll && apiRoll.status === 'available') {
        if (orderItems.some((item) => item.id === apiRoll.id)) {
          alert('Bu kumaş topu zaten siparişe eklenmiş.');
        } else {
          let price = 150.0;
          if (apiRoll.notes) {
            try {
              const parsed = JSON.parse(apiRoll.notes);
              if (parsed && typeof parsed.pricePerMeter === 'number') {
                price = parsed.pricePerMeter;
              }
            } catch (e) {
              console.warn('Notes parse warning', e);
            }
          }
          setOrderItems((prev) => [
            ...prev,
            {
              id: apiRoll.id,
              barcode: apiRoll.barcodeNumber,
              description: `${apiRoll.fabricType} (${apiRoll.color})`,
              quantity: Number(apiRoll.lengthM),
              unitPrice: price,
              total: Number(apiRoll.lengthM) * price,
            },
          ]);
        }
        setBarcodeSearch('');
      } else {
        alert(`Okunan barkod (${barcodeSearch}) bulunamadı veya müsait (stokta) değil.`);
      }
    } catch (err) {
      console.error(err);
      alert('Top sorgulanırken hata oluştu.');
    }
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const kdvAmount = subtotal * (taxRate / 100);
  const total = subtotal + kdvAmount;

  const handleSaveOrder = async (autoInvoice: boolean = false) => {
    if (!selectedCustomer) {
      alert('Lütfen bir müşteri seçiniz.');
      return;
    }
    if (orderItems.length === 0) {
      alert('Lütfen en az bir sipariş satırı (kumaş topu) ekleyiniz.');
      return;
    }

    setSavingOrder(true);
    try {
      const orderPayload = {
        customerId: selectedCustomer.id,
        notes: notes,
        items: orderItems.map((item) => ({
          rollId: item.id,
          unitPrice: item.unitPrice,
        })),
      };

      const response = await apiClient.post('/orders', orderPayload);
      const savedOrder = response.data;

      if (autoInvoice) {
        const invoicePayload = {
          orderId: savedOrder.id,
          customerId: savedOrder.customerId,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          taxRate: taxRate,
          notes: notes || '',
          items: orderItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        };
        const invoiceResponse = await apiClient.post('/invoices', invoicePayload);
        setSuccessMessage(`Sipariş başarıyla kaydedildi (${savedOrder.orderNumber}) ve faturalandırıldı (Fatura No: ${invoiceResponse.data.invoiceNumber})`);
      } else {
        setSuccessMessage(`Sipariş başarıyla kaydedildi: ${savedOrder.orderNumber}`);
      }
      
      setSelectedCustomer(null);
      setOrderItems([]);
      setNotes('');
      fetchAvailableRolls();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'Sipariş kaydedilirken bir hata oluştu.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDownloadPDF = () => {
    const printContent = document.getElementById('e-arsiv-invoice-container');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Lütfen pop-up engelleyicinizi devre dışı bırakın.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura Önizleme - Taslak</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            
            body {
              font-family: 'Inter', sans-serif;
              padding: 40px;
              background-color: #fff;
              color: #1e293b;
              font-size: 12px;
              line-height: 1.5;
            }
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              background: #fff;
            }
            .invoice-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 20px;
              margin-bottom: 24px;
            }
            .seller-info {
              max-width: 60%;
            }
            .seller-name {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0 0 6px 0;
              letter-spacing: -0.02em;
            }
            .seller-details {
              color: #475569;
              margin: 2px 0;
            }
            .invoice-meta {
              text-align: right;
            }
            .invoice-title {
              font-size: 24px;
              font-weight: 900;
              color: #dc2626;
              margin: 0 0 6px 0;
              letter-spacing: 0.05em;
            }
            .meta-item {
              margin: 3px 0;
              color: #475569;
            }
            .meta-bold {
              font-weight: 700;
              color: #0f172a;
            }
            .info-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 30px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 24px;
              margin-bottom: 24px;
            }
            .info-section-title {
              font-size: 10px;
              font-weight: 700;
              color: #94a3b8;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              margin-bottom: 8px;
              display: block;
            }
            .info-card {
              padding: 16px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              min-height: 100px;
            }
            .info-card p {
              margin: 4px 0;
              color: #334155;
            }
            .info-card-name {
              font-weight: 700;
              color: #0f172a;
              font-size: 13px;
              margin-bottom: 6px !important;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 24px;
              margin-bottom: 24px;
            }
            th {
              background-color: #f8fafc;
              color: #0f172a;
              font-weight: 700;
              border-bottom: 2px solid #0f172a;
              padding: 10px 12px;
              font-size: 11px;
              text-transform: uppercase;
              text-align: left;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 11px;
              color: #334155;
              vertical-align: top;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-mono { font-family: monospace; }
            .font-semibold { font-weight: 600; }
            .font-bold { font-weight: 700; }
            .summary-section {
              display: grid;
              grid-template-cols: 7fr 5fr;
              gap: 30px;
              margin-top: 24px;
              padding-top: 24px;
            }
            .summary-left {
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .summary-right {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .word-total-box {
              padding: 10px 12px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              display: inline-block;
            }
            .payment-info-box {
              padding: 12px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              color: #475569;
              font-size: 11px;
            }
            .grand-total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 10px;
              background-color: #f8fafc;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 700;
              font-size: 13px;
              color: #0f172a;
              margin-top: 8px;
            }
            .grand-total-val {
              color: #1d4ed8;
              font-size: 16px;
            }
            .footer-note {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
                background-color: #fff;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
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

  const groupedAvailableRolls: { [fabricType: string]: { [color: string]: RollItem[] } } = {};
  availableRolls.forEach((roll) => {
    if (!groupedAvailableRolls[roll.fabricType]) {
      groupedAvailableRolls[roll.fabricType] = {};
    }
    if (!groupedAvailableRolls[roll.fabricType][roll.color]) {
      groupedAvailableRolls[roll.fabricType][roll.color] = [];
    }
    groupedAvailableRolls[roll.fabricType][roll.color].push(roll);
  });

  const requiredFields = [
    { key: 'companyName', label: 'Firma Unvanı' },
    { key: 'taxOffice', label: 'Vergi Dairesi' },
    { key: 'taxNumber', label: 'Vergi Numarası VKN/TC' },
    { key: 'phone', label: 'Telefon' },
    { key: 'email', label: 'E-posta' },
    { key: 'address', label: 'Adres' }
  ];

  const missingFields = requiredFields.filter(f => !companySettings[f.key as keyof typeof companySettings]);

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

      {/* HEADER SECTION */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-ust-baslik-md font-ust-baslik-md font-bold">Yeni Sipariş Oluştur</h3>
          <p className="text-on-surface-variant text-govde-metin">Müşteri ve ürün seçimlerini yaparak siparişi tamamlayın.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Customer Selection & Notes (Left Side) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Customer Card */}
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
            <label className="text-kucuk-not font-semibold text-on-surface-variant mb-3 block uppercase tracking-wider">Müşteri Bilgileri</label>
            <button
              onClick={handleOpenCustomerModal}
              className="w-full flex items-center justify-between p-4 bg-arka-plan-gri border border-dashed border-outline-variant rounded-lg hover:border-secondary transition-colors group text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-bilgi-mavisi">person_add</span>
                <span className="text-govde-metin font-medium text-on-surface truncate max-w-[200px]">
                  {selectedCustomer ? selectedCustomer.name : 'Müşteri Seçiniz...'}
                </span>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-secondary">chevron_right</span>
            </button>

            {selectedCustomer && (
              <div className="mt-4 pt-4 border-t border-outline-variant space-y-2 text-sm">
                <p className="text-govde-metin flex justify-between">
                  <span className="text-on-surface-variant">Cari Kod:</span>
                  <span className="font-semibold">{selectedCustomer.code}</span>
                </p>
                <p className="text-govde-metin flex justify-between">
                  <span className="text-on-surface-variant">VKN/TC:</span>
                  <span className="font-semibold">{selectedCustomer.taxNumber || '-'}</span>
                </p>
                <p className="text-govde-metin flex justify-between">
                  <span className="text-on-surface-variant">Telefon:</span>
                  <span className="font-semibold">{selectedCustomer.phone || '-'}</span>
                </p>
              </div>
            )}
          </div>

          {/* Order Note */}
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
            <label className="text-kucuk-not font-semibold text-on-surface-variant mb-3 block uppercase tracking-wider">Sipariş Notu</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-3 text-govde-metin focus:ring-1 focus:ring-secondary focus:border-secondary outline-none resize-none"
              placeholder="Özel sevkiyat talimatları..."
              rows={4}
            />
          </div>
        </div>

        {/* Items Grid (Right Side) */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col min-h-[400px] shadow-sm">
            <div className="p-4 border-b border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Sipariş Satırları</h4>
              
              {/* Barkod Hızlı Giriş ve Kamera Alanı */}
              <div className="flex flex-1 w-full md:w-auto max-w-sm gap-2">
                <input
                  type="text"
                  placeholder="Barkod numarası girin..."
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeSubmit();
                    }
                  }}
                  className="flex-1 bg-arka-plan-gri border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-secondary outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeSubmit()}
                  className="px-3 py-1.5 bg-secondary text-on-secondary hover:bg-opacity-90 font-semibold text-xs rounded-lg shadow-sm transition-all"
                >
                  Ekle
                </button>
                {tenant?.plan !== 'STARTER' && (
                  <button
                    type="button"
                    onClick={() => setCameraModalOpen(true)}
                    className="px-2.5 py-1.5 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high rounded-lg shadow-sm transition-all flex items-center justify-center"
                    title="Kamera ile Barkod Okut"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  fetchAvailableRolls();
                  setRollModalOpen(true);
                }}
                className="bg-bilgi-mavisi text-white px-4 py-1.5 rounded-lg text-govde-metin flex items-center gap-2 hover:bg-blue-700 transition-colors font-semibold"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                LİSTEDEN EKLE
              </button>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant border-b border-outline-variant">
                    <th className="px-4 py-3 text-kucuk-not font-bold uppercase">Barkod / Top No</th>
                    <th className="px-4 py-3 text-kucuk-not font-bold uppercase">Ürün / Kalite</th>
                    <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-right">Miktar (mt)</th>
                    <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-right">Birim Fiyat (₺)</th>
                    <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-right">Toplam</th>
                    <th className="px-4 py-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-tablo-verisi">
                  {orderItems.length === 0 ? (
                    <tr>
                      <td className="py-20 text-center text-on-surface-variant italic" colSpan={6}>
                        Henüz bir top eklenmedi. Lütfen ürün seçiniz veya barkod okutunuz.
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-arka-plan-gri/30">
                        <td className="px-4 py-3 font-etiket-mono font-semibold text-bilgi-mavisi">{item.barcode}</td>
                        <td className="px-4 py-3 font-medium">{item.description}</td>
                        <td className="px-4 py-3 text-right font-bold">{item.quantity.toFixed(2)} mt</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItemPrice(item.id, Number(e.target.value))}
                            className="w-24 bg-arka-plan-gri border border-outline-variant rounded p-1 text-right font-semibold"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-on-surface">
                          {item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-hata-kirmizisi hover:opacity-85"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary Card */}
            {orderItems.length > 0 && (
              <div className="p-4 bg-surface-container-low border-t border-outline-variant space-y-2">
                <div className="flex justify-between text-govde-metin">
                  <span className="text-on-surface-variant">Ara Toplam:</span>
                  <span className="font-semibold text-on-surface">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="flex justify-between text-govde-metin">
                  <span className="text-on-surface-variant">KDV (%{taxRate}):</span>
                  <span className="font-semibold text-on-surface">{kdvAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="flex justify-between text-alt-baslik font-bold border-t border-outline-variant pt-2">
                  <span className="text-on-surface">Genel Toplam:</span>
                  <span className="text-secondary">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setPreviewOpen(true)}
              disabled={orderItems.length === 0}
              className="px-6 py-2.5 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Önizleme & Taslak
            </button>
            <button
              onClick={() => handleSaveOrder(false)}
              disabled={savingOrder || orderItems.length === 0}
              className="px-6 py-2.5 bg-secondary text-on-secondary hover:bg-opacity-95 font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {savingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  Siparişi Kaydet
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: CUSTOMER SELECTION */}
      {customerModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Müşteri Cari Seçimi</h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setCustomerModalOpen(false)}
              >
                close
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto divide-y divide-outline-variant flex-1">
              {loadingCustomers ? (
                <div className="text-center py-10 text-on-surface-variant font-medium">Cari hesaplar yükleniyor...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant italic">Müşteri cari hesabı bulunamadı.</div>
              ) : (
                customers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className="p-3 hover:bg-arka-plan-gri/50 cursor-pointer flex justify-between items-center rounded-lg transition-colors"
                  >
                    <div>
                      <p className="font-bold text-on-surface">{cust.name}</p>
                      <p className="text-xs text-on-surface-variant">Cari Kod: {cust.code}</p>
                    </div>
                    <span className="material-symbols-outlined text-outline">arrow_forward</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ROLL SELECTION */}
      {rollModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col h-[90vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Depodaki Boşta Kumaş Topları</h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setRollModalOpen(false)}
              >
                close
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingRolls ? (
                <div className="text-center py-20 text-on-surface-variant font-medium">Stoktaki kumaşlar sorgulanıyor...</div>
              ) : Object.keys(groupedAvailableRolls).length === 0 ? (
                <div className="text-center py-20 text-on-surface-variant italic">Depoda kullanılabilir durumda kumaş topu bulunamadı.</div>
              ) : (
                <div className="space-y-4">
                  {Object.keys(groupedAvailableRolls).map((fabricType) => {
                    const isFabricExpanded = expandedFabrics.includes(fabricType);
                    const colors = groupedAvailableRolls[fabricType];
                    
                    return (
                      <div key={fabricType} className="border border-outline-variant rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleFabricExpand(fabricType)}
                          className="w-full flex items-center justify-between p-3 bg-surface-container text-on-surface font-bold text-sm text-left"
                        >
                          <span>{fabricType}</span>
                          <span className="material-symbols-outlined">
                            {isFabricExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                        
                        {isFabricExpanded && (
                          <div className="p-3 bg-surface-container-lowest divide-y divide-outline-variant/60">
                            {Object.keys(colors).map((color) => {
                              const colorKey = `${fabricType}:${color}`;
                              const isColorExpanded = expandedColors.includes(colorKey);
                              const rolls = colors[color];
                              
                              return (
                                <div key={color} className="py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleColorExpand(fabricType, color)}
                                    className="w-full flex items-center justify-between text-on-surface-variant font-semibold text-xs py-1 text-left"
                                  >
                                    <span>{color} ({rolls.length} Top)</span>
                                    <span className="material-symbols-outlined text-sm">
                                      {isColorExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </button>
                                  
                                  {isColorExpanded && (
                                    <div className="mt-2 pl-3 space-y-2 max-h-48 overflow-y-auto">
                                      {rolls.map((roll) => {
                                        const isSelected = selectedRollIds.includes(roll.id);
                                        return (
                                          <div
                                            key={roll.id}
                                            onClick={() => handleToggleRollSelection(roll.id)}
                                            className={`p-2.5 border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                                              isSelected
                                                ? 'bg-secondary/10 border-secondary'
                                                : 'hover:bg-arka-plan-gri/40 border-outline-variant/60'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}} // handled by parent div click
                                                className="accent-secondary"
                                              />
                                              <div>
                                                <p className="font-mono text-xs font-bold text-bilgi-mavisi">{roll.barcode}</p>
                                                <p className="text-[10px] text-on-surface-variant">Birim Fiyat: {roll.unitPrice.toFixed(2)} ₺</p>
                                              </div>
                                            </div>
                                            <span className="font-bold text-basari-yesili text-xs">{roll.quantity.toFixed(2)} mt</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
              <button
                className="px-5 py-2 rounded-lg text-govde-metin hover:bg-white border border-transparent hover:border-outline-variant transition-colors font-bold"
                onClick={() => setRollModalOpen(false)}
              >
                İptal
              </button>
              <button
                onClick={handleAddSelectedRolls}
                disabled={selectedRollIds.length === 0}
                className="bg-secondary text-on-secondary px-6 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {selectedRollIds.length} Top Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {previewOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col h-[90vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low no-print">
              <h4 className="text-alt-baslik font-alt-baslik font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">visibility</span>
                Taslak Fatura Önizlemesi
              </h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setPreviewOpen(false)}
              >
                close
              </button>
            </div>

            <div className="p-8 overflow-y-auto bg-white flex-1 font-sans">
              {/* Warnings */}
              {missingFields.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6 text-sm no-print space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Eksik Firma Bilgileri Tespit Edildi!
                  </p>
                  <p>Aşağıdaki alanlar ayarlarda boş bırakıldığı için faturada görünmeyebilir: <strong>{missingFields.map(f => f.label).join(', ')}</strong></p>
                  <p className="text-xs text-red-600 font-semibold">Fatura çıktısını yazdırmadan önce Ayarlar sayfasından bu bilgileri doldurmanız önerilir.</p>
                </div>
              )}

              <div id="e-arsiv-invoice-container" className="invoice-container bg-white text-black p-4 text-xs space-y-6">
                {/* Logo & Seller Header */}
                <div className="invoice-header">
                  <div className="seller-info">
                    <h2 className="seller-name">{companySettings.companyName || 'FABRİKA ERP'}</h2>
                    <p className="seller-details">{companySettings.address || '-'}</p>
                    <p className="seller-details">Tel: {companySettings.phone || '-'} | E-posta: {companySettings.email || '-'}</p>
                    <p className="seller-details font-bold">VD: {companySettings.taxOffice || '-'} | VKN: {companySettings.taxNumber || '-'}</p>
                  </div>
                  <div className="invoice-meta">
                    <h1 className="invoice-title text-red-600">TASLAK FATURA</h1>
                    <p className="meta-item font-bold">Fatura No: FAT-2026-XXXXX</p>
                    <p className="meta-item">Tarih: {formattedDate}</p>
                    <p className="meta-item">Vade Tarihi: {formattedDueDate}</p>
                  </div>
                </div>

                {/* Buyer / Customer Info */}
                <div className="info-grid">
                  <div>
                    <span className="info-section-title">ALICI / MÜŞTERİ</span>
                    <div className="info-card">
                      <p className="info-card-name">{selectedCustomer.name}</p>
                      <p>{selectedCustomer.address || '-'}</p>
                      <p className="font-semibold mt-1">VD: {selectedCustomer.taxOffice || '-'} | VKN: {selectedCustomer.taxNumber || '-'}</p>
                      <p>Tel: {selectedCustomer.phone || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <span className="info-section-title">FATURA DETAYLARI</span>
                    <div className="info-card">
                      <p><span className="font-semibold">Düzenleme Tarihi:</span> {formattedDate}</p>
                      <p><span className="font-semibold">Vade Tarihi:</span> {formattedDueDate}</p>
                      <p><span className="font-semibold">Para Birimi:</span> Türk Lirası (TRY)</p>
                      {notes && <p className="mt-1"><span className="font-semibold text-red-600">Fatura Notu:</span> {notes}</p>}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table>
                  <thead>
                    <tr>
                      <th className="text-center w-8">No</th>
                      <th>Mal/Hizmet Açıklaması</th>
                      <th className="text-center">Miktar</th>
                      <th className="text-center">Birim</th>
                      <th className="text-right">Birim Fiyat</th>
                      <th className="text-center w-16">KDV %</th>
                      <th className="text-right w-24">KDV Tutarı</th>
                      <th className="text-right w-28">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, idx) => {
                      const itemKdv = item.total * (taxRate / 100);
                      return (
                        <tr key={item.id}>
                          <td className="text-center font-mono">{idx + 1}</td>
                          <td className="font-semibold">{item.description}</td>
                          <td className="text-center font-bold">{item.quantity.toFixed(2)}</td>
                          <td className="text-center">Metre</td>
                          <td className="text-right font-mono">{item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className="text-center font-mono">%{taxRate}</td>
                          <td className="text-right font-mono">{itemKdv.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className="text-right font-bold font-mono">{(item.total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Calculations & Summary */}
                <div className="summary-section">
                  <div className="summary-left">
                    <div>
                      <span className="font-bold block mb-1">Yazı ile:</span>
                      <span className="word-total-box font-bold">
                        Yalnız #{convertNumberToWords(total)}#
                      </span>
                    </div>
                    {companySettings.iban && (
                      <div className="payment-info-box">
                        <span className="font-bold text-[11px] uppercase tracking-wider block mb-1">Ödeme Bilgileri</span>
                        <p className="font-mono text-xs"><span className="font-bold">IBAN:</span> {companySettings.iban}</p>
                      </div>
                    )}
                  </div>
                  <div className="summary-right">
                    <div className="summary-row">
                      <span>Mal/Hizmet Toplam Tutarı (Matrah):</span>
                      <span className="font-mono font-semibold">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                    <div className="summary-row">
                      <span>Hesaplanan KDV (%{taxRate}):</span>
                      <span className="font-mono font-semibold">{kdvAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                    <div className="grand-total-row">
                      <span>Ödenecek Tutar (Genel Toplam):</span>
                      <span className="font-mono grand-total-val">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                  </div>
                </div>

                <div className="footer-note">
                  Bu belge 213 sayılı V.U.K. uyarınca Gelir İdaresi Başkanlığı e-Arşiv mevzuatına göre oluşturulan taslak fatura önizlemesidir. Mali değeri yoktur.
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3 font-sans">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="bg-bilgi-mavisi text-white px-5 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">download</span>
                PDF İndir / Yazdır
              </button>
              <button
                className="px-5 py-2 rounded-lg text-govde-metin hover:bg-white border border-transparent hover:border-outline-variant transition-colors font-bold"
                onClick={() => setPreviewOpen(false)}
              >
                Kapat
              </button>
              <button
                onClick={() => {
                  setPreviewOpen(false);
                  handleSaveOrder(true);
                }}
                className="bg-basari-yesili text-white px-6 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                Faturayı Kes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KAMERA OKUTMA MODALİ */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
    </div>
  );
};

export default Orders;
