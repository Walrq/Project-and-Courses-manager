import { parseISO, differenceInCalendarDays, addDays, format } from 'date-fns';
import type { Part, RestRule } from '../db/schema';
import { isRestDay } from './scheduler';

export interface DeadlineMetrics {
  daysLeft: number;
  workingDaysLeft: number;
  partsLeft: number;
  capacityParts: number;
  slack: number; // capacityParts - partsLeft
  status: 'comfortable' | 'tight' | 'overdue';
}

export interface TriageResult {
  rankedParts: Array<Part & { belowTheLine: boolean }>;
  capacityCutoffIndex: number;
}

export interface CompressionResult {
  newPartsPerDay: number;
  droppedPartIds: number[];
  fits: boolean;
}

export function calculateDeadlineMetrics(
  deadlineStr: string,
  remainingParts: Part[],
  restRule: RestRule,
  partsPerDay: number,
  todayStr: string = format(new Date(), 'yyyy-MM-dd')
): DeadlineMetrics {
  const today = parseISO(todayStr);
  const deadline = parseISO(deadlineStr);

  const daysLeft = Math.max(0, differenceInCalendarDays(deadline, today));
  const workParts = remainingParts.filter((p) => !p.isRest && p.status !== 'done');
  const partsLeft = workParts.length;

  // Calculate working days left (skipping rest days)
  let workingDaysLeft = 0;
  for (let i = 0; i <= daysLeft; i++) {
    const d = addDays(today, i);
    if (!isRestDay(d, i + 1, restRule)) {
      workingDaysLeft++;
    }
  }

  const effectivePartsPerDay = Math.max(1, partsPerDay);
  const capacityParts = workingDaysLeft * effectivePartsPerDay;
  const slack = capacityParts - partsLeft;

  let status: 'comfortable' | 'tight' | 'overdue' = 'comfortable';
  if (slack < 0 || daysLeft <= 0 && partsLeft > 0) {
    status = 'overdue';
  } else if (partsLeft > 0 && slack / partsLeft < 0.2) {
    status = 'tight';
  }

  return {
    daysLeft,
    workingDaysLeft,
    partsLeft,
    capacityParts,
    slack,
    status,
  };
}

export function triageParts(
  remainingParts: Part[],
  capacityParts: number
): TriageResult {
  const priorityWeight: Record<string, number> = {
    must: 1,
    should: 2,
    could: 3,
  };

  const workParts = remainingParts.filter((p) => !p.isRest && p.status !== 'done');

  const sorted = [...workParts].sort((a, b) => {
    const pA = priorityWeight[a.priority || 'should'] || 2;
    const pB = priorityWeight[b.priority || 'should'] || 2;
    if (pA !== pB) return pA - pB;
    return a.orderNo - b.orderNo;
  });

  const rankedParts = sorted.map((p, idx) => ({
    ...p,
    belowTheLine: idx >= capacityParts,
  }));

  return {
    rankedParts,
    capacityCutoffIndex: capacityParts,
  };
}

export function compressPlan(
  remainingParts: Part[],
  workingDaysLeft: number,
  currentPartsPerDay: number = 1
): CompressionResult {
  const workParts = remainingParts.filter((p) => !p.isRest && p.status !== 'done');
  const totalParts = workParts.length;

  // 1. Try raising parts per day (up to 3) without dropping parts
  for (let ppd = currentPartsPerDay; ppd <= 3; ppd++) {
    if (workingDaysLeft * ppd >= totalParts) {
      return { newPartsPerDay: ppd, droppedPartIds: [], fits: true };
    }
  }

  // 2. Try dropping 'could' parts
  const nonCouldParts = workParts.filter((p) => (p.priority || 'should') !== 'could');
  const couldIds = workParts.filter((p) => (p.priority || 'should') === 'could').map((p) => p.id!).filter(Boolean);

  for (let ppd = 1; ppd <= 3; ppd++) {
    if (workingDaysLeft * ppd >= nonCouldParts.length) {
      return { newPartsPerDay: ppd, droppedPartIds: couldIds, fits: true };
    }
  }

  // 3. Try dropping 'should' parts as well (keep only 'must')
  const mustParts = workParts.filter((p) => (p.priority || 'should') === 'must');
  const droppedIds = workParts
    .filter((p) => (p.priority || 'should') !== 'must')
    .map((p) => p.id!)
    .filter(Boolean);

  for (let ppd = 1; ppd <= 3; ppd++) {
    if (workingDaysLeft * ppd >= mustParts.length) {
      return { newPartsPerDay: ppd, droppedPartIds: droppedIds, fits: true };
    }
  }

  return {
    newPartsPerDay: 3,
    droppedPartIds: droppedIds,
    fits: workingDaysLeft * 3 >= mustParts.length,
  };
}
