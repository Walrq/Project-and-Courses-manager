import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BookOpen, CalendarDays, ChevronDown, ChevronUp, Clock3, Copy, FileJson2, Plus, Split, Trash2, WandSparkles } from 'lucide-react';
import { studyRepo } from '../db/repos/studyRepo';
import { useUIStore } from '../store/uiStore';
import type { StudyMemory, StudyTopic, StudyUnit } from '../db/schema';
import { buildStudySchedule } from '../core/studyScheduler';
import { formatLocalDate } from '../core/scheduler';
import { parseStudyPlanImport } from '../core/studyPlanImport';
import { studyMemoryBlock } from '../core/studyPrompts';
import { StudyDoubtDialog } from '../components/StudyDoubtDialog';
import { parseFlashcardImport } from '../core/studyFlashcardImport';
import { StudyQuizPanel } from '../components/StudyQuizPanel';
import { StudyProgressPanel } from '../components/StudyProgressPanel';

const statuses: StudyTopic['status'][] = ['not_started', 'learning', 'done', 'needs_revision'];
const sessionTypes: NonNullable<StudyTopic['sessionType']>[] = ['learn', 'practice', 'revise', 'mock_test'];
const statusLabels: Record<StudyTopic['status'], string> = {
  not_started: 'Not started', learning: 'Learning', done: 'Done', needs_revision: 'Needs revision',
};
const inputClass = 'w-full px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#14161f] text-neutral-900 dark:text-[#f7f8f8] focus:outline-none focus:border-teal-500';

export const StudyItemPage: React.FC = () => {
  const { id: idParam } = useParams();
  const itemId = Number(idParam);
  const { showToast } = useUIStore();
  const [today] = useState(() => formatLocalDate(new Date()));
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [newTopicByUnit, setNewTopicByUnit] = useState<Record<number, string>>({});
  const [planPrompt, setPlanPrompt] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [dailyHoursInput, setDailyHoursInput] = useState('');
  const [restWeekdaysInput, setRestWeekdaysInput] = useState<number[] | null>(null);
  const [totalPagesInput, setTotalPagesInput] = useState('');
  const [pagesPerDayInput, setPagesPerDayInput] = useState('20');
  const [textbookUnitInput, setTextbookUnitInput] = useState('');
  const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
  const [doubtTopic, setDoubtTopic] = useState<StudyTopic | null>(null);
  const [flashcardJson, setFlashcardJson] = useState('');
  const [flashcardErrors, setFlashcardErrors] = useState<string[]>([]);
  const [revisionIntervalsDraft, setRevisionIntervalsDraft] = useState<string | null>(null);
  const [outlineSource, setOutlineSource] = useState('');
  const [outlinePrompt, setOutlinePrompt] = useState<string | null>(null);
  const [cheatTopicId, setCheatTopicId] = useState<number | ''>('');
  const [cheatPrompt, setCheatPrompt] = useState<string | null>(null);
  const [cheatReply, setCheatReply] = useState('');
  const item = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getItem(itemId) : undefined, [itemId]);
  const units = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getUnits(itemId) : [], [itemId]) || [];
  const topics = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getTopics(itemId) : [], [itemId]) || [];
  const sessions = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getSessions(itemId) : [], [itemId]) || [];
  const memory = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getMemory(itemId) : undefined, [itemId]);
  const cards = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getCards(itemId) : [], [itemId]) || [];
  const restWeekdays = restWeekdaysInput ?? item?.restWeekdays ?? [0];
  const dailyHours = Number(dailyHoursInput || item?.hoursPerDay || 1);
  const startDate = startDateInput || item?.planStartDate || today;

  if (!item) {
    return <div className="py-20 text-center text-sm text-neutral-500">Study item not found. <Link to="/study" className="text-teal-400">Return to Study</Link></div>;
  }

  const withErrorToast = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      if (success) showToast(success, 'success');
    } catch (error) {
      showToast(`Could not save study changes: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const addUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newUnitTitle.trim();
    if (!title) return;
    await withErrorToast(() => studyRepo.addUnit(itemId, title, units.length), 'Unit added');
    setNewUnitTitle('');
  };

  const addTopic = async (unit: StudyUnit) => {
    const title = (newTopicByUnit[unit.id!] || '').trim();
    if (!title || !unit.id || !item) return;
    await withErrorToast(() => studyRepo.addTopic({
      itemId,
      unitId: unit.id!,
      title,
      minutes: 30,
      status: 'not_started',
      order: topics.filter((topic) => topic.unitId === unit.id).length,
    }), 'Topic added');
    setNewTopicByUnit((current) => ({ ...current, [unit.id!]: '' }));
  };

  const moveUnit = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= units.length) return;
    const reordered = [...units];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    await withErrorToast(() => Promise.all(reordered.map((unit, order) => studyRepo.updateUnit(unit.id!, { order }))));
  };

  const moveTopic = async (unitId: number, index: number, direction: -1 | 1) => {
    const list = topics.filter((topic) => topic.unitId === unitId);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    await withErrorToast(() => Promise.all(list.map((topic, order) => studyRepo.updateTopic(topic.id!, { order }))));
  };

  const copyToClipboard = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, 'success');
    } catch (error) {
      showToast(`Could not copy prompt: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const generatePlanPrompt = () => {
    const outline = units.map((unit) => ({
      title: unit.title,
      topics: topics.filter((topic) => topic.unitId === unit.id).map((topic) => ({ title: topic.title, minutes: topic.minutes })),
    }));
    const kind = item.type === 'course' ? 'fixed-order course lessons' : 'a subject syllabus for exam readiness';
    const planPromptText = `${studyMemoryBlock(memory)}\nCreate a realistic study outline for this ${kind}. Return JSON only in this shape: {"units":[{"title":"Unit title","weight":1,"topics":[{"title":"Topic","minutes":30,"sessionType":"learn"}]}]}. Each topic must have an estimated minutes value. sessionType may be learn or practice. Keep the order sensible and use the supplied outline when present.\n\nStudy item: ${item.name}\nGoal: ${item.goal || 'Not specified'}\nLevel: ${item.level || 'Not specified'}\nAvailable time: ${item.hoursPerDay || 1} hours per day\n${item.type === 'course' ? `Course lessons: ${item.totalLessons || 'Not specified'}\nCourse duration: ${item.totalHours || 'Not specified'} hours\n` : `Exam date: ${item.examDate || 'Not specified'}\nTarget score: ${item.targetScore || 'Not specified'}\nKnown weak areas: ${item.weakAreas || 'Not specified'}\nSyllabus: ${item.syllabus || 'Not supplied'}\n`}Existing outline: ${JSON.stringify(outline)}\n\nDo not include markdown fences or extra commentary.`;
    setPlanPrompt(planPromptText);
    setImportErrors([]);
  };

  const generateOutlineImportPrompt = (kind: 'course' | 'syllabus') => {
    const instructions = kind === 'course'
      ? 'Convert the pasted course lesson list or table of contents into ordered units and topics. Preserve the given course order and group related lessons into units.'
      : 'Map the pasted official syllabus into units and topics. Preserve syllabus weightage as unit weight when supplied, and keep the original topic wording.';
    setOutlinePrompt(`${studyMemoryBlock(memory)}\n${instructions}\nEstimate study minutes for each topic and assign sessionType learn or practice where suitable. Return JSON only in this shape: {"units":[{"title":"Unit title","weight":1,"topics":[{"title":"Topic","minutes":30,"sessionType":"learn"}]}]}.\nStudy item: ${item.name}\nGoal: ${item.goal || 'Not specified'}\nLevel: ${item.level || 'Not specified'}\n${item.examDate ? `Exam date: ${item.examDate}\n` : ''}Source text:\n${outlineSource.trim()}\n\nDo not add markdown fences or commentary.`);
  };

  const generateCheatSheetPrompt = () => {
    const topic = topics.find((entry) => entry.id === Number(cheatTopicId));
    if (!topic) { showToast('Choose a topic with notes first.', 'info'); return; }
    setCheatPrompt(`${studyMemoryBlock(memory)}\nCreate a concise one-page revision sheet for ${item.name}, topic ${topic.title}. Use clear headings, key terms, formulas or steps, common mistakes, and a brief self-check section. Use only the notes and memory below; mark gaps as questions instead of inventing facts.\nKey concepts: ${(memory?.concepts || []).join('; ') || 'None saved'}\nTopic notes:\n${topic.notes || 'No notes saved for this topic.'}\n\nReturn the revision sheet as plain markdown.`);
  };

  const saveCheatSheet = async () => {
    const topic = topics.find((entry) => entry.id === Number(cheatTopicId));
    if (!topic?.id || !cheatReply.trim()) return;
    try {
      await studyRepo.updateTopic(topic.id, { notes: [topic.notes?.trim(), `Revision sheet\n${cheatReply.trim()}`].filter(Boolean).join('\n\n') });
      await studyRepo.saveStudyResponse({ itemId, topicId: topic.id, kind: 'cheat_sheet', title: `Revision sheet · ${topic.title}`, prompt: cheatPrompt || undefined, response: cheatReply.trim() });
      setCheatReply(''); showToast('Revision sheet saved to topic notes and prompt history', 'success');
    } catch (error) { showToast(`Could not save revision sheet: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  };

  const importPlan = async () => {
    const result = parseStudyPlanImport(importText);
    if (!result.success) {
      if (importText.trim()) await studyRepo.saveStudyResponse({ itemId, kind: 'plan', title: 'Unparsed study plan reply', prompt: outlinePrompt || planPrompt || undefined, response: importText.trim() });
      setImportErrors(result.errors);
      return;
    }
    setIsImporting(true);
    try {
      await studyRepo.importPlan(itemId, result.data.units);
      await studyRepo.saveStudyResponse({ itemId, kind: 'plan', title: 'Imported study plan', prompt: outlinePrompt || planPrompt || undefined, response: importText.trim() });
      showToast(`Imported ${result.data.units.length} units into your outline`, 'success');
      setImportText('');
      setImportErrors([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportErrors([message]);
      showToast(`Could not import study plan: ${message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const copyFixJsonPrompt = () => {
    const repairPrompt = `Fix the JSON syntax and shape in the text below. Return only valid JSON with a top-level "units" array. Each unit needs a title and topics array. Each topic needs a title, a positive integer minutes value, and may have sessionType (learn or practice). Preserve the intended content.\n\n${importText}`;
    void copyToClipboard(repairPrompt, 'JSON repair prompt copied');
  };

  const buildSchedule = async () => {
    try {
      const updatedItem = { ...item, hoursPerDay: dailyHours, planStartDate: startDate, restWeekdays };
      const result = buildStudySchedule(updatedItem, units, topics, startDate, restWeekdays);
      const previousSessions = await studyRepo.getSessions(itemId);
      if (previousSessions.some((session) => session.done !== 1) && !window.confirm('Rebuilding the schedule replaces unfinished planned sessions. Completed study history is kept. Continue?')) return;
      await studyRepo.updateItem(itemId, { hoursPerDay: dailyHours, planStartDate: startDate, restWeekdays });
      await studyRepo.replaceUnfinishedSessions(itemId, result.sessions);
      setScheduleWarnings(result.warnings);
      showToast(`Schedule created with ${result.sessions.filter((session) => session.type !== 'rest').length} study sessions`, result.warnings.length ? 'info' : 'success');
    } catch (error) {
      showToast(`Could not build schedule: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const createTextbookTopics = async () => {
    const totalPages = Number(totalPagesInput);
    const pagesPerDay = Number(pagesPerDayInput);
    if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 100000 || !Number.isInteger(pagesPerDay) || pagesPerDay < 1) {
      showToast('Enter 1-100,000 total pages and a valid pages-per-day value.', 'error');
      return;
    }
    try {
      const count = await studyRepo.splitTextbookPages(itemId, totalPages, pagesPerDay, Math.max(1, Math.round(dailyHours * 60)), textbookUnitInput ? Number(textbookUnitInput) : undefined);
      showToast(`Added ${count} page-range topics`, 'success');
      setTotalPagesInput('');
    } catch (error) {
      showToast(`Could not split textbook pages: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const importFlashcards = async () => {
    const result = parseFlashcardImport(flashcardJson);
    if (!result.success) { if (flashcardJson.trim()) await studyRepo.saveStudyResponse({ itemId, kind: 'flashcards', title: 'Unparsed flashcard reply', response: flashcardJson.trim() }); setFlashcardErrors(result.errors); return; }
    try {
      const count = await studyRepo.importFlashcards(itemId, result.data);
      await studyRepo.saveStudyResponse({ itemId, kind: 'flashcards', title: `Imported ${count} flashcards`, response: flashcardJson.trim() });
      setFlashcardJson(''); setFlashcardErrors([]);
      showToast(`Imported ${count} flashcards`, 'success');
    } catch (error) { setFlashcardErrors([error instanceof Error ? error.message : String(error)]); }
  };
  const saveRevisionIntervals = async () => {
    const intervals = (revisionIntervalsDraft || (item?.revisionIntervals || [1, 3, 7, 21, 45]).join(',')).split(',').map((value) => Number(value.trim()));
    if (!intervals.length || intervals.some((days) => !Number.isInteger(days) || days < 1) || new Set(intervals).size !== intervals.length) { showToast('Use unique positive whole numbers separated by commas.', 'error'); return; }
    await withErrorToast(() => studyRepo.updateItem(itemId, { revisionIntervals: intervals }), 'Revision intervals saved');
    setRevisionIntervalsDraft(null);
  };

  const doneCount = topics.filter((topic) => topic.status === 'done').length;
  const progress = topics.length ? Math.round(doneCount / topics.length * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3"><Link to="/study" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-[#8a8f98] hover:text-teal-400"><ArrowLeft className="w-3.5 h-3.5" /> All study items</Link><Link to="/study/history" className="text-xs text-teal-400">Prompt history</Link></div>
      <section className="linear-card p-5 sm:p-6 border-teal-500/20">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5 text-teal-400" /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-500">{item.type}</div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-0.5">{item.name}</h1>
              {item.goal && <p className="text-xs text-neutral-500 dark:text-[#8a8f98] mt-1">{item.goal}</p>}
            </div>
          </div>
          <div className="text-xs text-neutral-500 dark:text-[#8a8f98]">{doneCount} of {topics.length} topics done · {progress}%</div>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-white/[0.06] mt-5 overflow-hidden"><div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-[#8a8f98] mt-3">
          {item.level && <span>Level: {item.level}</span>}
          {item.hoursPerDay && <span>{item.hoursPerDay} hours/day</span>}
          {item.type === 'course' && item.platform && <span>Platform: {item.platform}</span>}
          {item.type === 'course' && item.totalLessons && <span>{item.totalLessons} lessons</span>}
          {item.type === 'subject' && item.examDate && <span>Exam: {item.examDate}</span>}
          {item.type === 'subject' && item.targetScore && <span>Target: {item.targetScore}</span>}
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Open course link</a>}
        </div>
        <label className="block text-[11px] text-neutral-500 mt-2">Study item tags<input aria-label="Study item tags" className={`${inputClass} max-w-md mt-1`} defaultValue={(item.tags || []).join(', ')} placeholder="Comma separated tags" onBlur={(event) => { const tags = [...new Set(event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))]; if (JSON.stringify(tags) !== JSON.stringify(item.tags || [])) void withErrorToast(() => studyRepo.updateItem(itemId, { tags })); }} /></label>
      </section>

      <StudyMemoryEditor itemId={itemId} memory={memory} defaultLevel={item.level || ''} />

      <section className="linear-card p-4 sm:p-5 space-y-3 border-teal-500/10">
        <div><h2 className="text-sm font-semibold">Course outline and syllabus import</h2><p className="text-[11px] text-neutral-500 mt-1">Paste lesson lists or syllabus text, copy a prompt, then paste its JSON into the plan importer below.</p></div>
        <textarea className={`${inputClass} resize-y`} rows={5} value={outlineSource} onChange={(event) => setOutlineSource(event.target.value)} placeholder={item.type === 'course' ? 'Paste the course lesson list or table of contents...' : 'Paste the official syllabus text...'} />
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!outlineSource.trim()} className="linear-btn-secondary disabled:opacity-40" onClick={() => generateOutlineImportPrompt('course')}>Build course outline prompt</button><button type="button" disabled={!outlineSource.trim()} className="linear-btn-secondary disabled:opacity-40" onClick={() => generateOutlineImportPrompt('syllabus')}>Build syllabus prompt</button></div>
        {outlinePrompt && <div className="space-y-2"><textarea aria-label="Outline import prompt" readOnly className={`${inputClass} font-mono resize-y`} rows={6} value={outlinePrompt} /><button type="button" className="linear-btn-secondary" onClick={() => void copyToClipboard(outlinePrompt, 'Import prompt copied')}>Copy import prompt</button></div>}
      </section>

      <section className="linear-card p-4 sm:p-5 space-y-3 border-teal-500/10">
        <div><h2 className="text-sm font-semibold">Cheat sheet</h2><p className="text-[11px] text-neutral-500 mt-1">Generate a revision sheet prompt from your own notes, then paste and save the reply.</p></div>
        <select className={inputClass} value={cheatTopicId} onChange={(event) => setCheatTopicId(event.target.value ? Number(event.target.value) : '')}><option value="">Choose topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
        <button type="button" className="linear-btn-secondary" disabled={cheatTopicId === ''} onClick={generateCheatSheetPrompt}>Build cheat sheet prompt</button>
        {cheatPrompt && <div className="space-y-2"><textarea readOnly className={`${inputClass} font-mono resize-y`} rows={5} value={cheatPrompt} /><button type="button" className="linear-btn-secondary" onClick={() => void copyToClipboard(cheatPrompt, 'Cheat sheet prompt copied')}>Copy cheat sheet prompt</button></div>}
        <textarea className={`${inputClass} resize-y`} rows={5} value={cheatReply} onChange={(event) => setCheatReply(event.target.value)} placeholder="Paste the revision sheet reply" />
        <button type="button" disabled={!cheatReply.trim() || cheatTopicId === ''} className="linear-btn-secondary disabled:opacity-40" onClick={() => void saveCheatSheet()}>Save to topic notes</button>
      </section>

      <section className="linear-card p-4 sm:p-5 space-y-3 border-teal-500/10">
        <div><h2 className="text-sm font-semibold">Spaced revision settings</h2><p className="text-[11px] text-neutral-500 mt-1">When you finish a topic, it enters the revision queue at these day intervals. Ratings adjust the next dates.</p></div>
        <div className="flex flex-wrap items-center gap-2"><label className="text-xs">Days after finishing / review</label><input className={`${inputClass} max-w-sm`} value={revisionIntervalsDraft ?? (item.revisionIntervals || [1, 3, 7, 21, 45]).join(', ')} onChange={(event) => setRevisionIntervalsDraft(event.target.value)} /><button type="button" className="linear-btn-secondary" onClick={() => void saveRevisionIntervals()}>Save intervals</button></div>
        <div className="border-t border-neutral-200 dark:border-white/[0.06] pt-3 space-y-2"><h3 className="text-xs font-semibold">Import flashcards</h3><p className="text-[11px] text-neutral-500">Paste a JSON array with front, back, optional topicId and tags. Cards start due today.</p><textarea className={`${inputClass} font-mono resize-y`} rows={4} value={flashcardJson} onChange={(event) => { setFlashcardJson(event.target.value); setFlashcardErrors([]); }} placeholder={'[{"front":"Question","back":"Answer","topicId":1,"tags":["chapter 1"]}]'} />{flashcardErrors.map((error) => <div key={error} role="alert" className="text-[11px] text-rose-400">{error}</div>)}<button type="button" disabled={!flashcardJson.trim()} className="linear-btn-secondary disabled:opacity-40" onClick={() => void importFlashcards()}>Import flashcards</button></div>
        <div className="border-t border-neutral-200 dark:border-white/[0.06] pt-3 space-y-2"><h3 className="text-xs font-semibold">Flashcard browser · {cards.length} cards</h3>{cards.length === 0 ? <p className="text-[11px] text-neutral-500">Imported cards will appear here and in Study Today when due.</p> : cards.map((card) => <FlashcardBrowserRow key={card.id} front={card.front} back={card.back} topicTitle={topics.find((topic) => topic.id === card.topicId)?.title} dueDate={card.dueDate} />)}</div>
      </section>

      <StudyQuizPanel item={item} topics={topics} units={units} memory={memory} />
      <StudyProgressPanel item={item} topics={topics} sessions={sessions} memory={memory} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className="linear-card p-4 sm:p-5 space-y-3 border-teal-500/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2"><WandSparkles className="w-4 h-4 text-teal-400" /> AI plan prompt</h2>
              <p className="text-[11px] text-neutral-500 dark:text-[#8a8f98] mt-1">Copy a prompt, ask your chosen model, then paste its JSON here. No AI calls are made by the app.</p>
            </div>
            <button type="button" onClick={generatePlanPrompt} className="linear-btn-secondary shrink-0"><WandSparkles className="w-3.5 h-3.5 text-teal-400" /> Generate</button>
          </div>
          {planPrompt && <div className="space-y-2">
            <textarea readOnly value={planPrompt} rows={7} className={`${inputClass} font-mono resize-y`} aria-label="Study plan prompt" />
            <button type="button" onClick={() => copyToClipboard(planPrompt, 'Study plan prompt copied')} className="linear-btn-secondary"><Copy className="w-3.5 h-3.5" /> Copy Prompt</button>
          </div>}
          <div className="pt-2 border-t border-neutral-200 dark:border-white/[0.06] space-y-2">
            <label className="block text-[11px] text-neutral-500 dark:text-[#8a8f98]">Paste plan JSON</label>
            <textarea value={importText} onChange={(event) => { setImportText(event.target.value); setImportErrors([]); }} rows={5} className={`${inputClass} font-mono resize-y`} placeholder={'{"units":[{"title":"Unit 1","topics":[{"title":"Topic 1","minutes":30,"sessionType":"learn"}]}]}'} />
            {importErrors.length > 0 && <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-2.5 text-[11px] text-rose-300 space-y-1">{importErrors.map((error) => <div key={error}>{error}</div>)}<button type="button" onClick={copyFixJsonPrompt} className="mt-1 underline underline-offset-2">Copy JSON repair prompt</button></div>}
            <div className="flex justify-end"><button type="button" onClick={importPlan} disabled={isImporting || !importText.trim()} className="linear-btn-primary !bg-gradient-to-b !from-teal-500 !to-teal-600 disabled:opacity-40"><FileJson2 className="w-3.5 h-3.5" /> {isImporting ? 'Importing...' : 'Append Plan JSON'}</button></div>
          </div>
        </section>

        {item.type === 'subject' && <section className="linear-card p-4 sm:p-5 space-y-3 border-teal-500/10">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><Split className="w-4 h-4 text-teal-400" /> Textbook page split</h2>
            <p className="text-[11px] text-neutral-500 dark:text-[#8a8f98] mt-1">Create page-range topics without AI. New ranges continue after pages already in your outline.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-[11px] text-neutral-500 dark:text-[#8a8f98]">Total pages<input type="number" min="1" className={inputClass} value={totalPagesInput} onChange={(event) => setTotalPagesInput(event.target.value)} placeholder="e.g. 420" /></label>
            <label className="space-y-1 text-[11px] text-neutral-500 dark:text-[#8a8f98]">Pages per study day<input type="number" min="1" className={inputClass} value={pagesPerDayInput} onChange={(event) => setPagesPerDayInput(event.target.value)} /></label>
            <label className="space-y-1 text-[11px] text-neutral-500 dark:text-[#8a8f98] sm:col-span-2">Add topics to unit
              <select className={inputClass} value={textbookUnitInput} onChange={(event) => setTextbookUnitInput(event.target.value)}>
                <option value="">Create a "Textbook pages" unit if needed</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500 dark:text-[#8a8f98]">
            <span>Each page range is estimated at {Math.max(1, Math.round(dailyHours * 60))} minutes.</span>
            <button type="button" onClick={createTextbookTopics} disabled={!totalPagesInput} className="linear-btn-secondary shrink-0"><Split className="w-3.5 h-3.5 text-teal-400" /> Split Pages</button>
          </div>
        </section>}
      </div>

      <section className="linear-card p-4 sm:p-5 space-y-4 border-teal-500/10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-teal-400" /> Auto-schedule topics</h2>
            <p className="text-[11px] text-neutral-500 dark:text-[#8a8f98] mt-1">Spreads unfinished topics by your daily study time and rest days. Exam plans reserve the last available study days for revision and a mock test.</p>
          </div>
          <button type="button" onClick={buildSchedule} disabled={!topics.some((topic) => topic.status !== 'done')} className="linear-btn-primary !bg-gradient-to-b !from-teal-500 !to-teal-600 shrink-0 disabled:opacity-40"><CalendarDays className="w-3.5 h-3.5" /> Build Schedule</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <label className="space-y-1 text-[11px] text-neutral-500 dark:text-[#8a8f98]">Schedule starts<input type="date" className={inputClass} value={startDate} onChange={(event) => setStartDateInput(event.target.value)} /></label>
          <label className="space-y-1 text-[11px] text-neutral-500 dark:text-[#8a8f98]">Study hours per day<input type="number" min="0.25" step="0.25" className={inputClass} value={dailyHours} onChange={(event) => setDailyHoursInput(event.target.value)} /></label>
        </div>
        <div>
          <div className="text-[11px] text-neutral-500 dark:text-[#8a8f98] mb-2">Weekly rest days <span className="text-neutral-400">(default: Sunday)</span></div>
          <div className="flex flex-wrap gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
              const selected = restWeekdays.includes(index);
              return <button type="button" key={day} aria-pressed={selected} onClick={() => {
                if (selected && restWeekdays.length === 6) { showToast('Keep at least one study day each week.', 'info'); return; }
                setRestWeekdaysInput(selected ? restWeekdays.filter((weekday) => weekday !== index) : [...restWeekdays, index].sort());
              }} className={`px-3 py-1.5 text-[11px] rounded-lg border transition-colors ${selected ? 'bg-teal-500/10 border-teal-500/30 text-teal-300' : 'border-neutral-200 dark:border-white/[0.08] text-neutral-500 dark:text-[#8a8f98]'}`}>{day}</button>;
            })}
          </div>
        </div>
        {scheduleWarnings.map((warning) => <div key={warning} className="text-[11px] p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] text-amber-300">{warning}</div>)}
        {sessions.length > 0 && <div className="pt-2 border-t border-neutral-200 dark:border-white/[0.06] space-y-2">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8a8f98]">Scheduled sessions</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sessions.slice(0, 12).map((session) => {
              const title = session.type === 'rest' ? 'Rest day' : session.type === 'mock_test' ? 'Mock test' : session.type === 'revise' ? 'Revision' : session.topicIds.map((topicId) => topics.find((topic) => topic.id === topicId)?.title).filter(Boolean).join(', ') || session.type;
              return <div key={session.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05] text-[11px]">
                <span className="font-mono text-neutral-500 dark:text-[#8a8f98] shrink-0">{session.date}</span>
                <span className="truncate flex-1">{title}</span>
                <span className="text-neutral-500 shrink-0">{session.plannedMinutes ? `${session.plannedMinutes}m` : ''}{session.done === 1 ? ' · Done' : ''}</span>
              </div>;
            })}
          </div>
        </div>}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Units and topics</h2>
            <p className="text-[11px] text-neutral-500 dark:text-[#8a8f98] mt-0.5">Add your outline and update each topic as you study.</p>
          </div>
          <span className="text-[11px] text-neutral-500 dark:text-[#8a8f98]">{units.length} units</span>
        </div>

        {units.map((unit, unitIndex) => {
          const unitTopics = topics.filter((topic) => topic.unitId === unit.id);
          const unitDone = unitTopics.filter((topic) => topic.status === 'done').length;
          return (
            <div key={unit.id} className="linear-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-teal-500/10 text-teal-400 text-[10px] font-semibold flex items-center justify-center shrink-0">{unitIndex + 1}</span>
                <input aria-label="Unit title" className={`${inputClass} font-semibold flex-1`} defaultValue={unit.title} onBlur={(event) => event.target.value.trim() && event.target.value !== unit.title && unit.id && withErrorToast(() => studyRepo.updateUnit(unit.id!, { title: event.target.value.trim() }))} />
                <span className="text-[10px] text-neutral-500 whitespace-nowrap">{unitDone}/{unitTopics.length}</span>
                <button type="button" disabled={unitIndex === 0} onClick={() => moveUnit(unitIndex, -1)} className="p-1 text-neutral-400 hover:text-teal-400 disabled:opacity-30" title="Move unit up"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" disabled={unitIndex === units.length - 1} onClick={() => moveUnit(unitIndex, 1)} className="p-1 text-neutral-400 hover:text-teal-400 disabled:opacity-30" title="Move unit down"><ChevronDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => unit.id && withErrorToast(() => studyRepo.deleteUnit(unit.id!), 'Unit and its topics deleted')} className="p-1 text-neutral-400 hover:text-rose-400" title="Delete unit and topics"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>

              <div className="space-y-2 pl-8">
                {unitTopics.map((topic, topicIndex) => (
                  <TopicRow key={topic.id} topic={topic} index={topicIndex} count={unitTopics.length} onMove={moveTopic} onChange={(updates) => topic.id && withErrorToast(() => studyRepo.updateTopic(topic.id!, updates))} onDelete={() => topic.id && withErrorToast(() => studyRepo.deleteTopic(topic.id!), 'Topic deleted')} onDoubt={() => setDoubtTopic(topic)} />
                ))}
                <form onSubmit={(event) => { event.preventDefault(); addTopic(unit); }} className="flex gap-2 pt-1">
                  <input className={inputClass} value={newTopicByUnit[unit.id!] || ''} onChange={(event) => setNewTopicByUnit((current) => ({ ...current, [unit.id!]: event.target.value }))} placeholder="Add a lesson, concept, or page range..." />
                  <button type="submit" disabled={!(newTopicByUnit[unit.id!] || '').trim()} className="linear-btn-secondary !text-xs disabled:opacity-40"><Plus className="w-3.5 h-3.5" /> Topic</button>
                </form>
              </div>
            </div>
          );
        })}

        {units.length === 0 && <div className="linear-card p-8 text-center text-xs text-neutral-500 dark:text-[#8a8f98]">Add your first unit, then break it into topics.</div>}
        <form onSubmit={addUnit} className="linear-card p-3 flex gap-2">
          <input className={inputClass} value={newUnitTitle} onChange={(event) => setNewUnitTitle(event.target.value)} placeholder="New unit (e.g. Chapter 1, Module 1)" />
          <button type="submit" disabled={!newUnitTitle.trim()} className="linear-btn-primary !bg-gradient-to-b !from-teal-500 !to-teal-600 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /> Add Unit</button>
        </form>
      </section>
      {doubtTopic && <StudyDoubtDialog item={item} topic={doubtTopic} unitName={units.find((unit) => unit.id === doubtTopic.unitId)?.title || 'Unassigned'} memory={memory} onClose={() => setDoubtTopic(null)} />}
    </div>
  );
};

const StudyMemoryEditor: React.FC<{ itemId: number; memory?: StudyMemory; defaultLevel: string }> = ({ itemId, memory, defaultLevel }) => {
  const { showToast } = useUIStore();
  const [draft, setDraft] = useState<StudyMemory | null>(null);
  const value = draft || memory || { itemId, summary: '', concepts: [], understood: [], weak: [], doubts: [], levelAndStyle: defaultLevel, updatedAt: '' };
  const update = (changes: Partial<StudyMemory>) => setDraft({ ...value, ...changes });
  const lines = (list: string[]) => list.join('\n');
  const save = async () => { await studyRepo.saveMemory(itemId, value); setDraft(null); showToast('Study memory saved', 'success'); };
  return <section className="linear-card p-4 sm:p-5 space-y-3 border-teal-500/10">
    <div><h2 className="text-sm font-semibold">Study memory</h2><p className="text-[11px] text-neutral-500 mt-1">This context is added to Study prompts. Edit it yourself at any time.</p></div>
    <textarea className={`${inputClass} resize-y`} rows={3} aria-label="Memory summary" placeholder="Rolling summary" value={value.summary} onChange={(event) => update({ summary: event.target.value })} />
    <label className="block text-[11px] text-neutral-500">Level and preferred explanation style<input className={inputClass} value={value.levelAndStyle || ''} onChange={(event) => update({ levelAndStyle: event.target.value })} placeholder="Beginner; concise explanations with examples" /></label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{([['concepts', 'Key concepts'], ['understood', 'Understood well'], ['weak', 'Weak spots'], ['doubts', 'Open doubts']] as const).map(([key, label]) => <label key={key} className="block text-[11px] text-neutral-500">{label}<textarea className={`${inputClass} resize-y`} rows={3} value={lines(value[key])} onChange={(event) => update({ [key]: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })} placeholder="One item per line" /></label>)}</div>
    <div className="flex justify-end"><button type="button" onClick={() => void save()} className="linear-btn-primary !bg-teal-600">Save study memory</button></div>
  </section>;
};

const FlashcardBrowserRow: React.FC<{ front: string; back: string; topicTitle?: string; dueDate: string }> = ({ front, back, topicTitle, dueDate }) => {
  const [revealed, setRevealed] = useState(false);
  return <div className="rounded-lg border border-neutral-200 dark:border-white/[0.08] p-3 space-y-2"><div className="flex justify-between gap-2 text-[10px] text-neutral-500"><span>{topicTitle || 'Unlinked card'}</span><span>Due {dueDate}</span></div><div className="text-xs font-medium whitespace-pre-wrap">{front}</div>{revealed && <div className="text-xs text-teal-300 whitespace-pre-wrap">{back}</div>}<button type="button" className="text-[11px] text-teal-400" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide answer' : 'Reveal answer'}</button></div>;
};

const TopicRow: React.FC<{
  topic: StudyTopic;
  index: number;
  count: number;
  onMove: (unitId: number, index: number, direction: -1 | 1) => void;
  onChange: (updates: Partial<StudyTopic>) => void;
  onDelete: () => void;
  onDoubt: () => void;
}> = ({ topic, index, count, onMove, onChange, onDelete, onDoubt }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_125px_105px_78px_auto] gap-2 items-center rounded-lg border border-neutral-200/70 dark:border-white/[0.05] bg-neutral-50/50 dark:bg-white/[0.015] p-2">
    <input aria-label="Topic title" className={`${inputClass} min-w-0`} defaultValue={topic.title} onBlur={(event) => event.target.value.trim() && event.target.value !== topic.title && onChange({ title: event.target.value.trim() })} />
    <select aria-label="Topic status" className={inputClass} value={topic.status} onChange={(event) => onChange({ status: event.target.value as StudyTopic['status'] })}>
      {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
    </select>
    <select aria-label="Session type" className={inputClass} value={topic.sessionType || 'learn'} onChange={(event) => onChange({ sessionType: event.target.value as NonNullable<StudyTopic['sessionType']> })}>
      {sessionTypes.map((type) => <option key={type} value={type}>{type === 'mock_test' ? 'Mock test' : type[0].toUpperCase() + type.slice(1)}</option>)}
    </select>
    <label className="relative">
      <Clock3 className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input aria-label="Estimated minutes" className={`${inputClass} pl-6`} type="number" min="0" value={topic.minutes} onChange={(event) => onChange({ minutes: Number(event.target.value) || 0 })} />
    </label>
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" onClick={onDoubt} className="p-1 text-neutral-400 hover:text-teal-400" title="Ask a doubt"><span className="text-[10px] font-semibold">?</span></button>
      <button type="button" disabled={index === 0} onClick={() => onMove(topic.unitId, index, -1)} className="p-1 text-neutral-400 hover:text-teal-400 disabled:opacity-30" title="Move topic up"><ChevronUp className="w-4 h-4" /></button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(topic.unitId, index, 1)} className="p-1 text-neutral-400 hover:text-teal-400 disabled:opacity-30" title="Move topic down"><ChevronDown className="w-4 h-4" /></button>
      <button type="button" onClick={onDelete} className="p-1 text-neutral-400 hover:text-rose-400" title="Delete topic"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
    <label className="col-span-full flex items-center gap-2 text-[10px] text-neutral-500">Tags<input aria-label={`Tags for ${topic.title}`} className={`${inputClass} !w-auto flex-1`} defaultValue={(topic.tags || []).join(', ')} placeholder="Comma separated tags" onBlur={(event) => { const tags = [...new Set(event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))]; if (JSON.stringify(tags) !== JSON.stringify(topic.tags || [])) onChange({ tags }); }} /></label>
    <TopicNotesEditor topic={topic} onChange={onChange} />
  </div>
);

const TopicNotesEditor: React.FC<{ topic: StudyTopic; onChange: (updates: Partial<StudyTopic>) => void }> = ({ topic, onChange }) => (
  <details className="col-span-full text-[10px] text-neutral-500">
    <summary className="cursor-pointer hover:text-teal-400">Topic notes {topic.notes?.trim() ? '· saved' : ''}</summary>
    <textarea aria-label={`Notes for ${topic.title}`} className={`${inputClass} mt-2 resize-y`} rows={3} defaultValue={topic.notes || ''} placeholder="Write notes or key takeaways..." onBlur={(event) => event.target.value !== (topic.notes || '') && onChange({ notes: event.target.value })} />
  </details>
);
