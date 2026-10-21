import { db, type Prompt, type Response } from '../schema';

export const promptRepo = {
  async getById(id: number): Promise<Prompt | undefined> {
    return db.prompts.get(id);
  },

  async getLatestForPart(partId: number): Promise<Prompt | undefined> {
    const list = await db.prompts.where({ partId }).sortBy('createdAt');
    return list[list.length - 1];
  },

  async getByProject(projectId: number): Promise<Prompt[]> {
    return db.prompts.where({ projectId }).reverse().sortBy('createdAt');
  },

  async create(prompt: Omit<Prompt, 'id' | 'createdAt'>): Promise<number> {
    const now = new Date().toISOString();
    return db.prompts.add({
      ...prompt,
      createdAt: now,
    });
  },
};

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
