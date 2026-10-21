import { db, type Bug } from '../schema';

export const bugRepo = {
  async getByProject(projectId: number): Promise<Bug[]> {
    return db.bugs
      .where({ projectId })
      .filter((b) => !b.deletedAt)
      .toArray();
  },

  async getById(id: number): Promise<Bug | undefined> {
    return db.bugs.get(id);
  },

  async create(data: Omit<Bug, 'id' | 'createdAt'>): Promise<number> {
    return db.bugs.add({
      ...data,
      attempts: data.attempts || [],
      createdAt: new Date().toISOString(),
    });
  },

  async update(id: number, updates: Partial<Bug>): Promise<void> {
    await db.bugs.update(id, updates);
  },

  async markFixed(id: number, resolutionNote: string): Promise<void> {
    const now = new Date().toISOString();
    await db.bugs.update(id, {
      status: 'fixed',
      fixedAt: now,
      resolutionNote,
    });
  },

  async addAttempt(
    id: number,
    attempt: {
      promptId?: number;
      responseId?: number;
      outcome: 'worked' | 'partly' | 'failed';
      note?: string;
    }
  ): Promise<void> {
    const bug = await db.bugs.get(id);
    if (!bug) return;

    const attempts = bug.attempts || [];
    attempts.push({
      ...attempt,
      createdAt: new Date().toISOString(),
    });

    await db.bugs.update(id, {
      attempts,
      status: attempt.outcome === 'worked' ? 'fixed' : bug.status,
      fixedAt: attempt.outcome === 'worked' ? new Date().toISOString() : bug.fixedAt,
      resolutionNote: attempt.outcome === 'worked' ? attempt.note : bug.resolutionNote,
    });
  },

  async delete(id: number): Promise<void> {
    await db.bugs.delete(id);
  },
};
