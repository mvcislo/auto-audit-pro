
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode, StandardDocument } from '../types';
import { getStandards, getTechnicianProfiles } from './storageService';

// BASE_SYSTEM_INSTRUCTION remains defined at module level for reuse.
const BASE_SYSTEM_INSTRUCTION = `You are the Lead Auditor for a high-volume Honda Dealership.
YOUR MISSION: Protect Dealership Gross Margin.
STRATEGY:
- Crucial: Compare the Appraiser's Intake Notes (visual observations) against the Tech's Quote. 
- If the Appraiser noted "Tires look new" and the Tech quotes "4 Tires," flag this as a major discrepancy.
- If a Tech fails an item without a specific measurement (e.g. "Needs brakes" vs "3mm"), flag as UNVERIFIED.
- Compare Tech claims against the uploaded Dealership Standard Library and Honda Maintenance Schedule.
- Be highly skeptical of "Aggressive" technicians who have high historical variance.`;

export const analyzeInspection = async (
  currentCase: any, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog.
  // Fixed: Simplified API key access to follow direct usage guidelines by using the environment variable directly.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const { vehicle, data } = currentCase;
    const standards = getStandards();
    const techStats = getTechnicianProfiles().find(t => t.technicianName === data.technicianName);
    
    const parts: any[] = [];
    
    // Attachments
    data.attachments.forEach((base64: string) => {
      if (base64.includes(',')) {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] }
        });
      }
    });

    // Library Context
    const libraryContext = standards.map(s => `[${s.type} STANDARD]: ${s.extractedRules}`).join('\n\n');

    const promptText = `
      --- GROUND TRUTH LIBRARY ---
      ${libraryContext}

      --- HISTORICAL LEARNING ---
      Technician ${data.technicianName} Reliability: ${techStats?.reliabilityTag || 'Unknown'} (Avg Variance: $${techStats?.avgVariance || 0})
      Model Average Recon for ${vehicle.year} ${vehicle.model}: $${history?.avgReconCost || 'N/A'}

      --- CURRENT CASE ---
      VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.kilometres} km)
      APPRAISER: ${data.appraiserName} | TECH: ${data.technicianName}
      ORIGINAL APPRAISAL BUDGET: $${data.managerAppraisalEstimate} 
      FINAL SERVICE DEPT QUOTE: $${data.serviceDepartmentEstimate}
      
      APPRAISER'S INTAKE NOTES: ${data.appraiserNotes}
      TECHNICIAN'S REPAIR NOTES: ${data.technicianNotes}
      
      TASK: 
      1. Audit the Service Dept Quote against the Appraiser's visual findings.
      2. Audit the Quote against the Ground Truth rules.
      3. Flag discrepancies where the Tech is quoting repairs for items the Appraiser saw as "Good" or "Passable."
      
      Place [DETECTED_TOTAL: 1234.56] at the very end.
    `;

    parts.push({ text: promptText });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: BASE_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }]
      }
    });

    const fullText = response.text || "Analysis failed.";
    const totalMatch = fullText.match(/\[DETECTED_TOTAL:\s*([\d,.]+)\]/);
    const detectedTotal = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : undefined;

    return { text: fullText, detectedTotal, citations: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const digestStandardDocument = async (base64: string, type: string): Promise<string> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog.
  // Fixed: Simplified API key access to follow direct usage guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64.split(',')[1] } },
          { text: `Extract all technical PASS/FAIL thresholds from this ${type} manual. Focus on measurements, labor hours, and specific mechanical criteria. Format as a concise, structured rule-set for an AI auditor.` }
        ]
      }
    });
    return response.text || "Failed to digest document.";
  } catch (e) {
    console.error(e);
    return "Extraction error.";
  }
};

export const extractVINFromImage = async (base64: string): Promise<any> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog.
  // Fixed: Simplified API key access to follow direct usage guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } },
          { text: "Extract VIN and vehicle details (Year, Make, Model). Return valid JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vin: { type: Type.STRING },
            year: { type: Type.INTEGER },
            make: { type: Type.STRING },
            model: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) { return null; }
};

export const decodeVIN = async (vin: string): Promise<any> => {
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const data = await response.json();
    const results = data.Results || [];
    return {
      year: parseInt(results.find((r: any) => r.Variable === 'Model Year')?.Value),
      make: results.find((r: any) => r.Variable === 'Make')?.Value,
      model: results.find((r: any) => r.Variable === 'Model')?.Value,
    };
  } catch (e) { return null; }
};
