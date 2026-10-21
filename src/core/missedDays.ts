import { rescheduleParts, formatLocalDate, addDays, type SchedulePartInput } from './scheduler';
import type { RestRule } from '../db/schema';

export type MissedDayAction = 'shift' | 'merge' | 'skip' | 'replan';

export interface MissedDayResolutionResult {
  updatedParts: Array<{
    id?: number;
    plannedDate?: string;
    status?: 'planned' | 'done' | 'skipped' | 'moved';
  }>;
  replanPrompt?: string;
}

/**
 * Resolves missed days using one of the four strategies:
 * - shift: push all remaining parts forward starting from today
 * - merge: move missed parts to today's date
 * - skip: mark all missed parts as 'skipped'
 * - replan: returns the prompt to re-plan with an LLM
 */
export function resolveMissedDays(
  action: MissedDayAction,
  missedParts: SchedulePartInput[],
  allParts: SchedulePartInput[],
  todayStr: string,
  options?: {
    partsPerDay?: number;
    restRule?: RestRule;
    projectName?: string;
    deadline?: string;
    userFeedback?: string;
  }
): MissedDayResolutionResult {
  if (action === 'skip') {
    return {
      updatedParts: missedParts.map((p) => ({
        id: p.id,
        status: 'skipped',
      })),
    };
  }

  if (action === 'merge') {
    return {
      updatedParts: missedParts.map((p) => ({
        id: p.id,
        plannedDate: todayStr,
      })),
    };
  }

  if (action === 'shift') {
    const partsPerDay = options?.partsPerDay || 1;
    const restRule = options?.restRule || { type: 'every_n', n: 7 };

    // Reschedule all planned parts starting from today
    const res = rescheduleParts(allParts, todayStr, partsPerDay, restRule);
    return {
      updatedParts: res.parts.map((p) => ({
        id: p.id,
        plannedDate: p.plannedDate,
      })),
    };
  }

  if (action === 'replan') {
    const remainingParts = allParts.filter(
      (p) => p.status !== 'done' && p.status !== 'skipped' && !p.isRest
    );
    const remainingList = remainingParts
      .map((p, i) => `${i + 1}. ${p.title} (Currently scheduled: ${p.plannedDate})`)
      .join('\n');

    const replanPrompt = `You are re-planning the schedule for project '${options?.projectName || 'Project'}'.
The project was delayed by missed days. We need to reschedule the remaining parts.
Today is ${todayStr}. Target deadline is ${options?.deadline || 'as soon as possible'}.

# USER FEEDBACK / REASON
${options?.userFeedback || 'Adjust the schedule to account for missed days.'}

# REMAINING PARTS TO RESCHEDULE
${remainingList}

Reply ONLY with valid JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "title": "Part Title",
      "goal": "Part Goal",
      "est_minutes": 60,
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`;

    return {
      updatedParts: [],
      replanPrompt,
    };
  }

  return { updatedParts: [] };
}
