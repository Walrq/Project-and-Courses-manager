import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Trash2 } from 'lucide-react';
import { db } from '../db/schema';
import { studyRepo } from '../db/repos/studyRepo';
import { useUIStore } from '../store/uiStore';
import type { StudyResponseHistory } from '../db/schema';

const input = 'w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#14161f] text-neutral-900 dark:text-[#f7f8f8] focus:outline-none focus:border-teal-500';
export const StudyHistoryPage: React.FC = () => {
  const { showToast } = useUIStore();
  const location = useLocation();
  const [mode, setMode] = useState<'project' | 'study'>(location.pathname === '/study/history' ? 'study' : 'project');
  const projectHistory = useLiveQuery(async () => {
    const [responses, prompts, projects, reviews] = await Promise.all([db.responses.toArray(), db.prompts.toArray(), db.projects.toArray(), db.weeklyReviews.toArray()]);
    const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const promptEntries = responses.map((response) => {
      const prompt = promptById.get(response.promptId);
      const project = prompt ? projectById.get(prompt.projectId) : undefined;
      return prompt && project ? { id: `response-${response.id}`, source: 'response' as const, kind: prompt.kind.replaceAll('_', ' '), context: prompt.body, projectName: project.name, body: response.body, verdict: response.verdict, createdAt: response.createdAt, recordId: response.id } : null;
    }).filter((entry) => entry !== null);
    const reviewEntries = reviews.filter((review) => review.responseBody).map((review) => ({
      id: `review-${review.id}`,
      source: 'weeklyReview' as const,
      kind: 'weekly review',
      context: `Weekly review for ${review.weekStart}${review.reflection ? `\n\nYour reflection:\n${review.reflection}` : ''}`,
      projectName: projectById.get(review.projectId)?.name || 'Project',
      body: review.responseBody || '',
      verdict: 'saved',
      createdAt: review.createdAt,
      recordId: review.id,
    }));
    return [...promptEntries, ...reviewEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []) || [];
  const items = useLiveQuery(() => studyRepo.getItems(), []) || [];
  const activeItems = items.filter((item) => item.id !== undefined);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const item = activeItems.find((entry) => entry.id === chosenId) || activeItems[0];
  const itemId = item?.id;
  const entries = useLiveQuery(() => itemId ? studyRepo.getStudyResponses(itemId) : [], [itemId]) || [];
  const [filter, setFilter] = useState<StudyResponseHistory['kind'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draftKind, setDraftKind] = useState<StudyResponseHistory['kind']>('other');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const visible = entries.filter((entry) => (filter === 'all' || entry.kind === filter) && (!query.trim() || `${entry.title} ${entry.prompt || ''} ${entry.response}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard', 'success'); } catch (error) { showToast(`Could not copy: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const remove = async (entry: StudyResponseHistory) => { if (!entry.id || !window.confirm('Delete this saved prompt result?')) return; await studyRepo.deleteStudyResponse(entry.id); showToast('History entry deleted', 'info'); };
  const save = async () => { if (!itemId || !draftResponse.trim()) return; try { await studyRepo.saveStudyResponse({ itemId, kind: draftKind, title: draftTitle.trim() || `${draftKind.replace('_', ' ')} result`, prompt: draftPrompt.trim() || undefined, response: draftResponse.trim() }); setDraftTitle(''); setDraftPrompt(''); setDraftResponse(''); showToast('Prompt result saved', 'success'); } catch (error) { showToast(`Could not save result: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };

  return <div className="space-y-5 animate-in fade-in duration-200">
    <div className="flex flex-wrap justify-between items-end gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-teal-500">Prompt &amp; Response History</div><h1 className="text-2xl font-semibold mt-1">Prompt history</h1><p className="text-xs text-neutral-500 mt-1">Find and reuse prompt replies saved from Projects and Study.</p></div>{mode === 'study' ? <Link to="/study/today" className="linear-btn-secondary">Study Today</Link> : <Link to="/today" className="linear-btn-secondary">Project Today</Link>}</div>
    <div className="flex gap-2"><button type="button" onClick={() => setMode('project')} className={`linear-btn-secondary ${mode === 'project' ? '!border-teal-500 !text-teal-400' : ''}`}>Project responses ({projectHistory.length})</button><button type="button" onClick={() => setMode('study')} className={`linear-btn-secondary ${mode === 'study' ? '!border-teal-500 !text-teal-400' : ''}`}>Study results</button></div>
    {mode === 'project' ? <>
      {!projectHistory.length ? <section className="linear-card p-8 text-center text-xs text-neutral-500">Project replies you save in Project Today, import as a plan, or apply in Weekly Review will appear here.</section> : projectHistory.map((entry) => <article key={entry.id} className="linear-card p-4 space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-medium capitalize">{entry.kind} · {entry.projectName}</div><div className="text-[10px] text-neutral-500 mt-1 capitalize">{entry.verdict.replace('_', ' ')} · {new Date(entry.createdAt).toLocaleString()}</div></div><div className="flex gap-1"><button type="button" className="p-2 text-neutral-400 hover:text-teal-400" title="Copy result" onClick={() => void copy(entry.body)}><Copy className="w-3.5 h-3.5" /></button><button type="button" className="p-2 text-neutral-400 hover:text-rose-400" title="Delete saved response" onClick={async () => { if (!window.confirm('Delete this saved project response?')) return; if (entry.source === 'response') await db.responses.delete(entry.recordId!); else await db.weeklyReviews.delete(entry.recordId!); showToast('Project response deleted', 'info'); }}><Trash2 className="w-3.5 h-3.5" /></button></div></div><details><summary className="cursor-pointer text-[11px] text-teal-400">Show prompt or response context <button type="button" className="ml-2 underline" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void copy(entry.context); }}>Copy context</button></summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-neutral-50 dark:bg-white/[0.03] p-3 text-[11px] text-neutral-500">{entry.context}</pre></details><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-50 dark:bg-white/[0.03] p-3 text-xs">{entry.body}</pre></article>)}
    </> : !activeItems.length ? <section className="linear-card p-6 text-center text-xs">Create a study item to start saving results. <Link to="/study" className="text-teal-400">Open Study</Link></section> : <>
      <section className="linear-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-2"><select className={input} aria-label="Study item" value={item?.id} onChange={(event) => setChosenId(Number(event.target.value))}>{activeItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.archived ? ' (archived)' : ''}</option>)}</select><select className={input} aria-label="Filter by result type" value={filter} onChange={(event) => setFilter(event.target.value as StudyResponseHistory['kind'] | 'all')}><option value="all">All result types</option>{(['plan', 'learn', 'practice', 'doubt', 'memory', 'flashcards', 'quiz', 'cheat_sheet', 'weekly_review', 'other'] as const).map((kind) => <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>)}</select><input className={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved results" /></section>
      <section className="linear-card p-4 space-y-2"><h2 className="text-xs font-semibold">Save a prompt result</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><select className={input} value={draftKind} onChange={(event) => setDraftKind(event.target.value as StudyResponseHistory['kind'])}>{(['plan', 'learn', 'practice', 'doubt', 'memory', 'flashcards', 'quiz', 'cheat_sheet', 'weekly_review', 'other'] as const).map((kind) => <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>)}</select><input className={input} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Optional title" /></div><textarea className={input} rows={2} value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} placeholder="Optional original prompt" /><textarea className={input} rows={4} value={draftResponse} onChange={(event) => setDraftResponse(event.target.value)} placeholder="Paste the result returned by your AI tool" /><button type="button" disabled={!draftResponse.trim()} className="linear-btn-primary !bg-teal-600 disabled:opacity-40" onClick={() => void save()}>Save result</button></section>
      {!visible.length ? <section className="linear-card p-8 text-center text-xs text-neutral-500">No saved results match. New prompt replies will appear here automatically when imported.</section> : visible.map((entry) => <article key={entry.id} className="linear-card p-4 space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-medium">{entry.title}</div><div className="text-[10px] text-neutral-500 mt-1 capitalize">{entry.kind.replace('_', ' ')} · {new Date(entry.createdAt).toLocaleString()}</div></div><div className="flex gap-1"><button type="button" className="p-2 text-neutral-400 hover:text-teal-400" title="Copy result" onClick={() => void copy(entry.response)}><Copy className="w-3.5 h-3.5" /></button><button type="button" className="p-2 text-neutral-400 hover:text-rose-400" title="Delete history entry" onClick={() => void remove(entry)}><Trash2 className="w-3.5 h-3.5" /></button></div></div>{entry.prompt && <details><summary className="cursor-pointer text-[11px] text-teal-400">Show original prompt <button type="button" className="ml-2 underline" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void copy(entry.prompt || ''); }}>Copy prompt</button></summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-neutral-50 dark:bg-white/[0.03] p-3 text-[11px] text-neutral-500">{entry.prompt}</pre></details>}<pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-50 dark:bg-white/[0.03] p-3 text-xs">{entry.response}</pre></article>)}
    </>}
  </div>;
};
