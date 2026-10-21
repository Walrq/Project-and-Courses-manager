import { db, type Project } from '../schema';

export const projectRepo = {
  async getAll(): Promise<Project[]> {
    return db.projects.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id: number): Promise<Project | undefined> {
    return db.projects.get(id);
  },

  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    return db.projects.add({
      ...project,
      status: project.status || 'active',
      createdAt: now,
      updatedAt: now,
    });
  },

  async update(id: number, updates: Partial<Project>): Promise<void> {
    const now = new Date().toISOString();
    await db.projects.update(id, {
      ...updates,
      updatedAt: now,
    });
  },

  async deleteCascade(projectId: number): Promise<void> {
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
        db.prompts,
        db.responses,
        db.snippets,
        db.walkthroughs,
      ],
      async () => {
        // Find plans
        const plans = await db.plans.where({ projectId }).toArray();
        const planIds = plans.map((p) => p.id!).filter(Boolean);

        // Find parts
        const parts = await db.parts.where('planId').anyOf(planIds).toArray();
        const partIds = parts.map((p) => p.id!).filter(Boolean);

        // Delete part steps
        if (partIds.length > 0) {
          await db.partSteps.where('partId').anyOf(partIds).delete();
        }

        // Delete parts
        if (planIds.length > 0) {
          await db.parts.where('planId').anyOf(planIds).delete();
        }

        // Delete plans
        await db.plans.where({ projectId }).delete();

        // Delete sections and deps
        const sections = await db.sections.where({ projectId }).toArray();
        const sectionIds = sections.map((s) => s.id!).filter(Boolean);
        if (sectionIds.length > 0) {
          await db.sectionDeps.where('sectionId').anyOf(sectionIds).delete();
          await db.sectionDeps.where('dependsOnId').anyOf(sectionIds).delete();
        }
        await db.sections.where({ projectId }).delete();

        // Delete prompts, responses, snippets
        const prompts = await db.prompts.where({ projectId }).toArray();
        const promptIds = prompts.map((pr) => pr.id!).filter(Boolean);
        if (promptIds.length > 0) {
          const responses = await db.responses.where('promptId').anyOf(promptIds).toArray();
          const responseIds = responses.map((r) => r.id!).filter(Boolean);
          if (responseIds.length > 0) {
            await db.snippets.where('responseId').anyOf(responseIds).delete();
          }
          await db.responses.where('promptId').anyOf(promptIds).delete();
        }
        await db.snippets.where({ projectId }).delete();
        await db.prompts.where({ projectId }).delete();

        // Delete walkthroughs, links, memory, decisions
        await db.walkthroughs.where({ projectId }).delete();
        await db.links.where({ projectId }).delete();
        await db.memory.delete(projectId);
        await db.memoryHistory.where({ projectId }).delete();
        await db.decisions.where({ projectId }).delete();

        // Finally delete the project itself
        await db.projects.delete(projectId);
      }
    );
  },
};
