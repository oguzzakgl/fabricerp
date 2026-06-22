import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';

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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Customers (fetched from backend)
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

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [rollModalOpen, setRollModalOpen] = useState(false);

  // Order Details
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Available Rolls for Selection (dynamic)
  const [availableRolls, setAvailableRolls] = useState<RollItem[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(false);

  // Selected Rolls in the Modal Checkbox
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState(20);

  // Expanded levels in selection modal
  const [expandedFabrics, setExpandedFabrics] = useState<string[]>([]);
  const [expandedColors, setExpandedColors] = useState<string[]>([]);

  // Load Customers
  const fetchCustomers = async () => {
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
  };

  // Load Available Rolls
  const fetchAvailableRolls = async () => {
    setLoadingRolls(true);
    try {
      const response = await apiClient.get('/rolls', { params: { status: 'available', limit: 100 } });
      const mapped = response.data.data.map((roll: any) => {
        let price = 150.0;
        if (roll.notes) {
          try {
            const parsed = JSON.parse(roll.notes);
            if (parsed && typeof parsed.pricePerMeter === 'number') {
              price = parsed.pricePerMeter;
            }
          } catch {}
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
  };

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
    fetchCustomers();
    fetchAvailableRolls();
    fetchSettings();

    const handleSettingsChange = () => {
      fetchSettings();
    };
    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChange);
    };
  }, []);

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
      
      // Clear URL params so they don't trigger again on reload
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
    setSelectedRollIds([]); // reset selection
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

  // Subtotal, KDV and Grandtotal Calculations
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
      
      // Clear Form
      setSelectedCustomer(null);
      setOrderItems([]);
      setNotes('');
      
      // Refresh stocks since selected rolls are now reserved/sold
      fetchAvailableRolls();

      // Hide message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Sipariş kaydedilirken bir hata oluştu.');
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
          <title>Fatura-\${selectedCustomer ? selectedCustomer.name : 'Taslak'}</title>
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

  // Group rolls by fabricType and color
  const groupedRolls: {
    [fabricType: string]: {
      [color: string]: RollItem[];
    };
  } = {};

  availableRolls.forEach((roll) => {
    const fType = roll.fabricType || 'Bilinmeyen';
    const col = roll.color || 'Bilinmeyen';
    if (!groupedRolls[fType]) {
      groupedRolls[fType] = {};
    }
    if (!groupedRolls[fType][col]) {
      groupedRolls[fType][col] = [];
    }
    groupedRolls[fType][col].push(roll);
  });

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

  return (
    <div className="space-y-6">
      {/* SUCCESS BANNER */}
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
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Sipariş Satırları</h4>
              <button
                onClick={() => {
                  fetchAvailableRolls();
                  setRollModalOpen(true);
                }}
                className="bg-bilgi-mavisi text-white px-4 py-1.5 rounded-lg text-govde-metin flex items-center gap-2 hover:bg-blue-700 transition-colors font-semibold"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                TOP EKLE
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
                        Henüz bir top eklenmedi. Lütfen ürün seçiniz.
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
                            value={item.unitPrice}
                            min="0"
                            step="0.01"
                            onChange={(e) => handleUpdateItemPrice(item.id, Number(e.target.value))}
                            className="w-24 px-2 py-1 border border-outline-variant rounded text-right focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{item.total.toLocaleString('tr-TR')} ₺</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-hata-kirmizisi hover:bg-red-50 p-1.5 rounded transition-colors"
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

            <div className="p-6 bg-surface-container-low border-t border-outline-variant space-y-6">
              <div className="flex flex-col items-end gap-2">
                <div className="flex justify-between w-64 text-govde-metin">
                  <span className="text-on-surface-variant">Ara Toplam:</span>
                  <span className="font-semibold">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="flex justify-between w-64 text-govde-metin">
                  <span className="text-on-surface-variant">KDV (%{taxRate}):</span>
                  <span className="font-semibold">{kdvAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="flex justify-between w-64 text-alt-baslik font-bold border-t border-outline-variant pt-2">
                  <span>Genel Toplam:</span>
                  <span className="text-bilgi-mavisi">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-outline-variant/60 w-full">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!selectedCustomer || orderItems.length === 0}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-outline-variant bg-white text-on-surface font-semibold hover:bg-surface-container-low active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all uppercase flex items-center justify-center gap-2 text-xs"
                >
                  <span className="material-symbols-outlined text-base">visibility</span>
                  Faturayı Önizle
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOrder(false)}
                  disabled={savingOrder || !selectedCustomer || orderItems.length === 0}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-outline-variant bg-surface-container-high text-on-surface font-semibold hover:bg-surface-container-highest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all uppercase flex items-center justify-center gap-2 text-xs"
                >
                  <span className="material-symbols-outlined text-base font-bold text-secondary">save</span>
                  Siparişi Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOrder(true)}
                  disabled={savingOrder || !selectedCustomer || orderItems.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-basari-yesili text-white font-semibold hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all uppercase flex items-center justify-center gap-2 text-xs"
                >
                  <span className="material-symbols-outlined text-base font-bold text-white">receipt_long</span>
                  Kaydet ve Fatura Kes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMER SELECTION MODAL */}
      {customerModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Cari Hesap Seçimi</h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setCustomerModalOpen(false)}
              >
                close
              </button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
              {loadingCustomers ? (
                <div className="py-8 text-center text-on-surface-variant font-medium">Cari hesaplar yükleniyor...</div>
              ) : customers.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant">Müşteri bulunamadı.</div>
              ) : (
                customers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className="p-3 border border-outline-variant rounded-lg hover:bg-secondary-container/10 hover:border-secondary cursor-pointer flex justify-between items-center transition-all group"
                  >
                    <div>
                      <div className="font-bold text-on-surface group-hover:text-secondary">{cust.name}</div>
                      <div className="text-kucuk-not text-on-surface-variant">Kod: {cust.code} | Tel: {cust.phone || '-'}</div>
                    </div>
                    <span className="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity">check_circle</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ROLL SELECTION MODAL */}
      {rollModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-outline-variant">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Mevcut Top Stokları</h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setRollModalOpen(false)}
              >
                close
              </button>
            </div>
            
            <div className="p-4 bg-uyari-kehribar/10 border-b border-uyari-kehribar/30 flex items-center gap-3">
              <span className="material-symbols-outlined text-uyari-kehribar">lock_open</span>
              <p className="text-kucuk-not text-on-surface-variant">
                <strong className="text-on-surface">Pessimistic Locking:</strong> Seçilen toplar işlem bitene kadar diğer kullanıcılar için kilitlenecektir.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-arka-plan-gri/10">
              {loadingRolls ? (
                <div className="py-20 text-center text-on-surface-variant font-medium">Stoktaki kumaş topları yükleniyor...</div>
              ) : availableRolls.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant italic">Mevcut veya boşta kumaş topu bulunamadı.</div>
              ) : (
                Object.keys(groupedRolls).map((fabricType) => {
                  const isFabricExpanded = expandedFabrics.includes(fabricType);
                  const colorsObj = groupedRolls[fabricType];
                  
                  let fabricTotalRolls = 0;
                  let fabricTotalMeters = 0;
                  Object.values(colorsObj).forEach((rollsList) => {
                    fabricTotalRolls += rollsList.length;
                    rollsList.forEach((r) => fabricTotalMeters += r.quantity);
                  });

                  return (
                    <div key={fabricType} className="border border-outline-variant rounded-lg bg-white overflow-hidden shadow-sm">
                      {/* Fabric Type Header */}
                      <div 
                        onClick={() => toggleFabricExpand(fabricType)}
                        className={`p-3.5 flex justify-between items-center cursor-pointer hover:bg-surface-container-low transition-colors select-none ${
                          isFabricExpanded ? 'bg-surface-container-low border-b border-outline-variant' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-bilgi-mavisi">layers</span>
                          <span className="font-bold text-sm text-on-surface">{fabricType}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <span className="text-xs font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                            {fabricTotalRolls} Top ({fabricTotalMeters.toFixed(1)} mt)
                          </span>
                          <span className={`material-symbols-outlined text-outline transition-transform duration-200 ${isFabricExpanded ? 'rotate-180' : ''}`}>
                            keyboard_arrow_down
                          </span>
                        </div>
                      </div>

                      {/* Colors Section */}
                      {isFabricExpanded && (
                        <div className="p-3 bg-arka-plan-gri/20 space-y-2">
                          {Object.keys(colorsObj).map((color) => {
                            const colorKey = `${fabricType}:${color}`;
                            const isColorExpanded = expandedColors.includes(colorKey);
                            const rollsList = colorsObj[color];
                            
                            const colorTotalRolls = rollsList.length;
                            const colorTotalMeters = rollsList.reduce((sum, r) => sum + r.quantity, 0);

                            return (
                              <div key={color} className="border border-outline-variant/60 rounded bg-white overflow-hidden">
                                {/* Color Header */}
                                <div 
                                  onClick={() => toggleColorExpand(fabricType, color)}
                                  className={`p-2.5 flex justify-between items-center cursor-pointer hover:bg-surface-container-lowest transition-colors select-none ${
                                    isColorExpanded ? 'bg-surface-container-lowest border-b border-outline-variant/40' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full border border-outline-variant bg-gray-200"></span>
                                    <span className="font-semibold text-xs text-on-surface">{color}</span>
                                  </div>
                                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                                      {colorTotalRolls} Top ({colorTotalMeters.toFixed(1)} mt)
                                    </span>
                                    <span className={`material-symbols-outlined text-outline text-sm transition-transform duration-200 ${isColorExpanded ? 'rotate-180' : ''}`}>
                                      keyboard_arrow_down
                                    </span>
                                  </div>
                                </div>

                                {/* Rolls List */}
                                {isColorExpanded && (
                                  <div className="p-2 bg-arka-plan-gri/10 divide-y divide-outline-variant/40">
                                    {rollsList.map((roll) => {
                                      const isLocked = roll.status === 'LOCKED';
                                      const isChecked = selectedRollIds.includes(roll.id);
                                      return (
                                        <div 
                                          key={roll.id} 
                                          className={`flex justify-between items-center p-2 text-xs hover:bg-white rounded transition-colors ${
                                            isLocked ? 'opacity-60 bg-red-50/20' : ''
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <input
                                              type="checkbox"
                                              disabled={isLocked}
                                              checked={isChecked}
                                              onChange={() => handleToggleRollSelection(roll.id)}
                                              className="rounded text-secondary focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                            <div>
                                              <span className="font-semibold font-etiket-mono text-bilgi-mavisi block">
                                                {roll.barcode}
                                              </span>
                                              <span className="text-[10px] text-on-surface-variant">
                                                {roll.quantity.toFixed(1)} mt
                                              </span>
                                            </div>
                                          </div>
                                          
                                          <div>
                                            {isLocked ? (
                                              <span className="inline-flex items-center gap-0.5 text-hata-kirmizisi text-[10px] font-bold uppercase">
                                                <span className="material-symbols-outlined text-[10px]">lock</span>
                                                Kilitli ({roll.lockedBy})
                                              </span>
                                            ) : (
                                              <span className="text-basari-yesili text-[10px] font-bold uppercase">Mevcut</span>
                                            )}
                                          </div>
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
                })
              )}
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg text-govde-metin hover:bg-white border border-transparent hover:border-outline-variant transition-colors"
                onClick={() => setRollModalOpen(false)}
              >
                İptal
              </button>
              <button
                onClick={handleAddSelectedRolls}
                disabled={selectedRollIds.length === 0}
                className="bg-secondary text-on-secondary px-5 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-95 transition-all"
              >
                Seçilenleri Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE PREVIEW MODAL */}
      {previewOpen && selectedCustomer && (
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
              <div className="overflow-x-auto w-full">
                <div id="e-arsiv-invoice-container" className="border border-outline-variant rounded-lg p-8 bg-white text-black font-sans relative overflow-hidden shadow-inner min-w-[750px] lg:min-w-0">
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
                        <p><span className="font-semibold text-slate-950">Sayın:</span> {selectedCustomer.name}</p>
                        <p><span className="font-semibold text-slate-950">Adres:</span> {selectedCustomer.address || 'Belirtilmedi'}</p>
                      </div>
                      <div className="space-y-1 text-slate-700">
                        <p>
                          <span className="font-semibold text-slate-950">V.D. / VKN:</span>{' '}
                          {selectedCustomer.taxOffice || 'Belirtilmedi'} / {selectedCustomer.taxNumber || 'Belirtilmedi'}
                        </p>
                        <p><span className="font-semibold text-slate-950">Tel:</span> {selectedCustomer.phone || 'Belirtilmedi'}</p>
                        <p><span className="font-semibold text-slate-950">E-posta:</span> {selectedCustomer.email || 'Belirtilmedi'}</p>
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
                    {orderItems.map((item, idx) => {
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
                        Yalnız #{convertNumberToWords(total)}#
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
                      <span className="font-mono font-semibold text-slate-900">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hesaplanan KDV (%{taxRate}):</span>
                      <span className="font-mono font-semibold text-slate-900">{kdvAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-black pt-2 text-slate-950 bg-slate-50 px-2 py-1 rounded">
                      <span>Ödenecek Tutar (Genel Toplam):</span>
                      <span className="font-mono text-blue-700 text-base">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="mt-8 pt-4 border-t border-black/10 text-[10px] text-slate-500 text-center">
                  Bu belge 213 sayılı V.U.K. uyarınca Gelir İdaresi Başkanlığı e-Arşiv mevzuatına göre oluşturulan taslak fatura önizlemesidir. Mali değeri yoktur.
                </div>
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
    </div>
  );
};

export default Orders;
