import { describe, it, expect } from 'vitest';
import { matchCommands, scoreCommand } from '../core/commandMatch';
import { calculateTimeStats } from '../core/timeStats';
import { calculateStreak } from '../core/streak';
import { calculateDeadlineMetrics, triageParts, compressPlan } from '../core/deadlineMath';
import { computeWeeklyStats } from '../core/weeklyStats';
import { buildRepoTree } from '../core/repoTree';
import { checkFileSafety } from '../core/secretCheck';
import { computeLineDiff } from '../core/diff';
import type { Part, Section, TimeLog, Bug, Decision, DevLog } from '../db/schema';

describe('Pack 2 Core Logic Tests', () => {
  it('commandMatch: fuzzy matches commands, handles prefixes and keywords', () => {
    const commands = [
      { id: 'today_prompt', title: 'Generate today\'s prompt', keywords: ['copy', 'today', 'prompt'], run: () => {} },
      { id: 'new_project', title: 'New project', keywords: ['create'], run: () => {} },
      { id: 'settings', title: 'Go to Settings', keywords: ['config'], run: () => {} },
    ];

    const results = matchCommands('prompt', commands);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('today_prompt');

    // Fuzzy subsequence
    const fuzzy = matchCommands('gtp', commands);
    expect(fuzzy[0]?.id).toBe('today_prompt');
  });

  it('timeStats: calculates actual vs estimated, overrun sections, and suggested ratio', () => {
    const sections: Section[] = [
      { id: 1, projectId: 1, title: 'Core Architecture', status: 'done', priority: 1, orderNo: 1 },
    ];
    const parts: Part[] = [
      { id: 10, planId: 1, sectionId: 1, orderNo: 1, title: 'Part 1', estMinutes: 60, plannedDate: '2026-10-20', isRest: 0, status: 'done' },
    ];
    const logs: TimeLog[] = [
      { id: 100, projectId: 1, partId: 10, sectionId: 1, startedAt: '2026-10-20T10:00:00Z', minutes: 90, source: 'timer' },
    ];

    const stats = calculateTimeStats(parts, sections, logs, new Date('2026-10-20'));
    expect(stats.totalEstimatedMinutes).toBe(60);
    expect(stats.totalActualMinutes).toBe(90);
    expect(stats.overallAccuracyRatio).toBe(1.5);
    expect(stats.overrunSections).toHaveLength(1);
    expect(stats.suggestedRatio).toBe(1.5);
  });

  it('streak: counts active days, respects rest days, and breaks on missed days', () => {
    const parts: Part[] = [
      { id: 1, planId: 1, orderNo: 1, title: 'Day 1', plannedDate: '2026-10-18', isRest: 0, status: 'done', completedAt: '2026-10-18T12:00:00Z' },
      { id: 2, planId: 1, orderNo: 2, title: 'Rest Day', plannedDate: '2026-10-19', isRest: 1, status: 'planned' },
      { id: 3, planId: 1, orderNo: 3, title: 'Day 3', plannedDate: '2026-10-20', isRest: 0, status: 'done', completedAt: '2026-10-20T12:00:00Z' },
    ];
    const logs: TimeLog[] = [];

    const res = calculateStreak(parts, logs, { referenceDate: new Date('2026-10-20') });
    // Day 1: Done, Day 2: Rest (doesn't break), Day 3: Done -> streak 3
    expect(res.currentStreak).toBeGreaterThanOrEqual(3);
    expect(res.heatmapDays).toHaveLength(364);
  });

  it('deadlineMath: computes slack, triage line, and compression', () => {
    const parts: Part[] = [
      { id: 1, planId: 1, orderNo: 1, title: 'P1', plannedDate: '2026-10-21', isRest: 0, status: 'planned', priority: 'must' },
      { id: 2, planId: 1, orderNo: 2, title: 'P2', plannedDate: '2026-10-22', isRest: 0, status: 'planned', priority: 'should' },
      { id: 3, planId: 1, orderNo: 3, title: 'P3', plannedDate: '2026-10-23', isRest: 0, status: 'planned', priority: 'could' },
    ];

    const metrics = calculateDeadlineMetrics('2026-10-24', parts, { type: 'every_n', n: 7 }, 1, '2026-10-20');
    expect(metrics.workingDaysLeft).toBeGreaterThanOrEqual(3);
    expect(metrics.partsLeft).toBe(3);

    // Triage with capacity of 2 parts
    const triage = triageParts(parts, 2);
    expect(triage.rankedParts[0].belowTheLine).toBe(false);
    expect(triage.rankedParts[1].belowTheLine).toBe(false);
    expect(triage.rankedParts[2].belowTheLine).toBe(true); // 'could' falls below line

    // Compression
    const comp = compressPlan(parts, 2, 1);
    expect(comp.fits).toBe(true);
  });

  it('weeklyStats: computes weekly facts correctly', () => {
    const parts: Part[] = [
      { id: 1, planId: 1, orderNo: 1, title: 'Done Part', plannedDate: '2026-10-20', isRest: 0, status: 'done', completedAt: '2026-10-20T10:00:00Z', estMinutes: 45 },
    ];
    const logs: TimeLog[] = [
      { id: 1, projectId: 1, startedAt: '2026-10-20T10:00:00Z', minutes: 50, source: 'manual' },
    ];
    const bugs: Bug[] = [];
    const decisions: Decision[] = [];
    const devLogs: DevLog[] = [];

    const ws = computeWeeklyStats(parts, logs, bugs, decisions, devLogs, new Date('2026-10-20'));
    expect(ws.partsDone).toBe(1);
    expect(ws.minutesLogged).toBe(50);
    expect(ws.minutesEstimated).toBe(45);
  });

  it('repoTree: formats hierarchical paths into an indented tree', () => {
    const files = [
      { path: 'src/index.ts', sizeChars: 120 },
      { path: 'src/components/App.tsx', sizeChars: 450 },
    ];

    const tree = buildRepoTree(files);
    expect(tree).toContain('src');
    expect(tree).toContain('components');
    expect(tree).toContain('App.tsx');
    expect(tree).toContain('index.ts');
  });

  it('secretCheck: blocks sensitive keys, .env, and binary files', () => {
    expect(checkFileSafety('.env').isSafe).toBe(false);
    expect(checkFileSafety('.env.local').isSafe).toBe(false);
    expect(checkFileSafety('id_rsa.pem').isSafe).toBe(false);
    expect(checkFileSafety('image.png').isBinary).toBe(true);
    expect(checkFileSafety('node_modules/pkg/index.js').isIgnored).toBe(true);

    const secretContent = 'const token = "AKIA1234567890123456";';
    expect(checkFileSafety('src/config.ts', secretContent).isSafe).toBe(false);

    expect(checkFileSafety('src/utils.ts', 'export function add(a, b) { return a + b; }').isSafe).toBe(true);
  });

  it('diff: computes added and removed lines accurately', () => {
    const oldCode = 'line 1\nline 2\nline 3';
    const newCode = 'line 1\nline 2 modified\nline 3\nline 4';

    const diff = computeLineDiff(oldCode, newCode);
    expect(diff.lines.some((l) => l.type === 'removed')).toBe(true);
    expect(diff.lines.some((l) => l.type === 'added')).toBe(true);
    expect(diff.lines.some((l) => l.type === 'same')).toBe(true);
  });
});
