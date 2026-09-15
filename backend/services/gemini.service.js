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

export const extractQuestionsFromChunk = async (pdfBase64, textContent = '') => {
    const prompt = `You are an expert NTA NEET exam digitizer and question extractor. Analyze this page content and extract EVERY single MCQ.

MANDATORY RULES:
1. Extract ALL questions, even if diagram-based, multi-column, table-based, or handwritten.
2. NORMALIZE OPTIONS: Normalize option identifiers strictly to an array of 4 objects with IDs: "A", "B", "C", "D" (even if printed as 1, 2, 3, 4 or a, b, c, d).
3. LATEX FORMULAS: Retain LaTeX for mathematical terms, physics formulas, and chemical equations ($...$ or $$...$$).
4. DIAGRAMS & FIGURES: For NEET Physics (circuits, ray diagrams), Chemistry (structural formulas, graphs), and Biology (anatomy diagrams):
   - Set "hasDiagram": true if a figure, graph, or diagram exists for this question.
   - Return normalized bounding box coordinates in "diagramBox": { "ymin": 120, "xmin": 50, "ymax": 450, "xmax": 600 } (scale 0-1000).
   - Also include "imageBox": { "page": 1, "box": [ymin, xmin, ymax, xmax] } for backward compatibility.
5. ANSWER KEYS: If answer key or explanation is missing, extract question & options anyway, setting "correctAnswer": "A" (or best deduction) and "explanation": null.

MANDATORY JSON OUTPUT SCHEMA: Provide valid JSON strictly matching this schema. No markdown backticks outside JSON. No conversational chatter.
{
  "questions": [
    {
      "questionNumber": 1,
      "subject": "Physics",
      "chapter": "Kinematics",
      "questionText": "Full question text",
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
}`;

    let success = false;
    let retries = 3;
    let response;

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

    const rawText = response.text.trim();
    console.log('=== RAW LLM RESPONSE START ===');
    console.log(typeof rawText === 'string' ? rawText.slice(0, 500) : JSON.stringify(rawText).slice(0, 500));
    console.log('=== RAW LLM RESPONSE END ===');

    const parsedRaw = robustParseQuestions(rawText);
    return normalizeQuestions(parsedRaw);
};
