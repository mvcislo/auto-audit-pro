
// Always use import {GoogleGenAI} from "@google/genai";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { HistoricalAggregates, AnalysisMode, StandardDocument, InspectionCase, DealershipBrand } from '../types';
import { getStandardsForBrand, getTechnicianProfiles, getBrand } from './storageService';

const getMimeType = (base64: string): string => {
  const match = base64.match(/^data:([^;]+);base64,/);
  return match ? match[1] : 'image/jpeg';
};

const getSystemInstruction = (mode: AnalysisMode, brand: DealershipBrand) => {
  if (mode === AnalysisMode.APPRAISAL) {
    return `You are the Lead Appraiser and Recon Specialist for a high-volume ${brand} dealership.
YOUR MISSION: Calculate a highly accurate Reconditioning Estimate based solely on manager intake notes and your [DEALERSHIP RULES].

STRATEGY:
1. AUTHORITY: The provided [DEALERSHIP RULES] are your Bible. If they specify mandatory prep items (e.g., Detail, Safety Fee, Oil Change), use those exact costs. 
2. QUALITY PRICING: Use Google Search to find current market pricing for PREMIUM parts (e.g., Bosch, Akebono, Moog). Avoid low-end "economy" parts. 
3. LINKED SOURCES: When providing counts or estimates, cite a legitimate source (e.g., RockAuto, PartsAvatar) with a direct link to the part if possible.
4. Analyze Appraiser Notes for specific wear items (e.g., "tires low", "brakes pulsing").
5. If Appraiser says "CLEAN", assume zero mechanical repairs beyond the mandatory prep dictated by [DEALERSHIP RULES].
6. Provide a clear, categorized breakdown.
7. Place [DETECTED_TOTAL: 1234.56] (numeric total) at the very end of your response.`;
  }

  return `You are the Lead Auditor for a high-volume ${brand} Dealership.
YOUR MISSION: Protect Dealership Gross Margin by identifying discrepancies between Appraiser intake notes and Technician service quotes.

STRATEGIC AUDIT RULES:
1. GROUND TRUTH AUTHORITY: The [DEALERSHIP RULES] and [${brand} RULES] provided in the prompt are the ABSOLUTE authority. 
2. DYNAMIC PREP: Do not assume a mandatory $250 detail or $200 safety unless specified in the [DEALERSHIP RULES].
3. PRICING AUDIT: Use Google Search to verify Technician quotes. If the shop quotes a massive markup, find alternative PREMIUM part pricing (e.g., Akebono, Brembo, Bilstein).
4. GROUNDING & LINKS: Ensure all findings are grounded in legitimate sources (e.g., Manufacturer CPO manuals or reputable parts retailers). Provide direct links [Label](URL) to the parts you find as alternatives.
5. NO LOW-END PARTS: Only suggest OEM Equivalent or Premium Aftermarket options. No budget/white-box parts.
6. VISUAL INSPECTION: Compare the visual state of the vehicle in photos against the specific standards in the [DEALERSHIP RULES].
7. Place [DETECTED_TOTAL: 1234.56] (numeric total) at the very end.`;
};

/**
 * Generates a recon audit or appraisal analysis using Gemini.
 * Uses gemini-3-pro-preview for complex reasoning tasks.
 */
export const analyzeInspection = async (
  currentCase: any,
  history: HistoricalAggregates | null,
  mode: AnalysisMode
): Promise<{ text: string; detectedTotal?: number; citations: any[] }> => {
  try {
    const brand = await getBrand();
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    const { vehicle, data } = currentCase;

    const parts: any[] = [];

    // Attachments
    data.attachments.forEach((base64: string) => {
      if (base64.includes(',')) {
        const mimeType = getMimeType(base64);
        parts.push({
          inlineData: { mimeType, data: base64.split(',')[1] }
        });
      }
    });

    // Inject Ground Truth Standards (brand-scoped — only this brand's manuals)
    const standards = await getStandardsForBrand(brand);
    const relevantStandards = standards.map(s => `[${s.type} RULES]: ${s.extractedRules}`).join('\n\n');

    let promptText = '';

    if (mode === AnalysisMode.APPRAISAL) {
      promptText = `
        --- APPRAISAL TASK ---
        VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.kilometres} km)
        APPRAISER NOTES: "${data.appraiserNotes || 'No notes provided'}"
        
        GROUND TRUTH RULES:
        ${relevantStandards}

        GOAL: Calculate total estimated recon audit based on the provided local standards. If you suggest parts, find 2-3 PREMIUM aftermarket options and provide direct links.
      `;
    } else {
      promptText = `
        --- AUDIT TASK ---
        APPRAISER NOTES: "${data.appraiserNotes}"
        TECH NOTES: "${data.technicianNotes}"
        MGR BUDGET: $${data.managerAppraisalEstimate} | TECH QUOTE: $${data.serviceDepartmentEstimate}
        
        GROUND TRUTH RULES:
        ${relevantStandards}

        Compare these notes and flag discrepancies using the GROUND TRUTH RULES provided.
      `;
    }

    parts.push({ text: promptText });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(mode, brand),
        tools: [{ googleSearch: {} }]
      }
    });

    // Extract generated text directly from response.text property
    const fullText = response.text || "Analysis failed.";
    const totalMatch = fullText.match(/\[DETECTED_TOTAL:\s*([\d,.]+)\]/);
    const detectedTotal = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : undefined;

    return {
      text: fullText,
      detectedTotal,
      citations: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const clarifyAnalysis = async (
  originalCase: InspectionCase,
  query: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  const { vehicle, data, analysis } = originalCase;

  const prompt = `
    --- AUDIT CLARIFICATION REQUEST ---
    VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model}
    APPRAISER: "${data.appraiserNotes}"
    TECH: "${data.technicianNotes}"
    ORIGINAL AUDIT FINDINGS: ${analysis}

    MANAGER QUERY: "${query}"

    Provide a professional, direct clarification. If the manager is asking for a "combat script" or how to push back, provide specific technical counter-arguments based on Ontario Safety or HCUV standards.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are the Dealer Operations Consultant. Help the manager protect their gross margin. Be concise, firm, and technically accurate."
      }
    });
    return response.text || "Clarification unavailable.";
  } catch (error) {
    console.error(error);
    return "Error generating clarification.";
  }
};

/**
 * Extracts VIN and vehicle details from an image.
 */
export const extractVINFromImage = async (base64: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          // Use object structure for inlineData to avoid Blob naming collision
          { inlineData: { mimeType: getMimeType(base64), data: base64.split(',')[1] } },
          { text: "Extract the 17-digit VIN from this image. Also identify Year, Make, and Model if visible. Return as a JSON object with keys: vin, year, make, model." }
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

/**
 * Extracts rules from a technical standard document (PDF).
 * Throws on failure so the caller can surface the real error to the user.
 */
export const digestStandardDocument = async (base64: string, type: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Check your .env file and restart the dev server.");
  }

  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  if (!base64Data) {
    throw new Error("Invalid file data. The PDF could not be read.");
  }

  // Gemini inline data cap is ~20MB. base64 is ~133% of raw size, so guard at 15MB.
  const estimatedBytes = (base64Data.length * 3) / 4;
  if (estimatedBytes > 20 * 1024 * 1024) {
    throw new Error(`PDF is too large (~${Math.round(estimatedBytes / 1024 / 1024)}MB). Please compress it below 20MB and try again.`);
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64Data } },
          { text: "You are a specialized technical auditor. Extract ALL critical pass/fail criteria, wear limits (e.g., mm, %), and regulatory safety requirements from this document. Organize them into a concise, high-density reference sheet. Focus on technical specifications that a mechanic would use to determine if a part must be replaced. Return ONLY the extracted rules as plain text — no preamble, no markdown headers." }
        ]
      }
    });

    const text = response.text?.trim();
    if (!text || text.length < 20) {
      throw new Error("The AI returned an empty extraction. The PDF may be image-only (scanned). Please use a text-based PDF.");
    }
    return text;
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("digestStandardDocument failed:", msg);
    throw new Error(msg);
  }
};

/**
 * Extracts vehicle details and appraiser notes from a vAuto Appraisal PDF.
 */
export const parseVAutoAppraisal = async (base64: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64.split(',')[1] } },
          { text: "Extract vehicle info from this vAuto trade appraisal. Return a JSON object with EXACTLY these keys and types: { \"vin\": string, \"year\": number, \"make\": string, \"model\": string, \"kilometres\": number, \"appraiserName\": string, \"appraiserNotes\": string, \"managerAppraisalEstimate\": number }. If a numeric value has commas or text, return only the digits as a number. Return ONLY the raw JSON." }
        ]
      }
    });
    const text = response.text || '{}';
    // Improved JSON extraction search for outermost braces
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (e) {
    console.error("vAuto Parse Error:", e);
    return null;
  }
};

/**
 * Extracts vehicle details and technician notes from a Service Shop Claim or MPI PDF.
 */
export const parseServiceClaim = async (base64: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64.split(',')[1] } },
          { text: "Extract repair info from this Service Shop Claim or Multi-Point Inspection. Return a JSON object with EXACTLY these keys and types: { \"technicianName\": string, \"serviceDepartmentEstimate\": number, \"technicianNotes\": string }. If a numeric value has commas or text, return only the digits as a number. For 'technicianNotes', summarize all requested repairs. Return ONLY the raw JSON." }
        ]
      }
    });
    const text = response.text || '{}';
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (e) {
    console.error("Service Claim Parse Error:", e);
    return null;
  }
};

