import * as mupdf from 'mupdf';
import { logger } from '../utils/logger.js';

// ─── BUG 1c FIX: WeakMap cache for mupdf doc + per-page parsed text ───
// Avoids re-parsing the same PDF buffer on every call.
const _docCache = new WeakMap();  // Buffer → { doc, pages: Map<pageIdx, {blocks, pw, ph}> }

function getCachedDoc(pdfBuffer) {
    let cached = _docCache.get(pdfBuffer);
    if (cached) return cached;
    const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
    cached = { doc, pages: new Map() };
    _docCache.set(pdfBuffer, cached);
    return cached;
}

function getCachedPage(pdfBuffer, pageIdx) {
    const { doc, pages } = getCachedDoc(pdfBuffer);
    if (pages.has(pageIdx)) return pages.get(pageIdx);
    const totalPages = doc.countPages();
    if (pageIdx < 0 || pageIdx >= totalPages) return null;
    const page = doc.loadPage(pageIdx);
    const b = page.getBounds();
    const pw = b[2] - b[0];
    const ph = b[3] - b[1];
    if (pw <= 0 || ph <= 0) return null;
    const st = page.toStructuredText();
    const json = JSON.parse(st.asJSON());
    const blocks = json.blocks || [];
    const result = { blocks, pw, ph };
    pages.set(pageIdx, result);
    return result;
}

function getTotalPages(pdfBuffer) {
    const { doc } = getCachedDoc(pdfBuffer);
    return doc.countPages();
}

const FIGURE_NOUNS = '(?:diagrams?|figures?|figs?\\.?|graphs?|charts?|flow\\s*charts?|pie\\s*charts?|schematics?|circuits?|body\\s*plans?)';

export const FIGURE_INTENT_REGEX = new RegExp(
    '\\b(' + [
        `(?:given|shown|represented|accompanying|following)\\s+${FIGURE_NOUNS}`,
        `${FIGURE_NOUNS}\\s+(?:given|shown|represented|below|above)`,
        `in\\s+the\\s+(?:given\\s+)?${FIGURE_NOUNS}`,
        `(?:as\\s+)?shown\\s+in\\s+(?:the\\s+)?(?:given\\s+)?${FIGURE_NOUNS}`,
        `${FIGURE_NOUNS}\\s+shows?`,
        `refer\\s+to\\s+(?:the\\s+)?${FIGURE_NOUNS}`,
        `observe\\s+the\\s+(?:following|given)\\s+${FIGURE_NOUNS}`,
        `given\\s+below\\s+is\\s+(?:a|the|an)?\\s*(?:schematic\\s+representation|body\\s+plan|${FIGURE_NOUNS})`,
        `(?:structure|cell|organism)\\s+shown\\s+in\\s+(?:the\\s+)?(?:given\\s+)?${FIGURE_NOUNS}`,
        `the\\s+following\\s+structure\\s+is\\s+most\\s+likely`,
        `(?:marked|labelled)\\s+(?:as\\s+)?['"][a-zA-Z0-9]['"]\\s+in\\s+the\\s+(?:given\\s+)?${FIGURE_NOUNS}`,
        `identify\\s+the\\s+parts?\\s+[a-zA-Z0-9\\-]+(?:\\s+in\\s+the\\s+(?:given\\s+)?${FIGURE_NOUNS})?`
    ].join('|') + ')\\b',
    'i'
);

// General visual necessity rule:
// Questions where the stem refers to an unstated specimen/drawing via demonstratives
export const VISUAL_NECESSITY_REGEX = /\b(this\s+(?:type|kind|specimen)\s+of\s+(?:egg|cell|organism|tissue|animal|plant|structure|flower|leaf|fruit|seed|heart)|the\s+organism\s+shown\s+in\s+the\s+given\s+figure)\b/i;

export function hasDegenerateOrVisualOptions(options, stem = '') {
    if (!options) return false;
    // If the question explicitly asks for a count (e.g. "The number of correct statements: 1, 2, 3, 4"),
    // the numeric options are count values, not visual option diagrams.
    if (/the\s+number\s+of\s+(?:correct|incorrect|true|false)\s+statements/i.test(stem)) {
        return false;
    }
    if (typeof options === 'object') {
        const vals = Object.values(options).map(v => typeof v === 'string' ? v.trim() : String(v || '').trim());
        if (vals.length === 0) return true;
        // Strictly bare numbers or degenerate markers like "1.", "(1)", "Option A" with NO real text
        return vals.every(v => !v || /^(?:(?:\(?\d+\)?|\(?[a-dA-D]\)?|\d+[\.)]|Option\s+[a-dA-D]))$/i.test(v));
    }
    return false;
}

export function isFigureRequired(text, options = null) {
    const stem = typeof text === 'string' ? text : '';
    if (!stem && !options) return false;

    if (FIGURE_INTENT_REGEX.test(stem)) return true;
    if (VISUAL_NECESSITY_REGEX.test(stem)) return true;
    if (options && hasDegenerateOrVisualOptions(options, stem)) return true;

    return false;
}

// ─── BUG 1a FIX: When pageIndex is -1, collect ALL pages with the anchor
// and pick the best one using stem keyword overlap. ───

/**
 * Find the best page for a question number by matching stem keywords.
 * Returns { pageIdx, anchorLine, blocks, pw, ph } or null.
 */
function findBestPageForQuestion(pdfBuffer, parsedQNum, qText) {
    const totalPages = getTotalPages(pdfBuffer);
    const qNumPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum}(?:[\\.:;\\s]|$)`, 'i');

    // Collect all pages that have the anchor
    const candidates = [];
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        const pageData = getCachedPage(pdfBuffer, pIdx);
        if (!pageData) continue;
        const { blocks, pw, ph } = pageData;

        for (const blk of blocks) {
            if (blk.type === 'text' && blk.lines) {
                for (const line of blk.lines) {
                    if (qNumPattern.test(line.text.trim())) {
                        candidates.push({ pageIdx: pIdx, anchorLine: line, blocks, pw, ph });
                        break; // first match on this page is enough
                    }
                }
            }
            if (candidates.length > 0 && candidates[candidates.length - 1].pageIdx === pIdx) break;
        }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Multiple pages have this question number. Pick the one whose text shares
    // the most stem keywords (avoids matching "1." on an instructions page).
    const stemKeywords = (qText || '')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 10);

    if (stemKeywords.length === 0) {
        // No keywords to disambiguate — prefer pages after the first (skip instructions)
        return candidates[candidates.length - 1];
    }

    let bestCandidate = candidates[0];
    let bestScore = -1;

    for (const cand of candidates) {
        // Collect all text on this page
        let pageText = '';
        for (const blk of cand.blocks) {
            if (blk.type === 'text' && blk.lines) {
                for (const line of blk.lines) {
                    pageText += ' ' + line.text;
                }
            }
        }
        const lowerPageText = pageText.toLowerCase();
        const score = stemKeywords.filter(kw => lowerPageText.includes(kw.toLowerCase())).length;
        if (score > bestScore) {
            bestScore = score;
            bestCandidate = cand;
        }
    }

    return bestCandidate;
}


/**
 * Fallback to the single-column band around a question (from anchor to next question in same column).
 * BUG 1a FIX: accepts optional qText param for keyword-based page disambiguation.
 */
export function getQuestionColumnBandBox(pdfBuffer, qNum, pageIndex = -1, qText = '') {
    if (!pdfBuffer || !qNum) return null;
    try {
        const totalPages = getTotalPages(pdfBuffer);
        const parsedQNum = parseInt(String(qNum).replace(/\D/g, ''), 10);
        if (!parsedQNum) return null;

        const qNumPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum}(?:[\\.:;\\s]|$)`, 'i');
        const nextQPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum + 1}(?:[\\.:;\\s]|$)`, 'i');

        let targetPageIdx, anchorLine, blocks, pw, ph;

        if (pageIndex >= 0 && pageIndex < totalPages) {
            // Use specified page
            const pageData = getCachedPage(pdfBuffer, pageIndex);
            if (!pageData) return null;
            ({ blocks, pw, ph } = pageData);
            targetPageIdx = pageIndex;

            // Find anchor on this page
            for (const blk of blocks) {
                if (blk.type === 'text' && blk.lines) {
                    for (const line of blk.lines) {
                        if (qNumPattern.test(line.text.trim())) {
                            anchorLine = line;
                            break;
                        }
                    }
                }
                if (anchorLine) break;
            }
        } else {
            // BUG 1a FIX: use keyword-based page disambiguation
            const best = findBestPageForQuestion(pdfBuffer, parsedQNum, qText);
            if (!best) return null;
            ({ pageIdx: targetPageIdx, anchorLine, blocks, pw, ph } = best);
        }

        if (!anchorLine) return null;

        let nextAnchorLine = null;
        let foundAnchor = false;
        for (const blk of blocks) {
            if (blk.type === 'text' && blk.lines) {
                for (const line of blk.lines) {
                    if (line === anchorLine) {
                        foundAnchor = true;
                        continue;
                    }
                    if (foundAnchor && nextQPattern.test(line.text.trim())) {
                        nextAnchorLine = line;
                        break;
                    }
                }
            }
            if (nextAnchorLine) break;
        }

        const isLeft = anchorLine.bbox.x < pw * 0.48;
        const colXmin = isLeft ? 0.02 : 0.48;
        const colXmax = isLeft ? 0.50 : 0.98;

        // Start slightly above the question anchor line
        const ymin = Math.max(0.06, (anchorLine.bbox.y / ph) - 0.01);

        let ymax = 0.92; // default page bottom before footer
        if (nextAnchorLine) {
            const nextIsLeft = nextAnchorLine.bbox.x < pw * 0.48;
            if (nextIsLeft === isLeft) {
                ymax = Math.min(0.92, (nextAnchorLine.bbox.y / ph) - 0.005);
            }
        }

        const box = [
            Math.round(ymin * 10000) / 10000,
            colXmin,
            Math.round(ymax * 10000) / 10000,
            colXmax
        ];
        box.page = targetPageIdx + 1;
        box.isFallbackBand = true;
        return box;
    } catch (e) {
        logger.warn(`[diagramDetector] getQuestionColumnBandBox error: ${e.message}`);
        return null;
    }
}

/**
 * Deterministically finds the bounding box [ymin, xmin, ymax, xmax] (normalized 0-1)
 * of a diagram associated with a question on a PDF page using MuPDF structured text.
 * 
 * BUG 1a FIX: When pageIndex is -1, uses keyword-based page disambiguation.
 * BUG 1b FIX: Restricts stem-line search to lines between this question's anchor
 *             and the next question's anchor only.
 * BUG 1c FIX: Uses WeakMap cache for mupdf doc + per-page parsed text.
 */
export function findDeterministicDiagramBox(pdfBuffer, qNum, qText, pageIndex = 0) {
    if (!pdfBuffer || !qNum) return null;

    try {
        const totalPages = getTotalPages(pdfBuffer);
        if (totalPages === 0) return null;

        const parsedQNum = parseInt(String(qNum).replace(/\D/g, ''), 10);
        if (!parsedQNum) return null;

        const qNumPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum}(?:[\\.:;\\s]|$)`, 'i');

        let targetPageIdx, anchorLine, blocks, pageWidth, pageHeight;

        if (pageIndex >= 0) {
            // Try specified page first
            const clampedIdx = Math.min(pageIndex, totalPages - 1);
            const pageData = getCachedPage(pdfBuffer, clampedIdx);
            if (pageData) {
                ({ blocks, pw: pageWidth, ph: pageHeight } = pageData);
                for (const blk of blocks) {
                    if (blk.type === 'text' && blk.lines) {
                        for (const line of blk.lines) {
                            if (qNumPattern.test(line.text.trim())) {
                                anchorLine = line;
                                targetPageIdx = clampedIdx;
                                break;
                            }
                        }
                    }
                    if (anchorLine) break;
                }
            }
        }

        // If not found on target page (or pageIndex was -1), use keyword disambiguation
        if (!anchorLine) {
            const best = findBestPageForQuestion(pdfBuffer, parsedQNum, qText);
            if (!best) {
                logger.debug(`[diagramDetector] Question anchor not found for Q${parsedQNum} in ${totalPages} pages`);
                return null;
            }
            ({ pageIdx: targetPageIdx, anchorLine, blocks, pw: pageWidth, ph: pageHeight } = best);
        }

        // ─── BUG 1b FIX: Find next question anchor to bound the search region ───
        const nextQPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum + 1}(?:[\\.:;\\s]|$)`, 'i');
        let nextAnchorLine = null;
        let foundAnchor = false;
        for (const blk of blocks) {
            if (blk.type === 'text' && blk.lines) {
                for (const line of blk.lines) {
                    if (line === anchorLine) {
                        foundAnchor = true;
                        continue;
                    }
                    if (foundAnchor && nextQPattern.test(line.text.trim())) {
                        nextAnchorLine = line;
                        break;
                    }
                }
            }
            if (nextAnchorLine) break;
        }

        // Determine column bounds (NEET papers typically use 2 columns)
        const isLeftCol = anchorLine.bbox.x < pageWidth * 0.48;
        const colXmin = isLeftCol ? 0.02 * pageWidth : 0.48 * pageWidth;
        const colXmax = isLeftCol ? 0.50 * pageWidth : 0.98 * pageWidth;

        // ─── BUG 1b FIX: Extract keywords from question stem, search ONLY between
        // this question's anchor and the next question's anchor ───
        const stemKeywords = (qText || '')
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 8);

        let stemLine = null;
        for (const b of blocks) {
          if (b.type === 'text' && b.lines) {
            for (const line of b.lines) {
              // BUG 1b: Only consider lines BELOW the anchor
              if (line.bbox.y < anchorLine.bbox.y) continue;
              // BUG 1b: Only consider lines ABOVE the next question anchor (if exists)
              if (nextAnchorLine && line.bbox.y >= nextAnchorLine.bbox.y) continue;

              const inCol = isLeftCol ? line.bbox.x < pageWidth * 0.50 : line.bbox.x >= pageWidth * 0.45;
              if (!inCol) continue;
              const matchCount = stemKeywords.filter(kw => line.text.toLowerCase().includes(kw.toLowerCase())).length;
              if (matchCount >= 2 || (stemKeywords.length > 0 && line.text.toLowerCase().includes(stemKeywords[0].toLowerCase()))) {
                stemLine = line;
                break;
              }
            }
          }
          if (stemLine) break;
        }

        // Case A: Diagram ABOVE stem text (e.g., question 155 PCR diagram)
        if (stemLine && stemLine.bbox.y > anchorLine.bbox.y + 35) {
          const ymin = (anchorLine.bbox.y - 2) / pageHeight;
          const ymax = (stemLine.bbox.y - 4) / pageHeight;
          const xmin = colXmin / pageWidth;
          const xmax = colXmax / pageWidth;

          const box = [
            parseFloat(Math.max(0, ymin).toFixed(4)),
            parseFloat(Math.max(0, xmin).toFixed(4)),
            parseFloat(Math.min(1, ymax).toFixed(4)),
            parseFloat(Math.min(1, xmax).toFixed(4))
          ];
          box.page = targetPageIdx + 1;

          logger.info(`[diagramDetector] Detected diagram ABOVE stem text for Q${parsedQNum} (page ${box.page}): [${box.join(', ')}]`);
          return box;
        }

        // Case B: Diagram in vertical GAP below stem text and before options/next question
        // BUG 1b FIX: Only collect lines between anchor and next question boundary
        const colLines = [];
        for (const b of blocks) {
          if (b.type === 'text' && b.lines) {
            for (const line of b.lines) {
              const inCol = isLeftCol ? line.bbox.x < pageWidth * 0.50 : line.bbox.x >= pageWidth * 0.45;
              if (inCol && line.bbox.y >= anchorLine.bbox.y) {
                // BUG 1b: stop at next question anchor
                if (nextAnchorLine && line.bbox.y >= nextAnchorLine.bbox.y) continue;
                colLines.push(line);
              }
            }
          }
        }
        colLines.sort((a, b) => a.bbox.y - b.bbox.y);

        let boundaryLine = nextAnchorLine || null;

        // Also check for option markers as boundary
        for (let i = 0; i < colLines.length; i++) {
          const line = colLines[i];
          if (/^[\(\[\{]?(?:1|A)[\)\]\}]?\s+/i.test(line.text.trim()) && line.bbox.y > anchorLine.bbox.y + 15) {
            if (!boundaryLine || line.bbox.y < boundaryLine.bbox.y) {
              boundaryLine = line;
            }
            break;
          }
        }

        let maxGap = 0;
        let gapTop = 0;
        let gapBottom = 0;

        for (let i = 0; i < colLines.length; i++) {
          const cur = colLines[i];
          if (boundaryLine && cur.bbox.y >= boundaryLine.bbox.y) break;
          const curBottom = cur.bbox.y + cur.bbox.h;
          const next = (i + 1 < colLines.length) ? colLines[i + 1] : boundaryLine;
          if (next) {
            const gap = next.bbox.y - curBottom;
            if (gap > maxGap) {
              maxGap = gap;
              gapTop = curBottom;
              gapBottom = next.bbox.y;
            }
          }
        }

        if (maxGap > 35) {
          const ymin = (gapTop + 2) / pageHeight;
          const ymax = (gapBottom - 4) / pageHeight;
          const xmin = colXmin / pageWidth;
          const xmax = colXmax / pageWidth;

          const box = [
            parseFloat(Math.max(0, ymin).toFixed(4)),
            parseFloat(Math.max(0, xmin).toFixed(4)),
            parseFloat(Math.min(1, ymax).toFixed(4)),
            parseFloat(Math.min(1, xmax).toFixed(4))
          ];
          box.page = targetPageIdx + 1;
          box.isTightGap = true;

          logger.info(`[diagramDetector] Detected GAP diagram for Q${parsedQNum} (page ${box.page}, gap=${Math.round(maxGap)}pt): [${box.join(', ')}]`);
          return box;
        }

        // Deterministic Rule 2 Fallback: If no clean vertical gap was found, fall back to the smart single column band
        const fallbackBox = getQuestionColumnBandBox(pdfBuffer, parsedQNum, targetPageIdx, qText);
        if (fallbackBox) {
            logger.info(`[diagramDetector] Fallback to column band for Q${parsedQNum} (page ${fallbackBox.page}): [${fallbackBox.join(', ')}]`);
            return fallbackBox;
        }

        return null;
    } catch (err) {
        logger.warn(`[diagramDetector] Error analyzing Q${qNum} on page index ${pageIndex}: ${err.message}`);
        return null;
    }
}
