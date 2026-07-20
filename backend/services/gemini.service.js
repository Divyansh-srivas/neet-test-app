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
1. Extract EVERY SINGLE QUESTION. Do not skip any questions!
2. Extract the EXACT question number into "qNum".
3. Extract "imageBox" if the question contains ANY diagram, table, graph, chemical structure, biology figure, or physics diagram. "page" in imageBox is 1-indexed for THIS chunk.`;

    let success = false;
    let retries = 3;
    let response;
    
    while(retries > 0 && !success) {
        try {
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } }, prompt],
                config: { responseMimeType: 'application/json' }
            });
            success = true;
        } catch(e) {
            if (e.status === 429 || e.message?.includes('429')) {
                logger.warn(`Gemini Rate Limit Hit. Retrying... (${retries} retries left)`);
                await delay(10000);
                retries--;
            } else {
                throw e;
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
