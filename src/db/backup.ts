import { z } from 'zod';
import { db } from './schema';

const BackupPayloadSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  data: z.object({
    projects: z.array(z.any()),
    links: z.array(z.any()),
    sections: z.array(z.any()),
    sectionDeps: z.array(z.any()),
    plans: z.array(z.any()),
    parts: z.array(z.any()),
    partSteps: z.array(z.any()),
    memory: z.array(z.any()),
    memoryHistory: z.array(z.any()),
    decisions: z.array(z.any()),
    templates: z.array(z.any()),
    prompts: z.array(z.any()),
    responses: z.array(z.any()),
    snippets: z.array(z.any()),
    walkthroughs: z.array(z.any()).optional().default([]),
    tags: z.array(z.any()).optional().default([]),
    taggings: z.array(z.any()).optional().default([]),
    timeLogs: z.array(z.any()).optional().default([]),
    milestones: z.array(z.any()).optional().default([]),
    weeklyReviews: z.array(z.any()).optional().default([]),
    checklistTemplates: z.array(z.any()).optional().default([]),
    checklists: z.array(z.any()).optional().default([]),
    checklistItems: z.array(z.any()).optional().default([]),
    bugs: z.array(z.any()).optional().default([]),
    repoFiles: z.array(z.any()).optional().default([]),
    devLog: z.array(z.any()).optional().default([]),
    settings: z.array(z.any()),
    study_items: z.array(z.any()).optional().default([]),
    study_units: z.array(z.any()).optional().default([]),
    study_topics: z.array(z.any()).optional().default([]),
    study_sessions: z.array(z.any()).optional().default([]),
    study_memory: z.array(z.any()).optional().default([]),
    study_cards: z.array(z.any()).optional().default([]),
    study_quizzes: z.array(z.any()).optional().default([]),
    study_logs: z.array(z.any()).optional().default([]),
    study_resources: z.array(z.any()).optional().default([]),
    study_response_history: z.array(z.any()).optional().default([]),
  }),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

export async function exportDatabaseToJSON(): Promise<string> {
  const [
    projects,
    links,
    sections,
    sectionDeps,
    plans,
    parts,
    partSteps,
    memory,
    memoryHistory,
    decisions,
    templates,
    prompts,
    responses,
    snippets,
    walkthroughs,
    tags,
    taggings,
    timeLogs,
    milestones,
    weeklyReviews,
    checklistTemplates,
    checklists,
    checklistItems,
    bugs,
    repoFiles,
    devLog,
    settings,
    studyItems,
    studyUnits,
    studyTopics,
    studySessions,
    studyMemory,
    studyCards,
    studyQuizzes,
    studyLogs,
    studyResources,
    studyResponseHistory,
  ] = await Promise.all([
    db.projects.toArray(),
    db.links.toArray(),
    db.sections.toArray(),
    db.sectionDeps.toArray(),
    db.plans.toArray(),
    db.parts.toArray(),
    db.partSteps.toArray(),
    db.memory.toArray(),
    db.memoryHistory.toArray(),
    db.decisions.toArray(),
    db.templates.toArray(),
    db.prompts.toArray(),
    db.responses.toArray(),
    db.snippets.toArray(),
    db.walkthroughs.toArray(),
    db.tags.toArray(),
    db.taggings.toArray(),
    db.timeLogs.toArray(),
    db.milestones.toArray(),
    db.weeklyReviews.toArray(),
    db.checklistTemplates.toArray(),
    db.checklists.toArray(),
    db.checklistItems.toArray(),
    db.bugs.toArray(),
    db.repoFiles.toArray(),
    db.devLog.toArray(),
    db.settings.toArray(),
    db.study_items.toArray(),
    db.study_units.toArray(),
    db.study_topics.toArray(),
    db.study_sessions.toArray(),
    db.study_memory.toArray(),
    db.study_cards.toArray(),
    db.study_quizzes.toArray(),
    db.study_logs.toArray(),
    db.study_resources.toArray(),
    db.study_response_history.toArray(),
  ]);

  const payload: BackupPayload = {
    version: 5,
    exportedAt: new Date().toISOString(),
    data: {
      projects,
      links,
      sections,
      sectionDeps,
      plans,
      parts,
      partSteps,
      memory,
      memoryHistory,
      decisions,
      templates,
      prompts,
      responses,
      snippets,
      walkthroughs,
      tags,
      taggings,
      timeLogs,
      milestones,
      weeklyReviews,
      checklistTemplates,
      checklists,
      checklistItems,
      bugs,
      repoFiles,
      devLog,
      settings,
      study_items: studyItems,
      study_units: studyUnits,
      study_topics: studyTopics,
      study_sessions: studySessions,
      study_memory: studyMemory,
      study_cards: studyCards,
      study_quizzes: studyQuizzes,
      study_logs: studyLogs,
      study_resources: studyResources,
      study_response_history: studyResponseHistory,
    },
  };

  return JSON.stringify(payload, null, 2);
}

export function downloadBackupFile(jsonString: string, customFilename?: string): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `progress-den-backup-${dateStr}.json`;
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreDatabaseFromJSON(jsonString: string): Promise<{ success: boolean; error?: string }> {
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return { success: false, error: 'Invalid JSON format. Please upload a valid JSON backup file.' };
    }

    const validationResult = BackupPayloadSchema.safeParse(parsed);
    if (!validationResult.success) {
      const issues = validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { success: false, error: `Invalid backup schema: ${issues}` };
    }

    const { data } = validationResult.data;

    // Wrap restore in a single transaction across all tables
    await db.transaction(
      'rw',
      [
        db.projects,
        db.links,
        db.sections,
        db.sectionDeps,
        db.plans,
        db.parts,
        db.partSteps,
        db.memory,
        db.memoryHistory,
        db.decisions,
        db.templates,
        db.prompts,
        db.responses,
        db.snippets,
        db.walkthroughs,
        db.tags,
        db.taggings,
        db.timeLogs,
        db.milestones,
        db.weeklyReviews,
        db.checklistTemplates,
        db.checklists,
        db.checklistItems,
        db.bugs,
        db.repoFiles,
        db.devLog,
        db.settings,
        db.study_items,
        db.study_units,
        db.study_topics,
        db.study_sessions,
        db.study_memory,
        db.study_cards,
        db.study_quizzes,
        db.study_logs,
        db.study_resources,
        db.study_response_history,
      ],
      async () => {
        // Clear all existing data
        await Promise.all([
          db.projects.clear(),
          db.links.clear(),
          db.sections.clear(),
          db.sectionDeps.clear(),
          db.plans.clear(),
          db.parts.clear(),
          db.partSteps.clear(),
          db.memory.clear(),
          db.memoryHistory.clear(),
          db.decisions.clear(),
          db.templates.clear(),
          db.prompts.clear(),
          db.responses.clear(),
          db.snippets.clear(),
          db.walkthroughs.clear(),
          db.tags.clear(),
          db.taggings.clear(),
          db.timeLogs.clear(),
          db.milestones.clear(),
          db.weeklyReviews.clear(),
          db.checklistTemplates.clear(),
          db.checklists.clear(),
          db.checklistItems.clear(),
          db.bugs.clear(),
          db.repoFiles.clear(),
          db.devLog.clear(),
          db.settings.clear(),
          db.study_items.clear(),
          db.study_units.clear(),
          db.study_topics.clear(),
          db.study_sessions.clear(),
          db.study_memory.clear(),
          db.study_cards.clear(),
          db.study_quizzes.clear(),
          db.study_logs.clear(),
          db.study_resources.clear(),
          db.study_response_history.clear(),
        ]);

        // Bulk insert restored data
        await Promise.all([
          db.projects.bulkAdd(data.projects),
          db.links.bulkAdd(data.links),
          db.sections.bulkAdd(data.sections),
          db.sectionDeps.bulkAdd(data.sectionDeps),
          db.plans.bulkAdd(data.plans),
          db.parts.bulkAdd(data.parts),
          db.partSteps.bulkAdd(data.partSteps),
          db.memory.bulkAdd(data.memory),
          db.memoryHistory.bulkAdd(data.memoryHistory),
          db.decisions.bulkAdd(data.decisions),
          db.templates.bulkAdd(data.templates),
          db.prompts.bulkAdd(data.prompts),
          db.responses.bulkAdd(data.responses),
          db.snippets.bulkAdd(data.snippets),
          data.walkthroughs && data.walkthroughs.length > 0 ? db.walkthroughs.bulkAdd(data.walkthroughs) : Promise.resolve(),
          data.tags && data.tags.length > 0 ? db.tags.bulkAdd(data.tags) : Promise.resolve(),
          data.taggings && data.taggings.length > 0 ? db.taggings.bulkAdd(data.taggings) : Promise.resolve(),
          data.timeLogs && data.timeLogs.length > 0 ? db.timeLogs.bulkAdd(data.timeLogs) : Promise.resolve(),
          data.milestones && data.milestones.length > 0 ? db.milestones.bulkAdd(data.milestones) : Promise.resolve(),
          data.weeklyReviews && data.weeklyReviews.length > 0 ? db.weeklyReviews.bulkAdd(data.weeklyReviews) : Promise.resolve(),
          data.checklistTemplates && data.checklistTemplates.length > 0 ? db.checklistTemplates.bulkAdd(data.checklistTemplates) : Promise.resolve(),
          data.checklists && data.checklists.length > 0 ? db.checklists.bulkAdd(data.checklists) : Promise.resolve(),
          data.checklistItems && data.checklistItems.length > 0 ? db.checklistItems.bulkAdd(data.checklistItems) : Promise.resolve(),
          data.bugs && data.bugs.length > 0 ? db.bugs.bulkAdd(data.bugs) : Promise.resolve(),
          data.repoFiles && data.repoFiles.length > 0 ? db.repoFiles.bulkAdd(data.repoFiles) : Promise.resolve(),
          data.devLog && data.devLog.length > 0 ? db.devLog.bulkAdd(data.devLog) : Promise.resolve(),
          db.settings.bulkAdd(data.settings),
          data.study_items.length ? db.study_items.bulkAdd(data.study_items) : Promise.resolve(),
          data.study_units.length ? db.study_units.bulkAdd(data.study_units) : Promise.resolve(),
          data.study_topics.length ? db.study_topics.bulkAdd(data.study_topics) : Promise.resolve(),
          data.study_sessions.length ? db.study_sessions.bulkAdd(data.study_sessions) : Promise.resolve(),
          data.study_memory.length ? db.study_memory.bulkAdd(data.study_memory) : Promise.resolve(),
          data.study_cards.length ? db.study_cards.bulkAdd(data.study_cards) : Promise.resolve(),
          data.study_quizzes.length ? db.study_quizzes.bulkAdd(data.study_quizzes) : Promise.resolve(),
          data.study_logs.length ? db.study_logs.bulkAdd(data.study_logs) : Promise.resolve(),
          data.study_resources.length ? db.study_resources.bulkAdd(data.study_resources) : Promise.resolve(),
          data.study_response_history.length ? db.study_response_history.bulkAdd(data.study_response_history) : Promise.resolve(),
        ]);
      }
    );

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to restore database: ${errorMsg}` };
  }
}
