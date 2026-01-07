
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode, StandardDocument } from '../types';
import { getStandards, getTechnicianProfiles, getBrand } from './storageService';

const getSystemInstruction = () => {
  const brand = getBrand();
  return `You are the Lead Auditor for a high-volume ${brand} Dealership.
YOUR MISSION: Protect Dealership Gross Margin by identifying discrepancies between Appraiser intake notes and Technician service quotes.

STRATEGIC RULES:
- "CLEAN CAR" RULE: If an Appraiser notes a car is "Clean", this refers to its overall condition and preservation. It DOES NOT mean the vehicle is ready for the lot. Every retail unit requires a Professional Detail. If a Tech quotes a Detail and the Appraiser called it "Clean", this is NOT a discrepancy.
- DISCREPANCY AUDIT: If the Appraiser noted "Brakes feel good" but the Tech quotes "4-wheel brake job", flag this for a mandatory measurement verification.
- Skepticism: Be highly skeptical of "Aggressive" technicians who have high historical variance.
- Citations: Reference the specific uploaded standards when flagging a failure.`;
};

export const analyzeInspection = async (
  currentCase: any, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  try {
    // Always initialize GoogleGenAI inside the function to use the latest API key.
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
      
      --- APPRAISER VS TECHNICIAN DATA ---
      APPRAISER (${data.appraiserName}) NOTES: "${data.appraiserNotes || 'No notes provided'}"
      TECHNICIAN (${data.technicianName}) NOTES: "${data.technicianNotes || 'No notes provided'}"
      
      ESTIMATED RECON: $${data.managerAppraisalEstimate}
      ACTUAL TECH QUOTE: $${data.serviceDepartmentEstimate}
      VARIANCE: $${data.serviceDepartmentEstimate - data.managerAppraisalEstimate}

      --- GROUND TRUTH LIBRARY ---
      ${libraryContext}

      --- HISTORICAL LEARNING ---
      Tech Reliability: ${techStats?.reliabilityTag || 'Unknown'} (Avg Variance: $${techStats?.avgVariance || 0})
      Model Avg Recon: $${history?.avgReconCost || 'N/A'}

      TASK:
      1. Perform a "Note Comparison". Look for contradictions between what the appraiser felt/saw and what the tech is charging for.
      2. Apply the "Clean Car" logic: If appraiser said "Clean" but tech quoted a detail, validate the detail as a standard retail necessity.
      3. Create a "Push-back" section if the tech is quoting major items that the appraiser explicitly noted as "New" or "Good".
      4. Place [DETECTED_TOTAL: 1234.56] at the very end.
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

export const extractVINFromImage = async (base64: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Fixed: Removed responseMimeType and responseSchema for gemini-2.5-flash-image as they are not supported for nano banana series models.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } },
          { text: "Extract VIN and vehicle details (Year, Make, Model). Return valid JSON object with keys: vin, year, make, model." }
        ]
      }
    });
    
    // Extract JSON manually from the response text since responseSchema is prohibited for this model.
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
