
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { getAllCases, getTechnicianProfiles, getAppraiserProfiles } from '../services/storageService';

const Dashboard: React.FC = () => {
  const cases = getAllCases();
  const techProfiles = getTechnicianProfiles();
  const appraiserProfiles = getAppraiserProfiles();

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Total Audits</p>
          <h3 className="text-3xl font-bold mt-1">{cases.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Avg. Recon Variance</p>
          <h3 className={`text-3xl font-bold mt-1 ${avgVariance > 1000 ? 'text-red-500' : 'text-emerald-500'}`}>
            ${Math.abs(avgVariance).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Leaking Gross (Est.)</p>
          <h3 className="text-3xl font-bold mt-1 text-red-600">${Math.max(0, totalVariance).toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">HCUV Pass Rate</p>
          <h3 className="text-3xl font-bold mt-1">
            {Math.round((cases.filter(c => c.data.hcuvOutcome === 'Pass').length / (cases.length || 1)) * 100)}%
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-6">Volume & Variance Trend</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="variance" stroke="#ef4444" strokeWidth={3} />
                <Line type="monotone" dataKey="cases" stroke="#6366f1" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-6">Technician Reliability Ranking</h4>
          <div className="space-y-4">
            {techProfiles.sort((a, b) => b.accuracyRating - a.accuracyRating).map((tech, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">
                    {tech.technicianName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{tech.technicianName}</p>
                    <p className="text-xs text-slate-500">{tech.totalCases} cases audited</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                    tech.reliabilityTag === 'Aggressive' ? 'bg-red-100 text-red-600' :
                    tech.reliabilityTag === 'Accurate' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {tech.reliabilityTag}
                  </span>
                  <p className="text-xs font-bold mt-1">${tech.avgVariance.toLocaleString()} avg variance</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
