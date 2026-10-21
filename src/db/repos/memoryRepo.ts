import { db, type Memory, type MemoryHistory } from '../schema';

export const memoryRepo = {
  async getByProjectId(projectId: number): Promise<Memory | undefined> {
    return db.memory.get(projectId);
  },

  async update(projectId: number, rollingSummary: string, glossary?: string): Promise<void> {
    const existing = await db.memory.get(projectId);
    const now = new Date().toISOString();

    await db.transaction('rw', [db.memory, db.memoryHistory], async () => {
      // Archive current version if it had content
      if (existing && existing.rollingSummary.trim()) {
        await db.memoryHistory.add({
          projectId,
          rollingSummary: existing.rollingSummary,
          glossary: existing.glossary,
          createdAt: existing.updatedAt || now,
        });

        // Keep only the last 10 history entries
        const allHistory = await db.memoryHistory.where({ projectId }).sortBy('createdAt');
        if (allHistory.length > 10) {
          const excess = allHistory.slice(0, allHistory.length - 10);
          const idsToDelete = excess.map((h) => h.id!).filter(Boolean);
          await db.memoryHistory.where('id').anyOf(idsToDelete).delete();
        }
      }

      await db.memory.put({
        projectId,
        rollingSummary,
        glossary: glossary ?? existing?.glossary ?? '',
        updatedAt: now,
      });
    });
  },

  async getHistory(projectId: number): Promise<MemoryHistory[]> {
    return db.memoryHistory.where({ projectId }).reverse().sortBy('createdAt');
  },
};
