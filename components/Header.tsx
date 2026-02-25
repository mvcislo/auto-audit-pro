
import React from 'react';

interface HeaderProps {
  onNavigate: (view: 'dashboard' | 'audit' | 'admin') => void;
  currentView: string;
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentView }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <i className="fas fa-car-side text-lg"></i>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">AutoAudit Pro</h1>
            <span className="text-xs text-slate-500 font-medium">Dealer Intelligence Engine</span>
          </div>
        </div>
        
        <nav className="flex items-center gap-6">
          <button 
            onClick={() => onNavigate('dashboard')}
            className={`text-sm font-semibold transition-colors ${currentView === 'dashboard' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => onNavigate('admin')}
            className={`text-sm font-semibold transition-colors ${currentView === 'admin' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Library
          </button>
          <button 
            onClick={() => onNavigate('audit')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${currentView === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            New Case
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
