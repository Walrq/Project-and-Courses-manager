import { timestampToSeconds, formatSecondsToTimestamp } from './chapterParser';

export type SplitRule =
  | 'markdown_headings'
  | 'step_keywords'
  | 'numbered_list'
  | 'transcript_timestamps'
  | 'size_sentences';

export interface TextSplitPart {
  orderNo: number;
  title: string;
  excerpt: string;
  sourceStart?: number;
  sourceEnd?: number;
}

export interface TextSplitterResult {
  ruleUsed: SplitRule;
  parts: TextSplitPart[];
}

export interface SplitOptions {
  preferredRule?: SplitRule;
  transcriptMinutesPerPart?: number; // default 10
  targetPartsCount?: number; // default 5
  maxCharsPerPart?: number; // default 2000
}

/**
 * Removes stray timestamps and repeated whitespaces from transcript/web text.
 */
export function cleanExcerptText(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:\[|\()?\b\d{1,3}:\d{2}(?::\d{2})?\b(?:\]|\))?/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Deterministic text splitter following the 5 prioritized rules:
 * 1. Markdown headings (#, ##, ###)
 * 2. Step/Part/Lesson/Chapter N lines
 * 3. Numbered/lettered lists (>= 3 items)
 * 4. Transcript timestamps (grouped into N minutes)
 * 5. Size at sentence boundaries
 */
export function splitTextContent(
  rawText: string | null | undefined,
  options: SplitOptions = {}
): TextSplitterResult {
  if (!rawText || !rawText.trim()) {
    return {
      ruleUsed: 'size_sentences',
      parts: [],
    };
  }

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  const preferred = options.preferredRule;

  // 1. Try Markdown Headings
  if (!preferred || preferred === 'markdown_headings') {
    const headingMatches: { lineIndex: number; title: string; level: number }[] = [];
    const headingRegex = /^(#{1,3})\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(headingRegex);
      if (match) {
        headingMatches.push({
          lineIndex: i,
          title: match[2].trim(),
          level: match[1].length,
        });
      }
    }

    if (headingMatches.length >= 2 || (headingMatches.length === 1 && preferred === 'markdown_headings')) {
      const parts: TextSplitPart[] = [];
      for (let i = 0; i < headingMatches.length; i++) {
        const current = headingMatches[i];
        const next = headingMatches[i + 1];
        const contentLines = lines.slice(current.lineIndex + 1, next ? next.lineIndex : lines.length);
        const excerpt = cleanExcerptText(contentLines.join('\n'));

        parts.push({
          orderNo: i + 1,
          title: current.title,
          excerpt: excerpt.slice(0, 6000),
        });
      }

      if (parts.length > 0) {
        return { ruleUsed: 'markdown_headings', parts };
      }
    }
  }

  // 2. Try Step / Part / Lesson / Chapter lines
  if (!preferred || preferred === 'step_keywords') {
    const stepRegex = /^(?:step|part|lesson|chapter)\s+(\d+|[ivxlcdm]+)[:.\s-]\s*(.*)$/i;
    const stepMatches: { lineIndex: number; title: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const match = trimmed.match(stepRegex);
      if (match) {
        const label = trimmed.slice(0, 80);
        stepMatches.push({
          lineIndex: i,
          title: label,
        });
      }
    }

    if (stepMatches.length >= 2 || (stepMatches.length === 1 && preferred === 'step_keywords')) {
      const parts: TextSplitPart[] = [];
      for (let i = 0; i < stepMatches.length; i++) {
        const current = stepMatches[i];
        const next = stepMatches[i + 1];
        const contentLines = lines.slice(current.lineIndex + 1, next ? next.lineIndex : lines.length);
        const excerpt = cleanExcerptText(contentLines.join('\n'));

        parts.push({
          orderNo: i + 1,
          title: current.title,
          excerpt: excerpt.slice(0, 6000),
        });
      }

      if (parts.length > 0) {
        return { ruleUsed: 'step_keywords', parts };
      }
    }
  }

  // 3. Try Numbered or Lettered Lists (requires at least 3)
  if (!preferred || preferred === 'numbered_list') {
    const listRegex = /^(\d{1,3}[.)]|[a-zA-Z][.)])\s+(.+)$/;
    const listMatches: { lineIndex: number; title: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].trim().match(listRegex);
      if (match) {
        listMatches.push({
          lineIndex: i,
          title: lines[i].trim().slice(0, 80),
        });
      }
    }

    if (listMatches.length >= 3 || (listMatches.length >= 2 && preferred === 'numbered_list')) {
      const parts: TextSplitPart[] = [];
      for (let i = 0; i < listMatches.length; i++) {
        const current = listMatches[i];
        const next = listMatches[i + 1];
        const contentLines = lines.slice(current.lineIndex + 1, next ? next.lineIndex : lines.length);
        const excerpt = cleanExcerptText(contentLines.join('\n'));

        parts.push({
          orderNo: i + 1,
          title: current.title,
          excerpt: excerpt.slice(0, 6000),
        });
      }

      if (parts.length > 0) {
        return { ruleUsed: 'numbered_list', parts };
      }
    }
  }

  // 4. Try Transcript Timestamps (group into parts of N minutes)
  if (!preferred || preferred === 'transcript_timestamps') {
    const tsLineRegex = /(?:(?:\(|\[)?\b)?(\d{1,3}:\d{2}(?::\d{2})?)\b(?:(?:\)|\])?)/;
    const tsLines: { lineIndex: number; seconds: number; text: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(tsLineRegex);
      if (match) {
        const sec = timestampToSeconds(match[1]);
        tsLines.push({
          lineIndex: i,
          seconds: sec,
          text: lines[i].replace(match[0], '').trim(),
        });
      }
    }

    if (tsLines.length >= 3 || preferred === 'transcript_timestamps') {
      const minutesPerPart = options.transcriptMinutesPerPart || 10;
      const intervalSec = minutesPerPart * 60;
      const parts: TextSplitPart[] = [];

      let currentBucket = 0;
      let currentLines: string[] = [];
      let bucketStartSec = tsLines[0]?.seconds ?? 0;
      let bucketEndSec = bucketStartSec + intervalSec;

      for (let i = 0; i < tsLines.length; i++) {
        const item = tsLines[i];
        if (item.seconds >= bucketEndSec && currentLines.length > 0) {
          parts.push({
            orderNo: currentBucket + 1,
            title: `Part ${currentBucket + 1} (${formatSecondsToTimestamp(bucketStartSec)} - ${formatSecondsToTimestamp(bucketEndSec)})`,
            excerpt: cleanExcerptText(currentLines.join(' ')).slice(0, 6000),
            sourceStart: bucketStartSec,
            sourceEnd: bucketEndSec,
          });

          currentBucket++;
          currentLines = [item.text];
          bucketStartSec = item.seconds;
          bucketEndSec = bucketStartSec + intervalSec;
        } else {
          currentLines.push(item.text);
        }
      }

      if (currentLines.length > 0) {
        const lastSec = tsLines[tsLines.length - 1]?.seconds || bucketStartSec;
        parts.push({
          orderNo: currentBucket + 1,
          title: `Part ${currentBucket + 1} (${formatSecondsToTimestamp(bucketStartSec)} - ${formatSecondsToTimestamp(lastSec)})`,
          excerpt: cleanExcerptText(currentLines.join(' ')).slice(0, 6000),
          sourceStart: bucketStartSec,
          sourceEnd: lastSec,
        });
      }

      if (parts.length > 0) {
        return { ruleUsed: 'transcript_timestamps', parts };
      }
    }
  }

  // 5. Default / Fallback: Split by Size at Sentence Boundaries
  const targetCount = options.targetPartsCount || 5;
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  const totalLength = text.length;
  const targetChunkLen = Math.max(100, Math.floor(totalLength / targetCount));

  const parts: TextSplitPart[] = [];
  let currentChunk = '';
  let partIdx = 1;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > targetChunkLen && currentChunk.length > 50 && partIdx < targetCount) {
      const excerpt = cleanExcerptText(currentChunk);
      const firstLine = excerpt.split('\n')[0].trim().slice(0, 60);
      parts.push({
        orderNo: partIdx,
        title: `Part ${partIdx}: ${firstLine || 'Section'}`,
        excerpt: excerpt.slice(0, 6000),
      });
      partIdx++;
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    const excerpt = cleanExcerptText(currentChunk);
    const firstLine = excerpt.split('\n')[0].trim().slice(0, 60);
    parts.push({
      orderNo: partIdx,
      title: `Part ${partIdx}: ${firstLine || 'Section'}`,
      excerpt: excerpt.slice(0, 6000),
    });
  }

  return { ruleUsed: 'size_sentences', parts };
}
