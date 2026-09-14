import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const extractQuestionsFromChunk = async (pdfBase64) => {
    const prompt = `You are an expert NEET exam question extractor. Extract ALL questions from this PDF chunk.
Return ONLY a valid JSON array. No explanation.
Each question MUST have this exact structure:
{
  "qNum": 17,
  "subject": "Physics",
  "chapter": "Kinematics",
  "question": "Full question text",
  "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
  "correct": "A",
  "explanation": "Explanation or answer key note",
  "difficulty": "Medium",
  "imageBox": { "page": 1, "box": [ymin, xmin, ymax, xmax] }
}
CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE QUESTION. Do not skip any questions! The user is relying on you to extract 100% of the questions. Do not stop early.
2. Extract the EXACT question number into "qNum".
3. Extract "imageBox" if the question contains ANY diagram, table, graph, chemical structure, biology figure, or physics diagram. "page" in imageBox is 1-indexed for THIS chunk.
4. DEDUCE SUBJECT ACCURATELY: Carefully identify if the question belongs to Physics, Chemistry, or Biology. Pay close attention to the question number. In typical NEET exams, Q1-50 (or Q1-45) are Physics, Q51-100 (or Q46-90) are Chemistry, and Q101-200 (or Q91-180) are Biology. Use this as a strong guide to avoid misclassifying subjects when the text is ambiguous.`;

    let success = false;
    let retries = 8;
    let response;
    
    while(retries > 0 && !success) {
        try {
            response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: [{ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } }, prompt],
                config: { responseMimeType: 'application/json' }
            });
            success = true;
        } catch(e) {
            logger.error(`Gemini RAW Error: ${e.message} | Status: ${e.status} | Full: ${JSON.stringify(e)}`);
            const isTransientError = e.status === 429 || e.status === 503 || e.status === 500 || e.status === 504 || e.message?.includes('429') || e.message?.includes('503');
            
            if (isTransientError) {
                const backoffDelay = (9 - retries) * 10000; // 10s, 20s, 30s...
                logger.warn(`Gemini API Error (${e.status}). Retrying in ${backoffDelay/1000}s... (${retries - 1} retries left)`);
                await delay(backoffDelay);
                retries--;
            } else {
                throw new Error(`Gemini API Error: ${e.message}`);
            }
        }
    }
    
    if (!success) {
        throw new Error('Failed to extract after retries due to rate limits or API errors.');
    }
    
    if (response && response.text) {
        let jsonStr = response.text.trim().replace(/^```json\n?/g, '').replace(/```\n?$/g, '');
        try {
            return JSON.parse(jsonStr);
        } catch(err) {
            logger.error("Failed to parse chunk JSON:", err);
            return []; // Return empty array on parse failure to not break pipeline
        }
    }
    return [];
};
