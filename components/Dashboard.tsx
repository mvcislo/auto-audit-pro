
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { getAllCases } from '../services/storageService';
import { InspectionCase } from '../types';

interface DashboardProps {
  onSelectCase: (c: InspectionCase) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'ytd' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cases, setCases] = useState<InspectionCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const casesData = await getAllCases();
        setCases(casesData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const timeFilteredCases = cases.filter(c => {
    const caseDate = new Date(c.timestamp);
    const now = new Date();

    if (timeRange === 'month') {
      return caseDate.getMonth() === now.getMonth() && caseDate.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'ytd') {
      return caseDate.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'custom' && startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      return caseDate >= s && caseDate <= e;
    }
    return true; // 'all'
  });

  const filteredCases = timeFilteredCases.filter(c =>
    c.vehicle.vin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.data.technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.stockNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const techProfiles = React.useMemo(() => {
    const techMap = new Map<string, { total: number; variance: number; count: number }>();
    timeFilteredCases.forEach(c => {
      if (!c.data.technicianName) return;
      const stats = techMap.get(c.data.technicianName) || { total: 0, variance: 0, count: 0 };
      const variance = (c.data.serviceDepartmentEstimate || 0) - (c.data.managerAppraisalEstimate || 0);
      stats.variance += variance;
      stats.count += 1;
      techMap.set(c.data.technicianName, stats);
    });

    return Array.from(techMap.entries()).map(([name, stats]) => {
      const avgVariance = stats.variance / stats.count;
      let tag: 'Aggressive' | 'Accurate' | 'Passive' = 'Accurate';
      if (avgVariance > 1500) tag = 'Aggressive';
      else if (avgVariance < -500) tag = 'Passive';

      return {
        technicianName: name,
        appraiserName: '',
        totalCases: stats.count,
        avgVariance,
        accuracyRating: Math.max(0, 100 - (Math.abs(avgVariance) / 100)),
        reliabilityTag: tag
      };
    });
  }, [timeFilteredCases]);

  // Aggregate data for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('en-CA');
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayCases = timeFilteredCases.filter(c => new Date(c.timestamp).toLocaleDateString('en-CA') === date);
    return {
      date: date.split('-').slice(1).join('/'),
      cases: dayCases.length,
      variance: dayCases.reduce((acc, curr) => acc + ((curr.data.serviceDepartmentEstimate || 0) - (curr.data.managerAppraisalEstimate || 0)), 0)
    };
  });

  const totalVariance = timeFilteredCases.reduce((acc, curr) => acc + ((curr.data.serviceDepartmentEstimate || 0) - (curr.data.managerAppraisalEstimate || 0)), 0);
  const avgVariance = timeFilteredCases.length ? totalVariance / timeFilteredCases.length : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search and Time Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        <div className="relative w-full md:w-96">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            placeholder="Search by VIN, Stock, Model, or Tech..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto w-full md:w-auto">
          {(['all', 'month', 'ytd', 'custom'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${timeRange === r ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {r === 'all' ? 'All Time' : r === 'month' ? 'This Month' : r === 'ytd' ? 'YTD' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {timeRange === 'custom' && (
        <div className="flex gap-4 p-6 bg-white rounded-2xl border border-indigo-100 shadow-sm animate-in slide-in-from-top-2 no-print">
          <div className="flex-1">
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-2">Start Date</label>
            <input
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-2">End Date</label>
            <input
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Audits</p>
          <h3 className="text-3xl font-black mt-1 text-slate-900">{timeFilteredCases.length}</h3>
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
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Program Rate</p>
          <h3 className="text-3xl font-black mt-1 text-emerald-600">
            {Math.round((timeFilteredCases.filter(c => ['HCUV', 'HAPO', 'Certified'].includes(c.currentStatus)).length / (timeFilteredCases.length || 1)) * 100)}%
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-chart-line text-indigo-500"></i> Performance Trend
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="variance" stroke="#ef4444" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                  <Line type="monotone" dataKey="cases" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-800 uppercase tracking-tight">Inventory Lifecycle Log</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Unit Profile</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Technician</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Variance</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Current Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.slice(0, 10).map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-100 p-2 rounded text-slate-400">
                            <i className="fas fa-car-side"></i>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{c.vehicle.year} {c.vehicle.model}</p>
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
                              {c.vehicle.stockNumber ? `#${c.vehicle.stockNumber} • ` : ''}{c.vehicle.vin}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{c.data.technicianName || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-black ${(c.data.serviceDepartmentEstimate - c.data.managerAppraisalEstimate) > 1000 ? 'text-red-500' : 'text-emerald-500'
                          }`}>
                          ${(c.data.serviceDepartmentEstimate - c.data.managerAppraisalEstimate).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${['HCUV', 'HAPO', 'Certified'].includes(c.currentStatus)
                          ? 'bg-indigo-100 text-indigo-700'
                          : c.currentStatus === 'Wholesale' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                          {c.currentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onSelectCase(c)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-[10px] uppercase transition-all"
                        >
                          Audit File
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCases.length === 0 && (
                <div className="p-10 text-center text-slate-400 italic text-sm">No inventory audits found.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-user-shield text-indigo-500"></i> Shop Reliability
            </h4>
            <div className="space-y-4">
              {techProfiles.sort((a, b) => b.accuracyRating - a.accuracyRating).slice(0, 5).map((tech, idx) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${tech.reliabilityTag === 'Aggressive' ? 'bg-red-100 text-red-600' :
                        tech.reliabilityTag === 'Accurate' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                        {tech.technicianName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 leading-none">{tech.technicianName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{tech.totalCases} CASES</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Performance Index</span>
                      <span className="text-slate-900">{Math.round(tech.accuracyRating)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${tech.accuracyRating > 80 ? 'bg-emerald-500' : tech.accuracyRating > 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        style={{ width: `${tech.accuracyRating}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
