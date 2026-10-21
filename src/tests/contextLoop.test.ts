import { describe, it, expect } from 'vitest';
import { scheduleParts } from '../core/scheduler';
import { extractCodeBlocks } from '../core/codeExtractor';
import { buildPromptBlocks, formatPromptString } from '../core/promptBuilder';

describe('Context Loop & Phase 2 Core Tests', () => {
  it('correctly dates a 30-day plan with every-3rd-day rest rule', () => {
    // Generate 30 parts
    const parts = Array.from({ length: 30 }, (_, i) => ({
      orderNo: i + 1,
      title: `Part ${i + 1}`,
      status: 'planned' as const,
    }));

    const result = scheduleParts(parts, '2026-06-01', 1, { type: 'every_n', n: 3 });

    // With 30 work parts and every 3rd day being a rest day:
    // Calendar sequence:
    // Day 1: Part 1
    // Day 2: Part 2
    // Day 3: Rest
    // Day 4: Part 3
    // Day 5: Part 4
    // Day 6: Rest
    // For every 2 parts, we take 3 calendar days.
    // 30 parts = 15 pairs * 3 calendar days = 45 days (last day is Day 44 work Part 30).
    expect(result.parts).toHaveLength(30);

    // Verify day 1 and 2
    expect(result.parts[0].plannedDate).toBe('2026-06-01');
    expect(result.parts[1].plannedDate).toBe('2026-06-02');

    // Day 3 (2026-06-03) is rest, so Part 3 is on 2026-06-04
    expect(result.parts[2].plannedDate).toBe('2026-06-04');
    expect(result.parts[3].plannedDate).toBe('2026-06-05');

    // Verify rest day entries
    const restDates = result.restDays.map((r) => r.date);
    expect(restDates).toContain('2026-06-03');
    expect(restDates).toContain('2026-06-06');
    expect(restDates).toContain('2026-06-09');

    // Verify there are 14 rest days in the span of 30 parts (Day 1 to 44)
    expect(result.restDays.length).toBe(14);
  });

  it('extracts multiple code blocks with language and title from markdown', () => {
    const markdown = `
Here is the implementation:
\`\`\`typescript:schema.ts
export interface User {
  id: number;
}
\`\`\`

And here is the query:
\`\`\`sql
SELECT * FROM users;
\`\`\`
`;

    const blocks = extractCodeBlocks(markdown);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('typescript');
    expect(blocks[0].title).toBe('schema.ts');
    expect(blocks[0].code).toContain('export interface User');
    expect(blocks[1].language).toBe('sql');
    expect(blocks[1].code).toBe('SELECT * FROM users;');
  });

  it('prompt builder visibly incorporates rolling memory and active decisions in tomorrow prompt', () => {
    const promptInput = {
      role: 'You are an elite developer.',
      project: {
        name: 'Progress Den',
        aiRules: 'Be precise',
      },
      memory: {
        rollingSummary: 'Yesterday we completed Dexie schema setup and verified all tables.',
        glossary: 'PWA = Progressive Web App',
      },
      decisions: [
        { text: 'Use Dexie v4 for IndexedDB', reason: 'Reactive queries and safe cascades' },
        { text: 'HashRouter for zero-config static hosting' },
      ],
      planPosition: {
        currentPartIndex: 2,
        totalParts: 30,
        sectionTitle: 'Scheduler',
        previousPartSummary: 'Completed Part 1',
      },
      task: {
        title: 'Tomorrow Part: Build Drag and Drop Reordering',
        goal: 'Allow drag-reordering parts with live date recalcs',
      },
      contextLevel: 'full' as const,
    };

    const blocks = buildPromptBlocks(promptInput);
    const promptString = formatPromptString(blocks);

    // Verify MEMORY heading and text
    expect(promptString).toContain('# MEMORY');
    expect(promptString).toContain('Yesterday we completed Dexie schema setup');

    // Verify DECISIONS heading and bullet points
    expect(promptString).toContain('# DECISIONS');
    expect(promptString).toContain('Do not contradict these decisions:');
    expect(promptString).toContain('- Use Dexie v4 for IndexedDB (Reactive queries and safe cascades)');
    expect(promptString).toContain('- HashRouter for zero-config static hosting');
  });
});
