
import React, { useState } from 'react';
import { InspectionCase } from '../types';
import { clarifyAnalysis } from '../services/geminiService';

interface AnalysisViewProps {
  content: string;
  citations: any[];
  caseData?: InspectionCase;
  onReset: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ content, citations, caseData, onReset }) => {
  const [showSource, setShowSource] = useState(true);
  const [managerQuery, setManagerQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [clarifications, setClarifications] = useState<{question: string, answer: string}[]>([]);

  const handlePrint = () => {
    window.print();
  };

  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerQuery.trim() || !caseData || isQuerying) return;

    setIsQuerying(true);
    const question = managerQuery;
    setManagerQuery('');

    try {
      const answer = await clarifyAnalysis(caseData, question);
      setClarifications(prev => [...prev, { question, answer }]);
    } catch (err) {
      alert("Clarification failed. Please try again.");
    } finally {
      setIsQuerying(false);
    }
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
      
      if (line.includes("MANAGER'S COMBAT CHECKLIST") || line.includes("Push-back") || line.includes("🚨") || line.includes("DISCREPANCY")) {
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
          body { background: white !important; -webkit-print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .print-header { display: block !important; border-bottom: 2px solid #e2e8f0; margin-bottom: 2rem; padding-bottom: 1rem; }
          .print-section { break-inside: avoid; margin-bottom: 1.5rem; }
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
            <i className="fas fa-file-pdf"></i> Export PDF
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
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Observation Comparison</h4>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-700 uppercase mb-1">Appraiser Intake</p>
                  <p className="text-xs italic text-emerald-900">"{caseData.data.appraiserNotes || 'No notes'}"</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-700 uppercase mb-1">Technician Quote</p>
                  <p className="text-xs italic text-indigo-900">"{caseData.data.technicianNotes || 'No notes'}"</p>
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
            
            {/* PRINT ONLY HEADER */}
            <div className="hidden print:block print-header">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 m-0 uppercase leading-none">AUDIT DISCREPANCY REPORT</h1>
                  <p className="text-slate-500 font-bold m-0 uppercase text-[9px] tracking-[0.2em] mt-2">AutoAudit Pro | Canadian Dealer Intelligence Engine</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900 m-0">{new Date().toLocaleDateString('en-CA').toUpperCase()}</p>
                  <p className="text-[8px] font-bold text-slate-400 m-0 uppercase">Case ID: {caseData?.id.substring(0, 8)}</p>
                </div>
              </div>

              {caseData && (
                <div className="grid grid-cols-3 gap-6 border-y-2 border-slate-900 py-6 my-6 bg-slate-50/50">
                  <div>
                    <h5 className="text-[10px] font-black uppercase text-slate-400 mb-2">Vehicle Profile</h5>
                    <p className="text-sm font-black text-slate-900 m-0">{caseData.vehicle.year} {caseData.vehicle.make} {caseData.vehicle.model}</p>
                    <p className="text-[10px] font-mono font-bold text-slate-500 m-0">{caseData.vehicle.vin}</p>
                    <p className="text-[10px] font-bold text-slate-700 m-0 mt-1">{caseData.vehicle.kilometres.toLocaleString()} KM</p>
                  </div>
                  <div className="col-span-2">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 mb-2">Observation Contrast</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-2 border border-slate-200 rounded">
                         <p className="text-[8px] font-black text-emerald-600 uppercase mb-1">Manager Intake</p>
                         <p className="text-[9px] italic m-0">"{caseData.data.appraiserNotes}"</p>
                      </div>
                      <div className="bg-white p-2 border border-slate-200 rounded">
                         <p className="text-[8px] font-black text-indigo-600 uppercase mb-1">Service Quote</p>
                         <p className="text-[9px] italic m-0">"{caseData.data.technicianNotes}"</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="audit-content print:mt-4">
              {formatContent(content)}
            </div>

            {/* Clarification Chat History */}
            {clarifications.length > 0 && (
              <div className="mt-12 space-y-6 no-print border-t border-slate-100 pt-8 animate-in slide-in-from-bottom-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-comments text-indigo-500"></i> Audit Clarifications
                </h3>
                {clarifications.map((item, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="flex justify-end">
                      <div className="bg-slate-100 p-4 rounded-2xl rounded-tr-none max-w-[80%] border border-slate-200">
                        <p className="text-xs font-bold text-slate-700 leading-relaxed">{item.question}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-indigo-600 text-white p-4 rounded-2xl rounded-tl-none max-w-[80%] shadow-lg shadow-indigo-100">
                         <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase opacity-75">
                           <i className="fas fa-robot"></i> AI Clarification
                         </div>
                        <p className="text-xs font-medium leading-relaxed">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Query Input Box (Web Only) */}
            <div className="mt-12 no-print">
              <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <i className="fas fa-shield-alt text-8xl"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs">
                      <i className="fas fa-question"></i>
                    </div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">Manager's Action Center</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 leading-relaxed">
                    Ask for a push-back script, clarification on specific repairs, or technical standards proof.
                  </p>
                  <form onSubmit={handleQuerySubmit} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. 'Give me a combat script for the brake job' or 'Why is the detail $250?'" 
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
                      value={managerQuery}
                      onChange={(e) => setManagerQuery(e.target.value)}
                      disabled={isQuerying}
                    />
                    <button 
                      type="submit" 
                      disabled={isQuerying || !managerQuery.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all text-white px-6 py-3 rounded-xl text-xs font-black uppercase shadow-xl flex items-center gap-2"
                    >
                      {isQuerying ? <i className="fas fa-brain animate-bounce"></i> : <i className="fas fa-paper-plane"></i>}
                      {isQuerying ? 'Analyzing...' : 'Query'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {citations.length > 0 && (
              <div className="mt-12 pt-4 border-t border-slate-100 print:break-inside-avoid">
                <h4 className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-2">Data Sources & Regulatory Citations</h4>
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
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
