import type { RestRule } from '../db/schema';

export interface SchedulePartInput {
  id?: number;
  orderNo: number;
  title: string;
  isRest?: number;
  status: 'planned' | 'done' | 'skipped' | 'moved';
  plannedDate?: string;
}

export interface ScheduledPartOutput extends SchedulePartInput {
  plannedDate: string;
}

export interface RestDayInfo {
  date: string;
  reason?: string;
}

export interface ScheduleResult {
  parts: ScheduledPartOutput[];
  restDays: RestDayInfo[];
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Noon prevents daylight saving boundary shifts
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12, 0, 0);
}

export function isRestDay(date: Date, calendarDayIndex: number, restRule: RestRule): boolean {
  if (restRule.type === 'every_n') {
    if (restRule.n <= 0) return false;
    return calendarDayIndex % restRule.n === 0;
  }
  if (restRule.type === 'weekdays') {
    return restRule.days.includes(date.getDay());
  }
  if (restRule.type === 'custom') {
    const formatted = formatLocalDate(date);
    return restRule.dates.includes(formatted);
  }
  return false;
}

/**
 * Assigns plannedDate to ordered parts walking days from startDate.
 */
export function scheduleParts<T extends SchedulePartInput>(
  parts: T[],
  startDate: string,
  partsPerDay: number = 1,
  restRule: RestRule = { type: 'every_n', n: 7 }
): { parts: (T & { plannedDate: string })[]; restDays: RestDayInfo[] } {
  const sorted = [...parts].sort((a, b) => a.orderNo - b.orderNo);
  const activeParts = sorted.filter((p) => !p.isRest);

  let currentDate = parseLocalDate(startDate);
  let calendarDayIndex = 1;
  let partIndex = 0;

  const resultParts: (T & { plannedDate: string })[] = [];
  const restDays: RestDayInfo[] = [];

  const maxDays = 5000; // Safeguard
  let dayCount = 0;

  while (partIndex < activeParts.length && dayCount < maxDays) {
    dayCount++;
    const dateStr = formatLocalDate(currentDate);

    if (isRestDay(currentDate, calendarDayIndex, restRule)) {
      restDays.push({ date: dateStr });
    } else {
      // Work day: assign up to partsPerDay parts
      for (let i = 0; i < partsPerDay && partIndex < activeParts.length; i++) {
        const part = activeParts[partIndex];
        resultParts.push({
          ...part,
          plannedDate: dateStr,
        });
        partIndex++;
      }
    }

    currentDate = addDays(currentDate, 1);
    calendarDayIndex++;
  }

  return { parts: resultParts, restDays };
}

/**
 * Reschedule from a given date forward.
 * Leaves done and skipped parts untouched.
 */
export function rescheduleParts<T extends SchedulePartInput>(
  allParts: T[],
  fromDate: string,
  partsPerDay: number = 1,
  restRule: RestRule = { type: 'every_n', n: 7 }
): { parts: (T & { plannedDate: string })[]; restDays: RestDayInfo[] } {
  const preservedParts: (T & { plannedDate: string })[] = [];
  const partsToReschedule: T[] = [];

  for (const part of allParts) {
    if (part.isRest) continue;

    // Preserved parts: already done or skipped
    if (part.status === 'done' || part.status === 'skipped') {
      preservedParts.push({
        ...part,
        plannedDate: part.plannedDate || fromDate,
      });
      continue;
    }

    // Planned or moved parts get rescheduled forward
    partsToReschedule.push(part);
  }

  const rescheduled = scheduleParts(partsToReschedule, fromDate, partsPerDay, restRule);

  return {
    parts: [...preservedParts, ...rescheduled.parts].sort((a, b) => a.orderNo - b.orderNo),
    restDays: rescheduled.restDays,
  };
}

/**
 * Calculate working days left and schedule slack against deadline
 */
export function computeSlack(
  parts: SchedulePartInput[],
  currentDateStr: string,
  deadlineStr: string | null | undefined,
  partsPerDay: number = 1,
  restRule: RestRule = { type: 'every_n', n: 7 }
): { workingDaysLeft: number; partsLeft: number; slack: number; isNegative: boolean } | null {
  if (!deadlineStr) return null;

  const current = parseLocalDate(currentDateStr);
  const deadline = parseLocalDate(deadlineStr);

  if (deadline.getTime() < current.getTime()) {
    const partsLeft = parts.filter(
      (p) => !p.isRest && p.status !== 'done' && p.status !== 'skipped'
    ).length;
    return {
      workingDaysLeft: 0,
      partsLeft,
      slack: -partsLeft,
      isNegative: true,
    };
  }

  let workingDaysLeft = 0;
  let checkDate = current;
  let dayIndex = 1;

  while (checkDate.getTime() <= deadline.getTime()) {
    if (!isRestDay(checkDate, dayIndex, restRule)) {
      workingDaysLeft++;
    }
    checkDate = addDays(checkDate, 1);
    dayIndex++;
  }

  const partsLeft = parts.filter(
    (p) => !p.isRest && p.status !== 'done' && p.status !== 'skipped'
  ).length;

  const requiredWorkDays = Math.ceil(partsLeft / Math.max(1, partsPerDay));
  const slack = workingDaysLeft - requiredWorkDays;

  return {
    workingDaysLeft,
    partsLeft,
    slack,
    isNegative: slack < 0,
  };
}

/**
 * Detect overdue parts for missed-day dialog handling
 */
export function findOverdueParts(parts: SchedulePartInput[], todayStr: string): SchedulePartInput[] {
  const today = parseLocalDate(todayStr).getTime();
  return parts.filter((part) => {
    if (part.isRest || part.status !== 'planned' || !part.plannedDate) return false;
    return parseLocalDate(part.plannedDate).getTime() < today;
  });
}
