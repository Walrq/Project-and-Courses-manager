import React, { useState } from 'react';
import { db } from '../db/schema';
import { sectionRepo } from '../db/repos/sectionRepo';
import { partRepo } from '../db/repos/partRepo';
import {
  parseImportText,
  autoFixJSONString,
  type ImportedBreakdown,
  type ImportedPlan,
  type ImportedPartItem,
  type ImportedSectionItem,
} from '../core/planImport';
import { useUIStore } from '../store/uiStore';
import { X, Check, AlertCircle, Wrench, FileJson, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  planId?: number;
  onImportComplete?: () => void;
}

export const PlanImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  planId,
  onImportComplete,
}) => {
  const { showToast } = useUIStore();

  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState<string[] | null>(null);
  const [previewData, setPreviewData] = useState<
    | { type: 'breakdown'; sections: ImportedSectionItem[] }
    | { type: 'plan'; parts: ImportedPartItem[] }
    | null
  >(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleParse = (textToParse: string = rawText) => {
    setParseError(null);
    const result = parseImportText(textToParse);
    if (!result.success) {
      setParseError(result.errors);
      setPreviewData(null);
    } else {
      if (result.type === 'breakdown') {
        setPreviewData({ type: 'breakdown', sections: result.data.sections });
      } else {
        setPreviewData({ type: 'plan', parts: result.data.parts });
      }
    }
  };

  const handleAutoFix = () => {
    const fixed = autoFixJSONString(rawText);
    setRawText(fixed);
    handleParse(fixed);
    showToast('Applied auto-fix for smart quotes and trailing commas.', 'info');
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    setIsImporting(true);

    try {
      if (previewData.type === 'breakdown') {
        // Import sections
        await db.transaction('rw', [db.sections, db.sectionDeps], async () => {
          const currentSections = await sectionRepo.getByProject(projectId);
          let startOrder = currentSections.length + 1;

          for (const s of previewData.sections) {
            await sectionRepo.create({
              projectId,
              parentId: null,
              title: s.title,
              description: s.description || '',
              status: 'not_started',
              priority: 2,
              orderNo: startOrder++,
            });
          }
        });

        showToast(`Imported ${previewData.sections.length} project sections!`, 'success');
      } else if (previewData.type === 'plan' && planId) {
        // Import parts
        await db.transaction('rw', [db.sections, db.parts, db.partSteps], async () => {
          const existingSections = await sectionRepo.getByProject(projectId);
          const currentParts = await partRepo.getByPlan(planId);
          let startOrder = currentParts.length + 1;

          for (const p of previewData.parts) {
            // Find or create section
            let sectionId: number | null = null;
            if (p.section) {
              const matched = existingSections.find(
                (s) => s.title.toLowerCase() === p.section?.toLowerCase()
              );
              if (matched && matched.id) {
                sectionId = matched.id;
              } else {
                sectionId = await sectionRepo.create({
                  projectId,
                  parentId: null,
                  title: p.section,
                  description: 'Auto-created from AI plan import',
                  status: 'not_started',
                  priority: 2,
                  orderNo: existingSections.length + 1,
                });
                existingSections.push({
                  id: sectionId,
                  projectId,
                  title: p.section,
                  priority: 2,
                  orderNo: existingSections.length + 1,
                  status: 'not_started',
                });
              }
            }

            if (p.rest) {
              await partRepo.create({
                planId,
                sectionId: null,
                orderNo: startOrder++,
                title: 'Rest & Recovery Day',
                goal: 'Rest, recharge, and review progress',
                plannedDate: new Date().toISOString().split('T')[0],
                isRest: 1,
                status: 'planned',
              });
            } else {
              await partRepo.create(
                {
                  planId,
                  sectionId,
                  orderNo: startOrder++,
                  title: p.title || `Day ${p.day || startOrder} Part`,
                  goal: p.goal || '',
                  plannedDate: new Date().toISOString().split('T')[0],
                  isRest: 0,
                  estMinutes: p.est_minutes || 60,
                  status: 'planned',
                },
                p.steps || []
              );
            }
          }
        });

        showToast(`Imported ${previewData.parts.length} daily parts!`, 'success');
      }

      onImportComplete?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Import failed: ${msg}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-indigo-400" /> Paste AI Response (Sections or Parts)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Paste the JSON generated by ChatGPT, Claude, or Gemini. Code fences and conversational text are stripped automatically.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Textarea & Controls */}
        {!previewData ? (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <textarea
              rows={12}
              placeholder="Paste raw LLM response here (including markdown ```json ... ``` code fences)..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full flex-1 p-3.5 text-xs font-mono rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-[#f7f8f8] placeholder-neutral-500 leading-relaxed resize-none focus:outline-none focus:border-indigo-500/50"
            />

            {parseError && (
              <div className="p-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/20 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> JSON Validation Error:
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {parseError.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleAutoFix}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg inline-flex items-center gap-1 shadow-sm mt-1"
                >
                  <Wrench className="w-3.5 h-3.5" /> Auto-Fix Trailing Commas & Quotes
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleAutoFix}
                className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5 text-indigo-400" /> Run Auto-Fix
              </button>

              <button
                type="button"
                disabled={!rawText.trim()}
                onClick={() => handleParse()}
                className="linear-btn-primary !text-xs"
              >
                Parse & Preview <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Preview Table */
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Preview ({previewData.type === 'breakdown' ? `${previewData.sections.length} Sections` : `${previewData.parts.length} Daily Parts`})
              </span>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Edit raw text
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-white/[0.06] rounded-xl bg-[#0a0b0f]">
              {previewData.type === 'breakdown' ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-neutral-400 font-mono text-[11px] border-b border-white/[0.06]">
                    <tr>
                      <th className="p-2.5 font-medium">#</th>
                      <th className="p-2.5 font-medium">Section Title</th>
                      <th className="p-2.5 font-medium">Description</th>
                      <th className="p-2.5 font-medium">Dependencies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {previewData.sections.map((s, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 font-mono text-neutral-500">{i + 1}</td>
                        <td className="p-2.5 font-medium text-neutral-100">{s.title}</td>
                        <td className="p-2.5 text-neutral-400">{s.description || '—'}</td>
                        <td className="p-2.5 text-neutral-500 font-mono">{s.depends_on?.join(', ') || 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-neutral-400 font-mono text-[11px] border-b border-white/[0.06]">
                    <tr>
                      <th className="p-2.5 font-medium">Day</th>
                      <th className="p-2.5 font-medium">Section</th>
                      <th className="p-2.5 font-medium">Part Title</th>
                      <th className="p-2.5 font-medium">Goal</th>
                      <th className="p-2.5 font-medium">Steps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {previewData.parts.map((p, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 font-mono text-indigo-400 font-medium">
                          {p.rest ? 'REST' : `Day ${p.day || i + 1}`}
                        </td>
                        <td className="p-2.5 text-neutral-400">{p.section || 'General'}</td>
                        <td className="p-2.5 font-medium text-neutral-100">
                          {p.title || (p.rest ? 'Rest Day' : 'Work Part')}
                        </td>
                        <td className="p-2.5 text-neutral-400 line-clamp-1">{p.goal || '—'}</td>
                        <td className="p-2.5 text-neutral-500 font-mono">{p.steps?.length || 0} steps</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="linear-btn-secondary !text-xs"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleConfirmImport}
                className="linear-btn-primary !text-xs shadow-linear-glow"
              >
                <Check className="w-4 h-4 text-emerald-400" /> Confirm & Import into Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
