
import React from 'react';

interface AnalysisViewProps {
  content: string;
  citations: any[];
  onReset: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ content, citations, onReset }) => {
  const handlePrint = () => {
    window.print();
  };

  const formatContent = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-black text-slate-900 mt-6 mb-3 border-b-2 border-slate-900 pb-1 uppercase tracking-tight print:text-xl print:mt-2">{line.substring(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-indigo-800 mt-6 mb-2 flex items-center gap-2 print:text-sm print:mt-4 print:text-slate-800 break-after-avoid">{line.substring(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-md font-bold text-slate-700 mt-4 mb-1 print:text-xs">{line.substring(4)}</h3>;
      
      // Lists
      if (line.startsWith('- ')) return <li key={i} className="ml-5 mb-1 text-slate-700 text-sm list-disc print:text-[10px] print:ml-4">{line.substring(2)}</li>;
      
      // Bold items
      if (line.includes('**')) {
        const parts = line.split('**');
        return <p key={i} className="mb-2 text-sm text-slate-700 leading-relaxed print:text-[10px] print:mb-1">{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-slate-900 font-bold">{p}</strong> : p)}</p>;
      }
      
      // Critical "Combat Checklist" Styling
      if (line.includes("MANAGER'S COMBAT CHECKLIST") || line.includes("Push-back") || line.includes("🚨")) {
         return <div key={i} className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl my-4 text-red-900 font-bold text-sm break-inside-avoid print:my-2 print:p-2 print:text-[10px] print:bg-slate-50 print:border-red-400">
           {line}
         </div>;
      }

      // Proof Indicators
      if (line.toLowerCase().includes("proof") || line.toLowerCase().includes("measurement")) {
        return <p key={i} className="bg-indigo-50 px-2 py-1 inline-block rounded text-indigo-700 font-bold text-[11px] mb-2 print:text-[9px] print:bg-slate-100">{line}</p>;
      }

      if (line.trim() === '') return <div key={i} className="h-2 print:h-1"></div>;
      return <p key={i} className="mb-2 text-sm text-slate-700 leading-relaxed print:text-[10px] print:mb-1">{line}</p>;
    });
  };

  const safeCitations = citations || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in zoom-in duration-500">
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          body { 
            background: white !important; 
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 10pt;
          }
          header, .no-print, button, nav, aside { 
            display: none !important; 
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container { 
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .break-inside-avoid { 
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          p, li {
            margin-bottom: 0.15rem !important;
          }
          h1, h2, h3 { margin-top: 0.5rem !important; }
        }
      `}</style>

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm sticky top-20 z-40 border border-slate-200 no-print">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
          <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">Strategic Audit Complete</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
          >
            <i className="fas fa-file-pdf"></i> Export Audit PDF
          </button>
          <button 
            onClick={onReset}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
          >
            New Audit
          </button>
        </div>
      </div>

      <div className="print-container bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 prose prose-slate max-w-none">
        <div className="hidden print:block mb-4 border-b-4 border-slate-900 pb-2">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-slate-900 m-0 p-0 uppercase leading-none">RECON AUDIT REPORT</h1>
              <p className="text-slate-500 font-bold m-0 p-0 uppercase text-[8px] tracking-[0.2em]">Dealer Operations Intelligence Agency</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-900 m-0 leading-none">{new Date().toLocaleDateString('en-CA').toUpperCase()}</p>
              <p className="text-[8px] font-bold text-slate-400 m-0 uppercase">Internal Document - Confidential</p>
            </div>
          </div>
        </div>

        <div className="audit-content">
          {formatContent(content)}
        </div>

        {safeCitations.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100 break-inside-avoid">
            <h4 className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-1">Market Verification Data</h4>
            <div className="grid grid-cols-2 gap-x-4">
              {safeCitations.slice(0, 4).map((cite, idx) => (
                <div key={idx} className="flex items-center gap-1 text-[8px] text-slate-500 truncate">
                  <span className="text-indigo-600 font-black">»</span>
                  <span className="truncate">{cite.web?.title || cite.web?.uri}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="text-center text-[10px] text-slate-400 no-print pb-10 uppercase tracking-widest font-bold">
        <p>Warning: This audit is designed for managerial use only. Review with Service Manager before confronting technicians.</p>
      </div>
    </div>
  );
};

export default AnalysisView;
