import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface FinancialDoc {
  id: string;
  docNumber: string;
  customerName: string;
  customerCode: string;
  type: 'CHEQUE' | 'BILL';
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'COLLECTED' | 'ENDORSED';
}

const Finance: React.FC = () => {
  // Accounts (for new cheque entry)
  const [customers, setCustomers] = useState<Account[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Cheque list
  const [documents, setDocuments] = useState<FinancialDoc[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CHEQUE' | 'BILL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COLLECTED' | 'ENDORSED'>('ALL');

  // Modals
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<FinancialDoc | null>(null);

  // Form states
  const [bankCommission, setBankCommission] = useState(0.0);
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);

  // Create form values
  const [newDocValues, setNewDocValues] = useState({
    accountId: '',
    docNumber: '',
    customerName: '',
    customerCode: '',
    type: 'CHEQUE' as 'CHEQUE' | 'BILL',
    amount: 0,
    dueDate: '',
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mapBackendToFrontendDoc = (tx: any): FinancialDoc => {
    let type: 'CHEQUE' | 'BILL' = 'CHEQUE';
    if (tx.type === 'BILL_OF_EXCHANGE') {
      type = 'BILL';
    }

    let status: 'PENDING' | 'COLLECTED' | 'ENDORSED' = 'PENDING';
    if (tx.status === 'collected' || tx.status === 'paid') {
      status = 'COLLECTED';
    } else if (tx.status === 'endorsed') {
      status = 'ENDORSED';
    }

    let dueDateStr = '';
    if (tx.dueDate) {
      try {
        const date = new Date(tx.dueDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        dueDateStr = `${day}.${month}.${year}`;
      } catch {
        dueDateStr = tx.dueDate;
      }
    }

    return {
      id: tx.id,
      docNumber: tx.referenceNumber || '',
      customerName: tx.account?.name || 'Bilinmiyor',
      customerCode: tx.account?.code || '',
      type,
      amount: Number(tx.amount || 0),
      dueDate: dueDateStr,
      status,
    };
  };

  const seedDatabaseDocs = async (customer: Account, existingDocsCount: number) => {
    if (existingDocsCount > 0) return;
    try {
      // Create Doc 1: CK-90212 (Pending)
      await apiClient.post('/finance', {
        accountId: customer.id,
        type: 'CHECK',
        direction: 'RECEIVABLE',
        amount: 125000.0,
        dueDate: '2026-06-30',
        referenceNumber: 'CK-90212',
        bankName: 'Garanti BBVA',
        notes: 'Müşteri çeki - Global Tekstil',
      });

      // Create Doc 2: SN-1104 (Collected)
      const res2 = await apiClient.post('/finance', {
        accountId: customer.id,
        type: 'BILL_OF_EXCHANGE',
        direction: 'RECEIVABLE',
        amount: 45000.0,
        dueDate: '2026-06-15',
        referenceNumber: 'SN-1104',
        bankName: 'Akbank',
        notes: 'Müşteri senedi - Modasente',
      });
      await apiClient.put(`/finance/${res2.data.id}`, {
        status: 'collected',
        collectedAt: new Date().toISOString(),
      });

      // Create Doc 3: CK-90215 (Endorsed)
      const res3 = await apiClient.post('/finance', {
        accountId: customer.id,
        type: 'CHECK',
        direction: 'RECEIVABLE',
        amount: 250000.0,
        dueDate: '2026-07-10',
        referenceNumber: 'CK-90215',
        bankName: 'İş Bankası',
        notes: 'Müşteri çeki - Global Tekstil (Ciro Edildi)',
      });
      await apiClient.put(`/finance/${res3.data.id}`, {
        status: 'endorsed',
      });

      // Create Doc 4: CK-90220 (Pending)
      await apiClient.post('/finance', {
        accountId: customer.id,
        type: 'CHECK',
        direction: 'RECEIVABLE',
        amount: 62900.0,
        dueDate: '2026-06-05',
        referenceNumber: 'CK-90220',
        bankName: 'Yapı Kredi',
        notes: 'Müşteri çeki - Modasente',
      });
    } catch (err) {
      console.error('Seeding financial transactions failed:', err);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/finance', { params: { limit: 1000 } });
      const mapped = response.data.data.map(mapBackendToFrontendDoc);
      setDocuments(mapped);
      return response.data.data.length;
    } catch (err) {
      console.error('Evraklar yüklenemedi:', err);
      return 0;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoadingCustomers(true);
      try {
        const response = await apiClient.get('/accounts', { params: { limit: 100 } });
        const filtered = response.data.data.filter(
          (acc: Account) => acc.type === 'CUSTOMER' || acc.type === 'BOTH'
        );
        setCustomers(filtered);

        // Fetch documents
        const count = await fetchDocuments();
        if (count === 0 && filtered.length > 0) {
          // Seed DB
          await seedDatabaseDocs(filtered[0], count);
          await fetchDocuments();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    initData();
  }, []);

  // Stats
  const pendingAmount = documents
    .filter((doc) => doc.status === 'PENDING')
    .reduce((sum, doc) => sum + doc.amount, 0);

  // Let's assume documents overdue are pending docs with due date earlier than today
  // Since mock data due dates are in 'dd.mm.yyyy', let's parsing helper
  const isOverdue = (dateStr: string) => {
    try {
      const [day, month, year] = dateStr.split('.').map(Number);
      const dueDateObj = new Date(year, month - 1, day);
      return dueDateObj < new Date() && year > 0;
    } catch {
      return false;
    }
  };

  const overdueAmount = documents
    .filter((doc) => doc.status === 'PENDING' && isOverdue(doc.dueDate))
    .reduce((sum, doc) => sum + doc.amount, 0);

  const endorsedAmount = documents
    .filter((doc) => doc.status === 'ENDORSED')
    .reduce((sum, doc) => sum + doc.amount, 0);

  const totalDocCount = documents.length;

  // Handlers
  const handleOpenCollect = (doc: FinancialDoc) => {
    setSelectedDoc(doc);
    setBankCommission(0.0);
    setCollectModalOpen(true);
  };

  const handleConfirmCollection = async () => {
    if (!selectedDoc) return;

    try {
      const response = await apiClient.patch(`/finance/${selectedDoc.id}/collect`);
      const updatedDoc = mapBackendToFrontendDoc(response.data);

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === selectedDoc.id ? updatedDoc : doc))
      );
      setCollectModalOpen(false);

      const netAmount = selectedDoc.amount * (1 - bankCommission / 100);
      setSuccessMessage(
        `Tahsilat başarıyla tamamlandı: ${selectedDoc.docNumber} (${selectedDoc.amount.toLocaleString(
          'tr-TR'
        )} ₺). Komisyon sonrası net tutar: ${netAmount.toLocaleString('tr-TR')} ₺`
      );

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert('Tahsilat kaydedilirken bir hata oluştu: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEndorseDoc = async (doc: FinancialDoc) => {
    if (!window.confirm(`"${doc.docNumber}" no'lu evrak ciro edilecek. Emin misiniz?`)) return;
    try {
      const response = await apiClient.patch(`/finance/${doc.id}/endorse`);
      const updatedDoc = mapBackendToFrontendDoc(response.data);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updatedDoc : d)));
      setSuccessMessage(`Evrak başarıyla ciro edildi: ${doc.docNumber}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert('Ciro işlemi sırasında hata oluştu: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteDoc = async (doc: FinancialDoc) => {
    if (!window.confirm(`"${doc.docNumber}" no'lu evrak silinecek. Bu işlem geri alınamaz!`)) return;
    try {
      await apiClient.delete(`/finance/${doc.id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setSuccessMessage(`Evrak silindi: ${doc.docNumber}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert('Silme işlemi sırasında hata oluştu: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocValues.accountId) {
      alert('Lütfen bir müşteri seçiniz.');
      return;
    }
    if (!newDocValues.docNumber || newDocValues.amount <= 0 || !newDocValues.dueDate) {
      alert('Lütfen form alanlarını doğru doldurunuz.');
      return;
    }

    try {
      const type = newDocValues.type === 'CHEQUE' ? 'CHECK' : 'BILL_OF_EXCHANGE';
      
      const response = await apiClient.post('/finance', {
        accountId: newDocValues.accountId,
        type,
        direction: 'RECEIVABLE',
        amount: newDocValues.amount,
        dueDate: newDocValues.dueDate,
        referenceNumber: newDocValues.docNumber,
      });

      const newDoc = mapBackendToFrontendDoc(response.data);
      setDocuments((prev) => [newDoc, ...prev]);
      setCreateModalOpen(false);

      // Reset Form
      setNewDocValues({
        accountId: '',
        docNumber: '',
        customerName: '',
        customerCode: '',
        type: 'CHEQUE',
        amount: 0,
        dueDate: '',
      });

      setSuccessMessage(`Yeni evrak girişi kaydedildi: ${newDoc.docNumber}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert('Yeni evrak kaydedilirken bir hata oluştu: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const cust = customers.find((c) => c.code === code);
    if (cust) {
      setNewDocValues((prev) => ({
        ...prev,
        accountId: cust.id,
        customerCode: cust.code,
        customerName: cust.name,
      }));
    }
  };

  // Filtering list
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.docNumber.toLowerCase().includes(search.toLowerCase()) ||
      doc.customerName.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'ALL' || doc.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

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
          <h3 className="text-ust-baslik-md font-ust-baslik-md font-bold">Finans (Çek/Senet) Yönetimi</h3>
          <p className="text-on-surface-variant text-govde-metin">Alınan ve verilen kıymetli evrakların takibi ve tahsilatı.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="bg-secondary text-on-secondary px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold shadow hover:brightness-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Yeni Evrak Girişi
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
          <span className="text-kucuk-not text-on-surface-variant font-semibold uppercase tracking-wider block">Bekleyen Tahsilatlar</span>
          <div className="text-alt-baslik font-bold mt-1.5 text-secondary">
            {pendingAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </div>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm border-r-4 border-r-hata-kirmizisi">
          <span className="text-kucuk-not text-on-surface-variant font-semibold uppercase tracking-wider block">Günü Geçenler</span>
          <div className="text-alt-baslik font-bold mt-1.5 text-hata-kirmizisi">
            {overdueAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </div>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm border-r-4 border-r-basari-yesili">
          <span className="text-kucuk-not text-on-surface-variant font-semibold uppercase tracking-wider block">Ciro Edilenler</span>
          <div className="text-alt-baslik font-bold mt-1.5 text-basari-yesili">
            {endorsedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </div>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
          <span className="text-kucuk-not text-on-surface-variant font-semibold uppercase tracking-wider block">Toplam Evrak</span>
          <div className="text-alt-baslik font-bold mt-1.5 text-on-surface">{totalDocCount} Adet</div>
        </div>
      </div>

      {/* FILTER SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === 'ALL' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Tüm Evraklar
          </button>
          <button
            onClick={() => setTypeFilter('CHEQUE')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === 'CHEQUE' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Çekler
          </button>
          <button
            onClick={() => setTypeFilter('BILL')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === 'BILL' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Senetler
          </button>

          <span className="h-6 w-[1px] bg-outline-variant my-auto mx-2 hidden md:inline"></span>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'ALL' ? 'bg-secondary/10 text-secondary' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Tüm Durumlar
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'PENDING' ? 'bg-uyari-kehribar/10 text-uyari-kehribar' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Beklemede
          </button>
          <button
            onClick={() => setStatusFilter('COLLECTED')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'COLLECTED' ? 'bg-basari-yesili/10 text-basari-yesili' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Tahsil Edildi
          </button>
          <button
            onClick={() => setStatusFilter('ENDORSED')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'ENDORSED' ? 'bg-on-primary-container/10 text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Ciro Edildi
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none text-govde-metin bg-arka-plan-gri/50"
            placeholder="Evrak no veya cari ara..."
            type="text"
          />
        </div>
      </div>

      {/* CHEQUE TABLE */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container text-on-surface-variant border-b border-outline-variant">
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase">Evrak No</th>
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase">Cari Hesap</th>
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase">Evrak Türü</th>
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase text-right">Tutar</th>
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase text-center">Vade</th>
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase text-center">Durum</th>
              <th className="px-4 py-4 text-kucuk-not font-bold uppercase text-center" style={{minWidth:'160px'}}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-tablo-verisi">
            {filteredDocs.length === 0 ? (
              <tr>
                <td className="py-12 text-center text-on-surface-variant italic" colSpan={7}>
                  {loading ? 'Evraklar yükleniyor...' : 'Listelenecek evrak bulunamadı.'}
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const overdue = doc.status === 'PENDING' && isOverdue(doc.dueDate);
                return (
                  <tr key={doc.id} className="hover:bg-arka-plan-gri/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-on-surface">{doc.docNumber}</td>
                    <td className="px-4 py-3.5 text-on-surface-variant">{doc.customerName}</td>
                    <td className="px-4 py-3.5">
                      {doc.type === 'CHEQUE' ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold">ÇEK</span>
                      ) : (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[11px] font-bold">SENET</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-on-surface">
                      {doc.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                    <td className={`px-4 py-3.5 text-center font-semibold ${overdue ? 'text-hata-kirmizisi' : 'text-on-surface-variant'}`}>
                      {doc.dueDate}
                      {overdue && <span className="block text-[10px] font-bold uppercase">GECİKMİŞ</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {doc.status === 'PENDING' && (
                        <span className="bg-uyari-kehribar/20 text-uyari-kehribar px-2.5 py-1 rounded-full text-[11px] font-bold uppercase">
                          Beklemede
                        </span>
                      )}
                      {doc.status === 'COLLECTED' && (
                        <span className="bg-basari-yesili/20 text-basari-yesili px-2.5 py-1 rounded-full text-[11px] font-bold uppercase">
                          Tahsil Edildi
                        </span>
                      )}
                      {doc.status === 'ENDORSED' && (
                        <span className="bg-on-primary-container/20 text-on-primary-container px-2.5 py-1 rounded-full text-[11px] font-bold uppercase">
                          Ciro Edildi
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {doc.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleOpenCollect(doc)}
                              title="Tahsil Et"
                              className="text-bilgi-mavisi hover:bg-blue-50 font-bold text-[11px] px-2 py-1 rounded border border-bilgi-mavisi/30 transition-colors"
                            >
                              Tahsil Et
                            </button>
                            <button
                              onClick={() => handleEndorseDoc(doc)}
                              title="Ciro Et"
                              className="text-purple-600 hover:bg-purple-50 font-bold text-[11px] px-2 py-1 rounded border border-purple-300 transition-colors"
                            >
                              Ciro Et
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteDoc(doc)}
                          title="Sil"
                          disabled={doc.status === 'COLLECTED'}
                          className="text-hata-kirmizisi hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* TAHSİLAT MODAL */}
      {collectModalOpen && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Tahsilat İşlemi</h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setCollectModalOpen(false)}
              >
                close
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-arka-plan-gri p-3.5 rounded-lg border border-outline-variant/60">
                <p className="text-xs text-on-surface-variant font-semibold">Seçilen Evrak</p>
                <p className="font-bold text-on-surface mt-1">
                  {selectedDoc.docNumber} ({selectedDoc.type === 'CHEQUE' ? 'Çek' : 'Senet'})
                </p>
                <p className="text-xl font-bold text-secondary mt-1">
                  {selectedDoc.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </p>
              </div>

              <div>
                <label className="text-kucuk-not font-semibold text-on-surface-variant block mb-1">Tahsilat Tarihi</label>
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2.5 text-govde-metin focus:ring-1 focus:ring-secondary outline-none"
                />
              </div>

              <div>
                <label className="text-kucuk-not font-semibold text-on-surface-variant block mb-1">
                  Banka Komisyonu (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={bankCommission}
                  onChange={(e) => setBankCommission(parseFloat(e.target.value) || 0.0)}
                  className="w-full bg-arka-plan-gri border border-outline-variant rounded-lg p-2.5 text-govde-metin focus:ring-1 focus:ring-secondary outline-none"
                />
                <p className="text-[11px] text-outline mt-1.5 italic">
                  Hesaba geçecek tahsilat tutarından komisyon düşülecektir.
                </p>
              </div>

              <div className="bg-basari-yesili/5 p-3.5 rounded-lg border border-basari-yesili/20 text-xs">
                <p className="text-basari-yesili font-bold uppercase mb-1">Muhasebe Etkisi</p>
                <p className="text-on-surface-variant">
                  Tahsilat sonrasında evrak durumu 'Tahsil Edildi' olarak güncellenecek ve banka komisyon gideri kaydedilecektir.
                </p>
              </div>

              <button
                onClick={handleConfirmCollection}
                className="w-full bg-basari-yesili text-white py-3 rounded-lg font-bold hover:brightness-95 active:scale-95 transition-all shadow uppercase mt-2"
              >
                TAHSİLATAYI KAYDET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ EVRAK GİRİŞİ MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold">Yeni Kıymetli Evrak Girişi</h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setCreateModalOpen(false)}
              >
                close
              </button>
            </div>
            
            <form onSubmit={handleCreateDoc} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Evrak No</label>
                  <input
                    required
                    value={newDocValues.docNumber}
                    onChange={(e) => setNewDocValues((p) => ({ ...p, docNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    placeholder="Örn: CK-90216"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Evrak Türü</label>
                  <select
                    value={newDocValues.type}
                    onChange={(e) =>
                      setNewDocValues((p) => ({ ...p, type: e.target.value as 'CHEQUE' | 'BILL' }))
                    }
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white font-govde-metin"
                  >
                    <option value="CHEQUE">Çek</option>
                    <option value="BILL">Senet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Cari Hesap (Seçim)</label>
                <select
                  required
                  onChange={handleSelectCustomer}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none bg-white"
                >
                  <option value="">Cari Hesap Seçiniz...</option>
                  {loadingCustomers ? (
                    <option disabled>Yükleniyor...</option>
                  ) : (
                    customers.map((cust) => (
                      <option key={cust.id} value={cust.code}>
                        {cust.code} - {cust.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Evrak Tutarı (₺)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={newDocValues.amount || ''}
                    onChange={(e) => setNewDocValues((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Vade Tarihi</label>
                  <input
                    required
                    type="date"
                    value={newDocValues.dueDate}
                    onChange={(e) => setNewDocValues((p) => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-5 py-2 bg-surface-container-high rounded font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-secondary text-on-secondary rounded font-semibold hover:brightness-105 shadow active:scale-95 transition-all"
                >
                  Evrağı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
