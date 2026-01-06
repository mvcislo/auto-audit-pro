
import React, { useState, useEffect } from 'react';
import { StandardDocument, DealershipBrand } from '../types';
import { saveStandard, getStandards, saveBrand, getBrand } from '../services/storageService';
import { digestStandardDocument } from '../services/geminiService';

const AdminView: React.FC = () => {
  const [standards, setStandards] = useState<StandardDocument[]>(getStandards());
  const [currentBrand, setCurrentBrand] = useState<DealershipBrand>(getBrand());
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPaidKey, setHasPaidKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasPaidKey(true);
    }
  };

  const handleBrandChange = (brand: DealershipBrand) => {
    setCurrentBrand(brand);
    saveBrand(brand);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: StandardDocument['type']) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const extractedRules = await digestStandardDocument(base64, type);
      
      const newDoc: StandardDocument = {
        id: crypto.randomUUID(),
        type,
        fileName: file.name,
        uploadDate: Date.now(),
        extractedRules
      };

      saveStandard(newDoc);
      setStandards(getStandards());
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const getCPOLabel = () => {
    switch (currentBrand) {
      case 'Honda': return 'HCUV Manual (Honda)';
      case 'Toyota': return 'TCUV Manual (Toyota)';
      case 'Chevrolet': return 'GM Certified Manual';
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

  const brands: DealershipBrand[] = ['Honda', 'Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Nissan', 'Other'];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <i className="fas fa-shield-alt text-9xl"></i>
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tighter">Ground Truth Library</h2>
        <p className="text-slate-400 text-sm font-medium mt-2">Set your dealership identity and train the AI on specific brand rules.</p>
      </div>

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
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                currentBrand === brand 
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  onChange={(e) => handleFileUpload(e, item.key as any)} 
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
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
                  ? 'Your high-performance API key is active. Rate limits are lifted for fast document processing.' 
                  : 'You are currently limited to 2 requests per minute. Performance may be throttled during busy periods.'}
              </p>
            </div>
            
            <button 
              onClick={handleSelectKey}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-key"></i> Select Paid Key
            </button>
            
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-center mt-4 text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase"
            >
              Upgrade to Pay-As-You-Go <i className="fas fa-external-link-alt ml-1"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
