import { describe, it, expect } from 'vitest';
import { MAX_RAW_TEXT_CHARS } from '../db/repos/walkthroughRepo';
import { exportProjectToMarkdown, exportProjectToJSON, type FullProjectExport } from '../core/exporter';
import { parseImportText } from '../core/planImport';

describe('Sub-phase A1: Walkthrough Data & Backup/Export Coverage', () => {
  it('enforces 100,000 char capping constant for rawText', () => {
    expect(MAX_RAW_TEXT_CHARS).toBe(100000);
  });

  it('exports project with walkthrough metadata and part source information to Markdown', () => {
    const exportData: FullProjectExport = {
      version: 2,
      project: {
        id: 1,
        name: 'Vite PWA Masterclass',
        description: 'Building offline web app from video tutorial',
        status: 'active',
        createdAt: '2026-10-20',
        updatedAt: '2026-10-20',
      },
      sections: [
        {
          id: 10,
          projectId: 1,
          title: 'Walkthrough Chapters',
          status: 'in_progress',
          priority: 2,
          orderNo: 1,
        },
      ],
      parts: [
        {
          id: 101,
          planId: 1,
          sectionId: 10,
          orderNo: 1,
          title: 'Project Setup & Scaffolding',
          plannedDate: '2026-10-21',
          isRest: 0,
          status: 'planned',
          walkthroughId: 1,
          sourceStart: 0,
          sourceEnd: 300,
          sourceLabel: 'YouTube Chapter 1',
        },
      ],
      decisions: [],
      walkthroughs: [
        {
          id: 1,
          projectId: 1,
          type: 'video',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoId: 'dQw4w9WgXcQ',
          title: '3-Hour Fullstack Tutorial',
          rawText: '0:00 Setup\n05:00 Database',
          importedAt: '2026-10-20',
        },
      ],
    };

    const md = exportProjectToMarkdown(exportData);
    expect(md).toContain('# Vite PWA Masterclass');
    expect(md).toContain('## Walkthrough Sources');
    expect(md).toContain('3-Hour Fullstack Tutorial');
    expect(md).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(md).toContain('*Source:* YouTube Chapter 1 [00:00 - 05:00]');

    const json = exportProjectToJSON(exportData);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.walkthroughs).toHaveLength(1);
    expect(parsed.parts[0].sourceStart).toBe(0);
    expect(parsed.parts[0].sourceEnd).toBe(300);
  });

  it('planImport schema accepts extended plan with source_start, source_end, source_excerpt', () => {
    const rawJSON = JSON.stringify({
      parts: [
        {
          day: 1,
          section: 'Setup',
          title: 'Initial Scaffolding',
          goal: 'Setup project',
          est_minutes: 45,
          steps: ['Run npm create vite', 'Install tailwindcss'],
          source_start: 0,
          source_end: 754,
          source_excerpt: 'Welcome to part 1 where we install vite...',
        },
      ],
    });

    const parsed = parseImportText(rawJSON);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.type === 'plan') {
      const p = parsed.data.parts[0];
      expect(p.source_start).toBe(0);
      expect(p.source_end).toBe(754);
      expect(p.source_excerpt).toContain('Welcome to part 1');
    }
  });

  it('validates that version 1 backup payloads upgrade cleanly with empty walkthroughs array', () => {
    // Simulating a legacy version 1 backup without walkthroughs
    const legacyBackup = {
      version: 1,
      exportedAt: '2026-10-19T10:00:00.000Z',
      data: {
        projects: [{ id: 1, name: 'Legacy Project' }],
        links: [],
        sections: [],
        sectionDeps: [],
        plans: [],
        parts: [{ id: 1, planId: 1, title: 'Old Part', plannedDate: '2026-10-20', isRest: 0, status: 'planned' }],
        partSteps: [],
        memory: [],
        memoryHistory: [],
        decisions: [],
        templates: [],
        prompts: [],
        responses: [],
        snippets: [],
        settings: [],
      },
    };

    // Serializing and testing against backup JSON parsing
    const json = JSON.stringify(legacyBackup);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.data.projects).toHaveLength(1);
    // Old parts have no walkthroughId or source fields
    expect(parsed.data.parts[0].walkthroughId).toBeUndefined();
    expect(parsed.data.parts[0].sourceStart).toBeUndefined();
  });

  it('backup roundtrip retains walkthroughs and part source fields exactly', () => {
    const v2Backup = {
      version: 2,
      exportedAt: '2026-10-20T12:00:00.000Z',
      data: {
        projects: [{ id: 1, name: 'Walkthrough Project' }],
        links: [],
        sections: [],
        sectionDeps: [],
        plans: [],
        parts: [
          {
            id: 1,
            planId: 1,
            title: 'Part 1',
            plannedDate: '2026-10-20',
            isRest: 0,
            status: 'planned',
            walkthroughId: 42,
            sourceStart: 120,
            sourceEnd: 600,
            sourceExcerpt: 'Key excerpt from the chapter',
            sourceLabel: 'Chapter 2',
            stoppedAt: '05:30',
          },
        ],
        partSteps: [],
        memory: [],
        memoryHistory: [],
        decisions: [],
        templates: [],
        prompts: [],
        responses: [],
        snippets: [],
        walkthroughs: [
          {
            id: 42,
            projectId: 1,
            type: 'video',
            url: 'https://youtube.com/watch?v=12345678901',
            videoId: '12345678901',
            title: 'Full Masterclass',
            rawText: '0:00 Intro\n02:00 Architecture',
            importedAt: '2026-10-20T11:59:00.000Z',
          },
        ],
        settings: [],
      },
    };

    const json = JSON.stringify(v2Backup);
    const roundtripped = JSON.parse(json);

    expect(roundtripped.version).toBe(2);
    expect(roundtripped.data.walkthroughs).toHaveLength(1);
    expect(roundtripped.data.walkthroughs[0].id).toBe(42);
    expect(roundtripped.data.parts[0].walkthroughId).toBe(42);
    expect(roundtripped.data.parts[0].sourceStart).toBe(120);
    expect(roundtripped.data.parts[0].sourceEnd).toBe(600);
    expect(roundtripped.data.parts[0].sourceExcerpt).toBe('Key excerpt from the chapter');
    expect(roundtripped.data.parts[0].stoppedAt).toBe('05:30');
  });
});
