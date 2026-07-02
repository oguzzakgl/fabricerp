import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

interface CriticalStockItem {
  id: string;
  yarnType: string;
  lotNumber: string;
  color: string;
  currentKg: string;
}

interface UrgentPaymentItem {
  id: string;
  dueDate: string;
  type: string;
  direction: string;
  bankName: string;
  amount: string;
  status: string;
  account: {
    name: string;
    type: string;
  };
}

interface ChartItem {
  month: string;
  income: number;
  expense: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [cariCount, setCariCount] = useState(0);
  const [yarnTotalKg, setYarnTotalKg] = useState(0);
  const [pendingChequesAmount, setPendingChequesAmount] = useState(0);
  const [criticalStocks, setCriticalStocks] = useState<CriticalStockItem[]>([]);
  const [urgentPayments, setUrgentPayments] = useState<UrgentPaymentItem[]>([]);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (active) {
        setLoading(true);
      }
      try {
        const res = await apiClient.get('/dashboard/stats');
        if (active) {
          setCariCount(res.data.cariCount);
          setYarnTotalKg(res.data.yarnTotalKg);
          setPendingChequesAmount(res.data.pendingChequesAmount);
          setCriticalStocks(res.data.criticalStocks);
          setUrgentPayments(res.data.urgentPayments);
          setChartData(res.data.chartData);
          setTotalIncome(res.data.totalIncome || 0);
          setTotalExpense(res.data.totalExpense || 0);
          setTotalReceivable(res.data.totalReceivable || 0);
          setTotalPayable(res.data.totalPayable || 0);
        }
      } catch (err) {
        console.error('Dashboard istatistikleri yüklenemedi:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  // Report Export logic
  const handleExportReport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Özet Rapor;Değer\n';
    csvContent += `Toplam Cari Hesap;${cariCount} Cari\n`;
    csvContent += `Toplam İplik Envanteri;${yarnTotalKg.toFixed(2)} Kg\n`;
    csvContent += `Bekleyen Evrak Tutarı;₺${pendingChequesAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}\n`;
    csvContent += `Kritik Stok Kalemi Sayısı;${criticalStocks.length} Kalem\n\n`;

    csvContent += 'Son 6 Ay Gelir & Gider Analizi\n';
    csvContent += 'Ay;Gelir (₺);Gider (₺)\n';
    chartData.forEach((item) => {
      csvContent += `${item.month};${item.income.toFixed(2)};${item.expense.toFixed(2)}\n`;
    });

    csvContent += '\nKritik Stok Listesi\n';
    csvContent += 'İplik Cinsi;Lot No;Mevcut Kg\n';
    criticalStocks.forEach((item) => {
      csvContent += `${item.yarnType} (${item.color});${item.lotNumber};${Number(item.currentKg).toFixed(1)} kg\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Fabricore_Yonetici_Ozeti_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Find max value in chart data to scale the bar heights
  const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 1000);

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'CHECK': return 'Çek';
      case 'BILL_OF_EXCHANGE': return 'Senet';
      case 'CASH': return 'Nakit';
      case 'BANK_TRANSFER': return 'Banka Havalesi';
      default: return type;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'CUSTOMER': return 'Müşteri';
      case 'SUPPLIER': return 'Tedarikçi';
      case 'BOTH': return 'Alıcı/Satıcı';
      default: return type;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* DASHBOARD HEADER */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-ust-baslik-md font-ust-baslik-md text-on-surface font-bold">Üretim Dashboard</h2>
          <p className="text-govde-metin text-on-surface-variant">Hoş geldiniz, fabrikadaki son durum özetini aşağıda görebilirsiniz.</p>
        </div>
        <div className="flex flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => navigate('/fabrics?scan=true')}
            className="flex-1 sm:flex-none px-4 py-2 bg-secondary text-white text-govde-metin font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">photo_camera</span>
            Kamera / Galeri ile Etiket Okut
          </button>
          <button 
            onClick={handleExportReport}
            className="flex-1 sm:flex-none px-4 py-2 bg-surface-container-lowest border border-outline-variant text-govde-metin font-semibold rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Rapor Dışa Aktar
          </button>
          <button 
            onClick={() => navigate('/orders')}
            className="flex-1 sm:flex-none px-4 py-2 bg-bilgi-mavisi text-white text-govde-metin font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Yeni Sipariş
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS / OCR BANNER */}
      <div className="bg-gradient-to-r from-secondary/15 via-secondary/5 to-transparent border border-secondary/20 p-5 rounded-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary text-white rounded-xl shadow-lg shadow-secondary/25 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">photo_camera</span>
          </div>
          <div>
            <h3 className="text-on-surface font-bold text-[16px] md:text-lg">Kamera veya Galeri ile Akıllı Etiket Okuma (OCR)</h3>
            <p className="text-on-surface-variant text-xs md:text-sm mt-0.5">
              Kumaş toplarının etiketlerini kameranızla taratıp veya galeri resmi yükleyerek saniyeler içinde sisteme mevcut/yeni stok olarak kaydedin.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/fabrics?scan=true')}
          className="w-full md:w-auto px-5 py-3 bg-secondary hover:bg-secondary/95 active:scale-98 text-white font-bold rounded-lg shadow-md shadow-secondary/15 flex items-center justify-center gap-2 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">document_scanner</span>
          Hemen Tara ve Stok Ekle
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-kenar-payi mb-kenar-payi">
        {/* Total Cari Accounts */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-bilgi-mavisi/10 text-bilgi-mavisi rounded-lg">
              <span className="material-symbols-outlined">group</span>
            </div>
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Toplam Cari Hesap</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">{cariCount} Cari</h3>
        </div>

        {/* Total Yarn Stock */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-basari-yesili/10 text-basari-yesili rounded-lg">
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Toplam İplik Envanteri</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">{yarnTotalKg.toFixed(2)} Kg</h3>
        </div>

        {/* Pending Cheques */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-uyari-kehribar/10 text-uyari-kehribar rounded-lg">
              <span className="material-symbols-outlined">payments</span>
            </div>
            {urgentPayments.length > 0 && (
              <span className="text-uyari-kehribar text-kucuk-not font-semibold">{urgentPayments.length} Bekleyen</span>
            )}
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Bekleyen Çek/Senet Tutarı</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">
            ₺{pendingChequesAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </div>

        {/* Critical Stock Count */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-hata-kirmizisi/10 text-hata-kirmizisi rounded-lg">
              <span className="material-symbols-outlined">warning</span>
            </div>
            {criticalStocks.length > 0 && (
              <span className="text-hata-kirmizisi text-kucuk-not font-semibold">{criticalStocks.length} Kritik</span>
            )}
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Kritik Stok Kalemi</p>
          <h3 className="text-ust-baslik-md font-bold mt-1">
            {criticalStocks.length > 0 ? `${criticalStocks.length} Ürün Azalıyor` : 'Stoklar Normal'}
          </h3>
        </div>
      </div>

      {/* GELİR / GİDER / ALACAK / VERECEK CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-kenar-payi mb-kenar-payi">
        {/* Toplam Gelir */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-basari-yesili/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-basari-yesili/10 text-basari-yesili rounded-lg">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
            <span className="text-basari-yesili text-kucuk-not font-semibold">Gelir</span>
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Toplam Gelir</p>
          <h3 className="text-ust-baslik-md font-bold mt-1 text-basari-yesili">
            ₺{totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-kucuk-not text-on-surface-variant mt-1">Tüm faturalar toplamı</p>
        </div>

        {/* Toplam Gider */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-hata-kirmizisi/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-hata-kirmizisi/10 text-hata-kirmizisi rounded-lg">
              <span className="material-symbols-outlined">trending_down</span>
            </div>
            <span className="text-hata-kirmizisi text-kucuk-not font-semibold">Gider</span>
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Toplam Gider</p>
          <h3 className="text-ust-baslik-md font-bold mt-1 text-hata-kirmizisi">
            ₺{totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-kucuk-not text-on-surface-variant mt-1">Tüm iplik alımları toplamı</p>
        </div>

        {/* Toplam Alacak */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-bilgi-mavisi/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-bilgi-mavisi/10 text-bilgi-mavisi rounded-lg">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <span className="text-bilgi-mavisi text-kucuk-not font-semibold">Alacak</span>
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Toplam Alacak</p>
          <h3 className="text-ust-baslik-md font-bold mt-1 text-bilgi-mavisi">
            ₺{totalReceivable.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-kucuk-not text-on-surface-variant mt-1">Müşterilerden tahsil edilecek</p>
        </div>

        {/* Toplam Verecek */}
        <div className="bg-surface-container-lowest p-standart-padding rounded-lg border border-uyari-kehribar/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-uyari-kehribar/10 text-uyari-kehribar rounded-lg">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="text-uyari-kehribar text-kucuk-not font-semibold">Verecek</span>
          </div>
          <p className="text-on-surface-variant text-kucuk-not font-medium">Toplam Verecek</p>
          <h3 className="text-ust-baslik-md font-bold mt-1 text-uyari-kehribar">
            ₺{totalPayable.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-kucuk-not text-on-surface-variant mt-1">Tedarikçilere ödenecek</p>
        </div>
      </div>

      {/* BENTO GRID CONTENT */}
      <div className="grid grid-cols-12 gap-kenar-payi mb-6">
        {/* INCOME/EXPENSE CHART (65%) */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-4 sm:p-kenar-payi rounded-lg border border-outline-variant shadow-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
            <h4 className="text-alt-baslik font-alt-baslik text-on-surface font-bold">Gelir & Gider Analizi (Son 6 Ay)</h4>
            <span className="self-start sm:self-auto text-kucuk-not text-on-surface-variant bg-surface-container-low px-3 py-1 rounded border border-outline-variant">
              Anlık Finansal Grafik
            </span>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="h-64 flex items-end justify-between gap-4 px-4 border-b border-outline-variant pb-2 min-w-[500px] lg:min-w-0">
              {chartData.length === 0 ? (
                <div className="w-full text-center text-on-surface-variant py-8">Grafik verisi bulunmamaktadır.</div>
              ) : (
                chartData.map((bar, i) => {
                  const incHeight = `${(bar.income / maxVal) * 100}%`;
                  const expHeight = `${(bar.expense / maxVal) * 100}%`;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <div className="w-full flex gap-1.5 items-end h-full relative">
                        <div 
                          title={`Gelir: ₺${bar.income.toFixed(2)}`} 
                          className="flex-1 bg-bilgi-mavisi/80 rounded-t-sm hover:bg-bilgi-mavisi transition-all cursor-pointer min-h-[4px]" 
                          style={{ height: incHeight }}
                        ></div>
                        <div 
                          title={`Gider: ₺${bar.expense.toFixed(2)}`} 
                          className="flex-1 bg-hata-kirmizisi/80 rounded-t-sm hover:bg-hata-kirmizisi transition-all cursor-pointer min-h-[4px]" 
                          style={{ height: expHeight }}
                        ></div>
                      </div>
                      <span className="text-kucuk-not text-on-surface-variant font-semibold mt-1">{bar.month}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-bilgi-mavisi rounded-full"></div>
              <span className="text-kucuk-not font-semibold text-on-surface">Satış Geliri (Faturalar)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-hata-kirmizisi rounded-full"></div>
              <span className="text-kucuk-not font-semibold text-on-surface">Hammadde Alımı (İplik Girişleri)</span>
            </div>
          </div>
        </div>

        {/* CRITICAL STOCK LIST (35%) */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest p-4 sm:p-kenar-payi rounded-lg border border-outline-variant shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-alt-baslik font-alt-baslik text-on-surface font-bold">Kritik Stoklar (&lt; 100kg)</h4>
            <button className="text-bilgi-mavisi text-kucuk-not font-semibold hover:underline" onClick={() => navigate('/yarn-stocks')}>Tümünü Gör</button>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="py-8 text-center text-on-surface-variant">Yükleniyor...</div>
            ) : criticalStocks.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant">Kritik düzeyde azalan stok bulunmamaktadır.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-kucuk-not text-on-surface-variant border-b border-outline-variant">
                    <th className="py-2 font-semibold">İplik Cinsi</th>
                    <th className="py-2 font-semibold text-right">Mevcut</th>
                  </tr>
                </thead>
                <tbody className="text-tablo-verisi">
                  {criticalStocks.map((item) => (
                    <tr 
                      key={item.id} 
                      className="border-b border-outline-variant/35 hover:bg-arka-plan-gri/50 cursor-pointer"
                      onClick={() => navigate('/yarn-stocks')}
                    >
                      <td className="py-3">
                        <p className="font-semibold text-on-surface">{item.yarnType} ({item.color})</p>
                        <p className="text-xs text-on-surface-variant">Lot: {item.lotNumber}</p>
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-1 bg-hata-kirmizisi/10 text-hata-kirmizisi rounded font-bold">
                          {Number(item.currentKg).toFixed(1)} kg
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ALERTS TABLE: URGENT CHEQUES */}
      <div className="col-span-12 bg-surface-container-lowest p-4 sm:p-kenar-payi rounded-lg border border-outline-variant shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-uyari-kehribar/10 flex items-center justify-center text-uyari-kehribar">
              <span className="material-symbols-outlined">alarm</span>
            </div>
            <div>
              <h4 className="text-alt-baslik font-alt-baslik text-on-surface font-bold">Vadesi Yaklaşan Ödemeler / Tahsilatlar</h4>
              <p className="text-kucuk-not text-on-surface-variant">Tahsil edilmesi veya ödenmesi gereken finansal evraklar.</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-on-surface-variant">Yükleniyor...</div>
          ) : urgentPayments.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant">Vadesi yaklaşan bekleyen işlem bulunmamaktadır.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-kucuk-not text-on-surface-variant border-b border-outline-variant uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Vade Tarihi</th>
                  <th className="py-3 px-4 font-semibold">Cari Hesap</th>
                  <th className="py-3 px-4 font-semibold">İşlem Tipi</th>
                  <th className="py-3 px-4 font-semibold">Yönü</th>
                  <th className="py-3 px-4 font-semibold">Banka</th>
                  <th className="py-3 px-4 font-semibold">Tutar</th>
                  <th className="py-3 px-4 font-semibold text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="text-tablo-verisi font-tablo-verisi">
                {urgentPayments.map((payment) => (
                  <tr 
                    key={payment.id}
                    className="border-b border-outline-variant/35 hover:bg-arka-plan-gri/50 cursor-pointer" 
                    onClick={() => navigate('/finance')}
                  >
                    <td className="py-4 px-4 font-etiket-mono">{formatDate(payment.dueDate)}</td>
                    <td className="py-4 px-4">
                      <p className="font-semibold text-on-surface">{payment.account.name}</p>
                      <p className="text-xs text-on-surface-variant">{getAccountTypeLabel(payment.account.type)}</p>
                    </td>
                    <td className="py-4 px-4">{getPaymentTypeLabel(payment.type)}</td>
                    <td className="py-4 px-4 font-semibold">
                      {payment.direction === 'RECEIVABLE' ? (
                        <span className="text-basari-yesili">Alacak</span>
                      ) : (
                        <span className="text-hata-kirmizisi">Borç</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-on-surface-variant">{payment.bankName || '-'}</td>
                    <td className="py-4 px-4 font-bold">
                      ₺{Number(payment.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="px-3 py-1 bg-uyari-kehribar text-white rounded-full text-[11px] font-bold">BEKLEYEN</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FOOTER / SYSTEM STATUS */}
      <footer className="mt-kenar-payi flex justify-between items-center text-kucuk-not text-on-surface-variant opacity-60">
        <p>© 2026 Tekstil ERP v2.4.1 - Tüm hakları saklıdır.</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-basari-yesili"></span> Sistem Çevrimiçi
          </span>
          <span>Son Senkronizasyon: Yeni</span>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
