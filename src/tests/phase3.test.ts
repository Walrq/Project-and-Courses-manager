import { describe, it, expect } from 'vitest';
import { resolveMissedDays } from '../core/missedDays';
import { checkSectionDependencies, isPartScheduledBeforeDependencies } from '../core/dependencies';
import { parseImportText } from '../core/planImport';
import { buildPromptWithTrimming } from '../core/promptBuilder';
import type { Section, SectionDep } from '../db/schema';

describe('Phase 3 Core Tests: AI Plan Mode & Smart Context', () => {
  it('correctly shifts missed parts forward to start from today', () => {
    const allParts = [
      { id: 1, orderNo: 1, title: 'Missed Part 1', status: 'planned' as const, plannedDate: '2026-10-18' },
      { id: 2, orderNo: 2, title: 'Part 2', status: 'planned' as const, plannedDate: '2026-10-19' },
      { id: 3, orderNo: 3, title: 'Part 3', status: 'planned' as const, plannedDate: '2026-10-20' },
    ];
    const missedParts = [allParts[0], allParts[1]];

    const result = resolveMissedDays('shift', missedParts, allParts, '2026-10-20', {
      partsPerDay: 1,
      restRule: { type: 'every_n', n: 100 },
    });

    expect(result.updatedParts.length).toBe(3);
    expect(result.updatedParts[0].plannedDate).toBe('2026-10-20');
    expect(result.updatedParts[1].plannedDate).toBe('2026-10-21');
    expect(result.updatedParts[2].plannedDate).toBe('2026-10-22');
  });

  it('correctly merges missed parts to today', () => {
    const missedParts = [
      { id: 1, orderNo: 1, title: 'Missed Part', status: 'planned' as const, plannedDate: '2026-10-18' },
    ];
    const allParts = [...missedParts];

    const result = resolveMissedDays('merge', missedParts, allParts, '2026-10-20');
    expect(result.updatedParts).toHaveLength(1);
    expect(result.updatedParts[0].plannedDate).toBe('2026-10-20');
  });

  it('correctly marks missed parts as skipped', () => {
    const missedParts = [
      { id: 1, orderNo: 1, title: 'Missed Part', status: 'planned' as const, plannedDate: '2026-10-18' },
    ];
    const allParts = [...missedParts];

    const result = resolveMissedDays('skip', missedParts, allParts, '2026-10-20');
    expect(result.updatedParts).toHaveLength(1);
    expect(result.updatedParts[0].status).toBe('skipped');
  });

  it('identifies blocked sections when dependencies are not done', () => {
    const sections: Section[] = [
      { id: 1, projectId: 1, title: 'Database Setup', status: 'in_progress', priority: 1, orderNo: 1 },
      { id: 2, projectId: 1, title: 'API Endpoints', status: 'not_started', priority: 2, orderNo: 2 },
    ];
    const deps: SectionDep[] = [
      { id: 1, sectionId: 2, dependsOnId: 1 }, // API depends on Database
    ];

    const depStatus = checkSectionDependencies(2, sections, deps);
    expect(depStatus.isBlocked).toBe(true);
    expect(depStatus.blockingDependencies[0].title).toBe('Database Setup');

    // If Database Setup is marked done
    sections[0].status = 'done';
    const updatedStatus = checkSectionDependencies(2, sections, deps);
    expect(updatedStatus.isBlocked).toBe(false);
  });

  it('parses messy LLM response with conversational chatter and markdown code fences', () => {
    const messyLLMResponse = `
Hey there! Here is the day-by-day plan you requested:

\`\`\`json
{
  "parts": [
    {
      "day": 1,
      "section": "Core Architecture",
      "title": "Setup Repository & Linting",
      "goal": "Build runs without errors",
      "est_minutes": 60,
      "steps": ["Initialize repo", "Configure tsconfig", "Run build"],
    },
    {
      "day": 2,
      "rest": true,
    }
  ]
}
\`\`\`

Hope this helps you achieve your project goals! Let me know if you want to revise anything.
`;

    const parsed = parseImportText(messyLLMResponse);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.type === 'plan') {
      expect(parsed.data.parts).toHaveLength(2);
      expect(parsed.data.parts[0].title).toBe('Setup Repository & Linting');
      expect(parsed.data.parts[0].steps).toHaveLength(3);
      expect(parsed.data.parts[1].rest).toBe(true);
    }
  });

  it('trims prompt over token limit in documented order and generates visible trim notes', () => {
    const input = {
      role: 'You are an engineer.',
      project: { name: 'Pilot', aiRules: 'Clean code' },
      memory: { rollingSummary: 'M'.repeat(5000) },
      related: [{ title: 'Notes', content: 'R'.repeat(5000) }],
      task: { title: 'Implement feature', steps: [{ text: 'Step 1' }] },
      outputFormat: 'Code blocks',
      contextLevel: 'full' as const,
      tokenLimit: 400, // Very low limit to trigger trimming
    };

    const result = buildPromptWithTrimming(input);
    expect(result.trimmedNotes.length).toBeGreaterThan(0);
    // RELATED dropped first, then MEMORY truncated
    expect(result.trimmedNotes.some((n) => n.includes('RELATED'))).toBe(true);
    expect(result.trimmedNotes.some((n) => n.includes('MEMORY'))).toBe(true);

    // Protected blocks must never be dropped
    expect(result.fullPrompt).toContain('# TASK');
    expect(result.fullPrompt).toContain('# RULES');
    expect(result.fullPrompt).toContain('# OUTPUT FORMAT');
  });
});
