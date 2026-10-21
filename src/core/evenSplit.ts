import { formatSecondsToTimestamp } from './chapterParser';

export interface EvenSplitOptions {
  totalSeconds: number;
  partsCount?: number;
  minutesPerPart?: number;
}

export interface SplitSlice {
  orderNo: number;
  title: string;
  sourceStart: number;
  sourceEnd: number;
}

/**
 * Splits a total time duration into equal slices with no gaps and no overlaps.
 * Covers full duration from 0 to totalSeconds.
 */
export function splitEvenly(options: EvenSplitOptions): SplitSlice[] {
  const { totalSeconds } = options;
  if (!totalSeconds || totalSeconds <= 0) {
    return [];
  }

  let count = 1;
  if (options.partsCount && options.partsCount > 0) {
    count = Math.floor(options.partsCount);
  } else if (options.minutesPerPart && options.minutesPerPart > 0) {
    const partSecs = options.minutesPerPart * 60;
    count = Math.max(1, Math.ceil(totalSeconds / partSecs));
  }

  const slices: SplitSlice[] = [];
  const baseSliceDuration = totalSeconds / count;

  for (let i = 0; i < count; i++) {
    const start = Math.round(i * baseSliceDuration);
    // Guarantee that last slice ends exactly at totalSeconds (no rounding drift/gaps)
    const end = i === count - 1 ? totalSeconds : Math.round((i + 1) * baseSliceDuration);

    const startTs = formatSecondsToTimestamp(start);
    const endTs = formatSecondsToTimestamp(end);

    slices.push({
      orderNo: i + 1,
      title: `Part ${i + 1} (${startTs} to ${endTs})`,
      sourceStart: start,
      sourceEnd: end,
    });
  }

  return slices;
}
