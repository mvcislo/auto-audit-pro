
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
// Fixed: Removed missing export 'getAppraiserProfiles' from storageService
import { getAllCases, getTechnicianProfiles } from '../services/storageService';
import { InspectionCase } from '../types';

interface DashboardProps {
  onSelectCase: (c: InspectionCase) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const cases = getAllCases();
  const techProfiles = getTechnicianProfiles();
  
  const filteredCases = cases.filter(c => 
    c.vehicle.vin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.data.technicianName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aggregate data for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('en-CA');
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayCases = cases.filter(c => new Date(c.timestamp).toLocaleDateString('en-CA') === date);
    return {
      date: date.split('-').slice(1).join('/'),
      cases: dayCases.length,
      variance: dayCases.reduce((acc, curr) => acc + (curr.data.serviceDepartmentEstimate - curr.data.managerAppraisalEstimate), 0)
    };
  });

  const totalVariance = cases.reduce((acc, curr) => acc + (curr.data.serviceDepartmentEstimate - curr.data.managerAppraisalEstimate), 0);
  const avgVariance = cases.length ? totalVariance / cases.length : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Audits</p>
          <h3 className="text-3xl font-black mt-1 text-slate-900">{cases.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Avg. Recon Variance</p>
          <h3 className={`text-3xl font-black mt-1 ${avgVariance > 1000 ? 'text-amber-600' : 'text-emerald-600'}`}>
            ${Math.abs(Math.round(avgVariance)).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Leaking Gross (Total)</p>
          <h3 className="text-3xl font-black mt-1 text-red-600">${Math.max(0, Math.round(totalVariance)).toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">HCUV Pass Rate</p>
          <h3 className="text-3xl font-black mt-1 text-emerald-600">
            {Math.round((cases.filter(c => c.data.hcuvOutcome === 'Pass').length / (cases.length || 1)) * 100)}%
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-chart-line text-indigo-500"></i> Performance Trend
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                  />
                  <Line type="monotone" dataKey="variance" stroke="#ef4444" strokeWidth={4} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} />
                  <Line type="monotone" dataKey="cases" stroke="#6366f1" strokeWidth={4} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-800 uppercase tracking-tight">Audit History Log</h4>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input 
                  type="text" 
                  placeholder="Search VIN/Model/Tech..." 
                  className="pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Vehicle</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Technician</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Variance</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Result</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.slice(0, 10).map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-slate-900">{c.vehicle.year} {c.vehicle.model}</p>
                        <p className="text-[10px] font-mono text-slate-400">{c.vehicle.vin}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{c.data.technicianName}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-black ${
                          (c.data.serviceDepartmentEstimate - c.data.managerAppraisalEstimate) > 1000 ? 'text-red-500' : 'text-emerald-500'
                        }`}>
                          +${(c.data.serviceDepartmentEstimate - c.data.managerAppraisalEstimate).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          c.data.hcuvOutcome === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {c.data.hcuvOutcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => onSelectCase(c)}
                          className="text-indigo-600 hover:text-indigo-900 font-bold text-xs uppercase"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCases.length === 0 && (
                <div className="p-10 text-center text-slate-400 italic text-sm">No audits found matching your criteria.</div>
              )}
            </div>
          </div>
        </div>

        {/* Reliability Ranking Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-user-shield text-indigo-500"></i> Reliability Matrix
            </h4>
            <div className="space-y-4">
              {techProfiles.sort((a, b) => b.accuracyRating - a.accuracyRating).map((tech, idx) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-md transition-all cursor-default">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                        tech.reliabilityTag === 'Aggressive' ? 'bg-red-100 text-red-600' :
                        tech.reliabilityTag === 'Accurate' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {tech.technicianName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 leading-none">{tech.technicianName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{tech.totalCases} AUDITS</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase ${
                      tech.reliabilityTag === 'Aggressive' ? 'bg-red-100 text-red-600' :
                      tech.reliabilityTag === 'Accurate' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {tech.reliabilityTag}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Accuracy Rating</span>
                      <span className="text-slate-900">{Math.round(tech.accuracyRating)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          tech.accuracyRating > 80 ? 'bg-emerald-500' : tech.accuracyRating > 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${tech.accuracyRating}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-2">
                      AVG VARIANCE: <span className={tech.avgVariance > 1000 ? 'text-red-500' : 'text-emerald-600'}>${Math.round(tech.avgVariance).toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
            <i className="fas fa-robot absolute -bottom-4 -right-4 text-8xl text-indigo-500/30"></i>
            <h5 className="font-black uppercase tracking-tighter mb-2 relative z-10">Manager Tip</h5>
            <p className="text-xs text-indigo-100 leading-relaxed relative z-10">
              Your technicians with <strong>"Aggressive"</strong> tags are currently costing the dealership an average of 
              <strong> ${Math.round(avgVariance)}</strong> per vehicle in potential gross margin leakage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
