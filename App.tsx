
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
  const [autoFilledVehicle, setAutoFilledVehicle] = useState<Partial<Vehicle>>({});
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleAnalyze = async (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => {
    setIsLoading(true);
    // Preserving current form state for "back and forth"
    setAutoFilledVehicle(vehicle);
    setAutoFilledData(data);
    try {
      const history = await getHistoricalContext(vehicle.make, vehicle.model, vehicle.year);
      const result = await analyzeInspection({ vehicle, data, mode }, history, mode);

      setCurrentAnalysis({ text: result.text, citations: result.citations });
      setShowAnalysis(true);

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
    setAutoFilledVehicle(c.vehicle);
    setAutoFilledData(c.data);
    setShowAnalysis(true);
  };

  const handleNewAudit = () => {
    setCurrentAnalysis(null);
    setShowAnalysis(false);
    setActiveCase(null);
    setAutoFilledData({});
    setAutoFilledVehicle({});
    setCurrentView('audit');
  };

  const renderContent = () => {
    if (currentAnalysis && showAnalysis) {
      return (
        <AnalysisView
          content={currentAnalysis.text}
          citations={currentAnalysis.citations}
          caseData={activeCase || undefined}
          onUpdateCase={handleUpdateCase}
          onReset={() => {
            setShowAnalysis(false);
            setCurrentView('audit');
          }}
          onNew={handleNewAudit}
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
          <div className="flex justify-end mb-4">
            <button onClick={handleNewAudit} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">
              <i className="fas fa-plus mr-2"></i> New
            </button>
          </div>
          <InspectionForm
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            initialData={autoFilledData as any}
            initialVehicle={autoFilledVehicle as any}
            hasAnalysis={!!currentAnalysis}
            onShowAnalysis={() => setShowAnalysis(true)}
          />
        </div>
      );
      default: return <Dashboard onSelectCase={handleSelectCase} />;
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <Header
        currentView={currentAnalysis && showAnalysis ? 'audit' : currentView}
        onNavigate={(view) => {
          if (view === 'audit') {
            setShowAnalysis(false); // Back to form if they click "New Case"
            setCurrentView('audit');
          } else {
            setCurrentView(view);
            setCurrentAnalysis(null);
            setActiveCase(null);
            setShowAnalysis(false);
            setAutoFilledData({});
            setAutoFilledVehicle({});
          }
        }}
      />
      <main className="max-w-7xl mx-auto px-4 mt-8">{renderContent()}</main>
    </div>
  );
};

export default App;
