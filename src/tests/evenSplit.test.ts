import { describe, it, expect } from 'vitest';
import { splitEvenly } from '../core/evenSplit';

describe('evenSplit', () => {
  it('slices cover the full length with no gaps or overlaps', () => {
    const totalSeconds = 3600; // 1 hour
    const partsCount = 4;
    const slices = splitEvenly({ totalSeconds, partsCount });

    expect(slices).toHaveLength(4);

    // First slice starts at 0
    expect(slices[0].sourceStart).toBe(0);

    // Each slice is contiguous (no gaps, no overlaps)
    for (let i = 0; i < slices.length - 1; i++) {
      expect(slices[i].sourceEnd).toBe(slices[i + 1].sourceStart);
    }

    // Last slice ends exactly at totalSeconds
    expect(slices[slices.length - 1].sourceEnd).toBe(totalSeconds);

    // Check titles
    expect(slices[0].title).toBe('Part 1 (00:00 to 15:00)');
    expect(slices[3].title).toBe('Part 4 (45:00 to 1:00:00)');
  });

  it('splits correctly using minutesPerPart', () => {
    const totalSeconds = 1500; // 25 minutes
    const minutesPerPart = 10;
    const slices = splitEvenly({ totalSeconds, minutesPerPart });

    // 25 / 10 = 2.5 -> 3 parts
    expect(slices).toHaveLength(3);
    expect(slices[0].sourceStart).toBe(0);
    expect(slices[slices.length - 1].sourceEnd).toBe(1500);

    for (let i = 0; i < slices.length - 1; i++) {
      expect(slices[i].sourceEnd).toBe(slices[i + 1].sourceStart);
    }
  });

  it('handles edge case of 1 part or odd lengths without gaps', () => {
    const totalSeconds = 127; // odd prime seconds
    const partsCount = 3;
    const slices = splitEvenly({ totalSeconds, partsCount });

    expect(slices).toHaveLength(3);
    expect(slices[0].sourceStart).toBe(0);
    expect(slices[2].sourceEnd).toBe(127);

    for (let i = 0; i < slices.length - 1; i++) {
      expect(slices[i].sourceEnd).toBe(slices[i + 1].sourceStart);
    }
  });

  it('handles zero or negative duration safely without throwing', () => {
    expect(splitEvenly({ totalSeconds: 0 })).toEqual([]);
    expect(splitEvenly({ totalSeconds: -100 })).toEqual([]);
  });
});
