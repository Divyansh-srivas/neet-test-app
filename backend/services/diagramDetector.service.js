import * as mupdf from 'mupdf';
import { logger } from '../utils/logger.js';

export const FIGURE_INTENT_REGEX = new RegExp(
    '\\b(' + [
        'diagrams?',
        'figures?',
        'figs?\\.?',
        'graphs?',
        'charts?',
        'flow\\s*charts?',
        'pie\\s*charts?',
        'structure\\s+shown',
        'as\\s+shown',
        'given\\s+below',
        'schematics?',
        'body\\s+plans?',
        'shown\\s+in',
        'following\\s+structures?',
        'refer\\s+to\\s+the\\s+(?:diagram|figure|graph)',
        'observe\\s+the\\s+(?:following|given)',
        'identify\\s+(?:each\\s+step|the\\s+steps?|[xyzpabcd]\\b)',
        'step\\s+[\'"]?[xyzpabcd][\'"]?',
        'part\\s+[\'"]?[xyzpabcd][\'"]?',
        'labelled\\s+(?:as\\s+)?[\'"]?[xyzpabcd][\'"]?',
        'given\\s+below\\s+represents',
        'represented\\s+in\\s+the'
    ].join('|') + ')\\b',
    'i'
);

export const VISUAL_NECESSITY_REGEX = /\b(this\s+type\s+of\s+[a-z]+|observe\s+the\s+following|the\s+following\s+[a-z]+\s+shows|marked\s+as\s+['"][a-z0-9]['"]|parts?\s+labelled|identify\s+the\s+parts|represented\s+in\s+the\s+following|which\s+of\s+the\s+following\s+reptilian\s+hearts|can\s+be\s+that\s+of)\b/i;

export function hasDegenerateOrVisualOptions(options) {
    if (!options) return false;
    if (typeof options === 'object') {
        const vals = Object.values(options).map(v => typeof v === 'string' ? v.trim() : String(v || '').trim());
        if (vals.length === 0) return true;
        // Check if all options are bare numbers like "1.", "(1)", "1", "Option 1"
        const isDegenerate = vals.every(v => !v || /^(?:(?:\(?\d+\)?|\(?[a-dA-D]\)?|Option\s+[a-dA-D]|\d+[\.\)]?))$/i.test(v));
        return isDegenerate;
    }
    return false;
}

export function isFigureRequired(text, options = null) {
    const stem = typeof text === 'string' ? text : '';
    let optionsText = '';
    if (options && typeof options === 'object') {
        optionsText = Object.values(options).join(' ');
    }
    const combined = `${stem} ${optionsText}`.trim();
    if (!combined) return false;

    if (FIGURE_INTENT_REGEX.test(combined)) return true;
    if (VISUAL_NECESSITY_REGEX.test(combined)) return true;
    if (options && hasDegenerateOrVisualOptions(options)) return true;

    return false;
}

/**
 * Fallback to the single-column band around a question (from anchor to next question in same column).
 */
export function getQuestionColumnBandBox(pdfBuffer, qNum, pageIndex = -1) {
    if (!pdfBuffer || !qNum) return null;
    try {
        const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
        const totalPages = doc.countPages();
        const parsedQNum = parseInt(String(qNum).replace(/\D/g, ''), 10);
        if (!parsedQNum) return null;

        const qNumPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum}(?:[\\.\\:\\s]|$)`, 'i');
        const nextQPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum + 1}(?:[\\.\\:\\s]|$)`, 'i');

        let targetPages = [];
        if (pageIndex >= 0 && pageIndex < totalPages) {
            targetPages.push(pageIndex);
        } else {
            for (let i = 0; i < totalPages; i++) targetPages.push(i);
        }

        for (const pIdx of targetPages) {
            const page = doc.loadPage(pIdx);
            const b = page.getBounds();
            const pw = b[2] - b[0];
            const ph = b[3] - b[1];
            if (pw <= 0 || ph <= 0) continue;

            const st = page.toStructuredText();
            const json = JSON.parse(st.asJSON());
            const blocks = json.blocks || [];

            let anchorLine = null;
            let nextAnchorLine = null;

            for (const blk of blocks) {
                if (blk.type === 'text' && blk.lines) {
                    for (const line of blk.lines) {
                        const t = line.text.trim();
                        if (!anchorLine && qNumPattern.test(t)) {
                            anchorLine = line;
                        } else if (anchorLine && !nextAnchorLine && nextQPattern.test(t)) {
                            nextAnchorLine = line;
                        }
                    }
                }
            }

            if (anchorLine) {
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
                box.page = pIdx + 1;
                box.isFallbackBand = true;
                return box;
            }
        }
        return null;
    } catch (e) {
        logger.warn(`[diagramDetector] getQuestionColumnBandBox error: ${e.message}`);
        return null;
    }
}

/**
 * Deterministically finds the bounding box [ymin, xmin, ymax, xmax] (normalized 0-1)
 * of a diagram associated with a question on a PDF page using MuPDF structured text.
 * 
 * Works for:
 * 1. Diagrams positioned ABOVE the question stem text (between question anchor like "155." and the stem line).
 * 2. Diagrams positioned in a vertical gap BELOW the stem line and ABOVE options or the next question.
 * 
 * @param {Buffer} pdfBuffer - Single or multi-page PDF buffer
 * @param {number|string} qNum - Question number (e.g. 155)
 * @param {string} qText - Extracted question text/stem
 * @param {number} [pageIndex=0] - 0-indexed page number in the buffer
 * @returns {Array<number>|null} [ymin, xmin, ymax, xmax] in 0-1 range, or null if not detected
 */
export function findDeterministicDiagramBox(pdfBuffer, qNum, qText, pageIndex = 0) {
    if (!pdfBuffer || !qNum) return null;

    try {
        const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
        const totalPages = doc.countPages();
        if (totalPages === 0) return null;

        const parsedQNum = parseInt(String(qNum).replace(/\D/g, ''), 10);
        if (!parsedQNum) return null;

        const qNumPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum}(?:[\\.\\:\\s]|$)`, 'i');

        let targetPageIdx = pageIndex >= 0 ? Math.min(pageIndex, totalPages - 1) : -1;
        let page = null;
        let bounds = null;
        let pageWidth = 0;
        let pageHeight = 0;
        let blocks = [];
        let anchorLine = null;

        const inspectPage = (pIdx) => {
            const p = doc.loadPage(pIdx);
            const b = p.getBounds();
            const pw = b[2] - b[0];
            const ph = b[3] - b[1];
            if (pw <= 0 || ph <= 0) return null;
            const st = p.toStructuredText();
            const json = JSON.parse(st.asJSON());
            const blks = json.blocks || [];
            for (const blk of blks) {
                if (blk.type === 'text' && blk.lines) {
                    for (const line of blk.lines) {
                        if (qNumPattern.test(line.text.trim())) {
                            return { page: p, bounds: b, pageWidth: pw, pageHeight: ph, blocks: blks, anchorLine: line, pageIdx: pIdx };
                        }
                    }
                }
            }
            return null;
        };

        if (targetPageIdx >= 0) {
            const match = inspectPage(targetPageIdx);
            if (match) {
                ({ page, bounds, pageWidth, pageHeight, blocks, anchorLine, targetPageIdx } = { ...match, targetPageIdx: match.pageIdx });
            }
        }

        // If not found on target page, scan all other pages
        if (!anchorLine) {
            for (let pIdx = 0; pIdx < totalPages; pIdx++) {
                if (pIdx === targetPageIdx) continue;
                const match = inspectPage(pIdx);
                if (match) {
                    ({ page, bounds, pageWidth, pageHeight, blocks, anchorLine, targetPageIdx } = { ...match, targetPageIdx: match.pageIdx });
                    break;
                }
            }
        }

        if (!anchorLine) {
            logger.debug(`[diagramDetector] Question anchor not found for Q${parsedQNum} in ${totalPages} pages`);
            return null;
        }

        // Determine column bounds (NEET papers typically use 2 columns)
        const isLeftCol = anchorLine.bbox.x < pageWidth * 0.48;
        const colXmin = isLeftCol ? 0.02 * pageWidth : 0.48 * pageWidth;
        const colXmax = isLeftCol ? 0.50 * pageWidth : 0.98 * pageWidth;

        // 2. Extract keywords from question stem to find stem text line
        const stemKeywords = (qText || '')
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 8);

        let stemLine = null;
        for (const b of blocks) {
          if (b.type === 'text' && b.lines) {
            for (const line of b.lines) {
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
        const colLines = [];
        for (const b of blocks) {
          if (b.type === 'text' && b.lines) {
            for (const line of b.lines) {
              const inCol = isLeftCol ? line.bbox.x < pageWidth * 0.50 : line.bbox.x >= pageWidth * 0.45;
              if (inCol && line.bbox.y >= anchorLine.bbox.y) {
                colLines.push(line);
              }
            }
          }
        }
        colLines.sort((a, b) => a.bbox.y - b.bbox.y);

        const nextQPattern = new RegExp(`^\\s*(?:Q\\.?\\s*)?${parsedQNum + 1}(?:[\\.\\:\\s]|$)`, 'i');
        let boundaryLine = null;

        for (let i = 0; i < colLines.length; i++) {
          const line = colLines[i];
          if (nextQPattern.test(line.text.trim())) {
            boundaryLine = line;
            break;
          }
          if (/^[\(\[\{]?(?:1|A)[\)\]\}]?\s+/i.test(line.text.trim()) && line.bbox.y > anchorLine.bbox.y + 15) {
            if (!boundaryLine || line.bbox.y < boundaryLine.bbox.y) {
              boundaryLine = line;
            }
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
        const fallbackBox = getQuestionColumnBandBox(pdfBuffer, parsedQNum, targetPageIdx);
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
