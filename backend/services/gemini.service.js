import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const extractQuestionsFromChunk = async (pdfBase64, textContent = '') => {
    const prompt = `You are an expert NEET and Indian coaching exam question extractor. Extract EVERY SINGLE multiple-choice question (MCQ) from this provided content regardless of format.

RELAXED COACHING FORMAT INSTRUCTIONS:
1. QUESTION NUMBERS: Coaching papers use varied formats like "1.", "Q.1", "[1]", "Question 1:", "(1)", or bold numbers. Extract the exact numerical ID into "qNum".
2. OPTIONS: Options may appear as "(1), (2), (3), (4)", "(a), (b), (c), (d)", "(A), (B), (C), (D)", "A.", "B.", "1.", "2.", or in multi-column tables.
   - CRITICAL: You MUST normalize option keys strictly to "A", "B", "C", "D" even if original is numbered 1, 2, 3, 4 or a, b, c, d.
3. ANSWER KEYS & EXPLANATIONS: If an answer key or explanation is absent, extract the question and options anyway, setting "correct" to "A" (or best deduction) and "explanation" to null.
4. DIAGRAMS & FIGURES: Extract "imageBox" if the question contains ANY diagram, table, graph, chemical structure, biology figure, or physics diagram. "page" in imageBox is 1-indexed for THIS chunk. Coordinates: [ymin, xmin, ymax, xmax] scaled 0-1000.
5. SUBJECT DEDUCTION: Categorize accurately into Physics, Chemistry, Biology, or Mathematics.

Return ONLY a valid JSON array of objects. No markdown backticks outside JSON. No explanatory text.
JSON Structure:
[
  {
    "qNum": 1,
    "subject": "Physics",
    "chapter": "Kinematics",
    "question": "Full question text",
    "options": { "A": "Option A text", "B": "Option B text", "C": "Option C text", "D": "Option D text" },
    "correct": "A",
    "explanation": "Explanation text or null",
    "difficulty": "Medium",
    "imageBox": { "page": 1, "box": [100, 200, 300, 400] }
  }
]`;

    let success = false;
    let retries = 5;
    let response;

    // Multimodal input: PDF base64 allows Gemini to use native vision and text OCR simultaneously
    const contents = textContent && textContent.length > 50
        ? [textContent, prompt]
        : [{ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } }, prompt];
    
    while(retries > 0 && !success) {
        try {
            response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents,
                config: { responseMimeType: 'application/json' }
            });
            success = true;
        } catch(e) {
            logger.error(`Gemini RAW Error: ${e.message} | Status: ${e.status}`);
            const isTransientError = e.status === 429 || e.status === 503 || e.status === 500 || e.status === 504 || e.message?.includes('429') || e.message?.includes('503');
            
            if (isTransientError) {
                const backoffDelay = (6 - retries) * 4000;
                logger.warn(`Gemini API Transient Error (${e.status}). Retrying in ${backoffDelay/1000}s... (${retries - 1} retries left)`);
                await delay(backoffDelay);
                retries--;
            } else {
                throw new Error(`Gemini API Error: ${e.message}`);
            }
        }
    }
    
    if (!success || !response) {
        throw new Error('Failed to extract after retries due to rate limits or API errors.');
    }

    const rawResponse = response.text ? response.text.trim() : '';
    console.log('[DEBUG] Raw LLM response sample:', rawResponse.slice(0, 200));
    
    if (rawResponse) {
        let jsonStr = rawResponse.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
        try {
            const parsedQuestions = JSON.parse(jsonStr);
            console.log('[DEBUG] Questions parsed from chunk:', Array.isArray(parsedQuestions) ? parsedQuestions.length : 0);
            return Array.isArray(parsedQuestions) ? parsedQuestions : [];
        } catch(err) {
            logger.error("Failed to parse chunk JSON:", err.message);
            // Attempt fallback extraction via regex matching JSON array
            const jsonArrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonArrayMatch) {
                try {
                    const fallbackParsed = JSON.parse(jsonArrayMatch[0]);
                    console.log('[DEBUG] Fallback regex JSON questions parsed:', fallbackParsed.length);
                    return fallbackParsed;
                } catch(e) {
                    logger.error("Fallback JSON regex parsing failed as well");
                }
            }
            return [];
        }
    }
    return [];
};
