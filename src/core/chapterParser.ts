/**
 * Parses YouTube chapter timestamps from video descriptions.
 * Handles formats: 0:00, 00:00, 1:02:15, 120:30, [01:23], (1:23), etc.
 * Safe on junk input, never throws.
 */

export interface ParsedChapter {
  title: string;
  sourceStart: number; // in seconds
  sourceEnd?: number; // in seconds
  orderNo: number;
}

export interface ChapterParserResult {
  chapters: ParsedChapter[];
  warnings: string[];
}

/**
 * Parses a timestamp string like '1:02:15' or '05:30' into total seconds.
 */
export function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 0;

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Formats seconds into mm:ss or hh:mm:ss string.
 */
export function formatSecondsToTimestamp(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Matches timestamp anywhere in a string:
 * - \b(?:\d{1,3}:)?\d{1,3}:\d{2}\b
 * Handles (03:45), [03:45], 0:00, 1:02:15, etc.
 */
const TIMESTAMP_REGEX = /(?:(?:\(|\[)?\b)?(\d{1,4}:\d{2}(?::\d{2})?)\b(?:(?:\)|\])?)/;

export function parseChapters(
  description: string | null | undefined,
  totalLengthSeconds?: number
): ChapterParserResult {
  const warnings: string[] = [];

  if (!description || typeof description !== 'string') {
    return { chapters: [], warnings: ['No description provided'] };
  }

  // Normalize line endings to \n
  const lines = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  interface RawChapter {
    startSeconds: number;
    title: string;
    rawLine: string;
  }

  const rawChapters: RawChapter[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(TIMESTAMP_REGEX);
    if (!match) continue;

    const tsStr = match[1];
    const startSeconds = timestampToSeconds(tsStr);

    // Extract title by removing the timestamp (and any wrapping parens/brackets/hyphens/pipes/numbers)
    // E.g. "1. 05:10 Setup" -> "Setup"
    // E.g. "00:00 - Intro" -> "Intro"
    // E.g. "(3:45) Styling" -> "Styling"
    // E.g. "- 12:30 | Testing" -> "Testing"
    // E.g. "Testing at 12:30" -> "Testing at"
    let title = trimmed.replace(match[0], '');

    // Clean leading punctuation, digits with dot, dashes, pipes, colons
    title = title
      .replace(/^[\s\-_|:>.)(\]]+/, '')
      .replace(/^\d+[\s.)\-]+/, '') // remove leading enumeration like "1." or "1 -"
      .replace(/^[\s\-_|:>.)(\]]+/, '')
      .replace(/[\s\-_|:<.(]+$/, '')
      .trim();

    if (!title) {
      title = `Chapter at ${tsStr}`;
    }

    rawChapters.push({
      startSeconds,
      title,
      rawLine: trimmed,
    });
  }

  if (rawChapters.length === 0) {
    return { chapters: [], warnings: ['No chapters found in text'] };
  }

  // Check for descending order
  let isSorted = true;
  for (let i = 1; i < rawChapters.length; i++) {
    if (rawChapters[i].startSeconds < rawChapters[i - 1].startSeconds) {
      isSorted = false;
      break;
    }
  }

  if (!isSorted) {
    warnings.push('Chapters were out of chronological order and have been re-sorted.');
    rawChapters.sort((a, b) => a.startSeconds - b.startSeconds);
  }

  // Deduplicate timestamps
  const deduplicated: RawChapter[] = [];
  for (const chap of rawChapters) {
    const existing = deduplicated.find((c) => c.startSeconds === chap.startSeconds);
    if (existing) {
      warnings.push(`Duplicate timestamp detected at ${formatSecondsToTimestamp(chap.startSeconds)} (${chap.title}). Skipped duplicate.`);
    } else {
      deduplicated.push(chap);
    }
  }

  if (deduplicated.length === 0) {
    return { chapters: [], warnings };
  }

  // Check if first chapter starts near 0:00 (<= 5 seconds)
  if (deduplicated[0].startSeconds > 5) {
    warnings.push(
      `First chapter starts at ${formatSecondsToTimestamp(deduplicated[0].startSeconds)} instead of 00:00.`
    );
  }

  // Build final chapters with sourceStart and sourceEnd
  const finalChapters: ParsedChapter[] = deduplicated.map((c, idx) => {
    const next = deduplicated[idx + 1];
    let sourceEnd: number | undefined = next ? next.startSeconds : undefined;

    if (!sourceEnd && typeof totalLengthSeconds === 'number' && totalLengthSeconds > c.startSeconds) {
      sourceEnd = totalLengthSeconds;
    }

    return {
      orderNo: idx + 1,
      title: c.title,
      sourceStart: c.startSeconds,
      sourceEnd,
    };
  });

  return { chapters: finalChapters, warnings };
}
