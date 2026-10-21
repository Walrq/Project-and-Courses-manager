import React, { useState, useEffect } from 'react';
import { bugRepo } from '../db/repos/bugRepo';
import { partRepo } from '../db/repos/partRepo';
import { devLogRepo } from '../db/repos/devLogRepo';
import type { Bug } from '../db/schema';
import { Bug as BugIcon, Plus, CheckCircle2, AlertCircle, Copy, Check, Play, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface BugsSectionProps {
  projectId: number;
}

export const BugsSection: React.FC<BugsSectionProps> = ({ projectId }) => {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);

  // New bug state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [errorText, setErrorText] = useState('');
  const [severity, setSeverity] = useState<Bug['severity']>('medium');

  // Attempt state
  const [attemptOutcome, setAttemptOutcome] = useState<'worked' | 'partly' | 'failed'>('failed');
  const [attemptNote, setAttemptNote] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  const loadBugs = async () => {
    const list = await bugRepo.getByProject(projectId);
    setBugs(list);
  };

  useEffect(() => {
    loadBugs();
  }, [projectId]);

  const handleCreateBug = async () => {
    if (!title.trim()) return;
    await bugRepo.create({
      projectId,
      title: title.trim(),
      description,
      stepsToReproduce,
      errorText,
      severity,
      status: 'open',
    });
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setErrorText('');
    setShowAddModal(false);
    await loadBugs();
  };

  const handleGenerateDebugPrompt = (bug: Bug) => {
    const attemptsList = (bug.attempts || [])
      .map((a, i) => `Attempt ${i + 1} (${a.outcome}): ${a.note || 'No notes'}`)
      .join('\n');

    const prompt = `You are an expert debugger resolving a bug in the project.

# BUG REPORT
Title: ${bug.title}
Severity: ${bug.severity.toUpperCase()}
Description: ${bug.description || 'N/A'}

Steps to Reproduce:
${bug.stepsToReproduce || 'N/A'}

Error / Stack Trace:
\`\`\`
${bug.errorText || 'No error text'}
\`\`\`

# PREVIOUS ATTEMPTS (ALREADY TRIED - DO NOT REPEAT FAILED FIXES)
${attemptsList || 'No previous attempts recorded.'}

Provide:
1. Root cause hypothesis
2. Step-by-step fix with exact code modifications
3. Verification test case to ensure regression prevention`;

    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleAddAttempt = async (bugId: number) => {
    await bugRepo.addAttempt(bugId, {
      outcome: attemptOutcome,
      note: attemptNote.trim(),
    });

    if (attemptOutcome === 'worked') {
      await devLogRepo.logEntry(projectId, `Fixed bug: ${selectedBug?.title}`, 'bug_fixed');
    }

    setAttemptNote('');
    await loadBugs();
    // Update local selected bug
    const updated = await bugRepo.getById(bugId);
    if (updated) setSelectedBug(updated);
  };

  const handleScheduleFixPart = async (bug: Bug) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const partId = await partRepo.create({
      planId: 1,
      orderNo: 999,
      title: `Fix: ${bug.title}`,
      goal: `Resolve bug: ${bug.description || bug.title}`,
      plannedDate: today,
      isRest: 0,
      estMinutes: 45,
      status: 'planned',
      priority: bug.severity === 'critical' ? 'must' : 'should',
    });
    await bugRepo.update(bug.id!, { partId });
    alert(`Created daily part "Fix: ${bug.title}" scheduled for today!`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] flex items-center gap-2">
          <BugIcon className="w-4 h-4 text-rose-400" />
          Bug Tracker ({bugs.filter((b) => b.status !== 'fixed').length} Open)
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-rose-400" />
          Report Bug
        </button>
      </div>

      {showAddModal && (
        <div className="bg-[#0c0d12] border border-white/[0.08] rounded-xl p-4 space-y-3 animate-fade-in text-xs shadow-xl">
          <h4 className="font-semibold text-[#f7f8f8]">Report New Bug</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#8a8f98] mb-1">Title</label>
              <input
                type="text"
                placeholder="Brief bug title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8a8f98] mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#8a8f98] mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="What is happening vs what was expected?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#8a8f98] mb-1">Error / Stack Trace</label>
            <textarea
              rows={2}
              placeholder="Paste error logs or stack trace here..."
              value={errorText}
              onChange={(e) => setErrorText(e.target.value)}
              className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] placeholder-[#626670] font-mono text-[11px] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowAddModal(false)} className="linear-btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreateBug} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-xs shadow-sm transition-all">
              Save Bug
            </button>
          </div>
        </div>
      )}

      {/* Bugs List */}
      <div className="space-y-2.5">
        {bugs.map((bug) => {
          const isFixed = bug.status === 'fixed';
          return (
            <div
              key={bug.id}
              className={`border rounded-xl p-3.5 space-y-3 transition-colors ${
                isFixed ? 'bg-[#0c0d12]/40 border-white/[0.04] opacity-60' : 'bg-[#0c0d12] border-white/[0.08] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold tracking-wider ${
                      bug.severity === 'critical'
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                        : bug.severity === 'high'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                        : 'bg-[#14161f] border border-white/[0.08] text-[#8a8f98]'
                    }`}
                  >
                    {bug.severity}
                  </span>
                  <h4 className={`text-xs font-medium ${isFixed ? 'line-through text-[#626670]' : 'text-[#f7f8f8]'}`}>
                    {bug.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateDebugPrompt(bug)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 rounded-md text-xs transition-colors"
                    title="Generate LLM debug prompt with prior attempts"
                  >
                    <Copy className="w-3 h-3" />
                    Prompt
                  </button>

                  {!isFixed && (
                    <button
                      onClick={() => handleScheduleFixPart(bug)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 rounded-md text-xs transition-colors"
                      title="Schedule a part on today's plan to fix this bug"
                    >
                      <Play className="w-3 h-3" />
                      Schedule Fix
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedBug(selectedBug?.id === bug.id ? null : bug)}
                    className="text-xs text-[#8a8f98] hover:text-[#f7f8f8] px-2 py-1 transition-colors"
                  >
                    {selectedBug?.id === bug.id ? 'Close' : 'Details / Attempts'}
                  </button>
                </div>
              </div>

              {bug.description && <p className="text-xs text-[#8a8f98] leading-relaxed">{bug.description}</p>}

              {/* Bug Details & Attempt Logging */}
              {selectedBug?.id === bug.id && (
                <div className="bg-[#111318] border border-white/[0.06] rounded-xl p-3.5 space-y-3 mt-3 animate-fade-in text-xs">
                  {bug.errorText && (
                    <div>
                      <span className="text-[11px] text-[#8a8f98] font-semibold">Error Text:</span>
                      <pre className="mt-1 p-2 bg-[#08090a] border border-white/[0.08] rounded font-mono text-[11px] text-rose-300/90 overflow-x-auto leading-relaxed">
                        {bug.errorText}
                      </pre>
                    </div>
                  )}

                  {/* Prior attempts */}
                  <div>
                    <span className="text-[11px] text-[#8a8f98] font-semibold">
                      Recorded Attempts ({bug.attempts?.length || 0}):
                    </span>
                    <div className="space-y-1.5 mt-1.5">
                      {(bug.attempts || []).map((att, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-[#d0d3d8] bg-[#0c0d12] border border-white/[0.04] p-2 rounded-lg">
                          <span
                            className={`px-1.5 py-0.5 rounded uppercase font-mono text-[9px] font-semibold ${
                              att.outcome === 'worked'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : att.outcome === 'partly'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {att.outcome}
                          </span>
                          <span>{att.note || 'No notes'}</span>
                          <span className="text-[#626670] ml-auto text-[10px] font-mono">{att.createdAt.split('T')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Log new attempt */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
                    <select
                      value={attemptOutcome}
                      onChange={(e) => setAttemptOutcome(e.target.value as any)}
                      className="bg-[#14161f] border border-white/[0.08] rounded px-2.5 py-1 text-xs text-[#f7f8f8] focus:outline-none focus:border-indigo-500"
                    >
                      <option value="failed">Failed Fix</option>
                      <option value="partly">Partly Worked</option>
                      <option value="worked">Worked & Fixed!</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Notes on what was tried..."
                      value={attemptNote}
                      onChange={(e) => setAttemptNote(e.target.value)}
                      className="flex-1 bg-[#14161f] border border-white/[0.08] rounded px-2.5 py-1 text-xs text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
                    />

                    <button
                      onClick={() => handleAddAttempt(bug.id!)}
                      className="linear-btn-secondary text-xs"
                    >
                      Log Attempt
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {bugs.length === 0 && !showAddModal && (
          <p className="text-xs text-[#626670] text-center py-6">No bugs reported for this project.</p>
        )}
      </div>
    </div>
  );
};
