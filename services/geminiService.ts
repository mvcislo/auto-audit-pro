
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode } from '../types';

// The API Key is obtained exclusively from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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

IMPORTANT: Place [DETECTED_TOTAL: 1234.56] at the very end of your response.`;

export const analyzeInspection = async (
  currentCase: any, 
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  try {
    const { vehicle, data } = currentCase;
    const parts: any[] = [];
    
    const attachments = data.attachments || [];
    attachments.forEach((base64: string) => {
      if (base64 && base64.includes(',')) {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] }
        });
      }
    });

    const promptText = `
      VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.kilometres} km)
      APPRAISER: ${data.appraiserName} | TECH: ${data.technicianName}
      ESTIMATED RECON: $${data.managerAppraisalEstimate} | ACTUAL QUOTE: $${data.serviceDepartmentEstimate}
      APPRAISER OBSERVATIONS: ${data.appraiserNotes}
      TECHNICIAN CLAIM: ${data.technicianNotes}
      
      TASK: Audit this quote against Ontario Safety and Honda HCUV standards.
    `;

    parts.push({ text: promptText });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts }],
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
  } catch (error: any) {
    console.error("Gemini analyzeInspection Error Details:", error);
    throw error;
  }
};

export const extractVINFromImage = async (base64: string): Promise<{ vin: string; year?: number; make?: string; model?: string } | null> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64.split(',')[1]
            }
          },
          { text: "Extract the 17-character VIN and vehicle details (Year, Make, Model) from this photo. Return valid JSON only." }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vin: { type: Type.STRING },
            year: { type: Type.INTEGER },
            make: { type: Type.STRING },
            model: { type: Type.STRING }
          },
          required: ["vin"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return null;
    return JSON.parse(resultText);
  } catch (e) {
    console.error("VIN Extraction Error:", e);
    return null;
  }
};

export const decodeVIN = async (vin: string): Promise<any> => {
  if (!vin || vin.length < 17) return null;
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
    console.error("VIN Decode Error:", e);
    return null;
  }
};
