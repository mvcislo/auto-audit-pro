
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Vehicle, InspectionData, InspectionType, OutcomeStatus, AnalysisMode, Appraiser, Technician, InventoryProgram } from '../types';
import { decodeVIN, extractVINFromImage, parseVAutoAppraisal } from '../services/geminiService';
import { getAppraisers, getTechnicians } from '../services/storageService';

interface InspectionFormProps {
  onAnalyze: (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => void;
  isLoading: boolean;
  initialData?: Partial<InspectionData>;
}

const InspectionForm: React.FC<InspectionFormProps> = ({ onAnalyze, isLoading, initialData }) => {
  const currentYear = new Date().getFullYear();
  const [mode, setMode] = useState<AnalysisMode>(AnalysisMode.AUDIT);
  const [isScanning, setIsScanning] = useState(false);
  const [isExtractingVin, setIsExtractingVin] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [appraiserList, setAppraiserList] = useState<Appraiser[]>([]);
  const [technicianList, setTechnicianList] = useState<Technician[]>([]);

  const [vehicle, setVehicle] = useState<Vehicle>({
    vin: '',
    year: currentYear,
    make: '',
    model: '',
    trim: '',
    kilometres: 0,
    stockNumber: '',
    acquisitionType: 'Trade'
  });

  const [data, setData] = useState<InspectionData>({
    type: InspectionType.BOTH,
    program: InventoryProgram.HCUV,
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

  useEffect(() => {
    const fetchSelectData = async () => {
      try {
        const [appraisers, technicians] = await Promise.all([
          getAppraisers(),
          getTechnicians()
        ]);
        setAppraiserList(appraisers);
        setTechnicianList(technicians);
      } catch (error) {
        console.error("Error fetching list data:", error);
      }
    };
    fetchSelectData();
  }, []);

  // Honda Eligibility Logic
  const checkEligibility = (prog: InventoryProgram) => {
    const age = currentYear - vehicle.year;
    const kms = vehicle.kilometres;

    if (prog === InventoryProgram.HCUV) {
      if (age > 6) return { ok: false, reason: 'Age > 6yrs' };
      if (kms > 120000) return { ok: false, reason: 'KM > 120k' };
    }
    if (prog === InventoryProgram.HAPO) {
      if (age > 10) return { ok: false, reason: 'Age > 10yrs' };
      if (kms > 200000) return { ok: false, reason: 'KM > 200k' };
    }
    return { ok: true };
  };

  // Automatically adjust selected program if it becomes ineligible
  useEffect(() => {
    const hcuv = checkEligibility(InventoryProgram.HCUV);
    const hapo = checkEligibility(InventoryProgram.HAPO);

    if (data.program === InventoryProgram.HCUV && !hcuv.ok) {
      setData(d => ({ ...d, program: hapo.ok ? InventoryProgram.HAPO : InventoryProgram.CERTIFIED }));
    } else if (data.program === InventoryProgram.HAPO && !hapo.ok) {
      setData(d => ({ ...d, program: InventoryProgram.CERTIFIED }));
    }
  }, [vehicle.year, vehicle.kilometres]);

  const handleVINChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vin = e.target.value.toUpperCase();
    setVehicle(v => ({ ...v, vin }));
    if (vin.length === 17) {
      const decoded = await decodeVIN(vin);
      if (decoded) setVehicle(v => ({ ...v, ...decoded }));
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setIsScanning(false);
      alert("Camera access denied.");
    }
  };

  const stopScanner = () => {
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setIsScanning(false);
  };

  const captureVIN = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      const base64 = canvasRef.current.toDataURL('image/jpeg');
      stopScanner();
      setIsExtractingVin(true);
      try {
        const result = await extractVINFromImage(base64);
        if (result?.vin) {
          setVehicle(v => ({ ...v, ...result }));
          const decoded = await decodeVIN(result.vin);
          if (decoded) setVehicle(v => ({ ...v, ...decoded }));
        }
      } finally {
        setIsExtractingVin(false);
      }
    }
  };

  const handleVAutoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("vAuto File selected:", file.name);
    setIsExtractingVin(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      console.log("File read successfully, sending to AI...");
      try {
        const result = await parseVAutoAppraisal(base64);
        console.log("AI result from vAuto PDF:", result);

        if (result) {
          setVehicle(v => {
            const next = {
              ...v,
              vin: result.vin || v.vin,
              year: parseInt(result.year) || v.year,
              make: result.make || v.make,
              model: result.model || v.model,
              kilometres: typeof result.kilometres === 'string' ? parseInt(result.kilometres.replace(/\D/g, '')) : (result.kilometres || v.kilometres)
            };
            console.log("Updating vehicle state to:", next);
            return next;
          });

          setData(d => {
            const next = {
              ...d,
              appraiserName: result.appraiserName || d.appraiserName,
              appraiserNotes: result.appraiserNotes || d.appraiserNotes,
              attachments: [...d.attachments, base64]
            };
            console.log("Updating inspection data state to:", next);
            return next;
          });

          alert("vAuto Appraisal imported successfully!");
        } else {
          alert("AI could not extract data from this PDF. Please ensure it is a vAuto trade appraisal.");
        }
      } catch (err) {
        console.error("vAuto upload error:", err);
        alert("Error parsing PDF. See console for details.");
      } finally {
        setIsExtractingVin(false);
        // Clear input
        e.target.value = '';
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setIsExtractingVin(false);
    };
    reader.readAsDataURL(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Cast 'file' to 'File' to ensure it's recognized as a global Blob for FileReader.readAsDataURL
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = () => setData(prev => ({ ...prev, attachments: [...prev.attachments, reader.result as string] }));
        reader.readAsDataURL(file);
      });
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onAnalyze(vehicle, data, mode); }} className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-20 animate-in slide-in-from-bottom-4 duration-500">
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] border-2 border-indigo-500 overflow-hidden rounded-3xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          </div>
          <div className="mt-8 flex gap-4">
            <button type="button" onClick={stopScanner} className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold uppercase">Cancel</button>
            <button type="button" onClick={captureVIN} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg uppercase">Capture VIN</button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      <div className="flex bg-slate-100 p-1 border-b border-slate-200">
        <button type="button" onClick={() => setMode(AnalysisMode.AUDIT)} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${mode === AnalysisMode.AUDIT ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>
          <i className="fas fa-file-invoice-dollar mr-2"></i> Recon Audit
        </button>
        <button type="button" onClick={() => setMode(AnalysisMode.APPRAISAL)} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${mode === AnalysisMode.APPRAISAL ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>
          <i className="fas fa-calculator mr-2"></i> Predictive Appraisal
        </button>
      </div>

      <div className="p-8 space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase">1. Vehicle Identity</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => document.getElementById('vauto-upload')?.click()} className="text-[10px] font-black bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 uppercase">
                <i className="fas fa-file-pdf"></i> Import vAuto
              </button>
              <input type="file" id="vauto-upload" className="hidden" accept=".pdf" onChange={handleVAutoUpload} />
              <button type="button" onClick={startScanner} className="text-[10px] font-black bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 uppercase">
                <i className="fas fa-camera"></i> Scan VIN
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">17-Digit VIN Number</label>
              <input required maxLength={17} className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-mono text-base font-bold uppercase focus:border-indigo-500 outline-none ${isExtractingVin ? 'animate-pulse opacity-50' : ''}`} value={vehicle.vin} onChange={handleVINChange} placeholder="Enter VIN..." />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Stock #</label>
              <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-base outline-none focus:border-indigo-500 uppercase" value={vehicle.stockNumber} onChange={e => setVehicle(v => ({ ...v, stockNumber: e.target.value.toUpperCase() }))} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Odometer (km)</label>
              <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-base outline-none focus:border-indigo-500" value={vehicle.kilometres} onChange={e => setVehicle(v => ({ ...v, kilometres: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Program Selection</label>
              <select
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-indigo-500"
                value={data.program}
                onChange={e => setData(d => ({ ...d, program: e.target.value as InventoryProgram }))}
              >
                {Object.values(InventoryProgram).map(p => {
                  const eligibility = checkEligibility(p);
                  return (
                    <option key={p} value={p} disabled={!eligibility.ok} className={!eligibility.ok ? 'text-slate-300' : ''}>
                      {p} {eligibility.ok ? 'Standard' : `(${eligibility.reason})`}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4 md:col-span-3">
              <div className="p-4 bg-slate-100/50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Year</p>
                <input
                  type="number"
                  className="w-full bg-transparent text-center text-sm font-black text-slate-900 border-none outline-none"
                  value={vehicle.year}
                  onChange={e => setVehicle(v => ({ ...v, year: parseInt(e.target.value) || currentYear }))}
                />
              </div>
              <div className="p-4 bg-slate-100/50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Make</p>
                <p className="text-sm font-black text-slate-900 truncate">{vehicle.make || '---'}</p>
              </div>
              <div className="p-4 bg-slate-100/50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Model</p>
                <p className="text-sm font-black text-slate-900 truncate">{vehicle.model || '---'}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4">
            {mode === AnalysisMode.APPRAISAL ? '2. Appraisal Condition Notes' : '2. Audit Accountability'}
          </h3>
          <div className={`grid grid-cols-1 ${mode === AnalysisMode.AUDIT ? 'md:grid-cols-2' : ''} gap-8`}>
            {mode === AnalysisMode.AUDIT && (
              <div className="space-y-4 p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-wrench text-indigo-600"></i>
                  <h4 className="text-[10px] font-black text-indigo-700 uppercase">Service Shop Claim</h4>
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Mechanic</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={data.technicianName}
                    onChange={e => setData(d => ({ ...d, technicianName: e.target.value }))}
                  >
                    <option value="">Select Technician...</option>
                    {technicianList.map(tech => <option key={tech.id} value={tech.name}>{tech.name} (#{tech.techNumber})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Total Service Quote ($)</label>
                  <input type="number" className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 font-black text-indigo-700 text-base outline-none" value={data.serviceDepartmentEstimate} onChange={e => setData(d => ({ ...d, serviceDepartmentEstimate: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Shop Findings</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium min-h-[120px] outline-none"
                    placeholder="List technician's quote details..."
                    value={data.technicianNotes}
                    onChange={e => setData(d => ({ ...d, technicianNotes: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className={`space-y-4 p-6 ${mode === AnalysisMode.APPRAISAL ? 'bg-white border-2 border-emerald-500 shadow-xl' : 'bg-emerald-50/30 border border-emerald-100'} rounded-3xl transition-all`}>
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-user-tie text-emerald-600"></i>
                <h4 className="text-[10px] font-black text-emerald-700 uppercase">Manager Intake Notes</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Manager</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    value={data.appraiserName}
                    onChange={e => setData(d => ({ ...d, appraiserName: e.target.value }))}
                  >
                    <option value="">Select Appraiser...</option>
                    {appraiserList.map(app => <option key={app.id} value={app.name}>{app.name}</option>)}
                  </select>
                </div>
                {mode === AnalysisMode.AUDIT && (
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Self-Estimate ($)</label>
                    <input type="number" className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 font-black text-emerald-700 text-base outline-none" value={data.managerAppraisalEstimate} onChange={e => setData(d => ({ ...d, managerAppraisalEstimate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Condition Observation</label>
                <textarea
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium min-h-[120px] outline-none"
                  placeholder="e.g. 'Very clean car. Brakes are new. Needs tires.'"
                  value={data.appraiserNotes}
                  onChange={e => setData(d => ({ ...d, appraiserNotes: e.target.value }))}
                />
              </div>
              {mode === AnalysisMode.APPRAISAL && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-800 uppercase">
                    <i className="fas fa-info-circle mr-1"></i> AI includes $670 Base for {data.program} units.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4">3. Documentation</h3>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => document.getElementById('cameraInput')?.click()} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-3xl hover:bg-indigo-50 transition-all">
              <i className="fas fa-camera text-2xl text-indigo-600 mb-2"></i>
              <span className="text-[10px] font-black uppercase text-indigo-700">Photo Capture</span>
              <input id="cameraInput" type="file" capture="environment" className="hidden" onChange={onFileSelect} accept="image/*" />
            </button>
            <button type="button" onClick={() => document.getElementById('fileInput')?.click()} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-all">
              <i className="fas fa-file-upload text-2xl text-slate-400 mb-2"></i>
              <span className="text-[10px] font-black uppercase text-slate-600">Upload PDF/Docs</span>
              <input id="fileInput" type="file" multiple className="hidden" onChange={onFileSelect} accept="image/*,application/pdf" />
            </button>
          </div>
          {data.attachments.length > 0 && (
            <div className="flex gap-4 mt-6 flex-wrap">
              {data.attachments.map((base64, i) => (
                <div key={i} className="relative group">
                  <img src={base64} className="w-20 h-20 object-cover rounded-2xl border-2 border-indigo-200 shadow-lg transition-transform group-hover:scale-105" alt="" />
                  <button type="button" onClick={() => setData(d => ({ ...d, attachments: d.attachments.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]"><i className="fas fa-times"></i></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <button disabled={isLoading || !vehicle.vin} className={`w-full py-6 rounded-3xl font-black text-white shadow-2xl transition-all transform hover:scale-[0.98] ${mode === AnalysisMode.AUDIT ? 'bg-indigo-600' : 'bg-emerald-600'} ${(isLoading || !vehicle.vin) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
          {isLoading ? <i className="fas fa-brain animate-bounce"></i> : <span className="tracking-widest uppercase">{mode === AnalysisMode.AUDIT ? 'Run Audit Strategy' : 'Calculate Recon Estimate'}</span>}
        </button>
      </div>
    </form>
  );
};

export default InspectionForm;
