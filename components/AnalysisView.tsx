
import React, { useState } from 'react';
import { InspectionCase, PostReviewStatus, StatusHistoryEntry } from '../types';
import { clarifyAnalysis } from '../services/geminiService';
import { saveCase } from '../services/storageService';

interface AnalysisViewProps {
  content: string;
  citations: any[];
  caseData?: InspectionCase;
  onReset: () => void;
  onUpdateCase?: (updated: InspectionCase) => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ content, citations, caseData, onReset, onUpdateCase }) => {
  const currentYear = new Date().getFullYear();
  const [showSource, setShowSource] = useState(true);
  const [managerQuery, setManagerQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [clarifications, setClarifications] = useState<{ question: string, answer: string }[]>([]);

  const handlePrint = () => {
    window.print();
  };

  const checkEligibility = (status: PostReviewStatus): { ok: boolean; reason?: string } => {
    if (!caseData) return { ok: true };
    const age = currentYear - caseData.vehicle.year;
    const kms = caseData.vehicle.kilometres;

    if (status === PostReviewStatus.HCUV) {
      if (age > 6) return { ok: false, reason: 'Age > 6yr' };
      if (kms > 120000) return { ok: false, reason: 'KM > 120k' };
    }
    if (status === PostReviewStatus.HAPO) {
      if (age > 10) return { ok: false, reason: 'Age > 10yr' };
      if (kms > 200000) return { ok: false, reason: 'KM > 200k' };
    }
    return { ok: true };
  };

  const determineMoveType = (from: PostReviewStatus, to: PostReviewStatus): 'Upgrade' | 'Downgrade' | 'Lateral' => {
    const hierarchy = {
      [PostReviewStatus.HCUV]: 4,
      [PostReviewStatus.HAPO]: 3,
      [PostReviewStatus.CERTIFIED]: 2,
      [PostReviewStatus.AS_IS_RETAIL]: 1,
      [PostReviewStatus.WHOLESALE]: 0
    };
    const diff = hierarchy[to] - hierarchy[from];
    if (diff > 0) return 'Upgrade';
    if (diff < 0) return 'Downgrade';
    return 'Lateral';
  };

  const handleStatusChange = async (newStatus: PostReviewStatus) => {
    if (!caseData || newStatus === caseData.currentStatus) return;

    const eligibility = checkEligibility(newStatus);
    if (!eligibility.ok) {
      alert(`Vehicle ineligible for ${newStatus}: ${eligibility.reason}`);
      return;
    }

    const entry: StatusHistoryEntry = {
      from: caseData.currentStatus,
      to: newStatus,
      timestamp: Date.now(),
      type: determineMoveType(caseData.currentStatus, newStatus)
    };

    const updatedCase: InspectionCase = {
      ...caseData,
      currentStatus: newStatus,
      statusHistory: [...caseData.statusHistory, entry]
    };

    await saveCase(updatedCase);
    if (onUpdateCase) onUpdateCase(updatedCase);
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
      alert("Clarification failed.");
    } finally {
      setIsQuerying(false);
    }
  };

  const formatContent = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-black text-slate-900 mt-6 mb-3 border-b-2 border-slate-900 pb-1 uppercase tracking-tight print:text-xl">{line.substring(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-indigo-800 mt-6 mb-2 flex items-center gap-2 print:text-sm">{line.substring(3)}</h2>;
      if (line.startsWith('- ')) return <li key={i} className="ml-5 mb-1 text-slate-700 text-sm list-disc print:text-[10px]">{line.substring(2)}</li>;
      if (line.trim() === '') return <div key={i} className="h-2"></div>;

      let className = "mb-2 text-sm text-slate-700 leading-relaxed print:text-[10px]";
      if (line.includes("🚨") || line.includes("DISCREPANCY")) className += " bg-red-50 border-l-4 border-red-600 p-3 rounded-r-xl font-bold";

      return <p key={i} className={className}>{line}</p>;
    });
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in zoom-in duration-500">
      <style>{`
        @media print {
          @page { size: auto; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .print-header { border-bottom: 3px solid #0f172a; margin-bottom: 1.5rem; padding-bottom: 1rem; display: block !important; }
          .print-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; width: 100% !important; }
          .print-img { width: 100% !important; height: 180px !important; object-fit: cover !important; border: 1px solid #e2e8f0; border-radius: 6px; page-break-inside: avoid; }
        }
      `}</style>

      {/* Control Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm sticky top-20 z-40 border border-slate-200 no-print mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSource(!showSource)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-600">
            {showSource ? 'Hide Inputs' : 'Show Inputs'}
          </button>
          {caseData && (
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="text-[10px] font-black text-indigo-700 uppercase">Current Tier:</span>
              <span className="text-xs font-black text-indigo-900">{caseData.currentStatus}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2">
            <i className="fas fa-file-pdf"></i> Print / Save PDF
          </button>
          <button onClick={onReset} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">
            <i className="fas fa-arrow-left mr-2"></i> New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {showSource && caseData && (
          <div className="lg:col-span-4 space-y-4 no-print sticky top-40">
            {/* Outcome Control Center */}
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Outcome Lifecycle</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[8px] font-black uppercase text-indigo-400 mb-2">Assign Final Strategy</label>
                  <select
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={caseData.currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value as PostReviewStatus)}
                  >
                    {Object.values(PostReviewStatus).map(s => {
                      const eligibility = checkEligibility(s);
                      return (
                        <option key={s} value={s} disabled={!eligibility.ok} className={eligibility.ok ? 'text-slate-900' : 'text-slate-400 font-normal'}>
                          {s} {eligibility.ok ? '' : `(${eligibility.reason})`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {caseData.statusHistory.length > 0 && (
                  <div className="pt-4 border-t border-white/10 space-y-2">
                    <p className="text-[9px] font-black uppercase text-slate-400">History & Variance</p>
                    {caseData.statusHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] bg-white/5 p-2 rounded-lg">
                        <span className="font-bold">{h.from} → {h.to}</span>
                        <span className={`font-black uppercase ${h.type === 'Upgrade' ? 'text-emerald-400' : h.type === 'Downgrade' ? 'text-red-400' : 'text-slate-400'}`}>
                          {h.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Observation Context</h4>
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="font-black text-emerald-800 uppercase mb-1">Intake</p>
                  <p className="italic text-emerald-900">"{caseData.data.appraiserNotes}"</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="font-black text-indigo-800 uppercase mb-1">Shop Claim</p>
                  <p className="italic text-indigo-900">"{caseData.data.technicianNotes}"</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`${showSource ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all print:lg:col-span-12`}>
          <div className="print-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 prose max-w-none print:shadow-none print:p-0">

            {/* PRINT ONLY HEADER */}
            <div className="hidden print:block print-header">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 m-0 uppercase leading-none">RECON AUDIT REPORT</h1>
                  <p className="text-slate-500 font-bold m-0 uppercase text-[9px] tracking-widest mt-2">AutoAudit Pro | {caseData?.currentStatus} UNIT</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900 m-0 uppercase">{new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-[8px] font-bold text-slate-400 m-0 uppercase">ID: {caseData?.id.split('-')[0]}</p>
                </div>
              </div>

              {caseData && (
                <div className="bg-slate-50 p-6 rounded-xl border-2 border-slate-900 mb-8">
                  <h4 className="text-[12px] font-black uppercase text-slate-900 mb-4 border-b border-slate-300 pb-2">Vehicle Profile</h4>
                  <div className="grid grid-cols-2 gap-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Year/Make/Model</p>
                      <p className="text-lg font-black text-slate-900 m-0 leading-tight uppercase">
                        {caseData.vehicle.year} {caseData.vehicle.make} {caseData.vehicle.model}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">VIN / Serial #</p>
                      <p className="text-sm font-mono font-bold text-slate-900 m-0">{caseData.vehicle.vin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Odometer (KM)</p>
                      <p className="text-sm font-bold text-slate-900 m-0">{caseData.vehicle.kilometres.toLocaleString()} KM</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Stock Number</p>
                      <p className="text-sm font-black text-slate-900 m-0">{caseData.vehicle.stockNumber || 'PENDING'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="audit-content">
              {formatContent(content)}
            </div>

            {/* GROUNDING SOURCES DISPLAY (MANDATORY PER GUIDELINES) */}
            {citations.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100 no-print">
                <h4 className="text-xs font-black text-slate-900 uppercase mb-4 flex items-center gap-2">
                  <i className="fas fa-search text-indigo-500"></i> Grounding Sources
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {citations.map((chunk, i) => chunk.web && (
                    <a
                      key={i}
                      href={chunk.web.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-3 no-underline group"
                    >
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-slate-200 group-hover:border-indigo-100">
                        <i className="fas fa-external-link-alt text-[10px]"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-900 m-0 truncate leading-tight uppercase">{chunk.web.title || 'Source Reference'}</p>
                        <p className="text-[8px] text-slate-400 m-0 truncate">{chunk.web.uri}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Gallery (2-Column Grid) */}
            {caseData && caseData.data.attachments.length > 0 && (
              <div className="mt-12">
                <h4 className="text-sm font-black uppercase border-b-2 border-slate-900 pb-2 mb-6">Evidence Gallery</h4>
                <div className="grid grid-cols-2 gap-4 print:print-grid">
                  {caseData.data.attachments.map((img, i) => (
                    <img key={i} src={img} className="w-full h-48 object-cover rounded-xl border border-slate-200 print:print-img" alt="" />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12 no-print">
              <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <h4 className="text-sm font-black text-white uppercase mb-4 flex items-center gap-2">
                    <i className="fas fa-bolt text-indigo-400"></i> Audit Action Query
                  </h4>
                  <form onSubmit={handleQuerySubmit} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask for a push-back script or technical standard proof..."
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none"
                      value={managerQuery}
                      onChange={(e) => setManagerQuery(e.target.value)}
                    />
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase">
                      {isQuerying ? <i className="fas fa-brain animate-bounce"></i> : 'Ask AI'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {clarifications.length > 0 && (
              <div className="mt-8 space-y-4 no-print border-t pt-8">
                {clarifications.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Manager Query: {item.question}</p>
                    <div className="bg-indigo-50 p-4 rounded-xl text-xs text-indigo-900 leading-relaxed font-medium">
                      {item.answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
