
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode, StandardDocument } from '../types';
import { getStandards, getTechnicianProfiles, getBrand } from './storageService';

const getSystemInstruction = () => {
  const brand = getBrand();
  return `You are the Lead Auditor for a high-volume ${brand} Dealership.
YOUR MISSION: Protect Dealership Gross Margin by identifying discrepancies between Appraiser intake notes and Technician service quotes.

STRATEGIC AUDIT RULES:
1. "CLEAN CAR" INTERPRETATION: If an Appraiser notes a car is "Clean", they are describing the preservation and cosmetic integrity of the vehicle (it was well-kept). This DOES NOT mean the vehicle is ready for retail sale. Every retail unit requires a Professional Detail ($200-$400 depending on region). If a Tech quotes a "Detail" and the Appraiser called the car "Clean", this is EXPECTED and is NOT a discrepancy.
2. DISCREPANCY AUDIT: If the Appraiser noted "Brakes feel firm/new" but the Tech quotes a "Full Brake Job", flag this as a critical variance and demand measurement verification.
3. Skepticism: Be highly skeptical of "Aggressive" technicians who have high historical variance.
4. Citations: Reference the specific uploaded standards when flagging a failure.
5. Tone: Be professional, firm, and focused on data-driven gross protection.`;
};

// Perform complex reasoning audit using Gemini 3 Pro.
export const analyzeInspection = async (
  currentCase: any, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { vehicle, data } = currentCase;
    const standards = getStandards();
    const techStats = getTechnicianProfiles().find(t => t.technicianName === data.technicianName);
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

    // Library Context
    const libraryContext = standards.map(s => `[${s.type} STANDARD]: ${s.extractedRules}`).join('\n\n');

    const promptText = `
      --- DEALERSHIP CONTEXT ---
      Brand: ${brand}
      
      --- NARRATIVE CONTRAST ---
      APPRAISER (${data.appraiserName}) INTAKE NOTES: "${data.appraiserNotes || 'No notes provided'}"
      TECHNICIAN (${data.technicianName}) REPAIR JUSTIFICATION: "${data.technicianNotes || 'No notes provided'}"
      
      --- FINANCIAL DATA ---
      MGR RECON BUDGET: $${data.managerAppraisalEstimate}
      TECH SERVICE QUOTE: $${data.serviceDepartmentEstimate}
      VARIANCE: $${data.serviceDepartmentEstimate - data.managerAppraisalEstimate}

      --- GROUND TRUTH LIBRARY ---
      ${libraryContext}

      --- HISTORICAL LEARNING ---
      Tech Reliability: ${techStats?.reliabilityTag || 'Unknown'} (Avg Variance: $${techStats?.avgVariance || 0})
      Model Avg Recon Cost: $${history?.avgReconCost || 'N/A'}

      TASK:
      1. Perform a "Narrative Contrast Analysis". Compare the Appraiser's intake notes vs the Tech's repair list.
      2. Apply the "Clean Car Rule": Validate that "Clean" != "No Detail Required".
      3. Identify "Ghost Repairs": Items added by the tech that contradict the appraiser's explicitly positive notes.
      4. Place [DETECTED_TOTAL: 1234.56] at the very end as the "Verified Recon Amount".
    `;

    parts.push({ text: promptText });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(),
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

// Digest technical documents using Gemini 3 Flash.
export const digestStandardDocument = async (base64: string, type: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const brand = getBrand();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64.split(',')[1] } },
          { text: `Extract technical PASS/FAIL thresholds from this ${brand} manual. Format as concise rules for an AI auditor.` }
        ]
      }
    });
    return response.text || "Failed to digest document.";
  } catch (e) {
    console.error(e);
    return "Extraction error.";
  }
};

// Extract VIN and vehicle info from images using Gemini 3 Flash.
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
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = text.substring(jsonStart, jsonEnd);
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (e) { 
    console.error("VIN Extraction Error:", e);
    return null; 
  }
};

// Standard external API call for VIN decoding.
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
