import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

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

const Fabrics: React.FC = () => {
  const [rolls, setRolls] = useState<any[]>([]);
  const [yarnStocks, setYarnStocks] = useState<YarnOption[]>([]);
  const [loading, setLoading] = useState(false);

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

  const fetchRolls = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/rolls', { params: { limit: 1000 } });
      setRolls(response.data.data);
    } catch (error) {
      console.error('Kumaş topları yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchYarns = async () => {
    try {
      const res = await apiClient.get('/yarn-stocks', { params: { limit: 100 } });
      const list = res.data.data.map((item: any) => ({
        id: item.id,
        yarnType: item.yarnType,
        lotNumber: item.lotNumber,
        unitPrice: item.unitPrice,
      }));
      setYarnStocks(list);
    } catch (error) {
      console.error('İplik stokları yüklenemedi:', error);
    }
  };

  useEffect(() => {
    fetchRolls();
    fetchYarns();
  }, []);

  // Group rolls by fabricType
  const groupRolls = (rollsList: any[]): GroupedFabric[] => {
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

      const color = roll.color || 'Bilinmeyen';
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

  // Generate unique barcode on client side
  const generateBarcode = () => {
    return `BAR-KM-${Math.floor(100000 + Math.random() * 900000)}`;
  };

  // Yeni Kumaş Girişi: Renk Ekleme
  const handleAddColorToInput = () => {
    if (!newColorName.trim()) {
      alert('Lütfen bir renk ismi giriniz.');
      return;
    }
    if (colorsInput.some(c => c.colorName.toLowerCase() === newColorName.toLowerCase())) {
      alert('Bu renk zaten listeye eklendi.');
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
      alert('Lütfen kumaş adını giriniz.');
      return;
    }
    if (colorsInput.length === 0) {
      alert('Lütfen en az bir renk ve top ekleyiniz.');
      return;
    }
    if (hasRecipeInput && (!atkiYarnId || !cozguYarnId)) {
      alert('Lütfen maliyet hesabı için Atkı ve Çözgü ipliklerini seçiniz.');
      return;
    }

    setLoading(true);
    try {
      const notesObj = { pricePerMeter };
      const notesStr = JSON.stringify(notesObj);

      // Collect all rolls to create
      const rollsToCreate: any[] = [];
      colorsInput.forEach((colorObj) => {
        colorObj.rolls.forEach((rollObj) => {
          const grammage = calculateGrammage(rollObj.lengthM, rollObj.netWeightKg);
          const rollPayload: any = {
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
      alert('Tüm kumaş topları başarıyla sisteme kaydedildi.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Kumaş giriş hatası. Lütfen iplik stoklarınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Roll
  const handleDeleteRoll = async (id: string) => {
    if (!window.confirm('Bu kumaş topunu silmek istediğinizden emin misiniz?')) return;
    setLoading(true);
    try {
      await apiClient.delete(`/rolls/${id}`);
      fetchRolls();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Top silinemedi.');
    } finally {
      setLoading(false);
    }
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
      const rollsToUpdate: any[] = [];
      Object.values(selectedFabricForPriceEdit.colors).forEach((col: any) => {
        col.rolls.forEach((r: any) => {
          rollsToUpdate.push(r);
        });
      });

      await Promise.all(
        rollsToUpdate.map((roll) => {
          let parsedNotes: any = {};
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
    const existingRolls: any[] = [];
    Object.values(fabric.colors).forEach((col: any) => {
      col.rolls.forEach((r: any) => {
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
    const existingRolls: any[] = [];
    Object.values(selectedFabricForRollAdd.colors).forEach((col: any) => {
      col.rolls.forEach((r: any) => {
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

      const payload: any = {
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
    } catch (err: any) {
      alert(err.response?.data?.message || 'Top eklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Action Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-ust-baslik-md font-bold text-on-surface">Kumaş Envanter Yönetimi</h2>
          <p className="text-govde-metin text-on-surface-variant">Top stoklarını kumaş cinslerine ve renklere göre takip edin.</p>
        </div>
        <button 
          onClick={() => {
            setColorsInput([]);
            setFabricName('');
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-bilgi-mavisi text-white rounded font-alt-baslik hover:opacity-90 transition-all shadow-sm font-semibold active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Yeni Kumaş Girişi</span>
        </button>
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
                  className={`p-4 flex items-center justify-between flex-wrap gap-4 cursor-pointer hover:bg-surface-container-low transition-colors select-none ${
                    isExpanded ? 'bg-surface-container-low border-b border-outline-variant' : ''
                  }`}
                  onClick={() => setExpandedFabric(isExpanded ? null : fabric.fabricType)}
                >
                  <div className="flex items-center gap-6">
                    <span className="px-2.5 py-1 bg-bilgi-mavisi/10 text-bilgi-mavisi rounded font-bold text-xs font-etiket-mono border border-bilgi-mavisi/20">
                      {fabric.code}
                    </span>
                    <div>
                      <h4 className="font-bold text-base text-on-surface">{fabric.fabricType}</h4>
                      <p className="text-xs text-on-surface-variant">Kumaş Türü</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-10">
                    <div className="text-center min-w-[70px]">
                      <span className="block font-bold text-on-surface text-sm">{fabric.colorCount}</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Renk</span>
                    </div>
                    <div className="text-center min-w-[90px]">
                      <span className="block font-bold text-on-surface text-sm">{fabric.totalRolls} Top</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Top</span>
                    </div>
                    <div className="text-center min-w-[100px]">
                      <span className="block font-bold text-on-surface text-sm text-basari-yesili">{fabric.totalLength.toFixed(1)} m</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Toplam Metraj</span>
                    </div>
                    <div className="text-center min-w-[120px]">
                      <span className="block font-bold text-on-surface text-sm text-bilgi-mavisi">₺{fabric.pricePerMeter} / m</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Metre Fiyatı</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => handleOpenPriceEdit(fabric, e)}
                        className="text-xs font-bold bg-secondary/15 hover:bg-secondary/25 px-2.5 py-1 rounded text-on-surface transition-all border border-outline-variant"
                      >
                        Fiyat Düzenle
                      </button>
                      <button className="text-on-surface-variant hover:text-on-surface">
                        <span className={`material-symbols-outlined transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          keyboard_arrow_down
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Side-by-Side Colors Cards */}
                {isExpanded && (
                  <div className="p-4 bg-arka-plan-gri/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-outline-variant/40">
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
              <div className="grid grid-cols-2 gap-6">
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
              <div className="grid grid-cols-2 gap-6">
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
                  <div className="grid grid-cols-2 gap-6">
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
    </div>
  );
};

export default Fabrics;
