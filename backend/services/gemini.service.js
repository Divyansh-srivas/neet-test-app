import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const extractQuestionsFromChunk = async (pdfBase64, textContent = '') => {
    const prompt = `You are an expert NEET and Indian Coaching Exam Question Extractor (Physics, Chemistry, Biology, Mathematics).
Extract EVERY SINGLE Multiple Choice Question (MCQ) from the provided content with 100% precision.

MANDATORY EXTRACTION INSTRUCTIONS:
1. QUESTION NUMBERS: Coaching papers use varied formats like "1.", "Q.1", "[1]", "Question 1:", "(1)", or bold numbers. Extract the numerical ID into "questionNumber".
2. TEXT & LATEX EQUATIONS: Preserve all question text, chemical equations, physics formulas, and mathematical notation (using LaTeX $...$ or standard math symbols).
3. OPTIONS: Options may appear as "(1), (2), (3), (4)", "(a), (b), (c), (d)", "A.", "B.", or in multi-column tables.
   - CRITICAL: You MUST normalize option identifiers strictly to "A", "B", "C", "D" even if original paper uses 1, 2, 3, 4 or a, b, c, d.
4. DIAGRAMS & FIGURES: If a question contains ANY diagram, table, graph, chemical structure, biology figure, circuit, or physics diagram:
   - Set "hasDiagram": true
   - Set "imageBox": { "page": 1, "box": [ymin, xmin, ymax, xmax] } where page is 1-indexed for THIS page/chunk and box coordinates are [ymin, xmin, ymax, xmax] normalized to scale 0-1000.
5. ANSWER KEYS & EXPLANATIONS: If an answer key or explanation is missing, set "correctAnswer" to "A" (or best deduction) and "explanation" to null.
6. SUBJECT & CHAPTER: Categorize into Physics, Chemistry, Biology, or Mathematics based on question topic.

MANDATORY OUTPUT FORMAT: Return ONLY a valid JSON object matching this exact schema:
{
  "questions": [
    {
      "questionNumber": 1,
      "subject": "Physics",
      "chapter": "Kinematics",
      "questionText": "Full question text",
      "hasDiagram": false,
      "imageBox": null,
      "options": [
        { "id": "A", "text": "Option A text" },
        { "id": "B", "text": "Option B text" },
        { "id": "C", "text": "Option C text" },
        { "id": "D", "text": "Option D text" }
      ],
      "correctAnswer": "A",
      "explanation": "Explanation text or null",
      "difficulty": "Medium"
    }
  ]
}`;

    let success = false;
    let retries = 3;
    let response;

    // Multimodal input: PDF base64 allows Gemini vision to read page images natively
    const contents = textContent && textContent.length > 50
        ? [textContent, prompt]
        : [{ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } }, prompt];

    while (retries > 0 && !success) {
        try {
            response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents,
                config: { responseMimeType: 'application/json' }
            });
            success = true;
        } catch (e) {
            const isRateLimitOrTransient = 
                e.status === 429 || 
                e.status === 503 || 
                e.status === 500 || 
                e.status === 504 || 
                (e.message && (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('503')));
            
            if (isRateLimitOrTransient && retries > 1) {
                // Exponential backoff: 2s, 4s, 8s
                const attempt = 4 - retries;
                const backoffMs = Math.pow(2, attempt) * 1000;
                logger.warn(`[API WARNING] Rate limit / transient error (${e.status || '429'}). Retrying in ${backoffMs/1000}s... (${retries - 1} retries left)`);
                await delay(backoffMs);
                retries--;
            } else {
                logger.error(`[API ERROR] Non-retryable error or max retries reached: ${e.message}`);
                retries = 0;
            }
        }
    }

    if (!response || !response.text) return [];

    let rawText = response.text.trim();
    console.log('[DEBUG] Raw LLM response sample:', rawText.slice(0, 200));

    // Strip markdown formatting if present
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        const parsedData = JSON.parse(rawText);
        let extractedArray = [];

        if (Array.isArray(parsedData)) {
            extractedArray = parsedData;
        } else if (parsedData && Array.isArray(parsedData.questions)) {
            extractedArray = parsedData.questions;
        }

        console.log('[DEBUG] Questions parsed from chunk:', extractedArray.length);
        return extractedArray;
    } catch (parseErr) {
        logger.error('[DEBUG] JSON.parse failed. Attempting regex extraction:', parseErr.message);

        // Regex fallback for { "questions": [...] }
        const questionsObjMatch = rawText.match(/\{\s*"questions"\s*:\s*(\[\s*\{[\s\S]*\}\s*\])\s*\}/i);
        if (questionsObjMatch && questionsObjMatch[1]) {
            try {
                const arrayParsed = JSON.parse(questionsObjMatch[1]);
                console.log('[DEBUG] Fallback regex questions object parsed:', arrayParsed.length);
                return arrayParsed;
            } catch (e) {}
        }

        // Regex fallback for [...]
        const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
            try {
                const arrayParsed = JSON.parse(arrayMatch[0]);
                console.log('[DEBUG] Fallback regex JSON array parsed:', arrayParsed.length);
                return arrayParsed;
            } catch (e) {}
        }

        return [];
    }
};
