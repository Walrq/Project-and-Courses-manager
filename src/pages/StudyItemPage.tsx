import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Clock3, Plus, Trash2 } from 'lucide-react';
import { studyRepo } from '../db/repos/studyRepo';
import { useUIStore } from '../store/uiStore';
import type { StudyTopic, StudyUnit } from '../db/schema';

const statuses: StudyTopic['status'][] = ['not_started', 'learning', 'done', 'needs_revision'];
const statusLabels: Record<StudyTopic['status'], string> = {
  not_started: 'Not started', learning: 'Learning', done: 'Done', needs_revision: 'Needs revision',
};
const inputClass = 'w-full px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#14161f] text-neutral-900 dark:text-[#f7f8f8] focus:outline-none focus:border-teal-500';

export const StudyItemPage: React.FC = () => {
  const { id: idParam } = useParams();
  const itemId = Number(idParam);
  const { showToast } = useUIStore();
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [newTopicByUnit, setNewTopicByUnit] = useState<Record<number, string>>({});
  const item = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getItem(itemId) : undefined, [itemId]);
  const units = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getUnits(itemId) : [], [itemId]) || [];
  const topics = useLiveQuery(() => Number.isFinite(itemId) ? studyRepo.getTopics(itemId) : [], [itemId]) || [];

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

  if (!item) {
    return <div className="py-20 text-center text-sm text-neutral-500">Study item not found. <Link to="/study" className="text-teal-400">Return to Study</Link></div>;
  }

  const doneCount = topics.filter((topic) => topic.status === 'done').length;
  const progress = topics.length ? Math.round(doneCount / topics.length * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <Link to="/study" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-[#8a8f98] hover:text-teal-400"><ArrowLeft className="w-3.5 h-3.5" /> All study items</Link>
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
                  <TopicRow key={topic.id} topic={topic} index={topicIndex} count={unitTopics.length} onMove={moveTopic} onChange={(updates) => topic.id && withErrorToast(() => studyRepo.updateTopic(topic.id!, updates))} onDelete={() => topic.id && withErrorToast(() => studyRepo.deleteTopic(topic.id!), 'Topic deleted')} />
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
    </div>
  );
};

const TopicRow: React.FC<{
  topic: StudyTopic;
  index: number;
  count: number;
  onMove: (unitId: number, index: number, direction: -1 | 1) => void;
  onChange: (updates: Partial<StudyTopic>) => void;
  onDelete: () => void;
}> = ({ topic, index, count, onMove, onChange, onDelete }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_145px_78px_auto] gap-2 items-center rounded-lg border border-neutral-200/70 dark:border-white/[0.05] bg-neutral-50/50 dark:bg-white/[0.015] p-2">
    <input aria-label="Topic title" className={`${inputClass} min-w-0`} defaultValue={topic.title} onBlur={(event) => event.target.value.trim() && event.target.value !== topic.title && onChange({ title: event.target.value.trim() })} />
    <select aria-label="Topic status" className={inputClass} value={topic.status} onChange={(event) => onChange({ status: event.target.value as StudyTopic['status'] })}>
      {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
    </select>
    <label className="relative">
      <Clock3 className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input aria-label="Estimated minutes" className={`${inputClass} pl-6`} type="number" min="0" value={topic.minutes} onChange={(event) => onChange({ minutes: Number(event.target.value) || 0 })} />
    </label>
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" disabled={index === 0} onClick={() => onMove(topic.unitId, index, -1)} className="p-1 text-neutral-400 hover:text-teal-400 disabled:opacity-30" title="Move topic up"><ChevronUp className="w-4 h-4" /></button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(topic.unitId, index, 1)} className="p-1 text-neutral-400 hover:text-teal-400 disabled:opacity-30" title="Move topic down"><ChevronDown className="w-4 h-4" /></button>
      <button type="button" onClick={onDelete} className="p-1 text-neutral-400 hover:text-rose-400" title="Delete topic"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  </div>
);
