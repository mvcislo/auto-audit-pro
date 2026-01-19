
import { InspectionCase, PerformanceStats, HistoricalAggregates, StandardDocument, DealershipBrand, Appraiser, Technician } from '../types';

const STORAGE_KEY = 'auto_audit_cases';
const STANDARDS_KEY = 'auto_audit_standards';
const BRAND_KEY = 'auto_audit_brand';
const APPRAISERS_KEY = 'auto_audit_appraisers';
const TECHNICIANS_KEY = 'auto_audit_technicians';

export const saveBrand = (brand: DealershipBrand) => {
  localStorage.setItem(BRAND_KEY, brand);
};

export const getBrand = (): DealershipBrand => {
  return (localStorage.getItem(BRAND_KEY) as DealershipBrand) || 'Honda';
};

export const getAppraisers = (): Appraiser[] => {
  const data = localStorage.getItem(APPRAISERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveAppraiser = (appraiser: Appraiser) => {
  const current = getAppraisers();
  current.push(appraiser);
  localStorage.setItem(APPRAISERS_KEY, JSON.stringify(current));
};

export const deleteAppraiser = (id: string) => {
  const current = getAppraisers();
  const filtered = current.filter(a => a.id !== id);
  localStorage.setItem(APPRAISERS_KEY, JSON.stringify(filtered));
};

export const getTechnicians = (): Technician[] => {
  const data = localStorage.getItem(TECHNICIANS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTechnician = (tech: Technician) => {
  const current = getTechnicians();
  current.push(tech);
  localStorage.setItem(TECHNICIANS_KEY, JSON.stringify(current));
};

export const deleteTechnician = (id: string) => {
  const current = getTechnicians();
  const filtered = current.filter(t => t.id !== id);
  localStorage.setItem(TECHNICIANS_KEY, JSON.stringify(filtered));
};

/**
 * Persists a case to the local database.
 * If the case ID already exists, it updates the existing entry.
 */
export const saveCase = (newCase: InspectionCase) => {
  const cases = getAllCases();
  const existingIndex = cases.findIndex(c => c.id === newCase.id);
  
  if (existingIndex > -1) {
    // Update existing record
    cases[existingIndex] = newCase;
  } else {
    // Insert new record at the top
    cases.unshift(newCase);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

export const getAllCases = (): InspectionCase[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveStandard = (doc: StandardDocument) => {
  const standards = getStandards();
  const index = standards.findIndex(s => s.type === doc.type);
  if (index > -1) standards[index] = doc;
  else standards.push(doc);
  localStorage.setItem(STANDARDS_KEY, JSON.stringify(standards));
};

export const getStandards = (): StandardDocument[] => {
  const data = localStorage.getItem(STANDARDS_KEY);
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
      appraiserName: '', 
      totalCases: stats.count,
      avgVariance,
      accuracyRating: Math.max(0, 100 - (Math.abs(avgVariance) / 100)),
      reliabilityTag: tag
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
    commonFailureCount: {}, 
    totalCases: filtered.length
  };
};
