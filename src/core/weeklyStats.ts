import { parseISO, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import type { Part, TimeLog, Bug, Decision, DevLog } from '../db/schema';

export interface WeeklyStats {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  partsDone: number;
  partsSkipped: number;
  partsMoved: number;
  partsSlipped: number;
  minutesLogged: number;
  minutesEstimated: number;
  accuracyRatio: number;
  bugsOpened: number;
  bugsFixed: number;
  decisionsAdded: number;
  notesCount: number;
}

export function computeWeeklyStats(
  parts: Part[],
  timeLogs: TimeLog[],
  bugs: Bug[],
  decisions: Decision[],
  devLogs: DevLog[],
  targetDate: Date = new Date()
): WeeklyStats {
  const start = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(targetDate, { weekStartsOn: 1 }); // Sunday

  const weekStartStr = start.toISOString().split('T')[0];
  const weekEndStr = end.toISOString().split('T')[0];

  const inWeek = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, { start, end });
    } catch {
      return false;
    }
  };

  let partsDone = 0;
  let partsSkipped = 0;
  let partsMoved = 0;
  let partsSlipped = 0;
  let minutesEstimated = 0;

  for (const p of parts) {
    if (p.isRest) continue;
    if (p.status === 'done' && inWeek(p.completedAt || p.plannedDate)) {
      partsDone++;
      minutesEstimated += p.estMinutes || 0;
    } else if (p.status === 'skipped' && inWeek(p.plannedDate)) {
      partsSkipped++;
    } else if (p.status === 'moved' && inWeek(p.plannedDate)) {
      partsMoved++;
    } else if (p.status === 'planned' && p.plannedDate < weekStartStr) {
      partsSlipped++;
    }
  }

  let minutesLogged = 0;
  for (const l of timeLogs) {
    if (inWeek(l.startedAt)) {
      minutesLogged += l.minutes || 0;
    }
  }

  const accuracyRatio =
    minutesEstimated > 0
      ? Number((minutesLogged / minutesEstimated).toFixed(2))
      : 1.0;

  let bugsOpened = 0;
  let bugsFixed = 0;
  for (const b of bugs) {
    if (inWeek(b.createdAt)) bugsOpened++;
    if (inWeek(b.fixedAt)) bugsFixed++;
  }

  let decisionsAdded = 0;
  for (const d of decisions) {
    if (inWeek(d.createdAt || d.decidedOn)) decisionsAdded++;
  }

  let notesCount = 0;
  for (const dl of devLogs) {
    if (inWeek(dl.date || dl.createdAt)) notesCount++;
  }

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    partsDone,
    partsSkipped,
    partsMoved,
    partsSlipped,
    minutesLogged,
    minutesEstimated,
    accuracyRatio,
    bugsOpened,
    bugsFixed,
    decisionsAdded,
    notesCount,
  };
}
