import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectRepo } from '../db/repos/projectRepo';
import { sectionRepo } from '../db/repos/sectionRepo';
import { planRepo } from '../db/repos/planRepo';
import { useUIStore } from '../store/uiStore';
import { STARTER_PROJECT_TEMPLATES, type StarterProjectTemplate } from '../core/starterTemplates';
import { X, ArrowRight, ArrowLeft, Check, Sparkles, FolderPlus, LayoutTemplate } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (projectId: number) => void;
}

export const NewProjectModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const navigate = useNavigate();
  const { showToast, setActiveProjectId } = useUIStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [constraints, setConstraints] = useState('');
  const [aiRules, setAiRules] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (mode: 'manual' | 'breakdown_prompt' | 'template') => {
    if (!name.trim()) {
      showToast('Project name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let chosenTemplate: StarterProjectTemplate | undefined;
      if (mode === 'template' && selectedTemplateId) {
        chosenTemplate = STARTER_PROJECT_TEMPLATES.find((t) => t.id === selectedTemplateId);
      }

      const projectId = await projectRepo.create({
        name: name.trim(),
        description: description.trim() || chosenTemplate?.description,
        goal: goal.trim() || chosenTemplate?.goal,
        constraints: constraints.trim() || chosenTemplate?.constraints,
        aiRules: aiRules.trim() || chosenTemplate?.aiRules || 'Follow idiomatic patterns, keep code clean and modular.',
        status: 'active',
      });

      // Ensure plan exists
      await planRepo.ensureForProject(projectId);

      // If starter template chosen, add prefilled sections
      if (mode === 'template' && chosenTemplate) {
        for (let i = 0; i < chosenTemplate.sections.length; i++) {
          const s = chosenTemplate.sections[i];
          await sectionRepo.create({
            projectId,
            parentId: null,
            title: s.title,
            description: s.description,
            status: 'not_started',
            priority: s.priority,
            orderNo: i + 1,
          });
        }
      }

      setActiveProjectId(projectId);
      showToast(`Project '${name}' created successfully!`, 'success');
      onCreated?.(projectId);
      onClose();

      if (mode === 'breakdown_prompt') {
        navigate(`/project/${projectId}?tab=prompts&create=breakdown`);
      } else {
        navigate(`/project/${projectId}?tab=sections`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to create project: ${msg}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0c0d12] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#f7f8f8]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#08090a]/80">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[#f7f8f8]">New Project Wizard</h2>
            <p className="text-xs text-[#8a8f98] mt-0.5">
              Step {step} of 3: {step === 1 ? 'Core Info' : step === 2 ? 'AI Context & Rules' : 'Sections & Planning'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#626670] hover:text-[#f7f8f8] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-1.5">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., My Indie Game, AI Engine, Learning Plan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief 1-2 sentence overview of what you are building..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-1.5">
                  Target Goal
                </label>
                <input
                  type="text"
                  placeholder="e.g., Ship working v1 desktop app, pass peer review"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-1.5">
                  Constraints & Tech Stack
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., React 18, Vite, TypeScript, Tailwind, Dexie IndexedDB, offline-only..."
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
                <p className="text-[11px] text-[#626670] mt-1">
                  Included in every LLM prompt so the AI respects your architecture and limitations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-1.5">
                  AI Rules & Tone
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Prefer simple readable code over clever abstractions. No network calls, no telemetry, no unused variables."
                  value={aiRules}
                  onChange={(e) => setAiRules(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                />
                <p className="text-[11px] text-[#626670] mt-1">
                  Enforced in all generated prompts.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#f7f8f8]">
                How would you like to set up your project sections?
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId(null)}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    selectedTemplateId === null
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                      : 'border-white/[0.08] bg-[#14161f] hover:border-white/[0.15]'
                  }`}
                >
                  <FolderPlus className="w-5 h-5 text-indigo-400 mb-2" />
                  <span className="font-semibold text-xs text-[#f7f8f8]">Create by Hand</span>
                  <span className="text-[11px] text-[#8a8f98] mt-1 leading-relaxed">
                    Start with a blank canvas and add sections yourself.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCreate('breakdown_prompt')}
                  className="flex flex-col items-start p-4 rounded-xl border border-white/[0.08] bg-[#14161f] hover:border-indigo-500/50 hover:bg-indigo-500/10 text-left transition-all group"
                >
                  <Sparkles className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 mb-2 transition-colors" />
                  <span className="font-semibold text-xs text-[#f7f8f8]">AI Breakdown</span>
                  <span className="text-[11px] text-[#8a8f98] mt-1 leading-relaxed">
                    Generate a prompt for any LLM to split this into 5-15 sections.
                  </span>
                </button>

                <div className="flex flex-col p-4 rounded-xl border border-white/[0.08] bg-[#14161f]">
                  <LayoutTemplate className="w-5 h-5 text-amber-400 mb-2" />
                  <span className="font-semibold text-xs text-[#f7f8f8]">From Template</span>
                  <span className="text-[11px] text-[#8a8f98] mt-1 leading-relaxed">
                    Select a curated starter archetype below.
                  </span>
                </div>
              </div>

              {/* Archetype selector */}
              <div className="mt-4">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8a8f98] mb-2">
                  Or select a pre-structured template:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {STARTER_PROJECT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(tmpl.id);
                        if (!name) setName(tmpl.name);
                        if (!description) setDescription(tmpl.description);
                        if (!goal) setGoal(tmpl.goal);
                        if (!constraints) setConstraints(tmpl.constraints);
                        if (!aiRules) setAiRules(tmpl.aiRules);
                      }}
                      className={`p-3 rounded-lg border text-left text-xs transition-all flex items-start gap-2.5 ${
                        selectedTemplateId === tmpl.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-white/[0.08] bg-[#14161f] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-[#f7f8f8]">{tmpl.name}</div>
                        <div className="text-[#8a8f98] line-clamp-1 mt-0.5 text-[11px] font-mono">{tmpl.sections.length} sections prefilled</div>
                      </div>
                      {selectedTemplateId === tmpl.id && (
                        <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#08090a]/80">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="linear-btn-secondary flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="linear-btn-secondary"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep((s) => (s + 1) as any)}
                className="linear-btn-primary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || !name.trim()}
                onClick={() => handleCreate(selectedTemplateId ? 'template' : 'manual')}
                className="linear-btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectedTemplateId ? 'Create with Template' : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
