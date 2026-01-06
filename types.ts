
export enum InspectionType {
  ONTARIO_SAFETY = 'Ontario Safety',
  HCUV = 'HCUV Certified',
  BOTH = 'Both'
}

export enum OutcomeStatus {
  PASS = 'Pass',
  FAIL = 'Fail',
  CONDITIONAL = 'Conditional'
}

export enum AnalysisMode {
  AUDIT = 'Audit Mode', 
  APPRAISAL = 'Appraisal Mode'
}

export interface StandardDocument {
  id: string;
  type: 'SAFETY' | 'HCUV' | 'DEALERSHIP' | 'HONDA_MAINTENANCE';
  fileName: string;
  uploadDate: number;
  extractedRules: string;
}

export interface Vehicle {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  kilometres: number;
  acquisitionType: 'Trade' | 'Street Purchase' | 'Lease Return' | 'Auction';
}

export interface InspectionData {
  type: InspectionType;
  safetyOutcome: OutcomeStatus;
  hcuvOutcome: OutcomeStatus;
  technicianNotes: string;
  technicianName: string;
  appraiserName: string;
  appraiserNotes: string;
  managerAppraisalEstimate: number;
  serviceDepartmentEstimate: number;
  attachments: string[]; // Base64 images
}

export interface InspectionCase {
  id: string;
  timestamp: number;
  mode: AnalysisMode;
  vehicle: Vehicle;
  data: InspectionData;
  analysis?: string;
  detectedTotal?: number;
}

export interface PerformanceStats {
  technicianName: string;
  appraiserName: string;
  totalCases: number;
  avgVariance: number;
  accuracyRating: number; 
  reliabilityTag: 'Aggressive' | 'Accurate' | 'Passive';
}

export interface HistoricalAggregates {
  modelName: string;
  year: number;
  avgReconCost: number;
  commonFailureCount: Record<string, number>;
  totalCases: number;
}

// Fixed: Global augmentation for window.aistudio to resolve TS2339 and modifier mismatch errors.
// Removed 'readonly' modifier to match environment-provided definitions and prevent TS2687/TS2339 errors.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio: AIStudio;
  }
}
