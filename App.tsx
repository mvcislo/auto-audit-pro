
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import InspectionForm from './components/InspectionForm';
import AnalysisView from './components/AnalysisView';
import { Vehicle, InspectionData, InspectionCase, AnalysisMode } from './types';
import { analyzeInspection } from './services/geminiService';
import { saveCase, getHistoricalContext, getAllCases } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'audit'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<{ text: string; citations: any[] } | null>(null);
  const [autoFilledData, setAutoFilledData] = useState<Partial<InspectionData>>({});

  const handleAnalyze = async (vehicle: Vehicle, data: InspectionData, mode: AnalysisMode) => {
    setIsLoading(true);
    try {
      const history = getHistoricalContext(vehicle.make, vehicle.model, vehicle.year);
      const result = await analyzeInspection({ vehicle, data, mode } as any, history, mode);
      
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
      saveCase(newCase);
    } catch (error) {
      console.error("Analysis Error:", error);
      alert("AI analysis failed. Please check your API key and connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCase = (c: InspectionCase) => {
    setCurrentAnalysis({ 
      text: c.analysis || "Report not found.", 
      citations: [] 
    });
  };

  return (
    <div className="min-h-screen pb-20">
      <Header 
        currentView={currentAnalysis ? 'audit' : currentView} 
        onNavigate={(view) => {
          setCurrentView(view);
          setCurrentAnalysis(null);
        }} 
      />
      
      <main className="max-w-7xl mx-auto px-4 mt-8">
        {currentAnalysis ? (
          <AnalysisView 
            content={currentAnalysis.text} 
            citations={currentAnalysis.citations}
            onReset={() => setCurrentAnalysis(null)} 
          />
        ) : currentView === 'dashboard' ? (
          <Dashboard onSelectCase={handleSelectCase} />
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-black text-slate-900">New Strategic Audit</h2>
              <p className="text-slate-500 font-medium">Protect your gross profit with AI-powered inspection verification.</p>
            </div>
            <InspectionForm 
              onAnalyze={handleAnalyze} 
              isLoading={isLoading} 
              initialData={autoFilledData as any}
            />
          </div>
        )}
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
