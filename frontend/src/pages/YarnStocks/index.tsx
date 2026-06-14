import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';

interface Account {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface YarnStock {
  id: string;
  supplierId: string;
  supplier: Account;
  yarnType: string;
  neNumber?: string;
  color: string;
  colorCode?: string;
  lotNumber: string;
  initialKg: string;
  currentKg: string;
  unitPrice: string;
  createdAt: string;
}

const YarnStocks: React.FC = () => {
  const [data, setData] = useState<YarnStock[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalKg: 0,
    activeLots: 0,
    totalValueUsd: 0,
    criticalCount: 0,
  });

  // Modal states
  const [yarnModalOpen, setYarnModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Account[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Form values
  const [formValues, setFormValues] = useState({
    lotNumber: '',
    yarnType: 'Pamuk %100',
    neNumber: '',
    supplierId: '',
    supplierName: '',
    color: '',
    colorCode: '#ffffff',
    initialKg: 0,
    unitPrice: 0,
  });

  const fetchYarnStocks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/yarn-stocks', {
        params: {
          page,
          limit,
          search: search || undefined,
        },
      });
      setData(response.data.data);
      setTotal(response.data.total);

      // Fetch all stocks for statistics calculations
      const allRes = await apiClient.get('/yarn-stocks', { params: { limit: 1000 } });
      const list = allRes.data.data;
      const totalKg = list.reduce((sum: number, item: any) => sum + Number(item.currentKg), 0);
      const activeLots = list.filter((item: any) => Number(item.currentKg) > 0).length;
      const totalValueUsd = list.reduce((sum: number, item: any) => sum + (Number(item.currentKg) * Number(item.unitPrice)), 0);
      const criticalCount = list.filter((item: any) => Number(item.currentKg) > 0 && Number(item.currentKg) <= 100).length;
      setStats({ totalKg, activeLots, totalValueUsd, criticalCount });

    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await apiClient.get('/accounts', { params: { limit: 100 } });
      const filtered = response.data.data.filter(
        (acc: Account) => acc.type === 'SUPPLIER' || acc.type === 'BOTH'
      );
      setSuppliers(filtered);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    fetchYarnStocks();
  }, [fetchYarnStocks]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleOpenCreate = () => {
    setFormValues({
      lotNumber: '',
      yarnType: 'Pamuk %100',
      neNumber: '',
      supplierId: '',
      supplierName: '',
      color: '',
      colorCode: '#ffffff',
      initialKg: 0,
      unitPrice: 0,
    });
    setYarnModalOpen(true);
  };

  const handleOpenSuppliers = () => {
    fetchSuppliers();
    setSupplierModalOpen(true);
  };

  const handleSelectSupplier = (supplier: Account) => {
    setFormValues((prev) => ({
      ...prev,
      supplierId: supplier.id,
      supplierName: `${supplier.code} - ${supplier.name}`,
    }));
    setSupplierModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: name === 'initialKg' || name === 'unitPrice' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.supplierId) {
      alert('Lütfen tedarikçi seçiniz.');
      return;
    }
    try {
      await apiClient.post('/yarn-stocks', {
        supplierId: formValues.supplierId,
        yarnType: formValues.yarnType,
        neNumber: formValues.neNumber || undefined,
        color: formValues.color,
        colorCode: formValues.colorCode || undefined,
        lotNumber: formValues.lotNumber,
        initialKg: formValues.initialKg,
        unitPrice: formValues.unitPrice,
      });
      setYarnModalOpen(false);
      fetchYarnStocks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'İplik girişi sırasında bir hata oluştu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-ust-baslik-md font-ust-baslik-md text-on-surface">İplik Envanteri</h2>
          <p className="text-govde-metin text-on-surface-variant">Ham madde stok takibi ve lot yönetimi</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="bg-bilgi-mavisi text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-secondary transition-all font-semibold shadow-md active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          Yeni İplik Girişi
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <p className="text-kucuk-not text-on-surface-variant uppercase font-semibold">Toplam İplik (KG)</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">{stats.totalKg.toLocaleString('tr-TR')} kg</h3>
          <p className="text-on-surface-variant text-kucuk-not mt-2">Mevcut net ham madde</p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <p className="text-kucuk-not text-on-surface-variant uppercase font-semibold">Aktif Lot Sayısı</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">{stats.activeLots} Lot</h3>
          <p className="text-on-surface-variant text-kucuk-not mt-2">Stokta varlığı olan lotlar</p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <p className="text-kucuk-not text-on-surface-variant uppercase font-semibold">Stok Değeri (USD)</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">${stats.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <p className="text-on-surface-variant text-kucuk-not mt-2">Güncel kur maliyeti</p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm border-r-4 border-r-hata-kirmizisi">
          <p className="text-kucuk-not text-on-surface-variant uppercase font-semibold">Kritik Stok</p>
          <h3 className="text-hata-kirmizisi text-ust-baslik-md font-bold mt-1">{stats.criticalCount} Lot</h3>
          <p className="text-on-surface-variant text-kucuk-not mt-2">&lt;= 100 kg iplikler</p>
        </div>
      </div>

      {/* FILTER SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm flex items-center justify-between">
        <div className="relative w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50">search</span>
          <input 
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded focus:ring-1 focus:ring-bilgi-mavisi outline-none text-govde-metin" 
            placeholder="Lot no, iplik tipi veya renk ara..." 
            type="text"
          />
        </div>
      </div>

      {/* YARN TABLE */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-on-surface-variant font-medium">Yükleniyor...</div>
          ) : data.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant">Hiç iplik kaydı bulunamadı.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant">
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">LOT NO</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">TİP</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">NE NO</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">RENK</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">TEDARİKÇİ</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">GİRİŞ KG</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">KALAN KG</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">BİRİM FİYAT</th>
                  <th className="px-4 py-3 text-kucuk-not font-semibold text-on-surface-variant">DURUM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.map((record) => {
                  const remaining = Number(record.currentKg);
                  const isCritical = remaining > 0 && remaining <= 100;
                  return (
                    <tr key={record.id} className="hover:bg-arka-plan-gri transition-colors">
                      <td className="px-4 py-3 text-tablo-verisi font-etiket-mono font-bold text-bilgi-mavisi">{record.lotNumber}</td>
                      <td className="px-4 py-3 text-tablo-verisi">{record.yarnType}</td>
                      <td className="px-4 py-3 text-tablo-verisi">{record.neNumber || '-'}</td>
                      <td className="px-4 py-3 text-tablo-verisi">
                        <span className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full border border-outline" 
                            style={{ backgroundColor: record.colorCode || '#ffffff' }}
                          ></span> 
                          {record.color}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-tablo-verisi">{record.supplier?.name}</td>
                      <td className="px-4 py-3 text-tablo-verisi">{Number(record.initialKg).toFixed(1)} kg</td>
                      <td className={`px-4 py-3 text-tablo-verisi font-bold ${isCritical ? 'text-hata-kirmizisi animate-pulse' : remaining > 0 ? 'text-basari-yesili' : 'text-on-surface-variant'}`}>
                        {remaining.toFixed(1)} kg
                      </td>
                      <td className="px-4 py-3 text-tablo-verisi">${Number(record.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-3 text-tablo-verisi">
                        {remaining > 0 ? (
                          <span className="px-2 py-0.5 bg-green-50 text-basari-yesili rounded border border-green-200 text-xs font-bold">STOKTA</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-50 text-hata-kirmizisi rounded border border-red-200 text-xs font-bold">TÜKENDİ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="p-standart-padding border-t border-outline-variant flex justify-between items-center text-kucuk-not bg-white">
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

      {/* MODAL: NEW YARN ENTRY */}
      {yarnModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="bg-surface-container px-kenar-payi py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-alt-baslik font-alt-baslik font-bold">Yeni İplik Girişi</h3>
              <button className="material-symbols-outlined text-on-surface-variant hover:text-hata-kirmizisi transition-colors" onClick={() => setYarnModalOpen(false)}>close</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-kenar-payi grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Lot Numarası</label>
                <input 
                  required
                  name="lotNumber"
                  value={formValues.lotNumber}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none" 
                  placeholder="Örn: L-2026-00X" 
                  type="text"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">İplik Tipi</label>
                <select 
                  name="yarnType"
                  value={formValues.yarnType}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant bg-white rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none"
                >
                  <option value="Pamuk %100">Pamuk %100</option>
                  <option value="Polyester">Polyester</option>
                  <option value="Viskon">Viskon</option>
                  <option value="Akrilik">Akrilik</option>
                  <option value="Keten">Keten</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Ne Numarası (Kalınlık)</label>
                <input 
                  name="neNumber"
                  value={formValues.neNumber}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none" 
                  placeholder="30/1, 20/2 vs." 
                  type="text"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Tedarikçi Seçimi</label>
                <div className="flex gap-2">
                  <input 
                    required
                    readOnly
                    id="selected-supplier-name"
                    value={formValues.supplierName}
                    className="flex-1 bg-arka-plan-gri border border-outline-variant rounded p-2 text-govde-metin outline-none" 
                    placeholder="Tedarikçi Seçin" 
                    type="text"
                  />
                  <button 
                    type="button"
                    onClick={handleOpenSuppliers}
                    className="bg-surface-container border border-outline-variant px-3 rounded hover:bg-surface-variant"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </button>
                </div>
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Renk Adı</label>
                <input 
                  required
                  name="color"
                  value={formValues.color}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none" 
                  placeholder="Örn: Siyah, Ekru" 
                  type="text"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Renk Kodu (Hex)</label>
                <input 
                  name="colorCode"
                  value={formValues.colorCode}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none" 
                  placeholder="Örn: #000000" 
                  type="text"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Giriş KG</label>
                <input 
                  required
                  name="initialKg"
                  value={formValues.initialKg || ''}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none" 
                  placeholder="0.00" 
                  type="number" 
                  step="0.01"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-kucuk-not font-semibold text-on-surface-variant mb-1">Birim Fiyat ($/Kg)</label>
                <input 
                  required
                  name="unitPrice"
                  value={formValues.unitPrice || ''}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded p-2 text-govde-metin focus:border-bilgi-mavisi outline-none" 
                  placeholder="0.00" 
                  type="number" 
                  step="0.01"
                />
              </div>

              <div className="col-span-2 bg-arka-plan-gri px-kenar-payi py-4 flex justify-end gap-3 -mx-kenar-payi -mb-kenar-payi mt-4">
                <button 
                  type="button"
                  className="px-4 py-2 text-govde-metin font-semibold hover:bg-surface-variant rounded" 
                  onClick={() => setYarnModalOpen(false)}
                >
                  Vazgeç
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-bilgi-mavisi text-white font-semibold rounded shadow hover:bg-secondary"
                >
                  Stoka Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: SUPPLIER SELECTION */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="bg-surface-container px-kenar-payi py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-alt-baslik font-alt-baslik font-bold">Tedarikçi Listesi</h3>
              <button className="material-symbols-outlined text-on-surface-variant hover:text-hata-kirmizisi" onClick={() => setSupplierModalOpen(false)}>close</button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingSuppliers ? (
                <div className="py-4 text-center text-on-surface-variant">Tedarikçiler yükleniyor...</div>
              ) : suppliers.length === 0 ? (
                <div className="py-4 text-center text-on-surface-variant">Tedarikçi tipinde kayıtlı cari hesap bulunamadı.</div>
              ) : (
                <div className="space-y-2">
                  {suppliers.map((sup) => (
                    <button 
                      key={sup.id}
                      type="button"
                      className="w-full text-left p-3 hover:bg-arka-plan-gri rounded-lg border border-transparent hover:border-outline-variant transition-all flex justify-between items-center group" 
                      onClick={() => handleSelectSupplier(sup)}
                    >
                      <span className="text-govde-metin font-semibold">{sup.code} - {sup.name}</span>
                      <span className="material-symbols-outlined text-bilgi-mavisi opacity-0 group-hover:opacity-100">check_circle</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YarnStocks;
