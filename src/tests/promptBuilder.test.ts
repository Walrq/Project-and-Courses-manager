import { describe, it, expect } from 'vitest';
import {
  buildPromptBlocks,
  buildPromptWithTrimming,
  formatPromptString,
  interpolateTemplateVariables,
} from '../core/promptBuilder';

describe('Prompt builder', () => {
  const sampleInput = {
    role: 'You are an elite developer.',
    project: {
      name: 'Progress Den',
      description: 'Daily project planner',
      goal: 'Help users plan with AI',
      constraints: 'Offline first',
      aiRules: 'Always be direct and precise',
    },
    memory: {
      rollingSummary: 'Set up Vite and Dexie.',
      glossary: 'PWA = Progressive Web App',
    },
    decisions: [{ text: 'Use Dexie for IndexedDB', reason: 'Reactive queries' }],
    planPosition: {
      currentPartIndex: 3,
      totalParts: 10,
      sectionTitle: 'Core Engine',
      previousPartSummary: 'Wrote scheduler module',
    },
    related: [{ title: 'Specs', content: 'Follow Section 6 closely' }],
    task: {
      title: 'Build Prompt Builder',
      goal: 'Assemble markdown blocks with trimming',
      steps: [{ text: 'Write blocks function', done: true }, { text: 'Write test suite', done: false }],
    },
    outputFormat: 'Deliver typed TS code.',
    endInstruction: 'State assumptions first.',
  };

  it('builds minimal context level with only essential blocks', () => {
    const blocks = buildPromptBlocks({ ...sampleInput, contextLevel: 'minimal' });
    const enabledIds = blocks.filter((b) => b.enabled).map((b) => b.id);
    expect(enabledIds).toEqual(['ROLE', 'PROJECT', 'TASK', 'OUTPUT_FORMAT', 'END_INSTRUCTION']);
  });

  it('builds standard context level with rules, memory, decisions, and plan position', () => {
    const blocks = buildPromptBlocks({ ...sampleInput, contextLevel: 'standard' });
    const enabledIds = blocks.filter((b) => b.enabled).map((b) => b.id);
    expect(enabledIds).toContain('RULES');
    expect(enabledIds).toContain('MEMORY');
    expect(enabledIds).toContain('DECISIONS');
    expect(enabledIds).toContain('PLAN_POSITION');
    expect(enabledIds).not.toContain('RELATED');
  });

  it('builds full context level with all blocks', () => {
    const blocks = buildPromptBlocks({ ...sampleInput, contextLevel: 'full' });
    const enabledIds = blocks.filter((b) => b.enabled).map((b) => b.id);
    expect(enabledIds).toContain('RELATED');
  });

  it('formats prompt in labeled markdown headings order', () => {
    const blocks = buildPromptBlocks({ ...sampleInput, contextLevel: 'minimal' });
    const promptStr = formatPromptString(blocks);
    expect(promptStr).toContain('# ROLE');
    expect(promptStr).toContain('# PROJECT');
    expect(promptStr).toContain('# TASK');
  });

  it('trims in documented order: RELATED then MEMORY then PLAN_POSITION, never TASK or RULES', () => {
    const largeMemory = 'A'.repeat(4000);
    const largeRelated = 'B'.repeat(4000);

    const input = {
      ...sampleInput,
      contextLevel: 'full' as const,
      memory: { rollingSummary: largeMemory },
      related: [{ title: 'Huge ref', content: largeRelated }],
      tokenLimit: 500, // Very low limit to trigger trimming
    };

    const result = buildPromptWithTrimming(input);
    expect(result.trimmedNotes.length).toBeGreaterThan(0);

    // TASK and RULES and OUTPUT_FORMAT must still be present!
    expect(result.fullPrompt).toContain('# TASK');
    expect(result.fullPrompt).toContain('# RULES');
    expect(result.fullPrompt).toContain('# OUTPUT FORMAT');
  });

  it('interpolates variables and detects unknown variables', () => {
    const template = 'Hello {{project_name}}, doing {{part_title}} with {{unknown_var}}!';
    const { result, unknownVariables } = interpolateTemplateVariables(template, {
      project_name: 'Pilot',
      part_title: 'Phase 1',
    });

    expect(result).toBe('Hello Pilot, doing Phase 1 with {{unknown_var}}!');
    expect(unknownVariables).toEqual(['unknown_var']);
  });
});
