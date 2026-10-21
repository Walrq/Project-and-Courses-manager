import { format, subDays, parseISO, isSameDay } from 'date-fns';
import type { Part, TimeLog } from '../db/schema';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  milestoneHit?: 7 | 30 | 100 | null;
  heatmapDays: HeatmapDay[];
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  level: 0 | 1 | 2 | 3 | 4;
  minutes: number;
  partsCompleted: number;
  isRestDay: boolean;
}

export interface StreakOptions {
  minMinutesPerDay?: number; // default 10
  streakFreezeEnabled?: boolean; // default false
  referenceDate?: Date;
}

/**
 * Calculates current streak, longest streak, and 52-week activity heatmap.
 * Pure function with zero side effects.
 */
export function calculateStreak(
  parts: Part[],
  timeLogs: TimeLog[],
  options: StreakOptions = {}
): StreakResult {
  const minMinutes = options.minMinutesPerDay ?? 10;
  const freezeAllowed = Boolean(options.streakFreezeEnabled);
  const refDate = options.referenceDate ?? new Date();

  // Aggregate day metrics
  const dayMinutes = new Map<string, number>();
  for (const log of timeLogs) {
    if (!log.startedAt) continue;
    const dateStr = log.startedAt.split('T')[0];
    dayMinutes.set(dateStr, (dayMinutes.get(dateStr) || 0) + (log.minutes || 0));
  }

  const dayPartsCompleted = new Map<string, number>();
  for (const p of parts) {
    if (p.status === 'done' && p.completedAt) {
      const dateStr = p.completedAt.split('T')[0];
      dayPartsCompleted.set(dateStr, (dayPartsCompleted.get(dateStr) || 0) + 1);
    }
  }

  // Set of planned rest dates and scheduled work dates
  const restDates = new Set<string>();
  const scheduledWorkDates = new Set<string>();
  for (const p of parts) {
    if (p.isRest) {
      restDates.add(p.plannedDate);
    } else {
      scheduledWorkDates.add(p.plannedDate);
    }
  }

  const isDayActive = (dateStr: string): boolean => {
    const mins = dayMinutes.get(dateStr) || 0;
    const done = dayPartsCompleted.get(dateStr) || 0;
    return done > 0 || mins >= minMinutes;
  };

  // Build 364 days for the 52-week heatmap (starting 52 weeks ago up to refDate)
  const totalDays = 52 * 7;
  const heatmapDays: HeatmapDay[] = [];
  let totalActiveCount = 0;

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = subDays(refDate, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const mins = dayMinutes.get(dateStr) || 0;
    const partsDone = dayPartsCompleted.get(dateStr) || 0;
    const isRest = restDates.has(dateStr);

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (partsDone >= 3 || mins >= 90) level = 4;
    else if (partsDone >= 2 || mins >= 60) level = 3;
    else if (partsDone >= 1 || mins >= 30) level = 2;
    else if (mins > 0 || partsDone > 0) level = 1;

    if (partsDone > 0 || mins >= minMinutes) {
      totalActiveCount++;
    }

    heatmapDays.push({
      date: dateStr,
      level,
      minutes: mins,
      partsCompleted: partsDone,
      isRestDay: isRest,
    });
  }

  // Calculate current streak walking backward from today
  let currentStreak = 0;
  let freezeUsed = false;

  for (let i = 0; i < totalDays; i++) {
    const d = subDays(refDate, i);
    const dateStr = format(d, 'yyyy-MM-dd');

    const active = isDayActive(dateStr);
    const isRest = restDates.has(dateStr);
    const hasScheduledWork = scheduledWorkDates.has(dateStr);

    // If day is active, or is a planned rest day, or no work was scheduled: keep streak
    if (active || isRest || !hasScheduledWork) {
      currentStreak++;
    } else if (freezeAllowed && !freezeUsed && i > 0) {
      // Use streak freeze for single missed day
      freezeUsed = true;
      currentStreak++;
    } else {
      // Missed scheduled workday breaks the streak
      // (Exception: if today itself is not yet active, do not break streak yet if yesterday was active)
      if (i === 0 && !active) {
        continue;
      }
      break;
    }
  }

  // Calculate longest historical streak
  let longestStreak = currentStreak;
  let tempStreak = 0;

  for (const h of heatmapDays) {
    const active = isDayActive(h.date);
    const isRest = restDates.has(h.date);
    const hasScheduledWork = scheduledWorkDates.has(h.date);

    if (active || isRest || !hasScheduledWork) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Check milestones
  let milestoneHit: 7 | 30 | 100 | null = null;
  if (currentStreak === 7) milestoneHit = 7;
  else if (currentStreak === 30) milestoneHit = 30;
  else if (currentStreak === 100) milestoneHit = 100;

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: totalActiveCount,
    milestoneHit,
    heatmapDays,
  };
}
