import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy } from 'lucide-react';
import type { StudyItem, StudyMemory, StudySession, StudyTopic } from '../db/schema';
import { studyRepo } from '../db/repos/studyRepo';
import { addDays, formatLocalDate, parseLocalDate } from '../core/scheduler';
import { studyMemoryBlock } from '../core/studyPrompts';
import { useUIStore } from '../store/uiStore';

export const StudyProgressPanel: React.FC<{ item: StudyItem; topics: StudyTopic[]; sessions: StudySession[]; memory?: StudyMemory }> = ({ item, topics, sessions, memory }) => {
  const { showToast } = useUIStore();
  const itemId = item.id!;
  const logs = useLiveQuery(() => studyRepo.getLogs(itemId), [itemId]) || [];
  const [today] = useState(() => formatLocalDate(new Date()));
  const logByDate = new Map(logs.map((log) => [log.date, log]));
  const sessionMinutes = new Map<string, number>();
  const topicMinutes = new Map<number, number>();
  sessions.forEach((session) => {
    const minutes = session.actualMinutes || 0;
    sessionMinutes.set(session.date, (sessionMinutes.get(session.date) || 0) + minutes);
    if (minutes && session.topicIds.length) session.topicIds.forEach((id) => topicMinutes.set(id, (topicMinutes.get(id) || 0) + minutes / session.topicIds.length));
  });
  const minutesOn = (date: string) => logByDate.get(date)?.minutes || sessionMinutes.get(date) || 0;
  const days = Array.from({ length: 84 }, (_, index) => formatLocalDate(addDays(parseLocalDate(today), index - 83)));
  const weekStart = formatLocalDate(addDays(parseLocalDate(today), -6));
  const weekMinutes = days.slice(-7).reduce((sum, date) => sum + minutesOn(date), 0);
  const totalDone = topics.filter((topic) => topic.status === 'done').length;
  const average = topics.length ? Math.round(totalDone / topics.length * 100) : 0;
  const lastWeekLogs = logs.filter((log) => log.date >= weekStart && log.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const weeklyPrompt = `${studyMemoryBlock(memory)}\nHelp me review this study week for ${item.name}. Topic coverage: ${totalDone}/${topics.length} (${average}%). Study time logged this week: ${weekMinutes} minutes.\nDaily reflections:\n${lastWeekLogs.map((log) => `${log.date}: ${log.minutes} min; understood: ${log.understood || '—'}; unclear: ${log.notUnderstood || '—'}; mood: ${log.mood || '—'}`).join('\n') || 'No daily reflections saved.'}\nCurrent weak spots: ${(memory?.weak || []).join('; ') || 'None recorded'}.\nSummarize progress, identify what slipped, and suggest a realistic plan for next week. Keep any suggested schedule as a proposal for me to edit.`;
  const copyReview = async () => { try { await navigator.clipboard.writeText(weeklyPrompt); showToast('Weekly review prompt copied', 'success'); } catch (error) { showToast(`Could not copy prompt: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const shade = (minutes: number) => minutes >= 90 ? 'bg-teal-400' : minutes >= 45 ? 'bg-teal-500/70' : minutes > 0 ? 'bg-teal-500/35' : 'bg-neutral-200 dark:bg-white/[0.07]';

  return <section className="linear-card p-4 sm:p-5 space-y-4">
    <div><h2 className="text-sm font-semibold">Study progress</h2><p className="text-[11px] text-neutral-500 mt-1">{totalDone} of {topics.length} topics complete · {average}% coverage · {weekMinutes} minutes this week</p></div>
    <div className="space-y-1"><div className="text-[10px] text-neutral-500">Last 12 weeks · logged minutes per day</div><div className="grid grid-cols-12 gap-1">{Array.from({ length: 12 }, (_, week) => <div key={week} className="grid grid-rows-7 gap-1">{days.slice(week * 7, (week + 1) * 7).map((date) => <span key={date} title={`${date}: ${minutesOn(date)} minutes`} className={`w-3 h-3 rounded-[3px] ${shade(minutesOn(date))}`} />)}</div>)}</div><div className="flex justify-between text-[9px] text-neutral-400"><span>Less</span><span>More</span></div></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><h3 className="text-[11px] font-semibold mb-1">Time by topic</h3>{topics.map((topic) => <div key={topic.id} className="flex justify-between text-[10px] text-neutral-500 py-0.5"><span className="truncate pr-2">{topic.title}</span><span>{Math.round(topicMinutes.get(topic.id!) || 0)} min</span></div>)}</div><div><h3 className="text-[11px] font-semibold mb-1">Daily study time</h3>{days.slice(-7).map((date) => <div key={date} className="flex justify-between text-[10px] text-neutral-500 py-0.5"><span>{date}</span><span>{minutesOn(date)} min</span></div>)}</div></div>
    <div className="border-t border-neutral-200 dark:border-white/[0.06] pt-3"><button type="button" className="linear-btn-secondary" onClick={() => void copyReview()}><Copy className="w-3.5 h-3.5" /> Copy weekly review prompt</button></div>
  </section>;
};
