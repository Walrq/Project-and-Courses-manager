import { describe, it, expect } from 'vitest';
import {
  parseImportText,
  autoFixJSONString,
  stripMarkdownFences,
  extractFirstBalancedJSON,
} from '../core/planImport';

describe('Plan import logic', () => {
  it('strips markdown code fences', () => {
    const raw = "Here is the plan:\n```json\n{\"parts\": []}\n```\nHope you like it!";
    expect(stripMarkdownFences(raw)).toBe('{"parts": []}');
  });

  it('extracts balanced JSON despite chatter before and after', () => {
    const raw = "Sure! Here is the output:\n{\n  \"sections\": [\n    {\"title\": \"Intro\", \"depends_on\": []}\n  ]\n}\nLet me know if you need changes!";
    const extracted = extractFirstBalancedJSON(raw);
    expect(extracted).not.toBeNull();
    const parsed = JSON.parse(extracted!);
    expect(parsed.sections[0].title).toBe('Intro');
  });

  it('auto-fixes smart quotes and trailing commas', () => {
    const broken = '{\n  “sections”: [\n    {\n      “title”: “Setup”,\n    },\n  ],\n}';
    const fixed = autoFixJSONString(broken);
    const parsed = JSON.parse(fixed);
    expect(parsed.sections[0].title).toBe('Setup');
  });

  it('parses breakdown JSON accurately', () => {
    const text = `
    Here are the sections:
    \`\`\`json
    {
      "sections": [
        { "title": "Setup", "description": "Init repo", "depends_on": [] },
        { "title": "API", "description": "Endpoints", "depends_on": ["Setup"] }
      ]
    }
    \`\`\`
    `;
    const res = parseImportText(text);
    expect(res.success).toBe(true);
    if (res.success && res.type === 'breakdown') {
      expect(res.data.sections).toHaveLength(2);
      expect(res.data.sections[1].depends_on).toEqual(['Setup']);
    }
  });

  it('parses parts plan JSON with day, goal, steps, and rest days', () => {
    const text = `
    \`\`\`json
    {
      "parts": [
        { "day": 1, "section": "Setup", "title": "Scaffold", "goal": "Build runs", "est_minutes": 60, "steps": ["npm init", "install"] },
        { "day": 2, "rest": true }
      ]
    }
    \`\`\`
    `;
    const res = parseImportText(text);
    expect(res.success).toBe(true);
    if (res.success && res.type === 'plan') {
      expect(res.data.parts).toHaveLength(2);
      expect(res.data.parts[0].title).toBe('Scaffold');
      expect(res.data.parts[1].rest).toBe(true);
    }
  });

  it('returns human-readable errors with line hints on bad input', () => {
    const badText = 'Random text with no JSON anywhere.';
    const res = parseImportText(badText);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });
});
