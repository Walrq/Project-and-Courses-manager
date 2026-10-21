import { estimateTokens } from './tokenEstimate';

export type BlockId =
  | 'ROLE'
  | 'PROJECT'
  | 'RULES'
  | 'TAGS'
  | 'MEMORY'
  | 'DECISIONS'
  | 'PLAN_POSITION'
  | 'RELATED'
  | 'TREE'
  | 'FILES'
  | 'SOURCE'
  | 'TASK'
  | 'OUTPUT_FORMAT'
  | 'END_INSTRUCTION';

export type ContextLevel = 'minimal' | 'standard' | 'full';

export interface PromptBlock {
  id: BlockId;
  label: string;
  heading: string;
  text: string;
  priority: number; // lower number = higher importance (never drop: TASK, OUTPUT_FORMAT, RULES)
  enabled: boolean;
}

export interface PromptBuilderInput {
  role?: string;
  project: {
    name: string;
    description?: string;
    goal?: string;
    constraints?: string;
    aiRules?: string;
  };
  tags?: string[];
  memory?: {
    rollingSummary?: string;
    glossary?: string;
  };
  decisions?: Array<{ text: string; reason?: string }>;
  planPosition?: {
    currentPartIndex: number;
    totalParts: number;
    sectionTitle?: string;
    previousPartSummary?: string;
  };
  related?: Array<{
    title: string;
    content: string;
  }>;
  tree?: string;
  files?: Array<{
    path: string;
    content: string;
    priority?: number;
  }>;
  source?: {
    title: string;
    url?: string;
    excerpt?: string;
    stoppedAt?: string;
  };
  task: {
    title: string;
    goal?: string;
    steps?: Array<{ text: string; done?: boolean }>;
    stoppedAt?: string;
  };
  outputFormat?: string;
  endInstruction?: string;
  contextLevel?: ContextLevel;
  customBlockStates?: Partial<Record<BlockId, boolean>>;
  tokenLimit?: number;
}

export interface PromptBuildResult {
  blocks: PromptBlock[];
  fullPrompt: string;
  tokenCount: number;
  trimmedNotes: string[];
}

export function getDefaultBlocksForLevel(level: ContextLevel): Record<BlockId, boolean> {
  const defaults: Record<BlockId, boolean> = {
    ROLE: true,
    PROJECT: true,
    RULES: false,
    TAGS: false,
    MEMORY: false,
    DECISIONS: false,
    PLAN_POSITION: false,
    RELATED: false,
    TREE: false,
    FILES: false,
    SOURCE: false,
    TASK: true,
    OUTPUT_FORMAT: true,
    END_INSTRUCTION: true,
  };

  if (level === 'standard' || level === 'full') {
    defaults.RULES = true;
    defaults.MEMORY = true;
    defaults.DECISIONS = true;
    defaults.PLAN_POSITION = true;
    defaults.SOURCE = true;
    defaults.TREE = true;
    defaults.FILES = true;
  }

  if (level === 'full') {
    defaults.RELATED = true;
    defaults.TAGS = true;
  }

  return defaults;
}

export function buildPromptBlocks(input: PromptBuilderInput): PromptBlock[] {
  const level = input.contextLevel || 'full';
  const defaultStates = getDefaultBlocksForLevel(level);
  const states = { ...defaultStates, ...input.customBlockStates };

  // 1. ROLE
  const roleText =
    input.role?.trim() ||
    'You are an expert pair-programming software engineer executing today\'s dedicated part of the project.';

  // 2. PROJECT
  const projectParts: string[] = [];
  projectParts.push(`Name: ${input.project.name}`);
  if (input.project.description?.trim()) projectParts.push(`Description: ${input.project.description.trim()}`);
  if (input.project.goal?.trim()) projectParts.push(`Goal: ${input.project.goal.trim()}`);
  if (input.project.constraints?.trim()) projectParts.push(`Constraints: ${input.project.constraints.trim()}`);
  const projectText = projectParts.join('\n');

  // TAGS (optional)
  const tagsText = input.tags && input.tags.length > 0 ? `Tags: ${input.tags.join(', ')}` : '';

  // 3. RULES
  const rulesText = input.project.aiRules?.trim() || 'Follow idiomatic patterns, keep code clean, modular, and maintainable.';

  // 4. MEMORY
  const memoryParts: string[] = [];
  if (input.memory?.rollingSummary?.trim()) {
    memoryParts.push(`## Rolling Summary\n${input.memory.rollingSummary.trim()}`);
  }
  if (input.memory?.glossary?.trim()) {
    memoryParts.push(`## Glossary\n${input.memory.glossary.trim()}`);
  }
  const memoryText = memoryParts.join('\n\n');

  // 5. DECISIONS
  const decisionsList = (input.decisions || []).filter((d) => d.text.trim());
  const decisionsText =
    decisionsList.length > 0
      ? 'Do not contradict these decisions:\n' +
        decisionsList.map((d) => `- ${d.text}${d.reason ? ` (${d.reason})` : ''}`).join('\n')
      : '';

  // 6. PLAN_POSITION
  let planPositionText = '';
  if (input.planPosition) {
    const { currentPartIndex, totalParts, sectionTitle, previousPartSummary } = input.planPosition;
    planPositionText = `This is part ${currentPartIndex} of ${totalParts}${
      sectionTitle ? ` in section '${sectionTitle}'` : ''
    }.`;
    if (previousPartSummary?.trim()) {
      planPositionText += ` Last time we completed: ${previousPartSummary.trim()}`;
    }
  }

  // 7. RELATED
  const relatedList = (input.related || []).filter((r) => r.content.trim());
  const relatedText = relatedList.map((r) => `### ${r.title}\n${r.content}`).join('\n\n');

  // TREE
  const treeText = input.tree?.trim() ? `\`\`\`\n${input.tree.trim()}\n\`\`\`` : '';

  // FILES
  const filesList = (input.files || []).filter((f) => f.content.trim());
  const filesText = filesList
    .map((f) => `\`\`\`${f.path}\n${f.content.trim()}\n\`\`\``)
    .join('\n\n');

  // SOURCE (Walkthrough)
  let sourceText = '';
  if (input.source && (input.source.title || input.source.excerpt)) {
    const sourceParts: string[] = [];
    const sourceLink = input.source.url ? ` (${input.source.url})` : '';
    sourceParts.push(`The user is following this walkthrough: ${input.source.title}${sourceLink}.`);
    if (input.source.excerpt?.trim()) {
      sourceParts.push(`The relevant part is:\n${input.source.excerpt.trim()}`);
    }
    if (input.source.stoppedAt?.trim()) {
      sourceParts.push(`Where I stopped previously: ${input.source.stoppedAt.trim()}`);
    }
    sourceText = sourceParts.join('\n\n');
  }

  // 8. TASK
  const hasSource = Boolean(sourceText);
  const taskParts: string[] = [`**Title:** ${input.task.title}`];
  if (hasSource) {
    taskParts.push('**Context:** Help me follow, understand, and implement this walkthrough segment.');
  }
  if (input.task.goal?.trim()) {
    taskParts.push(`**Goal:** ${input.task.goal.trim()}`);
  }
  if (input.task.stoppedAt?.trim()) {
    taskParts.push(`**Resuming From:** ${input.task.stoppedAt.trim()}`);
  }
  if (input.task.steps && input.task.steps.length > 0) {
    taskParts.push('**Checklist:**');
    for (const step of input.task.steps) {
      taskParts.push(`- [${step.done ? 'x' : ' '}] ${step.text}`);
    }
  }
  const taskText = taskParts.join('\n');

  // 9. OUTPUT_FORMAT
  let outputFormatText = input.outputFormat?.trim();
  if (!outputFormatText) {
    if (hasSource) {
      outputFormatText = `Produce the deliverable according to the walkthrough segment.
Provide:
1. Short recap of what this walkthrough segment covers
2. Step-by-step instructions matching the source
3. Common mistakes and pitfalls to avoid
4. Quick self-check question to verify the implementation`;
    } else {
      outputFormatText = `Produce the deliverable according to the task goal.
At the end, provide:
1. 'Summary of what was done' (max 5 bullet points)
2. 'Open questions' (if any)`;
    }
  }

  // 10. END_INSTRUCTION
  const endInstructionText =
    input.endInstruction?.trim() ||
    'If anything is unclear, state your assumptions at the top, then continue.';

  const blocks: PromptBlock[] = [
    {
      id: 'ROLE',
      label: 'Role',
      heading: '# ROLE',
      text: roleText,
      priority: 5,
      enabled: Boolean(states.ROLE && roleText),
    },
    {
      id: 'PROJECT',
      label: 'Project Context',
      heading: '# PROJECT',
      text: projectText,
      priority: 4,
      enabled: Boolean(states.PROJECT && projectText),
    },
    {
      id: 'TAGS',
      label: 'Tags',
      heading: '# TAGS',
      text: tagsText,
      priority: 10,
      enabled: Boolean(states.TAGS && tagsText),
    },
    {
      id: 'RULES',
      label: 'AI Rules',
      heading: '# RULES',
      text: rulesText,
      priority: 1, // Protected, never drop
      enabled: Boolean(states.RULES && rulesText),
    },
    {
      id: 'MEMORY',
      label: 'Project Memory',
      heading: '# MEMORY',
      text: memoryText,
      priority: 8,
      enabled: Boolean(states.MEMORY && memoryText),
    },
    {
      id: 'DECISIONS',
      label: 'Active Decisions',
      heading: '# DECISIONS',
      text: decisionsText,
      priority: 6,
      enabled: Boolean(states.DECISIONS && decisionsText),
    },
    {
      id: 'PLAN_POSITION',
      label: 'Plan Position',
      heading: '# PLAN POSITION',
      text: planPositionText,
      priority: 7,
      enabled: Boolean(states.PLAN_POSITION && planPositionText),
    },
    {
      id: 'RELATED',
      label: 'Related References',
      heading: '# RELATED',
      text: relatedText,
      priority: 9,
      enabled: Boolean(states.RELATED && relatedText),
    },
    {
      id: 'TREE',
      label: 'Repository Tree',
      heading: '# REPO TREE',
      text: treeText,
      priority: 8,
      enabled: Boolean(states.TREE && treeText),
    },
    {
      id: 'FILES',
      label: 'Repository Files',
      heading: '# REPO FILES',
      text: filesText,
      priority: 11,
      enabled: Boolean(states.FILES && filesText),
    },
    {
      id: 'SOURCE',
      label: 'Walkthrough Source',
      heading: '# SOURCE',
      text: sourceText,
      priority: 8,
      enabled: Boolean(states.SOURCE && sourceText),
    },
    {
      id: 'TASK',
      label: 'Today\'s Task',
      heading: '# TASK',
      text: taskText,
      priority: 1, // Protected, never drop
      enabled: Boolean(states.TASK && taskText),
    },
    {
      id: 'OUTPUT_FORMAT',
      label: 'Output Format',
      heading: '# OUTPUT FORMAT',
      text: outputFormatText,
      priority: 1, // Protected, never drop
      enabled: Boolean(states.OUTPUT_FORMAT && outputFormatText),
    },
    {
      id: 'END_INSTRUCTION',
      label: 'End Instruction',
      heading: '# INSTRUCTIONS',
      text: endInstructionText,
      priority: 3,
      enabled: Boolean(states.END_INSTRUCTION && endInstructionText),
    },
  ];

  return blocks;
}

export function formatPromptString(blocks: PromptBlock[]): string {
  return blocks
    .filter((b) => b.enabled && b.text.trim().length > 0)
    .map((b) => `${b.heading}\n${b.text.trim()}`)
    .join('\n\n');
}

/**
 * Token limit trimming according to plan specifications:
 * Order of dropping:
 * 1. FILES (drop whole files, lowest priority first, never cut mid-file)
 * 2. SOURCE
 * 3. RELATED
 * 4. MEMORY (keep most recent characters or drop)
 * 5. PLAN_POSITION
 * Never drop TASK, OUTPUT_FORMAT, or RULES.
 */
export function buildPromptWithTrimming(input: PromptBuilderInput): PromptBuildResult {
  const blocks = buildPromptBlocks(input);
  const trimmedNotes: string[] = [];

  let currentString = formatPromptString(blocks);
  let est = estimateTokens(currentString);

  const limit = input.tokenLimit;
  if (!limit || est.tokens <= limit) {
    return {
      blocks,
      fullPrompt: currentString,
      tokenCount: est.tokens,
      trimmedNotes,
    };
  }

  // 1. Try dropping FILES (if present)
  const filesBlock = blocks.find((b) => b.id === 'FILES');
  if (filesBlock && filesBlock.enabled && filesBlock.text) {
    filesBlock.enabled = false;
    trimmedNotes.push('Dropped REPO FILES block to fit token budget.');
    currentString = formatPromptString(blocks);
    est = estimateTokens(currentString);
    if (est.tokens <= limit) {
      return { blocks, fullPrompt: currentString, tokenCount: est.tokens, trimmedNotes };
    }
  }

  // 2. Try dropping SOURCE
  const sourceBlock = blocks.find((b) => b.id === 'SOURCE');
  if (sourceBlock && sourceBlock.enabled && sourceBlock.text) {
    sourceBlock.enabled = false;
    trimmedNotes.push('Dropped SOURCE block to fit token budget.');
    currentString = formatPromptString(blocks);
    est = estimateTokens(currentString);
    if (est.tokens <= limit) {
      return { blocks, fullPrompt: currentString, tokenCount: est.tokens, trimmedNotes };
    }
  }

  // 3. Try dropping RELATED
  const relatedBlock = blocks.find((b) => b.id === 'RELATED');
  if (relatedBlock && relatedBlock.enabled && relatedBlock.text) {
    relatedBlock.enabled = false;
    trimmedNotes.push('Dropped RELATED block to fit token budget.');
    currentString = formatPromptString(blocks);
    est = estimateTokens(currentString);
    if (est.tokens <= limit) {
      return { blocks, fullPrompt: currentString, tokenCount: est.tokens, trimmedNotes };
    }
  }

  // 4. Try truncating MEMORY (keep most recent characters)
  const memoryBlock = blocks.find((b) => b.id === 'MEMORY');
  if (memoryBlock && memoryBlock.enabled && memoryBlock.text) {
    const charsOver = (est.tokens - limit) * 4;
    const originalLength = memoryBlock.text.length;
    if (originalLength > charsOver + 100) {
      // Truncate from beginning to keep most recent content
      const keepChars = Math.max(100, originalLength - charsOver - 200);
      memoryBlock.text = '...[older memory truncated]...\n' + memoryBlock.text.slice(-keepChars);
      trimmedNotes.push(`Truncated MEMORY block by ${originalLength - keepChars} characters.`);
    } else {
      memoryBlock.enabled = false;
      trimmedNotes.push('Dropped MEMORY block to fit token budget.');
    }
    currentString = formatPromptString(blocks);
    est = estimateTokens(currentString);
    if (est.tokens <= limit) {
      return { blocks, fullPrompt: currentString, tokenCount: est.tokens, trimmedNotes };
    }
  }

  // 5. Try dropping PLAN_POSITION
  const positionBlock = blocks.find((b) => b.id === 'PLAN_POSITION');
  if (positionBlock && positionBlock.enabled && positionBlock.text) {
    positionBlock.enabled = false;
    trimmedNotes.push('Dropped PLAN_POSITION block to fit token budget.');
    currentString = formatPromptString(blocks);
    est = estimateTokens(currentString);
    if (est.tokens <= limit) {
      return { blocks, fullPrompt: currentString, tokenCount: est.tokens, trimmedNotes };
    }
  }

  // (TASK, OUTPUT_FORMAT, RULES are never dropped)
  return {
    blocks,
    fullPrompt: currentString,
    tokenCount: est.tokens,
    trimmedNotes,
  };
}

/**
 * Variable interpolation and detection of unknown variables
 */
export function interpolateTemplateVariables(
  template: string,
  variables: Record<string, string | undefined>
): { result: string; unknownVariables: string[] } {
  const unknownVariables: string[] = [];
  const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;

  const result = template.replace(regex, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(variables, varName)) {
      return variables[varName] ?? '';
    } else {
      if (!unknownVariables.includes(varName)) {
        unknownVariables.push(varName);
      }
      return match; // Keep unreplaced so it can be highlighted
    }
  });

  return { result, unknownVariables };
}
