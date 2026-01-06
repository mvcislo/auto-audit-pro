
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Vehicle, InspectionData, InspectionType, OutcomeStatus, AnalysisMode } from '../types';
import { decodeVIN, extractVINFromImage } from '../services/geminiService';

interface InspectionFormProps {
  onAnalyze: (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => void;
  isLoading: boolean;
  initialData?: Partial<InspectionData>;
}

const InspectionForm: React.FC<InspectionFormProps> = ({ onAnalyze, isLoading, initialData }) => {
  const [mode, setMode] = useState<AnalysisMode>(AnalysisMode.AUDIT);
  const [isScanning, setIsScanning] = useState(false);
  const [isExtractingVin, setIsExtractingVin] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setIsScanning(false);
      alert("Camera access is required. Please check your browser permissions.");
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
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
        if (result && result.vin) {
          setVehicle(v => ({ ...v, ...result }));
          const decoded = await decodeVIN(result.vin);
          if (decoded) setVehicle(v => ({ ...v, ...decoded }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsExtractingVin(false);
      }
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); onAnalyze(vehicle, data, mode); }} className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-20 animate-in slide-in-from-bottom-4 duration-500">
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] border-2 border-indigo-500 overflow-hidden rounded-3xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-16 border-2 border-white/50 rounded bg-indigo-500/10 shadow-[0_0_20px_rgba(255,255,255,0.3)]"></div>
            </div>
          </div>
          <div className="mt-8 flex gap-4">
            <button type="button" onClick={stopScanner} className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold uppercase">Cancel</button>
            <button type="button" onClick={captureVIN} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg uppercase">Capture VIN</button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      <div className="flex bg-slate-100 p-1 border-b border-slate-200">
        <button type="button" onClick={() => setMode(AnalysisMode.AUDIT)} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${mode === AnalysisMode.AUDIT ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Audit Discrepancies</button>
        <button type="button" onClick={() => setMode(AnalysisMode.APPRAISAL)} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${mode === AnalysisMode.APPRAISAL ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Appraisal Estimates</button>
      </div>

      <div className="p-8 space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase">1. Vehicle Identity</h3>
            <button type="button" onClick={startScanner} className="text-[10px] font-black bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 uppercase">
              <i className="fas fa-camera"></i> Camera Scanner
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">17-Digit VIN Number</label>
              <input required maxLength={17} className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-mono text-base font-bold uppercase transition-all focus:border-indigo-500 focus:bg-white outline-none ${isExtractingVin ? 'animate-pulse opacity-50' : ''}`} value={vehicle.vin} onChange={handleVINChange} placeholder="Enter VIN..." />
              {isExtractingVin && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600 text-[10px] font-black uppercase">Analyzing...</div>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Odometer (km)</label>
              <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-base outline-none focus:border-indigo-500" value={vehicle.kilometres} onChange={e => setVehicle(v => ({ ...v, kilometres: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="grid grid-cols-3 md:col-span-3 gap-4">
              <div className="p-4 bg-slate-100/50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Year</p>
                <p className="text-sm font-black text-slate-900">{vehicle.year || '----'}</p>
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
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4">2. Financial Accountability</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Technician Name</label>
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" value={data.technicianName} onChange={e => setData(d => ({ ...d, technicianName: e.target.value }))} placeholder="Mechanic Name" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1.5 ml-1">Final Service Quote ($)</label>
                <input type="number" className="w-full bg-indigo-50 border-2 border-indigo-200 rounded-2xl px-5 py-4 font-black text-indigo-700 text-base" value={data.serviceDepartmentEstimate} onChange={e => setData(d => ({ ...d, serviceDepartmentEstimate: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Appraiser Name</label>
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" value={data.appraiserName} onChange={e => setData(d => ({ ...d, appraiserName: e.target.value }))} placeholder="Manager Name" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Original Recon Budget ($)</label>
                <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-base" value={data.managerAppraisalEstimate} onChange={e => setData(d => ({ ...d, managerAppraisalEstimate: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4">3. Documentation Capture</h3>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => document.getElementById('cameraInput')?.click()} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-3xl hover:bg-indigo-50 transition-all group">
              <i className="fas fa-camera text-2xl text-indigo-600 mb-2 group-hover:scale-110 transition-transform"></i>
              <span className="text-[10px] font-black uppercase text-indigo-700">Snap Quote Photo</span>
              <input id="cameraInput" type="file" capture="environment" className="hidden" onChange={onFileSelect} accept="image/*" />
            </button>
            <button type="button" onClick={() => document.getElementById('fileInput')?.click()} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-all">
              <i className="fas fa-file-upload text-2xl text-slate-400 mb-2"></i>
              <span className="text-[10px] font-black uppercase text-slate-600">Upload PDF/File</span>
              <input id="fileInput" type="file" multiple className="hidden" onChange={onFileSelect} accept="image/*,application/pdf" />
            </button>
          </div>
          {data.attachments.length > 0 && (
            <div className="flex gap-4 mt-6 flex-wrap">
              {data.attachments.map((base64, i) => (
                <div key={i} className="relative">
                  <img src={base64} className="w-20 h-20 object-cover rounded-2xl border-2 border-indigo-200 shadow-lg" alt="" />
                  <button type="button" onClick={() => setData(d => ({ ...d, attachments: d.attachments.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg"><i className="fas fa-times"></i></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <button disabled={isLoading || !vehicle.vin} className={`w-full py-6 rounded-3xl font-black text-white shadow-2xl transition-all transform hover:scale-[0.98] active:scale-[0.95] ${mode === AnalysisMode.AUDIT ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-600 shadow-emerald-200'} ${(isLoading || !vehicle.vin) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
          {isLoading ? <span className="flex items-center justify-center gap-4"><i className="fas fa-brain animate-bounce"></i> <span className="tracking-widest uppercase text-sm">Processing Audit Intelligence...</span></span> : <span className="tracking-widest uppercase text-base flex items-center justify-center gap-3"><i className="fas fa-bolt"></i> Execute AI Strategy Engine</span>}
        </button>
      </div>
    </form>
  );
};

export default InspectionForm;
