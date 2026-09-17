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
 * Extract ALL questions from a full PDF buffer using Gemini's native PDF parsing.
 * NO local renderers, NO chunking, NO sharp/canvas/pdf-img-convert.
 * Gemini natively reads PDF pages, diagrams, chemical structures, and LaTeX.
 * 
 * For large PDFs (>30 pages), splits into batches to avoid token limits.
 */
export const extractQuestionsFromPDFBuffer = async (pdfBuffer, onProgress = null) => {
    const base64Pdf = pdfBuffer.toString('base64');
    const sizeKB = Math.round(base64Pdf.length / 1024);
    
    logger.info(`[GEMINI NATIVE] Sending entire PDF to Gemini (${sizeKB} KB base64)`);

    const prompt = `You are an expert NTA NEET exam digitizer and question extractor. 
Analyze this COMPLETE PDF document and extract EVERY SINGLE multiple choice question from ALL pages.

MANDATORY RULES:
1. Extract ALL questions from EVERY page. Do NOT skip any question.
2. NORMALIZE OPTIONS: Map all option identifiers to "A", "B", "C", "D" (even if printed as 1, 2, 3, 4 or a, b, c, d).
3. LATEX FORMULAS: Retain LaTeX for mathematical terms, physics formulas, and chemical equations ($...$ or $$...$$).
4. DIAGRAMS & FIGURES: For Physics (circuits, ray diagrams), Chemistry (structural formulas, graphs), and Biology (anatomy diagrams):
   - Set "hasDiagram": true if a figure, graph, or diagram exists for this question.
   - Return normalized bounding box coordinates in "diagramBox": { "ymin": 120, "xmin": 50, "ymax": 450, "xmax": 600 } (scale 0-1000).
   - Also include "imageBox": { "page": <page_number>, "box": [ymin, xmin, ymax, xmax] } for backward compatibility.
5. ANSWER KEYS: If answer key or explanation is available in the PDF, extract them. If missing, set "correctAnswer": "A" and "explanation": null.
6. SUBJECT DETECTION: Identify subject as "Physics", "Chemistry", or "Biology" based on the content.
7. CHAPTER DETECTION: Identify the chapter/topic name if visible in the PDF section headers.

OUTPUT: Return a valid JSON array of question objects. No markdown fences. No extra text.

[
  {
    "questionNumber": 1,
    "subject": "Physics",
    "chapter": "Kinematics",
    "questionText": "Full question text including all sub-parts",
    "hasDiagram": false,
    "diagramBox": null,
    "diagramUrl": null,
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

CRITICAL: Extract EVERY question. Missing even one question is unacceptable.`;

    let allQuestions = [];
    let success = false;
    let retries = 5;
    let lastError = null;

    while (retries > 0 && !success) {
        try {
            logger.info(`[GEMINI NATIVE] Attempt ${6 - retries}/5 — Calling gemini-2.0-flash with PDF inline data...`);
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
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
                    maxOutputTokens: 65536
                }
            });
            
            if (!response || !response.text) {
                logger.warn('[GEMINI NATIVE] Empty response from Gemini. Retrying...');
                retries--;
                await delay(2000);
                continue;
            }

            const rawText = response.text.trim();
            console.log('=== RAW LLM RESPONSE START ===');
            console.log(rawText.slice(0, 800));
            console.log(`=== RAW LLM RESPONSE END (total length: ${rawText.length}) ===`);

            const parsedRaw = robustParseQuestions(rawText);
            const normalized = normalizeQuestions(parsedRaw);
            
            logger.info(`[GEMINI NATIVE] Parsed ${normalized.length} questions from PDF`);
            
            if (normalized.length > 0) {
                allQuestions = normalized;
                success = true;
            } else {
                logger.warn(`[GEMINI NATIVE] 0 questions parsed. Raw response sample: ${rawText.slice(0, 200)}`);
                retries--;
                await delay(3000);
            }
        } catch (e) {
            lastError = e;
            const isRetryable = 
                e.status === 429 || 
                e.status === 503 || 
                e.status === 500 || 
                e.status === 504 ||
                (e.message && (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('503') || e.message.includes('overloaded')));

            if (isRetryable && retries > 1) {
                const attempt = 6 - retries;
                const backoffMs = Math.min(Math.pow(2, attempt) * 2000, 30000);
                logger.warn(`[GEMINI NATIVE] Rate limit / transient error (${e.status || e.message}). Retrying in ${backoffMs/1000}s... (${retries - 1} retries left)`);
                await delay(backoffMs);
                retries--;
            } else {
                logger.error(`[GEMINI NATIVE] Fatal error: ${e.message}`);
                retries = 0;
            }
        }
    }

    if (allQuestions.length === 0 && lastError) {
        throw new Error(`Gemini extraction failed after all retries: ${lastError.message}`);
    }

    return allQuestions;
};

// Keep backward compatibility — old chunk-based function now just wraps the native one
export const extractQuestionsFromChunk = async (pdfBase64, textContent = '') => {
    const buffer = Buffer.from(pdfBase64, 'base64');
    return extractQuestionsFromPDFBuffer(buffer);
};
