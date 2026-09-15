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

        // Try extracting innermost JSON array or object via regex
        const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/) || cleanedText.match(/\{\s*"questions"[\s\S]*\}/);
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
        
        let optionsObj = {};
        if (Array.isArray(q.options)) {
            q.options.forEach(opt => {
                if (typeof opt === 'string') {
                    const key = opt.charAt(0).toUpperCase();
                    optionsObj[key] = opt.slice(1).replace(/^[\.\:\)\s]+/, '').trim();
                } else if (opt && (opt.id || opt.key)) {
                    optionsObj[opt.id || opt.key] = opt.text || opt.value || '';
                }
            });
        } else if (typeof q.options === 'object' && q.options !== null) {
            optionsObj = q.options;
        }

        if (!optionsObj.A) optionsObj.A = 'Option A';
        if (!optionsObj.B) optionsObj.B = 'Option B';
        if (!optionsObj.C) optionsObj.C = 'Option C';
        if (!optionsObj.D) optionsObj.D = 'Option D';

        return {
            questionNumber: qNum,
            qNum: qNum,
            questionText: qText,
            question: qText,
            options: optionsObj,
            correctAnswer: (q.correctAnswer || q.correct || q.answer || 'A').toString().toUpperCase().trim(),
            correct: (q.correctAnswer || q.correct || q.answer || 'A').toString().toUpperCase().trim(),
            diagramUrl: q.diagramUrl || q.image || null,
            imageBox: q.imageBox || null,
            hasDiagram: q.hasDiagram || !!q.imageBox,
            explanation: q.explanation || null,
            subject: q.subject || 'Physics',
            chapter: q.chapter || 'Uncategorized',
            difficulty: q.difficulty || 'Medium'
        };
    });
}

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
