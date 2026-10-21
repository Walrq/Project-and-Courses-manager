import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, GraduationCap, Plus, ArrowRight, Trash2, X } from 'lucide-react';
import { studyRepo } from '../db/repos/studyRepo';
import { useUIStore } from '../store/uiStore';
import type { StudyItem } from '../db/schema';

const inputClass = 'w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#14161f] text-neutral-900 dark:text-[#f7f8f8] placeholder-neutral-400 dark:placeholder-[#626670] focus:outline-none focus:border-teal-500';

export const StudyPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const items = useLiveQuery(() => studyRepo.getItems(), []) || [];
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<StudyItem['type']>('course');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('1');
  const [platform, setPlatform] = useState('');
  const [instructor, setInstructor] = useState('');
  const [url, setUrl] = useState('');
  const [totalLessons, setTotalLessons] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [targetFinishDate, setTargetFinishDate] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [examDate, setExamDate] = useState('');
  const [targetScore, setTargetScore] = useState('');
  const [weakAreas, setWeakAreas] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName(''); setGoal(''); setLevel(''); setHoursPerDay('1'); setPlatform(''); setInstructor('');
    setUrl(''); setTotalLessons(''); setTotalHours(''); setTargetFinishDate(''); setSyllabus('');
    setExamDate(''); setTargetScore(''); setWeakAreas('');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await studyRepo.createItem({
        type, name: name.trim(), goal: goal.trim(), level: level.trim(),
        hoursPerDay: Number(hoursPerDay) || 1,
        ...(type === 'course' ? {
          platform: platform.trim(), instructor: instructor.trim(), url: url.trim(),
          totalLessons: totalLessons ? Number(totalLessons) : undefined,
          totalHours: totalHours ? Number(totalHours) : undefined,
          targetFinishDate: targetFinishDate || undefined,
        } : {
          syllabus: syllabus.trim(), examDate: examDate || undefined,
          targetScore: targetScore.trim(), weakAreas: weakAreas.trim(),
        }),
      });
      showToast(`${type === 'course' ? 'Course' : 'Subject'} created`, 'success');
      resetForm();
      navigate(`/study/${id}`);
    } catch (error) {
      showToast(`Could not create study item: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, itemName: string) => {
    if (!window.confirm(`Delete "${itemName}" and its study data?`)) return;
    try {
      await studyRepo.deleteItem(id);
      showToast('Study item deleted', 'info');
    } catch (error) {
      showToast(`Could not delete study item: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-500">Study Module</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Your courses and subjects</h1>
          <p className="text-xs text-neutral-500 dark:text-[#8a8f98] mt-1">Build a syllabus outline, then work through it at your pace.</p>
        </div>
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="linear-btn-primary !bg-gradient-to-b !from-teal-500 !to-teal-600">
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Close' : 'New Study Item'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2"><Link to="/study/today" className="linear-btn-secondary inline-flex">Open Study Today <ArrowRight className="w-3.5 h-3.5" /></Link><Link to="/study/history" className="linear-btn-secondary inline-flex">Prompt History</Link></div>

      {showCreate && (
        <form onSubmit={handleCreate} className="linear-card p-5 sm:p-6 space-y-4 border-teal-500/20">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm">Create a study item</h2>
            <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08]">
              {(['course', 'subject'] as const).map((choice) => (
                <button key={choice} type="button" onClick={() => setType(choice)} className={`px-3 py-1.5 text-xs rounded-md capitalize ${type === choice ? 'bg-teal-500 text-white' : 'text-neutral-500 dark:text-[#8a8f98]'}`}>
                  {choice}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={type === 'course' ? 'Course name' : 'Subject name'} required><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'course' ? 'e.g. React Fundamentals' : 'e.g. Biology'} required autoFocus /></Field>
            <Field label="Goal"><input className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={type === 'course' ? 'Skill, certificate, or curiosity' : 'Exam readiness or target outcome'} /></Field>
            <Field label="Your current level"><input className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Beginner, intermediate..." /></Field>
            <Field label="Hours per day"><input className={inputClass} type="number" min="0.25" step="0.25" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} /></Field>
            {type === 'course' ? <>
              <Field label="Platform"><input className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="YouTube, Coursera..." /></Field>
              <Field label="Instructor"><input className={inputClass} value={instructor} onChange={(e) => setInstructor(e.target.value)} /></Field>
              <Field label="Course link"><input className={inputClass} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></Field>
              <Field label="Total lessons"><input className={inputClass} type="number" min="0" value={totalLessons} onChange={(e) => setTotalLessons(e.target.value)} /></Field>
              <Field label="Total hours"><input className={inputClass} type="number" min="0" step="0.5" value={totalHours} onChange={(e) => setTotalHours(e.target.value)} /></Field>
              <Field label="Target finish date"><input className={inputClass} type="date" value={targetFinishDate} onChange={(e) => setTargetFinishDate(e.target.value)} /></Field>
            </> : <>
              <Field label="Exam date"><input className={inputClass} type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} /></Field>
              <Field label="Target score"><input className={inputClass} value={targetScore} onChange={(e) => setTargetScore(e.target.value)} placeholder="e.g. 85%" /></Field>
              <Field label="Known weak areas"><input className={inputClass} value={weakAreas} onChange={(e) => setWeakAreas(e.target.value)} placeholder="Topics you want to focus on" /></Field>
              <Field label="Syllabus or textbook list"><textarea className={`${inputClass} min-h-20 resize-y`} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} placeholder="Paste the syllabus or list your textbooks" /></Field>
            </>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowCreate(false)} className="linear-btn-secondary">Cancel</button>
            <button disabled={saving || !name.trim()} className="linear-btn-primary !bg-gradient-to-b !from-teal-500 !to-teal-600 disabled:opacity-50">{saving ? 'Creating...' : 'Create & Add Units'}</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="linear-card p-10 text-center border-dashed">
          <BookOpen className="w-9 h-9 mx-auto text-teal-400 mb-3" />
          <h2 className="text-sm font-semibold">Nothing here yet</h2>
          <p className="text-xs text-neutral-500 dark:text-[#8a8f98] mt-1">Create a course or subject to start building its units and topics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.filter((item) => item.archived === 0).map((item) => (
            <div key={item.id} className="linear-card-hover p-4 flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                {item.type === 'course' ? <BookOpen className="w-4 h-4 text-teal-400" /> : <GraduationCap className="w-4 h-4 text-teal-400" />}
              </div>
              <Link to={`/study/${item.id}`} className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate group-hover:text-teal-400">{item.name}</div>
                <div className="text-[11px] text-neutral-500 dark:text-[#8a8f98] capitalize mt-0.5">{item.type}{item.goal ? ` · ${item.goal}` : ''}</div>
              </Link>
              <button type="button" onClick={() => item.id && handleDelete(item.id, item.name)} className="p-2 text-neutral-400 hover:text-rose-400 rounded-lg" title="Delete study item">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <Link to={`/study/${item.id}`} className="text-teal-400 p-1" aria-label={`Open ${item.name}`}><ArrowRight className="w-4 h-4" /></Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block space-y-1">
    <span className="block text-[11px] font-medium text-neutral-500 dark:text-[#8a8f98]">{label}{required && <span className="text-rose-400"> *</span>}</span>
    {children}
  </label>
);
