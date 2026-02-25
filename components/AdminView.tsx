
import React, { useState, useEffect } from 'react';
import { StandardDocument, DealershipBrand, Appraiser, Technician } from '../types';
import {
  saveStandard,
  getStandards,
  saveBrand,
  getBrand,
  getAppraisers,
  saveAppraiser,
  deleteAppraiser,
  getTechnicians,
  saveTechnician,
  deleteTechnician,
  getDatabaseHealth,
  syncLocalToCloud
} from '../services/storageService';
import { digestStandardDocument } from '../services/geminiService';

const AdminView: React.FC = () => {
  const [standards, setStandards] = useState<StandardDocument[]>([]);
  const [currentBrand, setCurrentBrand] = useState<DealershipBrand>('Honda');
  const [appraisers, setAppraisers] = useState<Appraiser[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [dbHealth, setDbHealth] = useState({ isHealthy: true, totalRecords: 0, kbUsed: 0, lastCommit: Date.now(), isLocal: true });
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPaidKey, setHasPaidKey] = useState(false);

  // Form states
  const [newAppName, setNewAppName] = useState('');
  const [newTechName, setNewTechName] = useState('');
  const [newTechNum, setNewTechNum] = useState('');

  const refreshData = async () => {
    try {
      const [s, b, a, t, h] = await Promise.all([
        getStandards(),
        getBrand(),
        getAppraisers(),
        getTechnicians(),
        getDatabaseHealth()
      ]);
      setStandards(s);
      setCurrentBrand(b);
      setAppraisers(a);
      setTechnicians(t);
      setDbHealth(h);
    } catch (error) {
      console.error("Error refreshing admin data:", error);
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(selected);
      }
    };
    checkKey();
    refreshData();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasPaidKey(true);
    }
  };

  const handleBrandChange = async (brand: DealershipBrand) => {
    setCurrentBrand(brand);
    await saveBrand(brand);
    const health = await getDatabaseHealth();
    setDbHealth(health);
  };

  const handleAddAppraiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;
    const app: Appraiser = { id: crypto.randomUUID(), name: newAppName.trim() };
    await saveAppraiser(app);
    const updated = await getAppraisers();
    setAppraisers(updated);
    setNewAppName('');
    const health = await getDatabaseHealth();
    setDbHealth(health);
  };

  const handleRemoveAppraiser = async (id: string) => {
    await deleteAppraiser(id);
    const updated = await getAppraisers();
    setAppraisers(updated);
    const health = await getDatabaseHealth();
    setDbHealth(health);
  };

  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechName.trim() || !newTechNum.trim()) return;
    const tech: Technician = {
      id: crypto.randomUUID(),
      name: newTechName.trim(),
      techNumber: newTechNum.trim()
    };
    await saveTechnician(tech);
    const updated = await getTechnicians();
    setTechnicians(updated);
    setNewTechName('');
    setNewTechNum('');
    const health = await getDatabaseHealth();
    setDbHealth(health);
  };

  const handleRemoveTechnician = async (id: string) => {
    await deleteTechnician(id);
    const updated = await getTechnicians();
    setTechnicians(updated);
    const health = await getDatabaseHealth();
    setDbHealth(health);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: StandardDocument['type'], label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        console.log(`Starting digestion for ${type}...`);
        const extractedRules = await digestStandardDocument(base64, type);

        if (!extractedRules || extractedRules.length < 10) {
          throw new Error("The AI was unable to extract meaningful rules from this document. Please ensure it's a clear, text-based PDF.");
        }

        const newDoc: StandardDocument = {
          id: crypto.randomUUID(),
          type,
          fileName: file.name,
          uploadDate: Date.now(),
          extractedRules
        };

        console.log("Saving standard with payload:", newDoc);
        await saveStandard(newDoc);
        const updated = await getStandards();
        console.log(`Updated standards list from DB:`, updated);
        setStandards(updated);
        console.log(`Successfully saved ${type} standard.`);
        alert(`${label} processed and stored as a source of truth.`);
      } catch (err: any) {
        console.error("Standard Upload Error:", err);
        alert(`UPLOAD FAILED (v2.1): ${err.message || "Unknown error"}. IMPORTANT: If this persists after running the SQL fix, please perform a HARD REFRESH (Ctrl + F5 or Cmd + Shift + R).`);
      } finally {
        setIsProcessing(false);
        const health = await getDatabaseHealth();
        setDbHealth(health);
        // Clear input
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      alert("Error reading file. Please try again.");
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const getCPOLabel = () => {
    switch (currentBrand) {
      case 'Honda': return 'HCUV Manual (Honda)';
      case 'Toyota': return 'TCUV Manual (Toyota)';
      case 'CBG': return 'GM Certified Manual (CBG)';
      case 'Cadillac': return 'Cadillac Certified Manual';
      case 'Ford': return 'Blue/Gold Advantage Manual';
      default: return `${currentBrand} CPO Manual`;
    }
  };

  const libraryItems = [
    { key: 'SAFETY', label: 'Ontario Safety Std', icon: 'fa-gavel', color: 'indigo' },
    { key: 'HCUV', label: getCPOLabel(), icon: 'fa-check-circle', color: 'emerald' },
    { key: 'HONDA_MAINTENANCE', label: `${currentBrand} Service Sched (CA)`, icon: 'fa-calendar-alt', color: 'red' },
    { key: 'DEALERSHIP', label: 'Dealer Recon Policy', icon: 'fa-building', color: 'blue' }
  ];

  const brands: DealershipBrand[] = ['Honda', 'Toyota', 'CBG', 'Cadillac', 'Ford', 'Hyundai', 'Nissan', 'Other'];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <i className="fas fa-shield-alt text-9xl"></i>
        </div>
        <div className="relative z-10 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Ground Truth Library (v2.1)</h2>
            <p className="text-slate-400 text-sm font-medium mt-2">Set your dealership identity and train the AI on specific brand rules.</p>
          </div>
          <div className="hidden md:flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase text-emerald-400">
                {dbHealth.isLocal ? 'Local Mode Active' : 'Cloud Persistence Active'}
              </span>
            </div>
            <div className="h-6 w-px bg-white/10"></div>
            <div>
              <p className="text-[8px] font-black uppercase text-slate-500">
                {dbHealth.isLocal ? 'Browser Memory' : 'Supabase Payload'}
              </p>
              <p className="text-[10px] font-black text-white uppercase">{dbHealth.kbUsed} KB COMMITTED</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dealership Context Column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Brand Selection Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <i className="fas fa-tag"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 uppercase text-xs">Dealership Identity</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Configure primary brand audit context</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {brands.map(brand => (
                <button
                  key={brand}
                  onClick={() => handleBrandChange(brand)}
                  className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${currentBrand === brand
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  {currentBrand === brand && <i className="fas fa-check-circle"></i>}
                  {brand}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {libraryItems.map((item) => {
              const doc = standards.find(s => s.type === item.key);
              return (
                <div key={item.key} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-${item.color}-100 flex items-center justify-center text-${item.color}-600`}>
                      <i className={`fas ${item.icon} text-xl`}></i>
                    </div>
                    {doc && (
                      <span className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">
                        Knowledge Active
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-slate-800 uppercase text-xs mb-1">{item.label}</h3>
                  {doc ? (
                    <div className="space-y-3 flex-1">
                      <p className="text-[10px] text-slate-400 font-bold truncate">{doc.fileName}</p>
                      <div className="bg-slate-50 p-3 rounded-xl max-h-32 overflow-y-auto text-[10px] text-slate-600 font-mono leading-relaxed border border-slate-100">
                        {doc.extractedRules}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium mb-4 italic flex-1">No manufacturer or regulatory document uploaded.</p>
                  )}

                  <button
                    onClick={() => document.getElementById(`upload-${item.key}`)?.click()}
                    disabled={isProcessing}
                    className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-upload"></i>}
                    {doc ? 'Update Manual' : 'Upload Manual'}
                  </button>
                  <input
                    id={`upload-${item.key}`}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, item.key as any, item.label)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Personnel & Health Column */}
        <div className="space-y-6">

          {/* Persistence Health Hub */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <i className="fas fa-database text-xs"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 uppercase text-xs">Integrity Diagnostic</h3>
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Persistence Status Hub</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase">Engine Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-900 uppercase">{dbHealth.isLocal ? 'LOCAL STORAGE' : 'SUPABASE CLOUD'}</span>
                  <div className={`w-2 h-2 rounded-full ${dbHealth.isLocal ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase">Sync Gateway</span>
                <span className={`text-[10px] font-black uppercase ${dbHealth.isLocal ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {dbHealth.isLocal ? 'LOCAL ONLY' : 'CLOUD SYNC ACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Total Records</p>
                  <p className="text-sm font-black text-slate-900">{dbHealth.totalRecords}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Footprint</p>
                  <p className="text-sm font-black text-slate-900">{dbHealth.kbUsed} KB</p>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-[8px] font-mono text-slate-400 flex justify-between uppercase">
                  <span>Last Write</span>
                  <span>{new Date(dbHealth.lastCommit).toLocaleTimeString()}</span>
                </div>
                <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div className="w-full h-full bg-slate-400"></div>
                </div>
              </div>

              {!dbHealth.isLocal && (
                <button
                  onClick={async () => {
                    if (window.confirm("This will upload all local data to Supabase. Duplicate records will be updated. Continue?")) {
                      const res = await syncLocalToCloud();
                      if (res.success) {
                        alert(`Successfully synced ${res.count} records to Supabase.`);
                        refreshData();
                      } else {
                        alert("Sync failed. Check console for details.");
                      }
                    }
                  }}
                  className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-cloud-upload-alt"></i> Sync Local to Cloud
                </button>
              )}
            </div>
          </div>

          {/* Appraisers Section */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-4 flex items-center gap-2">
              <i className="fas fa-user-tie text-indigo-500"></i> Appraisers
            </h3>

            <form onSubmit={handleAddAppraiser} className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Full Name..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
              />
              <button className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all">
                <i className="fas fa-plus"></i>
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {appraisers.length === 0 && <p className="text-[10px] text-slate-400 italic">No appraisers added.</p>}
              {appraisers.map(app => (
                <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                  <span className="text-xs font-bold text-slate-700">{app.name}</span>
                  <button
                    onClick={() => handleRemoveAppraiser(app.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <i className="fas fa-trash-alt text-[10px]"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Technicians Section */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-4 flex items-center gap-2">
              <i className="fas fa-wrench text-indigo-500"></i> Technicians
            </h3>

            <form onSubmit={handleAddTechnician} className="mb-4 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Full Name..."
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newTechName}
                  onChange={(e) => setNewTechName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Tech #"
                  className="w-20 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newTechNum}
                  onChange={(e) => setNewTechNum(e.target.value)}
                />
              </div>
              <button className="w-full bg-indigo-600 text-white py-2 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700 transition-all">
                Add Mechanic
              </button>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {technicians.length === 0 && <p className="text-[10px] text-slate-400 italic">No mechanics added.</p>}
              {technicians.map(tech => (
                <div key={tech.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                  <div>
                    <p className="text-xs font-black text-slate-700 leading-tight">{tech.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tech #{tech.techNumber}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveTechnician(tech.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <i className="fas fa-trash-alt text-[10px]"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-4 flex items-center gap-2">
              <i className="fas fa-bolt text-amber-500"></i> System Performance
            </h3>
            <div className={`p-4 rounded-2xl mb-4 ${hasPaidKey ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${hasPaidKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                <span className={`text-[10px] font-black uppercase ${hasPaidKey ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {hasPaidKey ? 'Paid / Unlimited Tier' : 'Standard Free Tier'}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                {hasPaidKey
                  ? 'Your high-performance API key is active. Rate limits are lifted.'
                  : 'You are currently limited to 2 requests per minute.'}
              </p>
            </div>

            <button
              onClick={handleSelectKey}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-key"></i> Select Paid Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
