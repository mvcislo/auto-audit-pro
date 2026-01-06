
export enum InspectionType {
  ONTARIO_SAFETY = 'Ontario Safety',
  HCUV = 'Certified Pre-Owned',
  BOTH = 'Both'
}

export type DealershipBrand = 'Honda' | 'Toyota' | 'Chevrolet' | 'Ford' | 'Hyundai' | 'Nissan' | 'Other';

export enum OutcomeStatus {
  PASS = 'Pass',
  FAIL = 'Fail',
  CONDITIONAL = 'Conditional'
}

export enum AnalysisMode {
  AUDIT = 'Audit Mode', 
  APPRAISAL = 'Appraisal Mode'
}

export interface Appraiser {
  id: string;
  name: string;
}

export interface Technician {
  id: string;
  name: string;
  techNumber: string;
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

// Fixed: Corrected AIStudio interface and Window declaration to resolve modifier and type identity conflicts.
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Fixed: Inlining the type and making it optional to match the environment's pre-configured global declaration.
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
