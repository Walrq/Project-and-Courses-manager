import { db, type Decision } from '../schema';

export const decisionRepo = {
  async getByProject(projectId: number): Promise<Decision[]> {
    return db.decisions.where({ projectId }).sortBy('createdAt');
  },

  async getActiveByProject(projectId: number): Promise<Decision[]> {
    return db.decisions
      .where({ projectId })
      .filter((d) => d.active === 1)
      .sortBy('createdAt');
  },

  async create(projectId: number, text: string, reason?: string): Promise<number> {
    const now = new Date().toISOString();
    return db.decisions.add({
      projectId,
      text,
      reason,
      createdAt: now,
      active: 1,
    });
  },

  async toggleActive(id: number, active: boolean): Promise<void> {
    await db.decisions.update(id, { active: active ? 1 : 0 });
  },

  async delete(id: number): Promise<void> {
    await db.decisions.delete(id);
  },
};
