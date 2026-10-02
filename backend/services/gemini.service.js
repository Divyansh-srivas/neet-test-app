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
        const hasVisualOptions = !!(q.hasVisualOptions || q.optionImageBoxes);

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

        // Normalize optionImageBoxes - each value can be {page, box} or raw array
        let optionImageBoxes = null;
        if (q.optionImageBoxes && typeof q.optionImageBoxes === 'object') {
            optionImageBoxes = {};
            for (const [key, val] of Object.entries(q.optionImageBoxes)) {
                if (!val) continue;
                const upperKey = key.toUpperCase();
                if (val.box && Array.isArray(val.box)) {
                    optionImageBoxes[upperKey] = { page: val.page || 1, box: val.box };
                } else if (Array.isArray(val) && val.length === 4) {
                    optionImageBoxes[upperKey] = { page: 1, box: val };
                }
            }
            if (Object.keys(optionImageBoxes).length === 0) optionImageBoxes = null;
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
            hasVisualOptions: hasVisualOptions,
            diagramBox: q.diagramBox || imageBox || null,
            diagramUrl: q.diagramUrl || q.image || null,
            imageBox: imageBox,
            optionImageBoxes: optionImageBoxes,
            optionImageUrls: q.optionImageUrls || null,
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
        
        const response = await Promise.race([
            aiClient.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [{ role: 'user', parts: [
                    { inlineData: { mimeType: 'image/png', data: b64 } },
                    { text: promptText }
                ]}]
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 120000))
        ]);
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
6. DIAGRAMS & FIGURES (CRITICAL FOR CHEMISTRY): You MUST set 'imageBox' and "hasDiagram": true whenever a question or option contains an actual VISUAL element. This includes: photographs, graphs, anatomical figures, circuit diagrams, AND ESPECIALLY chemical structures.
   - DENSE INLINE CHEMICAL STRUCTURES: In IUPAC/Organic Chemistry questions, chemical structures are often small, dense, and placed inline (e.g., branched chains like CH3-CH(OH)-..., skeletal structures, benzene rings). These ARE diagrams. You MUST extract an imageBox for them. NEVER try to transcribe a complex 2D branched chemical structure purely as text if it relies on vertical bonds or rings — treat it as a diagram.
   - CRITICAL BOUNDING BOX RULE: Your imageBox must capture EXACTLY the figure content needed to answer the question — nothing less, nothing more.
     * INCLUDE: the diagram/graph/circuit/chemical structure/table itself, all its internal labels, axis values, numbers, component values.
     * For the question-level imageBox: ONLY include a diagram that appears in the question STEM (above the options). DO NOT include option diagrams here.
     * EXCLUDE (CRITICAL): The question's own stem text repeated above the figure, headers, footers, institute names, date stamps, "Space for Rough Work", and anything from adjacent questions.
     * DO NOT let the bounding box touch ANY text that is part of the question itself.
     * EXCEPTION FOR INLINE STRUCTURES: If a dense chemical structure is embedded inline directly next to the question text, you MAY include the immediately adjacent text in the bounding box if separating them is impossible.

   - VISUAL OPTIONS (CRITICAL NEW RULE): If answer options ARE diagrams/images (e.g., 4 chemical structures, 4 graphs, 4 circuit diagrams labeled A/B/C/D or (1)/(2)/(3)/(4)), you MUST:
     a) Set "hasVisualOptions": true
     b) Set the option text for each option to just the label: "(1)", "(2)", "(3)", "(4)" or whatever label is printed
     c) Set "optionImageBoxes" with a SEPARATE tight bounding box for EACH individual option diagram:
        - "A": { "page": 1, "box": [ymin, xmin, ymax, xmax] }  ← crops ONLY option A's diagram
        - "B": { "page": 1, "box": [ymin, xmin, ymax, xmax] }  ← crops ONLY option B's diagram
        - "C": { "page": 1, "box": [ymin, xmin, ymax, xmax] }  ← crops ONLY option C's diagram
        - "D": { "page": 1, "box": [ymin, xmin, ymax, xmax] }  ← crops ONLY option D's diagram
     d) Each box must be TIGHT around that single option's diagram only — not the label text, not other options.

   - Example A (VISUAL OPTIONS): A question "Which is the correct IUPAC structure?" with 4 chemical structures as options.
     CORRECT: hasVisualOptions=true, options={A:"(1)",B:"(2)",C:"(3)",D:"(4)"}, optionImageBoxes with 4 separate tight boxes.
     WRONG: Trying to put all 4 structures in one imageBox or leaving optionImageBoxes null.

   - Example B (STEM DIAGRAM + TEXT OPTIONS): A circuit diagram in the question with text options below.
     CORRECT: imageBox around the circuit only, no optionImageBoxes (options are text).

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
    "hasVisualOptions": false,
    "imageBox": null,
    "optionImageBoxes": null,
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
                hasVisualOptions: { type: "boolean", nullable: true },
                optionImageBoxes: {
                    type: "object",
                    nullable: true,
                    description: "If answer options are diagrams (hasVisualOptions is true), provide a bounding box for each option.",
                    properties: {
                        A: {
                            type: "object",
                            nullable: true,
                            properties: {
                                page: { type: "number" },
                                box: { type: "array", items: { type: "number" } }
                            },
                            required: ["page", "box"]
                        },
                        B: {
                            type: "object",
                            nullable: true,
                            properties: {
                                page: { type: "number" },
                                box: { type: "array", items: { type: "number" } }
                            },
                            required: ["page", "box"]
                        },
                        C: {
                            type: "object",
                            nullable: true,
                            properties: {
                                page: { type: "number" },
                                box: { type: "array", items: { type: "number" } }
                            },
                            required: ["page", "box"]
                        },
                        D: {
                            type: "object",
                            nullable: true,
                            properties: {
                                page: { type: "number" },
                                box: { type: "array", items: { type: "number" } }
                            },
                            required: ["page", "box"]
                        }
                    }
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
                    let allowed = false;
                    while (!allowed) {
                        const minuteKey = `ratelimit:gemini:${Math.floor(Date.now() / 60000)}`;
                        const reqCount = await redis.incr(minuteKey);
                        if (reqCount === 1) await redis.expire(minuteKey, 120);
                        
                        if (reqCount > 12) {
                            logger.warn(`[GEMINI NATIVE] Rate limit reached (${reqCount}/12). Waiting 10s before retry...`);
                            await delay(10000);
                            // Do not throw, just loop and try again in the new/current minute
                        } else {
                            allowed = true;
                        }
                    }
                }
            } catch (rlErr) {
                logger.warn(`[GEMINI NATIVE] Rate limiter check failed, ignoring: ${rlErr.message}`);
            }

            logger.info(`[GEMINI NATIVE] Attempt ${attempt}/4 — Calling ${modelName} with PDF inline data...`);
            
            // If we are retrying specifically because of a language mismatch, inject a very aggressive reminder
            let currentPrompt = prompt;
            if (lastError && lastError.message === "LANGUAGE_MISMATCH_DETECTED") {
                currentPrompt += `\n\nCRITICAL SYSTEM OVERRIDE: YOUR PREVIOUS ATTEMPT FAILED BECAUSE YOU USED THE WRONG LANGUAGE. YOU MUST ABSOLUTELY RE-WRITE EVERY QUESTION AND OPTION IN STRICT ${language.toUpperCase()} REGARDLESS OF THE ORIGINAL DOCUMENT TEXT.`;
            }

            let response;
            try {
                response = await Promise.race([
                    ai.models.generateContent({
                        model: modelName,
                        contents: [
                            { inlineData: { data: base64Pdf, mimeType: 'application/pdf' } },
                            currentPrompt
                        ],
                        config: {
                            responseMimeType: 'application/json',
                            responseSchema: responseSchema,
                            maxOutputTokens: 16384
                        }
                    }),
                    new Promise((_, reject) => {
                        const localTimeout = setTimeout(() => reject(new Error('TIMEOUT')), 120000);
                        // Store it to clear later if needed, but the main block will handle it
                        // Actually, we can just reject immediately and the catch block catches it
                    })
                ]);
            } finally {
                clearTimeout(timeoutId);
            }

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
                const { supabaseAdmin } = await import('../config/supabase.js');
                await supabaseAdmin.from('gemini_usage').insert({
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

            // REQUIREMENT 2: Post-extraction language script validation
            let languageMismatch = false;
            let expectedScript = language === 'Hindi' ? 'Devanagari' : (language === 'English' ? 'Latin' : 'Any');
            
            if (expectedScript !== 'Any' && normalized.length > 0) {
                for (const q of normalized) {
                    const textToCheck = q.questionText + " " + Object.values(q.options || {}).join(" ");
                    // Simple heuristic: count Hindi characters
                    const hindiMatches = textToCheck.match(/[\u0900-\u097F]/g);
                    const hindiCount = hindiMatches ? hindiMatches.length : 0;
                    
                    // Filter out math/numbers/ascii to get pure letters for ratio calculation
                    const lettersOnly = textToCheck.replace(/[^a-zA-Z\u0900-\u097F]/g, '');
                    const totalLetters = lettersOnly.length;
                    
                    if (totalLetters > 10) { 
                        const hindiRatio = hindiCount / totalLetters;
                        
                        if (expectedScript === 'Devanagari' && hindiRatio < 0.1) {
                            logger.warn(`[GEMINI NATIVE] Expected Hindi but found English (ratio ${hindiRatio.toFixed(2)}): "${q.questionText.substring(0, 50)}..."`);
                            languageMismatch = true;
                            break;
                        } else if (expectedScript === 'Latin' && hindiRatio > 0.2) {
                            logger.warn(`[GEMINI NATIVE] Expected English but found Hindi (ratio ${hindiRatio.toFixed(2)}): "${q.questionText.substring(0, 50)}..."`);
                            languageMismatch = true;
                            break;
                        }
                    }
                }
            }
            
            if (languageMismatch) {
                throw new Error("LANGUAGE_MISMATCH_DETECTED");
            }

            logger.info(`[GEMINI NATIVE] Parsed ${normalized.length} questions from page (Language: ${language} - Verified)`);
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
                } else if (errStr.includes('429')) {
                    // Force a 30s wait on 429 Quota Exceeded if no retry-after is provided
                    delayMs = Math.max(delayMs, 30000);
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

            const res = await Promise.race([
                aiClient.models.generateContent({
                    model: 'gemini-3.6-flash',
                    contents: [
                        { inlineData: { data: b64, mimeType: 'application/pdf' } },
                        { text: prompt }
                    ]
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 120000))
            ]);
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
