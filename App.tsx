
import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import InspectionForm from './components/InspectionForm';
import AnalysisView from './components/AnalysisView';
import AdminView from './components/AdminView';
import { Vehicle, InspectionData, InspectionCase, AnalysisMode, PostReviewStatus } from './types';
import { analyzeInspection } from './services/geminiService';
import { saveCase, getHistoricalContext } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'audit' | 'admin'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCase, setActiveCase] = useState<InspectionCase | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<{ text: string; citations: any[] } | null>(null);
  const [autoFilledData, setAutoFilledData] = useState<Partial<InspectionData>>({});

  const handleAnalyze = async (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => {
    setIsLoading(true);
    try {
      const history = await getHistoricalContext(vehicle.make, vehicle.model, vehicle.year);
      const result = await analyzeInspection({ vehicle, data, mode }, history, mode);

      setCurrentAnalysis({ text: result.text, citations: result.citations });

      const newCase: InspectionCase = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        mode,
        vehicle,
        data: {
          ...data,
          serviceDepartmentEstimate: result.detectedTotal || data.serviceDepartmentEstimate
        },
        analysis: result.text,
        detectedTotal: result.detectedTotal,
        currentStatus: data.program as unknown as PostReviewStatus,
        statusHistory: []
      };

      setActiveCase(newCase);
      await saveCase(newCase);
    } catch (error: any) {
      console.error("Audit Error:", error);
      alert(`Analysis failed: ${error.message || "Network error."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCase = (updated: InspectionCase) => {
    setActiveCase(updated);
  };

  const handleSelectCase = (c: InspectionCase) => {
    setActiveCase(c);
    setCurrentAnalysis({ text: c.analysis || "N/A", citations: [] });
  };

  const renderContent = () => {
    if (currentAnalysis) {
      return (
        <AnalysisView
          content={currentAnalysis.text}
          citations={currentAnalysis.citations}
          caseData={activeCase || undefined}
          onUpdateCase={handleUpdateCase}
          onReset={() => {
            setCurrentAnalysis(null);
            if (activeCase) {
              setAutoFilledData(activeCase.data);
              setCurrentView('audit');
            }
          }}
        />
      );
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard onSelectCase={handleSelectCase} />;
      case 'admin': return <AdminView />;
      case 'audit': return (
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-slate-900">Strategic Recon Audit</h2>
            <p className="text-slate-500 font-medium">Protecting gross profit through technical accountability.</p>
          </div>
          <InspectionForm onAnalyze={handleAnalyze} isLoading={isLoading} initialData={autoFilledData as any} />
        </div>
      );
      default: return <Dashboard onSelectCase={handleSelectCase} />;
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <Header currentView={currentAnalysis ? 'audit' : currentView} onNavigate={(view) => { setCurrentView(view); setCurrentAnalysis(null); setActiveCase(null); }} />
      <main className="max-w-7xl mx-auto px-4 mt-8">{renderContent()}</main>
    </div>
  );
};

export default App;
