import { db, type Snippet } from '../schema';

export const snippetRepo = {
  async getByResponse(responseId: number): Promise<Snippet[]> {
    return db.snippets.where({ responseId }).toArray();
  },

  async getByProject(projectId: number): Promise<Snippet[]> {
    return db.snippets.where({ projectId }).toArray();
  },

  async bulkCreate(snippets: Omit<Snippet, 'id'>[]): Promise<void> {
    if (snippets.length === 0) return;
    await db.snippets.bulkAdd(snippets);
  },

  async delete(id: number): Promise<void> {
    await db.snippets.delete(id);
  },
};
