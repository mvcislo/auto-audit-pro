
import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import InspectionForm from './components/InspectionForm';
import AnalysisView from './components/AnalysisView';
import AdminView from './components/AdminView';
import { Vehicle, InspectionData, InspectionCase, AnalysisMode } from './types';
import { analyzeInspection } from './services/geminiService';
import { saveCase, getHistoricalContext, getAllCases } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'audit' | 'admin'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCase, setActiveCase] = useState<InspectionCase | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<{ text: string; citations: any[] } | null>(null);
  const [autoFilledData, setAutoFilledData] = useState<Partial<InspectionData>>({});

  const handleAnalyze = async (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => {
    setIsLoading(true);
    try {
      const history = getHistoricalContext(vehicle.make, vehicle.model, vehicle.year);
      const result = await analyzeInspection({ vehicle, data, mode }, history, mode);
      
      setCurrentAnalysis({ text: result.text, citations: result.citations });

      if (result.detectedTotal) {
        setAutoFilledData({ serviceDepartmentEstimate: result.detectedTotal });
      }

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
        detectedTotal: result.detectedTotal
      };
      setActiveCase(newCase);
      saveCase(newCase);
    } catch (error: any) {
      console.error("Audit Error:", error);
      // Fixed: Implement required error handling for missing API key/project as per Gemini API guidelines.
      if (error.message?.includes('Requested entity was not found.')) {
        if (window.aistudio?.openSelectKey) {
          await window.aistudio.openSelectKey();
        }
      } else if (error.message?.includes('RATE_LIMIT')) {
        alert("⚠️ Usage Limit Reached:\n\nGemini Pro (Free Tier) only allows 2 audits per minute. Please wait about 45-60 seconds before trying again.");
      } else {
        alert(`Analysis failed: ${error.message || "Please check your network connection and API key."}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCase = (c: InspectionCase) => {
    setActiveCase(c);
    setCurrentAnalysis({ 
      text: c.analysis || "Report not found.", 
      citations: [] 
    });
  };

  const renderContent = () => {
    if (currentAnalysis) {
      return (
        <AnalysisView 
          content={currentAnalysis.text} 
          citations={currentAnalysis.citations}
          caseData={activeCase || undefined}
          onReset={() => {
            setCurrentAnalysis(null);
            // If we have an active case, let's pre-fill the form to "Edit"
            if (activeCase) {
              setAutoFilledData(activeCase.data);
              setCurrentView('audit');
            }
          }} 
        />
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onSelectCase={handleSelectCase} />;
      case 'admin':
        return <AdminView />;
      case 'audit':
        return (
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-black text-slate-900">Strategic Recon Audit</h2>
              <p className="text-slate-500 font-medium">AI cross-referencing tech claims against dealership library.</p>
            </div>
            <InspectionForm 
              onAnalyze={handleAnalyze} 
              isLoading={isLoading} 
              initialData={autoFilledData as any}
            />
          </div>
        );
      default:
        return <Dashboard onSelectCase={handleSelectCase} />;
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <Header 
        currentView={currentAnalysis ? 'audit' : currentView} 
        onNavigate={(view) => {
          setCurrentView(view);
          setCurrentAnalysis(null);
          setActiveCase(null);
        }} 
      />
      
      <main className="max-w-7xl mx-auto px-4 mt-8">
        {renderContent()}
      </main>
      
      {!currentAnalysis && currentView === 'dashboard' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-50">
          <button 
            onClick={() => setCurrentView('audit')}
            className="bg-indigo-600 text-white px-8 py-4 rounded-full font-black shadow-2xl shadow-indigo-200 flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> NEW AUDIT
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
