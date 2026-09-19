import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function robustParseQuestions(rawText) {
    if (!rawText) return [];
    if (typeof rawText !== 'string') {
        if (Array.isArray(rawText)) return rawText;
        if (rawText && Array.isArray(rawText.questions)) return rawText.questions;
        return [];
    }
    
    const cleanedText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    
    try {
        const parsed = JSON.parse(cleanedText);
        return Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } catch (e1) {
        console.error('[PARSE FAILED ON STRING]:', cleanedText.slice(0, 300));
        console.error('[PARSE ERROR REASON]:', e1.message);

        // Try extracting JSON object with questions array
        const questionsObjMatch = cleanedText.match(/\{\s*"questions"\s*:\s*(\[\s*\{[\s\S]*\}\s*\])\s*\}/i);
        if (questionsObjMatch && questionsObjMatch[1]) {
            try {
                const arrayParsed = JSON.parse(questionsObjMatch[1]);
                console.log('[DEBUG] Fallback regex questions object parsed:', arrayParsed.length);
                return arrayParsed;
            } catch (e) {}
        }

        // Try extracting JSON array
        const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('[DEBUG] Regex parse fallback succeeded:', Array.isArray(parsed) ? parsed.length : (parsed.questions?.length || 0));
                return Array.isArray(parsed) ? parsed : (parsed.questions || []);
            } catch (e2) {
                console.error('Regex parse fallback failed:', e2.message);
            }
        }
    }
    return [];
}

export function normalizeQuestions(rawQuestions) {
    if (!Array.isArray(rawQuestions)) return [];
    
    return rawQuestions.map((q, idx) => {
        const qNum = q.questionNumber || q.qNum || q.qNumber || q.id || (idx + 1);
        const qText = q.questionText || q.question || q.text || "Question text unavailable";
        
        let optionsArray = [];
        let optionsObj = {};

        if (Array.isArray(q.options)) {
            optionsArray = q.options.map(opt => {
                if (typeof opt === 'string') {
                    const key = opt.charAt(0).toUpperCase();
                    const text = opt.slice(1).replace(/^[\.\:\)\s]+/, '').trim();
                    optionsObj[key] = text;
                    return { id: key, text };
                } else if (opt && (opt.id || opt.key)) {
                    const key = (opt.id || opt.key).toString().toUpperCase();
                    const text = opt.text || opt.value || '';
                    optionsObj[key] = text;
                    return { id: key, text };
                }
                return opt;
            });
        } else if (typeof q.options === 'object' && q.options !== null) {
            optionsObj = q.options;
            optionsArray = Object.entries(q.options).map(([key, val]) => ({ id: key, text: val }));
        }

        if (!optionsObj.A) { optionsObj.A = 'Option A'; }
        if (!optionsObj.B) { optionsObj.B = 'Option B'; }
        if (!optionsObj.C) { optionsObj.C = 'Option C'; }
        if (!optionsObj.D) { optionsObj.D = 'Option D'; }

        const correctAnswer = (q.correctAnswer || q.correct || q.answer || 'A').toString().toUpperCase().trim();
        const hasDiagram = !!(q.hasDiagram || q.diagramBox || q.imageBox || q.diagramUrl);

        let imageBox = q.imageBox || null;
        if (!imageBox && q.diagramBox && q.diagramBox.ymin !== undefined) {
            imageBox = {
                page: 1,
                box: [q.diagramBox.ymin, q.diagramBox.xmin, q.diagramBox.ymax, q.diagramBox.xmax]
            };
        }

        return {
            questionNumber: qNum,
            qNum: qNum,
            questionText: qText,
            question: qText,
            options: optionsObj,
            optionsList: optionsArray,
            correctAnswer: correctAnswer,
            correct: correctAnswer,
            hasDiagram: hasDiagram,
            diagramBox: q.diagramBox || null,
            diagramUrl: q.diagramUrl || q.image || null,
            imageBox: imageBox,
            explanation: q.explanation || null,
            subject: q.subject || 'Physics',
            chapter: q.chapter || 'Uncategorized',
            difficulty: q.difficulty || 'Medium'
        };
    });
}

/**
 * Extract ALL questions from a SINGLE PDF PAGE buffer using Gemini's native PDF parsing.
 */
export const extractQuestionsFromSinglePage = async (pagePdfBuffer) => {
    const base64Pdf = pagePdfBuffer.toString('base64');
    const sizeKB = Math.round(base64Pdf.length / 1024);
    
    logger.info(`[GEMINI NATIVE] Sending single PDF page to Gemini (${sizeKB} KB base64)`);

    const prompt = `You are an expert NTA NEET exam digitizer and question extractor. 
Analyze this SINGLE PAGE PDF document and extract EVERY SINGLE multiple choice question from it.

MANDATORY RULES:
1. Extract ALL questions from this page. Do NOT skip any question.
2. NORMALIZE OPTIONS: Map all option identifiers to "A", "B", "C", "D" (even if printed as 1, 2, 3, 4 or a, b, c, d).
3. LATEX FORMULAS: Retain LaTeX for mathematical terms, physics formulas, and chemical equations ($...$ or $$...$$).
4. DIAGRAMS & FIGURES: For Physics (circuits, ray diagrams), Chemistry (structural formulas, graphs), and Biology (anatomy diagrams):
   - Set "hasDiagram": true if a figure, graph, or diagram exists for this question.
   - Return normalized bounding box coordinates in "diagramBox": { "ymin": 120, "xmin": 50, "ymax": 450, "xmax": 600 } (scale 0-1000).
5. ANSWER KEYS: If answer key or explanation is available, extract them. If missing, set "correctAnswer": "A" and "explanation": null.
6. SUBJECT DETECTION: Identify subject as "Physics", "Chemistry", or "Biology" based on the content.
7. CHAPTER DETECTION: Identify the chapter/topic name if visible.

OUTPUT: Return a valid JSON array of question objects. No markdown fences. No extra text.

[
  {
    "questionNumber": 1,
    "subject": "Physics",
    "chapter": "Kinematics",
    "questionText": "Full question text including all sub-parts",
    "hasDiagram": false,
    "diagramBox": null,
    "options": {
      "A": "Option A text",
      "B": "Option B text",
      "C": "Option C text",
      "D": "Option D text"
    },
    "correctAnswer": "A",
    "explanation": "Explanation text or null",
    "difficulty": "Medium"
  }
]

CRITICAL: Extract EVERY question on this page. Missing even one question is unacceptable.`;

    let success = false;
    let retries = 4;
    let lastError = null;
    let extractedQuestions = [];

    while (retries > 0 && !success) {
        let abortController = new AbortController();
        let timeoutId = setTimeout(() => abortController.abort('TIMEOUT'), 120000); // 120s hard timeout
        
        try {
            const attempt = 5 - retries;
            const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            logger.info(`[GEMINI NATIVE] Attempt ${attempt}/4 — Calling ${modelName} with PDF inline data...`);
            
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        inlineData: {
                            data: base64Pdf,
                            mimeType: 'application/pdf'
                        }
                    },
                    prompt
                ],
                config: {
                    responseMimeType: 'application/json',
                    maxOutputTokens: 8192
                }
            }, { signal: abortController.signal });
            
            clearTimeout(timeoutId);

            if (!response || !response.text) {
                logger.warn('[GEMINI NATIVE] Empty response from Gemini. Retrying...');
                retries--;
                await delay(2000);
                continue;
            }

            const rawText = response.text.trim();
            const parsedRaw = robustParseQuestions(rawText);
            const normalized = normalizeQuestions(parsedRaw);
            
            logger.info(`[GEMINI NATIVE] Parsed ${normalized.length} questions from page`);
            extractedQuestions = normalized;
            success = true;
            
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            logger.warn(`[GEMINI NATIVE] Attempt ${5 - retries} failed: ${error.message || error}`);
            retries--;
            if (retries > 0) {
                // Exponential backoff: 2s, 4s, 8s
                const delayMs = Math.min((2 ** (4 - retries)) * 1000, 40000);
                logger.warn(`[GEMINI NATIVE] Retrying in ${delayMs/1000}s...`);
                await delay(delayMs);
            }
        }
    }

    if (!success && lastError) {
        throw new Error(`Gemini extraction failed for page after all retries: ${lastError.message}`);
    }

    return extractedQuestions;
};

// Remove extractQuestionsFromPDFBuffer and extractQuestionsFromChunk entirely to prevent their usage
