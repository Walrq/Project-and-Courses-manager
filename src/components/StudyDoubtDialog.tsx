import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { StudyItem, StudyMemory, StudyTopic } from '../db/schema';
import { studyRepo } from '../db/repos/studyRepo';
import { buildDoubtPrompt } from '../core/studyPrompts';
import { useUIStore } from '../store/uiStore';

export const StudyDoubtDialog: React.FC<{ item: StudyItem; topic: StudyTopic; unitName: string; memory?: StudyMemory; onClose: () => void }> = ({ item, topic, unitName, memory, onClose }) => {
  const { showToast } = useUIStore();
  const [doubt, setDoubt] = useState('');
  const [answer, setAnswer] = useState('');
  const copy = async () => {
    if (!doubt.trim()) return showToast('Write your doubt first', 'info');
    try { await navigator.clipboard.writeText(buildDoubtPrompt(item, topic, unitName, memory, doubt.trim())); showToast('Doubt prompt copied', 'success'); }
    catch (error) { showToast(`Could not copy: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  };
  const save = async () => {
    const note = `Doubt: ${doubt.trim()}\nAnswer: ${answer.trim()}`;
    try {
      await studyRepo.updateTopic(topic.id!, { notes: [topic.notes?.trim(), note].filter(Boolean).join('\n\n') });
      await studyRepo.saveStudyResponse({ itemId: item.id!, topicId: topic.id, kind: 'doubt', title: `Doubt · ${topic.title}`, prompt: buildDoubtPrompt(item, topic, unitName, memory, doubt.trim()), response: answer.trim() });
      onClose(); showToast('Answer saved to topic notes and prompt history', 'success');
    } catch (error) { showToast(`Could not save answer: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  };
  return <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="doubt-title" className="linear-card w-full max-w-xl p-5 space-y-3">
      <header className="flex justify-between items-center"><h2 id="doubt-title" className="font-semibold">Ask about {topic.title}</h2><button type="button" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button></header>
      <p className="text-xs text-neutral-500">Write the doubt, copy the prompt into your AI tool, then paste its answer here.</p>
      <textarea className="study-textarea" value={doubt} onChange={(e) => setDoubt(e.target.value)} placeholder="What is confusing?" rows={3} />
      <button type="button" className="linear-btn-secondary" onClick={copy}><Copy className="w-3.5 h-3.5" /> Copy doubt prompt</button>
      <textarea className="study-textarea" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Paste the explanation here" rows={4} />
      <div className="flex justify-end"><button type="button" disabled={!doubt.trim() || !answer.trim()} className="linear-btn-primary !bg-teal-600 disabled:opacity-50" onClick={() => void save()}>Save answer to topic</button></div>
    </section>
  </div>;
};
