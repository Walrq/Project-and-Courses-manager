import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Part, type PartStep, type Response, type Snippet } from '../db/schema';
import { partRepo } from '../db/repos/partRepo';
import { promptRepo } from '../db/repos/promptRepo';
import { responseRepo } from '../db/repos/responseRepo';
import { snippetRepo } from '../db/repos/snippetRepo';
import { memoryRepo } from '../db/repos/memoryRepo';
import { devLogRepo } from '../db/repos/devLogRepo';
import { buildPromptWithTrimming, type ContextLevel, type BlockId } from '../core/promptBuilder';
import { extractCodeBlocks, type ExtractedCodeSnippet } from '../core/codeExtractor';
import { formatLocalDate } from '../core/scheduler';
import { estimateTokens, TOKEN_LIMIT_PRESETS } from '../core/tokenEstimate';
import { isPartScheduledBeforeDependencies } from '../core/dependencies';
import { useUIStore } from '../store/uiStore';
import {
  CalendarCheck2,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
  Sparkles,
  Coffee,
  Code2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sliders,
  Star,
  Layers,
  Send,
  MessageSquarePlus,
  Bot,
  HelpCircle,
  AlertTriangle,
  X,
  Play,
  ExternalLink,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Clock,
  Trash2,
  CheckCheck,
  FileCode,
  GitCommit,
  Hammer,
} from 'lucide-react';
import { YoutubeIcon } from '../components/YoutubeIcon';
import { FocusTimer } from '../components/FocusTimer';
import { ChecklistsSection } from '../components/ChecklistsSection';
import { formatSecondsToTimestamp } from '../core/chapterParser';
import { extractYouTubeId } from '../core/youtubeId';

export const TodayPage: React.FC = () => {
  const { activeProjectId, showToast } = useUIStore();
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Work Mode: 'coding' (default human developer mode) vs 'ai' (optional AI assistant mode)
  const [workMode, setWorkMode] = useState<'coding' | 'ai'>('coding');
  const [filesChanged, setFilesChanged] = useState('');
  const [gitCommit, setGitCommit] = useState('');

  // Stepper state for AI mode (1: Generate Prompt, 2: Paste Response, 3: Finish Day)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Prompt configuration states
  const [contextLevel, setContextLevel] = useState<ContextLevel>('full');
  const [tokenLimit, setTokenLimit] = useState<number>(32000);
  const [customBlockToggles, setCustomBlockToggles] = useState<Partial<Record<BlockId, boolean>>>({});
  const [showBlockToggles, setShowBlockToggles] = useState(false);
  const [copied, setCopied] = useState(false);

  // Response & Finish states
  const [pastedResponse, setPastedResponse] = useState('');
  const [verdict, setVerdict] = useState<'pending' | 'accepted' | 'rejected' | 'needs_revision'>('pending');
  const [rating, setRating] = useState<number>(5);
  const [feedback, setFeedback] = useState('');
  const [extractedSnippets, setExtractedSnippets] = useState<ExtractedCodeSnippet[]>([]);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // Finish day & Summarize states
  const [dayNote, setDayNote] = useState('');
  const [summarizePrompt, setSummarizePrompt] = useState<string | null>(null);
  const [summarizeResultInput, setSummarizeResultInput] = useState('');
  const [newStepText, setNewStepText] = useState('');

  // Special Prompt Modals (Handoff & Follow-up)
  const [activeSpecialPrompt, setActiveSpecialPrompt] = useState<{ title: string; prompt: string } | null>(null);
  const [followUpFeedback, setFollowUpFeedback] = useState('');

  // Live queries
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const plan = useLiveQuery(async () => {
    if (!activeProject?.id) return null;
    return db.plans.where({ projectId: activeProject.id }).first();
  }, [activeProject?.id]);

  const allParts = useLiveQuery(async () => {
    if (!plan?.id) return [];
    return db.parts.where({ planId: plan.id }).sortBy('orderNo');
  }, [plan?.id]) || [];

  // Today's scheduled part
  const todayPart = useMemo(() => {
    const exactToday = allParts.find((p) => p.plannedDate === todayStr && !p.isRest);
    if (exactToday) return exactToday;
    return allParts.find((p) => p.status === 'planned' && !p.isRest) || null;
  }, [allParts, todayStr]);

  const steps = useLiveQuery(async () => {
    if (!todayPart?.id) return [];
    return db.partSteps.where({ partId: todayPart.id }).sortBy('orderNo');
  }, [todayPart?.id]) || [];

  const section = useLiveQuery(async () => {
    if (!todayPart?.sectionId) return null;
    return db.sections.get(todayPart.sectionId);
  }, [todayPart?.sectionId]);

  const allSections = useLiveQuery(async () => {
    if (!activeProject?.id) return [];
    return db.sections.where({ projectId: activeProject.id }).toArray();
  }, [activeProject?.id]) || [];

  const allSectionDeps = useLiveQuery(() => db.sectionDeps.toArray()) || [];

  const dependencyConflict = useMemo(() => {
    if (!todayPart) return { hasConflict: false, conflictingSectionTitles: [] };
    return isPartScheduledBeforeDependencies(
      todayPart.plannedDate,
      todayPart.sectionId,
      allSections,
      allSectionDeps,
      allParts
    );
  }, [todayPart, allSections, allSectionDeps, allParts]);

  const memory = useLiveQuery(async () => {
    if (!activeProject?.id) return null;
    return db.memory.get(activeProject.id);
  }, [activeProject?.id]);

  const decisions = useLiveQuery(async () => {
    if (!activeProject?.id) return [];
    return db.decisions.where({ projectId: activeProject.id }).filter((d) => d.active === 1).toArray();
  }, [activeProject?.id]) || [];

  const links = useLiveQuery(async () => {
    if (!activeProject?.id) return [];
    return db.links.where({ projectId: activeProject.id }).toArray();
  }, [activeProject?.id]) || [];

  const latestPrompt = useLiveQuery(async () => {
    if (!todayPart?.id) return null;
    return promptRepo.getLatestForPart(todayPart.id);
  }, [todayPart?.id]);

  const latestResponse = useLiveQuery(async () => {
    if (!latestPrompt?.id) return null;
    return responseRepo.getLatestByPrompt(latestPrompt.id);
  }, [latestPrompt?.id]);

  const walkthrough = useLiveQuery(async () => {
    if (!todayPart?.walkthroughId) return null;
    return db.walkthroughs.get(todayPart.walkthroughId);
  }, [todayPart?.walkthroughId]);

  const [showVideoEmbed, setShowVideoEmbed] = useState(false);
  const [stoppedAtInput, setStoppedAtInput] = useState('');
  const [showSourceExcerpt, setShowSourceExcerpt] = useState(false);

  const handleSaveStoppedAt = async (val: string) => {
    if (!todayPart?.id) return;
    await partRepo.update(todayPart.id, { stoppedAt: val.trim() || undefined });
  };

  useEffect(() => {
    if (todayPart?.stoppedAt) {
      setStoppedAtInput(todayPart.stoppedAt);
    } else {
      setStoppedAtInput('');
    }
  }, [todayPart?.stoppedAt]);

  // Sync existing response if loaded
  useEffect(() => {
    if (latestResponse) {
      setPastedResponse(latestResponse.body);
      setVerdict(latestResponse.verdict);
      if (latestResponse.rating) setRating(latestResponse.rating);
      if (latestResponse.feedback) setFeedback(latestResponse.feedback);
      setExtractedSnippets(extractCodeBlocks(latestResponse.body));
    }
  }, [latestResponse]);

  // Extract code blocks when pastedResponse changes
  useEffect(() => {
    if (pastedResponse) {
      setExtractedSnippets(extractCodeBlocks(pastedResponse));
    } else {
      setExtractedSnippets([]);
    }
  }, [pastedResponse]);

  // Assemble today's prompt
  const promptResult = useMemo(() => {
    if (!activeProject || !todayPart) return null;

    const partIndex = allParts.findIndex((p) => p.id === todayPart.id) + 1;
    const totalParts = allParts.filter((p) => !p.isRest).length;

    return buildPromptWithTrimming({
      role: 'You are an elite software architect and engineer executing today\'s dedicated part of the project.',
      project: {
        name: activeProject.name,
        description: activeProject.description,
        goal: activeProject.goal,
        constraints: activeProject.constraints,
        aiRules: activeProject.aiRules,
      },
      memory: {
        rollingSummary: memory?.rollingSummary,
        glossary: memory?.glossary,
      },
      decisions: decisions.map((d) => ({ text: d.text, reason: d.reason })),
      planPosition: {
        currentPartIndex: partIndex > 0 ? partIndex : 1,
        totalParts: totalParts > 0 ? totalParts : 1,
        sectionTitle: section?.title,
      },
      related: links.map((l) => ({
        title: l.title || l.url || 'Reference',
        content: [
          l.note ? `Context: ${l.note}` : '',
          l.url ? `URL: ${l.url}` : '',
          l.pastedText ? `\`\`\`\n${l.pastedText.slice(0, 4000)}\n\`\`\`` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      })),
      source: walkthrough
        ? {
            title: walkthrough.title,
            url: walkthrough.url,
            excerpt: todayPart.sourceExcerpt,
            stoppedAt: todayPart.stoppedAt || undefined,
          }
        : undefined,
      task: {
        title: todayPart.title,
        goal: todayPart.goal,
        steps: steps.map((s) => ({ text: s.text, done: s.done === 1 })),
        stoppedAt: todayPart.stoppedAt || undefined,
      },
      contextLevel,
      customBlockStates: customBlockToggles,
      tokenLimit,
    });
  }, [activeProject, todayPart, allParts, section, memory, decisions, links, steps, walkthrough, contextLevel, customBlockToggles, tokenLimit]);

  const tokenEstimate = useMemo(() => {
    if (!promptResult) return null;
    return estimateTokens(promptResult.fullPrompt, tokenLimit);
  }, [promptResult, tokenLimit]);

  // Copy helper
  const copyTextToClipboard = async (text: string, successMsg: string = 'Copied to clipboard!') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast(successMsg, 'success');
      return true;
    } catch {
      showToast('Failed to copy', 'error');
      return false;
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptResult?.fullPrompt) return;
    const ok = await copyTextToClipboard(promptResult.fullPrompt, 'Daily prompt copied to clipboard!');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      // Save prompt generation record
      if (activeProject?.id && todayPart?.id) {
        await promptRepo.create({
          projectId: activeProject.id,
          partId: todayPart.id,
          sectionId: todayPart.sectionId ?? null,
          kind: 'part',
          body: promptResult.fullPrompt,
          estTokens: promptResult.tokenCount,
          version: 1,
        });
      }
    }
  };

  // Keyboard shortcut Ctrl+Shift+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        handleCopyPrompt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [promptResult]);

  // Save Response & Extracted Snippets
  const handleSaveResponse = async () => {
    if (!pastedResponse.trim() || !activeProject?.id) {
      showToast('Please paste the LLM response first.', 'info');
      return;
    }

    // Ensure prompt record exists
    let promptId = latestPrompt?.id;
    if (!promptId && todayPart?.id) {
      promptId = await promptRepo.create({
        projectId: activeProject.id,
        partId: todayPart.id,
        sectionId: todayPart.sectionId ?? null,
        kind: 'part',
        body: promptResult?.fullPrompt || 'Daily task prompt',
        estTokens: promptResult?.tokenCount || 100,
        version: 1,
      });
    }

    if (promptId) {
      const responseId = await responseRepo.create({
        promptId,
        body: pastedResponse.trim(),
        verdict,
        rating,
        feedback: feedback.trim(),
      });

      // Save extracted snippets
      if (extractedSnippets.length > 0) {
        await snippetRepo.bulkCreate(
          extractedSnippets.map((s) => ({
            responseId,
            projectId: activeProject.id!,
            language: s.language,
            title: s.title,
            code: s.code,
          }))
        );
      }

      showToast(`Response saved as ${verdict} with ${extractedSnippets.length} snippets!`, 'success');
      setActiveStep(3);
    }
  };

  // Generate Summarize Prompt
  const handleGenerateSummarizePrompt = () => {
    if (!activeProject || !todayPart) return;

    const summarizeBody = `You are the memory keeper for the project '${activeProject.name}'.
Compress the following daily progress into at most 8 crisp bullet points.
Preserve architectural decisions, naming conventions, new tools/libraries, and unresolved open questions.

# EXISTING ROLLING SUMMARY
${memory?.rollingSummary || '(None yet)'}

# TODAY'S WORK (${todayPart.title})
Goal: ${todayPart.goal || 'Complete task'}
Note: ${dayNote || 'Completed'}

# ACCEPTED RESPONSE
${pastedResponse.slice(0, 3000) || '(No response pasted)'}

Output format:
- Key decisions made
- What was completed
- Open questions / known issues`;

    setSummarizePrompt(summarizeBody);
  };

  // Save Updated Memory
  const handleSaveRollingMemory = async () => {
    if (!activeProject?.id || !summarizeResultInput.trim()) return;
    await memoryRepo.update(activeProject.id, summarizeResultInput.trim());
    showToast('Project rolling memory updated and version archived!', 'success');
    setSummarizePrompt(null);
    setSummarizeResultInput('');
  };

  // Generate Handoff Prompt
  const handleGenerateHandoff = () => {
    if (!activeProject || !todayPart) return;
    const doneSteps = steps.filter((s) => s.done === 1).map((s) => `- ${s.text}`).join('\n') || '(None)';
    const remainingSteps = steps.filter((s) => s.done === 0).map((s) => `- ${s.text}`).join('\n') || '(None)';

    const handoff = `You are continuing implementation of '${todayPart.title}' for project '${activeProject.name}'.

# CONTEXT
Goal: ${todayPart.goal || 'Daily deliverable'}
Steps Completed:
${doneSteps}

Remaining Steps:
${remainingSteps}

# LAST ACCEPTED OUTPUT SUMMARY
${pastedResponse.slice(0, 2000) || '(In progress)'}

Continue directly from the next remaining step.`;

    setActiveSpecialPrompt({ title: 'Mid-Part Handoff Prompt', prompt: handoff });
  };

  // Generate Follow-up Prompt
  const handleGenerateFollowUp = () => {
    if (!activeProject || !todayPart) return;

    const followup = `Regarding the previous task '${todayPart.title}':

# PREVIOUS PROMPT
${promptResult?.fullPrompt?.slice(0, 1500) || '(Previous prompt)'}

# PREVIOUS RESPONSE
${pastedResponse.slice(0, 2000) || '(Previous response)'}

# FEEDBACK / ADDITIONAL REQUEST
${followUpFeedback.trim() || 'Please address the critique and provide updated deliverable.'}

Please address the feedback while maintaining consistency with previous work.`;

    setActiveSpecialPrompt({ title: 'Follow-up / Critique Prompt', prompt: followup });
  };

  // Finish Day / Toggle Part Done Handler
  const handleTogglePartDone = async () => {
    if (!todayPart?.id) return;
    const isDone = todayPart.status === 'done';
    if (isDone) {
      await partRepo.update(todayPart.id, { status: 'planned', completedAt: null });
      showToast('Part marked as planned', 'info');
    } else {
      await partRepo.markDone(todayPart.id, dayNote.trim());
      if (activeProject?.id) {
        let logText = `Completed part: ${todayPart.title}`;
        if (dayNote.trim()) logText += ` — ${dayNote.trim()}`;
        if (filesChanged.trim()) logText += ` | Files: ${filesChanged.trim()}`;
        if (gitCommit.trim()) logText += ` | Commit: ${gitCommit.trim()}`;
        await devLogRepo.logEntry(activeProject.id, logText, 'progress', { partId: todayPart.id });
      }
      showToast(`Part "${todayPart.title}" ticked done! Excellent job.`, 'success');
    }
  };

  const handleFinishDay = async () => {
    await handleTogglePartDone();
  };

  const handleToggleStep = async (stepId: number, currentDone: number) => {
    await partRepo.toggleStep(stepId, currentDone !== 1);
  };

  const handleDeleteStep = async (stepId: number) => {
    await partRepo.deleteStep(stepId);
  };

  const handleTickAllSteps = async () => {
    if (steps.length === 0) return;
    for (const st of steps) {
      if (st.id && st.done !== 1) {
        await partRepo.toggleStep(st.id, true);
      }
    }
    showToast('All checklist tasks ticked complete!', 'success');
  };

  if (!activeProject) {
    return (
      <div className="p-12 text-center border border-dashed border-neutral-300 dark:border-white/[0.08] rounded-2xl max-w-lg mx-auto bg-white/[0.01]">
        <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">No active project</h2>
      </div>
    );
  }

  if (!todayPart) {
    return (
      <div className="p-12 text-center border border-white/[0.08] linear-surface rounded-2xl max-w-xl mx-auto space-y-4 shadow-linear-card">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
          <Coffee className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Rest & Recharge</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
          No parts are scheduled for today in <span className="font-semibold text-neutral-200">{activeProject.name}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Special Prompt Modal (Handoff or Follow-up) */}
      {activeSpecialPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" /> {activeSpecialPrompt.title}
              </h3>
              <button
                onClick={() => setActiveSpecialPrompt(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              readOnly
              rows={12}
              value={activeSpecialPrompt.prompt}
              className="w-full p-3.5 text-xs font-mono rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-[#f7f8f8] leading-relaxed resize-none focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setActiveSpecialPrompt(null)}
                className="linear-btn-secondary !text-xs"
              >
                Close
              </button>
              <button
                onClick={() => copyTextToClipboard(activeSpecialPrompt.prompt, 'Prompt copied!')}
                className="linear-btn-primary !text-xs"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Special Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-neutral-200/80 dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {activeProject.name} &bull; Part #{todayPart.orderNo}
            </span>
            {todayPart.status === 'done' ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                <Check className="w-3 h-3" /> Completed
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                In Progress
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={handleTogglePartDone}
              className="text-neutral-400 hover:text-emerald-400 transition-colors shrink-0 p-0.5"
              title={todayPart.status === 'done' ? 'Mark part as planned' : 'Tick part as complete'}
            >
              {todayPart.status === 'done' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/10" />
              ) : (
                <Circle className="w-6 h-6 text-neutral-500 hover:stroke-indigo-400" />
              )}
            </button>
            <h1 className={`text-xl sm:text-2xl font-semibold tracking-tight ${todayPart.status === 'done' ? 'line-through text-neutral-500 dark:text-[#62666d]' : 'text-neutral-900 dark:text-[#f7f8f8]'}`}>
              {todayPart.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Work Mode Switcher */}
          <div className="flex items-center rounded-lg p-0.5 bg-neutral-200/60 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.08]">
            <button
              onClick={() => setWorkMode('coding')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                workMode === 'coding'
                  ? 'bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-[#f7f8f8] shadow-sm'
                  : 'text-neutral-500 dark:text-[#8a8f98] hover:text-[#f7f8f8]'
              }`}
            >
              <Hammer className="w-3.5 h-3.5 text-indigo-400" /> My Daily Work
            </button>
            <button
              onClick={() => setWorkMode('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                workMode === 'ai'
                  ? 'bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-[#f7f8f8] shadow-sm'
                  : 'text-neutral-500 dark:text-[#8a8f98] hover:text-[#f7f8f8]'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" /> AI Assistant
            </button>
          </div>

          <FocusTimer
            projectId={activeProject.id}
            partId={todayPart.id}
            sectionId={todayPart.sectionId || undefined}
          />

          <button
            onClick={handleTogglePartDone}
            className={todayPart.status === 'done' ? 'linear-btn-secondary' : 'linear-btn-primary'}
          >
            <Check className="w-3.5 h-3.5" /> {todayPart.status === 'done' ? 'Ticked Done (Re-open)' : 'Tick Part Done'}
          </button>
          <button
            onClick={handleGenerateHandoff}
            className="linear-btn-secondary"
            title="Generate handoff prompt for a fresh chat mid-part"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-sky-400" /> Handoff Prompt
          </button>
        </div>
      </div>

      {/* Dependency conflict warning */}
      {dependencyConflict.hasConflict && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <span className="font-bold">Dependency Notice:</span> This part's section depends on{' '}
            <span className="font-semibold underline decoration-amber-500/50">
              {dependencyConflict.conflictingSectionTitles.join(', ')}
            </span>
            , which is scheduled concurrently or has unfinished parts. You may want to complete the prerequisite sections first.
          </div>
        </div>
      )}

      {/* Main Two-Column Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Scope & Walkthrough (5 cols) */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="linear-card p-4 space-y-3.5">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-[#62666d]">
                Deliverable Goal
              </span>
              <p className="text-xs font-medium text-neutral-800 dark:text-[#d0d3d8] mt-0.5">
                {todayPart.goal || 'Complete today\'s implementation deliverable.'}
              </p>
            </div>

            {section && (
              <div className="text-[11px] text-neutral-500 dark:text-[#8a8f98] pt-1 border-t border-neutral-100 dark:border-white/[0.04]">
                Section: <span className="font-medium text-neutral-700 dark:text-[#f7f8f8]">{section.title}</span>
              </div>
            )}

            {workMode === 'coding' ? (
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-white/[0.04] text-xs">
              <span className="text-[#8a8f98]">Status</span>
              <span className={`font-mono text-[11px] font-semibold uppercase ${todayPart.status === 'done' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                {todayPart.status}
              </span>
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-white/[0.04]">
                <span className="text-[10px] font-semibold text-neutral-400 dark:text-[#62666d] uppercase tracking-wider">
                  Checklist Steps
                </span>
                <div className="space-y-0.5">
                  {steps.map((st) => (
                    <div key={st.id} className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-neutral-100/60 dark:hover:bg-white/[0.04] text-xs transition-colors">
                      <button
                        type="button"
                        onClick={() => handleToggleStep(st.id!, st.done)}
                        className="text-neutral-400 dark:text-[#62666d] hover:text-emerald-500 transition-colors shrink-0"
                        aria-label={`${st.done === 1 ? 'Mark incomplete' : 'Mark complete'}: ${st.text}`}
                      >
                        {st.done === 1 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4" />}
                      </button>
                      <span className={`flex-1 ${st.done === 1 ? 'line-through text-neutral-400 dark:text-[#62666d]' : 'text-neutral-800 dark:text-[#d0d3d8]'}`}>
                        {st.text}
                      </span>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!todayPart?.id || !newStepText.trim()) return;
                    await partRepo.addStep(todayPart.id, newStepText.trim(), steps.length);
                    setNewStepText('');
                  }}
                  className="flex items-center gap-2 pt-1"
                >
                  <input
                    type="text"
                    placeholder="Add another checklist item..."
                    value={newStepText}
                    onChange={(e) => setNewStepText(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-neutral-900 dark:text-[#f7f8f8] placeholder:text-neutral-400 dark:placeholder:text-[#62666d] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                  <button type="submit" disabled={!newStepText.trim()} className="linear-btn-secondary px-2.5 py-1.5 disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Walkthrough Source Card (Add-on 1) */}
          {(walkthrough || todayPart.sourceExcerpt || todayPart.sourceLabel) && (
            <div className="linear-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <YoutubeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-[#f7f8f8]">
                      {walkthrough?.title || 'Walkthrough Source'}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-[#8a8f98]">
                      {todayPart.sourceLabel && <span>{todayPart.sourceLabel}</span>}
                      {todayPart.sourceStart !== undefined && todayPart.sourceEnd !== undefined && (
                        <span className="font-mono">
                          {formatSecondsToTimestamp(todayPart.sourceStart)} - {formatSecondsToTimestamp(todayPart.sourceEnd)} (
                          {Math.round((todayPart.sourceEnd - todayPart.sourceStart) / 60)}m)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  Prompt auto-injects
                </span>
              </div>

              {/* Video Actions & External Link */}
              {(() => {
                const vId = walkthrough?.videoId || extractYouTubeId(walkthrough?.url);
                const startSec = Math.floor(todayPart.sourceStart || 0);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {vId && (
                        <>
                          <a
                            href={`https://www.youtube.com/watch?v=${vId}&t=${startSec}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="linear-btn-primary"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open at this time ({formatSecondsToTimestamp(startSec)})
                          </a>
                          <button
                            type="button"
                            onClick={() => setShowVideoEmbed(!showVideoEmbed)}
                            className="linear-btn-secondary"
                          >
                            {showVideoEmbed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {showVideoEmbed ? 'Hide Video' : 'Inline Video'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Privacy-conscious inline embed (strictly off by default) */}
                    {showVideoEmbed && vId && (
                      <div className="aspect-video w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-white/[0.08] bg-black">
                        <iframe
                          title="Walkthrough Video Player"
                          src={`https://www.youtube-nocookie.com/embed/${vId}?start=${startSec}&autoplay=0`}
                          className="w-full h-full border-0"
                          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* "Where I stopped" bookmarking */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-white/[0.04]">
                <Bookmark className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-xs text-neutral-500 dark:text-[#8a8f98]">Where I stopped:</span>
                <input
                  type="text"
                  placeholder="e.g. 14:20"
                  value={stoppedAtInput}
                  onChange={(e) => setStoppedAtInput(e.target.value)}
                  onBlur={() => handleSaveStoppedAt(stoppedAtInput)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-24 px-2 py-1 text-xs font-mono rounded-md border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-neutral-900 dark:text-[#f7f8f8]"
                />
              </div>

              {/* Collapsible Source Excerpt */}
              {todayPart.sourceExcerpt && (
                <div className="pt-2 border-t border-neutral-100 dark:border-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => setShowSourceExcerpt(!showSourceExcerpt)}
                    className="flex items-center justify-between w-full text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>Source Excerpt</span>
                    {showSourceExcerpt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showSourceExcerpt && (
                    <div className="mt-2 p-2.5 rounded-lg bg-neutral-950 border border-white/[0.08] max-h-48 overflow-y-auto text-[11px] font-mono whitespace-pre-wrap text-[#d0d3d8]">
                      {todayPart.sourceExcerpt}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reusable Checklists for Part (Pack 2 Sub-phase B4) */}
          {activeProject?.id && todayPart?.id && (
            <ChecklistsSection projectId={activeProject.id} partId={todayPart.id} />
          )}
        </div>

        {/* Right Column: Coding Workflow or AI Stepper (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {workMode === 'coding' ? (
            /* =========================================================================
               HUMAN DEVELOPER CODING WORKFLOW: Interactive Checklist & Dev Log
               ========================================================================= */
            <div className="space-y-4">
              {/* Completed Banner if Part is Done */}
              {todayPart.status === 'done' && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-emerald-300">Part Completed & Ticked!</div>
                      <div className="text-xs text-emerald-400/80 mt-0.5">
                        Great job completing your daily work. You can untick anytime or add further notes.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleTogglePartDone}
                    className="linear-btn-secondary !text-xs shrink-0"
                  >
                    Re-open Part
                  </button>
                </div>
              )}

              {/* CARD 1: Interactive Coding Checklist */}
              {(() => {
                const doneCount = steps.filter((s) => s.done === 1).length;
                const totalCount = steps.length;
                const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                return (
                  <div className="linear-card p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div>
                        <h3 className="text-sm font-semibold text-[#f7f8f8] flex items-center gap-2">
                          <CheckCheck className="w-4 h-4 text-indigo-400" /> Coding Tasks Checklist
                        </h3>
                        <p className="text-xs text-[#8a8f98] font-mono mt-0.5">
                          {doneCount} of {totalCount} tasks completed ({pct}%)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {steps.length > 0 && doneCount < totalCount && (
                          <button
                            type="button"
                            onClick={handleTickAllSteps}
                            className="linear-btn-secondary !text-xs !py-1"
                            title="Tick all remaining checklist tasks complete"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Tick All
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#1e2029] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Task Rows */}
                    <div className="space-y-1.5">
                      {steps.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-white/[0.08] rounded-xl text-xs text-[#626670] bg-[#14161f]/30">
                          No tasks created yet. Add what you plan to code today below, then tick them off as you code!
                        </div>
                      ) : (
                        steps.map((st) => (
                          <div
                            key={st.id}
                            className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                              st.done === 1
                                ? 'bg-emerald-500/[0.04] border-emerald-500/20 text-[#8a8f98]'
                                : 'bg-[#14161f] border-white/[0.06] hover:border-white/[0.12] text-[#f7f8f8]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleStep(st.id!, st.done)}
                              className="flex items-center gap-3 flex-1 text-left cursor-pointer select-none"
                            >
                              {st.done === 1 ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/10 shrink-0" />
                              ) : (
                                <Circle className="w-5 h-5 text-[#626670] group-hover:stroke-indigo-400 shrink-0 transition-colors" />
                              )}
                              <span
                                className={`text-xs font-medium leading-relaxed ${
                                  st.done === 1 ? 'line-through text-[#626670]' : 'text-[#f7f8f8]'
                                }`}
                              >
                                {st.text}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteStep(st.id!)}
                              className="p-1 text-[#626670] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Inline Add Task Form */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!todayPart?.id || !newStepText.trim()) return;
                        await partRepo.addStep(todayPart.id, newStepText.trim(), steps.length);
                        setNewStepText('');
                      }}
                      className="flex items-center gap-2 pt-2 border-t border-white/[0.06]"
                    >
                      <input
                        type="text"
                        placeholder="What coding task to do next? (e.g. Implement auth route, press Enter)..."
                        value={newStepText}
                        onChange={(e) => setNewStepText(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!newStepText.trim()}
                        className="linear-btn-secondary disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Task
                      </button>
                    </form>
                  </div>
                );
              })()}

              {/* CARD 2: Developer Coding Log & Deliverables */}
              <div className="linear-card p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider flex items-center gap-2 mb-1">
                    <FileCode className="w-4 h-4 text-indigo-400" /> Session Work Log & Deliverables
                  </h3>
                  <p className="text-xs text-[#626670]">
                    Record what you actually built, code decisions, or files touched during this coding session.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] text-[#8a8f98] mb-1 font-medium">What I Built / Implementation Notes</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Built the JWT verification middleware, added unit test coverage for token expiry..."
                    value={dayNote}
                    onChange={(e) => setDayNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#8a8f98] mb-1 font-medium flex items-center gap-1.5">
                      <FileCode className="w-3 h-3 text-[#626670]" /> Files Modified
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. src/auth/jwt.ts, tests/auth.test.ts"
                      value={filesChanged}
                      onChange={(e) => setFilesChanged(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8a8f98] mb-1 font-medium flex items-center gap-1.5">
                      <GitCommit className="w-3 h-3 text-[#626670]" /> Git Branch / Commit Hash
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. feat/jwt-auth or c8a2b1f"
                      value={gitCommit}
                      onChange={(e) => setGitCommit(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-white/[0.08] bg-[#14161f] text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <div className="text-xs text-[#8a8f98]">
                    Part Status: <span className="font-mono font-semibold uppercase text-[#f7f8f8]">{todayPart.status}</span>
                  </div>

                  <button
                    onClick={handleTogglePartDone}
                    className="linear-btn-primary !px-5 !py-2.5 !text-xs font-semibold shadow-linear-glow"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {todayPart.status === 'done' ? 'Ticked Done (Click to re-open)' : 'Tick Entire Part Done'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
               AI ASSISTANT WORKFLOW: Prompt Generator, Paste Response, Summarize
               ========================================================================= */
            <div className="space-y-3.5">
              {/* Stepper Tabs (Linear Segmented Control) */}
              <div className="flex items-center rounded-lg p-0.5 bg-neutral-200/60 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.06]">
                {[
                  { num: 1, label: '1. Generate Prompt' },
                  { num: 2, label: '2. Paste Response' },
                  { num: 3, label: '3. Finish Day' },
                ].map((s) => (
                  <button
                    key={s.num}
                    onClick={() => setActiveStep(s.num as any)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      activeStep === s.num
                        ? 'bg-white dark:bg-white/[0.08] text-neutral-900 dark:text-[#f7f8f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'text-neutral-500 dark:text-[#8a8f98] hover:text-neutral-900 dark:hover:text-[#f7f8f8]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

          {/* STEP 1: GENERATE PROMPT */}
          {activeStep === 1 && promptResult && (
            <div className="linear-card p-5 space-y-4">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200/60 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500 dark:text-[#8a8f98]">Context:</span>
                  <div className="flex items-center rounded-md p-0.5 bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06]">
                    {(['minimal', 'standard', 'full'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setContextLevel(lvl)}
                        className={`px-2 py-0.5 text-xs font-medium rounded capitalize transition-all ${
                          contextLevel === lvl
                            ? 'bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-white shadow-2xs'
                            : 'text-neutral-500 dark:text-[#8a8f98] hover:text-neutral-800 dark:hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500 dark:text-[#8a8f98]">Budget:</span>
                  <select
                    value={tokenLimit}
                    onChange={(e) => setTokenLimit(Number(e.target.value))}
                    className="text-xs px-2 py-1 rounded-md bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] text-neutral-900 dark:text-[#f7f8f8]"
                  >
                    {TOKEN_LIMIT_PRESETS.map((lim) => (
                      <option key={lim} value={lim} className="bg-white dark:bg-[#13151c]">
                        {lim >= 1000 ? `${lim / 1000}k` : lim} tokens
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setShowBlockToggles(!showBlockToggles)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-[#8a8f98] dark:hover:text-white rounded hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
                    title="Toggle individual prompt blocks"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Block toggles drawer */}
              {showBlockToggles && (
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.06] grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {promptResult.blocks.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer text-neutral-600 dark:text-[#8a8f98]">
                      <input
                        type="checkbox"
                        checked={b.enabled}
                        onChange={(e) =>
                          setCustomBlockToggles((prev) => ({
                            ...prev,
                            [b.id]: e.target.checked,
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-0"
                      />
                      <span className="truncate">{b.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Token Counter & Trimming Notice */}
              {tokenEstimate && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-500 dark:text-[#8a8f98]">Estimated Tokens:</span>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
                        tokenEstimate.color === 'green'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : tokenEstimate.color === 'yellow'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      ~{tokenEstimate.tokens} tokens ({Math.round(tokenEstimate.percentage)}%)
                    </span>
                  </div>

                  <span className="linear-kbd">Ctrl+Shift+C</span>
                </div>
              )}

              {promptResult.trimmedNotes.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                  {promptResult.trimmedNotes.join(' ')}
                </div>
              )}

              {/* Prompt Textarea Preview */}
              <div className="relative">
                <textarea
                  readOnly
                  rows={14}
                  value={promptResult.fullPrompt}
                  className="w-full p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-[#0a0b0f] font-mono text-xs text-[#f7f8f8] focus:outline-none resize-none leading-relaxed"
                />

                <button
                  onClick={handleCopyPrompt}
                  className="absolute bottom-4 right-4 linear-btn-primary shadow-lg"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={() => setActiveStep(2)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"
                >
                  Go to Paste Response <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PASTE RESPONSE & SNIPPETS */}
          {activeStep === 2 && (
            <div className="linear-card p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Paste LLM Response
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste the output generated by the LLM here..."
                  value={pastedResponse}
                  onChange={(e) => setPastedResponse(e.target.value)}
                  className="w-full p-3.5 text-xs rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-[#0a0b0f] font-mono text-[#f7f8f8] placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 leading-relaxed"
                />
              </div>

              {/* Extracted Code Blocks */}
              {extractedSnippets.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-indigo-400" /> Extracted Code Snippets ({extractedSnippets.length})
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">Ready to save with response</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {extractedSnippets.map((snip) => (
                      <div
                        key={snip.id}
                        className="p-3 rounded-lg border border-neutral-200 dark:border-white/[0.06] bg-[#0a0b0f] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-neutral-200 flex items-center gap-2">
                            {snip.title} <span className="text-indigo-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">{snip.language}</span>
                          </span>
                          <button
                            onClick={async () => {
                              await copyTextToClipboard(snip.code, 'Code snippet copied!');
                              setCopiedSnippetId(snip.id);
                              setTimeout(() => setCopiedSnippetId(null), 2000);
                            }}
                            className="linear-btn-secondary !py-0.5 !px-2 !text-[10px]"
                          >
                            {copiedSnippetId === snip.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedSnippetId === snip.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="text-[11px] font-mono text-neutral-400 line-clamp-3 overflow-x-auto whitespace-pre-wrap">
                          {snip.code}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verdict buttons & Rating */}
              <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-400 mr-1">Verdict:</span>
                    <button
                      type="button"
                      onClick={() => setVerdict('accepted')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                        verdict === 'accepted'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Accepted
                    </button>

                    <button
                      type="button"
                      onClick={() => setVerdict('needs_revision')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                        verdict === 'needs_revision'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Needs Revision
                    </button>

                    <button
                      type="button"
                      onClick={() => setVerdict('rejected')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                        verdict === 'rejected'
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                          : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> Rejected
                    </button>
                  </div>

                  {/* Rating stars */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-neutral-400 mr-1">Rating:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 text-amber-400/50 hover:text-amber-400 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Follow-up trigger if Needs Revision */}
                {verdict === 'needs_revision' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 space-y-2.5">
                    <span className="text-xs font-medium text-amber-300">
                      Revision Feedback:
                    </span>
                    <input
                      type="text"
                      placeholder="What should the AI correct in the next revision?"
                      value={followUpFeedback}
                      onChange={(e) => setFollowUpFeedback(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-[#f7f8f8] placeholder-neutral-500 focus:outline-none focus:border-amber-500/40"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateFollowUp}
                      className="linear-btn-secondary !text-amber-300 !border-amber-500/30 hover:!bg-amber-500/15 !text-xs !py-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Generate Revision Follow-Up Prompt
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setActiveStep(1)}
                  className="linear-btn-secondary !text-xs"
                >
                  Back to Prompt
                </button>

                <button
                  onClick={handleSaveResponse}
                  className="linear-btn-primary"
                >
                  Save Response & Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FINISH DAY & SUMMARIZE MEMORY */}
          {activeStep === 3 && (
            <div className="linear-card p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Daily Part Summary Note
                </label>
                <textarea
                  rows={3}
                  placeholder="3-line summary of what you did and any open decisions..."
                  value={dayNote}
                  onChange={(e) => setDayNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-[#0a0b0f] text-[#f7f8f8] placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Summarize Prompt Section */}
              <div className="linear-surface p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-xs text-neutral-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Rolling Memory Summarizer
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Generate a prompt to let your LLM compress today's output into at most 8 bullets.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateSummarizePrompt}
                    className="linear-btn-secondary !text-xs shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Generate Prompt
                  </button>
                </div>

                {/* Summarize Prompt Modal/Box */}
                {summarizePrompt && (
                  <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-white/[0.06] animate-in fade-in">
                    <div className="relative">
                      <textarea
                        readOnly
                        rows={6}
                        value={summarizePrompt}
                        className="w-full p-3 rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-[#0a0b0f] font-mono text-xs text-[#f7f8f8] leading-relaxed resize-none focus:outline-none"
                      />
                      <button
                        onClick={() => copyTextToClipboard(summarizePrompt, 'Summarize prompt copied!')}
                        className="absolute bottom-3 right-3 linear-btn-primary !py-1 !px-2.5 !text-[11px]"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Paste LLM's 8-Bullet Summary Result:
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Paste the compressed summary bullets here..."
                        value={summarizeResultInput}
                        onChange={(e) => setSummarizeResultInput(e.target.value)}
                        className="w-full p-3 rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-[#0a0b0f] font-sans text-xs text-[#f7f8f8] placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>

                    <button
                      onClick={handleSaveRollingMemory}
                      disabled={!summarizeResultInput.trim()}
                      className="linear-btn-primary !text-xs !py-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Save to Rolling Memory (Archiving Previous)
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setActiveStep(2)}
                  className="linear-btn-secondary !text-xs"
                >
                  Back to Response
                </button>

                <button
                  onClick={handleFinishDay}
                  className="linear-btn-primary !px-5 !py-2.5 !text-xs font-semibold shadow-linear-glow"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Complete Part & Finish Day
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
