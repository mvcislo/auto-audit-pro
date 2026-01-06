
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { InspectionCase, HistoricalAggregates, AnalysisMode } from '../types';

// The API Key is injected via Vite's 'define' config from the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `You are the Lead Auditor for a high-volume Honda Dealership specializing in Ontario Safety Standards and HCUV.
YOUR PHILOSOPHY:
- SKEPTICISM BY DEFAULT: Technicians often pad hours.
- MEASUREMENT IS LAW: If a tech fails an item but provides no measurement (mm, 32nds, PSI), flag it as "UNVERIFIED".
- THE "PROFESSIONAL" DEFENSE: Counter tech claims with OEM specs and provincial law.

REGULATORY THRESHOLDS:
- TIRES: Safety Fail < 2/32". HCUV Fail < 5/32".
- BRAKES: Safety Fail < 2mm. HCUV Fail < 5mm (50% life).
- SUSPENSION: "Seeping" is NOT a safety failure in Ontario. Only "Dripping/Pooling" is.

OUTPUT STRUCTURE:
- 🔍 AUDIT OVERVIEW: [DETECTED_TOTAL] and Financial Variance.
- ⚖️ THE VARIANCE REPORT: Appraiser vs Tech findings.
- 🚨 GOUGING ALERT: Specific hour padding.
- 🛠️ REQUIRED vs. RECOMMENDED: Table format.
- 💬 MANAGER'S COMBAT CHECKLIST: Specific questions to ask the tech to prove the failure.

IMPORTANT: Place [DETECTED_TOTAL: 1234.56] at the very end.`;

export const analyzeInspection = async (
  currentCase: InspectionCase, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  const { vehicle, data } = currentCase;
  const contents: any[] = [];
  
  const attachments = data.attachments || [];
  attachments.forEach(base64 => {
    if (base64 && base64.includes(',')) {
      contents.push({
        inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] }
      });
    }
  });

  const prompt = `
    VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.kilometres} km)
    APPRAISER: ${data.appraiserName} | TECH: ${data.technicianName}
    ESTIMATED RECON: $${data.managerAppraisalEstimate} | ACTUAL QUOTE: $${data.serviceDepartmentEstimate}
    APPRAISER OBSERVATIONS: ${data.appraiserNotes}
    TECHNICIAN CLAIM: ${data.technicianNotes}
    
    TASK: Audit this quote. Flag unnecessary maintenance presented as safety.
  `;

  contents.push({ text: prompt });

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: contents },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }]
    }
  });

  const fullText = response.text || "Analysis failed.";
  const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const totalMatch = fullText.match(/\[DETECTED_TOTAL:\s*([\d,.]+)\]/);
  const detectedTotal = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : undefined;

  return { text: fullText, detectedTotal, citations };
};

export const decodeVIN = async (vin: string): Promise<any> => {
  if (vin.length < 17) return null;
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const data = await response.json();
    const results = data.Results || [];
    const year = results.find((r: any) => r.Variable === 'Model Year')?.Value;
    const make = results.find((r: any) => r.Variable === 'Make')?.Value;
    const model = results.find((r: any) => r.Variable === 'Model')?.Value;
    if (!make && !model) return null;
    return { year: parseInt(year), make, model };
  } catch (e) {
    return null;
  }
};
