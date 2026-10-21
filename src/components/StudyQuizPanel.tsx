import React, { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Play, Timer } from 'lucide-react';
import type { StudyItem, StudyMemory, StudyTopic, StudyUnit } from '../db/schema';
import { studyRepo } from '../db/repos/studyRepo';
import { parseStudyQuizImport, type StudyQuizQuestion } from '../core/studyQuizImport';
import { studyMemoryBlock } from '../core/studyPrompts';
import { useUIStore } from '../store/uiStore';

type AttemptSummary = { score: number; total: number; wrongQuestions: Array<{ question: string; answer: string; correctAnswer: string; explanation: string; topicId?: number }>; mode: string };
const input = 'w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#14161f] text-neutral-900 dark:text-[#f7f8f8] focus:outline-none focus:border-teal-500';
const ratingsLabel = (attempt: Record<string, unknown>) => `${Number(attempt.score) || 0}/${Number(attempt.total) || 0}`;

export const StudyQuizPanel: React.FC<{ item: StudyItem; topics: StudyTopic[]; units: StudyUnit[]; memory?: StudyMemory }> = ({ item, topics, units, memory }) => {
  const { showToast } = useUIStore();
  const itemId = item.id!;
  const quiz = useLiveQuery(() => studyRepo.getQuiz(itemId), [itemId]);
  const [json, setJson] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [unitId, setUnitId] = useState<number | ''>('');
  const [mockCount, setMockCount] = useState('10');
  const [mockMinutes, setMockMinutes] = useState('30');
  const [active, setActive] = useState<{ questions: StudyQuizQuestion[]; mock: boolean } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [completed, setCompleted] = useState<AttemptSummary | null>(null);
  const questions = active?.questions || [];
  const current = questions[questionIndex];
  const unitTopics = unitId === '' ? [] : topics.filter((topic) => topic.unitId === unitId);
  const topicIds = new Set(unitTopics.map((topic) => topic.id));
  const mockQuestions = (quiz?.questions || []).filter((question) => typeof question.question === 'string' && typeof question.answerIndex === 'number' && Array.isArray(question.options) && (unitId === '' || topicIds.has(Number(question.topicId)))) as unknown as StudyQuizQuestion[];

  const finish = useCallback(async () => {
    if (!active || finishing) return;
    setFinishing(true);
    const results = active.questions.map((question, index) => ({ topicId: question.topicId, correct: answers[index] === question.answerIndex }));
    const score = results.filter((result) => result.correct).length;
    const wrongQuestions = active.questions.flatMap((question, index) => results[index].correct ? [] : [{
      question: question.question,
      answer: question.options[answers[index]] ?? 'Not answered',
      correctAnswer: question.options[question.answerIndex],
      explanation: question.explanation || '',
      topicId: question.topicId,
    }]);
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const summary: AttemptSummary = { score, total: active.questions.length, wrongQuestions, mode: active.mock ? 'mock test' : 'quiz' };
    try {
      await studyRepo.saveQuizAttempt(itemId, {
        score, total: active.questions.length, durationSeconds, mode: summary.mode,
        attemptedAt: new Date().toISOString(), questionResults: results, wrongQuestions,
      });
      setCompleted(summary);
      setActive(null);
      showToast(`${summary.mode === 'mock test' ? 'Mock test' : 'Quiz'} saved: ${score}/${active.questions.length}`, 'success');
    } catch (error) {
      showToast(`Could not save quiz attempt: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally { setFinishing(false); }
  }, [active, answers, finishing, itemId, showToast, startedAt]);
  useEffect(() => {
    if (!active?.mock) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => {
      if (value <= 1) {
        window.clearInterval(timer);
        window.setTimeout(() => { void finish(); }, 0);
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [active, finish]);

  const importJson = async () => {
    const parsed = parseStudyQuizImport(json);
    if (!parsed.success) { if (json.trim()) await studyRepo.saveStudyResponse({ itemId, kind: 'quiz', title: `Unparsed quiz reply · ${new Date().toLocaleString()}`, response: json.trim() }); setErrors(parsed.errors); return; }
    const topicSet = new Set(topics.map((topic) => topic.id));
    if (parsed.data.some((question) => question.topicId !== undefined && !topicSet.has(question.topicId))) { setErrors(['A question refers to a topic outside this study item.']); return; }
    try {
      await studyRepo.importQuizQuestions(itemId, parsed.data);
      await studyRepo.saveStudyResponse({ itemId, kind: 'quiz', title: `Imported quiz questions · ${new Date().toLocaleString()}`, response: json.trim() });
      setJson(''); setErrors([]); showToast(`Imported ${parsed.data.length} questions`, 'success');
    } catch (error) { setErrors([error instanceof Error ? error.message : String(error)]); }
  };
  const start = (items: StudyQuizQuestion[], mock: boolean) => {
    if (!items.length) return showToast('No matching questions available. Import quiz JSON first.', 'info');
    const count = mock ? Math.max(1, Math.min(100, Number(mockCount) || 10)) : items.length;
    const shuffled = mock ? [...items].sort(() => Math.random() - 0.5) : [...items];
    const selected = mock ? shuffled.slice(0, count) : shuffled;
    setCompleted(null); setAnswers({}); setQuestionIndex(0); setChecked(false); setFinishing(false);
    setStartedAt(Date.now()); setSecondsLeft(mock ? Math.max(1, Number(mockMinutes) || 30) * 60 : 0);
    setActive({ questions: selected, mock });
  };
  const analysisPrompt = completed?.wrongQuestions.length ? `${studyMemoryBlock(memory)}\nAnalyze my ${completed.mode} mistakes in ${item.name}. My score was ${completed.score}/${completed.total}. For each mistake, explain why my answer was wrong, show the reasoning for the correct answer, and suggest one thing to review.\n${completed.wrongQuestions.map((wrong, index) => `${index + 1}. Question: ${wrong.question}\nMy answer: ${wrong.answer}\nCorrect answer: ${wrong.correctAnswer}\nExisting explanation: ${wrong.explanation || 'None'}\nTopic: ${topics.find((topic) => topic.id === wrong.topicId)?.title || 'Unassigned'}`).join('\n\n')}` : '';
  const copyAnalysis = async () => { try { await navigator.clipboard.writeText(analysisPrompt); showToast('Test analysis prompt copied', 'success'); } catch (error) { showToast(`Could not copy prompt: ${error instanceof Error ? error.message : String(error)}`, 'error'); } };
  const attempts = quiz?.attempts || [];
  const recentAttempts = attempts.slice(-8);
  const maxScore = Math.max(1, ...recentAttempts.map((attempt) => Number(attempt.total) || 0));

  return <section className="linear-card p-4 sm:p-5 space-y-4 border-teal-500/10">
    <div><h2 className="text-sm font-semibold">Quizzes and mock tests</h2><p className="text-[11px] text-neutral-500 mt-1">Import JSON questions, answer one at a time, and review saved scores.</p></div>
    {!active && <>
      <div className="space-y-2"><label className="block text-[11px] text-neutral-500">Quiz JSON <span className="text-neutral-400">[{`{ question, options, answerIndex, explanation, topicId }`}]</span><textarea className={`${input} mt-1 font-mono resize-y`} rows={4} value={json} onChange={(event) => { setJson(event.target.value); setErrors([]); }} placeholder={'[{"question":"...","options":["A","B"],"answerIndex":0,"explanation":"...","topicId":1}]'} /></label>{errors.map((error) => <p key={error} role="alert" className="text-[11px] text-rose-400">{error}</p>)}{errors.length > 0 && <button type="button" className="text-[11px] text-teal-400 underline" onClick={() => void navigator.clipboard.writeText(`${studyMemoryBlock(memory)}\nRepair this quiz JSON and return only a valid JSON array. Each question must have question, options (at least two strings), answerIndex (zero-based and within options), optional explanation, and optional topicId.\n\n${json}`)}>Copy JSON repair prompt</button>}<button type="button" disabled={!json.trim()} className="linear-btn-secondary disabled:opacity-40" onClick={() => void importJson()}>Import quiz questions</button><span className="ml-2 text-[11px] text-neutral-500">{quiz?.questions.length || 0} saved questions</span></div>
      <div className="rounded-lg border border-neutral-200 dark:border-white/[0.08] p-3 space-y-2"><h3 className="text-xs font-semibold">Quiz player</h3><button type="button" disabled={!quiz?.questions.length} onClick={() => start((quiz?.questions || []) as unknown as StudyQuizQuestion[], false)} className="linear-btn-primary !bg-teal-600 disabled:opacity-40"><Play className="w-3.5 h-3.5" /> Start quiz</button></div>
      {item.type === 'subject' && <div className="rounded-lg border border-neutral-200 dark:border-white/[0.08] p-3 space-y-2"><h3 className="text-xs font-semibold">Mock test</h3><div className="flex flex-wrap gap-2 items-center"><select className={`${input} !w-auto`} value={unitId} onChange={(event) => setUnitId(event.target.value ? Number(event.target.value) : '')}><option value="">All units</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select><label className="text-[11px] text-neutral-500">Questions <input className={`${input} !w-20 inline-block`} type="number" min="1" max="100" value={mockCount} onChange={(event) => setMockCount(event.target.value)} /></label><label className="text-[11px] text-neutral-500">Minutes <input className={`${input} !w-20 inline-block`} type="number" min="1" max="240" value={mockMinutes} onChange={(event) => setMockMinutes(event.target.value)} /></label><button type="button" disabled={!mockQuestions.length} onClick={() => start(mockQuestions, true)} className="linear-btn-secondary disabled:opacity-40"><Timer className="w-3.5 h-3.5" /> Start mock</button><span className="text-[10px] text-neutral-500">{mockQuestions.length} matching questions</span></div></div>}
    </>}
    {active && current && <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.03] p-4 space-y-3"><div className="flex justify-between text-[11px] text-neutral-500"><span>{active.mock ? 'Mock test' : 'Quiz'} · {questionIndex + 1} of {questions.length}</span>{active.mock && <span className="font-mono">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>}</div><h3 className="text-sm font-medium">{current.question}</h3><div className="space-y-2">{current.options.map((option, index) => <button key={`${index}-${option}`} type="button" disabled={checked || (active.mock && secondsLeft === 0)} onClick={() => setAnswers((existing) => ({ ...existing, [questionIndex]: index }))} className={`block w-full text-left p-2 rounded-lg border text-xs ${answers[questionIndex] === index ? 'border-teal-500 bg-teal-500/10' : 'border-neutral-200 dark:border-white/[0.08]'} disabled:opacity-75`}>{option}</button>)}</div>{checked && <div className={`text-xs p-2 rounded-lg ${answers[questionIndex] === current.answerIndex ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>{answers[questionIndex] === current.answerIndex ? 'Correct.' : `Not quite. Correct answer: ${current.options[current.answerIndex]}`}{current.explanation && <p className="mt-1 text-neutral-300">{current.explanation}</p>}</div>}<div className="flex justify-end gap-2">{!checked ? <button type="button" disabled={answers[questionIndex] === undefined || (active.mock && secondsLeft === 0)} className="linear-btn-primary !bg-teal-600 disabled:opacity-40" onClick={() => setChecked(true)}>Check answer</button> : <button type="button" disabled={finishing} className="linear-btn-primary !bg-teal-600 disabled:opacity-40" onClick={() => { if (questionIndex === questions.length - 1) void finish(); else { setQuestionIndex((index) => index + 1); setChecked(false); } }}>{questionIndex === questions.length - 1 ? 'Finish and save' : 'Next question'}</button>}</div></div>}
    {completed && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-2"><div className="text-sm font-semibold">{completed.mode === 'mock test' ? 'Mock test' : 'Quiz'} result: {completed.score}/{completed.total} ({Math.round(completed.score / Math.max(1, completed.total) * 100)}%)</div><p className="text-[11px] text-neutral-500">Attempt saved. Repeated low scores for a topic are flagged in study memory as a weak spot.</p>{analysisPrompt && <button type="button" className="linear-btn-secondary" onClick={() => void copyAnalysis()}><Copy className="w-3.5 h-3.5" /> Copy test analysis prompt</button>}</div>}
    {recentAttempts.length > 0 && <div className="space-y-2"><h3 className="text-xs font-semibold">Score history</h3><div className="flex items-end gap-2 h-24 border-b border-neutral-200 dark:border-white/[0.08] pb-1">{recentAttempts.map((attempt, index) => { const total = Number(attempt.total) || 0; const score = Number(attempt.score) || 0; return <div key={`${String(attempt.attemptedAt)}-${index}`} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${ratingsLabel(attempt)} · ${String(attempt.mode || 'quiz')}`}><span className="text-[9px] text-neutral-500">{score}/{total}</span><div className="w-full max-w-8 rounded-t bg-teal-500" style={{ height: `${Math.max(4, score / Math.max(1, maxScore) * 70)}%` }} /><span className="text-[8px] text-neutral-400">{index + 1}</span></div>; })}</div><div className="space-y-1 max-h-32 overflow-y-auto">{[...attempts].reverse().slice(0, 10).map((attempt, index) => <div key={`${String(attempt.attemptedAt)}-${index}`} className="flex justify-between text-[10px] text-neutral-500"><span>{String(attempt.mode || 'quiz')} · {attempt.attemptedAt ? new Date(String(attempt.attemptedAt)).toLocaleString() : 'Saved attempt'}</span><span>{ratingsLabel(attempt)} · {Math.round((Number(attempt.durationSeconds) || 0) / 60)}m</span></div>)}</div></div>}
  </section>;
};
