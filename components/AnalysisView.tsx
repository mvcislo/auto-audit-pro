
import React, { useState } from 'react';
import { InspectionCase } from '../types';

interface AnalysisViewProps {
  content: string;
  citations: any[];
  caseData?: InspectionCase;
  onReset: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ content, citations, caseData, onReset }) => {
  const [showSource, setShowSource] = useState(true);

  const handlePrint = () => {
    // Strategy: Change document title temporarily so browser "Save as PDF" 
    // uses the VIN as the default filename.
    const originalTitle = document.title;
    const vinFilename = caseData?.vehicle.vin.slice(-8) || 'AUDIT-REPORT';
    
    document.title = vinFilename;
    window.print();
    document.title = originalTitle;
  };

  const formatContent = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-black text-slate-900 mt-6 mb-3 border-b-2 border-slate-900 pb-1 uppercase tracking-tight print:text-xl print:mt-4 print:mb-2">{line.substring(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-indigo-800 mt-6 mb-2 flex items-center gap-2 print:text-sm print:mt-4 print:text-slate-800 break-after-avoid">{line.substring(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-md font-bold text-slate-700 mt-4 mb-1 print:text-xs">{line.substring(4)}</h3>;
      if (line.startsWith('- ')) return <li key={i} className="ml-5 mb-1 text-slate-700 text-sm list-disc print:text-[10px] print:ml-4">{line.substring(2)}</li>;
      
      if (line.includes('**')) {
        const parts = line.split('**');
        return <p key={i} className="mb-2 text-sm text-slate-700 leading-relaxed print:text-[10px] print:mb-1">{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-slate-900 font-bold">{p}</strong> : p)}</p>;
      }
      
      if (line.includes("MANAGER'S COMBAT CHECKLIST") || line.includes("Push-back") || line.includes("🚨")) {
         return <div key={i} className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl my-4 text-red-900 font-bold text-sm break-inside-avoid print:my-2 print:p-2 print:text-[10px] print:bg-slate-50 print:border-red-400">
           {line}
         </div>;
      }

      if (line.toLowerCase().includes("proof") || line.toLowerCase().includes("measurement")) {
        return <p key={i} className="bg-indigo-50 px-2 py-1 inline-block rounded text-indigo-700 font-bold text-[11px] mb-2 print:text-[9px] print:bg-slate-100">{line}</p>;
      }

      if (line.trim() === '') return <div key={i} className="h-2 print:h-1"></div>;
      return <p key={i} className="mb-2 text-sm text-slate-700 leading-relaxed print:text-[10px] print:mb-1">{line}</p>;
    });
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in zoom-in duration-500">
      <style>{`
        @media print {
          @page { size: auto; margin: 15mm; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; font-family: sans-serif; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .print-header { display: block !important; border-bottom: 2px solid #000; margin-bottom: 2rem; padding-bottom: 1rem; }
          .print-section { break-inside: avoid; margin-bottom: 1.5rem; }
          .audit-content { border-top: 1px solid #eee; padding-top: 1rem; }
          .print-image-grid { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; margin-top: 2rem !important; }
          .print-image-container { break-inside: avoid !important; page-break-inside: avoid !important; }
          .print-image { width: 100% !important; height: auto !important; border-radius: 4px !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      {/* Control Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm sticky top-20 z-40 border border-slate-200 no-print mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSource(!showSource)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${showSource ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
          >
            <i className={`fas ${showSource ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            {showSource ? 'Hide Input Data' : 'Show Input Data'}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2">
            <i className="fas fa-file-pdf"></i> Export PDF ({caseData?.vehicle.vin.slice(-8)})
          </button>
          <button onClick={onReset} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2">
            <i className="fas fa-arrow-left"></i> Edit / New Audit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Summary Sidebar (Web Only) */}
        {showSource && caseData && (
          <div className="lg:col-span-4 space-y-4 no-print sticky top-40 animate-in slide-in-from-left-4 duration-300">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Case Identity</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                    <i className="fas fa-car"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-tight">{caseData.vehicle.year} {caseData.vehicle.make} {caseData.vehicle.model}</p>
                    <p className="text-[10px] font-mono text-slate-400">{caseData.vehicle.vin}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Mileage</p>
                    <p className="text-xs font-bold text-slate-700">{caseData.vehicle.kilometres.toLocaleString()} km</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Tech</p>
                    <p className="text-xs font-bold text-slate-700">{caseData.data.technicianName || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Financial Benchmarks</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Manager Budget</span>
                  <span className="text-sm font-bold text-slate-900">${caseData.data.managerAppraisalEstimate.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Service Quote</span>
                  <span className="text-sm font-black text-indigo-600">${caseData.data.serviceDepartmentEstimate.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase">Gross Gap</span>
                  <span className="text-sm font-black text-red-600">
                    -${Math.abs(caseData.data.serviceDepartmentEstimate - caseData.data.managerAppraisalEstimate).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Content & Print Layout */}
        <div className={`${showSource ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all duration-300 print:lg:col-span-12`}>
          <div className="print-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 prose prose-slate max-w-none print:shadow-none print:border-none print:p-0">
            
            {/* PRINT ONLY HEADER - Always top of PDF */}
            <div className="hidden print:block print-header">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 m-0 uppercase leading-none">STRATEGIC AUDIT RECORD</h1>
                  <p className="text-slate-500 font-bold m-0 uppercase text-[9px] tracking-[0.2em] mt-2">AutoAudit Pro | Dealership Strategic Analysis</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900 m-0">{new Date().toLocaleDateString('en-CA').toUpperCase()}</p>
                  <p className="text-[8px] font-bold text-slate-400 m-0 uppercase">Case Reference: {caseData?.id.substring(0, 12)}</p>
                </div>
              </div>

              {caseData && (
                <>
                  <div className="grid grid-cols-3 gap-6 border-y-2 border-black py-4 my-4 bg-slate-50">
                    <div className="print-section">
                      <h5 className="text-[9px] font-black uppercase text-slate-500 mb-1">Vehicle Details</h5>
                      <p className="text-sm font-black text-slate-900 m-0 leading-tight">{caseData.vehicle.year} {caseData.vehicle.make} {caseData.vehicle.model}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-600 m-0 uppercase">{caseData.vehicle.vin}</p>
                      <p className="text-[10px] font-bold text-slate-800 m-0 mt-1">{caseData.vehicle.kilometres.toLocaleString()} KM | {caseData.vehicle.acquisitionType}</p>
                    </div>
                    <div className="print-section">
                      <h5 className="text-[9px] font-black uppercase text-slate-500 mb-1">Audit Personnel</h5>
                      <p className="text-xs font-bold text-slate-800 m-0">Technician: <span className="text-slate-900">{caseData.data.technicianName || 'NOT LISTED'}</span></p>
                      <p className="text-xs font-bold text-slate-800 m-0">Appraiser: <span className="text-slate-900">{caseData.data.appraiserName || 'NOT LISTED'}</span></p>
                      <p className="text-xs font-bold text-slate-800 m-0 mt-1">Inspection: <span className="text-slate-900">{caseData.data.type}</span></p>
                    </div>
                    <div className="print-section">
                      <h5 className="text-[9px] font-black uppercase text-slate-500 mb-1">Financial Data</h5>
                      <div className="flex justify-between text-xs font-bold">
                        <span>Original Estimate:</span>
                        <span className="text-slate-900">${caseData.data.managerAppraisalEstimate.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black">
                        <span>Service Quote:</span>
                        <span className="text-indigo-800">${caseData.data.serviceDepartmentEstimate.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black border-t border-slate-400 mt-1 pt-1">
                        <span>Variance:</span>
                        <span className="text-red-700">-${Math.abs(caseData.data.serviceDepartmentEstimate - caseData.data.managerAppraisalEstimate).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {(caseData.data.technicianNotes || caseData.data.appraiserNotes) && (
                    <div className="grid grid-cols-2 gap-8 mb-6 bg-slate-50/30 p-4 rounded-xl">
                      {caseData.data.technicianNotes && (
                        <div className="print-section">
                          <h5 className="text-[8px] font-black uppercase text-slate-400 mb-1">Original Technician Notes</h5>
                          <p className="text-[10px] text-slate-700 leading-tight border-l-2 border-slate-300 pl-3 italic">{caseData.data.technicianNotes}</p>
                        </div>
                      )}
                      {caseData.data.appraiserNotes && (
                        <div className="print-section">
                          <h5 className="text-[8px] font-black uppercase text-slate-400 mb-1">Original Appraiser Notes</h5>
                          <p className="text-[10px] text-slate-700 leading-tight border-l-2 border-slate-300 pl-3 italic">{caseData.data.appraiserNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="audit-content print:mt-2">
              <div className="hidden print:block mb-4">
                <h2 className="text-xl font-black text-slate-900 uppercase">AI Auditor Findings</h2>
              </div>
              {formatContent(content)}
            </div>

            {/* Visual Evidence Section for PDF */}
            {caseData && caseData.data.attachments && caseData.data.attachments.length > 0 && (
              <div className="mt-12 pt-8 border-t-2 border-slate-900 print:break-before-auto">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <i className="fas fa-camera no-print"></i> Visual Evidence & Documentation
                </h3>
                <div className="grid grid-cols-2 gap-4 print-image-grid">
                  {caseData.data.attachments.map((img, idx) => (
                    <div key={idx} className="print-image-container relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <img 
                        src={img} 
                        alt={`Attachment ${idx + 1}`} 
                        className="print-image w-full h-auto object-cover"
                      />
                      <div className="absolute bottom-0 right-0 bg-black/50 text-white px-2 py-1 text-[8px] font-bold">
                        IMAGE_{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {citations.length > 0 && (
              <div className="mt-8 pt-4 border-t border-slate-100 print:break-inside-avoid">
                <h4 className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-2">Audit Compliance References</h4>
                <div className="grid grid-cols-2 gap-2 print:grid-cols-1">
                  {citations.map((cite, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-500 truncate bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <i className="fas fa-link text-indigo-400 text-[8px]"></i>
                      <span className="truncate">{cite.web?.title || cite.web?.uri}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center text-[10px] text-slate-400 no-print pb-10 uppercase tracking-widest font-bold">
            <p>Report generated via AutoAudit Pro Engine. Analysis cross-referenced against saved Dealership Knowledge Base.</p>
          </div>
          
          <div className="hidden print:block mt-12 text-center text-[9px] text-slate-500 uppercase tracking-[0.3em] font-bold border-t border-slate-200 pt-6">
            <p>CONFIDENTIAL: FOR INTERNAL DEALERSHIP MANAGEMENT USE ONLY</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
