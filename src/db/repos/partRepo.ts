import { db, type Part, type PartStep } from '../schema';

export const partRepo = {
  async getByPlan(planId: number): Promise<Part[]> {
    return db.parts.where({ planId }).sortBy('orderNo');
  },

  async getById(id: number): Promise<Part | undefined> {
    return db.parts.get(id);
  },

  async create(part: Omit<Part, 'id'>, steps: string[] = []): Promise<number> {
    return db.transaction('rw', [db.parts, db.partSteps], async () => {
      const partId = await db.parts.add(part);
      if (steps.length > 0) {
        const stepRecords: PartStep[] = steps.map((text, idx) => ({
          partId,
          text,
          done: 0,
          orderNo: idx,
        }));
        await db.partSteps.bulkAdd(stepRecords);
      }
      return partId;
    });
  },

  async update(id: number, updates: Partial<Part>): Promise<void> {
    await db.parts.update(id, updates);
  },

  async deleteCascade(partId: number): Promise<void> {
    await db.transaction('rw', [db.parts, db.partSteps, db.prompts], async () => {
      await db.partSteps.where({ partId }).delete();
      const prompts = await db.prompts.where({ partId }).toArray();
      for (const pr of prompts) {
        if (pr.id) {
          await db.prompts.update(pr.id, { partId: null });
        }
      }
      await db.parts.delete(partId);
    });
  },

  async getSteps(partId: number): Promise<PartStep[]> {
    return db.partSteps.where({ partId }).sortBy('orderNo');
  },

  async addStep(partId: number, text: string, orderNo: number): Promise<number> {
    return db.partSteps.add({ partId, text, done: 0, orderNo });
  },

  async toggleStep(stepId: number, done: boolean): Promise<void> {
    await db.partSteps.update(stepId, { done: done ? 1 : 0 });
  },

  async deleteStep(stepId: number): Promise<void> {
    await db.partSteps.delete(stepId);
  },

  async markDone(partId: number, note?: string): Promise<void> {
    const now = new Date().toISOString();
    await db.parts.update(partId, {
      status: 'done',
      completedAt: now,
      ...(note !== undefined ? { note } : {}),
    });
  },

  async markSkipped(partId: number): Promise<void> {
    await db.parts.update(partId, { status: 'skipped' });
  },
};
