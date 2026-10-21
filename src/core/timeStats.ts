import type { Part, Section, TimeLog } from '../db/schema';
import { format, subDays, parseISO, getDay } from 'date-fns';

export interface SectionTimeStat {
  sectionId: number;
  sectionTitle: string;
  estimatedMinutes: number;
  actualMinutes: number;
  accuracyRatio: number; // actual / estimated
  isOverrun: boolean;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface TimeStatsSummary {
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  overallAccuracyRatio: number;
  totalHours: number;
  averageSessionMinutes: number;
  last30Days: DayActivity[];
  weekdayStats: { weekday: string; minutes: number }[];
  mostProductiveWeekday: string;
  leastProductiveWeekday: string;
  sectionStats: SectionTimeStat[];
  overrunSections: SectionTimeStat[];
  suggestedRatio: number; // e.g. 1.35
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function calculateTimeStats(
  parts: Part[],
  sections: Section[],
  timeLogs: TimeLog[],
  referenceDate: Date = new Date()
): TimeStatsSummary {
  let totalEstimatedMinutes = 0;
  for (const p of parts) {
    if (!p.isRest && p.estMinutes) {
      totalEstimatedMinutes += p.estMinutes;
    }
  }

  let totalActualMinutes = 0;
  for (const log of timeLogs) {
    totalActualMinutes += log.minutes || 0;
  }

  const averageSessionMinutes =
    timeLogs.length > 0 ? Math.round(totalActualMinutes / timeLogs.length) : 0;

  const overallAccuracyRatio =
    totalEstimatedMinutes > 0
      ? Number((totalActualMinutes / totalEstimatedMinutes).toFixed(2))
      : 1.0;

  // Last 30 days breakdown
  const dayMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(referenceDate, i), 'yyyy-MM-dd');
    dayMap.set(d, 0);
  }

  // Weekday breakdown
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];

  for (const log of timeLogs) {
    try {
      const logDate = log.startedAt.split('T')[0];
      if (dayMap.has(logDate)) {
        dayMap.set(logDate, (dayMap.get(logDate) || 0) + log.minutes);
      }
      const dayIndex = getDay(parseISO(log.startedAt));
      weekdayTotals[dayIndex] += log.minutes;
    } catch {
      // Ignore invalid timestamp
    }
  }

  const last30Days: DayActivity[] = Array.from(dayMap.entries()).map(([date, minutes]) => ({
    date,
    minutes,
  }));

  const weekdayStats = WEEKDAYS.map((weekday, i) => ({
    weekday,
    minutes: weekdayTotals[i],
  }));

  let maxDay = WEEKDAYS[1]; // default Mon
  let minDay = WEEKDAYS[0]; // default Sun
  let maxMin = -1;
  let minMin = Infinity;

  weekdayStats.forEach((w) => {
    if (w.minutes > maxMin) {
      maxMin = w.minutes;
      maxProductiveWeekday = w.weekday;
    }
    if (w.minutes < minMin) {
      minMin = w.minutes;
      leastProductiveWeekday = w.weekday;
    }
  });

  // Section breakdown
  const sectionStats: SectionTimeStat[] = [];
  const overrunSections: SectionTimeStat[] = [];

  for (const s of sections) {
    if (!s.id) continue;
    const sParts = parts.filter((p) => p.sectionId === s.id && !p.isRest);
    const sPartIds = new Set(sParts.map((p) => p.id));

    const estMin = sParts.reduce((acc, p) => acc + (p.estMinutes || 0), 0);
    const actMin = timeLogs
      .filter((l) => (l.sectionId === s.id || (l.partId && sPartIds.has(l.partId))))
      .reduce((acc, l) => acc + (l.minutes || 0), 0);

    const ratio = estMin > 0 ? Number((actMin / estMin).toFixed(2)) : actMin > 0 ? 2.0 : 1.0;
    const isOverrun = actMin > estMin * 1.25 && estMin > 0;

    const stat: SectionTimeStat = {
      sectionId: s.id,
      sectionTitle: s.title,
      estimatedMinutes: estMin,
      actualMinutes: actMin,
      accuracyRatio: ratio,
      isOverrun,
    };

    sectionStats.push(stat);
    if (isOverrun) {
      overrunSections.push(stat);
    }
  }

  // Estimate correction ratio:
  // If actual was substantially higher or lower, compute suggested scaling factor
  let suggestedRatio = overallAccuracyRatio;
  if (suggestedRatio < 0.5) suggestedRatio = 0.5;
  if (suggestedRatio > 3.0) suggestedRatio = 3.0;

  return {
    totalEstimatedMinutes,
    totalActualMinutes,
    overallAccuracyRatio,
    totalHours: Number((totalActualMinutes / 60).toFixed(1)),
    averageSessionMinutes,
    last30Days,
    weekdayStats,
    mostProductiveWeekday: maxProductiveWeekday,
    leastProductiveWeekday: leastProductiveWeekday,
    sectionStats,
    overrunSections,
    suggestedRatio,
  };
}

let maxProductiveWeekday = 'Monday';
let leastProductiveWeekday = 'Sunday';
