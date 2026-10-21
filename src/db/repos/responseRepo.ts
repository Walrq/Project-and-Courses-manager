import { db, type Response } from '../schema';

export const responseRepo = {
  async getByPrompt(promptId: number): Promise<Response[]> {
    return db.responses.where({ promptId }).sortBy('createdAt');
  },

  async getLatestByPrompt(promptId: number): Promise<Response | undefined> {
    const list = await db.responses.where({ promptId }).sortBy('createdAt');
    return list[list.length - 1];
  },

  async create(response: Omit<Response, 'id' | 'createdAt'>): Promise<number> {
    const now = new Date().toISOString();
    return db.responses.add({
      ...response,
      createdAt: now,
    });
  },

  async updateVerdict(
    id: number,
    verdict: 'pending' | 'accepted' | 'rejected' | 'needs_revision',
    feedback?: string
  ): Promise<void> {
    await db.responses.update(id, {
      verdict,
      ...(feedback !== undefined ? { feedback } : {}),
    });
  },
};
