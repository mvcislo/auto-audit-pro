
import React, { useState } from 'react';
import { StandardDocument } from '../types';
import { saveStandard, getStandards } from '../services/storageService';
import { digestStandardDocument } from '../services/geminiService';

const AdminView: React.FC = () => {
  const [standards, setStandards] = useState<StandardDocument[]>(getStandards());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'SAFETY' | 'HCUV' | 'DEALERSHIP') => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <i className="fas fa-shield-alt text-9xl"></i>
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tighter">Ground Truth Library</h2>
        <p className="text-slate-400 text-sm font-medium mt-2">Upload PDFs to train the AI on specific dealership and provincial inspection rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { key: 'SAFETY', label: 'Ontario Safety Std', icon: 'fa-gavel', color: 'indigo' },
          { key: 'HCUV', label: 'Honda HCUV Manual', icon: 'fa-check-circle', color: 'emerald' },
          { key: 'DEALERSHIP', label: 'Dealer Recon Policy', icon: 'fa-building', color: 'blue' }
        ].map((item) => {
          const doc = standards.find(s => s.type === item.key);
          return (
            <div key={item.key} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className={`w-12 h-12 rounded-2xl bg-${item.color}-100 flex items-center justify-center text-${item.color}-600 mb-4`}>
                <i className={`fas ${item.icon} text-xl`}></i>
              </div>
              <h3 className="font-black text-slate-800 uppercase text-xs mb-1">{item.label}</h3>
              {doc ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 font-bold truncate">{doc.fileName}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                    <i className="fas fa-sync-alt animate-spin-slow"></i> Rules Digested
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl max-h-32 overflow-y-auto text-[10px] text-slate-600 font-mono leading-relaxed">
                    {doc.extractedRules}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-medium mb-4 italic">No document uploaded yet.</p>
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

      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex gap-6 items-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
          <i className="fas fa-brain text-2xl"></i>
        </div>
        <div>
          <h4 className="font-black text-indigo-900 uppercase text-sm">Active Learning Logic</h4>
          <p className="text-xs text-indigo-700 leading-relaxed mt-1">
            The auditor currently cross-references <strong>{standards.length}</strong> rulebooks and 
            <strong> {getStandards().length > 0 ? 'Active' : 'Inactive'}</strong> historical technician variance profiles.
            Every audit you approve or modify trains the model's skepticism level.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
