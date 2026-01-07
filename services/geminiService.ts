
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode, StandardDocument } from '../types';
import { getStandards, getTechnicianProfiles, getBrand } from './storageService';

const getSystemInstruction = (mode: AnalysisMode) => {
  const brand = getBrand();
  
  if (mode === AnalysisMode.APPRAISAL) {
    return `You are the Lead Appraiser and Recon Specialist for a high-volume ${brand} dealership.
YOUR MISSION: Calculate a highly accurate Reconditioning Estimate based solely on intake notes.

MANDATORY RETAIL PREP PACKAGE (ALWAYS INCLUDE):
- Safety Inspection Fee: $200
- 4-Wheel Balance: $80
- 4-Wheel Alignment: $140
- Professional Detail: $250
- TOTAL FIXED BASE: $670

STRATEGY:
1. Start with the $670 Fixed Base.
2. Analyze Appraiser Notes for specific wear items (e.g., "tires low", "brakes pulsing", "dent on hood").
3. Estimate repairs using market-rate labor/parts for this specific vehicle.
4. If Appraiser says "CLEAN", assume zero additional mechanical repairs beyond the Fixed Base.
5. Provide a breakdown of these costs.`;
  }

  return `You are the Lead Auditor for a high-volume ${brand} Dealership.
YOUR MISSION: Protect Dealership Gross Margin by identifying discrepancies between Appraiser intake notes and Technician service quotes.

STRATEGIC AUDIT RULES:
1. "CLEAN CAR" RULE: If an Appraiser notes a car is "Clean", this refers to its overall condition. It DOES NOT mean the vehicle skips the detail. Every retail unit requires a Professional Detail.
2. DISCREPANCY AUDIT: If Appraiser says "Brakes feel new" but Tech quotes "Brake Job", flag it.
3. Citations: Reference the specific uploaded standards when flagging a failure.`;
};

export const analyzeInspection = async (
  currentCase: any, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { vehicle, data } = currentCase;
    const standards = getStandards();
    const brand = getBrand();
    
    const parts: any[] = [];
    
    // Attachments
    data.attachments.forEach((base64: string) => {
      if (base64.includes(',')) {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] }
        });
      }
    });

    const libraryContext = standards.map(s => `[${s.type} STANDARD]: ${s.extractedRules}`).join('\n\n');

    let promptText = '';
    
    if (mode === AnalysisMode.APPRAISAL) {
      promptText = `
        --- APPRAISAL TASK ---
        VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.kilometres} km)
        APPRAISER NOTES: "${data.appraiserNotes || 'No notes provided'}"
        
        GOAL: Calculate total estimated recon. 
        Start with the $670 Mandatory Base (Safety, Balance, Alignment, Detail).
        Add estimated costs for any mechanical or cosmetic issues found in the Appraiser Notes.
        
        Place [DETECTED_TOTAL: 1234.56] at the very end.
      `;
    } else {
      const techStats = getTechnicianProfiles().find(t => t.technicianName === data.technicianName);
      promptText = `
        --- AUDIT TASK ---
        APPRAISER NOTES: "${data.appraiserNotes}"
        TECH NOTES: "${data.technicianNotes}"
        MGR BUDGET: $${data.managerAppraisalEstimate} | TECH QUOTE: $${data.serviceDepartmentEstimate}
        
        Compare these notes and flag discrepancies.
        Place [DETECTED_TOTAL: 1234.56] at the very end.
      `;
    }

    parts.push({ text: promptText });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(mode),
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const brand = getBrand();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64.split(',')[1] } },
          { text: `Extract technical PASS/FAIL thresholds from this ${brand} manual.` }
        ]
      }
    });
    return response.text || "Failed to digest document.";
  } catch (e) { return "Extraction error."; }
};

export const extractVINFromImage = async (base64: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } },
          { text: "Extract VIN and vehicle details (Year, Make, Model). Return valid JSON object with keys: vin, year, make, model." }
        ]
      }
    });
    const text = response.text || '{}';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) return JSON.parse(text.substring(jsonStart, jsonEnd));
    return null;
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
