import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { templateRepo } from '../db/repos/templateRepo';
import { useUIStore } from '../store/uiStore';
import { interpolateTemplateVariables } from '../core/promptBuilder';
import {
  RotateCcw,
  Save,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const TemplatesPage: React.FC = () => {
  const { showToast } = useUIStore();
  const templates = useLiveQuery(() => db.templates.toArray(), []) || [];

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [editedBody, setEditedBody] = useState<string>('');
  const [editedName, setEditedName] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditedBody((prev) => prev + varName);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const next = before + varName + after;
    setEditedBody(next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length, start + varName.length);
    }, 0);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  React.useEffect(() => {
    if (selectedTemplate) {
      if (!selectedTemplateId) setSelectedTemplateId(selectedTemplate.id!);
      setEditedBody(selectedTemplate.body);
      setEditedName(selectedTemplate.name);
    }
  }, [selectedTemplate, selectedTemplateId]);

  const handleSave = async () => {
    if (!selectedTemplate?.id) return;
    await templateRepo.update(selectedTemplate.id, {
      name: editedName.trim(),
      body: editedBody,
    });
    showToast(`Template '${editedName}' saved!`, 'success');
  };

  const handleReset = async () => {
    if (!selectedTemplate?.id) return;
    if (confirm(`Reset template '${selectedTemplate.name}' back to system default?`)) {
      await templateRepo.resetToDefault(selectedTemplate.id);
      showToast('Template reset to default.', 'info');
    }
  };

  // Variable validation
  const variableCheck = React.useMemo(() => {
    if (!editedBody) return { unknownVariables: [] };
    const knownVars: Record<string, string> = {
      project_name: 'test',
      project_description: 'test',
      project_goal: 'test',
      project_constraints: 'test',
      section_title: 'test',
      sections_list: 'test',
      part_title: 'test',
      part_goal: 'test',
      steps: 'test',
      steps_done: 'test',
      steps_remaining: 'test',
      memory: 'test',
      rolling_summary: 'test',
      decisions: 'test',
      today: 'test',
      start_date: 'test',
      deadline: 'test',
      hours_per_day: 'test',
      previous_prompt: 'test',
      previous_response: 'test',
      last_response_summary: 'test',
      accepted_response: 'test',
      user_feedback: 'test',
      error_text: 'test',
      input_text: 'test',
      current_plan_summary: 'test',
      remaining_parts_list: 'test',
      ROLE: 'test',
      PROJECT: 'test',
      RULES: 'test',
      MEMORY: 'test',
      DECISIONS: 'test',
      PLAN_POSITION: 'test',
      RELATED: 'test',
      TASK: 'test',
      OUTPUT_FORMAT: 'test',
      END_INSTRUCTION: 'test',
    };
    return interpolateTemplateVariables(editedBody, knownVars);
  }, [editedBody]);

  const variableReference = [
    { name: '{{project_name}}', desc: 'Active project name' },
    { name: '{{project_description}}', desc: 'Project overview' },
    { name: '{{project_goal}}', desc: 'Target project outcome' },
    { name: '{{part_title}}', desc: 'Current scheduled part title' },
    { name: '{{part_goal}}', desc: 'Goal for today\'s part' },
    { name: '{{steps}}', desc: 'Checklist of part steps' },
    { name: '{{rolling_summary}}', desc: 'Project rolling memory' },
    { name: '{{decisions}}', desc: 'Bullet list of active decisions' },
    { name: '{{hours_per_day}}', desc: 'Plan hours per day limit' },
    { name: '{{deadline}}', desc: 'Project target deadline' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
          Prompt Templates
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Customize prompt wording and output structures used across the app.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Templates List Sidebar (4 cols) */}
        <div className="lg:col-span-4 linear-card p-2 space-y-1 max-h-[75vh] overflow-y-auto">
          {templates.map((tmpl) => {
            const isSelected = tmpl.id === selectedTemplateId;
            return (
              <button
                key={tmpl.id}
                onClick={() => {
                  setSelectedTemplateId(tmpl.id!);
                  setEditedBody(tmpl.body);
                  setEditedName(tmpl.name);
                }}
                className={`w-full p-2.5 rounded-lg text-left transition-all flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-white/[0.08] text-neutral-100 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div>
                  <div className="text-xs">{tmpl.name}</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5 font-mono">
                    {tmpl.kind} {tmpl.isDefault === 1 ? '• Default' : '• Custom'}
                  </div>
                </div>

                {tmpl.isDefault === 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">
                    Edited
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Template Editor Area (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedTemplate ? (
            <div className="linear-card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="font-semibold text-sm bg-transparent border-b border-white/[0.08] focus:outline-none focus:border-indigo-500/50 pb-1 text-neutral-100"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="linear-btn-secondary !text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Default
                  </button>

                  <button
                    onClick={handleSave}
                    className="linear-btn-primary !text-xs shadow-linear-glow"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </div>

              {/* Unknown variables notice */}
              {variableCheck.unknownVariables.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Unknown variables detected (will remain verbatim):{' '}
                    <strong className="font-mono text-amber-200">
                      {variableCheck.unknownVariables.map((v) => `{{${v}}}`).join(', ')}
                    </strong>
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Template Body
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    Click any variable chip below to insert at cursor
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  rows={14}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="w-full p-4 rounded-xl border border-white/[0.08] bg-[#0a0b0f] font-mono text-xs text-[#f7f8f8] placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none"
                />
              </div>

              {/* Variable Reference Panel */}
              <div className="linear-surface p-4 rounded-xl border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-200">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" /> Click to Insert Variable
                  </div>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    + inserts into editor
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {variableReference.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => handleInsertVariable(v.name)}
                      className="flex items-center justify-between p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/40 text-left transition-colors group"
                      title={`Click to insert ${v.name}`}
                    >
                      <code className="text-indigo-400 font-mono text-xs group-hover:text-indigo-300">
                        {v.name}
                      </code>
                      <span className="text-neutral-500 truncate max-w-[150px] text-[10px]">
                        {v.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-neutral-500 text-xs">No template selected.</div>
          )}
        </div>
      </div>
    </div>
  );
};
