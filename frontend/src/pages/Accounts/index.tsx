/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { Modal } from 'antd';
import * as XLSX from 'xlsx';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  taxOffice?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
  currency?: string;
  ocrPrompt?: string;
  balanceTRY?: number;
  balanceUSD?: number;
  balanceEUR?: number;
  balanceInDefault?: number;
  defaultCurrency?: string;
}

const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  // Stats
  const [stats, setStats] = useState({
    customers: 0,
    suppliers: 0,
    both: 0,
  });

  // Modal/Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formValues, setFormValues] = useState({
    code: '',
    name: '',
    type: 'CUSTOMER',
    taxOffice: '',
    taxNumber: '',
    phone: '',
    email: '',
    address: '',
    currency: 'TRY',
    ocrPrompt: '',
  });

  // Detail View states
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [yarnStocks, setYarnStocks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [waybills, setWaybills] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'yarn' | 'orders' | 'finance' | 'waybills'>('yarn');
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Return/İade State'leri
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<any | null>(null);
  const [selectedReturnRollIds, setSelectedReturnRollIds] = useState<string[]>([]);

  // Sipariş detayı görüntüleme state'leri
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  const handleShowOrderDetails = (order: any) => {
    setSelectedOrderDetails(order);
    setOrderDetailsModalOpen(true);
  };

  // Ödeme Modali State ve Yardımcı Fonksiyonları
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<Account | null>(null);
  const [liveRates, setLiveRates] = useState<{ [key: string]: number }>({ TRY: 34.0, EUR: 0.92, USD: 1.0 });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    currency: 'TRY',
    exchangeRate: '1.00',
    convertedAmount: '0.00',
    type: 'CASH',
    bankName: '',
    referenceNumber: '',
    notes: '',
  });

  // Canlı Döviz Kurlarını Çek
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rates) {
          setLiveRates({
            TRY: data.rates.TRY || 34.0,
            EUR: data.rates.EUR || 0.92,
            USD: 1.0,
          });
        }
      })
      .catch((err) => {
        console.error('Kurlar canlı çekilemedi:', err);
      })
      .finally(() => {
        setRatesLoading(false);
      });
  }, []);

  const calculateConversion = (amt: number, payCur: string, accCur: string, rateInput?: number) => {
    if (payCur === accCur) {
      return { rate: 1.0, converted: amt };
    }

    const usdToTry = liveRates.TRY || 34.0;
    const usdToEur = liveRates.EUR || 0.92;
    const eurToTry = usdToTry / usdToEur;

    let rate = 1.0;
    let converted = amt;

    if (payCur === 'TRY' && accCur === 'USD') {
      rate = rateInput ?? usdToTry;
      converted = rate !== 0 ? amt / rate : 0;
    } else if (payCur === 'TRY' && accCur === 'EUR') {
      rate = rateInput ?? eurToTry;
      converted = rate !== 0 ? amt / rate : 0;
    } else if (payCur === 'USD' && accCur === 'TRY') {
      rate = rateInput ?? usdToTry;
      converted = amt * rate;
    } else if (payCur === 'EUR' && accCur === 'TRY') {
      rate = rateInput ?? eurToTry;
      converted = amt * rate;
    } else if (payCur === 'EUR' && accCur === 'USD') {
      const eurToUsd = 1 / usdToEur;
      rate = rateInput ?? eurToUsd;
      converted = amt * rate;
    } else if (payCur === 'USD' && accCur === 'EUR') {
      const eurToUsd = 1 / usdToEur;
      rate = rateInput ?? eurToUsd;
      converted = rate !== 0 ? amt / rate : 0;
    }

    return { rate, converted };
  };

  const handleOpenPaymentModal = (account: Account) => {
    setSelectedPaymentAccount(account);
    const accCurrency = account.currency || 'TRY';
    const { rate } = calculateConversion(0, 'TRY', accCurrency);

    setPaymentForm({
      amount: '',
      currency: 'TRY',
      exchangeRate: String(rate.toFixed(4)),
      convertedAmount: '0.00',
      type: 'CASH',
      bankName: '',
      referenceNumber: '',
      notes: '',
    });
    setPaymentModalOpen(true);
  };

  const handlePaymentFormChange = (field: string, value: any) => {
    setPaymentForm((prev) => {
      const updated = { ...prev, [field]: value };
      
      const amt = Number(updated.amount) || 0;
      const payCur = updated.currency;
      const accCur = selectedPaymentAccount?.currency || 'TRY';
      
      let rateInput: number | undefined = undefined;
      if (field === 'exchangeRate') {
        rateInput = Number(value);
      }

      const { rate, converted } = calculateConversion(
        amt,
        payCur,
        accCur,
        field === 'currency' ? undefined : rateInput
      );

      return {
        ...updated,
        exchangeRate: String(rate.toFixed(4)),
        convertedAmount: String(converted.toFixed(2)),
      };
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentAccount) return;
    try {
      await apiClient.post(`/accounts/${selectedPaymentAccount.id}/payments`, {
        amount: Number(paymentForm.amount),
        currency: paymentForm.currency,
        exchangeRate: Number(paymentForm.exchangeRate),
        convertedAmount: Number(paymentForm.convertedAmount),
        targetCurrency: selectedPaymentAccount.currency || 'TRY',
        type: paymentForm.type,
        bankName: paymentForm.bankName,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      });
      alert('Ödeme kaydı başarıyla eklendi.');
      setPaymentModalOpen(false);
      fetchAccounts();
      if (selectedAccount && selectedAccount.id === selectedPaymentAccount.id) {
        handleOpenDetails(selectedAccount);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ödeme kaydedilirken bir hata oluştu.');
    }
  };

  const handleOpenReturnModal = (order: any) => {
    setSelectedReturnOrder(order);
    setSelectedReturnRollIds([]);
    setReturnModalOpen(true);
  };

  const handleToggleReturnRoll = (rollId: string) => {
    setSelectedReturnRollIds((prev) =>
      prev.includes(rollId) ? prev.filter((id) => id !== rollId) : [...prev, rollId]
    );
  };

  const handleConfirmReturn = () => {
    if (selectedReturnRollIds.length === 0) {
      alert('Lütfen iade edilecek en az bir kumaş topu seçiniz.');
      return;
    }
    Modal.confirm({
      title: 'Kumaş İade Onayı',
      content: 'Seçilen kumaş topları iade edilecek ve stoğa geri alınacaktır. Onaylıyor musunuz?',
      okText: 'Evet, İade Et',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await apiClient.post(`/orders/${selectedReturnOrder.id}/return`, {
            rollIds: selectedReturnRollIds,
          });
          alert('İade işlemi başarıyla tamamlandı, toplar stoğa geri eklendi.');
          setReturnModalOpen(false);
          if (selectedAccount) {
            handleOpenDetails(selectedAccount);
          }
        } catch (error: any) {
          alert(error.response?.data?.message || 'İade işlemi sırasında bir hata oluştu.');
        }
      }
    });
  };

  // Excel Import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/accounts', {
        params: {
          page,
          limit,
          search: search || undefined,
          type: typeFilter || undefined,
        },
      });
      setData(response.data.data);
      setTotal(response.data.total);

      // Fetch metrics from optimized stats endpoint
      const statsRes = await apiClient.get('/accounts/stats');
      setStats({
        customers: statsRes.data.customers || 0,
        suppliers: statsRes.data.suppliers || 0,
        both: statsRes.data.both || 0,
      });

    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAccounts();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAccounts]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleTypeSelect = (type: string | undefined) => {
    setTypeFilter(type);
    setPage(1);
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setFormValues({
      code: '',
      name: '',
      type: 'CUSTOMER',
      taxOffice: '',
      taxNumber: '',
      phone: '',
      email: '',
      address: '',
      currency: 'TRY',
      ocrPrompt: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (account: Account, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccount(account);
    setFormValues({
      code: account.code,
      name: account.name,
      type: account.type,
      taxOffice: account.taxOffice || '',
      taxNumber: account.taxNumber || '',
      phone: account.phone || '',
      email: account.email || '',
      address: account.address || '',
      currency: account.currency || 'TRY',
      ocrPrompt: account.ocrPrompt || '',
    });
    setModalOpen(true);
  };

  const handleOpenDetails = async (account: Account) => {
    setSelectedAccount(account);
    setDetailVisible(true);
    setLoadingDetails(true);
    // Default active tab based on account type
    if (account.type === 'SUPPLIER') {
      setActiveTab('yarn');
    } else {
      setActiveTab('orders');
    }
    try {
      const res = await apiClient.get(`/accounts/${account.id}`);
      setYarnStocks(res.data.yarnStocks || []);
      setOrders(res.data.orders || []);
      setTransactions(res.data.financialTransactions || []);
      setWaybills(res.data.waybills || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleInvoiceWaybill = (waybillId: string) => {
    Modal.confirm({
      title: 'İrsaliye Faturalandırma',
      content: 'Bu irsaliyeyi faturalandırmak istediğinize emin misiniz? Sipariş fiyatları baz alınarak otomatik fatura kesilecektir.',
      okText: 'Evet, Faturalandır',
      cancelText: 'İptal',
      onOk: async () => {
        try {
          await apiClient.post(`/waybills/${waybillId}/invoice`);
          alert('İrsaliye başarıyla faturalandırıldı, fatura cari hesaba eklendi.');
          if (selectedAccount) {
            handleOpenDetails(selectedAccount);
          }
        } catch (error: any) {
          alert(error.response?.data?.message || 'Fatura oluşturulurken bir hata oluştu.');
        }
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await apiClient.put(`/accounts/${editingAccount.id}`, formValues);
      } else {
        await apiClient.post('/accounts', formValues);
      }
      setModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Kaydetme hatası.');
    }
  };

  const handleDeleteAccount = (account: Account, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Cari Hesap Silme',
      content: `"${account.name}" cari hesabı silinecek. Bu işlem geri alınamaz!`,
      okText: 'Evet, Sil',
      okType: 'danger',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await apiClient.delete(`/accounts/${account.id}`);
          fetchAccounts();
        } catch (err: any) {
          alert(err.response?.data?.message || 'Silme işlemi sırasında hata oluştu.');
        }
      }
    });
  };

  const handleOpenImport = () => {
    setImportData([]);
    setImportError(null);
    setUploadedFileName(null);
    setImportModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      ['Cari Kodu', 'Cari Adı', 'Cari Tipi', 'Telefon', 'Vergi Dairesi', 'Vergi Numarası', 'E-Posta', 'Adres'],
      ['M-10001', 'Örnek Müşteri Ltd. Şti.', 'Müşteri', '0212 111 22 33', 'Beyoğlu V.D.', '1234567890', 'info@ornekmusteri.com', 'İstanbul'],
      ['S-20001', 'Örnek Tedarikçi A.Ş.', 'Tedarikçi', '0216 444 55 66', 'Kadıköy V.D.', '0987654321', 'sales@ornektedarikci.com', 'Kocaeli']
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'cari_hesap_sablon.xlsx');
  };

  const parseExcelFile = (file: File) => {
    setImportError(null);
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        if (rawRows.length === 0) {
          setImportError('Dosya boş görünüyor.');
          return;
        }

        const headers = rawRows[0] as string[];
        const dataRows = rawRows.slice(1);

        const turkishNormalize = (val: any) => {
          if (!val) return '';
          return String(val)
            .replace(/\u0130/g, 'i') // uppercase Turkish dotted I
            .replace(/I/g, 'i')      // uppercase dotless I
            .replace(/\u0131/g, 'i') // lowercase Turkish dotless i
            .toLowerCase()
            .replace(/\u0307/g, '')  // strip combining dot
            .trim()
            .replace(/\u011F/g, 'g') // ğ
            .replace(/\u00FC/g, 'u') // ü
            .replace(/\u015F/g, 's') // ş
            .replace(/\u00F6/g, 'o') // ö
            .replace(/\u00E7/g, 'c'); // ç
        };

        const normalizeHeader = (h: string) => {
          return turkishNormalize(h).replace(/[^a-z0-9]/g, '');
        };

        const headerMap: { [key: string]: string } = {
          'cariadi': 'name',
          'cariunvani': 'name',
          'unvan': 'name',
          'adi': 'name',
          'isim': 'name',
          'ad': 'name',
          'soyad': 'name',
          'adsoyad': 'name',
          'cariunvanadsoyad': 'name',
          'name': 'name',
          'customername': 'name',
          'company': 'name',
          'carikodu': 'code',
          'kod': 'code',
          'kodu': 'code',
          'code': 'code',
          'caritipi': 'type',
          'tip': 'type',
          'tipi': 'type',
          'type': 'type',
          'hesaptipi': 'type',
          'hesaptip': 'type',
          'telefon': 'phone',
          'tel': 'phone',
          'phone': 'phone',
          'vergidairesi': 'taxOffice',
          'vd': 'taxOffice',
          'taxoffice': 'taxOffice',
          'verginumarasi': 'taxNumber',
          'vkn': 'taxNumber',
          'tcno': 'taxNumber',
          'vkntcno': 'taxNumber',
          'taxnumber': 'taxNumber',
          'tc': 'taxNumber',
          'eposta': 'email',
          'mail': 'email',
          'email': 'email',
          'adres': 'address',
          'address': 'address'
        };

        const mappedHeaders = headers.map(h => {
          const norm = normalizeHeader(h);
          return headerMap[norm] || null;
        });

        if (!mappedHeaders.includes('name')) {
          setImportError('Zorunlu sütun bulunamadı: "Cari Ünvan" veya "Cari Adı" sütunu bulunmalıdır.');
          return;
        }

        const parsedItems = dataRows.map((row) => {
          const hasData = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
          if (!hasData) return null;

          const item: any = {
            code: '',
            name: '',
            type: 'CUSTOMER',
            taxOffice: '',
            taxNumber: '',
            phone: '',
            email: '',
            address: '',
            errors: [] as string[],
            isValid: true
          };

          row.forEach((val, colIdx) => {
            const field = mappedHeaders[colIdx];
            if (field) {
              if (field === 'type') {
                item.type = val;
              } else {
                item[field] = val ? String(val).trim() : '';
              }
            }
          });

          // Validation
          if (!item.name) {
            item.errors.push('Cari Ünvan / Adı boş olamaz.');
            item.isValid = false;
          }

          const rawType = item.type ? String(item.type).trim() : '';
          if (!rawType) {
            item.errors.push('Cari Tipi belirtilmemiş.');
            item.isValid = false;
          } else {
            const normalizeType = (v: any): 'CUSTOMER' | 'SUPPLIER' | 'BOTH' => {
              const s = turkishNormalize(v);
              if (s.includes('musteri') || s.includes('customer') || s.includes('alici')) return 'CUSTOMER';
              if (s.includes('tedarikci') || s.includes('supplier') || s.includes('satici')) return 'SUPPLIER';
              if (s.includes('ikiside') || s.includes('ikisi de') || s.includes('both') || s.includes('alici + satici') || s.includes('hepsi')) return 'BOTH';
              return 'CUSTOMER';
            };

            const matchesKnown = (s: string) => {
              const norm = turkishNormalize(s);
              return norm.includes('musteri') || norm.includes('customer') || norm.includes('alici') ||
                     norm.includes('tedarikci') || norm.includes('supplier') || norm.includes('satici') ||
                     norm.includes('ikiside') || norm.includes('ikisi de') || norm.includes('both') || 
                     norm.includes('alici + satici') || norm.includes('hepsi');
            };

            if (!matchesKnown(rawType)) {
              item.errors.push(`Geçersiz Cari Tipi: "${rawType}". ("Müşteri", "Tedarikçi" veya "İkiside" olmalıdır)`);
              item.isValid = false;
            } else {
              item.type = normalizeType(rawType);
            }
          }

          if (item.email && !item.email.includes('@')) {
            item.errors.push('Geçersiz e-posta adresi.');
            item.isValid = false;
          }

          return item;
        }).filter(Boolean);

        setImportData(parsedItems);

      } catch (err) {
        console.error(err);
        setImportError('Excel dosyası okunamadı. Lütfen geçerli bir dosya yükleyin.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseExcelFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const handleImportSubmit = async () => {
    setIsImporting(true);
    try {
      const dtos = importData.map(item => ({
        code: item.code || undefined,
        name: item.name,
        type: item.type,
        phone: item.phone || undefined,
        taxOffice: item.taxOffice || undefined,
        taxNumber: item.taxNumber || undefined,
        email: item.email || undefined,
        address: item.address || undefined
      }));

      await apiClient.post('/accounts/bulk', dtos);
      alert('Tüm cari hesaplar başarıyla aktarıldı.');
      setImportModalOpen(false);
      setImportData([]);
      fetchAccounts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Aktarma işlemi sırasında hata oluştu.');
    } finally {
      setIsImporting(false);
    }
  };

  const validateRow = (row: any) => {
    const errors: string[] = [];
    if (!row.name || !String(row.name).trim()) {
      errors.push('Cari adı boş olamaz.');
    }
    
    if (!row.type || !['CUSTOMER', 'SUPPLIER', 'BOTH'].includes(row.type)) {
      errors.push('Geçersiz Cari Tipi.');
    }

    if (row.email && !String(row.email).includes('@')) {
      errors.push('Geçersiz e-posta adresi.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleCellChange = (rowIndex: number, field: string, value: string) => {
    setImportData(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex], [field]: value };
      const valResult = validateRow(row);
      row.isValid = valResult.isValid;
      row.errors = valResult.errors;
      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleDeleteImportRow = (rowIndex: number) => {
    setImportData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const handleAddImportRow = () => {
    const newRow = {
      code: '',
      name: '',
      type: 'CUSTOMER',
      taxOffice: '',
      taxNumber: '',
      phone: '',
      email: '',
      address: '',
      errors: ['Cari adı boş olamaz.'],
      isValid: false
    };
    setImportData(prev => [newRow, ...prev]);
  };

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'C';
  };

  return (
    <div>
      {/* 1. LIST VIEW CONTAINER */}
      <div className={`${detailVisible ? 'hidden' : ''}`}>
        {/* HEADER ACTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-ust-baslik-md font-ust-baslik-md font-bold">Tüm Cari Hesaplar</h3>
            <p className="text-govde-metin text-on-surface-variant">Fabrika veri tabanındaki tüm müşteri ve tedarikçiler.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={handleOpenImport}
              className="flex-1 sm:flex-none bg-surface-container hover:bg-surface-container-high text-on-surface px-standart-padding py-2.5 rounded flex items-center justify-center gap-2 font-semibold transition-all shadow-sm active:scale-95 border border-outline-variant"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Excel'den Aktar
            </button>
            <button 
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-none bg-bilgi-mavisi hover:bg-secondary text-white px-standart-padding py-2.5 rounded flex items-center justify-center gap-2 font-semibold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Yeni Cari
            </button>
          </div>
        </div>

        {/* BENTO STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-standart-padding rounded-lg border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <span className="text-kucuk-not text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Müşteri</span>
              <div className="text-ust-baslik-md font-bold mt-1">{stats.customers + stats.both}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-bilgi-mavisi">person</span>
          </div>

          <div className="bg-white p-standart-padding rounded-lg border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <span className="text-kucuk-not text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Tedarikçi</span>
              <div className="text-ust-baslik-md font-bold mt-1">{stats.suppliers + stats.both}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-uyari-kehribar">factory</span>
          </div>

          <div className="bg-white p-standart-padding rounded-lg border border-outline-variant shadow-sm flex items-center justify-between border-l-4 border-l-basari-yesili">
            <div>
              <span className="text-kucuk-not text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Cari Kayıt</span>
              <div className="text-ust-baslik-md font-bold mt-1">{total}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-basari-yesili">account_balance</span>
          </div>
        </div>

        {/* LIST TABLE SECTION */}
        <div className="bg-white rounded-lg border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-kenar-payi py-standart-padding border-b border-outline-variant flex flex-col sm:flex-row sm:justify-between sm:items-center bg-surface-container-lowest gap-4">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 whitespace-nowrap">
              <button 
                onClick={() => handleTypeSelect(undefined)}
                className={`shrink-0 px-3 py-1 rounded text-sm font-medium ${!typeFilter ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                Hepsi
              </button>
              <button 
                onClick={() => handleTypeSelect('CUSTOMER')}
                className={`shrink-0 px-3 py-1 rounded text-sm font-medium ${typeFilter === 'CUSTOMER' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                Müşteriler
              </button>
              <button 
                onClick={() => handleTypeSelect('SUPPLIER')}
                className={`shrink-0 px-3 py-1 rounded text-sm font-medium ${typeFilter === 'SUPPLIER' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                Tedarikçiler
              </button>
              <button 
                onClick={() => handleTypeSelect('BOTH')}
                className={`shrink-0 px-3 py-1 rounded text-sm font-medium ${typeFilter === 'BOTH' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                Alıcı + Satıcı
              </button>
            </div>
            
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50">search</span>
              <input 
                value={search} 
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-tablo-verisi focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                placeholder="Cari adı veya kodu ara..." 
                type="text"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-8 text-center text-on-surface-variant font-medium">Yükleniyor...</div>
            ) : data.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant">Hiç cari hesap kaydı bulunamadı.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low text-on-surface-variant text-kucuk-not font-semibold uppercase">
                  <tr>
                    <th className="px-kenar-payi py-3 border-b border-outline-variant">Ünvan / Cari Adı</th>
                    <th className="px-standart-padding py-3 border-b border-outline-variant hidden md:table-cell">Cari Kodu</th>
                    <th className="px-standart-padding py-3 border-b border-outline-variant">Tip</th>
                    <th className="px-standart-padding py-3 border-b border-outline-variant hidden md:table-cell">Telefon</th>
                    <th className="px-standart-padding py-3 border-b border-outline-variant hidden md:table-cell">Vergi Detayı</th>
                    <th className="px-standart-padding py-3 border-b border-outline-variant text-right">Bakiye</th>
                    <th className="px-kenar-payi py-3 border-b border-outline-variant text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="text-tablo-verisi font-tablo-verisi divide-y divide-outline-variant">
                  {data.map((record) => (
                    <tr 
                      key={record.id} 
                      className="hover:bg-arka-plan-gri/50 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetails(record)}
                    >
                      <td className="px-kenar-payi py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-surface-container-high rounded flex items-center justify-center font-bold text-on-primary-container shrink-0">
                            {getInitials(record.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-on-surface truncate max-w-[200px] sm:max-w-xs md:max-w-sm" title={record.name}>{record.name}</div>
                            <div className="text-[11px] text-on-surface-variant truncate">{record.email || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-standart-padding py-4 text-on-surface-variant font-etiket-mono hidden md:table-cell">{record.code}</td>
                      <td className="px-standart-padding py-4">
                        {record.type === 'CUSTOMER' && <span className="px-2 py-0.5 bg-blue-50 text-bilgi-mavisi rounded-full text-[11px] font-bold border border-blue-100">MÜŞTERİ</span>}
                        {record.type === 'SUPPLIER' && <span className="px-2 py-0.5 bg-orange-50 text-uyari-kehribar rounded-full text-[11px] font-bold border border-orange-100">TEDARİKÇİ</span>}
                        {record.type === 'BOTH' && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] font-bold border border-purple-100">HEPSİ</span>}
                      </td>
                      <td className="px-standart-padding py-4 text-on-surface-variant hidden md:table-cell">{record.phone || '-'}</td>
                      <td className="px-standart-padding py-4 text-on-surface-variant hidden md:table-cell">
                        {record.taxOffice ? `${record.taxOffice} / ` : ''}{record.taxNumber || '-'}
                      </td>
                      <td className="px-standart-padding py-4 text-right font-bold whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={record.balanceInDefault && record.balanceInDefault > 0 ? 'text-hata-kirmizisi' : record.balanceInDefault && record.balanceInDefault < 0 ? 'text-basari-yesili' : 'text-on-surface'}>
                            {record.balanceInDefault ? record.balanceInDefault.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'} {record.currency || 'TRY'}
                          </span>
                          <div className="text-[10px] text-on-surface-variant font-normal leading-tight opacity-75 group-hover:opacity-100 transition-opacity">
                            {record.currency !== 'TRY' && (
                              <div>₺{record.balanceTRY ? record.balanceTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'}</div>
                            )}
                            {record.currency !== 'USD' && (
                              <div>${record.balanceUSD ? record.balanceUSD.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'}</div>
                            )}
                            {record.currency !== 'EUR' && (
                              <div>€{record.balanceEUR ? record.balanceEUR.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-kenar-payi py-4 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            {(record.type === 'CUSTOMER' || record.type === 'BOTH') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/orders?customerId=${record.id}&openStock=true`);
                                }}
                                className="text-basari-yesili hover:underline font-semibold flex items-center gap-1 text-xs bg-basari-yesili/10 px-2.5 py-1 rounded border border-basari-yesili/20 hover:bg-basari-yesili/20 transition-all shrink-0"
                              >
                                <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                                <span className="hidden sm:inline">Sipariş</span>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPaymentModal(record);
                              }}
                              className="text-basari-yesili hover:bg-basari-yesili/20 font-semibold flex items-center gap-1 text-xs bg-basari-yesili/10 px-2.5 py-1 rounded border border-basari-yesili/20 transition-all shrink-0"
                            >
                              <span className="material-symbols-outlined text-[14px]">payments</span>
                              <span>Ödeme</span>
                            </button>
                            <button 
                              onClick={(e) => handleOpenEdit(record, e)}
                              className="text-bilgi-mavisi hover:text-secondary font-semibold flex items-center gap-1 text-xs bg-bilgi-mavisi/10 px-2 py-1 rounded border border-bilgi-mavisi/20 hover:bg-bilgi-mavisi/20 transition-all shrink-0"
                            >
                              Düzelt
                            </button>
                            <button 
                              onClick={(e) => handleDeleteAccount(record, e)}
                              title="Cariyi Sil"
                              className="text-hata-kirmizisi hover:bg-red-50 p-1 rounded transition-colors shrink-0"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="p-standart-padding border-t border-outline-variant flex justify-between items-center text-kucuk-not">
            <span className="text-on-surface-variant">Toplam {total} kayıttan {(page-1)*limit+1}-{Math.min(page*limit, total)} arası gösteriliyor</span>
            <div className="flex gap-1">
              <button 
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(prev-1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant bg-white text-on-surface-variant disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <span className="px-3 py-1 bg-bilgi-mavisi text-white rounded font-bold flex items-center justify-center">{page}</span>
              <button 
                disabled={page * limit >= total}
                onClick={() => setPage(prev => prev+1)}
                className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant bg-white text-on-surface-variant disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DETAIL VIEW PANEL */}
      {detailVisible && selectedAccount && (
        <div className="max-w-6xl mx-auto">
          <button 
            className="mb-4 flex items-center gap-2 text-bilgi-mavisi font-semibold hover:gap-3 transition-all outline-none" 
            onClick={() => setDetailVisible(false)}
          >
            <span className="material-symbols-outlined">arrow_back</span> Listeye Dön
          </button>
          
          {/* Top Card */}
          <div className="bg-white rounded-lg border border-outline-variant shadow-md p-kenar-payi mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-primary-container text-white rounded-xl flex items-center justify-center text-3xl font-bold">
                  {getInitials(selectedAccount.name)}
                </div>
                <div>
                  <h2 className="text-ust-baslik-md font-ust-baslik-md font-bold">{selectedAccount.name}</h2>
                  <div className="flex gap-4 mt-2 text-on-surface-variant text-govde-metin flex-wrap">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">badge</span> Kodu: {selectedAccount.code}</span>
                    {selectedAccount.taxNumber && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">domain</span> {selectedAccount.taxOffice || 'Vergi No'}: {selectedAccount.taxNumber}</span>}
                    {selectedAccount.phone && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">phone</span> {selectedAccount.phone}</span>}
                  </div>
                  <p className="mt-3 text-kucuk-not text-on-surface-variant max-w-md">
                    <span className="font-bold">Adres:</span> {selectedAccount.address || 'Kayıtlı adres yok.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 min-w-[200px] w-full md:w-auto">
                <div className="text-right">
                  <span className="text-kucuk-not uppercase tracking-widest text-on-surface-variant font-medium">Hesap Tipi</span>
                  <div className="text-lg font-bold text-bilgi-mavisi">
                    {selectedAccount.type === 'CUSTOMER' ? 'MÜŞTERİ' : selectedAccount.type === 'SUPPLIER' ? 'TEDARİKÇİ' : 'HEPSİ'}
                  </div>
                </div>
                <div className="text-right border-t border-outline-variant pt-2 w-full">
                  <span className="text-kucuk-not uppercase tracking-widest text-on-surface-variant font-medium">Güncel Bakiye</span>
                  <div className="text-xl font-bold flex items-center justify-end gap-1.5 mt-0.5">
                    <span className={selectedAccount.balanceInDefault && selectedAccount.balanceInDefault > 0 ? 'text-hata-kirmizisi' : selectedAccount.balanceInDefault && selectedAccount.balanceInDefault < 0 ? 'text-basari-yesili' : 'text-on-surface'}>
                      {selectedAccount.balanceInDefault ? selectedAccount.balanceInDefault.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'} {selectedAccount.currency || 'TRY'}
                    </span>
                  </div>
                  <div className="text-xs text-on-surface-variant flex flex-col gap-0.5 mt-1 leading-tight">
                    {selectedAccount.currency !== 'TRY' && (
                      <div>TRY: ₺{selectedAccount.balanceTRY ? selectedAccount.balanceTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'}</div>
                    )}
                    {selectedAccount.currency !== 'USD' && (
                      <div>USD: ${selectedAccount.balanceUSD ? selectedAccount.balanceUSD.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'}</div>
                    )}
                    {selectedAccount.currency !== 'EUR' && (
                      <div>EUR: €{selectedAccount.balanceEUR ? selectedAccount.balanceEUR.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenPaymentModal(selectedAccount)}
                    className="mt-3 w-full px-4 py-2 bg-basari-yesili text-white hover:brightness-105 active:scale-95 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Ödeme Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-outline-variant shadow-sm overflow-hidden">
            <div className="flex border-b border-outline-variant bg-surface-container-low px-standart-padding gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap">
              <button 
                onClick={() => setActiveTab('orders')}
                className={`shrink-0 px-6 py-4 border-b-2 font-bold text-sm transition-all ${activeTab === 'orders' ? 'border-bilgi-mavisi text-bilgi-mavisi' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Kumaş Satış Siparişleri ({orders.length})
              </button>
              <button 
                onClick={() => setActiveTab('yarn')}
                className={`shrink-0 px-6 py-4 border-b-2 font-bold text-sm transition-all ${activeTab === 'yarn' ? 'border-bilgi-mavisi text-bilgi-mavisi' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                İplik Alım Stokları ({yarnStocks.length})
              </button>
              <button 
                onClick={() => setActiveTab('finance')}
                className={`shrink-0 px-6 py-4 border-b-2 font-bold text-sm transition-all ${activeTab === 'finance' ? 'border-bilgi-mavisi text-bilgi-mavisi' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Finansal Evraklar ({transactions.length})
              </button>
              <button 
                onClick={() => setActiveTab('waybills')}
                className={`shrink-0 px-6 py-4 border-b-2 font-bold text-sm transition-all ${activeTab === 'waybills' ? 'border-bilgi-mavisi text-bilgi-mavisi' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Sevk İrsaliyeleri ({waybills.length})
              </button>
            </div>
            
            <div className="overflow-x-auto">
              {loadingDetails ? (
                <div className="py-8 text-center text-on-surface-variant font-medium">Yükleniyor...</div>
              ) : activeTab === 'yarn' ? (
                yarnStocks.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant">Bu cari hesaba ait iplik giriş kaydı bulunmuyor.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-lowest text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-kenar-payi py-4">Lot No</th>
                        <th className="px-standart-padding py-4">İplik Cinsi</th>
                        <th className="px-standart-padding py-4 text-right">Giriş Kg</th>
                        <th className="px-standart-padding py-4 text-right">Kalan Kg</th>
                        <th className="px-standart-padding py-4 text-right">Birim Fiyat</th>
                      </tr>
                    </thead>
                    <tbody className="text-tablo-verisi font-tablo-verisi divide-y divide-outline-variant">
                      {yarnStocks.map((yarn: any) => (
                        <tr key={yarn.id} className="hover:bg-arka-plan-gri/30">
                          <td className="px-kenar-payi py-4 font-etiket-mono font-bold text-bilgi-mavisi">{yarn.lotNumber}</td>
                          <td className="px-standart-padding py-4 font-medium">{yarn.yarnType} {yarn.neNumber ? `(${yarn.neNumber})` : ''}</td>
                          <td className="px-standart-padding py-4 text-right">{Number(yarn.initialKg).toFixed(1)} kg</td>
                          <td className="px-standart-padding py-4 text-right font-bold text-basari-yesili">{Number(yarn.currentKg).toFixed(1)} kg</td>
                          <td className="px-standart-padding py-4 text-right font-semibold">${Number(yarn.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : activeTab === 'orders' ? (
                orders.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant">Bu cari hesaba ait kumaş satış siparişi bulunmuyor.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-lowest text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-kenar-payi py-4">Sipariş No</th>
                        <th className="px-standart-padding py-4">Sipariş Tarihi</th>
                        <th className="px-standart-padding py-4">Kumaş Detayları</th>
                        <th className="px-standart-padding py-4 text-right">Toplam Tutar</th>
                        <th className="px-kenar-payi py-4 text-right">Durum</th>
                        <th className="px-standart-padding py-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="text-tablo-verisi font-tablo-verisi divide-y divide-outline-variant">
                      {orders.map((order: any) => (
                        <tr key={order.id} className="hover:bg-arka-plan-gri/30">
                          <td className="px-kenar-payi py-4 font-bold text-bilgi-mavisi font-etiket-mono">{order.orderNumber}</td>
                          <td className="px-standart-padding py-4 text-on-surface-variant">
                            {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-standart-padding py-4">
                            <div className="flex flex-col gap-1 max-w-xs">
                              {order.orderItems?.map((item: any) => (
                                <div key={item.id} className="text-xs">
                                  • <span className="font-semibold">{item.roll?.fabricType}</span> ({item.roll?.color}) - {Number(item.roll?.lengthM).toFixed(1)}m
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-standart-padding py-4 text-right font-bold">
                            ₺{Number(order.totalAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-kenar-payi py-4 text-right">
                            {order.status === 'confirmed' && <span className="px-2 py-0.5 bg-blue-50 text-bilgi-mavisi rounded-full text-[10px] font-bold border border-blue-100">ONAYLI</span>}
                            {order.status === 'invoiced' && <span className="px-2 py-0.5 bg-green-50 text-basari-yesili rounded-full text-[10px] font-bold border border-green-100">FATURALANDI</span>}
                            {order.status === 'cancelled' && <span className="px-2 py-0.5 bg-red-50 text-hata-kirmizisi rounded-full text-[10px] font-bold border border-red-100">İPTAL</span>}
                            {order.status === 'draft' && <span className="px-2 py-0.5 bg-gray-50 text-on-surface-variant rounded-full text-[10px] font-bold border border-gray-100">TASLAK</span>}
                          </td>
                          <td className="px-standart-padding py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <button
                                onClick={() => handleShowOrderDetails(order)}
                                className="text-bilgi-mavisi hover:underline font-semibold flex items-center gap-1 text-xs bg-bilgi-mavisi/10 px-2.5 py-1 rounded border border-bilgi-mavisi/20 hover:bg-bilgi-mavisi/20 transition-all shrink-0"
                              >
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                Detay
                              </button>
                              {order.status !== 'cancelled' && order.orderItems?.length > 0 && (
                                <button
                                  onClick={() => handleOpenReturnModal(order)}
                                  className="text-hata-kirmizisi hover:underline font-semibold flex items-center gap-1 text-xs bg-red-50 px-2.5 py-1 rounded border border-red-100 hover:bg-red-100 transition-all shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[14px]">assignment_return</span>
                                  İade
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : activeTab === 'finance' ? (
                transactions.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant">Bu cari hesaba ait finansal evrak/hareket kaydı bulunmuyor.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-lowest text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-kenar-payi py-4">Vade Tarihi</th>
                        <th className="px-standart-padding py-4">Evrak Tipi</th>
                        <th className="px-standart-padding py-4">Yönü</th>
                        <th className="px-standart-padding py-4">Banka</th>
                        <th className="px-standart-padding py-4 text-right">Tutar</th>
                        <th className="px-kenar-payi py-4 text-right">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="text-tablo-verisi font-tablo-verisi divide-y divide-outline-variant">
                      {transactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-arka-plan-gri/30">
                          <td className="px-kenar-payi py-4 font-etiket-mono">
                            {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString('tr-TR') : '-'}
                          </td>
                          <td className="px-standart-padding py-4">
                            {tx.type === 'CHECK' && 'Çek'}
                            {tx.type === 'BILL_OF_EXCHANGE' && 'Senet'}
                            {tx.type === 'CASH' && 'Nakit'}
                            {tx.type === 'BANK_TRANSFER' && 'Banka Havalesi'}
                          </td>
                          <td className="px-standart-padding py-4 font-semibold">
                            {tx.direction === 'RECEIVABLE' ? (
                              <span className="text-basari-yesili">Alacak (Satış Geliri)</span>
                            ) : (
                              <span className="text-hata-kirmizisi">Borç (Hammadde Gideri)</span>
                            )}
                          </td>
                          <td className="px-standart-padding py-4 text-on-surface-variant">{tx.bankName || '-'}</td>
                          <td className="px-standart-padding py-4 text-right font-bold">
                            ₺{Number(tx.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-kenar-payi py-4 text-right">
                            {tx.status === 'pending' && <span className="px-2 py-0.5 bg-yellow-50 text-uyari-kehribar rounded-full text-[10px] font-bold border border-yellow-100">BEKLEYEN</span>}
                            {tx.status === 'collected' && <span className="px-2 py-0.5 bg-green-50 text-basari-yesili rounded-full text-[10px] font-bold border border-green-100">TAHSİL EDİLDİ</span>}
                            {tx.status === 'paid' && <span className="px-2 py-0.5 bg-green-50 text-basari-yesili rounded-full text-[10px] font-bold border border-green-100">ÖDENDİ</span>}
                            {tx.status === 'bounced' && <span className="px-2 py-0.5 bg-red-50 text-hata-kirmizisi rounded-full text-[10px] font-bold border border-red-100">KARŞILIKSIZ</span>}
                            {tx.status === 'cancelled' && <span className="px-2 py-0.5 bg-gray-50 text-on-surface-variant rounded-full text-[10px] font-bold border border-gray-100">İPTAL</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                waybills.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant">Bu cari hesaba ait sevk irsaliyesi bulunmuyor.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-lowest text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-kenar-payi py-4">İrsaliye No</th>
                        <th className="px-standart-padding py-4">Sevk Tarihi</th>
                        <th className="px-standart-padding py-4">Sipariş No</th>
                        <th className="px-standart-padding py-4">Kumaş Detayları</th>
                        <th className="px-standart-padding py-4 text-center">Durum</th>
                        <th className="px-kenar-payi py-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="text-tablo-verisi font-tablo-verisi divide-y divide-outline-variant">
                      {waybills.map((wb: any) => (
                        <tr key={wb.id} className="hover:bg-arka-plan-gri/30">
                          <td className="px-kenar-payi py-4 font-bold text-bilgi-mavisi font-etiket-mono">{wb.waybillNumber}</td>
                          <td className="px-standart-padding py-4 text-on-surface-variant">
                            {new Date(wb.issueDate).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-standart-padding py-4 font-semibold text-on-surface-variant">{wb.order?.orderNumber || '-'}</td>
                          <td className="px-standart-padding py-4">
                            <div className="flex flex-col gap-1 max-w-xs">
                              {wb.waybillItems?.map((item: any) => (
                                <div key={item.id} className="text-xs">
                                  • <span className="font-semibold">{item.description}</span> ({item.rollCount} Top - {Number(item.quantity).toFixed(1)}m)
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-standart-padding py-4 text-center">
                            {wb.status === 'shipped' && <span className="px-2 py-0.5 bg-blue-50 text-bilgi-mavisi rounded-full text-[10px] font-bold border border-blue-100">SEVK EDİLDİ</span>}
                            {wb.status === 'invoiced' && <span className="px-2 py-0.5 bg-green-50 text-basari-yesili rounded-full text-[10px] font-bold border border-green-100">FATURALANDI</span>}
                            {wb.status === 'cancelled' && <span className="px-2 py-0.5 bg-red-50 text-hata-kirmizisi rounded-full text-[10px] font-bold border border-red-100">İPTAL</span>}
                          </td>
                          <td className="px-kenar-payi py-4 text-right">
                            {wb.status === 'shipped' && (
                              <button
                                onClick={() => handleInvoiceWaybill(wb.id)}
                                className="px-3 py-1 bg-basari-yesili text-white hover:bg-opacity-90 text-xs font-bold rounded shadow-xs transition-all flex items-center gap-1 ml-auto"
                              >
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                Fatura Oluştur
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. NEW/EDIT CARI ACCOUNT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-primary-container/60 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="px-kenar-payi py-standart-padding bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-alt-baslik font-alt-baslik text-on-surface font-bold">
                {editingAccount ? 'Cari Hesabı Düzenle' : 'Yeni Cari Hesap Oluştur'}
              </h3>
              <button 
                className="text-on-surface-variant hover:text-hata-kirmizisi transition-colors" 
                onClick={() => setModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-kenar-payi grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">
                  Cari Kodu {!editingAccount && <span className="text-outline font-normal text-xs">(Boş bırakılırsa otomatik oluşturulur)</span>}
                </label>
                <input 
                  name="code"
                  value={formValues.code}
                  onChange={handleInputChange}
                  disabled={!!editingAccount}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none transition-all disabled:bg-gray-100 disabled:opacity-75" 
                  placeholder={editingAccount ? "" : "Örn: CARI-001 veya otomatik için boş bırakın"} 
                  type="text"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Cari Ünvan / Ad Soyad</label>
                <input 
                  required
                  name="name"
                  value={formValues.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none transition-all" 
                  placeholder="Örn: Global Tekstil A.Ş." 
                  type="text"
                />
              </div>

              <div>
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Hesap Tipi</label>
                <select 
                  name="type"
                  value={formValues.type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white"
                >
                  <option value="CUSTOMER">Alıcı (Müşteri)</option>
                  <option value="SUPPLIER">Satıcı (Tedarikçi)</option>
                  <option value="BOTH">Alıcı + Satıcı</option>
                </select>
              </div>

              <div>
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Telefon</label>
                <input 
                  name="phone"
                  value={formValues.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                  placeholder="0212 555 55 55" 
                  type="tel"
                />
              </div>

              <div>
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Vergi Dairesi</label>
                <input 
                  name="taxOffice"
                  value={formValues.taxOffice}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                  placeholder="Örn: Beyoğlu V.D." 
                  type="text"
                />
              </div>

              <div>
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">VKN / TC No</label>
                <input 
                  name="taxNumber"
                  value={formValues.taxNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                  placeholder="10 veya 11 haneli numara" 
                  type="text"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">E-Posta</label>
                <input 
                  name="email"
                  value={formValues.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none" 
                  placeholder="info@sirket.com" 
                  type="email"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Adres</label>
                <textarea 
                  name="address"
                  value={formValues.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none resize-none" 
                  placeholder="Tam adres bilgisini giriniz..." 
                  rows={3}
                ></textarea>
              </div>

              <div className="col-span-2">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Varsayılan Para Birimi</label>
                <select
                  name="currency"
                  value={formValues.currency}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white"
                >
                  <option value="TRY">Türk Lirası (TRY)</option>
                  <option value="USD">Amerikan Doları (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Müşteriye/Tedarikçiye Özel OCR (Barkod Okuma) Promptu</label>
                <textarea 
                  name="ocrPrompt"
                  value={formValues.ocrPrompt}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none resize-none font-mono text-sm" 
                  placeholder="Bu cariden gelen etiketlerin nasıl okunacağını tarif edin... (Örn: Metraj için 'MTR' veya 'Boy' başlığına bak...)" 
                  rows={4}
                ></textarea>
              </div>

              <div className="col-span-2 flex justify-end gap-3 mt-4">
                <button 
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2 bg-surface-container-high rounded font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-all" 
                  type="button"
                >
                  İptal
                </button>
                <button 
                  className="px-8 py-2 bg-bilgi-mavisi text-white rounded font-semibold hover:bg-secondary shadow-lg transition-all active:scale-95" 
                  type="submit"
                >
                  Cariyi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. EXCEL IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-container/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-[95vw] rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col max-h-[90vh]">
            <div className="px-kenar-payi py-standart-padding bg-surface-container-low border-b border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-bilgi-mavisi">upload_file</span>
                <h3 className="text-alt-baslik font-alt-baslik text-on-surface font-bold">
                  Excel'den Cari Hesap Aktarımı
                </h3>
              </div>
              <button 
                className="text-on-surface-variant hover:text-hata-kirmizisi transition-colors" 
                onClick={() => setImportModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-kenar-payi overflow-y-auto flex-1 flex flex-col gap-4">
              {importData.length === 0 ? (
                // Dropzone & Description
                <div className="flex flex-col gap-4">
                  <div className="text-govde-metin text-on-surface-variant">
                    Excel dosyanızı yükleyerek cari hesapları toplu bir şekilde sisteme aktarabilirsiniz. 
                    Başlık eşleştirmeleri otomatik olarak yapılır. Başlamak için örnek şablonu indirip doldurabilirsiniz.
                  </div>

                  <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-lg border border-outline-variant">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-3xl text-basari-yesili">description</span>
                      <div>
                        <div className="font-semibold text-sm">Hazır Excel Şablonu</div>
                        <div className="text-kucuk-not text-on-surface-variant">Sütun isimlerinin ve formatların uyumlu olduğu hazır şablon.</div>
                      </div>
                    </div>
                    <button 
                      onClick={handleDownloadTemplate}
                      className="px-4 py-2 bg-basari-yesili hover:bg-opacity-90 text-white rounded font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Şablonu İndir
                    </button>
                  </div>

                  {/* Dropzone */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-outline-variant rounded-xl p-10 flex flex-col items-center justify-center bg-background hover:bg-surface-container-low transition-all cursor-pointer relative group min-h-[200px]"
                  >
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleFileUpload} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant group-hover:text-bilgi-mavisi transition-colors mb-3">cloud_upload</span>
                    <div className="font-bold text-base mb-1">Excel dosyasını buraya sürükleyin veya tıklayın</div>
                    <div className="text-kucuk-not text-on-surface-variant">Yalnızca .xlsx ve .xls uzantılı dosyalar desteklenir.</div>
                  </div>

                  {importError && (
                    <div className="p-3 bg-error-container text-error rounded border border-red-200 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {importError}
                    </div>
                  )}
                </div>
              ) : (
                // Preview Table
                <div className="flex flex-col gap-4 flex-1 min-h-[350px]">
                  <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant shrink-0 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-bilgi-mavisi">check_circle</span>
                      <span className="font-semibold text-xs text-on-surface">
                        Toplam {importData.length} satır bulundu. {importData.filter(x => !x.isValid).length > 0 ? (
                          <span className="text-hata-kirmizisi font-bold">Lütfen kırmızı işaretli hatalı satırları düzeltin.</span>
                        ) : (
                          <span className="text-basari-yesili font-bold">Tüm satırlar geçerli. Aktarıma hazır!</span>
                        )}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleAddImportRow}
                        className="text-xs text-bilgi-mavisi hover:underline flex items-center gap-1 font-semibold"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        Yeni Satır Ekle
                      </button>
                      <button 
                        onClick={() => {
                          setImportData([]);
                          setUploadedFileName(null);
                          setImportError(null);
                        }}
                        className="text-xs text-on-surface-variant hover:text-hata-kirmizisi flex items-center gap-1 font-semibold"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                        Dosyayı Değiştir ({uploadedFileName || 'Yüklendi'})
                      </button>
                    </div>
                  </div>

                  {/* Table Wrapper */}
                  <div className="border border-outline-variant rounded-lg overflow-hidden flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 border-b border-outline-variant">Ünvan / Cari Adı *</th>
                          <th className="px-3 py-3 border-b border-outline-variant">Cari Kodu</th>
                          <th className="px-3 py-3 border-b border-outline-variant w-[120px]">Tip *</th>
                          <th className="px-3 py-3 border-b border-outline-variant">Telefon</th>
                          <th className="px-3 py-3 border-b border-outline-variant w-[200px]">Vergi No & Daire</th>
                          <th className="px-3 py-3 border-b border-outline-variant">E-Posta</th>
                          <th className="px-3 py-3 border-b border-outline-variant">Adres</th>
                          <th className="px-3 py-3 border-b border-outline-variant">Durum / Hata</th>
                          <th className="px-3 py-3 border-b border-outline-variant text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="text-tablo-verisi divide-y divide-outline-variant bg-white">
                        {importData.map((item, idx) => (
                          <tr 
                            key={idx} 
                            className={`hover:bg-arka-plan-gri/30 transition-colors ${!item.isValid ? 'bg-red-50/40' : ''}`}
                          >
                            <td className="px-2 py-1.5">
                              <input 
                                value={item.name || ''} 
                                onChange={(e) => handleCellChange(idx, 'name', e.target.value)}
                                placeholder="Cari Ünvan giriniz..."
                                className={`w-full px-2 py-1 bg-transparent border rounded outline-none transition-all text-xs text-on-surface ${!item.name ? 'border-hata-kirmizisi/40 bg-red-50/30 focus:border-hata-kirmizisi' : 'border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white'}`}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input 
                                value={item.code || ''} 
                                onChange={(e) => handleCellChange(idx, 'code', e.target.value)}
                                placeholder="[Otomatik]"
                                className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white rounded outline-none transition-all text-xs text-on-surface font-etiket-mono"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <select 
                                value={['CUSTOMER', 'SUPPLIER', 'BOTH'].includes(item.type) ? item.type : ''} 
                                onChange={(e) => handleCellChange(idx, 'type', e.target.value)}
                                className={`w-full px-2 py-1 bg-transparent border rounded outline-none transition-all text-xs cursor-pointer ${!['CUSTOMER', 'SUPPLIER', 'BOTH'].includes(item.type) ? 'border-hata-kirmizisi/40 bg-red-50/30 text-hata-kirmizisi focus:border-hata-kirmizisi' : 'border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white text-on-surface'}`}
                              >
                                <option value="" disabled>Seçiniz...</option>
                                <option value="CUSTOMER">MÜŞTERİ</option>
                                <option value="SUPPLIER">TEDARİKÇİ</option>
                                <option value="BOTH">HEPSİ</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input 
                                value={item.phone || ''} 
                                onChange={(e) => handleCellChange(idx, 'phone', e.target.value)}
                                placeholder="Telefon..."
                                className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white rounded outline-none transition-all text-xs text-on-surface"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <input 
                                  value={item.taxNumber || ''} 
                                  onChange={(e) => handleCellChange(idx, 'taxNumber', e.target.value)}
                                  placeholder="VKN"
                                  className="w-[100px] px-2 py-1 bg-transparent border border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white rounded outline-none transition-all text-xs text-on-surface"
                                />
                                <input 
                                  value={item.taxOffice || ''} 
                                  onChange={(e) => handleCellChange(idx, 'taxOffice', e.target.value)}
                                  placeholder="V.D."
                                  className="w-[90px] px-2 py-1 bg-transparent border border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white rounded outline-none transition-all text-xs text-on-surface"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <input 
                                value={item.email || ''} 
                                onChange={(e) => handleCellChange(idx, 'email', e.target.value)}
                                placeholder="info@..."
                                className={`w-full px-2 py-1 bg-transparent border rounded outline-none transition-all text-xs text-on-surface ${item.email && !item.email.includes('@') ? 'border-hata-kirmizisi/40 bg-red-50/30 focus:border-hata-kirmizisi' : 'border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white'}`}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input 
                                value={item.address || ''} 
                                onChange={(e) => handleCellChange(idx, 'address', e.target.value)}
                                placeholder="Adres..."
                                className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-outline-variant focus:border-bilgi-mavisi focus:bg-white rounded outline-none transition-all text-xs text-on-surface"
                              />
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              {item.isValid ? (
                                <span className="text-basari-yesili font-semibold text-xs flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">check_circle</span> Geçerli
                                </span>
                              ) : (
                                <div className="text-hata-kirmizisi font-semibold text-[11px] flex flex-col gap-0.5 max-w-[150px]">
                                  {item.errors.map((err: string, eIdx: number) => (
                                    <span key={eIdx} className="flex items-start gap-0.5 leading-snug">
                                      • {err}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right align-middle">
                              <button 
                                onClick={() => handleDeleteImportRow(idx)}
                                title="Satırı Sil"
                                className="text-hata-kirmizisi hover:bg-red-100/50 p-1.5 rounded transition-colors"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-kenar-payi py-standart-padding bg-surface-container-low border-t border-outline-variant flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setImportModalOpen(false)}
                className="px-6 py-2 bg-white border border-outline-variant rounded font-semibold text-on-surface-variant hover:bg-surface-container-low transition-all" 
                type="button"
                disabled={isImporting}
              >
                Kapat
              </button>
              {importData.length > 0 && (
                <button 
                  onClick={handleImportSubmit}
                  disabled={isImporting || importData.some(x => !x.isValid)}
                  className="px-8 py-2 bg-bilgi-mavisi text-white rounded font-semibold hover:bg-secondary shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2" 
                  type="button"
                >
                  {isImporting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Aktarılıyor...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">done_all</span>
                      Sisteme Aktar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL: ORDER RETURN */}
      {returnModalOpen && selectedReturnOrder && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-hata-kirmizisi">assignment_return</span>
                Sipariş İade İşlemi - {selectedReturnOrder.orderNumber}
              </h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setReturnModalOpen(false)}
              >
                close
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                İade etmek istediğiniz kumaş toplarını seçiniz. Seçilen toplar siparişten çıkarılacak, sipariş tutarı güncellenecek ve bu toplar depoda tekrar **Müsait (Stokta)** duruma getirilecektir.
              </p>

              <div className="space-y-2">
                {selectedReturnOrder.orderItems?.map((item: any) => {
                  const isSelected = selectedReturnRollIds.includes(item.rollId);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleReturnRoll(item.rollId)}
                      className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-red-50 border-red-200'
                          : 'hover:bg-arka-plan-gri/40 border-outline-variant/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-hata-kirmizisi"
                        />
                        <div>
                          <p className="font-bold text-on-surface">
                            {item.roll?.fabricType} ({item.roll?.color})
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono">
                            Barkod: {item.roll?.barcodeNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-basari-yesili text-xs block">
                          {Number(item.roll?.lengthM || 0).toFixed(2)} mt
                        </span>
                        <span className="text-[10px] text-on-surface-variant block">
                          Birim Fiyat: ₺{Number(item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3 font-sans">
              <button
                className="px-5 py-2 rounded-lg text-govde-metin hover:bg-white border border-transparent hover:border-outline-variant transition-colors font-bold"
                onClick={() => setReturnModalOpen(false)}
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmReturn}
                disabled={selectedReturnRollIds.length === 0}
                className="bg-hata-kirmizisi text-white px-6 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">assignment_return</span>
                {selectedReturnRollIds.length} Topu İade Et
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SİPARİŞ DETAYLARI MODALİ */}
      {orderDetailsModalOpen && selectedOrderDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <h4 className="text-lg font-bold flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-secondary">shopping_bag</span>
                  Sipariş Detayları: {selectedOrderDetails.orderNumber}
                </h4>
                <p className="text-xs text-on-surface-variant">Sipariş kapsamındaki kumaş ve renk grupları özeti</p>
              </div>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface transition-colors p-1.5 hover:bg-surface-container rounded-full"
                onClick={() => setOrderDetailsModalOpen(false)}
              >
                close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 bg-arka-plan-gri space-y-4">
              <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      <th className="py-3 px-4">Kumaş Türü</th>
                      <th className="py-3 px-4">Renk</th>
                      <th className="py-3 px-4 text-center">Top Adedi</th>
                      <th className="py-3 px-4 text-right">Toplam Metraj</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-sm text-on-surface">
                    {(() => {
                      const groups: { [key: string]: { fabricType: string; color: string; count: number; totalLength: number } } = {};
                      (selectedOrderDetails.orderItems || []).forEach((item: any) => {
                        const fabricType = item.roll?.fabricType || 'Bilinmeyen Kumaş';
                        const color = item.roll?.color || 'Bilinmeyen Renk';
                        const lengthM = Number(item.roll?.lengthM) || 0;
                        
                        const key = `${fabricType}-${color}`;
                        if (!groups[key]) {
                          groups[key] = {
                            fabricType,
                            color,
                            count: 0,
                            totalLength: 0,
                          };
                        }
                        groups[key].count += 1;
                        groups[key].totalLength += lengthM;
                      });
                      return Object.values(groups).map((group, idx) => (
                        <tr key={idx} className="hover:bg-arka-plan-gri/30">
                          <td className="py-3 px-4 font-bold">{group.fabricType}</td>
                          <td className="py-3 px-4">
                            <span className="bg-arka-plan-gri px-2 py-0.5 rounded text-xs">{group.color}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-secondary">
                            {group.count} Top
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-bilgi-mavisi">
                            {group.totalLength.toFixed(1)} mt
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
              <span className="text-xs text-on-surface-variant font-bold">
                Toplam: {selectedOrderDetails.orderItems?.length || 0} Top Kumaş
              </span>
              <button
                className="px-5 py-2 bg-secondary text-on-secondary hover:brightness-105 rounded-lg text-xs font-bold shadow-sm transition-all"
                onClick={() => setOrderDetailsModalOpen(false)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÖDEME YAP MODALİ */}
      {paymentModalOpen && selectedPaymentAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <h4 className="text-lg font-bold flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-basari-yesili">payments</span>
                  Ödeme Kaydet: {selectedPaymentAccount.name}
                </h4>
                <p className="text-xs text-on-surface-variant">
                  Cari Varsayılan Para Birimi: <span className="font-bold text-bilgi-mavisi">{selectedPaymentAccount.currency || 'TRY'}</span>
                </p>
              </div>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface transition-colors p-1.5 hover:bg-surface-container rounded-full"
                onClick={() => setPaymentModalOpen(false)}
              >
                close
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePaymentSubmit}>
              <div className="p-6 bg-arka-plan-gri space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  {/* Tutar */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Ödeme Tutarı *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => handlePaymentFormChange('amount', e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-sm"
                      placeholder="Tutar giriniz"
                    />
                  </div>

                  {/* Ödeme Para Birimi */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Ödeme Para Birimi *</label>
                    <select
                      value={paymentForm.currency}
                      onChange={(e) => handlePaymentFormChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-sm cursor-pointer"
                    >
                      <option value="TRY">Türk Lirası (TRY)</option>
                      <option value="USD">Amerikan Doları (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </select>
                  </div>

                  {/* Döviz Kuru */}
                  {paymentForm.currency !== (selectedPaymentAccount.currency || 'TRY') && (
                    <div className="col-span-2 bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-on-surface-variant font-medium">Dönüşüm Kuru ({paymentForm.currency} &rarr; {selectedPaymentAccount.currency || 'TRY'})</span>
                        {ratesLoading ? (
                          <span className="text-[10px] text-outline">Canlı kurlar yükleniyor...</span>
                        ) : (
                          <span className="text-[10px] text-basari-yesili font-semibold">Canlı Kur Aktif</span>
                        )}
                      </div>
                      <div className="flex gap-3 items-center">
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={paymentForm.exchangeRate}
                          onChange={(e) => handlePaymentFormChange('exchangeRate', e.target.value)}
                          className="w-32 px-3 py-1.5 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-xs font-bold text-center"
                        />
                        <div className="text-xs text-on-surface-variant">
                          1 {selectedPaymentAccount.currency || 'TRY'} = {paymentForm.exchangeRate} {paymentForm.currency}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-bilgi-mavisi mt-1">
                        Cari Borcundan Düşülecek Tutar: {Number(paymentForm.convertedAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {selectedPaymentAccount.currency || 'TRY'}
                      </div>
                    </div>
                  )}

                  {/* Ödeme Türü */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">İşlem Türü *</label>
                    <select
                      value={paymentForm.type}
                      onChange={(e) => handlePaymentFormChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-sm cursor-pointer"
                    >
                      <option value="CASH">Nakit Ödeme</option>
                      <option value="BANK_TRANSFER">Banka Havalesi</option>
                    </select>
                  </div>

                  {/* Banka Adı */}
                  {paymentForm.type === 'BANK_TRANSFER' && (
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Banka Adı</label>
                      <input
                        type="text"
                        value={paymentForm.bankName}
                        onChange={(e) => handlePaymentFormChange('bankName', e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-sm"
                        placeholder="Örn: Garanti BBVA"
                      />
                    </div>
                  )}

                  {/* Referans No */}
                  {paymentForm.type === 'BANK_TRANSFER' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Dekont / Referans No</label>
                      <input
                        type="text"
                        value={paymentForm.referenceNumber}
                        onChange={(e) => handlePaymentFormChange('referenceNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-sm"
                        placeholder="Örn: FT123456789"
                      />
                    </div>
                  )}

                  {/* Açıklama */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Açıklama / Notlar</label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) => handlePaymentFormChange('notes', e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white text-sm resize-none"
                      placeholder="Ödeme açıklaması giriniz..."
                      rows={2}
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
                <button
                  type="button"
                  className="px-5 py-2 rounded-lg text-sm hover:bg-white border border-transparent hover:border-outline-variant transition-colors font-bold text-on-surface-variant"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-basari-yesili text-white px-6 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 text-sm"
                >
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Ödemeyi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
