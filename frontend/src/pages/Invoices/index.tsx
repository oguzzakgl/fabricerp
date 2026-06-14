import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

interface OrderItem {
  id: string;
  barcode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SavedOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  customerTaxNumber: string;
  customerTaxOffice: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  notes?: string;
  status: string;
  date: string;
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

const Invoices: React.FC = () => {
  // Orders available for invoicing (both mock and localStorage)
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<SavedOrder | null>(null);

  // Tevkifat state
  const [tevkifatApplied, setTevkifatApplied] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(20);
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

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get('/orders', { params: { limit: 1000 } });
      const mapped = response.data.data.map((order: any) => {
        const mappedItems = order.orderItems.map((oi: any) => {
          const qty = Number(oi.roll.lengthM);
          const price = Number(oi.unitPrice);
          return {
            id: oi.id,
            barcode: oi.roll.barcodeNumber,
            description: `${oi.roll.fabricType} (${oi.roll.color})`,
            quantity: qty,
            unitPrice: price,
            total: qty * price,
          };
        });

        const subtotal = mappedItems.reduce((sum: number, item: any) => sum + item.total, 0);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customer?.name || 'Bilinmeyen Müşteri',
          customerCode: order.customer?.code || '',
          customerTaxNumber: order.customer?.taxNumber || '',
          customerTaxOffice: order.customer?.taxOffice || '',
          customerPhone: order.customer?.phone || '',
          customerEmail: order.customer?.email || '',
          customerAddress: order.customer?.address || '',
          date: new Date(order.createdAt).toLocaleDateString('tr-TR'),
          subtotal: subtotal,
          total: Number(order.totalAmount),
          notes: order.notes || '',
          status: order.status,
          items: mappedItems,
        };
      });
      setOrders(mapped);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  // Load orders on component mount
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchSettings = async () => {
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
  };

  useEffect(() => {
    fetchSettings();

    const handleSettingsChange = () => {
      fetchSettings();
    };
    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChange);
    };
  }, []);

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOrderId(val);
    const order = orders.find((o) => o.id === val) || null;
    setSelectedOrder(order);
  };

  // Cost calculations
  const matrah = selectedOrder ? selectedOrder.subtotal : 0;
  const kdv = matrah * (taxRate / 100);
  const tevkifat = tevkifatApplied ? kdv * 0.5 : 0; // 5/10 Tevkifat
  const grandTotal = matrah + kdv - tevkifat;

  const requiredFields = [
    { key: 'companyName', label: 'Firma Resmi Unvanı' },
    { key: 'taxOffice', label: 'Vergi Dairesi' },
    { key: 'taxNumber', label: 'Vergi Numarası / VKN' },
    { key: 'phone', label: 'Telefon Numarası' },
    { key: 'email', label: 'E-posta Adresi' },
    { key: 'address', label: 'Firma Adresi' },
    { key: 'iban', label: 'Banka IBAN Numarası' },
  ];

  const missingFields = requiredFields.filter(f => !companySettings[f.key as keyof typeof companySettings]);

  const handleDownloadPDF = () => {
    const printContent = document.getElementById('e-arsiv-invoice-container');
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
    } catch (e) {}

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura-${selectedOrder ? selectedOrder.orderNumber : 'Taslak'}</title>
          <style>
            \${styles}
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
            \${printContent.innerHTML}
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

  const handleCreateInvoice = async () => {
    if (!selectedOrder) {
      alert('Lütfen faturalandırılacak bir sipariş seçiniz.');
      return;
    }

    try {
      const invoicePayload = {
        orderId: selectedOrder.id,
        customerId: selectedOrder.customerId,
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        taxRate: taxRate,
        notes: selectedOrder.notes || '',
        items: selectedOrder.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await apiClient.post('/invoices', invoicePayload);
      const invoiceId = res.data.invoiceNumber;

      setSuccessMessage(`Fatura başarıyla kesildi ve e-Arşiv sistemine gönderildi: ${invoiceId}`);
      setSelectedOrderId('');
      setSelectedOrder(null);
      fetchOrders();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Fatura oluşturulurken hata oluştu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* SUCCESS MESSAGE */}
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
          <h3 className="text-ust-baslik-md font-ust-baslik-md font-bold">Yeni Satış Faturası</h3>
          <p className="text-on-surface-variant text-govde-metin">Onaylanmış siparişlerden hızlıca fatura oluşturun.</p>
        </div>
      </div>

      {/* ORDER SELECTION */}
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant flex flex-col md:flex-row md:items-center gap-6 shadow-sm">
        <div className="flex-1 max-w-md">
          <label className="text-kucuk-not font-semibold text-on-surface-variant mb-2 block uppercase tracking-wider">
            Sipariş Seçimi
          </label>
          <select
            value={selectedOrderId}
            onChange={handleOrderChange}
            className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2.5 text-govde-metin focus:ring-1 focus:ring-secondary outline-none"
          >
            <option value="">Seçiniz...</option>
            {orders
              .filter((o) => o.status !== 'invoiced')
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} - {o.customerName} ({o.items.length} Kalem - {o.total.toLocaleString('tr-TR')} ₺)
                </option>
              ))}
          </select>
        </div>
        <div className="flex gap-4">
          <div className="bg-arka-plan-gri px-5 py-2.5 rounded-lg border border-outline-variant">
            <span className="text-kucuk-not text-on-surface-variant block uppercase font-semibold">Fatura Tarihi</span>
            <span className="font-semibold text-on-surface">{new Date().toLocaleDateString('tr-TR')}</span>
          </div>
          <div className="bg-arka-plan-gri px-5 py-2.5 rounded-lg border border-outline-variant">
            <span className="text-kucuk-not text-on-surface-variant block uppercase font-semibold">Vade Tarihi</span>
            <span className="font-semibold text-on-surface">
              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}
            </span>
          </div>
        </div>
      </div>

      {/* INVOICE LINES TABLE */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container text-on-surface-variant border-b border-outline-variant">
              <th className="px-4 py-3 text-kucuk-not font-bold uppercase">Hizmet/Ürün</th>
              <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-center">Miktar (mt)</th>
              <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-right">Birim Fiyat</th>
              <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-center">KDV %</th>
              <th className="px-4 py-3 text-kucuk-not font-bold uppercase text-right">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-tablo-verisi">
            {!selectedOrder ? (
              <tr>
                <td className="py-12 text-center text-on-surface-variant italic" colSpan={5}>
                  Lütfen kaynak sipariş seçiniz.
                </td>
              </tr>
            ) : (
              selectedOrder.items.map((item) => (
                <tr key={item.id} className="bg-arka-plan-gri/20">
                  <td className="px-4 py-4">
                    <div className="font-bold text-on-surface">{item.description}</div>
                    <div className="text-kucuk-not text-outline">Sipariş Kaynağı: {selectedOrder.id}</div>
                  </td>
                  <td className="px-4 py-4 text-center font-bold">{item.quantity.toFixed(2)} mt</td>
                  <td className="px-4 py-4 text-right">{item.unitPrice.toLocaleString('tr-TR')} ₺</td>
                  <td className="px-4 py-4 text-center">{taxRate}</td>
                  <td className="px-4 py-4 text-right font-bold">{item.total.toLocaleString('tr-TR')} ₺</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* BOTTOM METRICS */}
        <div className="grid grid-cols-12 p-5 gap-6 border-t border-outline-variant bg-surface-container-low">
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white p-4 rounded-lg border border-outline-variant/60 shadow-sm">
              <h5 className="font-bold text-kucuk-not uppercase text-on-surface-variant mb-2">Tevkifat / İstisna Bilgisi</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="tevkifat"
                    type="checkbox"
                    checked={tevkifatApplied}
                    onChange={(e) => setTevkifatApplied(e.target.checked)}
                    className="rounded text-secondary focus:ring-secondary"
                  />
                  <label htmlFor="tevkifat" className="text-govde-metin font-semibold text-on-surface">
                    Tevkifat Uygula (5/10)
                  </label>
                </div>
                <p className="text-kucuk-not text-on-surface-variant">
                  Tekstil sektörüne özel tevkifat oranları mevzuata uygun olarak otomatik hesaplanır.
                </p>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between text-on-surface">
              <span className="text-on-surface-variant">Matrah (KDV Matrahı):</span>
              <span className="font-semibold">{matrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div className="flex justify-between text-on-surface">
              <span className="text-on-surface-variant">KDV (%{taxRate}):</span>
              <span className="font-semibold">{kdv.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div className="flex justify-between text-hata-kirmizisi">
              <span>Tevkifat (Hesaplanan KDV'den İndirilen):</span>
              <span className="font-bold">-{tevkifat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div className="flex justify-between text-alt-baslik font-bold border-t border-outline-variant pt-3 text-on-surface">
              <span>Genel Toplam:</span>
              <span className="text-bilgi-mavisi">{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                disabled={!selectedOrder}
                className="flex-1 bg-white hover:bg-surface-container-low text-on-surface border border-outline-variant py-3 rounded-lg font-bold shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                Faturayı Önizle
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!selectedOrder}
                className="flex-[2] bg-basari-yesili text-white py-3 rounded-lg font-bold hover:brightness-95 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all uppercase"
              >
                FATURAYI KES VE E-ARŞİV GÖNDER
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INVOICE PREVIEW MODAL */}
      {previewOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col my-8">
            {/* Header */}
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">visibility</span>
                e-Arşiv Fatura Taslak Önizleme
              </h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setPreviewOpen(false)}
              >
                close
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
              {/* Missing Fields Banner */}
              {missingFields.length > 0 && (
                <div className="bg-uyari-kehribar/10 border border-uyari-kehribar text-on-surface p-4 rounded-xl flex gap-3">
                  <span className="material-symbols-outlined shrink-0 text-2xl text-uyari-kehribar">warning</span>
                  <div>
                    <h6 className="font-bold text-sm text-on-surface">Fatura Kurulum Bilgileri Eksik!</h6>
                    <p className="text-xs mt-1 text-on-surface-variant">
                      Faturanın mevzuata uygun şekilde kesilebilmesi için aşağıdaki bilgilerin sağ üstteki Ayarlar (⚙️) menüsünden doldurulması gerekmektedir:
                    </p>
                    <ul className="list-disc list-inside text-xs mt-2 font-semibold grid grid-cols-2 gap-x-4 text-on-surface-variant">
                      {missingFields.map(f => (
                        <li key={f.key}>{f.label}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Realistic e-Arşiv Invoice Wrapper */}
              <div id="e-arsiv-invoice-container" className="border border-outline-variant rounded-lg p-8 bg-white text-black font-sans relative overflow-hidden shadow-inner">
                {/* Draft Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                  <span className="text-[120px] font-bold tracking-widest rotate-[-30deg]">GEÇERSİZDİR</span>
                </div>

                {/* Top Section */}
                <div className="grid grid-cols-12 gap-6 border-b border-black pb-6">
                  {/* Left Side: Seller Info */}
                  <div className="col-span-7 space-y-2">
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                      {companySettings.companyName || 'LÜTFEN AYARLARDAN FİRMA UNVANINI GİRİNİZ'}
                    </h2>
                    <div className="text-xs space-y-1 text-slate-700">
                      <p className="whitespace-pre-line">{companySettings.address || 'Lütfen ayarlardan firma adresini giriniz'}</p>
                      <p><span className="font-semibold">Tel:</span> {companySettings.phone || '-'}</p>
                      <p><span className="font-semibold">E-posta:</span> {companySettings.email || '-'}</p>
                      <p>
                        <span className="font-semibold">V.D. / VKN:</span>{' '}
                        {companySettings.taxOffice || '-'} / {companySettings.taxNumber || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: e-Arşiv Info */}
                  <div className="col-span-5 border border-black p-4 rounded bg-slate-50 space-y-2 flex flex-col justify-between">
                    <div className="text-center font-bold text-sm border-b border-black pb-2 text-slate-800 tracking-wider">
                      e-ARŞİV FATURA
                    </div>
                    <div className="text-[11px] space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span className="font-semibold">Fatura No:</span>
                        <span>DRAFT-{new Date().getFullYear()}000000001</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Tarih:</span>
                        <span>{new Date().toLocaleDateString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Saat:</span>
                        <span>{new Date().toLocaleTimeString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Para Birimi:</span>
                        <span>Türk Lirası (TRY)</span>
                      </div>
                      <div className="flex flex-col mt-2 pt-2 border-t border-black/10 text-[9px] font-mono break-all text-slate-500">
                        <span className="font-semibold">ETTN:</span>
                        <span>85fa90ea-4bc2-4c28-9447-758e4722aede</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buyer (Alıcı) Section */}
                <div className="grid grid-cols-12 gap-6 py-6 border-b border-black text-xs">
                  <div className="col-span-12">
                    <div className="font-bold border-b border-black/15 pb-1 mb-2 text-slate-800 uppercase tracking-wider">ALICI BİLGİLERİ</div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1 text-slate-700">
                        <p><span className="font-semibold text-slate-950">Sayın:</span> {selectedOrder.customerName}</p>
                        <p><span className="font-semibold text-slate-950">Adres:</span> {selectedOrder.customerAddress || 'Belirtilmedi'}</p>
                      </div>
                      <div className="space-y-1 text-slate-700">
                        <p>
                          <span className="font-semibold text-slate-950">V.D. / VKN:</span>{' '}
                          {selectedOrder.customerTaxOffice || 'Belirtilmedi'} / {selectedOrder.customerTaxNumber || 'Belirtilmedi'}
                        </p>
                        <p><span className="font-semibold text-slate-950">Tel:</span> {selectedOrder.customerPhone || 'Belirtilmedi'}</p>
                        <p><span className="font-semibold text-slate-950">E-posta:</span> {selectedOrder.customerEmail || 'Belirtilmedi'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border-collapse mt-6">
                  <thead>
                    <tr className="border-b border-black font-semibold text-slate-900 bg-slate-50">
                      <th className="py-2 px-1 text-center w-8">No</th>
                      <th className="py-2 px-2">Mal/Hizmet Açıklaması</th>
                      <th className="py-2 px-2 text-center">Miktar</th>
                      <th className="py-2 px-2 text-center">Birim</th>
                      <th className="py-2 px-2 text-right">Birim Fiyat</th>
                      <th className="py-2 px-2 text-center w-16">KDV %</th>
                      <th className="py-2 px-2 text-right w-24">KDV Tutarı</th>
                      <th className="py-2 px-2 text-right w-28">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10 text-slate-800">
                    {selectedOrder.items.map((item, idx) => {
                      const itemKdv = item.total * (taxRate / 100);
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="py-3 px-1 text-center font-mono">{idx + 1}</td>
                          <td className="py-3 px-2 font-medium">{item.description}</td>
                          <td className="py-3 px-2 text-center font-semibold">{item.quantity.toFixed(2)}</td>
                          <td className="py-3 px-2 text-center">Metre</td>
                          <td className="py-3 px-2 text-right font-mono">{item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className="py-3 px-2 text-center font-mono">%{taxRate}</td>
                          <td className="py-3 px-2 text-right font-mono">{itemKdv.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className="py-3 px-2 text-right font-semibold font-mono">{(item.total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Calculations & Summary */}
                <div className="grid grid-cols-12 gap-6 mt-6 pt-6 border-t border-black text-xs">
                  <div className="col-span-7 space-y-4">
                    <div>
                      <span className="font-semibold block mb-1">Yazı ile:</span>
                      <span className="font-bold text-slate-900 border-b border-black/10 pb-1 inline-block bg-slate-50 px-2 py-1 rounded">
                        Yalnız #{convertNumberToWords(grandTotal)}#
                      </span>
                    </div>
                    {companySettings.iban && (
                      <div className="bg-slate-50 border border-black/10 p-3 rounded space-y-1">
                        <span className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider block">Ödeme Bilgileri</span>
                        <p className="font-mono text-xs text-slate-700"><span className="font-semibold text-slate-900">IBAN:</span> {companySettings.iban}</p>
                      </div>
                    )}
                  </div>
                  <div className="col-span-5 space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span>Mal/Hizmet Toplam Tutarı (Matrah):</span>
                      <span className="font-mono font-semibold text-slate-900">{matrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hesaplanan KDV (%{taxRate}):</span>
                      <span className="font-mono font-semibold text-slate-900">{kdv.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                    {tevkifatApplied && (
                      <div className="flex justify-between text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">
                        <span>KDV Tevkifatı (5/10):</span>
                        <span className="font-mono">-{tevkifat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t border-black pt-2 text-slate-950 bg-slate-50 px-2 py-1 rounded">
                      <span>Ödenecek Tutar (Genel Toplam):</span>
                      <span className="font-mono text-blue-700 text-base">{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="mt-8 pt-4 border-t border-black/10 text-[10px] text-slate-500 text-center">
                  Bu belge 213 sayılı V.U.K. uyarınca Gelir İdaresi Başkanlığı e-Arşiv mevzuatına göre oluşturulan taslak fatura önizlemesidir. Mali değeri yoktur.
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
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
                  handleCreateInvoice();
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
    </div>
  );
};

export default Invoices;
