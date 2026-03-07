
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Vehicle, InspectionData, InspectionType, OutcomeStatus, AnalysisMode, Appraiser, Technician, InventoryProgram } from '../types';
import { decodeVIN, extractVINFromImage, parseVAutoAppraisal, parseServiceClaim } from '../services/geminiService';
import { getAppraisers, getTechnicians, getBrand } from '../services/storageService';
import { DealershipBrand } from '../types';

interface InspectionFormProps {
  onAnalyze: (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => void;
  isLoading: boolean;
  initialData?: Partial<InspectionData>;
  initialVehicle?: Partial<Vehicle>;
  onShowAnalysis?: () => void;
  hasAnalysis?: boolean;
}

const InspectionForm: React.FC<InspectionFormProps> = ({ onAnalyze, isLoading, initialData, initialVehicle, onShowAnalysis, hasAnalysis }) => {
  const currentYear = new Date().getFullYear();
  const [mode, setMode] = useState<AnalysisMode>(AnalysisMode.AUDIT);
  const [isScanning, setIsScanning] = useState(false);
  const [isExtractingVin, setIsExtractingVin] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [appraiserList, setAppraiserList] = useState<Appraiser[]>([]);
  const [technicianList, setTechnicianList] = useState<Technician[]>([]);
  const [brand, setBrand] = useState<DealershipBrand>('Honda');

  const [vehicle, setVehicle] = useState<Vehicle>({
    vin: '',
    year: currentYear,
    make: '',
    model: '',
    trim: '',
    kilometres: 0,
    stockNumber: '',
    acquisitionType: 'Trade',
    ...initialVehicle
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
        const [appraisers, technicians, currentBrand] = await Promise.all([
          getAppraisers(),
          getTechnicians(),
          getBrand()
        ]);
        setAppraiserList(appraisers);
        setTechnicianList(technicians);
        setBrand(currentBrand);
      } catch (error) {
        console.error("Error fetching list data:", error);
      }
    };
    fetchSelectData();
  }, []);

  // Brand-aware Eligibility Logic
  const checkEligibility = (prog: InventoryProgram) => {
    const age = currentYear - vehicle.year;
    const kms = vehicle.kilometres;

    // Brand Specific CPO (HCUV/Brand Certified)
    if (prog === InventoryProgram.HCUV) {
      if (brand === 'Honda') {
        if (age > 10) return { ok: false, reason: 'Age > 10yrs' };
        if (kms > 120000) return { ok: false, reason: 'KM > 120k' };
      }
      if (brand === 'Toyota') {
        if (age > 6) return { ok: false, reason: 'Age > 6yrs' };
        if (kms > 140000) return { ok: false, reason: 'KM > 140k' };
      }
      if (brand === 'CBG' || brand === 'Cadillac') {
        if (age > 6) return { ok: false, reason: 'Age > 6yrs' };
        if (kms > 120000) return { ok: false, reason: 'KM > 120k' };
      }
    }

    // Safety Standard (Retail) usually has looser or no strict age limits unless dealer policy
    if (prog === InventoryProgram.SAFETY_STANDARD) {
      if (age > 15) return { ok: false, reason: 'Age > 15yrs' };
      if (kms > 300000) return { ok: false, reason: 'KM > 300k' };
    }

    return { ok: true };
  };

  const getProgramLabel = (prog: InventoryProgram) => {
    if (prog === InventoryProgram.HCUV) {
      if (brand === 'Honda') return 'HCUV';
      if (brand === 'Toyota') return 'TCUV';
      if (brand === 'CBG' || brand === 'Cadillac') return 'GM Certified';
      return 'Certified Plus';
    }
    if (prog === InventoryProgram.SAFETY_STANDARD) return 'Safety Standard';
    if (prog === InventoryProgram.WHOLESALE) return 'Wholesale';
    if (prog === InventoryProgram.AS_IS) return 'As-Is';
    return prog;
  };

  // Automatically adjust selected program if it becomes ineligible
  useEffect(() => {
    const hcuv = checkEligibility(InventoryProgram.HCUV);
    const safety = checkEligibility(InventoryProgram.SAFETY_STANDARD);

    if (data.program === InventoryProgram.HCUV && !hcuv.ok) {
      setData(d => ({ ...d, program: safety.ok ? InventoryProgram.SAFETY_STANDARD : InventoryProgram.WHOLESALE }));
    } else if (data.program === InventoryProgram.SAFETY_STANDARD && !safety.ok) {
      setData(d => ({ ...d, program: InventoryProgram.WHOLESALE }));
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
              managerAppraisalEstimate: result.managerAppraisalEstimate || d.managerAppraisalEstimate,
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

  const handleShopClaimUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingVin(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const result = await parseServiceClaim(base64);
        if (result) {
          setData(d => ({
            ...d,
            technicianName: result.technicianName || d.technicianName,
            serviceDepartmentEstimate: result.serviceDepartmentEstimate || d.serviceDepartmentEstimate,
            technicianNotes: result.technicianNotes || d.technicianNotes,
            attachments: [...d.attachments, base64]
          }));
          alert("Shop Claim imported successfully!");
        } else {
          alert("AI could not extract data from this Shop Claim. Please ensure it is a clear scan or digital PDF.");
        }
      } catch (err) {
        console.error("Shop claim upload error:", err);
      } finally {
        setIsExtractingVin(false);
        e.target.value = '';
      }
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

      <div className="flex bg-slate-900 text-white p-2">
        <button type="button" onClick={() => setMode(AnalysisMode.AUDIT)} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${mode === AnalysisMode.AUDIT ? 'bg-indigo-600 shadow-lg' : 'opacity-40 hover:opacity-100'}`}>
          <i className="fas fa-file-invoice-dollar mr-2"></i> Audit Variance
        </button>
        <button type="button" onClick={() => setMode(AnalysisMode.APPRAISAL)} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${mode === AnalysisMode.APPRAISAL ? 'bg-emerald-600 shadow-lg' : 'opacity-40 hover:opacity-100'}`}>
          <i className="fas fa-calculator mr-2"></i> Recon Prediction
        </button>
      </div>

      <div className="p-8 space-y-12">
        {/* STEP 1 & 2: THE BIG IMPORTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
              vAuto Appraisal
            </h3>
            <button
              type="button"
              onClick={() => document.getElementById('vauto-upload')?.click()}
              className="w-full group relative overflow-hidden bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-500 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-[1.01]"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
              <i className="fas fa-file-pdf text-4xl text-emerald-600 mb-3 group-hover:scale-110 transition-transform"></i>
              <span className="text-sm font-black text-emerald-900 uppercase">Step 1: Import vAuto</span>
              <span className="text-[9px] font-black text-emerald-600 mt-1 uppercase opacity-60">Upload intake / appraisal PDF</span>
              <input type="file" id="vauto-upload" className="hidden" accept=".pdf" onChange={handleVAutoUpload} />
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
              Service Shop Claim
            </h3>
            <button
              type="button"
              onClick={() => document.getElementById('shop-upload')?.click()}
              className="w-full group relative overflow-hidden bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-500 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
              <i className="fas fa-wrench text-4xl text-indigo-600 mb-3 group-hover:scale-110 transition-transform"></i>
              <span className="text-sm font-black text-indigo-900 uppercase">Step 2: Import Claim</span>
              <span className="text-[9px] font-black text-indigo-600 mt-1 uppercase opacity-60">Upload multi-point / MPI PDF</span>
              <input type="file" id="shop-upload" className="hidden" accept=".pdf" onChange={handleShopClaimUpload} />
            </button>
          </div>
        </div>

        {/* STEP 3: IDENTITY & MANUAL TWEAKS */}
        <section className="bg-slate-50 p-8 rounded-[40px] border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
              Vehicle Details & Program
            </h3>
            <button type="button" onClick={startScanner} className="text-[10px] font-black bg-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-300 transition-all flex items-center gap-2 uppercase">
              <i className="fas fa-camera"></i> Scan VIN Label
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">17-Digit VIN</label>
                  <input required maxLength={17} className={`w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 font-mono text-base font-black uppercase focus:border-indigo-500 outline-none transition-shadow focus:shadow-lg ${isExtractingVin ? 'animate-pulse' : ''}`} value={vehicle.vin} onChange={handleVINChange} placeholder="AUTO-POPULATED..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Odometer (km)</label>
                  <input type="number" className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 font-black text-base outline-none focus:border-indigo-500 focus:shadow-lg transition-shadow" value={vehicle.kilometres || ''} onChange={e => setVehicle(v => ({ ...v, kilometres: parseInt(e.target.value) || 0 }))} placeholder="0 KM" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Make</p>
                  <p className="text-sm font-black text-slate-900 truncate">{vehicle.make || '??'}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Model</p>
                  <p className="text-sm font-black text-slate-900 truncate">{vehicle.model || '??'}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Year</p>
                  <p className="text-sm font-black text-slate-900 truncate">{vehicle.year || '??'}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest text-center">Active Target Tier</label>
              <div className="space-y-3">
                {Object.values(InventoryProgram).map(p => {
                  const eligibility = checkEligibility(p);
                  const isActive = data.program === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={!eligibility.ok}
                      onClick={() => setData(d => ({ ...d, program: p }))}
                      className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all flex items-center justify-between ${isActive
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md'
                        : eligibility.ok
                          ? 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                          : 'border-slate-50 bg-slate-25 text-slate-200 cursor-not-allowed hidden'
                        }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight">{getProgramLabel(p)}</span>
                      {isActive && <i className="fas fa-check-circle text-indigo-600"></i>}
                      {!eligibility.ok && <span className="text-[8px] font-bold opacity-60">{eligibility.reason}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* STEP 4: ACTION */}
        <section className="space-y-6 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">4</span>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generate Final Audit</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 grid grid-cols-2 gap-4">
              <button type="button" onClick={() => document.getElementById('cameraInput')?.click()} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 bg-white rounded-3xl hover:bg-slate-50 transition-all group">
                <i className="fas fa-camera text-xl text-slate-400 group-hover:text-slate-600 mb-2"></i>
                <span className="text-[9px] font-black uppercase text-slate-500">Capture</span>
                <input id="cameraInput" type="file" capture="environment" className="hidden" onChange={onFileSelect} accept="image/*" />
              </button>
              <button type="button" onClick={() => document.getElementById('fileInput')?.click()} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 bg-white rounded-3xl hover:bg-slate-50 transition-all group">
                <i className="fas fa-image text-xl text-slate-400 group-hover:text-slate-600 mb-2"></i>
                <span className="text-[9px] font-black uppercase text-slate-500">Gallery</span>
                <input id="fileInput" type="file" multiple className="hidden" onChange={onFileSelect} accept="image/*,application/pdf" />
              </button>
            </div>

            <div className="md:col-span-8 flex flex-col gap-4">
              {hasAnalysis && onShowAnalysis && (
                <button type="button" onClick={onShowAnalysis} className="w-full py-4 border-2 border-indigo-600 text-indigo-600 rounded-3xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all animate-pulse">
                  <i className="fas fa-eye mr-2"></i> Read Strategy Analysis
                </button>
              )}
              <button
                disabled={isLoading || !vehicle.vin}
                className={`w-full py-6 rounded-[32px] font-black text-white shadow-2xl transition-all transform active:scale-[0.95] flex items-center justify-center gap-4 ${mode === AnalysisMode.AUDIT ? 'bg-gradient-to-r from-indigo-700 to-indigo-600' : 'bg-gradient-to-r from-emerald-700 to-emerald-600'
                  } ${(isLoading || !vehicle.vin) ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-indigo-500/30'}`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <i className="fas fa-brain animate-bounce text-xl"></i>
                    <span className="tracking-widest uppercase">Consulting AI Auditor...</span>
                  </div>
                ) : (
                  <>
                    <i className={`fas ${mode === AnalysisMode.AUDIT ? 'fa-bolt' : 'fa-calculator'} text-xl`}></i>
                    <span className="tracking-[0.2em] text-lg uppercase">
                      {mode === AnalysisMode.AUDIT ? 'Run Audit Strategy' : 'Calculate Recon Prediction'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {data.attachments.length > 0 && (
            <div className="flex gap-3 flex-wrap bg-slate-50 p-4 rounded-3xl border border-slate-100">
              {data.attachments.map((base64, i) => {
                const isPdf = base64.startsWith('data:application/pdf');
                return (
                  <div key={i} className="relative group">
                    {isPdf ? (
                      <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-red-600">
                        <i className="fas fa-file-pdf text-xl mb-1"></i>
                        <span className="text-[6px] font-black uppercase text-slate-400">PDF</span>
                      </div>
                    ) : (
                      <img src={base64} className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm" alt="" />
                    )}
                    <button type="button" onClick={() => setData(d => ({ ...d, attachments: d.attachments.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[8px] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </form>
  );
};

export default InspectionForm;
