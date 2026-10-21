import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { db, type Section, type Part, type RestRule, type Link } from '../db/schema';
import { projectRepo } from '../db/repos/projectRepo';
import { sectionRepo } from '../db/repos/sectionRepo';
import { planRepo } from '../db/repos/planRepo';
import { partRepo } from '../db/repos/partRepo';
import { memoryRepo } from '../db/repos/memoryRepo';
import { decisionRepo } from '../db/repos/decisionRepo';
import { linkRepo } from '../db/repos/linkRepo';
import { scheduleParts, rescheduleParts, computeSlack, formatLocalDate } from '../core/scheduler';
import { checkSectionDependencies, isPartScheduledBeforeDependencies } from '../core/dependencies';
import { useUIStore } from '../store/uiStore';
import { SortablePartItem } from '../components/SortablePartItem';
import { PromptModal } from '../components/PromptModal';
import { PlanImportModal } from '../components/PlanImportModal';
import { WalkthroughImportModal } from '../components/WalkthroughImportModal';
import { RepoContextModal } from '../components/RepoContextModal';
import { BugsSection } from '../components/BugsSection';
import { TagPicker } from '../components/TagPicker';
import {
  FolderGit2,
  Calendar,
  Layers,
  BrainCircuit,
  History,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  Split,
  Coffee,
  FileJson,
  Lock,
  X,
  Pencil,
  RefreshCw,
  Link2,
  ExternalLink,
  FileText,
  Copy,
  Bug,
  FolderTree,
} from 'lucide-react';
import { YoutubeIcon } from '../components/YoutubeIcon';

export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, setActiveProjectId } = useUIStore();

  const projectId = Number(id);
  const activeTab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  // Live queries
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const sections = useLiveQuery(() => db.sections.where({ projectId }).sortBy('orderNo'), [projectId]) || [];
  const sectionDeps = useLiveQuery(() => db.sectionDeps.toArray()) || [];
  const plan = useLiveQuery(() => db.plans.where({ projectId }).first(), [projectId]);
  const parts = useLiveQuery(async () => {
    if (!plan?.id) return [];
    return db.parts.where({ planId: plan.id }).sortBy('orderNo');
  }, [plan?.id]) || [];
  const memory = useLiveQuery(() => db.memory.get(projectId), [projectId]);
  const memoryHistory = useLiveQuery(() => memoryRepo.getHistory(projectId), [projectId]) || [];
  const decisions = useLiveQuery(() => db.decisions.where({ projectId }).sortBy('createdAt'), [projectId]) || [];
  const prompts = useLiveQuery(() => db.prompts.where({ projectId }).reverse().sortBy('createdAt'), [projectId]) || [];
  const links = useLiveQuery(() => db.links.where({ projectId }).toArray(), [projectId]) || [];

  // Links state
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const [linkPastedText, setLinkPastedText] = useState('');

  // Overview form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [constraints, setConstraints] = useState('');
  const [aiRules, setAiRules] = useState('');

  // Sections tab state
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');
  const [newSectionPriority, setNewSectionPriority] = useState<1 | 2 | 3>(2);
  const [newSectionDepIds, setNewSectionDepIds] = useState<number[]>([]);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [sectionsViewMode, setSectionsViewMode] = useState<'list' | 'kanban'>('list');

  // Edit Section state
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState('');
  const [editSectionDesc, setEditSectionDesc] = useState('');
  const [editSectionPriority, setEditSectionPriority] = useState<1 | 2 | 3>(2);
  const [editSectionStatus, setEditSectionStatus] = useState<'not_started' | 'in_progress' | 'review' | 'done'>('not_started');
  const [editSectionDepIds, setEditSectionDepIds] = useState<number[]>([]);

  // Plan tab settings form state
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [planStartDate, setPlanStartDate] = useState('');
  const [planDeadline, setPlanDeadline] = useState('');
  const [planPartsPerDay, setPlanPartsPerDay] = useState(1);
  const [planHoursPerDay, setPlanHoursPerDay] = useState(2);
  const [planRestType, setPlanRestType] = useState<'every_n' | 'weekdays' | 'custom'>('every_n');
  const [planRestEveryN, setPlanRestEveryN] = useState(7);
  const [planRestWeekdays, setPlanRestWeekdays] = useState<number[]>([0]); // Sunday
  const [planDifficultyRamp, setPlanDifficultyRamp] = useState<'none' | 'linear' | 'steep'>('none');

  // Add Part state
  const [newPartTitle, setNewPartTitle] = useState('');
  const [newPartGoal, setNewPartGoal] = useState('');
  const [newPartSectionId, setNewPartSectionId] = useState<number | null>(null);
  const [newPartEstMinutes, setNewPartEstMinutes] = useState(60);
  const [newPartSteps, setNewPartSteps] = useState('');
  const [newPartDate, setNewPartDate] = useState(formatLocalDate(new Date()));
  const [isAddingPart, setIsAddingPart] = useState(false);

  // Split section into parts modal state
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitSectionId, setSplitSectionId] = useState<number | null>(null);
  const [splitPartCount, setSplitPartCount] = useState<number>(3);
  const [splitBaseTitle, setSplitBaseTitle] = useState<string>('');

  // Revise plan state
  const [isRevisePlanModalOpen, setIsRevisePlanModalOpen] = useState(false);
  const [revisePlanFeedback, setRevisePlanFeedback] = useState('');

  // Memory & Decisions states
  const [rollingSummary, setRollingSummary] = useState('');
  const [glossary, setGlossary] = useState('');
  const [newDecisionText, setNewDecisionText] = useState('');
  const [newDecisionReason, setNewDecisionReason] = useState('');
  const [showMemoryHistory, setShowMemoryHistory] = useState(false);

  // AI Prompt & Import Modals
  const [promptModalData, setPromptModalData] = useState<{
    title: string;
    description: string;
    promptText: string;
  } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isWalkthroughModalOpen, setIsWalkthroughModalOpen] = useState(false);
  const [isRepoContextOpen, setIsRepoContextOpen] = useState(false);

  const handleOpenBreakdownPrompt = () => {
    if (!project) return;
    const promptText = `You are a project planner.
Using the PROJECT block below, split the project into 5 to 15 logical, sequential sections.

# PROJECT
Name: ${project.name}
Description: ${project.description || ''}
Goal: ${project.goal || ''}
Constraints: ${project.constraints || ''}
AI Rules: ${project.aiRules || ''}

Reply ONLY with JSON in this exact shape:
{
  "sections": [
    {
      "title": "Architecture & Setup",
      "description": "Establish the foundational repository and core primitives",
      "depends_on": []
    }
  ]
}`;
    setPromptModalData({
      title: 'AI Project Breakdown Prompt',
      description: 'Copy this prompt into ChatGPT, Claude, or Gemini to split your project idea into modules/sections.',
      promptText,
    });
  };

  const handleOpenPlanPrompt = () => {
    if (!project || !plan) return;
    const sectionsList = sections.length > 0
      ? sections.map((s, idx) => `${idx + 1}. ${s.title}: ${s.description || ''}`).join('\n')
      : '1. Foundation & Architecture\n2. Core Features\n3. Polish & Release';

    const promptText = `You are a technical project manager.
Break each section into daily, focused parts. Each part must fit in ${plan.hoursPerDay} hours of focused work.
Start date is ${plan.startDate}.

# PROJECT
Name: ${project.name}
Description: ${project.description || ''}
Goal: ${project.goal || ''}
Constraints: ${project.constraints || ''}

# SECTIONS
${sectionsList}

Reply ONLY with JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "section": "${sections[0]?.title || 'Setup'}",
      "title": "Initialize Repository and Tooling",
      "goal": "Have build scripts, linting, and basic entry points running",
      "est_minutes": 90,
      "steps": [
        "Initialize project directory",
        "Configure linter and compiler",
        "Verify hello-world test passes"
      ]
    },
    {
      "day": 2,
      "rest": true
    }
  ]
}`;

    setPromptModalData({
      title: 'AI Daily Plan Generation Prompt',
      description: 'Copy this prompt into any AI model to break your modules/sections into daily parts.',
      promptText,
    });
  };

  const handleOpenEditSection = async (sec: Section) => {
    setEditingSection(sec);
    setEditSectionTitle(sec.title);
    setEditSectionDesc(sec.description || '');
    setEditSectionPriority(sec.priority);
    setEditSectionStatus(sec.status);
    if (sec.id) {
      const deps = await sectionRepo.getDependencies(sec.id);
      setEditSectionDepIds(deps);
    } else {
      setEditSectionDepIds([]);
    }
  };

  const handleSaveEditSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection?.id || !editSectionTitle.trim()) return;
    await sectionRepo.update(editingSection.id, {
      title: editSectionTitle.trim(),
      description: editSectionDesc.trim(),
      priority: editSectionPriority,
      status: editSectionStatus,
    });
    await sectionRepo.setDependencies(editingSection.id, editSectionDepIds);
    setEditingSection(null);
    showToast('Section updated successfully!', 'success');
  };

  const handleGenerateRevisePlanPrompt = () => {
    if (!project || !plan) return;
    const partsSummary = parts
      .map((p, idx) => `Day ${idx + 1}: ${p.title} (${p.status}, est: ${p.estMinutes || 60}m)`)
      .join('\n');
    const sectionsSummary = sections
      .map((s, idx) => `${idx + 1}. ${s.title} (${s.status})`)
      .join('\n');
    const planSummary = `Project: ${project.name}\nSections:\n${sectionsSummary}\n\nCurrent Parts:\n${partsSummary}`;

    const promptText = `Revise the current project plan based on this feedback:
Feedback: ${revisePlanFeedback.trim()}

# CURRENT PLAN SUMMARY
${planSummary}

Reply ONLY with valid JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "section": "${sections[0]?.title || 'Architecture'}",
      "title": "Refined part title",
      "goal": "Part deliverable goal",
      "est_minutes": 60,
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`;

    setIsRevisePlanModalOpen(false);
    setRevisePlanFeedback('');
    setPromptModalData({
      title: 'AI Plan Revision Prompt',
      description:
        'Copy this prompt into your LLM to revise the schedule based on your feedback. Then paste the result using "Paste AI Plan".',
      promptText,
    });
  };

  const handleOpenAddLink = () => {
    setEditingLink(null);
    setLinkTitle('');
    setLinkUrl('');
    setLinkNote('');
    setLinkPastedText('');
    setIsAddingLink(true);
  };

  const handleOpenEditLink = (l: Link) => {
    setEditingLink(l);
    setLinkTitle(l.title || '');
    setLinkUrl(l.url || '');
    setLinkNote(l.note || '');
    setLinkPastedText(l.pastedText || '');
    setIsAddingLink(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() && !linkUrl.trim() && !linkPastedText.trim()) return;

    if (editingLink?.id) {
      await linkRepo.update(editingLink.id, {
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        note: linkNote.trim(),
        pastedText: linkPastedText.slice(0, 20000),
      });
      showToast('Reference link updated!', 'success');
    } else {
      await linkRepo.create({
        projectId,
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        note: linkNote.trim(),
        pastedText: linkPastedText.slice(0, 20000),
      });
      showToast('Reference link saved!', 'success');
    }

    setIsAddingLink(false);
    setEditingLink(null);
  };

  const handleDeleteLink = async (linkId: number) => {
    if (confirm('Delete this reference item?')) {
      await linkRepo.delete(linkId);
      showToast('Reference item deleted.', 'info');
    }
  };

  // Sync loaded states
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setGoal(project.goal || '');
      setConstraints(project.constraints || '');
      setAiRules(project.aiRules || '');
    }
  }, [project]);

  useEffect(() => {
    if (plan) {
      setPlanStartDate(plan.startDate);
      setPlanDeadline(plan.deadline || '');
      setPlanPartsPerDay(plan.partsPerDay);
      setPlanHoursPerDay(plan.hoursPerDay);
      setPlanRestType(plan.restRule.type);
      if (plan.restRule.type === 'every_n') {
        setPlanRestEveryN(plan.restRule.n);
      } else if (plan.restRule.type === 'weekdays') {
        setPlanRestWeekdays(plan.restRule.days);
      }
      setPlanDifficultyRamp(plan.difficultyRamp);
    }
  }, [plan]);

  useEffect(() => {
    if (memory) {
      setRollingSummary(memory.rollingSummary || '');
      setGlossary(memory.glossary || '');
    }
  }, [memory]);

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Calculate live slack if deadline is present
  const slackInfo = useMemo(() => {
    if (!plan?.deadline || parts.length === 0) return null;
    const today = formatLocalDate(new Date());
    return computeSlack(
      parts,
      today,
      plan.deadline,
      plan.partsPerDay,
      plan.restRule
    );
  }, [plan, parts]);

  if (!project) {
    return <div className="p-12 text-center text-slate-500">Loading project...</div>;
  }

  // Handlers
  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    await projectRepo.update(projectId, {
      name: name.trim(),
      description: description.trim(),
      goal: goal.trim(),
      constraints: constraints.trim(),
      aiRules: aiRules.trim(),
    });
    showToast('Project details saved!', 'success');
  };

  const handleSavePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan?.id) return;

    let restRule: RestRule = { type: 'every_n', n: 7 };
    if (planRestType === 'every_n') {
      restRule = { type: 'every_n', n: planRestEveryN };
    } else if (planRestType === 'weekdays') {
      restRule = { type: 'weekdays', days: planRestWeekdays };
    } else {
      restRule = { type: 'custom', dates: [] };
    }

    await planRepo.update(plan.id, {
      startDate: planStartDate,
      deadline: planDeadline.trim() || null,
      partsPerDay: planPartsPerDay,
      hoursPerDay: planHoursPerDay,
      restRule,
      difficultyRamp: planDifficultyRamp,
    });

    // Automatically recalculate parts dates with new settings
    if (parts.length > 0) {
      const today = formatLocalDate(new Date());
      const res = rescheduleParts(
        parts,
        planStartDate || today,
        planPartsPerDay,
        restRule
      );
      for (const p of res.parts) {
        if (p.id) {
          await partRepo.update(p.id, { plannedDate: p.plannedDate });
        }
      }
    }

    setShowPlanSettings(false);
    showToast('Plan settings updated and schedule dates recalculated!', 'success');
  };

  // Drag and drop reordering handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;

    const oldIndex = parts.findIndex((p) => p.id === active.id);
    const newIndex = parts.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(parts, oldIndex, newIndex);

    // Re-index order numbers
    const updatedWithOrderNo = reordered.map((part, idx) => ({
      ...part,
      orderNo: idx + 1,
    }));

    // Live date recalculation from plan start date
    const today = formatLocalDate(new Date());
    const res = rescheduleParts(
      updatedWithOrderNo,
      plan.startDate || today,
      plan.partsPerDay || 1,
      plan.restRule || { type: 'every_n', n: 7 }
    );

    // Persist all updated parts
    for (const p of res.parts) {
      if (p.id) {
        await partRepo.update(p.id, {
          orderNo: p.orderNo,
          plannedDate: p.plannedDate,
        });
      }
    }

    showToast('Parts reordered and dates recalculated!', 'success');
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartTitle.trim() || !plan?.id) return;
    const steps = newPartSteps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await partRepo.create(
      {
        planId: plan.id,
        sectionId: newPartSectionId,
        orderNo: parts.length + 1,
        title: newPartTitle.trim(),
        goal: newPartGoal.trim(),
        plannedDate: newPartDate,
        isRest: 0,
        estMinutes: newPartEstMinutes,
        status: 'planned',
      },
      steps
    );

    setNewPartTitle('');
    setNewPartGoal('');
    setNewPartSteps('');
    setIsAddingPart(false);
    showToast('Part added to schedule!', 'success');
  };

  // Split section into parts handler
  const handleSplitSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan?.id || !splitSectionId) return;

    const sec = sections.find((s) => s.id === splitSectionId);
    const titleBase = splitBaseTitle.trim() || sec?.title || 'Part';

    for (let i = 1; i <= splitPartCount; i++) {
      await partRepo.create({
        planId: plan.id,
        sectionId: splitSectionId,
        orderNo: parts.length + i,
        title: `${titleBase} - Part ${i}`,
        goal: `Complete phase ${i} of ${sec?.title || titleBase}`,
        plannedDate: formatLocalDate(new Date()),
        isRest: 0,
        estMinutes: 60,
        status: 'planned',
      });
    }

    // Recalculate dates
    const today = formatLocalDate(new Date());
    const allCurrentParts = await db.parts.where({ planId: plan.id }).sortBy('orderNo');
    const res = rescheduleParts(
      allCurrentParts,
      plan.startDate || today,
      plan.partsPerDay || 1,
      plan.restRule || { type: 'every_n', n: 7 }
    );
    for (const p of res.parts) {
      if (p.id) await partRepo.update(p.id, { plannedDate: p.plannedDate });
    }

    setIsSplitModalOpen(false);
    setSplitBaseTitle('');
    showToast(`Section split into ${splitPartCount} daily parts!`, 'success');
  };

  const handleTogglePartDone = async (part: Part) => {
    if (!part.id) return;
    if (part.status === 'done') {
      await partRepo.update(part.id, { status: 'planned', completedAt: null });
    } else {
      await partRepo.markDone(part.id);
    }
  };

  const handleDeletePart = async (partId: number) => {
    if (confirm('Delete this part?')) {
      await partRepo.deleteCascade(partId);
      showToast('Part deleted.', 'info');
    }
  };

  const handleSaveMemory = async () => {
    await memoryRepo.update(projectId, rollingSummary, glossary);
    showToast('Project rolling memory saved and version archived!', 'success');
  };

  const handleRevertMemory = async (histSummary: string, histGlossary?: string) => {
    setRollingSummary(histSummary);
    if (histGlossary) setGlossary(histGlossary);
    await memoryRepo.update(projectId, histSummary, histGlossary);
    setShowMemoryHistory(false);
    showToast('Reverted memory to selected historical version.', 'info');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FolderGit2 },
    { id: 'sections', label: 'Sections', icon: Layers },
    { id: 'plan', label: 'Daily Plan', icon: Calendar },
    { id: 'bugs', label: 'Bugs', icon: Bug },
    { id: 'links', label: 'Links & Docs', icon: Link2 },
    { id: 'memory', label: 'Memory & Decisions', icon: BrainCircuit },
    { id: 'prompts', label: 'Prompt History', icon: History },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Split Section Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleSplitSection}
            className="w-full max-w-md bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                <Split className="w-4 h-4 text-indigo-400" /> Split Section into Parts
              </h3>
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Select Section
              </label>
              <select
                value={splitSectionId ?? ''}
                onChange={(e) => setSplitSectionId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                required
              >
                <option value="">(Choose section)</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Number of Daily Parts
              </label>
              <input
                type="number"
                min={2}
                max={20}
                value={splitPartCount}
                onChange={(e) => setSplitPartCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Base Part Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Authentication Setup"
                value={splitBaseTitle}
                onChange={(e) => setSplitBaseTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="linear-btn-secondary !text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="linear-btn-primary !text-xs"
              >
                Create {splitPartCount} Parts
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Prompt Modal (Breakdown or Plan) */}
      {promptModalData && (
        <PromptModal
          isOpen={Boolean(promptModalData)}
          onClose={() => setPromptModalData(null)}
          title={promptModalData.title}
          description={promptModalData.description}
          promptText={promptModalData.promptText}
        />
      )}

      {/* AI JSON Import Modal */}
      <PlanImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={projectId}
        planId={plan?.id}
      />

      {/* Walkthrough Import Modal */}
      {isWalkthroughModalOpen && (
        <WalkthroughImportModal
          isOpen={isWalkthroughModalOpen}
          onClose={() => setIsWalkthroughModalOpen(false)}
          projectId={projectId}
        />
      )}

      {/* Repo Context Modal */}
      {isRepoContextOpen && (
        <RepoContextModal
          isOpen={isRepoContextOpen}
          onClose={() => setIsRepoContextOpen(false)}
          projectId={projectId}
        />
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleSaveEditSection}
            className="w-full max-w-md bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" /> Edit Section
              </h3>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={editSectionTitle}
                onChange={(e) => setEditSectionTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={editSectionDesc}
                onChange={(e) => setEditSectionDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Priority
                </label>
                <select
                  value={editSectionPriority}
                  onChange={(e) => setEditSectionPriority(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value={1}>High (1)</option>
                  <option value={2}>Normal (2)</option>
                  <option value={3}>Low (3)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Status
                </label>
                <select
                  value={editSectionStatus}
                  onChange={(e) => setEditSectionStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50 capitalize"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Depends On (Prerequisites)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg border border-white/[0.06] bg-[#0a0b0f]">
                {sections
                  .filter((s) => s.id !== editingSection.id)
                  .map((s) => {
                    const isSelected = editSectionDepIds.includes(s.id!);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditSectionDepIds(editSectionDepIds.filter((id) => id !== s.id));
                          } else {
                            setEditSectionDepIds([...editSectionDepIds, s.id!]);
                          }
                        }}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-medium shadow-xs'
                            : 'bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white hover:border-white/[0.12]'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {s.title}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="linear-btn-secondary !text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="linear-btn-primary !text-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revise Plan Modal */}
      {isRevisePlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400" /> Revise Daily Plan
              </h3>
              <button
                type="button"
                onClick={() => setIsRevisePlanModalOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Provide feedback or instructions on how the schedule should be adjusted (e.g., "Make days 2 and 3 lighter", "Add a buffer day before deployment", "Group frontend parts together").
            </p>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Revision Feedback
              </label>
              <textarea
                rows={4}
                value={revisePlanFeedback}
                onChange={(e) => setRevisePlanFeedback(e.target.value)}
                placeholder="Describe your desired adjustments..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsRevisePlanModalOpen(false)}
                className="linear-btn-secondary !text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateRevisePlanPrompt}
                disabled={!revisePlanFeedback.trim()}
                className="linear-btn-primary !text-xs"
              >
                Generate Revision Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Link Modal */}
      {isAddingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleSaveLink}
            className="w-full max-w-lg bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" />
                {editingLink ? 'Edit Reference Item' : 'Add Reference Link / Document'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddingLink(false);
                  setEditingLink(null);
                }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Title / Reference Name
              </label>
              <input
                type="text"
                placeholder="e.g. API Documentation, Design System, Specs"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Target URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Context / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="Brief summary or context..."
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Pasted Reference Text / Docs (Max 20,000 chars)
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    linkPastedText.length > 19000
                      ? 'text-rose-400 font-bold'
                      : 'text-neutral-500'
                  }`}
                >
                  {linkPastedText.length.toLocaleString()} / 20,000
                </span>
              </div>
              <textarea
                rows={6}
                maxLength={20000}
                placeholder="Paste reference text, markdown specs, schema definitions, or documentation here..."
                value={linkPastedText}
                onChange={(e) => setLinkPastedText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingLink(false);
                  setEditingLink(null);
                }}
                className="linear-btn-secondary !text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="linear-btn-primary !text-xs"
              >
                {editingLink ? 'Update Reference' : 'Save Reference'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {project.name}
            </h1>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border font-mono ${
                project.status === 'active'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-400'
              }`}
            >
              {project.status}
            </span>

            {/* Slack warning badge */}
            {slackInfo && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono border ${
                  slackInfo.isNegative
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
                title={`Working days left: ${slackInfo.workingDaysLeft}, Parts left: ${slackInfo.partsLeft}`}
              >
                {slackInfo.isNegative && <AlertTriangle className="w-3 h-3" />}
                Slack: {slackInfo.slack > 0 ? `+${slackInfo.slack}d` : `${slackInfo.slack}d`}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {project.goal || 'No goal set'} &bull; Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRepoContextOpen(true)}
            className="linear-btn-secondary !text-xs"
            title="Manage project repository files & context for prompt generation"
          >
            <FolderTree className="w-3.5 h-3.5 text-indigo-400" /> Repo Context
          </button>

          <button
            onClick={() => navigate('/today')}
            className="linear-btn-primary !text-xs shadow-linear-glow"
          >
            <Sparkles className="w-3.5 h-3.5" /> Go to Today's Part
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-white/[0.06] overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-indigo-500 text-neutral-100 bg-indigo-500/[0.06]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.id === 'plan' && parts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/[0.06] text-neutral-300">
                  {parts.length}
                </span>
              )}
              {tab.id === 'links' && links.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/[0.06] text-neutral-300">
                  {links.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <form onSubmit={handleSaveOverview} className="space-y-4 max-w-3xl linear-card p-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Primary Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Constraints & Tech Stack
            </label>
            <textarea
              rows={3}
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              AI Rules & Tone (Enforced in LLM prompts)
            </label>
            <textarea
              rows={3}
              value={aiRules}
              onChange={(e) => setAiRules(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Project Tags
            </label>
            <TagPicker entityType="project" entityId={projectId} />
          </div>

          <button
            type="submit"
            className="linear-btn-primary !text-xs"
          >
            <Save className="w-3.5 h-3.5" /> Save Changes
          </button>
        </form>
      )}

      {/* TAB 2: SECTIONS */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Project Sections</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Topics or modules that break this project down into manageable units.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleOpenBreakdownPrompt}
                className="linear-btn-secondary !text-xs"
                title="Generate LLM prompt to split project into 5-15 sections"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Generate Breakdown Prompt
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="linear-btn-secondary !text-xs"
                title="Paste AI response to import sections"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-400" /> Paste AI Breakdown
              </button>

              <button
                onClick={() => setSectionsViewMode(sectionsViewMode === 'list' ? 'kanban' : 'list')}
                className="linear-btn-secondary !text-xs"
              >
                {sectionsViewMode === 'list' ? 'Kanban View' : 'List View'}
              </button>

              <button
                onClick={() => setIsAddingSection(true)}
                className="linear-btn-primary !text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>
          </div>

          {/* Add Section inline form */}
          {isAddingSection && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newSectionTitle.trim()) return;
                const newId = await sectionRepo.create({
                  projectId,
                  parentId: null,
                  title: newSectionTitle.trim(),
                  description: newSectionDesc.trim(),
                  priority: newSectionPriority,
                  status: 'not_started',
                  orderNo: sections.length + 1,
                });
                if (newSectionDepIds.length > 0) {
                  await sectionRepo.setDependencies(newId, newSectionDepIds);
                }
                setNewSectionTitle('');
                setNewSectionDesc('');
                setNewSectionDepIds([]);
                setIsAddingSection(false);
                showToast('Section created!', 'success');
              }}
              className="linear-card p-5 space-y-3 max-w-xl"
            >
              <h3 className="font-semibold text-xs text-neutral-100">New Section</h3>
              <input
                type="text"
                placeholder="Section title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
                required
              />
              <textarea
                rows={2}
                placeholder="Optional description..."
                value={newSectionDesc}
                onChange={(e) => setNewSectionDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />

              {sections.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Depends On (Prerequisites)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg border border-white/[0.06] bg-[#0a0b0f]">
                    {sections.map((s) => {
                      const isSelected = newSectionDepIds.includes(s.id!);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setNewSectionDepIds(newSectionDepIds.filter((id) => id !== s.id));
                            } else {
                              setNewSectionDepIds([...newSectionDepIds, s.id!]);
                            }
                          }}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-medium'
                              : 'bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {s.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="linear-btn-primary !text-xs"
                >
                  Save Section
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSection(false)}
                  className="linear-btn-secondary !text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Sections List */}
          {sectionsViewMode === 'list' && (
            <div className="space-y-2.5">
              {sections.map((s, idx) => {
                const depStatus = checkSectionDependencies(s.id!, sections, sectionDeps);
                const depTitles = sectionDeps
                  .filter((d) => d.sectionId === s.id)
                  .map((d) => sections.find((sec) => sec.id === d.dependsOnId)?.title)
                  .filter(Boolean);

                return (
                  <div
                    key={s.id}
                    className="linear-card-hover p-4 flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-neutral-500">
                          #{idx + 1}
                        </span>
                        <h4 className="font-medium text-xs text-neutral-100">{s.title}</h4>
                        <span className="text-[9px] px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-neutral-400 uppercase tracking-wider font-mono">
                          {s.status.replace('_', ' ')}
                        </span>
                        {depStatus.isBlocked && (
                          <span
                            className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-medium flex items-center gap-1 border border-rose-500/20"
                            title={`Blocked by unfinished: ${depStatus.blockingDependencies.map((b) => b.title).join(', ')}`}
                          >
                            <Lock className="w-2.5 h-2.5" /> Blocked
                          </span>
                        )}
                        {depTitles.length > 0 && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-normal">
                            Depends on: {depTitles.join(', ')}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-xs text-neutral-400 mt-1 ml-5">{s.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEditSection(s)}
                        className="linear-btn-secondary !py-1 !px-2.5 !text-xs"
                        title="Edit section and dependencies"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setSplitSectionId(s.id!);
                          setSplitBaseTitle(s.title);
                          setIsSplitModalOpen(true);
                        }}
                        className="linear-btn-secondary !py-1 !px-2.5 !text-xs"
                      >
                        <Split className="w-3.5 h-3.5 text-indigo-400" /> Split into Parts
                      </button>
                      <button
                        onClick={async () => {
                          if (s.id && confirm('Delete this section?')) {
                            await sectionRepo.deleteCascade(s.id);
                            showToast('Section deleted.', 'info');
                          }
                        }}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                        title="Delete section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kanban View */}
          {sectionsViewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(['not_started', 'in_progress', 'review', 'done'] as const).map((columnStatus) => {
                const columnSections = sections.filter((s) => s.status === columnStatus);
                return (
                  <div
                    key={columnStatus}
                    className="p-3 rounded-xl border border-white/[0.06] bg-[#0c0d12]/60 flex flex-col gap-2"
                  >
                    <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-400 px-1 font-mono">
                      {columnStatus.replace('_', ' ')} ({columnSections.length})
                    </span>
                    <div className="space-y-2 flex-1">
                      {columnSections.map((s) => {
                        const depStatus = checkSectionDependencies(s.id!, sections, sectionDeps);
                        return (
                          <div
                            key={s.id}
                            className="p-3 rounded-lg border border-white/[0.06] bg-[#111318] hover:border-white/[0.12] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="font-medium text-xs text-neutral-100">
                                {s.title}
                              </div>
                              <button
                                onClick={() => handleOpenEditSection(s)}
                                className="text-neutral-500 hover:text-neutral-200"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                            {depStatus.isBlocked && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 font-medium inline-flex items-center gap-0.5 mt-1 border border-rose-500/20">
                                <Lock className="w-2.5 h-2.5" /> Blocked
                              </span>
                            )}
                            {s.description && (
                              <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1">
                                {s.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DAILY PLAN */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          {/* Plan Controls Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Daily Parts Schedule
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Drag any part to reorder. Planned dates recalculate live around rest rules.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Plan Mode Switcher */}
              <div className="flex items-center rounded-lg border border-white/[0.08] p-0.5 bg-[#0a0b0f] text-xs font-mono">
                {(['manual', 'ai', 'hybrid'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={async () => {
                      if (plan?.id) {
                        await planRepo.update(plan.id, { mode });
                        showToast(
                          `Plan mode set to ${
                            mode === 'manual' ? 'Plan by me' : mode === 'ai' ? 'AI Plan' : 'Hybrid'
                          }`,
                          'info'
                        );
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                      (plan?.mode || 'manual') === mode
                        ? 'bg-white/[0.1] text-neutral-100 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {mode === 'manual' ? 'Plan by me' : mode === 'ai' ? 'AI Plan' : 'Hybrid'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleOpenPlanPrompt}
                className="linear-btn-secondary !text-xs"
                title="Generate LLM prompt to split sections into daily parts"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Generate AI Plan Prompt
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="linear-btn-secondary !text-xs"
                title="Paste AI response to import daily parts"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-400" /> Paste AI Plan
              </button>

              <button
                onClick={() => setIsWalkthroughModalOpen(true)}
                className="linear-btn-secondary !text-xs"
                title="Import YouTube walkthrough chapters or text into parts"
              >
                <YoutubeIcon className="w-3.5 h-3.5 text-indigo-400" /> Import Walkthrough
              </button>

              <button
                onClick={() => setIsRevisePlanModalOpen(true)}
                className="linear-btn-secondary !text-xs"
                title="Request changes to the schedule and generate revision prompt"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" /> Revise Plan
              </button>

              <button
                onClick={() => setShowPlanSettings(!showPlanSettings)}
                className="linear-btn-secondary !text-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Plan Settings
              </button>

              <button
                onClick={() => setIsSplitModalOpen(true)}
                className="linear-btn-secondary !text-xs"
              >
                <Split className="w-3.5 h-3.5 text-indigo-400" /> Split Section
              </button>

              <button
                onClick={() => setIsAddingPart(true)}
                className="linear-btn-primary !text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Part
              </button>
            </div>
          </div>

          {/* Plan Settings Drawer / Card */}
          {showPlanSettings && (
            <form
              onSubmit={handleSavePlanSettings}
              className="linear-card p-5 space-y-4 max-w-2xl animate-in fade-in"
            >
              <h3 className="font-semibold text-xs text-neutral-100">
                Plan Cadence & Rest Rules
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Target Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={planDeadline}
                    onChange={(e) => setPlanDeadline(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Parts per Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={planPartsPerDay}
                    onChange={(e) => setPlanPartsPerDay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Hours per Day
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={planHoursPerDay}
                    onChange={(e) => setPlanHoursPerDay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Rest Rule Controls */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Rest Rule
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="restType"
                      checked={planRestType === 'every_n'}
                      onChange={() => setPlanRestType('every_n')}
                    />
                    <span>Every N Days</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="restType"
                      checked={planRestType === 'weekdays'}
                      onChange={() => setPlanRestType('weekdays')}
                    />
                    <span>Specific Weekdays</span>
                  </label>
                </div>

                {planRestType === 'every_n' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-neutral-400">Rest every</span>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={planRestEveryN}
                      onChange={(e) => setPlanRestEveryN(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
                    />
                    <span className="text-xs text-neutral-400">days (e.g. 3 = work 2, rest 1)</span>
                  </div>
                )}

                {planRestType === 'weekdays' && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, dayIndex) => {
                      const isSelected = planRestWeekdays.includes(dayIndex);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setPlanRestWeekdays(planRestWeekdays.filter((d) => d !== dayIndex));
                            } else {
                              setPlanRestWeekdays([...planRestWeekdays, dayIndex]);
                            }
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            isSelected
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanSettings(false)}
                  className="linear-btn-secondary !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="linear-btn-primary !text-xs"
                >
                  Apply & Recalculate
                </button>
              </div>
            </form>
          )}

          {/* Add Part Inline Form */}
          {isAddingPart && (
            <form
              onSubmit={handleAddPart}
              className="linear-card p-5 space-y-4 max-w-xl animate-in fade-in"
            >
              <h3 className="font-semibold text-xs text-neutral-100">New Daily Part</h3>
              <input
                type="text"
                placeholder="Part title *"
                value={newPartTitle}
                onChange={(e) => setNewPartTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newPartSectionId ?? ''}
                  onChange={(e) => setNewPartSectionId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">(No Section)</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={newPartDate}
                  onChange={(e) => setNewPartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <input
                type="text"
                placeholder="Deliverable goal..."
                value={newPartGoal}
                onChange={(e) => setNewPartGoal(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />

              <textarea
                rows={2}
                placeholder="Checklist steps (1 per line)..."
                value={newPartSteps}
                onChange={(e) => setNewPartSteps(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="linear-btn-primary !text-xs"
                >
                  Save Part
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingPart(false)}
                  className="linear-btn-secondary !text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Dnd-kit Sortable Parts List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={parts.map((p) => p.id!)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2.5">
                {parts.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-white/[0.08] rounded-xl text-neutral-500 text-xs bg-white/[0.01]">
                    No parts scheduled. Click "Add Part" or "Split Section" to begin!
                  </div>
                ) : (
                  parts.map((p) => {
                    const sec = sections.find((s) => s.id === p.sectionId);
                    const conflict = isPartScheduledBeforeDependencies(
                      p.plannedDate,
                      p.sectionId,
                      sections,
                      sectionDeps,
                      parts
                    );
                    return (
                      <SortablePartItem
                        key={p.id}
                        part={p}
                        section={sec}
                        blockedBy={conflict.hasConflict ? conflict.conflictingSectionTitles : undefined}
                        onToggleDone={handleTogglePartDone}
                        onDelete={handleDeletePart}
                      />
                    );
                  })
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* TAB: BUGS (Pack 2 Sub-phase B4) */}
      {activeTab === 'bugs' && (
        <div className="linear-card p-5">
          <BugsSection projectId={projectId} />
        </div>
      )}

      {/* TAB: LINKS & DOCS */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" /> Project Reference & Documentation
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Saved URLs and pasted reference texts (capped at 20,000 characters). Automatically injected into prompts under # RELATED.
              </p>
            </div>

            <button
              onClick={handleOpenAddLink}
              className="linear-btn-primary !text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Link / Doc
            </button>
          </div>

          {links.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-white/[0.08] rounded-2xl space-y-3 bg-white/[0.01]">
              <FileText className="w-8 h-8 text-neutral-500 mx-auto" />
              <div className="text-xs font-semibold text-neutral-300">
                No reference links or docs yet
              </div>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Paste API specs, design guidelines, requirements, or web links to keep them accessible and inject them into AI prompts.
              </p>
              <button
                onClick={handleOpenAddLink}
                className="linear-btn-secondary !text-xs"
              >
                Add First Item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="linear-card-hover p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-neutral-100 flex items-center gap-1.5 min-w-0">
                        <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{link.title || link.url || 'Reference Document'}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditLink(link)}
                          className="p-1 text-neutral-400 hover:text-white rounded"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => link.id && handleDeleteLink(link.id)}
                          className="p-1 text-neutral-500 hover:text-rose-400 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-mono truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{link.url}</span>
                      </a>
                    )}

                    {link.note && (
                      <p className="text-xs text-neutral-400">
                        {link.note}
                      </p>
                    )}

                    {link.pastedText && (
                      <div className="pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mb-1">
                          <span>Pasted Text ({link.pastedText.length.toLocaleString()} chars)</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link.pastedText || '');
                              showToast('Pasted text copied!', 'success');
                            }}
                            className="text-indigo-400 hover:underline flex items-center gap-0.5"
                          >
                            <Copy className="w-2.5 h-2.5" /> Copy
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-[#0a0b0f] font-mono text-[11px] text-neutral-300 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-white/[0.06]">
                          {link.pastedText}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MEMORY & DECISIONS */}
      {activeTab === 'memory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Memory History Drawer Modal */}
          {showMemoryHistory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
              <div className="w-full max-w-xl bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" /> Memory Version History (Last 10)
                  </h3>
                  <button
                    onClick={() => setShowMemoryHistory(false)}
                    className="text-neutral-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {memoryHistory.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-6 text-center">
                      No previous memory versions recorded yet. As you update memory each day, previous versions are archived here.
                    </p>
                  ) : (
                    memoryHistory.map((h, i) => (
                      <div
                        key={h.id || i}
                        className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0a0b0f] space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                          <span className="font-medium text-neutral-200">
                            Version {memoryHistory.length - i}
                          </span>
                          <span>{new Date(h.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="font-mono text-neutral-300 whitespace-pre-wrap line-clamp-4">
                          {h.rollingSummary}
                        </p>
                        <button
                          onClick={() => handleRevertMemory(h.rollingSummary, h.glossary)}
                          className="linear-btn-secondary !text-[10px] !py-1 !px-2.5"
                        >
                          <RotateCcw className="w-3 h-3 text-indigo-400" /> Revert to this Version
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Left: Memory Editor */}
          <div className="linear-card p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Rolling Summary
                </label>
                <button
                  type="button"
                  onClick={() => setShowMemoryHistory(true)}
                  className="text-xs text-indigo-400 hover:underline font-medium flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" /> History ({memoryHistory.length})
                </button>
              </div>
              <textarea
                rows={8}
                value={rollingSummary}
                onChange={(e) => setRollingSummary(e.target.value)}
                placeholder="Key summaries from previous days' accepted LLM outputs..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 leading-relaxed placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Glossary / Domain Terms
              </label>
              <textarea
                rows={3}
                value={glossary}
                onChange={(e) => setGlossary(e.target.value)}
                placeholder="Terms, conventions, and domain vocabulary..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <button
              onClick={handleSaveMemory}
              className="linear-btn-primary !text-xs"
            >
              <Save className="w-3.5 h-3.5" /> Save Memory
            </button>
          </div>

          {/* Right: Architectural Decisions */}
          <div className="linear-card p-5 space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                Active Architectural Decisions
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Decisions are placed under "# DECISIONS: Do not contradict these" in every generated prompt.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newDecisionText.trim()) return;
                await decisionRepo.create(projectId, newDecisionText.trim(), newDecisionReason.trim());
                setNewDecisionText('');
                setNewDecisionReason('');
                showToast('Decision recorded!', 'success');
              }}
              className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0a0b0f] space-y-2"
            >
              <input
                type="text"
                placeholder="Decision text (e.g. Use Dexie v4 for IndexedDB)"
                value={newDecisionText}
                onChange={(e) => setNewDecisionText(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#111318] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
              <input
                type="text"
                placeholder="Reason (e.g. Reactive queries and safe cascades)"
                value={newDecisionReason}
                onChange={(e) => setNewDecisionReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#111318] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                type="submit"
                className="linear-btn-secondary !text-xs !py-1"
              >
                Record Decision
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {decisions.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-lg border border-white/[0.06] bg-[#0a0b0f] flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-medium text-neutral-100">{d.text}</div>
                    {d.reason && (
                      <div className="text-[11px] text-neutral-400 mt-0.5">Reason: {d.reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={async () => d.id && (await decisionRepo.toggleActive(d.id, !d.active))}
                      className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border font-mono ${
                        d.active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.04] border-white/[0.08] text-neutral-500'
                      }`}
                    >
                      {d.active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={async () => d.id && (await decisionRepo.delete(d.id))}
                      className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROMPT HISTORY */}
      {activeTab === 'prompts' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Prompt History</h2>
          <div className="space-y-3">
            {prompts.length === 0 ? (
              <p className="text-xs text-neutral-500">No prompts recorded for this project yet.</p>
            ) : (
              prompts.map((p) => (
                <div
                  key={p.id}
                  className="linear-card p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] text-indigo-400 uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">{p.kind} prompt</span>
                    <span className="text-neutral-500 font-mono text-[11px]">{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                  <pre className="text-xs p-3 rounded-lg bg-[#0a0b0f] font-mono overflow-x-auto max-h-40 whitespace-pre-wrap text-neutral-300 border border-white/[0.06]">
                    {p.body}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
