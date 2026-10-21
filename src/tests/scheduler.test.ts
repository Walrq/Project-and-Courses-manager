import { describe, it, expect } from 'vitest';
import {
  scheduleParts,
  rescheduleParts,
  computeSlack,
  findOverdueParts,
  parseLocalDate,
  formatLocalDate,
} from '../core/scheduler';

describe('Scheduler core logic', () => {
  it('correctly schedules parts with every-3rd-day rest rule', () => {
    const parts = [
      { orderNo: 1, title: 'Part 1', status: 'planned' as const },
      { orderNo: 2, title: 'Part 2', status: 'planned' as const },
      { orderNo: 3, title: 'Part 3', status: 'planned' as const },
      { orderNo: 4, title: 'Part 4', status: 'planned' as const },
    ];

    // Day 1 (2026-03-01): Work -> Part 1
    // Day 2 (2026-03-02): Work -> Part 2
    // Day 3 (2026-03-03): Rest (3 % 3 === 0)
    // Day 4 (2026-03-04): Work -> Part 3
    // Day 5 (2026-03-05): Work -> Part 4
    const result = scheduleParts(parts, '2026-03-01', 1, { type: 'every_n', n: 3 });

    expect(result.parts).toHaveLength(4);
    expect(result.parts[0].plannedDate).toBe('2026-03-01');
    expect(result.parts[1].plannedDate).toBe('2026-03-02');
    expect(result.parts[2].plannedDate).toBe('2026-03-04'); // skipped 2026-03-03
    expect(result.parts[3].plannedDate).toBe('2026-03-05');

    expect(result.restDays).toEqual([{ date: '2026-03-03' }]);
  });

  it('correctly schedules with weekday rest rule (e.g. Sunday rest)', () => {
    // 2026-10-24 is Saturday, 2026-10-25 is Sunday
    const parts = [
      { orderNo: 1, title: 'Part 1', status: 'planned' as const },
      { orderNo: 2, title: 'Part 2', status: 'planned' as const },
    ];

    const result = scheduleParts(parts, '2026-10-24', 1, { type: 'weekdays', days: [0] }); // 0 = Sunday
    expect(result.parts[0].plannedDate).toBe('2026-10-24');
    expect(result.parts[1].plannedDate).toBe('2026-10-26'); // Sunday 25th was rest
    expect(result.restDays[0].date).toBe('2026-10-25');
  });

  it('correctly respects custom rest dates', () => {
    const parts = [
      { orderNo: 1, title: 'Part 1', status: 'planned' as const },
      { orderNo: 2, title: 'Part 2', status: 'planned' as const },
    ];

    const result = scheduleParts(parts, '2026-04-10', 1, {
      type: 'custom',
      dates: ['2026-04-11'],
    });

    expect(result.parts[0].plannedDate).toBe('2026-04-10');
    expect(result.parts[1].plannedDate).toBe('2026-04-12');
    expect(result.restDays[0].date).toBe('2026-04-11');
  });

  it('handles 2 parts per day', () => {
    const parts = [
      { orderNo: 1, title: 'Part 1', status: 'planned' as const },
      { orderNo: 2, title: 'Part 2', status: 'planned' as const },
      { orderNo: 3, title: 'Part 3', status: 'planned' as const },
      { orderNo: 4, title: 'Part 4', status: 'planned' as const },
    ];

    const result = scheduleParts(parts, '2026-05-01', 2, { type: 'every_n', n: 10 });
    expect(result.parts[0].plannedDate).toBe('2026-05-01');
    expect(result.parts[1].plannedDate).toBe('2026-05-01');
    expect(result.parts[2].plannedDate).toBe('2026-05-02');
    expect(result.parts[3].plannedDate).toBe('2026-05-02');
  });

  it('handles month boundaries and leap year', () => {
    // 2028 is a leap year (Feb 29 exists)
    const parts = [
      { orderNo: 1, title: 'P1', status: 'planned' as const },
      { orderNo: 2, title: 'P2', status: 'planned' as const },
      { orderNo: 3, title: 'P3', status: 'planned' as const },
    ];

    const result = scheduleParts(parts, '2028-02-28', 1, { type: 'every_n', n: 100 });
    expect(result.parts[0].plannedDate).toBe('2028-02-28');
    expect(result.parts[1].plannedDate).toBe('2028-02-29'); // Leap day!
    expect(result.parts[2].plannedDate).toBe('2028-03-01'); // Month rollover!
  });

  it('handles reschedule from date without modifying done or skipped parts', () => {
    const parts = [
      { orderNo: 1, title: 'Part 1', status: 'done' as const, plannedDate: '2026-06-01' },
      { orderNo: 2, title: 'Part 2', status: 'skipped' as const, plannedDate: '2026-06-02' },
      { orderNo: 3, title: 'Part 3', status: 'planned' as const, plannedDate: '2026-06-03' },
      { orderNo: 4, title: 'Part 4', status: 'planned' as const, plannedDate: '2026-06-04' },
    ];

    // Reschedule from 2026-06-05
    const result = rescheduleParts(parts, '2026-06-05', 1, { type: 'every_n', n: 10 });

    expect(result.parts[0].plannedDate).toBe('2026-06-01'); // Done untouched
    expect(result.parts[1].plannedDate).toBe('2026-06-02'); // Skipped untouched
    expect(result.parts[2].plannedDate).toBe('2026-06-05'); // Rescheduled
    expect(result.parts[3].plannedDate).toBe('2026-06-06'); // Rescheduled
  });

  it('computes slack and warns when negative', () => {
    const parts = [
      { orderNo: 1, title: 'P1', status: 'planned' as const },
      { orderNo: 2, title: 'P2', status: 'planned' as const },
      { orderNo: 3, title: 'P3', status: 'planned' as const },
      { orderNo: 4, title: 'P4', status: 'planned' as const },
      { orderNo: 5, title: 'P5', status: 'planned' as const },
    ];

    // From 2026-07-01 to 2026-07-03 = 3 days, but we have 5 parts!
    const slackInfo = computeSlack(parts, '2026-07-01', '2026-07-03', 1, { type: 'every_n', n: 100 });
    expect(slackInfo).not.toBeNull();
    expect(slackInfo!.workingDaysLeft).toBe(3);
    expect(slackInfo!.partsLeft).toBe(5);
    expect(slackInfo!.slack).toBe(-2);
    expect(slackInfo!.isNegative).toBe(true);
  });

  it('detects overdue parts', () => {
    const parts = [
      { orderNo: 1, title: 'P1', status: 'planned' as const, plannedDate: '2026-10-18' },
      { orderNo: 2, title: 'P2', status: 'done' as const, plannedDate: '2026-10-18' },
      { orderNo: 3, title: 'P3', status: 'planned' as const, plannedDate: '2026-10-21' },
    ];

    const overdue = findOverdueParts(parts, '2026-10-20');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe('P1');
  });
});
