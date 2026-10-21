import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Copy, ExternalLink, Flame, MessageCircleQuestion, RefreshCw, RotateCw } from 'lucide-react';
import { studyRepo } from '../db/repos/studyRepo';
import { useUIStore } from '../store/uiStore';
import type { StudyLog, StudyTopic } from '../db/schema';
import { formatLocalDate, parseLocalDate, addDays } from '../core/scheduler';
import { buildLearnPrompt, buildMemoryUpdatePrompt, buildPracticePrompt, studyMemoryBlock } from '../core/studyPrompts';
import { parseStudyMemoryImport } from '../core/studyMemoryImport';
import { StudyDoubtDialog } from '../components/StudyDoubtDialog';
import { rescheduleRemainingStudy } from '../core/studyScheduler';

const area = 'w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#14161f] text-neutral-900 dark:text-[#f7f8f8] focus:outline-none focus:border-teal-500';
export const StudyTodayPage: React.FC = () => {
  const { showToast } = useUIStore();
  const [date] = useState(() => formatLocalDate(new Date()));
  const items = useLiveQuery(() => studyRepo.getItems(), []) || [];
  const [chosenId, setChosenId] = useState<number | null>(null);
  const activeItems = items.filter((entry) => !entry.archived && entry.id !== undefined);
  const item = activeItems.find((entry) => entry.id === chosenId) || activeItems[0];
  const itemId = item?.id;
  const topics = useLiveQuery(() => itemId ? studyRepo.getTopics(itemId) : [], [itemId]) || [];
  const units = useLiveQuery(() => itemId ? studyRepo.getUnits(itemId) : [], [itemId]) || [];
  const sessions = useLiveQuery(() => itemId ? studyRepo.getSessions(itemId) : [], [itemId]) || [];
  const memory = useLiveQuery(() => itemId ? studyRepo.getMemory(itemId) : undefined, [itemId]);
  const logs = useLiveQuery(() => itemId ? studyRepo.getLogs(itemId) : [], [itemId]) || [];
  const cards = useLiveQuery(() => itemId ? studyRepo.getCards(itemId) : [], [itemId]) || [];
  const existingLog = logs.find((log) => log.date === date);
  const yesterdayDate = formatLocalDate(addDays(parseLocalDate(date), -1));
  const yesterday = logs.find((log) => log.date === yesterdayDate);
  const todaySessions = sessions.filter((session) => session.date === date);
  const missedSessions = sessions.filter((session) => session.date < date && session.done !== 1 && session.type !== 'rest' && session.spacedReview !== 1);
  const dueReviews = sessions.filter((session) => session.spacedReview === 1 && session.done !== 1 && session.date <= date);
  const dueCards = cards.filter((card) => card.dueDate <= date);
  const todayTopics = topics.filter((topic) => todaySessions.some((session) => session.topicIds.includes(topic.id!)));
  const fallbackTopics = topics.filter((topic) => topic.status !== 'done').slice(0, 3);
  const activeTopics = todayTopics.length ? todayTopics : fallbackTopics;
  const [reflection, setReflection] = useState<Partial<StudyLog> | null>(null);
  const [questionCount, setQuestionCount] = useState('5');
  const [difficulty, setDifficulty] = useState('mixed difficulty');
  const [memoryJson, setMemoryJson] = useState('');
  const [memoryErrors, setMemoryErrors] = useState<string[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<StudyTopic | null>(null);
  const [revealedCardIds, setRevealedCardIds] = useState<number[]>([]);
  const [historyKind, setHistoryKind] = useState<'learn' | 'practice' | 'other'>('other');
  const [historyTitle, setHistoryTitle] = useState('');
  const [historyPrompt, setHistoryPrompt] = useState('');
  const [historyResponse, setHistoryResponse] = useState('');
  const current = { understood: reflection?.understood ?? existingLog?.understood ?? '', notUnderstood: reflection?.notUnderstood ?? existingLog?.notUnderstood ?? '', minutes: reflection?.minutes ?? existingLog?.minutes ?? 0, mood: reflection?.mood ?? existingLog?.mood ?? '' };
  const streak = (() => { const doneDays = new Set([...sessions.filter((session) => session.done === 1).map((session) => session.date), ...logs.filter((log) => log.minutes > 0).map((log) => log.date)]); const restDays = new Set(sessions.filter((session) => session.type === 'rest').map((session) => session.date)); let cursor = doneDays.has(date) || restDays.has(date) ? date : yesterdayDate; let count = 0; let guard = 0; while (guard++ < 3660) { if (restDays.has(cursor)) { cursor = formatLocalDate(addDays(parseLocalDate(cursor), -1)); continue; } if (!doneDays.has(cursor)) break; count++; cursor = formatLocalDate(addDays(parseLocalDate(cursor), -1)); } return count; })();
  const copy = async (text: string, message: string) => { try { await navigator.clipboard.writeText(text); setHistoryPrompt(text); setHistoryTitle(message.replace(/ copied$/i, ' result')); setHistoryKind(/learn/i.test(message) ? 'learn' : /practice/i.test(message) ? 'practice' : 'other'); showToast(message, 'success'); } catch (error) { showToast(`Could not copy: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const saveLog = async () => { if (!itemId) return; await studyRepo.saveDailyLog({ itemId, date, understood: current.understood, notUnderstood: current.notUnderstood, minutes: Number(current.minutes) || 0, mood: current.mood || undefined }); showToast('Today reflection saved', 'success'); };
  const saveResultToHistory = async () => { if (!itemId || !historyResponse.trim()) return; try { await studyRepo.saveStudyResponse({ itemId, kind: historyKind, title: historyTitle.trim() || `${historyKind} result · ${date}`, prompt: historyPrompt.trim() || undefined, response: historyResponse.trim() }); setHistoryTitle(''); setHistoryPrompt(''); setHistoryResponse(''); showToast('Prompt result saved to history', 'success'); } catch (error) { showToast(`Could not save result: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const rateTopic = async (sessionId: number, rating: 'forgot' | 'hard' | 'good' | 'easy') => { try { await studyRepo.rateTopicRevision(sessionId, rating); showToast(`Revision rated ${rating}`, 'success'); } catch (error) { showToast(`Could not save rating: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const rateCard = async (cardId: number, rating: 'forgot' | 'hard' | 'good' | 'easy') => { try { await studyRepo.rateFlashcard(cardId, rating); setRevealedCardIds((ids) => ids.filter((id) => id !== cardId)); showToast(`Card rated ${rating}`, 'success'); } catch (error) { showToast(`Could not save rating: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const rescheduleMissed = async () => {
    if (!item || !itemId) return;
    if (!window.confirm(`Reschedule remaining topics for ${item.name} starting today? Completed sessions and spaced revisions will be preserved.`)) return;
    try {
      const result = rescheduleRemainingStudy(item, units, topics, date, item.restWeekdays || [0]);
      await studyRepo.replaceUnfinishedSessions(itemId, result.sessions);
      await studyRepo.updateItem(itemId, { planStartDate: date });
      showToast(`Rescheduled remaining topics into ${result.sessions.filter((session) => session.type !== 'rest').length} sessions${result.warnings.length ? ` · ${result.warnings.join(' ')}` : ''}`, result.warnings.length ? 'info' : 'success');
    } catch (error) { showToast(`Could not reschedule study plan: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  };
  const copyCatchUpPrompt = async () => {
    if (!item) return;
    const openTopics = topics.filter((topic) => topic.status !== 'done');
    const prompt = `${studyMemoryBlock(memory)}\nHelp me make a catch-up plan for ${item.name}. Missed sessions: ${missedSessions.map((session) => `${session.date}: ${session.topicIds.map((id) => topics.find((topic) => topic.id === id)?.title).filter(Boolean).join(', ')}`).join('; ') || 'None'}\nRemaining topics: ${openTopics.map((topic) => `${topic.title} (${topic.minutes} min)`).join('; ') || 'None'}. Available time is ${item.hoursPerDay || 1} hours per day; rest days are ${JSON.stringify(item.restWeekdays || [0])}. Suggest a realistic schedule I can review and edit. Return JSON only with the established units/topics shape.`;
    await copy(prompt, 'Catch-up prompt copied');
  };
  const importMemory = async () => {
    if (!itemId) return;
    const parsed = parseStudyMemoryImport(memoryJson);
    if (!parsed.success) {
      if (memoryJson.trim()) await studyRepo.saveStudyResponse({ itemId, kind: 'memory', title: `Unparsed memory reply · ${date}`, response: memoryJson.trim() });
      setMemoryErrors(parsed.errors); return;
    }
    try {
      await studyRepo.saveStudyResponse({ itemId, kind: 'memory', title: `Memory update · ${date}`, prompt: existingLog && item ? buildMemoryUpdatePrompt(item, memory, { ...existingLog, ...current }, activeTopics) : undefined, response: memoryJson.trim() });
      await studyRepo.saveMemory(itemId, { ...parsed.data, levelAndStyle: memory?.levelAndStyle || item?.level || '' });
      setMemoryErrors([]); setMemoryJson(''); showToast('Study memory updated and response saved', 'success');
    } catch (error) { showToast(`Could not save memory update: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  };

  return <div className="space-y-5 animate-in fade-in duration-200">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-teal-500">Study Module</div><h1 className="text-2xl font-semibold mt-1">Study Today</h1><p className="text-xs text-neutral-500 mt-1">Your daily study actions are checked off by you.</p></div><div className="flex items-center gap-2 text-xs text-orange-400"><Flame className="w-4 h-4" />{streak} day streak</div></div>
    {activeItems.length === 0 ? <section className="linear-card p-8 text-center"><p className="text-sm">Create a course or subject to plan today's study.</p><Link className="text-teal-400 text-xs mt-2 inline-block" to="/study">Open Study Module</Link></section> : <>
      <section className="linear-card p-4 flex flex-wrap items-center gap-3"><label className="text-xs font-medium">Course / subject</label><select className={`${area} max-w-sm`} value={item?.id} onChange={(event) => setChosenId(Number(event.target.value))}>{activeItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><span className="ml-auto text-xs text-neutral-500">{date}</span><Link to={`/study/${item?.id}`} className="text-xs text-teal-400 inline-flex gap-1 items-center">Edit outline <ExternalLink className="w-3 h-3" /></Link></section>
      {missedSessions.length > 0 && <section className="linear-card p-3 border-amber-500/20 bg-amber-500/[0.03] flex flex-wrap items-center gap-2"><span className="text-xs flex-1">{missedSessions.length} unfinished session{missedSessions.length === 1 ? '' : 's'} are behind schedule.</span><button type="button" className="linear-btn-secondary" onClick={() => void rescheduleMissed()}>Reschedule remaining topics</button><button type="button" className="linear-btn-secondary" onClick={() => void copyCatchUpPrompt()}>Copy catch-up prompt</button></section>}
      <section className="linear-card p-4 space-y-3"><div className="flex justify-between items-center"><h2 className="font-semibold text-sm">Today's topics</h2><span className="text-xs text-neutral-500">Target: {item?.hoursPerDay || 1} hour{item?.hoursPerDay === 1 ? '' : 's'}</span></div>
        {todaySessions.length ? todaySessions.map((session) => { const sessionTopics = topics.filter((topic) => session.topicIds.includes(topic.id!)); return <div key={session.id} className="p-3 rounded-lg border border-neutral-200 dark:border-white/[0.08] flex items-start gap-3"><button type="button" disabled={session.spacedReview === 1} title={session.spacedReview === 1 ? 'Rate this in Due revisions' : session.done ? 'Mark not done' : 'Mark done'} onClick={() => session.id && void studyRepo.setSessionDone(session.id, session.done !== 1)} className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center disabled:opacity-50 ${session.done ? 'bg-teal-500 border-teal-500 text-white' : 'border-neutral-400'}`}>{session.done === 1 && <Check className="w-3 h-3" />}</button><div className="flex-1"><div className="text-xs font-medium capitalize">{session.type.replace('_', ' ')} · {session.plannedMinutes} min{session.spacedReview ? ' · Rate below' : ''}</div><div className="text-xs text-neutral-500 mt-1">{sessionTopics.map((topic) => topic.title).join(', ') || (session.type === 'rest' ? 'Rest day' : 'No topics assigned')}</div></div>{session.type !== 'rest' && <label className="text-[10px] text-neutral-500">Actual min<input aria-label="Actual minutes studied" className={`${area} !w-20 mt-1`} type="number" min="0" value={session.actualMinutes ?? ''} onChange={(event) => session.id && void studyRepo.setSessionMinutes(session.id, Number(event.target.value) || 0)} /></label>}</div>; }) : <p className="text-xs text-neutral-500">No sessions scheduled today. Choose a topic below to study, or set up a schedule from the item page.</p>}
        {!todaySessions.length && <Link to={`/study/${item?.id}`} className="text-xs text-teal-400">Set up this study schedule →</Link>}
        {activeTopics.length > 0 && <div className="space-y-2 pt-2">{activeTopics.map((topic) => { const unit = units.find((entry) => entry.id === topic.unitId); return <div key={topic.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium">{topic.title}</span><span className="text-neutral-500">{unit?.title}</span><div className="ml-auto flex gap-2"><button className="linear-btn-secondary !px-2 !py-1" onClick={() => item && void copy(buildLearnPrompt(item, topic, unit, memory, yesterday), 'Learn prompt copied')}>Learn</button><button className="linear-btn-secondary !px-2 !py-1" onClick={() => setSelectedDoubt(topic)}><MessageCircleQuestion className="w-3 h-3" /> Doubt</button></div></div>; })}</div>}
        <div className="border-t border-neutral-200 dark:border-white/[0.08] pt-3 flex flex-wrap items-center gap-2"><label className="text-xs">Practice questions</label><input className={`${area} !w-16`} type="number" min="1" max="30" value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} /><select className={`${area} !w-auto`} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>mixed difficulty</option><option>easy</option><option>medium</option><option>hard</option></select><button className="linear-btn-secondary !px-2 !py-1" onClick={() => item && void copy(buildPracticePrompt(item, activeTopics, memory, Math.min(30, Math.max(1, Number(questionCount) || 5)), difficulty), 'Practice prompt copied')}><Copy className="w-3 h-3" /> Copy practice prompt</button></div>
      </section>
      <section className="linear-card p-4 space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold text-sm flex items-center gap-2"><RotateCw className="w-4 h-4 text-teal-400" /> Due revisions</h2><span className="text-xs text-neutral-500">{dueReviews.length + dueCards.length} due</span></div>
        {!dueReviews.length && !dueCards.length && <p className="text-xs text-neutral-500">No revisions due. Finishing a topic or rating an imported flashcard adds future review dates.</p>}
        {dueReviews.map((session) => { const topic = topics.find((entry) => entry.id === session.topicIds[0]); return <div key={session.id} className="flex flex-wrap items-center gap-2 border-t border-neutral-200 dark:border-white/[0.06] pt-2"><div className="text-xs flex-1"><span className="font-medium">{topic?.title || 'Topic revision'}</span><span className="text-neutral-500"> · due {session.date}</span></div>{(['forgot', 'hard', 'good', 'easy'] as const).map((rating) => <button key={rating} type="button" onClick={() => session.id && void rateTopic(session.id, rating)} className={`linear-btn-secondary !px-2 !py-1 capitalize ${rating === 'forgot' ? '!text-rose-400' : ''}`}>{rating}</button>)}</div>; })}
        {dueCards.map((card) => { const revealed = card.id !== undefined && revealedCardIds.includes(card.id); const topic = topics.find((entry) => entry.id === card.topicId); return <div key={card.id} className="border-t border-neutral-200 dark:border-white/[0.06] pt-2 space-y-2"><div className="text-[10px] text-neutral-500">Flashcard{topic ? ` · ${topic.title}` : ''}</div><div className="text-xs font-medium whitespace-pre-wrap">{card.front}</div>{revealed ? <><div className="text-xs text-teal-300 whitespace-pre-wrap">{card.back}</div><div className="flex flex-wrap gap-2">{(['forgot', 'hard', 'good', 'easy'] as const).map((rating) => <button key={rating} type="button" onClick={() => card.id && void rateCard(card.id, rating)} className="linear-btn-secondary !px-2 !py-1 capitalize">{rating}</button>)}</div></> : <button type="button" className="linear-btn-secondary !px-2 !py-1" onClick={() => card.id && setRevealedCardIds((ids) => [...ids, card.id!])}>Reveal answer</button>}</div>; })}
        <Link to={`/study/${item?.id}`} className="inline-block text-xs text-teal-400 pt-1">Manage flashcards →</Link>
      </section>
      <section className="linear-card p-4 space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Evening reflection</h2><span className="text-xs text-neutral-500">Log what you did</span></div><textarea className={area} rows={2} value={current.understood} onChange={(e) => setReflection((prev) => ({ ...prev, understood: e.target.value }))} placeholder="What did you understand today?" /><textarea className={area} rows={2} value={current.notUnderstood} onChange={(e) => setReflection((prev) => ({ ...prev, notUnderstood: e.target.value }))} placeholder="What is still unclear?" /><div className="flex flex-wrap gap-2"><label className="text-xs flex items-center gap-2">Minutes <input className={`${area} !w-24`} type="number" min="0" value={current.minutes} onChange={(e) => setReflection((prev) => ({ ...prev, minutes: Number(e.target.value) }))} /></label><label className="text-xs flex items-center gap-2">Mood <select className={`${area} !w-32`} value={current.mood} onChange={(e) => setReflection((prev) => ({ ...prev, mood: e.target.value }))}><option value="">Choose</option><option>Focused</option><option>Okay</option><option>Tired</option><option>Stuck</option></select></label><button className="linear-btn-primary !bg-teal-600" onClick={() => void saveLog()}>Save reflection</button></div>
        <div className="border-t border-neutral-200 dark:border-white/[0.08] pt-3 space-y-2"><button disabled={!existingLog} className="linear-btn-secondary disabled:opacity-50" onClick={() => existingLog && void copy(buildMemoryUpdatePrompt(item!, memory, { ...existingLog, ...current }, activeTopics), 'Memory update prompt copied')}><RefreshCw className="w-3 h-3" /> Copy memory update prompt</button><textarea className={area} rows={3} value={memoryJson} onChange={(e) => setMemoryJson(e.target.value)} placeholder="Paste the returned memory JSON here" />{memoryErrors.map((error) => <p key={error} className="text-xs text-rose-400">{error}</p>)}<button className="linear-btn-secondary" disabled={!memoryJson.trim()} onClick={() => void importMemory()}>Update study memory</button></div>
      </section>
      <section className="linear-card p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-sm">Save any prompt result</h2><Link to="/study/history" className="text-xs text-teal-400">Open history →</Link></div><p className="text-[11px] text-neutral-500">Paste a learn explanation or any other result here to keep it with this study item.</p><div className="flex flex-wrap gap-2"><select className={`${area} !w-auto`} value={historyKind} onChange={(e) => setHistoryKind(e.target.value as typeof historyKind)}><option value="learn">Learn</option><option value="practice">Practice</option><option value="other">Other</option></select><input className={`${area} flex-1`} value={historyTitle} onChange={(e) => setHistoryTitle(e.target.value)} placeholder="Optional title" /></div><textarea className={area} rows={2} value={historyPrompt} onChange={(e) => setHistoryPrompt(e.target.value)} placeholder="Optional original prompt" /><textarea className={area} rows={5} value={historyResponse} onChange={(e) => setHistoryResponse(e.target.value)} placeholder="Paste the returned answer here" /><button type="button" disabled={!historyResponse.trim()} className="linear-btn-secondary disabled:opacity-40" onClick={() => void saveResultToHistory()}>Save result to history</button></section>
    </>}
    {item && selectedDoubt && <StudyDoubtDialog item={item} topic={selectedDoubt} unitName={units.find((unit) => unit.id === selectedDoubt.unitId)?.title || 'Unassigned'} memory={memory} onClose={() => setSelectedDoubt(null)} />}
  </div>;
};
