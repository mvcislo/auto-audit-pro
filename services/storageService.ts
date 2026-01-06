
import { InspectionCase, PerformanceStats, HistoricalAggregates } from '../types';

const STORAGE_KEY = 'auto_audit_cases';

export const saveCase = (newCase: InspectionCase) => {
  const cases = getAllCases();
  cases.unshift(newCase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

export const getAllCases = (): InspectionCase[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getTechnicianProfiles = (): PerformanceStats[] => {
  const cases = getAllCases();
  const techMap = new Map<string, { total: number; variance: number; count: number }>();

  cases.forEach(c => {
    if (!c.data.technicianName) return;
    const stats = techMap.get(c.data.technicianName) || { total: 0, variance: 0, count: 0 };
    const variance = c.data.serviceDepartmentEstimate - c.data.managerAppraisalEstimate;
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
      appraiserName: '', // Placeholder
      totalCases: stats.count,
      avgVariance,
      accuracyRating: Math.max(0, 100 - (Math.abs(avgVariance) / 100)),
      reliabilityTag: tag
    };
  });
};

export const getAppraiserProfiles = (): PerformanceStats[] => {
  const cases = getAllCases();
  const appraiserMap = new Map<string, { total: number; variance: number; count: number }>();

  cases.forEach(c => {
    if (!c.data.appraiserName) return;
    const stats = appraiserMap.get(c.data.appraiserName) || { total: 0, variance: 0, count: 0 };
    const variance = c.data.serviceDepartmentEstimate - c.data.managerAppraisalEstimate;
    stats.variance += variance;
    stats.count += 1;
    appraiserMap.set(c.data.appraiserName, stats);
  });

  return Array.from(appraiserMap.entries()).map(([name, stats]) => {
    const avgVariance = stats.variance / stats.count;
    return {
      technicianName: '',
      appraiserName: name,
      totalCases: stats.count,
      avgVariance,
      accuracyRating: Math.max(0, 100 - (Math.abs(avgVariance) / 100)),
      reliabilityTag: avgVariance < 0 ? 'Passive' : 'Aggressive'
    };
  });
};

export const getHistoricalContext = (make: string, model: string, year: number): HistoricalAggregates | null => {
  const cases = getAllCases();
  const filtered = cases.filter(c => 
    c.vehicle.make.toLowerCase() === make.toLowerCase() && 
    c.vehicle.model.toLowerCase() === model.toLowerCase()
  );

  if (filtered.length === 0) return null;

  const totalCost = filtered.reduce((acc, curr) => acc + (curr.data.serviceDepartmentEstimate || 0), 0);
  
  return {
    modelName: model,
    year,
    avgReconCost: totalCost / filtered.length,
    commonFailureCount: {}, // Simplified for now
    totalCases: filtered.length
  };
};
