import React, { useState } from 'react';
import type { Part, RestRule } from '../db/schema';
import { partRepo } from '../db/repos/partRepo';
import { resolveMissedDays, type MissedDayAction } from '../core/missedDays';
import { useUIStore } from '../store/uiStore';
import {
  AlertCircle,
  CalendarDays,
  FastForward,
  Copy,
  Check,
  X,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  missedParts: Part[];
  allParts: Part[];
  todayStr: string;
  projectName: string;
  partsPerDay: number;
  restRule: RestRule;
  deadline?: string | null;
  onResolved?: () => void;
}

export const MissedDayModal: React.FC<Props> = ({
  isOpen,
  onClose,
  missedParts,
  allParts,
  todayStr,
  projectName,
  partsPerDay,
  restRule,
  deadline,
  onResolved,
}) => {
  const { showToast } = useUIStore();
  const [selectedAction, setSelectedAction] = useState<MissedDayAction>('shift');
  const [userFeedback, setUserFeedback] = useState('');
  const [generatedReplanPrompt, setGeneratedReplanPrompt] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen || missedParts.length === 0) return null;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      if (selectedAction === 'replan') {
        const result = resolveMissedDays(
          'replan',
          missedParts,
          allParts,
          todayStr,
          {
            projectName,
            deadline: deadline || undefined,
            userFeedback,
            partsPerDay,
            restRule,
          }
        );
        setGeneratedReplanPrompt(result.replanPrompt || null);
        setIsApplying(false);
        return;
      }

      const result = resolveMissedDays(
        selectedAction,
        missedParts,
        allParts,
        todayStr,
        {
          partsPerDay,
          restRule,
        }
      );

      for (const update of result.updatedParts) {
        if (update.id) {
          await partRepo.update(update.id, {
            ...(update.plannedDate ? { plannedDate: update.plannedDate } : {}),
            ...(update.status ? { status: update.status } : {}),
          });
        }
      }

      const actionNames = {
        shift: 'shifted forward',
        merge: 'merged to today',
        skip: 'marked as skipped',
      };

      showToast(`Missed parts ${actionNames[selectedAction]} successfully!`, 'success');
      onResolved?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error applying resolution: ${msg}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCopyReplanPrompt = async () => {
    if (!generatedReplanPrompt) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(generatedReplanPrompt);
      }
      setCopiedPrompt(true);
      showToast('Re-plan prompt copied! Paste into your AI model.', 'success');
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl bg-[#0c0d12] border border-white/[0.08] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col text-[#f7f8f8]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-[#f7f8f8]">
                Missed-Day Handling ({missedParts.length} parts overdue)
              </h3>
              <p className="text-xs text-[#8a8f98] mt-0.5">
                Life happens! Choose how you would like to adjust the schedule for <strong className="text-[#f7f8f8]">{projectName}</strong>.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#626670] hover:text-[#f7f8f8] p-1 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Missed Parts List Pill Preview */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
          <div className="font-semibold text-amber-300">Overdue parts:</div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono">
            {missedParts.map((p) => (
              <li key={p.id} className="truncate">
                <span className="text-[#8a8f98]">{p.plannedDate}:</span> {p.title}
              </li>
            ))}
          </ul>
        </div>

        {/* Replan Prompt Output View */}
        {generatedReplanPrompt ? (
          <div className="space-y-3 flex-1 overflow-y-auto">
            <div className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">
              Generated Re-Plan Prompt:
            </div>
            <textarea
              readOnly
              rows={8}
              value={generatedReplanPrompt}
              className="w-full p-3 rounded-xl border border-white/[0.08] bg-[#08090a] font-mono text-xs text-indigo-300 leading-relaxed focus:outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setGeneratedReplanPrompt(null)}
                className="text-xs text-[#8a8f98] hover:text-[#f7f8f8] transition-colors"
              >
                &larr; Back to Options
              </button>
              <button
                type="button"
                onClick={handleCopyReplanPrompt}
                className="linear-btn-primary flex items-center gap-1.5"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPrompt ? 'Copied!' : 'Copy Re-Plan Prompt'}
              </button>
            </div>
          </div>
        ) : (
          /* The 4 Options */
          <div className="space-y-2 flex-1 overflow-y-auto">
            {[
              {
                id: 'shift',
                title: '1. Shift Remaining Parts (Recommended)',
                description: 'Push all remaining parts forward by one working day starting today. Preserves your rest day pattern.',
                icon: FastForward,
              },
              {
                id: 'merge',
                title: '2. Merge with Today',
                description: "Move the missed part to today's date so you can catch up alongside today's scheduled work.",
                icon: Layers,
              },
              {
                id: 'skip',
                title: '3. Skip Missed Part(s)',
                description: 'Mark the overdue part as skipped and proceed directly with today’s originally scheduled task.',
                icon: CheckCircle2,
              },
              {
                id: 'replan',
                title: '4. Re-plan with AI',
                description: 'Generate an AI re-plan prompt incorporating your feedback and current remaining deadlines.',
                icon: Sparkles,
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedAction === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedAction(opt.id as any)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                      : 'border-white/[0.08] bg-[#14161f] hover:border-white/[0.15]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isSelected ? 'text-indigo-400' : 'text-[#626670]'
                    }`}
                  />
                  <div>
                    <div
                      className={`text-xs font-medium ${
                        isSelected ? 'text-indigo-300 font-semibold' : 'text-[#f7f8f8]'
                      }`}
                    >
                      {opt.title}
                    </div>
                    <p className="text-[11px] text-[#8a8f98] mt-0.5 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* If Re-plan selected, show feedback field */}
            {selectedAction === 'replan' && (
              <div className="p-3 rounded-xl bg-[#111318] border border-white/[0.08] space-y-1.5 animate-in fade-in">
                <label className="block text-[11px] font-semibold text-[#8a8f98]">
                  Feedback for the AI (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Combine testing into 1 day, keep rest on Sundays"
                  value={userFeedback}
                  onChange={(e) => setUserFeedback(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!generatedReplanPrompt && (
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="linear-btn-secondary"
            >
              Remind Me Later
            </button>
            <button
              type="button"
              disabled={isApplying}
              onClick={handleApply}
              className="linear-btn-primary"
            >
              {selectedAction === 'replan' ? 'Generate Re-Plan Prompt' : 'Apply Resolution'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
