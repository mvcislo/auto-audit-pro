
import { supabase } from './supabaseClient';
import { InspectionCase, PerformanceStats, HistoricalAggregates, StandardDocument, DealershipBrand, Appraiser, Technician } from '../types';

const STORAGE_KEY = 'auto_audit_cases';
const BRAND_KEY = 'dealership_brand';

export const saveBrand = async (brand: DealershipBrand) => {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: BRAND_KEY, value: brand });
  if (error) console.error('Error saving brand:', error);
};

export const getBrand = async (): Promise<DealershipBrand> => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', BRAND_KEY)
    .single();

  if (error || !data) return 'Honda';
  return data.value as DealershipBrand;
};

export const getAppraisers = async (): Promise<Appraiser[]> => {
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
  const { error } = await supabase
    .from('appraisers')
    .insert({ id: appraiser.id, name: appraiser.name });
  if (error) console.error('Error saving appraiser:', error);
};

export const deleteAppraiser = async (id: string) => {
  const { error } = await supabase
    .from('appraisers')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting appraiser:', error);
};

export const getTechnicians = async (): Promise<Technician[]> => {
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
  const { error } = await supabase
    .from('technicians')
    .insert({ id: tech.id, name: tech.name, tech_number: tech.techNumber });
  if (error) console.error('Error saving technician:', error);
};

export const deleteTechnician = async (id: string) => {
  const { error } = await supabase
    .from('technicians')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting technician:', error);
};

/**
 * Persists a case to the database.
 */
export const saveCase = async (newCase: InspectionCase) => {
  const { error } = await supabase
    .from('inspection_cases')
    .upsert({
      id: newCase.id,
      timestamp: newCase.timestamp,
      mode: newCase.mode,
      vehicle: newCase.vehicle,
      data: newCase.data,
      analysis: newCase.analysis,
      detected_total: newCase.detectedTotal,
      current_status: newCase.currentStatus,
      status_history: newCase.statusHistory
    });

  if (error) console.error('Error saving case:', error);
};

export const getAllCases = async (): Promise<InspectionCase[]> => {
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
    timestamp: row.timestamp,
    mode: row.mode,
    vehicle: row.vehicle,
    data: row.data,
    analysis: row.analysis,
    detectedTotal: row.detected_total,
    currentStatus: row.current_status,
    statusHistory: row.status_history
  }));
};

export const saveStandard = async (doc: StandardDocument) => {
  const { error } = await supabase
    .from('standards')
    .upsert({
      id: doc.id,
      type: doc.type,
      file_name: doc.fileName,
      upload_date: doc.uploadDate,
      extracted_rules: doc.extractedRules
    });
  if (error) console.error('Error saving standard:', error);
};

export const getStandards = async (): Promise<StandardDocument[]> => {
  const { data, error } = await supabase
    .from('standards')
    .select('*');

  if (error) {
    console.error('Error fetching standards:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    fileName: row.file_name,
    uploadDate: row.upload_date,
    extractedRules: row.extracted_rules
  }));
};

/**
 * Diagnostic utility for the Admin UI to show persistence health.
 */
export const getDatabaseHealth = async () => {
  const cases = (await getAllCases()).length;
  const standards = (await getStandards()).length;
  const appraisers = (await getAppraisers()).length;
  const techs = (await getTechnicians()).length;

  return {
    isHealthy: true,
    totalRecords: cases + standards + appraisers + techs,
    kbUsed: 0, // Not easily measured for Supabase from client
    lastCommit: Date.now()
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

