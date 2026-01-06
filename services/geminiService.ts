
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode, StandardDocument } from '../types';
import { getStandards, getTechnicianProfiles, getBrand } from './storageService';

const getSystemInstruction = () => {
  const brand = getBrand();
  return `You are the Lead Auditor for a high-volume ${brand} Dealership.
YOUR MISSION: Protect Dealership Gross Margin.
STRATEGY:
- If a Tech fails an item without a specific measurement (e.g. "Needs brakes" vs "3mm"), flag as UNVERIFIED.
- Compare Tech claims against the uploaded Dealership Standard Library and ${brand} CPO guidelines.
- Be highly skeptical of "Aggressive" technicians who have high historical variance.`;
};

export const analyzeInspection = async (
  currentCase: any, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  try {
    // Fixed: Initializing GoogleGenAI inside the function to ensure the correct API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
      --- DEALERSHIP IDENTITY ---
      Primary Brand: ${brand}

      --- GROUND TRUTH LIBRARY ---
      ${libraryContext}

      --- HISTORICAL LEARNING ---
      Technician ${data.technicianName} Reliability: ${techStats?.reliabilityTag || 'Unknown'} (Avg Variance: $${techStats?.avgVariance || 0})
      Model Average Recon for ${vehicle.year} ${vehicle.model}: $${history?.avgReconCost || 'N/A'}

      --- CURRENT CASE ---
      VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.kilometres} km)
      APPRAISER: ${data.appraiserName} | TECH: ${data.technicianName}
      ESTIMATED RECON: $${data.managerAppraisalEstimate} | ACTUAL QUOTE: $${data.serviceDepartmentEstimate}
      APPRAISER NOTES: ${data.appraiserNotes}
      TECH NOTES: ${data.technicianNotes}
      
      TASK: Audit the Service Dept Estimate against the Ground Truth Library and ${brand} CPO standards. 
      Flag every item that does not meet the strict threshold for PASS/FAIL.
      Place [DETECTED_TOTAL: 1234.56] at the very end.
    `;

    parts.push({ text: promptText });

    // Fixed: Using gemini-3-pro-preview for complex reasoning tasks as per guidelines.
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
  // Fixed: Initializing GoogleGenAI inside the function to ensure the correct API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const brand = getBrand();
  try {
    // Fixed: Using gemini-3-flash-preview for document extraction and basic text processing.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64.split(',')[1] } },
          { text: `Extract all technical PASS/FAIL thresholds from this ${brand} ${type} manual. Focus on measurements, labor hours, and specific mechanical criteria. Format as a concise, structured rule-set for an AI auditor.` }
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
  // Fixed: Initializing GoogleGenAI inside the function to ensure the correct API key is used right before the call.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    // Fixed: Using gemini-2.5-flash-image for general vision tasks as per guidelines.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
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
