
import React, { useState, useCallback, useEffect } from 'react';
import { Vehicle, InspectionData, InspectionType, OutcomeStatus, AnalysisMode } from '../types';
import { decodeVIN } from '../services/geminiService';

interface InspectionFormProps {
  onAnalyze: (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => void;
  isLoading: boolean;
  initialData?: Partial<InspectionData>;
}

const InspectionForm: React.FC<InspectionFormProps> = ({ onAnalyze, isLoading, initialData }) => {
  const [mode, setMode] = useState<AnalysisMode>(AnalysisMode.AUDIT);
  const [vehicle, setVehicle] = useState<Vehicle>({
    vin: '',
    year: new Date().getFullYear(),
    make: '',
    model: '',
    trim: '',
    kilometres: 0,
    acquisitionType: 'Trade'
  });

  const [data, setData] = useState<InspectionData>({
    type: InspectionType.BOTH,
    safetyOutcome: OutcomeStatus.PASS,
    hcuvOutcome: OutcomeStatus.FAIL,
    technicianNotes: '',
    technicianName: '',
    appraiserName: '',
    appraiserNotes: '',
    managerAppraisalEstimate: 0,
    serviceDepartmentEstimate: 0,
    attachments: [],
    ...initialData
  });

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (initialData) {
      setData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleVINChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vin = e.target.value.toUpperCase();
    setVehicle(v => ({ ...v, vin }));
    if (vin.length === 17) {
      const decoded = await decodeVIN(vin);
      if (decoded) setVehicle(v => ({ ...v, ...decoded }));
    }
  };

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), reader.result as string]
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) Array.from(e.target.files).forEach(processFile);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) Array.from(e.dataTransfer.files).forEach(processFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze(vehicle, data, mode);
  };

  const attachments = data.attachments || [];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
      <div className="flex bg-slate-100 p-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setMode(AnalysisMode.AUDIT)}
          className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${mode === AnalysisMode.AUDIT ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <i className="fas fa-shield-alt mr-2"></i> Audit Discrepancies
        </button>
        <button
          type="button"
          onClick={() => setMode(AnalysisMode.APPRAISAL)}
          className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${mode === AnalysisMode.APPRAISAL ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <i className="fas fa-search-dollar mr-2"></i> Appraisal Estimate
        </button>
      </div>

      <div className="p-8 space-y-8">
        {/* Vehicle Identity */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-indigo-500 rounded"></div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">1. Vehicle Specification</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">VIN Search</label>
              <input
                required
                maxLength={17}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all uppercase font-mono text-sm"
                value={vehicle.vin}
                onChange={handleVINChange}
                placeholder="2HGFB..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Odometer</label>
              <input
                type="number"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={vehicle.kilometres}
                onChange={e => setVehicle(v => ({ ...v, kilometres: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-3 md:col-span-3 gap-4">
              <input className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm" value={vehicle.year} readOnly />
              <input className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm" value={vehicle.make} readOnly placeholder="Make" />
              <input className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm" value={vehicle.model} readOnly placeholder="Model" />
            </div>
          </div>
        </section>

        {/* Financial Audit */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-indigo-500 rounded"></div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">2. Financial Accountability (Door Rate: Applied)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Appraiser / Buyer</label>
              <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm" value={data.appraiserName || ''} onChange={e => setData(d => ({ ...d, appraiserName: e.target.value }))} placeholder="Name" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Inspecting Technician</label>
              <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm" value={data.technicianName || ''} onChange={e => setData(d => ({ ...d, technicianName: e.target.value }))} placeholder="Name" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Original Recon Budget ($)</label>
              <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm" value={data.managerAppraisalEstimate || 0} onChange={e => setData(d => ({ ...d, managerAppraisalEstimate: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Final Service Quote ($)</label>
              <input type="number" className="w-full bg-indigo-50 border-indigo-200 border rounded-xl px-4 py-3 font-black text-indigo-700 text-sm" value={data.serviceDepartmentEstimate || 0} onChange={e => setData(d => ({ ...d, serviceDepartmentEstimate: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
        </section>

        {/* Analysis Notes */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-indigo-500 rounded"></div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">3. Intelligence Comparison</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Appraiser Notes (Visual/Drive)</label>
              <textarea
                className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 h-40 outline-none focus:ring-2 focus:ring-emerald-500 text-sm placeholder:text-emerald-300"
                value={data.appraiserNotes || ''}
                onChange={e => setData(d => ({ ...d, appraiserNotes: e.target.value }))}
                placeholder="What was visible when we bought it? (e.g., 'Tires looked 6/32nds, no warning lights, AC cold')"
              />
            </div>
            <div className="group">
              <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1">Technician Finding (Hoist/Scan)</label>
              <textarea
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 h-40 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={data.technicianNotes || ''}
                onChange={e => setData(d => ({ ...d, technicianNotes: e.target.value }))}
                placeholder="Enter quote details or tech comments. (e.g., 'Rear brakes failed at 2mm, leaking turbo, air filter dirty')"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-indigo-500 rounded"></div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">4. Source Documentation</h3>
          </div>
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50'
            }`}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <i className="fas fa-file-invoice-dollar text-3xl text-slate-400 mb-3"></i>
            <p className="text-sm font-bold text-slate-600">Drop PDF Estimate or HCUV Checklist</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">AI will extract Required vs Recommended flags</p>
            <input id="fileInput" type="file" multiple className="hidden" onChange={onFileSelect} accept="image/*,application/pdf" />
            
            {attachments.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {attachments.map((_, i) => (
                  <div key={i} className="px-3 py-1 bg-indigo-600 rounded-full text-white text-[10px] font-black">DOC {i+1}</div>
                ))}
              </div>
            )}
          </div>
        </section>

        <button
          disabled={isLoading}
          className={`w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all transform hover:scale-[0.99] active:scale-[0.97] ${
            mode === AnalysisMode.AUDIT ? 'bg-indigo-600 shadow-indigo-100' : 'bg-emerald-600 shadow-emerald-100'
          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <i className="fas fa-microchip animate-pulse"></i> 
              <span className="animate-pulse tracking-widest uppercase text-xs">Processing Multi-Source Audit...</span>
            </span>
          ) : (
            <span className="tracking-widest uppercase text-sm">Execute Strategic Audit Engine</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default InspectionForm;
