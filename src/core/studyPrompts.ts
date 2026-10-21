import type { StudyItem, StudyLog, StudyMemory, StudyTopic, StudyUnit } from '../db/schema';

export function studyMemoryBlock(memory?: StudyMemory): string {
  return `STUDY MEMORY (use this context first; correct it gently if needed)\nSummary: ${memory?.summary || 'No saved summary'}\nKey concepts: ${(memory?.concepts || []).join('; ') || 'None saved'}\nUnderstood well: ${(memory?.understood || []).join('; ') || 'None saved'}\nWeak spots: ${(memory?.weak || []).join('; ') || 'None saved'}\nOpen doubts: ${(memory?.doubts || []).join('; ') || 'None saved'}\nLearner level and style: ${memory?.levelAndStyle || 'Not specified'}\n`;
}

export function buildLearnPrompt(item: StudyItem, topic: StudyTopic, unit: StudyUnit | undefined, memory: StudyMemory | undefined, previousDay?: StudyLog): string {
  return `${studyMemoryBlock(memory)}\nHelp me learn this topic: ${topic.title}${topic.pageStart ? ` (pages ${topic.pageStart}-${topic.pageEnd})` : ''}\nCourse/subject: ${item.name}; unit: ${unit?.title || 'Unassigned'}; level: ${item.level || memory?.levelAndStyle || 'adapt to me'}.\nPrevious day coverage: ${previousDay?.understood || 'No reflection recorded'}; still unclear: ${previousDay?.notUnderstood || 'None recorded'}.\nExplain simply, give practical examples, then ask exactly 3 questions to check my understanding. Do not give answers until I try.`;
}

export function buildPracticePrompt(item: StudyItem, topics: StudyTopic[], memory: StudyMemory | undefined, count: number, difficulty: string): string {
  return `${studyMemoryBlock(memory)}\nCreate ${count} ${difficulty} practice questions for ${item.name} on: ${topics.map((topic) => topic.title).join(', ') || 'my current syllabus'}. Mix conceptual and applied questions. Return JSON only: {"questions":[{"question":"...","type":"short_answer|multiple_choice|problem","options":[],"answer":"...","explanation":"..."}]}. Include answer and explanation for my later self-check.`;
}

export function buildDoubtPrompt(item: StudyItem, topic: StudyTopic, unitName: string, memory: StudyMemory | undefined, doubt: string): string {
  return `${studyMemoryBlock(memory)}\nI have a doubt in ${item.name}, unit ${unitName}, topic ${topic.title}:\n${doubt}\nExplain the answer at my level, connect it to the saved context, and include one small example.`;
}

export function buildMemoryUpdatePrompt(item: StudyItem, memory: StudyMemory | undefined, log: StudyLog, topics: StudyTopic[]): string {
  return `${studyMemoryBlock(memory)}\nUpdate my study memory for ${item.name} using today's reflection. Understood: ${log.understood || 'Not specified'}. Still unclear: ${log.notUnderstood || 'Not specified'}. Minutes studied: ${log.minutes}. Topics: ${topics.map((topic) => topic.title).join(', ') || 'None scheduled'}.\nReturn JSON only with exactly this shape: {"summary":"...","concepts":["..."],"understood":["..."],"weak":["..."],"doubts":["..."]}. Preserve useful prior details and remove items clearly resolved.`;
}
