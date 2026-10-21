import React, { useState, useEffect } from 'react';
import { db, type WeeklyReview } from '../db/schema';
import { computeWeeklyStats, type WeeklyStats } from '../core/weeklyStats';
import { parseImportText } from '../core/planImport';
import { memoryRepo } from '../db/repos/memoryRepo';
import {
  CalendarDays,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  FileText,
} from 'lucide-react';

interface WeeklyAdjustment {
  type: 'move_part' | 'change_parts_per_day' | 'add_rest_day' | 'note';
  part_title?: string;
  to_date?: string;
  value?: number;
  date?: string;
  text?: string;
}

interface ParsedWeeklyReply {
  summary: string;
  wins?: string[];
  problems?: string[];
  adjustments?: WeeklyAdjustment[];
}

export const WeeklyReviewPage: React.FC = () => {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [reflection, setReflection] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [llmReply, setLlmReply] = useState('');
  const [parsedReply, setParsedReply] = useState<ParsedWeeklyReply | null>(null);
  const [selectedAdjustments, setSelectedAdjustments] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState(false);
  const [pastReviews, setPastReviews] = useState<WeeklyReview[]>([]);

  const loadData = async () => {
    const [parts, logs, bugs, decisions, devLogs, reviews] = await Promise.all([
      db.parts.filter((p) => !p.deletedAt).toArray(),
      db.timeLogs.toArray(),
      db.bugs.filter((b) => !b.deletedAt).toArray(),
      db.decisions.filter((d) => !d.deletedAt).toArray(),
      db.devLog.toArray(),
      db.weeklyReviews.reverse().toArray(),
    ]);

    const weekly = computeWeeklyStats(parts, logs, bugs, decisions, devLogs);
    setStats(weekly);
    setPastReviews(reviews);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGeneratePrompt = () => {
    if (!stats) return;

    const prompt = `You are an engineering coach conducting a weekly retrospective review.

# WEEK'S FACTS (${stats.weekStart} to ${stats.weekEnd})
- Parts completed: ${stats.partsDone}
- Parts skipped: ${stats.partsSkipped}
- Parts slipped / overdue: ${stats.partsSlipped}
- Total minutes logged: ${stats.minutesLogged}m (Estimated: ${stats.minutesEstimated}m, Ratio: ${stats.accuracyRatio}x)
- Bugs opened: ${stats.bugsOpened}, Fixed: ${stats.bugsFixed}
- Architecture decisions logged: ${stats.decisionsAdded}

# USER REFLECTION
${reflection || 'No specific blockers noted.'}

Reply ONLY with valid JSON in this exact shape:
{
  "summary": "Concise summary of progress and momentum",
  "wins": ["Key accomplishment 1", "Key accomplishment 2"],
  "problems": ["Main friction point or delay"],
  "adjustments": [
    { "type": "change_parts_per_day", "value": 1 },
    { "type": "note", "text": "Focus on high-priority parts first" }
  ]
}`;

    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleParseReply = () => {
    try {
      const parsed = parseImportText(llmReply);
      let data: any = null;
      if (parsed.success && (parsed.data as any).summary) {
        data = parsed.data;
      } else {
        // Direct JSON try
        data = JSON.parse(llmReply.replace(/```(?:json)?/g, '').trim());
      }

      if (data && data.summary) {
        setParsedReply(data);
        const adjIndices = new Set<number>((data.adjustments || []).map((_: any, i: number) => i));
        setSelectedAdjustments(adjIndices);
      } else {
        alert('Could not find valid weekly review JSON with a summary field.');
      }
    } catch {
      alert('Invalid JSON. Please ensure LLM reply contains valid JSON.');
    }
  };

  const handleApplyReview = async () => {
    if (!parsedReply || !stats) return;

    // 1. Save review to db
    await db.weeklyReviews.add({
      projectId: 1,
      weekStart: stats.weekStart,
      statsSnapshot: JSON.stringify(stats),
      responseBody: llmReply,
      acceptedAdjustments: JSON.stringify(
        (parsedReply.adjustments || []).filter((_, i) => selectedAdjustments.has(i))
      ),
      reflection,
      createdAt: new Date().toISOString(),
    });

    // 2. Offer to append summary to rolling memory
    const appendToMemory = confirm('Add review summary to project rolling memory?');
    if (appendToMemory) {
      const current = await memoryRepo.getByProjectId(1);
      const memoryText = `${current?.rollingSummary || ''}\n\n### Weekly Review (${stats.weekStart}):\n${parsedReply.summary}\n**Wins:** ${(parsedReply.wins || []).join(', ')}`;
      await memoryRepo.update(1, memoryText, current?.glossary);
    }

    setApplied(true);
    await loadData();
  };

  if (!stats) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5 tracking-tight">
          <CalendarDays className="w-6 h-6 text-indigo-400" />
          Weekly Review & Plan Calibration
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Review the week's output ({stats.weekStart} to {stats.weekEnd}), reflect, and calibrate with any LLM.
        </p>
      </div>

      {/* Week Facts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Parts Completed</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.partsDone}</div>
          <span className="text-[11px] text-neutral-500">
            {stats.partsSkipped} skipped, {stats.partsSlipped} slipped
          </span>
        </div>

        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Time Focused</span>
          <div className="text-2xl font-bold text-neutral-100 font-mono">{stats.minutesLogged}m</div>
          <span className="text-[11px] text-neutral-500 font-mono">Est: {stats.minutesEstimated}m ({stats.accuracyRatio}x)</span>
        </div>

        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Bugs Resolved</span>
          <div className="text-2xl font-bold text-indigo-400 font-mono">{stats.bugsFixed}</div>
          <span className="text-[11px] text-neutral-500">{stats.bugsOpened} new bugs logged</span>
        </div>

        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Decisions & Notes</span>
          <div className="text-2xl font-bold text-neutral-200 font-mono">{stats.decisionsAdded}</div>
          <span className="text-[11px] text-neutral-500">{stats.notesCount} dev notes written</span>
        </div>
      </div>

      {/* Step 1: User Reflection & Prompt Copy */}
      <div className="linear-card p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">1. Personal Reflection</h3>
        <textarea
          rows={3}
          placeholder="What went well this week? What friction, obstacles, or blockers did you encounter?"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
        />

        <div className="flex justify-end">
          <button
            onClick={handleGeneratePrompt}
            className="linear-btn-primary !text-xs"
          >
            {promptCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {promptCopied ? 'Review Prompt Copied!' : 'Copy Weekly Review Prompt'}
          </button>
        </div>
      </div>

      {/* Step 2: Paste LLM Response & Adjustment Preview */}
      <div className="linear-card p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">2. Paste AI Review Response</h3>
        <textarea
          rows={5}
          placeholder="Paste the JSON response from your LLM here..."
          value={llmReply}
          onChange={(e) => setLlmReply(e.target.value)}
          className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl p-3 text-xs font-mono text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none"
        />

        <div className="flex justify-between items-center">
          <button
            onClick={handleParseReply}
            disabled={!llmReply.trim()}
            className="linear-btn-secondary !text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Parse Adjustments
          </button>
        </div>

        {/* Parsed Preview */}
        {parsedReply && (
          <div className="linear-surface border border-white/[0.08] rounded-xl p-4 space-y-3 animate-in fade-in text-xs">
            <div>
              <span className="font-medium text-neutral-200">Executive Summary:</span>
              <p className="text-neutral-400 mt-1 leading-relaxed">{parsedReply.summary}</p>
            </div>

            {parsedReply.wins && parsedReply.wins.length > 0 && (
              <div>
                <span className="font-medium text-emerald-400">Key Wins:</span>
                <ul className="list-disc list-inside text-neutral-300 mt-0.5 space-y-0.5">
                  {parsedReply.wins.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReply.adjustments && parsedReply.adjustments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <span className="font-medium text-indigo-400">Proposed Adjustments:</span>
                <div className="space-y-1.5">
                  {parsedReply.adjustments.map((adj, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={selectedAdjustments.has(i)}
                        onChange={(e) => {
                          const next = new Set(selectedAdjustments);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          setSelectedAdjustments(next);
                        }}
                        className="rounded border-white/[0.2] bg-white/[0.05] text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-mono text-indigo-300 text-[11px]">[{adj.type}]</span>
                      <span className="text-neutral-300">{adj.text || adj.part_title || `${adj.value} parts/day`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 flex justify-end">
              <button
                onClick={handleApplyReview}
                disabled={applied}
                className="linear-btn-primary !text-xs shadow-linear-glow"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {applied ? 'Review Saved & Applied!' : 'Accept & Save Review'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Past Reviews History */}
      {pastReviews.length > 0 && (
        <div className="linear-card p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            Past Reviews History ({pastReviews.length})
          </h3>
          <div className="divide-y divide-white/[0.04] text-xs">
            {pastReviews.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-medium text-neutral-200">Week of {r.weekStart}</span>
                  <span className="text-neutral-500 ml-2 font-mono text-[11px]">Recorded {r.createdAt.split('T')[0]}</span>
                </div>
                <span className="text-neutral-500 font-mono text-[10px] uppercase font-bold">Saved</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
