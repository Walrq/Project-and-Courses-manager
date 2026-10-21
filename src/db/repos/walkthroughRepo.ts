import { db, type Walkthrough } from '../schema';

export const MAX_RAW_TEXT_CHARS = 100000;

export const walkthroughRepo = {
  async getById(id: number): Promise<Walkthrough | undefined> {
    return db.walkthroughs.get(id);
  },

  async getByProject(projectId: number): Promise<Walkthrough[]> {
    return db.walkthroughs.where({ projectId }).toArray();
  },

  async create(data: Omit<Walkthrough, 'id' | 'importedAt'>): Promise<{ id: number; truncated: boolean }> {
    let truncated = false;
    let rawText = data.rawText || '';

    if (rawText.length > MAX_RAW_TEXT_CHARS) {
      rawText = rawText.slice(0, MAX_RAW_TEXT_CHARS);
      truncated = true;
    }

    const id = await db.walkthroughs.add({
      ...data,
      rawText,
      importedAt: new Date().toISOString(),
    });

    return { id, truncated };
  },

  async update(id: number, updates: Partial<Walkthrough>): Promise<{ truncated: boolean }> {
    let truncated = false;
    const finalUpdates = { ...updates };

    if (typeof finalUpdates.rawText === 'string' && finalUpdates.rawText.length > MAX_RAW_TEXT_CHARS) {
      finalUpdates.rawText = finalUpdates.rawText.slice(0, MAX_RAW_TEXT_CHARS);
      truncated = true;
    }

    await db.walkthroughs.update(id, finalUpdates);
    return { truncated };
  },

  async delete(id: number): Promise<void> {
    await db.transaction('rw', [db.walkthroughs, db.parts], async () => {
      // Clear walkthroughId from parts referencing it
      const parts = await db.parts.where('walkthroughId').equals(id).toArray();
      for (const p of parts) {
        if (p.id) {
          await db.parts.update(p.id, { walkthroughId: null });
        }
      }
      await db.walkthroughs.delete(id);
    });
  },
};
