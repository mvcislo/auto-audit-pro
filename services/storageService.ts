
import { supabase } from './supabaseClient';
import { InspectionCase, PerformanceStats, HistoricalAggregates, StandardDocument, DealershipBrand, Appraiser, Technician } from '../types';

const STORAGE_KEY = 'auto_audit_cases';
const BRAND_KEY = 'dealership_brand';

// Helper for localStorage fallback
const getLocal = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLocal = (key: string, val: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      alert("CRITICAL STORAGE ERROR: Browser memory is full. You have too many saved audits or large manuals. Please delete old audits or connect to Supabase for unlimited storage.");
    }
    console.error("Storage Error:", e);
  }
};

export const saveBrand = async (brand: DealershipBrand) => {
  if (!supabase) {
    localStorage.setItem(BRAND_KEY, brand);
    return;
  }
  const { error } = await supabase
    .from('settings')
    .upsert({ key: BRAND_KEY, value: brand });
  if (error) throw error;
};

export const getBrand = async (): Promise<DealershipBrand> => {
  if (!supabase) {
    return (localStorage.getItem(BRAND_KEY) as DealershipBrand) || 'Honda';
  }
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', BRAND_KEY)
    .single();

  if (error || !data) return 'Honda';
  return data.value as DealershipBrand;
};

export const getAppraisers = async (): Promise<Appraiser[]> => {
  if (!supabase) return getLocal('appraisers');
  const { data, error } = await supabase
    .from('appraisers')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching appraisers:', error);
    return [];
  }
  return data || [];
};

export const saveAppraiser = async (appraiser: Appraiser) => {
  if (!supabase) {
    const list = getLocal('appraisers');
    list.push(appraiser);
    setLocal('appraisers', list);
    return;
  }
  const { error } = await supabase
    .from('appraisers')
    .insert({ id: appraiser.id, name: appraiser.name });
  if (error) throw error;
};

export const deleteAppraiser = async (id: string) => {
  if (!supabase) {
    const list = getLocal('appraisers').filter((a: any) => a.id !== id);
    setLocal('appraisers', list);
    return;
  }
  const { error } = await supabase
    .from('appraisers')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const getTechnicians = async (): Promise<Technician[]> => {
  if (!supabase) return getLocal('technicians');
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching technicians:', error);
    return [];
  }
  return data || [];
};

export const saveTechnician = async (tech: Technician) => {
  if (!supabase) {
    const list = getLocal('technicians');
    list.push(tech);
    setLocal('technicians', list);
    return;
  }
  const { error } = await supabase
    .from('technicians')
    .insert({ id: tech.id, name: tech.name, tech_number: tech.techNumber });
  if (error) throw error;
};

export const deleteTechnician = async (id: string) => {
  if (!supabase) {
    const list = getLocal('technicians').filter((t: any) => t.id !== id);
    setLocal('technicians', list);
    return;
  }
  const { error } = await supabase
    .from('technicians')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

/**
 * Persists a case to the database.
 */
export const saveCase = async (newCase: InspectionCase) => {
  if (!supabase) {
    const cases = getLocal(STORAGE_KEY);
    const existingIndex = cases.findIndex((c: any) => c.id === newCase.id);
    if (existingIndex > -1) cases[existingIndex] = newCase;
    else cases.unshift(newCase);
    setLocal(STORAGE_KEY, cases);
    return;
  }
  const { error } = await supabase
    .from('inspection_cases')
    .upsert({
      id: newCase.id,
      timestamp: new Date(newCase.timestamp).toISOString(),
      mode: newCase.mode,
      vehicle: newCase.vehicle,
      data: newCase.data,
      analysis: newCase.analysis,
      detected_total: newCase.detectedTotal,
      current_status: newCase.currentStatus,
      status_history: newCase.statusHistory
    });

  if (error) throw error;
};

export const getAllCases = async (): Promise<InspectionCase[]> => {
  if (!supabase) return getLocal(STORAGE_KEY);
  const { data, error } = await supabase
    .from('inspection_cases')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching cases:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    timestamp: new Date(row.timestamp).getTime(),
    mode: row.mode,
    vehicle: row.vehicle,
    data: row.data,
    analysis: row.analysis,
    detectedTotal: row.detected_total,
    currentStatus: row.current_status,
    statusHistory: row.status_history
  }));
};

export const deleteCase = async (id: string): Promise<boolean> => {
  if (!supabase) {
    const cases = getLocal(STORAGE_KEY);
    const filtered = cases.filter((c: any) => c.id !== id);
    setLocal(STORAGE_KEY, filtered);
    return true;
  }
  const { error } = await supabase
    .from('inspection_cases')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};

export const saveStandard = async (doc: StandardDocument) => {
  if (!supabase) {
    const standards = getLocal('standards');
    const index = standards.findIndex((s: any) => s.type === doc.type);
    if (index > -1) standards[index] = doc;
    else standards.push(doc);
    setLocal('standards', standards);
    return;
  }
  const { error } = await supabase
    .from('standards')
    .upsert(
      {
        type: doc.type,
        file_name: doc.fileName,
        upload_date: new Date(doc.uploadDate).toISOString(),
        extracted_rules: doc.extractedRules
      },
      { onConflict: 'type' }
    );
  if (error) throw error;
};

export const getStandards = async (): Promise<StandardDocument[]> => {
  if (!supabase) return getLocal('standards');
  const { data, error } = await supabase
    .from('standards')
    .select('*')
    .order('upload_date', { ascending: false });

  if (error) {
    console.error('Error fetching standards:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    fileName: row.file_name,
    uploadDate: new Date(row.upload_date).getTime(),
    extractedRules: row.extracted_rules
  }));
};

/**
 * Diagnostic utility for the Admin UI to show persistence health.
 */
export const getDatabaseHealth = async () => {
  const cases = await getAllCases();
  const standards = await getStandards();
  const appraisers = await getAppraisers();
  const techs = await getTechnicians();

  let kbUsed = 0;
  if (!supabase) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) kbUsed += (localStorage.getItem(key)?.length || 0);
    }
  } else {
    // Rough estimate for cloud data size
    const allData = JSON.stringify([...cases, ...standards, ...appraisers, ...techs]);
    kbUsed = allData.length;
  }

  return {
    isHealthy: true,
    totalRecords: cases.length + standards.length + appraisers.length + techs.length,
    kbUsed: Math.round(kbUsed / 1024),
    lastCommit: Date.now(),
    isLocal: !supabase
  };
};

export const getTechnicianProfiles = async (): Promise<PerformanceStats[]> => {
  const cases = await getAllCases();
  const techMap = new Map<string, { total: number; variance: number; count: number }>();

  cases.forEach(c => {
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
};

export const getHistoricalContext = async (make: string, model: string, year: number): Promise<HistoricalAggregates | null> => {
  const cases = await getAllCases();
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

export const syncLocalToCloud = async (): Promise<{ success: boolean; count: number }> => {
  if (!supabase) return { success: false, count: 0 };

  const cases = getLocal(STORAGE_KEY);
  const appraisers = getLocal('appraisers');
  const technicians = getLocal('technicians');
  const standards = getLocal('standards');
  const brand = localStorage.getItem(BRAND_KEY);

  let count = 0;

  try {
    // Sync Brand
    if (brand) {
      await saveBrand(brand as DealershipBrand);
      count++;
    }

    // Sync Appraisers
    for (const app of appraisers) {
      await saveAppraiser(app);
      count++;
    }

    // Sync Technicians
    for (const tech of technicians) {
      await saveTechnician(tech);
      count++;
    }

    // Sync Standards
    for (const doc of standards) {
      await saveStandard(doc);
      count++;
    }

    // Sync Cases
    for (const c of cases) {
      // Ensure we call saveCase which now handles the toISOString conversion
      await saveCase(c);
      count++;
    }

    return { success: true, count };
  } catch (error) {
    console.error("Sync Error:", error);
    return { success: false, count };
  }
};
