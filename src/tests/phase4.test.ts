import { describe, it, expect } from 'vitest';
import { buildSearchIndex, executeSearch } from '../core/search';
import { shouldTriggerReminder } from '../core/notifications';
import { isBackupOverdue } from '../core/autoBackup';
import { MAX_PASTED_TEXT_LENGTH } from '../db/repos/linkRepo';
import type { Project, Section, Part, Decision, Link } from '../db/schema';

describe('Phase 4: Search, Links Capping, Auto-Backup & Notifications', () => {
  it('builds search index and finds entities across projects, parts, decisions, and links', () => {
    const projects: Project[] = [
      {
        id: 1,
        name: 'Offline Vector Database',
        description: 'Embedded fast vector index',
        goal: 'Zero server dependencies',
        status: 'active',
        createdAt: '2026-10-20',
        updatedAt: '2026-10-20',
      },
    ];

    const sections: Section[] = [
      {
        id: 10,
        projectId: 1,
        title: 'HNSW Graph Indexing',
        description: 'Implement hierarchical navigable small world graphs',
        status: 'not_started',
        priority: 1,
        orderNo: 1,
      },
    ];

    const parts: Part[] = [
      {
        id: 100,
        planId: 1,
        sectionId: 10,
        orderNo: 1,
        title: 'Cosine Distance SIMD Kernels',
        goal: 'Compute vector dot products with AVX2 or WebAssembly SIMD',
        plannedDate: '2026-10-21',
        isRest: 0,
        status: 'planned',
      },
    ];

    const decisions: Decision[] = [
      {
        id: 50,
        projectId: 1,
        text: 'Use Float32Array instead of generic number arrays',
        reason: 'Zero GC pressure and typed memory efficiency',
        createdAt: '2026-10-20',
        active: 1,
      },
    ];

    const links: Link[] = [
      {
        id: 99,
        projectId: 1,
        title: 'Wasm SIMD Specification',
        url: 'https://github.com/WebAssembly/simd',
        note: 'Reference 128-bit SIMD intrinsics',
      },
    ];

    const index = buildSearchIndex({ projects, sections, parts, decisions, links });

    // Search by part title keyword
    const partResults = executeSearch(index, 'SIMD');
    expect(partResults.length).toBeGreaterThan(0);
    expect(partResults.some((r) => r.title.includes('SIMD'))).toBe(true);

    // Search by decision keyword
    const decisionResults = executeSearch(index, 'Float32Array');
    expect(decisionResults.length).toBeGreaterThan(0);
    expect(decisionResults[0].type).toBe('decision');

    // Search by section keyword
    const sectionResults = executeSearch(index, 'HNSW');
    expect(sectionResults.length).toBeGreaterThan(0);
    expect(sectionResults[0].type).toBe('section');

    // Empty search query returns empty array
    expect(executeSearch(index, '   ')).toEqual([]);
  });

  it('enforces 20,000 character limit on pasted reference text', () => {
    expect(MAX_PASTED_TEXT_LENGTH).toBe(20000);

    const hugeText = 'a'.repeat(25000);
    const sanitized = hugeText.slice(0, MAX_PASTED_TEXT_LENGTH);
    expect(sanitized.length).toBe(20000);
  });

  it('correctly calculates whether daily reminder should trigger', () => {
    // Current time: 10:15 on 2026-10-20
    const mockDate = new Date(2026, 9, 20, 10, 15);

    // Target reminder is 09:00, not notified yet -> should trigger
    expect(shouldTriggerReminder('09:00', null, mockDate)).toBe(true);

    // Already notified today -> should not trigger
    expect(shouldTriggerReminder('09:00', '2026-10-20', mockDate)).toBe(false);

    // Notified yesterday -> should trigger
    expect(shouldTriggerReminder('09:00', '2026-10-19', mockDate)).toBe(true);

    // Target reminder is 14:00 (after 10:15) -> should not trigger yet
    expect(shouldTriggerReminder('14:00', null, mockDate)).toBe(false);
  });

  it('identifies overdue backup status when last backup exceeds 7 days', () => {
    const today = new Date('2026-10-20T12:00:00Z');

    // Never backed up -> overdue
    expect(isBackupOverdue(null, 7, today)).toBe(true);

    // Backed up 2 days ago -> not overdue
    expect(isBackupOverdue('2026-10-18T12:00:00Z', 7, today)).toBe(false);

    // Backed up 8 days ago -> overdue
    expect(isBackupOverdue('2026-10-12T12:00:00Z', 7, today)).toBe(true);
  });
});
