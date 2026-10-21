import type { StudyItem, StudySession, StudyTopic, StudyUnit } from '../db/schema';
import { addDays, formatLocalDate, parseLocalDate } from './scheduler';

export interface StudyScheduleResult {
  sessions: Omit<StudySession, 'id'>[];
  warnings: string[];
}

export function buildStudySchedule(
  item: StudyItem,
  units: StudyUnit[],
  topics: StudyTopic[],
  startDate: string,
  restWeekdays: number[] = [0]
): StudyScheduleResult {
  const orderedTopics = topics
    .filter((topic) => topic.status !== 'done')
    .sort((a, b) => {
      const unitOrder = (units.find((unit) => unit.id === a.unitId)?.order ?? 0) - (units.find((unit) => unit.id === b.unitId)?.order ?? 0);
      return unitOrder || a.order - b.order;
    });
  if (orderedTopics.length === 0) throw new Error('Add at least one unfinished topic before scheduling.');

  if (!Number.isFinite(item.hoursPerDay) || (item.hoursPerDay || 0) <= 0) {
    throw new Error('Study hours per day must be greater than zero.');
  }
  const dailyCapacity = Math.max(15, Math.round((item.hoursPerDay || 1) * 60));
  const isExamPlan = item.type === 'subject' && Boolean(item.examDate);
  const deadline = isExamPlan
    ? formatLocalDate(addDays(parseLocalDate(item.examDate!), -1))
    : item.targetFinishDate || undefined;
  const normalizedRestWeekdays = [...new Set(restWeekdays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const warnings: string[] = [];

  if (deadline && deadline < startDate) {
    throw new Error('The plan finish date must be on or after the start date.');
  }

  const calendarDates: string[] = [];
  let cursor = parseLocalDate(startDate);
  const lastDate = deadline ? parseLocalDate(deadline) : undefined;
  let totalMinutes = 0;
  orderedTopics.forEach((topic) => { totalMinutes += Math.max(1, topic.minutes || 30); });
  const estimatedWorkdays = Math.max(1, Math.ceil(totalMinutes / dailyCapacity));
  const estimatedCalendarDays = Math.ceil(estimatedWorkdays * 7 / Math.max(1, 7 - normalizedRestWeekdays.length));
  const maxCalendarDays = deadline
    ? Math.min(3660, Math.max(0, Math.round((lastDate!.getTime() - cursor.getTime()) / 86400000) + 1))
    : Math.min(3660, estimatedCalendarDays + 14);

  for (let day = 0; day < maxCalendarDays; day += 1) {
    if (lastDate && cursor.getTime() > lastDate.getTime()) break;
    calendarDates.push(formatLocalDate(cursor));
    cursor = addDays(cursor, 1);
  }

  const workDates = calendarDates.filter((date) => !normalizedRestWeekdays.includes(parseLocalDate(date).getDay()));
  if (workDates.length === 0) throw new Error('This date range has no study days. Change the deadline or rest days.');

  const bufferDates = isExamPlan && workDates.length >= 3 ? workDates.slice(-2) : [];
  if (isExamPlan && bufferDates.length < 2) {
    warnings.push('There are fewer than three study days before the exam, so the topic plan is scheduled without reserving both a revision day and a mock test day.');
  }
  const contentDates = bufferDates.length ? workDates.slice(0, -2) : workDates;
  const plannedTopicsByDate = new Map<string, StudyTopic[]>();
  let topicIndex = 0;

  for (const date of contentDates) {
    if (topicIndex >= orderedTopics.length) break;
    const dayTopics: StudyTopic[] = [];
    let dayMinutes = 0;
    while (topicIndex < orderedTopics.length) {
      const topic = orderedTopics[topicIndex];
      const minutes = Math.max(1, topic.minutes || 30);
      if (dayTopics.length > 0 && dayMinutes + minutes > dailyCapacity) break;
      dayTopics.push(topic);
      dayMinutes += minutes;
      topicIndex += 1;
      if (dayMinutes >= dailyCapacity) break;
    }
    plannedTopicsByDate.set(date, dayTopics);
  }

  if (topicIndex < orderedTopics.length) {
    if (contentDates.length === 0) {
      warnings.push('No study days are available for learning topics before the exam review buffer.');
    } else {
      const finalLearningDate = contentDates[contentDates.length - 1];
      const overflow = orderedTopics.slice(topicIndex);
      plannedTopicsByDate.set(finalLearningDate, [...(plannedTopicsByDate.get(finalLearningDate) || []), ...overflow]);
      warnings.push('The topic workload exceeds the available daily capacity before the finish date. Some topics are grouped on the last learning day.');
    }
  }

  const sessions: Omit<StudySession, 'id'>[] = [];
  const finalCalendarDate = deadline || [...plannedTopicsByDate.keys()].at(-1) || startDate;
  for (const date of calendarDates) {
    if (date > finalCalendarDate) break;
    const dateTopics = plannedTopicsByDate.get(date) || [];
    if (normalizedRestWeekdays.includes(parseLocalDate(date).getDay())) {
      sessions.push({ itemId: item.id!, date, type: 'rest', topicIds: [], plannedMinutes: 0, done: 0 });
    } else if (bufferDates[0] === date) {
      sessions.push({ itemId: item.id!, date, type: 'revise', topicIds: orderedTopics.map((topic) => topic.id!), plannedMinutes: dailyCapacity, done: 0 });
    } else if (bufferDates[1] === date) {
      sessions.push({ itemId: item.id!, date, type: 'mock_test', topicIds: orderedTopics.map((topic) => topic.id!), plannedMinutes: dailyCapacity, done: 0 });
    } else if (dateTopics.length > 0) {
      const groups = new Map<StudySession['type'], StudyTopic[]>();
      dateTopics.forEach((topic) => {
        const type = topic.status === 'needs_revision' ? 'revise' : topic.sessionType || 'learn';
        const group = groups.get(type) || [];
        group.push(topic);
        groups.set(type, group);
      });
      groups.forEach((group, type) => sessions.push({
        itemId: item.id!,
        date,
        type,
        topicIds: group.flatMap((topic) => topic.id === undefined ? [] : [topic.id]),
        plannedMinutes: group.reduce((sum, topic) => sum + Math.max(1, topic.minutes || 30), 0),
        done: 0,
      }));
    }
  }

  return { sessions, warnings: [...new Set(warnings)] };
}

/** Rebuilds only the unfinished topic plan from a new start date, without changing saved deadlines. */
export function rescheduleRemainingStudy(
  item: StudyItem,
  units: StudyUnit[],
  topics: StudyTopic[],
  startDate: string,
  restWeekdays: number[] = item.restWeekdays || [0]
): StudyScheduleResult {
  const openEndedItem: StudyItem = { ...item, examDate: undefined, targetFinishDate: undefined };
  return buildStudySchedule(openEndedItem, units, topics.filter((topic) => topic.status !== 'done'), startDate, restWeekdays);
}
