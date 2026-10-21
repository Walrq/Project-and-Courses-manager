import { describe, it, expect } from 'vitest';
import { parseChapters, timestampToSeconds, formatSecondsToTimestamp } from '../core/chapterParser';

describe('chapterParser', () => {
  it('converts timestamp strings to seconds and back', () => {
    expect(timestampToSeconds('0:00')).toBe(0);
    expect(timestampToSeconds('01:30')).toBe(90);
    expect(timestampToSeconds('1:02:15')).toBe(3735);
    expect(timestampToSeconds('120:30')).toBe(7230); // > 59 minutes

    expect(formatSecondsToTimestamp(0)).toBe('00:00');
    expect(formatSecondsToTimestamp(90)).toBe('01:30');
    expect(formatSecondsToTimestamp(3735)).toBe('1:02:15');
    expect(formatSecondsToTimestamp(7230)).toBe('2:00:30');
  });

  it('parses all timestamp formats from specification', () => {
    const text = `
0:00 Intro
00:00 - Getting Started
1. 05:10 Setup
(3:45) Styling
- 12:30 | Testing
1:02:15 Deploying
Final wrapup 1:20:00
`;
    const res = parseChapters(text);
    expect(res.chapters.length).toBeGreaterThanOrEqual(5);

    // Verify parsed titles and timestamps
    const titles = res.chapters.map((c) => c.title);
    expect(titles).toContain('Intro');
    expect(titles).toContain('Styling');
    expect(titles).toContain('Setup');
    expect(titles).toContain('Testing');
    expect(titles).toContain('Deploying');
  });

  it('calculates sourceStart and sourceEnd correctly with total length', () => {
    const text = `
0:00 Intro
05:00 Architecture
15:00 Implementation
`;
    const res = parseChapters(text, 1800); // 30 mins total
    expect(res.chapters).toHaveLength(3);

    expect(res.chapters[0].sourceStart).toBe(0);
    expect(res.chapters[0].sourceEnd).toBe(300);

    expect(res.chapters[1].sourceStart).toBe(300);
    expect(res.chapters[1].sourceEnd).toBe(900);

    expect(res.chapters[2].sourceStart).toBe(900);
    expect(res.chapters[2].sourceEnd).toBe(1800);
  });

  it('handles hours over 59 minutes', () => {
    const text = `
0:00 Intro
120:30 Long Deep Dive
`;
    const res = parseChapters(text);
    expect(res.chapters).toHaveLength(2);
    expect(res.chapters[1].sourceStart).toBe(7230);
  });

  it('handles Windows line endings (\\r\\n) and emojis in titles', () => {
    const text = "0:00 🚀 Blastoff & Welcome\r\n05:00 🛠️ Project Setup\r\n10:00 💻 Code Implementation 🎉\r\n";
    const res = parseChapters(text);
    expect(res.chapters).toHaveLength(3);
    expect(res.chapters[0].title).toBe('🚀 Blastoff & Welcome');
    expect(res.chapters[1].title).toBe('🛠️ Project Setup');
    expect(res.chapters[2].title).toBe('💻 Code Implementation 🎉');
  });

  it('warns when first chapter does not start at or near 0:00', () => {
    const text = `
05:00 Late Start Chapter
10:00 Second Chapter
`;
    const res = parseChapters(text);
    expect(res.warnings.some((w) => w.includes('First chapter starts at'))).toBe(true);
  });

  it('detects descending timestamps, re-sorts them and produces a warning', () => {
    const text = `
0:00 Intro
15:00 Database Setup
05:00 Architecture
`;
    const res = parseChapters(text);
    expect(res.warnings.some((w) => w.includes('re-sorted'))).toBe(true);
    expect(res.chapters[0].sourceStart).toBe(0);
    expect(res.chapters[1].sourceStart).toBe(300);
    expect(res.chapters[2].sourceStart).toBe(900);
  });

  it('deduplicates identical timestamps with a warning', () => {
    const text = `
0:00 Intro
05:00 Setup
05:00 Duplicate Setup Line
10:00 Testing
`;
    const res = parseChapters(text);
    expect(res.chapters).toHaveLength(3);
    expect(res.warnings.some((w) => w.includes('Duplicate timestamp'))).toBe(true);
  });

  it('is completely safe on junk input and never throws', () => {
    expect(() => parseChapters('')).not.toThrow();
    expect(() => parseChapters(null as any)).not.toThrow();
    expect(() => parseChapters('just some text with no numbers or timestamps at all')).not.toThrow();

    const emptyRes = parseChapters('no timestamps here');
    expect(emptyRes.chapters).toEqual([]);
    expect(emptyRes.warnings.length).toBeGreaterThan(0);
  });
});
