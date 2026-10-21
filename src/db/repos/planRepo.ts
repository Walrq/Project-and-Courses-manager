import { db, type Plan } from '../schema';

export const planRepo = {
  async getByProjectId(projectId: number): Promise<Plan | undefined> {
    return db.plans.where({ projectId }).first();
  },

  async ensureForProject(projectId: number): Promise<Plan> {
    const existing = await this.getByProjectId(projectId);
    if (existing) return existing;

    const today = new Date().toISOString().split('T')[0];
    const newPlan: Omit<Plan, 'id'> = {
      projectId,
      mode: 'manual',
      startDate: today,
      partsPerDay: 1,
      hoursPerDay: 2,
      restRule: { type: 'every_n', n: 7 },
      difficultyRamp: 'none',
    };
    const id = await db.plans.add(newPlan);
    return { id, ...newPlan };
  },

  async update(id: number, updates: Partial<Plan>): Promise<void> {
    await db.plans.update(id, updates);
  },
};
