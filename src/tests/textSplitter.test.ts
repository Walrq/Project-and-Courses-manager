import { describe, it, expect } from 'vitest';
import { splitTextContent, cleanExcerptText } from '../core/textSplitter';

describe('textSplitter', () => {
  it('cleans transcript text properly', () => {
    const raw = '[00:15] Hello everyone, welcome to this   tutorial.\n\n\n(00:45) Let us begin.';
    const cleaned = cleanExcerptText(raw);
    expect(cleaned).not.toContain('[00:15]');
    expect(cleaned).not.toContain('(00:45)');
    expect(cleaned).toContain('Hello everyone, welcome to this tutorial.');
  });

  it('Rule 1: splits by markdown headings', () => {
    const text = `
# Introduction
Welcome to the guide. Here is some intro text.

## Setting Up Vite
Run npm create vite to get started.

### Database Schema
We will use Dexie and IndexedDB here.
`;
    const res = splitTextContent(text);
    expect(res.ruleUsed).toBe('markdown_headings');
    expect(res.parts).toHaveLength(3);
    expect(res.parts[0].title).toBe('Introduction');
    expect(res.parts[1].title).toBe('Setting Up Vite');
    expect(res.parts[2].title).toBe('Database Schema');
  });

  it('Rule 2: splits by Step / Part / Lesson / Chapter lines', () => {
    const text = `
Step 1: Install Dependencies
First install React and TypeScript.

Step 2: Setup Database
Configure Dexie schema.

Step 3: Build Context Loop
Create prompt builder and token estimator.
`;
    const res = splitTextContent(text);
    expect(res.ruleUsed).toBe('step_keywords');
    expect(res.parts).toHaveLength(3);
    expect(res.parts[0].title).toContain('Step 1');
    expect(res.parts[1].title).toContain('Step 2');
    expect(res.parts[2].title).toContain('Step 3');
  });

  it('Rule 3: splits by numbered or lettered top-level lists (when >= 3)', () => {
    const text = `
1. Create the repository
Clone git template and install modules.

2. Configure environment
Set up vite.config.ts and tailwindcss.

3. Implement core algorithms
Build schedulers, DAG dependency graph, and search.

4. Deploy app
Push to GitHub Pages via Actions.
`;
    const res = splitTextContent(text);
    expect(res.ruleUsed).toBe('numbered_list');
    expect(res.parts).toHaveLength(4);
    expect(res.parts[0].title).toContain('1. Create the repository');
    expect(res.parts[3].title).toContain('4. Deploy app');
  });

  it('Rule 4: groups transcript lines with timestamps into N-minute buckets', () => {
    const text = `
00:10 Welcome everyone to the crash course.
02:15 We are going to explore the architecture.
08:30 Now let us talk about the database.
12:45 Here we transition to the user interface.
18:20 Finally we write our tests and wrap up.
`;
    const res = splitTextContent(text, { transcriptMinutesPerPart: 10 });
    expect(res.ruleUsed).toBe('transcript_timestamps');
    expect(res.parts.length).toBeGreaterThanOrEqual(2);
    expect(res.parts[0].sourceStart).toBeDefined();
    expect(res.parts[0].sourceEnd).toBeDefined();
  });

  it('Rule 5: splits unstructured text by size at sentence boundaries', () => {
    const text =
      'This is the first sentence. It explains the concept clearly. ' +
      'Here is the second sentence. It goes deeper into the problem space. ' +
      'Now we discuss the implementation details in the third sentence. ' +
      'Finally this fourth sentence closes out the entire overview.';

    const res = splitTextContent(text, { targetPartsCount: 2 });
    expect(res.ruleUsed).toBe('size_sentences');
    expect(res.parts.length).toBeGreaterThanOrEqual(2);
    expect(res.parts[0].excerpt.length).toBeGreaterThan(0);
  });

  it('respects order of preference (headings > steps > lists > timestamps > size)', () => {
    const text = `
# Main Chapter
1. First list item
2. Second list item
3. Third list item

## Secondary Chapter
1. Sub item A
2. Sub item B
3. Sub item C
`;
    // Headings should take precedence over numbered list
    const res = splitTextContent(text);
    expect(res.ruleUsed).toBe('markdown_headings');
    expect(res.parts).toHaveLength(2);
  });

  it('handles empty text and junk without throwing', () => {
    expect(() => splitTextContent('')).not.toThrow();
    expect(() => splitTextContent(null as any)).not.toThrow();
    const res = splitTextContent('   ');
    expect(res.parts).toEqual([]);
  });

  it('processes 100,000-character input in under 1 second', () => {
    const chunk = 'This is a long sentence explaining the step in detail. ';
    // 100,000 characters
    const largeText = chunk.repeat(Math.ceil(100000 / chunk.length)).slice(0, 100000);

    const start = performance.now();
    const res = splitTextContent(largeText, { targetPartsCount: 5 });
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(1000); // Must be under 1 second
    expect(res.parts.length).toBeGreaterThanOrEqual(1);
  });
});
