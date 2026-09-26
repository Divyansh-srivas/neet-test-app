import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cropAndUploadDiagram } from './densityTrimmer.js';
import { splitPdfIntoChunk } from './pdf.service.js';

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
        if (typeof imageBox === 'string') {
            const parts = imageBox.split(',').map(s => parseFloat(s.trim()));
            if (parts.length === 4 && parts.every(n => !isNaN(n))) {
                imageBox = {
                    page: q.imageBox?.page || 1,
                    box: parts
                };
            } else {
                imageBox = null;
            }
        } else if (!imageBox && q.diagramBox && q.diagramBox.ymin !== undefined) {
            imageBox = {
                page: q.diagramBox.page || 1,
                box: [q.diagramBox.ymin, q.diagramBox.xmin, q.diagramBox.ymax, q.diagramBox.xmax]
            };
        } else if (imageBox && typeof imageBox === 'object' && imageBox.ymin !== undefined) {
            imageBox = {
                page: imageBox.page || 1,
                box: [imageBox.ymin, imageBox.xmin, imageBox.ymax, imageBox.xmax]
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
            diagramBox: q.diagramBox || imageBox || null,
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
async function verifyCrop(imageUrl, aiClient, qData) {
    try {
        const res = await fetch(imageUrl);
        if (!res.ok) return false;
        const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
        
        let promptText = 'Analyze this image carefully. Is there any "ghosting" (mirrored or chopped-off text artifacts), or leaked question/footer text at the very top or bottom edge?';
        if (qData) {
            promptText = `Analyze this image carefully.
1. Is there any "ghosting" (mirrored or chopped-off text artifacts), or leaked question/footer text at the very top or bottom edge?
2. Does the content of this image match the target question? The question text is: "${qData.questionText}". Options are: ${JSON.stringify(qData.options)}. The image MUST contain elements, diagrams, or text that clearly relate to this question. If it is from a different question entirely, it is BAD.`;
        }
        promptText += '\nAnswer EXACTLY in this format:\nVERDICT: [CLEAN or BAD]\nREASON: [If bad, describe the exact text/ghosting seen, or why it does not match]';
        
        const response = await aiClient.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [{ role: 'user', parts: [
                { inlineData: { mimeType: 'image/png', data: b64 } },
                { text: promptText }
            ]}]
        });
        const txt = response.text.trim();
        const verdictMatch = txt.match(/VERDICT:\s*(CLEAN|BAD)/i);
        return verdictMatch && verdictMatch[1].toUpperCase() === 'CLEAN';
    } catch(e) {
        return false;
    }
}

export const extractQuestionsFromSinglePage = async (pagePdfBuffer, testId = 'temp', filePath, startPage, endPage, language = 'English') => {
    const base64Pdf = pagePdfBuffer.toString('base64');
    const sizeKB = Math.round(base64Pdf.length / 1024);
    
    logger.info(`[GEMINI NATIVE] Sending single PDF page to Gemini (${sizeKB} KB base64) with language constraint: ${language}`);

    let languageRule = `1. Extract ALL questions from this page. Do NOT skip any question.`;
    if (language !== 'Bilingual') {
        languageRule = `1. LANGUAGE CONSTRAINT: The user strictly requested ${language}. If the document contains multiple languages side-by-side (e.g., English and Hindi), you MUST COMPLETELY IGNORE the other language and ONLY extract the ${language} version of the questions and options. Missing a ${language} question or extracting a duplicate in another language is a fatal failure.`;
    }

    const prompt = `You are an expert NTA NEET exam digitizer and question extractor. 
Analyze this SINGLE PAGE PDF document and extract EVERY SINGLE multiple choice question from it.

MANDATORY RULES:
${languageRule}
2. NORMALIZE OPTIONS: Map all option identifiers to "A", "B", "C", "D" (even if printed as 1, 2, 3, 4 or a, b, c, d).
3. LATEX FORMULAS — each mathematical expression must have its OWN separate $...$ pair. NEVER let English words appear inside $...$.
   - CORRECT: "the dimensions of $\\frac{A}{B}$ and $\\frac{C}{D}$ are"  (two separate pairs, space between them)
   - WRONG:   "the dimensions of$\\frac{A}{B}and\\frac{C}{D}$are"         (words fused inside one $...$ — FORBIDDEN)
   - Keep plain English words completely outside any $...$ markers with normal spaces on both sides.
   - In JSON output, each backslash inside a $...$ string must be doubled: write "\\\\frac" to produce \\frac in the output.
4. ASSERTION-REASON QUESTIONS: If a question has an Assertion and a Reason, format questionText as EXACTLY TWO lines with a literal newline (\n) between them:
   "Assertion: <assertion text>\nReason: <reason text>"
   - Always prefix with exactly "Assertion:" and "Reason:" (colon, no dash).
   - The newline (\n) between them is MANDATORY — never put them on the same line.
5. MATCH THE FOLLOWING / COLUMN-MATCHING QUESTIONS: Format as numbered plain-text lines. NEVER use pipe characters (|) or markdown table syntax (:---) for ANY reason.
   - CORRECT: "Match the following:\n1. Mitochondria - Powerhouse\n2. Ribosome - Protein synthesis"
   - WRONG:   "Column I | Column II\n:---|:---\nMitochondria | Powerhouse"   (pipe/markdown FORBIDDEN)
6. DIAGRAMS & FIGURES: Only set 'imageBox' when the question contains an actual VISUAL element: photograph, drawn diagram, anatomical figure, graph/chart, chemical structure, or circuit diagram.
   - CRITICAL BOUNDING BOX RULE: Your imageBox must capture EXACTLY the figure content needed to answer the question — nothing less, nothing more.
     * INCLUDE: the diagram/graph/circuit/chemical structure/table itself, all its internal labels, axis values, numbers, component values. 
     * INCLUDE VISUAL OPTIONS: If the answer options themselves are visual (e.g., 4 small graphs, 4 small diagrams labeled (1)-(4)), you MUST include ALL of those option-graphs as part of the SAME imageBox. Stretch the ymax downwards to encompass them.
     * EXCLUDE (CRITICAL): The question's own stem text repeated above the figure, answer options that are plain text/formulas, headers, footers, institute names, date stamps, "Space for Rough Work", and anything from adjacent questions.
     * DO NOT let the bounding box touch ANY text that is part of the question itself (e.g. "Water flows through a frictionless duct...", "In given LCR circuit..."). Start the box strictly AT the first visual pixel of the diagram.

   - Example A (OVER-INCLUSION - BAD): For a duct-flow diagram, drawing a box that includes the text "Water flows through a frictionless duct..." above it and the page footer below it. Correct behavior: tightly crop only the duct diagram (and its visual options if they exist), EXCLUDING the textual stem.
   - Example B (UNDER-INCLUSION - BAD): A question where a main diagram is followed by 4 small graph answer options labeled (1)-(4). Drawing a box that stops at the main diagram alone. Correct behavior: extend the box downwards to include all 4 graphs.
   
   - Do NOT set imageBox for text-only tables, assertion tables, or column-matching text. If valid, use "imageBox": { "page": 1, "box": [0.12, 0.5, 0.45, 0.9] } (scale 0-1) and "hasDiagram": true. Note that "page" MUST be the 1-indexed page number WITHIN the PDF chunk provided (e.g. 1 or 2).
7. JSON ESCAPING: Correctly escape all backslashes. To output $\\frac{1}{2}$ write "$\\\\frac{1}{2}$" in the JSON string. Do NOT output raw control characters.
8. ANSWER KEYS: Extract if available; else set "correctAnswer": "A" and "explanation": null.
9. SUBJECT DETECTION: Classify based on content — "Physics", "Chemistry", or "Biology". Ignore question numbering order.
10. CHAPTER DETECTION: Identify the chapter/topic name if visible.

OUTPUT: Return a valid JSON array of question objects. No markdown fences. No extra text.

[
  {
    "questionNumber": 1,
    "subject": "Physics",
    "chapter": "Kinematics",
    "questionText": "Full question text including all sub-parts",
    "hasDiagram": false,
    "imageBox": null, // If it has a diagram, MUST be: { "page": 1, "box": [0.12, 0.5, 0.45, 0.9] }
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
    
    // Config values
    const promptVersion = 'v3'; // Bumped for schema change
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const responseSchema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                questionNumber: { type: "number" },
                subject: { type: "string" },
                chapter: { type: "string" },
                questionText: { type: "string" },
                hasDiagram: { type: "boolean" },
                imageBox: {
                    type: "object",
                    nullable: true,
                    description: "If there is a diagram, output an object with 'page' (the 1-indexed page number within the chunk, e.g. 1 or 2) and 'box' (array of 4 numbers [ymin, xmin, ymax, xmax] scaled 0 to 1). Leave null if no diagram.",
                    properties: {
                        page: { type: "number" },
                        box: {
                            type: "array",
                            items: { type: "number" }
                        }
                    },
                    required: ["page", "box"]
                },
                options: {
                    type: "object",
                    properties: {
                        A: { type: "string" },
                        B: { type: "string" },
                        C: { type: "string" },
                        D: { type: "string" }
                    }
                },
                correctAnswer: { type: "string" },
                explanation: { type: "string", nullable: true },
                difficulty: { type: "string" }
            },
            required: ["questionNumber", "subject", "chapter", "questionText", "hasDiagram", "options", "correctAnswer", "difficulty"]
        }
    };

    while (retries > 0 && !success) {
        let abortController = new AbortController();
        let timeoutId = setTimeout(() => abortController.abort('TIMEOUT'), 120000); // 120s hard timeout
        
        try {
            const attempt = 5 - retries;
            
            // Global Rate Limiter: Max 12 requests per minute (Gemini free tier allows 15 RPM, leaving buffer)
            try {
                const { getRedisConnection } = await import('../queue/index.js');
                const redis = getRedisConnection();
                if (redis) {
                    const minuteKey = `ratelimit:gemini:${Math.floor(Date.now() / 60000)}`;
                    const reqCount = await redis.incr(minuteKey);
                    if (reqCount === 1) await redis.expire(minuteKey, 120);
                    if (reqCount > 12) {
                        logger.warn(`[GEMINI NATIVE] Rate limit reached (${reqCount}/12). Waiting 10s...`);
                        await delay(10000); // Wait 10 seconds and try again (will fail this attempt, or just loop)
                        // Actually, just wait here without throwing, then proceed
                        // Wait, it's safer to just throw and let the retry loop handle it
                        throw new Error("429 Too Many Requests: Global Rate Limit Exceeded");
                    }
                }
            } catch (rlErr) {
                if (rlErr.message.includes("Rate Limit Exceeded")) throw rlErr;
                logger.warn(`[GEMINI NATIVE] Rate limiter check failed, ignoring: ${rlErr.message}`);
            }

            logger.info(`[GEMINI NATIVE] Attempt ${attempt}/4 — Calling ${modelName} with PDF inline data...`);
            
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    { inlineData: { data: base64Pdf, mimeType: 'application/pdf' } },
                    prompt
                ],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema,
                    maxOutputTokens: 16384
                }
            }, { signal: abortController.signal });
            
            clearTimeout(timeoutId);

            if (!response || !response.text) {
                logger.warn('[GEMINI NATIVE] Empty response from Gemini. Retrying...');
                retries--;
                await delay(2000);
                continue;
            }
            
            console.log("\n[RAW USAGE METADATA]:", JSON.stringify(response.usageMetadata, null, 2));
            console.log("\n[RAW STRING START]:", response.text.slice(0, 500));
            console.log("\n[RAW STRING END]:", response.text.slice(-500));
            
            // Usage Logging (A1)
            try {
                const usage = response.usageMetadata || {};
                const { createClient } = await import('@supabase/supabase-js');
                const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
                await sb.from('gemini_usage').insert({
                    model: modelName,
                    prompt_tokens: usage.promptTokenCount || 0,
                    candidates_tokens: usage.candidatesTokenCount || 0,
                    thoughts_tokens: usage.thoughtsTokenCount || 0,
                    total_tokens: usage.totalTokenCount || 0
                });
                
                // Track daily spend in Redis
                const { getRedisConnection } = await import('../queue/index.js');
                const redis = getRedisConnection();
                const today = new Date().toISOString().split('T')[0];
                
                // Approximate cost calculation (gemini-3.6-flash: $0.075/1M in, $0.30/1M out -> INR conversion ~84)
                // Let's use standard $0.75 / $3.75 for now as worst case
                const inCost = (usage.promptTokenCount || 0) * (0.75 / 1000000);
                const outCost = ((usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)) * (3.75 / 1000000);
                const totalInr = (inCost + outCost) * 84;
                
                await redis.incrbyfloat(`daily_spend_inr:${today}`, totalInr);
                await redis.expire(`daily_spend_inr:${today}`, 3600 * 24 * 7); // keep for 7 days
                
            } catch (e) {
                logger.error('[GEMINI NATIVE] Usage logging failed:', e.message);
            }

            const rawText = response.text.trim();
            const parsedRaw = robustParseQuestions(rawText);
            
            // Post-parse safety net (Item 4)
            // Scan every string field in parsed questions for control characters
            let unrepairableFound = false;
            
            const scanAndRepairString = (str) => {
                if (typeof str !== 'string') return str;
                if (!/[\x00-\x1f]/.test(str)) return str;
                
                // We found a raw control character inside a string value (which means the JSON parser allowed it, or the SDK schema bypassed it)
                // Repair unambiguous cases: Form Feed -> \f (often \frac), Backspace -> \b (often \beta), Tab -> \t, CR -> \r, LF -> \n
                let repaired = str.replace(/\x0c/g, '\\f')
                                  .replace(/\x08/g, '\\b')
                                  .replace(/\x0b/g, '\\v');
                
                if (/[\x00-\x07\x0b\x0e-\x1f]/.test(repaired)) {
                    unrepairableFound = true;
                }
                return repaired;
            };

            const repairObject = (obj) => {
                if (Array.isArray(obj)) return obj.map(repairObject);
                if (obj !== null && typeof obj === 'object') {
                    for (const key in obj) {
                        obj[key] = repairObject(obj[key]);
                    }
                    return obj;
                }
                return scanAndRepairString(obj);
            };

            const safeParsedRaw = repairObject(parsedRaw);
            
            if (unrepairableFound) {
                logger.warn(`[GEMINI NATIVE] Control characters found in raw text! Escaping unambiguous ones.`);
                throw new Error("UNREPAIRABLE_CONTROL_CHARACTERS_FOUND");
            }
            const normalized = normalizeQuestions(safeParsedRaw);

            // Post-process all image boxes: PASS 2 VISUAL HUNT
            for (const q of normalized) {
                if (q.hasDiagram) {
                    try {
                        let finalUrl = null;
                        
                        // Only perform the hunt if we have the context args
                        if (filePath && startPage && endPage) {
                            finalUrl = await performPass2Hunt(q, filePath, startPage, endPage, testId, ai);
                        } else {
                            logger.warn(`[GEMINI NATIVE] Missing context args for Pass 2 Hunt on Q${q.questionNumber || q.qNum}. Diagram will be skipped.`);
                        }
                        
                        if (finalUrl) {
                            q.imageUrl = finalUrl;
                            q.imageBox = null;
                        } else {
                            if (q.imageBox) {
                                logger.warn(`[GEMINI NATIVE] Pass 2 Hunt failed to verify diagram for Q${q.questionNumber || q.qNum}. Falling back to Pass 1 imageBox.`);
                            } else {
                                logger.warn(`[GEMINI NATIVE] Pass 2 Hunt failed and no Pass 1 imageBox for Q${q.questionNumber || q.qNum}. Setting NO image.`);
                                q.hasDiagram = false;
                            }
                        }
                    } catch (e) {
                        logger.error(`[GEMINI NATIVE] Pass 2 Hunt threw error for Q${q.questionNumber || q.qNum}: ${e.message}`);
                        if (!q.imageBox) {
                            q.hasDiagram = false;
                        }
                    }
                }
            }

            logger.info(`[GEMINI NATIVE] Parsed ${normalized.length} questions from page`);
            extractedQuestions = normalized;
            success = true;
            
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            const errStr = (error.message || error).toString();
            logger.warn(`[GEMINI NATIVE] Attempt ${5 - retries} failed: ${errStr}`);
            
            if (errStr.includes("UNREPAIRABLE_CONTROL_CHARACTERS_FOUND")) {
                logger.error(`[GEMINI NATIVE] Unrepairable control characters. Cannot cache or use this chunk.`);
                // Do not mark as fatal quota, just retry
            }

            const isFatal = errStr.includes('quota') || errStr.includes('billing') || errStr.includes('depleted') || errStr.includes('402') || errStr.includes('403') || errStr.includes('PERMISSION_DENIED');
            if (isFatal) {
                logger.error(`[GEMINI NATIVE] Fatal API error (402/403), aborting retries.`);
                retries = 0;
                break;
            }

            retries--;
            if (retries > 0) {
                const attempt = 5 - retries;
                // Parse Retry-After from 429 if available, else exponential backoff
                let delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 40000);
                const retryMatch = errStr.match(/retry in (\d+(\.\d+)?)s/i);
                if (retryMatch && retryMatch[1]) {
                    delayMs = Math.max(delayMs, parseFloat(retryMatch[1]) * 1000 + 1000);
                }
                logger.warn(`[GEMINI NATIVE] Retrying in ${delayMs/1000}s...`);
                await delay(delayMs);
            }
        }
    }

    if (!success) {
        logger.error(`[GEMINI NATIVE] Failed after all retries. Last error: ${lastError?.message || lastError}`);
        return { questions: [], failed: true, reason: lastError?.message || String(lastError) };
    }

    return { questions: extractedQuestions, failed: false, promptVersion };
};

// Remove extractQuestionsFromPDFBuffer and extractQuestionsFromChunk entirely to prevent their usage

export async function performPass2Hunt(q, filePath, startPage, endPage, testId, aiClient) {
    const windowStart = Math.max(1, startPage - 3);
    const windowEnd = endPage + 3;
    const b64 = await splitPdfIntoChunk(filePath, windowStart, windowEnd);
    const buf = Buffer.from(b64, 'base64');
    
    let bestBox = null;
    let bestPageInWindow = 1;
    let isClean = false;
    let finalUrl = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
        logger.info(`[GEMINI PASS 2] Q${q.questionNumber || q.qNum} Hunt Attempt ${attempt}/2 in pages ${windowStart}-${windowEnd}`);
        try {
            const prompt = `Find the diagram that corresponds to this exact question text: "${q.questionText}". 
Options are: ${JSON.stringify(q.options)}.
Return the bounding box of this diagram within the provided PDF. 
Respond with ONLY a JSON object in this format: { "page": [1, 2, or 3 relative to this chunk], "box": [ymin, xmin, ymax, xmax] }. If you absolutely cannot find it, return { "box": null }.`;

            const res = await aiClient.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: [
                    { inlineData: { data: b64, mimeType: 'application/pdf' } },
                    { text: prompt }
                ]
            });
            const txt = res.text.replace(/```/g, '').replace(/json/g, '').trim();
            const parsed = JSON.parse(txt);
            
            if (parsed && parsed.box && parsed.box.length === 4) {
                bestBox = parsed.box;
                bestPageInWindow = parsed.page || 1;
                
                const absoluteTargetPage = windowStart + bestPageInWindow - 1;
                const specificPageB64 = await splitPdfIntoChunk(filePath, absoluteTargetPage, absoluteTargetPage);
                const specificPageBuf = Buffer.from(specificPageB64, 'base64');
                
                const cropUrl = await cropAndUploadDiagram(specificPageBuf, bestBox, testId, q.questionNumber || q.qNum);
                if (cropUrl) {
                    isClean = await verifyCrop(cropUrl, aiClient, q);
                    if (isClean) {
                        finalUrl = cropUrl;
                        logger.info(`[GEMINI PASS 2] Q${q.questionNumber || q.qNum} Hunt SUCCESS!`);
                        break;
                    } else {
                        logger.warn(`[GEMINI PASS 2] Q${q.questionNumber || q.qNum} verification failed on attempt ${attempt}`);
                    }
                }
            } else {
                logger.warn(`[GEMINI PASS 2] Q${q.questionNumber || q.qNum} no box found by Gemini on attempt ${attempt}`);
            }
        } catch (e) {
            logger.warn(`[GEMINI PASS 2] Hunt attempt ${attempt} failed: ${e.message}`);
        }
    }
    
    return finalUrl;
}
