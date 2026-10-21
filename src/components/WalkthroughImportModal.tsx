import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Sparkles,
  Play,
  ArrowRight,
  Trash2,
  GitMerge,
  Split,
  AlertCircle,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import { YoutubeIcon } from './YoutubeIcon';
import { extractYouTubeId } from '../core/youtubeId';
import { parseChapters, formatSecondsToTimestamp, type ParsedChapter } from '../core/chapterParser';
import { splitEvenly } from '../core/evenSplit';
import { splitTextContent, type SplitRule, type TextSplitPart } from '../core/textSplitter';
import { parseImportText, type ImportedPlan } from '../core/planImport';
import { walkthroughRepo } from '../db/repos/walkthroughRepo';
import { sectionRepo } from '../db/repos/sectionRepo';
import { partRepo } from '../db/repos/partRepo';
import { scheduleParts } from '../core/scheduler';
import { db, type RestRule } from '../db/schema';

interface ProposedPart {
  id: string;
  orderNo: number;
  title: string;
  section: string;
  sourceStart?: number;
  sourceEnd?: number;
  sourceExcerpt?: string;
  estMinutes: number;
}

interface WalkthroughImportModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const WalkthroughImportModal: React.FC<WalkthroughImportModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'text' | 'llm'>('youtube');
  const [step, setStep] = useState<'input' | 'preview'>('input');

  // Tab A: YouTube states
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [totalLengthMinutes, setTotalLengthMinutes] = useState<number | ''>('');

  // Tab B: Paste text states
  const [textSourceType, setTextSourceType] = useState<'transcript' | 'web' | 'notes'>('transcript');
  const [textUrl, setTextUrl] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [selectedRule, setSelectedRule] = useState<SplitRule | 'auto'>('auto');
  const [detectedRule, setDetectedRule] = useState<string>('');

  // Tab C: LLM states
  const [llmPromptCopied, setLlmPromptCopied] = useState(false);
  const [llmPastedReply, setLlmPastedReply] = useState('');

  // Common Preview & Scheduling states
  const [proposedParts, setProposedParts] = useState<ProposedPart[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [partsPerDay, setPartsPerDay] = useState(1);
  const [restRuleType, setRestRuleType] = useState<'every_n' | 'weekdays'>('every_n');
  const [restN, setRestN] = useState(3);
  const [restDays, setRestDays] = useState<number[]>([0, 6]); // weekends
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Process Tab A (YouTube)
  const handleParseYouTube = () => {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      alert('Please enter a valid YouTube URL or 11-character video ID.');
      return;
    }

    const totalSeconds = totalLengthMinutes ? Number(totalLengthMinutes) * 60 : undefined;
    const { chapters, warnings: parseWarnings } = parseChapters(videoDescription, totalSeconds);

    let parts: ProposedPart[] = [];

    if (chapters.length > 0) {
      parts = chapters.map((c, idx) => ({
        id: `yt_${idx}_${Date.now()}`,
        orderNo: idx + 1,
        title: c.title,
        section: videoTitle.trim() || 'Walkthrough',
        sourceStart: c.sourceStart,
        sourceEnd: c.sourceEnd,
        estMinutes: 45,
      }));
    } else if (totalSeconds && totalSeconds > 0) {
      // Split evenly fallback
      const slices = splitEvenly({ totalSeconds, minutesPerPart: 15 });
      parts = slices.map((s, idx) => ({
        id: `slice_${idx}_${Date.now()}`,
        orderNo: idx + 1,
        title: s.title,
        section: videoTitle.trim() || 'Walkthrough',
        sourceStart: s.sourceStart,
        sourceEnd: s.sourceEnd,
        estMinutes: 45,
      }));
      parseWarnings.push('No timestamps found in description. Sliced evenly based on total video length.');
    } else {
      alert('No chapters were found in the description. Please enter a total duration to split evenly, or paste transcript text in Tab B.');
      return;
    }

    setWarnings(parseWarnings);
    setProposedParts(parts);
    setStep('preview');
  };

  // Process Tab B (Text Splitter)
  const handleParseText = () => {
    if (!rawText.trim()) {
      alert('Please paste transcript or article text first.');
      return;
    }

    const ruleToUse = selectedRule === 'auto' ? undefined : selectedRule;
    const result = splitTextContent(rawText, { preferredRule: ruleToUse });

    setDetectedRule(result.ruleUsed);

    const parts: ProposedPart[] = result.parts.map((p, idx) => ({
      id: `text_${idx}_${Date.now()}`,
      orderNo: idx + 1,
      title: p.title,
      section: textTitle.trim() || 'Walkthrough Guide',
      sourceStart: p.sourceStart,
      sourceEnd: p.sourceEnd,
      sourceExcerpt: p.excerpt,
      estMinutes: 45,
    }));

    setWarnings([]);
    setProposedParts(parts);
    setStep('preview');
  };

  // Process Tab C (LLM Reply)
  const handleParseLLMReply = () => {
    const parsed = parseImportText(llmPastedReply);
    if (!parsed.success || parsed.type !== 'plan') {
      alert('Could not parse valid plan JSON from reply. Please check the JSON format.');
      return;
    }

    const parts: ProposedPart[] = parsed.data.parts.map((p, idx) => ({
      id: `llm_${idx}_${Date.now()}`,
      orderNo: idx + 1,
      title: p.title || `Part ${idx + 1}`,
      section: p.section || 'Walkthrough',
      sourceStart: p.source_start,
      sourceEnd: p.source_end,
      sourceExcerpt: p.source_excerpt,
      estMinutes: p.est_minutes || 45,
    }));

    setWarnings([]);
    setProposedParts(parts);
    setStep('preview');
  };

  // Merge selected rows
  const handleMergeSelected = () => {
    if (selectedRowIds.size < 2) {
      alert('Select at least 2 rows to merge.');
      return;
    }

    const selectedList = proposedParts.filter((p) => selectedRowIds.has(p.id));
    const first = selectedList[0];
    const last = selectedList[selectedList.length - 1];

    const mergedTitle = selectedList.map((p) => p.title).join(' + ');
    const mergedExcerpt = selectedList
      .map((p) => p.sourceExcerpt)
      .filter(Boolean)
      .join('\n\n');
    const totalEst = selectedList.reduce((acc, p) => acc + p.estMinutes, 0);

    const mergedPart: ProposedPart = {
      id: `merged_${Date.now()}`,
      orderNo: first.orderNo,
      title: mergedTitle.slice(0, 80),
      section: first.section,
      sourceStart: first.sourceStart,
      sourceEnd: last.sourceEnd,
      sourceExcerpt: mergedExcerpt.slice(0, 6000),
      estMinutes: totalEst,
    };

    const newParts = proposedParts
      .filter((p) => !selectedRowIds.has(p.id))
      .concat([mergedPart])
      .sort((a, b) => a.orderNo - b.orderNo)
      .map((p, idx) => ({ ...p, orderNo: idx + 1 }));

    setProposedParts(newParts);
    setSelectedRowIds(new Set());
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    const updated = proposedParts
      .filter((p) => p.id !== id)
      .map((p, idx) => ({ ...p, orderNo: idx + 1 }));
    setProposedParts(updated);
  };

  // Commit and write to Dexie
  const handleCommitSchedule = async () => {
    if (proposedParts.length === 0) return;
    setIsSubmitting(true);

    try {
      const restRule: RestRule =
        restRuleType === 'every_n'
          ? { type: 'every_n', n: restN }
          : { type: 'weekdays', days: restDays };

      // 1. Create walkthrough record
      let walkthroughType: 'video' | 'web' | 'text' = 'text';
      let title = 'Walkthrough';
      let url = '';
      let videoId: string | undefined;
      let rawContent = '';

      if (activeTab === 'youtube') {
        walkthroughType = 'video';
        title = videoTitle.trim() || 'YouTube Tutorial';
        url = videoUrl.trim();
        videoId = extractYouTubeId(videoUrl) || undefined;
        rawContent = videoDescription;
      } else if (activeTab === 'text') {
        walkthroughType = textSourceType === 'transcript' ? 'text' : 'web';
        title = textTitle.trim() || 'Walkthrough Guide';
        url = textUrl.trim();
        rawContent = rawText;
      } else {
        walkthroughType = 'text';
        title = 'AI Split Walkthrough';
        rawContent = llmPastedReply;
      }

      const { id: walkthroughId } = await walkthroughRepo.create({
        projectId,
        type: walkthroughType,
        title,
        url: url || undefined,
        videoId,
        rawText: rawContent,
      });

      // 2. Group into sections and parts
      const sectionNames = Array.from(new Set(proposedParts.map((p) => p.section || 'Walkthrough')));
      const sectionMap = new Map<string, number>();

      for (let i = 0; i < sectionNames.length; i++) {
        const sName = sectionNames[i];
        const sId = await sectionRepo.create({
          projectId,
          title: sName,
          status: 'not_started',
          priority: 2,
          orderNo: i + 1,
        });
        sectionMap.set(sName, sId);
      }

      // 3. Find plan for project
      const plan = await db.plans.where({ projectId }).first();
      const planId = plan?.id || 1;

      // 4. Create and date parts
      const todayStr = new Date().toISOString().split('T')[0];
      const partsToSchedule = proposedParts.map((p) => ({
        orderNo: p.orderNo,
        title: p.title,
        status: 'planned' as const,
        sectionId: sectionMap.get(p.section) || null,
        estMinutes: p.estMinutes,
        walkthroughId,
        sourceStart: p.sourceStart,
        sourceEnd: p.sourceEnd,
        sourceExcerpt: p.sourceExcerpt,
        sourceLabel: title,
      }));

      const scheduled = scheduleParts(partsToSchedule, todayStr, partsPerDay, restRule);

      // Write parts to Dexie
      for (const sp of scheduled.parts) {
        await partRepo.create({
          planId,
          sectionId: sp.sectionId,
          orderNo: sp.orderNo,
          title: sp.title,
          plannedDate: sp.plannedDate,
          isRest: 0,
          status: 'planned',
          estMinutes: sp.estMinutes,
          walkthroughId,
          sourceStart: sp.sourceStart,
          sourceEnd: sp.sourceEnd,
          sourceExcerpt: sp.sourceExcerpt,
          sourceLabel: sp.sourceLabel,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to import walkthrough: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0c0d12] border border-white/[0.1] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0c0d12]">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2 text-neutral-100">
              <Play className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
              Import Walkthrough & Schedule
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Only import content you are allowed to use for personal study. Everything stays on your device.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'input' && (
            <>
              {/* Tab Selector */}
              <div className="flex border-b border-white/[0.06] gap-6">
                <button
                  onClick={() => setActiveTab('youtube')}
                  className={`flex items-center gap-2 pb-3 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === 'youtube'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <YoutubeIcon className="w-3.5 h-3.5 text-rose-500" />
                  YouTube Chapters
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex items-center gap-2 pb-3 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === 'text'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Paste Text / Transcript
                </button>
                <button
                  onClick={() => setActiveTab('llm')}
                  className={`flex items-center gap-2 pb-3 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === 'llm'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Split with LLM
                </button>
              </div>

              {/* Tab A Content */}
              {activeTab === 'youtube' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">YouTube URL or Video ID</label>
                      <input
                        type="text"
                        placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Video Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Fullstack React & Node Crash Course"
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Video Description (with timestamps)
                    </label>
                    <textarea
                      rows={8}
                      placeholder={`Paste video description here, for example:\n0:00 Intro\n05:15 Setup Project\n12:30 Building Core Logic\n...`}
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl p-3 text-xs font-mono text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-4 bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06]">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-neutral-300">
                        Total Video Duration (Optional minutes for equal split fallback)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 180 (for 3 hours)"
                        value={totalLengthMinutes}
                        onChange={(e) => setTotalLengthMinutes(e.target.value ? Number(e.target.value) : '')}
                        className="mt-1.5 w-48 bg-[#0a0b0f] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-neutral-100 font-mono focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <p className="text-xs text-neutral-500 max-w-xs">
                      If the description doesn't contain timestamps, entering a duration will slice the video into equal parts.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab B Content */}
              {activeTab === 'text' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Source Type</label>
                      <select
                        value={textSourceType}
                        onChange={(e) => setTextSourceType(e.target.value as any)}
                        className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="transcript">Video Transcript</option>
                        <option value="web">Web Page / Article</option>
                        <option value="notes">Personal Notes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Title</label>
                      <input
                        type="text"
                        placeholder="Tutorial title or document name"
                        value={textTitle}
                        onChange={(e) => setTextTitle(e.target.value)}
                        className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Split Rule</label>
                      <select
                        value={selectedRule}
                        onChange={(e) => setSelectedRule(e.target.value as any)}
                        className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="auto">Auto-Detect Best Rule</option>
                        <option value="markdown_headings">Markdown Headings (#, ##)</option>
                        <option value="step_keywords">Step / Part / Lesson Lines</option>
                        <option value="numbered_list">Numbered Lists (1., 2.)</option>
                        <option value="transcript_timestamps">Transcript Timestamps</option>
                        <option value="size_sentences">Sentence Size Chunks</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Content / Transcript (Copy & Paste)
                    </label>
                    <textarea
                      rows={10}
                      placeholder="Paste your tutorial transcript, blog post markdown, or chapter notes here..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl p-3 text-xs font-mono text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none"
                    />
                    <div className="flex justify-between items-center text-xs text-neutral-500 mt-1 font-mono">
                      <span>{rawText.length.toLocaleString()} characters</span>
                      {rawText.length > 50000 && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Large input: will be partitioned into per-part excerpts.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab C Content */}
              {activeTab === 'llm' && (
                <div className="space-y-4">
                  <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06] space-y-3">
                    <h3 className="text-xs font-semibold text-neutral-200">Convert Messy Walkthrough with Any LLM</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Copy our dedicated walkthrough prompt below, paste it into ChatGPT, Claude, Gemini, or a local LLM along with your notes, and paste the returned JSON plan back.
                    </p>
                    <button
                      onClick={() => {
                        const promptText = `Convert the following walkthrough tutorial/transcript into a structured, daily, sequential implementation plan.
Reply ONLY with valid JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "section": "Setup",
      "title": "Initial Scaffolding",
      "goal": "Setup repository and tools",
      "est_minutes": 45,
      "steps": ["Step 1", "Step 2"],
      "source_start": 0,
      "source_end": 754,
      "source_excerpt": "Relevant tutorial excerpt"
    }
  ]
}

# WALKTHROUGH CONTENT:
${rawText || videoDescription || '[Paste your tutorial or transcript content here]'}`;
                        navigator.clipboard.writeText(promptText);
                        setLlmPromptCopied(true);
                        setTimeout(() => setLlmPromptCopied(false), 2000);
                      }}
                      className="linear-btn-secondary !text-xs"
                    >
                      {llmPromptCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {llmPromptCopied ? 'Prompt Copied to Clipboard!' : 'Copy Walkthrough Prompt'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Paste LLM Reply JSON</label>
                    <textarea
                      rows={8}
                      placeholder="Paste the JSON response from the LLM here..."
                      value={llmPastedReply}
                      onChange={(e) => setLlmPastedReply(e.target.value)}
                      className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl p-3 text-xs font-mono text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Interactive Preview Table */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-200">
                    Proposed Parts Preview ({proposedParts.length} parts)
                  </h3>
                  {detectedRule && (
                    <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      Split successfully using rule: <span className="font-semibold">{detectedRule}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMergeSelected}
                    disabled={selectedRowIds.size < 2}
                    className="linear-btn-secondary !text-xs disabled:opacity-40"
                  >
                    <GitMerge className="w-3.5 h-3.5 text-indigo-400" />
                    Merge Selected ({selectedRowIds.size})
                  </button>
                  <button
                    onClick={() => setStep('input')}
                    className="linear-btn-secondary !text-xs"
                  >
                    ← Back to Input
                  </button>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="bg-amber-500/[0.08] border border-amber-500/20 p-3 rounded-xl space-y-1">
                  {warnings.map((w, idx) => (
                    <p key={idx} className="text-xs text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0a0b0f]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-neutral-400 border-b border-white/[0.06] font-mono text-[11px]">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.size === proposedParts.length && proposedParts.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRowIds(new Set(proposedParts.map((p) => p.id)));
                            } else {
                              setSelectedRowIds(new Set());
                            }
                          }}
                          className="rounded border-white/[0.2] bg-white/[0.05] text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="p-3 w-12 font-medium">#</th>
                      <th className="p-3 font-medium">Title</th>
                      <th className="p-3 w-36 font-medium">Section</th>
                      <th className="p-3 w-32 font-medium">Time Range</th>
                      <th className="p-3 w-20 font-medium">Est (min)</th>
                      <th className="p-3 w-12 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-neutral-300">
                    {proposedParts.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-white/[0.02]">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.has(p.id)}
                            onChange={(e) => {
                              const next = new Set(selectedRowIds);
                              if (e.target.checked) next.add(p.id);
                              else next.delete(p.id);
                              setSelectedRowIds(next);
                            }}
                            className="rounded border-white/[0.2] bg-white/[0.05] text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3 text-neutral-500 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={p.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProposedParts((prev) =>
                                prev.map((item) => (item.id === p.id ? { ...item, title: val } : item))
                              );
                            }}
                            className="w-full bg-transparent border-b border-transparent hover:border-white/[0.1] focus:border-indigo-500 focus:bg-white/[0.04] px-1.5 py-0.5 rounded text-xs text-neutral-100 outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={p.section}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProposedParts((prev) =>
                                prev.map((item) => (item.id === p.id ? { ...item, section: val } : item))
                              );
                            }}
                            className="w-full bg-transparent border-b border-transparent hover:border-white/[0.1] focus:border-indigo-500 focus:bg-white/[0.04] px-1.5 py-0.5 rounded text-xs text-neutral-100 outline-none"
                          />
                        </td>
                        <td className="p-3 font-mono text-[11px] text-neutral-400">
                          {p.sourceStart !== undefined ? (
                            <span>
                              {formatSecondsToTimestamp(p.sourceStart)}
                              {p.sourceEnd !== undefined ? ` - ${formatSecondsToTimestamp(p.sourceEnd)}` : ''}
                            </span>
                          ) : (
                            <span className="text-neutral-600">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={p.estMinutes}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setProposedParts((prev) =>
                                prev.map((item) => (item.id === p.id ? { ...item, estMinutes: val } : item))
                              );
                            }}
                            className="w-16 bg-transparent border border-white/[0.08] focus:border-indigo-500 px-1.5 py-0.5 rounded text-xs text-neutral-100 text-center font-mono outline-none"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteRow(p.id)}
                            className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Schedule Parameters */}
              <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Parts Per Day</label>
                  <select
                    value={partsPerDay}
                    onChange={(e) => setPartsPerDay(Number(e.target.value))}
                    className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value={1}>1 Part per Day (Recommended)</option>
                    <option value={2}>2 Parts per Day</option>
                    <option value={3}>3 Parts per Day</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Rest Day Cadence</label>
                  <div className="flex gap-2">
                    <select
                      value={restRuleType}
                      onChange={(e) => setRestRuleType(e.target.value as any)}
                      className="bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 flex-1 focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="every_n">Every N Days</option>
                      <option value="weekdays">Fixed Weekends</option>
                    </select>
                    {restRuleType === 'every_n' && (
                      <input
                        type="number"
                        min={2}
                        max={14}
                        value={restN}
                        onChange={(e) => setRestN(Number(e.target.value))}
                        className="w-20 bg-[#0a0b0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-100 text-center font-mono focus:outline-none focus:border-indigo-500/50"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-[#0c0d12] flex items-center justify-between">
          <button onClick={onClose} className="linear-btn-secondary !text-xs">
            Cancel
          </button>

          {step === 'input' ? (
            <button
              onClick={() => {
                if (activeTab === 'youtube') handleParseYouTube();
                else if (activeTab === 'text') handleParseText();
                else handleParseLLMReply();
              }}
              className="linear-btn-primary !text-xs shadow-linear-glow"
            >
              Parse & Preview Parts
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleCommitSchedule}
              disabled={isSubmitting || proposedParts.length === 0}
              className="linear-btn-primary !text-xs shadow-linear-glow"
            >
              {isSubmitting ? 'Writing to Plan...' : `Confirm & Schedule (${proposedParts.length} Parts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

