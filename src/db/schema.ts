import Dexie, { type Table } from 'dexie';
import { DEFAULT_TEMPLATES, type TemplateKind } from '../core/templates';

export interface Project {
  id?: number;
  name: string;
  description?: string;
  goal?: string;
  constraints?: string; // tech stack, limits, audience
  aiRules?: string; // rules for the AI: tone, language, code style
  status: 'active' | 'paused' | 'done' | 'archived';
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface Link {
  id?: number;
  projectId: number;
  url: string;
  title?: string;
  note?: string;
  pastedText?: string;
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface Section {
  id?: number;
  projectId: number;
  parentId?: number | null;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'review' | 'done';
  priority: 1 | 2 | 3; // 1 high, 2 normal, 3 low
  orderNo: number;
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface SectionDep {
  id?: number;
  sectionId: number;
  dependsOnId: number;
}

export type RestRule =
  | { type: 'every_n'; n: number }
  | { type: 'weekdays'; days: number[] } // 0 = Sunday, 1 = Monday...
  | { type: 'custom'; dates: string[] };

export interface Plan {
  id?: number;
  projectId: number;
  mode: 'manual' | 'ai' | 'hybrid';
  startDate: string; // YYYY-MM-DD
  deadline?: string | null; // YYYY-MM-DD
  partsPerDay: number;
  hoursPerDay: number;
  restRule: RestRule;
  difficultyRamp: 'none' | 'linear' | 'steep';
}

export interface Walkthrough {
  id?: number;
  projectId: number;
  type: 'video' | 'web' | 'text';
  url?: string;
  videoId?: string;
  title: string;
  description?: string;
  rawText: string; // Capped at 100,000 characters
  importedAt: string;
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface Part {
  id?: number;
  planId: number;
  sectionId?: number | null;
  orderNo: number;
  title: string;
  goal?: string;
  plannedDate: string; // YYYY-MM-DD
  isRest: number; // 0 or 1
  estMinutes?: number;
  status: 'planned' | 'done' | 'skipped' | 'moved';
  note?: string; // 'what I did' summary
  completedAt?: string | null;
  walkthroughId?: number | null;
  sourceStart?: number; // seconds
  sourceEnd?: number; // seconds
  sourceExcerpt?: string; // cap 6,000 characters
  sourceLabel?: string;
  stoppedAt?: string; // text or seconds, user note
  priority?: 'must' | 'should' | 'could'; // default should
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface PartStep {
  id?: number;
  partId: number;
  text: string;
  done: number; // 0 or 1
  orderNo: number;
}

export interface Memory {
  projectId: number;
  rollingSummary: string;
  glossary?: string;
  updatedAt: string;
}

export interface MemoryHistory {
  id?: number;
  projectId: number;
  rollingSummary: string;
  glossary?: string;
  createdAt: string;
}

export interface Decision {
  id?: number;
  projectId: number;
  text: string;
  reason?: string;
  createdAt: string;
  active: number; // 1 or 0
  // ADR extensions
  title?: string;
  status?: 'proposed' | 'accepted' | 'superseded' | 'deprecated';
  context?: string;
  decision?: string;
  consequences?: string;
  alternatives?: string;
  supersedesId?: number | null;
  decidedOn?: string;
  number?: number; // ADR-0001
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface Template {
  id?: number;
  kind: TemplateKind;
  name: string;
  body: string;
  isDefault: number; // 1 or 0
}

export interface Prompt {
  id?: number;
  projectId: number;
  partId?: number | null;
  sectionId?: number | null;
  kind: string;
  body: string;
  estTokens: number;
  version: number;
  createdAt: string;
}

export interface Response {
  id?: number;
  promptId: number;
  body: string;
  verdict: 'pending' | 'accepted' | 'rejected' | 'needs_revision';
  rating?: number;
  feedback?: string;
  createdAt: string;
}

export interface Snippet {
  id?: number;
  responseId?: number;
  projectId: number;
  language: string;
  title: string;
  code: string;
  description?: string;
  favorite?: number; // 0 or 1
  usageCount?: number;
  lastUsedAt?: string;
  source?: 'response' | 'manual' | 'bug';
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface Tag {
  id?: number;
  name: string;
  color: string;
}

export interface Tagging {
  id?: number;
  tagId: number;
  entityType: 'section' | 'part' | 'bug' | 'snippet' | 'checklist' | 'adr' | 'link' | 'project';
  entityId: number;
}

export interface TimeLog {
  id?: number;
  projectId: number;
  partId?: number | null;
  sectionId?: number | null;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  minutes: number;
  source: 'timer' | 'manual';
  note?: string;
}

export interface Milestone {
  id?: number;
  projectId: number;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'exam' | 'submission' | 'demo' | 'other';
}

export interface WeeklyReview {
  id?: number;
  projectId: number;
  weekStart: string; // YYYY-MM-DD
  statsSnapshot: string; // JSON
  responseBody?: string;
  acceptedAdjustments?: string; // JSON
  reflection?: string;
  createdAt: string;
}

export interface ChecklistTemplate {
  id?: number;
  name: string;
  description?: string;
  items: string[];
}

export interface Checklist {
  id?: number;
  projectId: number;
  partId?: number | null;
  name: string;
  createdFromTemplateId?: number | null;
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface ChecklistItem {
  id?: number;
  checklistId: number;
  text: string;
  done: number; // 0 or 1
  orderNo: number;
  note?: string;
}

export interface Bug {
  id?: number;
  projectId: number;
  title: string;
  description?: string;
  stepsToReproduce?: string;
  expected?: string;
  actual?: string;
  errorText?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'fixed' | 'wont_fix';
  partId?: number | null;
  linkedFiles?: string[];
  attempts?: Array<{
    promptId?: number;
    responseId?: number;
    outcome: 'worked' | 'partly' | 'failed';
    note?: string;
    createdAt: string;
  }>;
  createdAt: string;
  fixedAt?: string | null;
  resolutionNote?: string;
  deletedAt?: string | null;
  deleteBatchId?: string | null;
}

export interface RepoFile {
  id?: number;
  projectId: number;
  path: string;
  content: string;
  sizeChars: number;
  language: string;
  includeByDefault: number; // 0 or 1
  updatedAt: string;
}

export interface DevLog {
  id?: number;
  projectId: number;
  date: string; // YYYY-MM-DD
  partId?: number | null;
  kind: 'progress' | 'decision' | 'bug_fixed' | 'release' | 'note';
  text: string;
  minutes?: number;
  createdAt: string;
  source: 'auto' | 'manual';
}

export interface StudyItem {
  id?: number;
  type: 'course' | 'subject';
  name: string;
  goal?: string;
  level?: string;
  hoursPerDay?: number;
  planStartDate?: string;
  restWeekdays?: number[];
  revisionIntervals?: number[];
  platform?: string;
  instructor?: string;
  url?: string;
  totalLessons?: number;
  totalHours?: number;
  targetFinishDate?: string;
  syllabus?: string;
  examDate?: string;
  targetScore?: string;
  weakAreas?: string;
  tags?: string[];
  createdAt: string;
  archived: number;
}

export interface StudyUnit {
  id?: number;
  itemId: number;
  title: string;
  order: number;
  weight?: number;
}

export interface StudyTopic {
  id?: number;
  unitId: number;
  itemId: number;
  title: string;
  minutes: number;
  status: 'not_started' | 'learning' | 'done' | 'needs_revision';
  sessionType?: 'learn' | 'practice' | 'revise' | 'mock_test';
  order: number;
  pageStart?: number;
  pageEnd?: number;
  notes?: string;
  tags?: string[];
}

export interface StudySession {
  id?: number;
  itemId: number;
  date: string;
  type: 'learn' | 'practice' | 'revise' | 'mock_test' | 'rest';
  topicIds: number[];
  plannedMinutes: number;
  actualMinutes?: number;
  done: number;
  spacedReview?: 1;
  reviewStage?: number;
  reviewInterval?: number;
  reviewEase?: number;
  reviewRating?: 'forgot' | 'hard' | 'good' | 'easy';
}

export interface StudyMemory {
  itemId: number;
  summary: string;
  concepts: string[];
  understood: string[];
  weak: string[];
  doubts: string[];
  levelAndStyle?: string;
  updatedAt: string;
}

export interface StudyCard {
  id?: number;
  itemId: number;
  topicId?: number;
  front: string;
  back: string;
  interval: number;
  ease: number;
  dueDate: string;
  tags?: string[];
  reviewCount?: number;
}

export interface StudyQuiz {
  id?: number;
  itemId: number;
  questions: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
}

export interface StudyLog {
  id?: number;
  itemId: number;
  date: string;
  understood: string;
  notUnderstood: string;
  minutes: number;
  mood?: string;
}

export interface StudyResource {
  id?: number;
  itemId: number;
  title: string;
  url?: string;
  type: string;
}

export interface StudyResponseHistory {
  id?: number;
  itemId: number;
  topicId?: number;
  kind: 'plan' | 'learn' | 'practice' | 'doubt' | 'memory' | 'flashcards' | 'quiz' | 'cheat_sheet' | 'weekly_review' | 'other';
  title: string;
  prompt?: string;
  response: string;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
}

export const STARTER_CHECKLIST_TEMPLATES: Array<Omit<ChecklistTemplate, 'id'>> = [
  {
    name: 'Before committing code',
    description: 'Quality and testing checks before git commit',
    items: ['Lint checks pass with 0 errors', 'Unit test suites pass', 'No debug console.log or commented dead code', 'Documentation or comments updated'],
  },
  {
    name: 'Release checklist',
    description: 'Verification before releasing or deploying new version',
    items: ['Production build succeeds with 0 warnings', 'Offline PWA service worker precaches assets', 'Database schema migration validated', 'Changelog updated'],
  },
  {
    name: 'Bug-fix checklist',
    description: 'Systematic debugging verification',
    items: ['Reproduced bug consistently', 'Root cause identified', 'Regression test added', 'Fix verified on local environment'],
  },
  {
    name: 'Exam week',
    description: 'Structured study checklist for exam readiness',
    items: ['Review high-priority syllabus topics', 'Solve 3 previous exam questions', 'Prepare concise formula / concept sheet', 'Self-test without notes'],
  },
  {
    name: 'Assignment submission',
    description: 'Pre-submission requirements check',
    items: ['Meets all prompt criteria and deliverables', 'Code formatted and zipped / linked', 'Plagiarism / AI attribution review', 'Submitted before deadline'],
  },
  {
    name: 'Daily study routine',
    description: 'Daily habit checklist',
    items: ['Set today\'s single highest priority', 'Complete scheduled part', 'Record notes and blockers', 'Log time and update memory'],
  },
];

export class ProjectPilotDB extends Dexie {
  projects!: Table<Project, number>;
  links!: Table<Link, number>;
  sections!: Table<Section, number>;
  sectionDeps!: Table<SectionDep, number>;
  plans!: Table<Plan, number>;
  parts!: Table<Part, number>;
  partSteps!: Table<PartStep, number>;
  memory!: Table<Memory, number>;
  memoryHistory!: Table<MemoryHistory, number>;
  decisions!: Table<Decision, number>;
  templates!: Table<Template, number>;
  prompts!: Table<Prompt, number>;
  responses!: Table<Response, number>;
  snippets!: Table<Snippet, number>;
  walkthroughs!: Table<Walkthrough, number>;
  settings!: Table<Setting, string>;
  // Pack 2 Tables
  tags!: Table<Tag, number>;
  taggings!: Table<Tagging, number>;
  timeLogs!: Table<TimeLog, number>;
  milestones!: Table<Milestone, number>;
  weeklyReviews!: Table<WeeklyReview, number>;
  checklistTemplates!: Table<ChecklistTemplate, number>;
  checklists!: Table<Checklist, number>;
  checklistItems!: Table<ChecklistItem, number>;
  bugs!: Table<Bug, number>;
  repoFiles!: Table<RepoFile, number>;
  devLog!: Table<DevLog, number>;
  study_items!: Table<StudyItem, number>;
  study_units!: Table<StudyUnit, number>;
  study_topics!: Table<StudyTopic, number>;
  study_sessions!: Table<StudySession, number>;
  study_memory!: Table<StudyMemory, number>;
  study_cards!: Table<StudyCard, number>;
  study_quizzes!: Table<StudyQuiz, number>;
  study_logs!: Table<StudyLog, number>;
  study_resources!: Table<StudyResource, number>;
  study_response_history!: Table<StudyResponseHistory, number>;

  constructor() {
    super('projectpilot_web');
    this.version(1).stores({
      projects: '++id, status, updatedAt',
      links: '++id, projectId',
      sections: '++id, projectId, parentId, orderNo, status',
      sectionDeps: '++id, sectionId, dependsOnId',
      plans: '++id, &projectId',
      parts: '++id, planId, sectionId, orderNo, plannedDate, status',
      partSteps: '++id, partId',
      memory: '&projectId',
      memoryHistory: '++id, projectId, createdAt',
      decisions: '++id, projectId, active',
      templates: '++id, kind, isDefault',
      prompts: '++id, projectId, partId, sectionId, kind, createdAt',
      responses: '++id, promptId, verdict',
      snippets: '++id, responseId, projectId',
      settings: '&key',
    });

    this.version(2)
      .stores({
        walkthroughs: '++id, projectId',
      })
      .upgrade(async () => {
        // Version 2 upgrade
      });

    this.version(3)
      .stores({
        tags: '++id, &name',
        taggings: '++id, tagId, [entityType+entityId]',
        timeLogs: '++id, projectId, partId, startedAt',
        milestones: '++id, projectId, date',
        weeklyReviews: '++id, projectId, weekStart',
        checklistTemplates: '++id, name',
        checklists: '++id, projectId, partId',
        checklistItems: '++id, checklistId',
        bugs: '++id, projectId, status, severity',
        repoFiles: '++id, projectId, path',
        devLog: '++id, projectId, date',
      })
      .upgrade(async () => {
        // Version 3 upgrade: existing data seamlessly works with optional priority and soft delete
      });

    this.version(4).stores({
      study_items: '++id, type, name, archived, createdAt',
      study_units: '++id, itemId, order',
      study_topics: '++id, unitId, itemId, status, order',
      study_sessions: '++id, itemId, date, type, done',
      study_memory: '&itemId',
      study_cards: '++id, itemId, topicId, dueDate',
      study_quizzes: '++id, itemId',
      study_logs: '++id, itemId, date',
      study_resources: '++id, itemId, type',
    });

    this.version(5).stores({
      study_response_history: '++id, itemId, createdAt, kind, topicId',
    });

    this.on('populate', () => {
      // Seed default templates
      const templatesToSeed: Template[] = DEFAULT_TEMPLATES.map((t) => ({
        kind: t.kind,
        name: t.name,
        body: t.body,
        isDefault: 1,
      }));
      this.templates.bulkAdd(templatesToSeed);

      // Seed starter checklist templates
      this.checklistTemplates.bulkAdd(STARTER_CHECKLIST_TEMPLATES);
    });
  }
}

export const db = new ProjectPilotDB();

/**
 * Ensures default templates exist if database is already opened or refreshed
 */
export async function ensureDefaultTemplates(): Promise<void> {
  const count = await db.templates.count();
  if (count === 0) {
    const templatesToSeed: Template[] = DEFAULT_TEMPLATES.map((t) => ({
      kind: t.kind,
      name: t.name,
      body: t.body,
      isDefault: 1,
    }));
    await db.templates.bulkAdd(templatesToSeed);
  }

  const checklistCount = await db.checklistTemplates.count();
  if (checklistCount === 0) {
    await db.checklistTemplates.bulkAdd(STARTER_CHECKLIST_TEMPLATES);
  }
}
