import { db, type Section, type SectionDep } from '../schema';

export const sectionRepo = {
  async getByProject(projectId: number): Promise<Section[]> {
    return db.sections.where({ projectId }).sortBy('orderNo');
  },

  async getById(id: number): Promise<Section | undefined> {
    return db.sections.get(id);
  },

  async create(section: Omit<Section, 'id'>): Promise<number> {
    return db.sections.add(section);
  },

  async update(id: number, updates: Partial<Section>): Promise<void> {
    await db.sections.update(id, updates);
  },

  async deleteCascade(sectionId: number): Promise<void> {
    await db.transaction('rw', [db.sections, db.sectionDeps, db.parts], async () => {
      // Remove dependency mappings
      await db.sectionDeps.where('sectionId').equals(sectionId).delete();
      await db.sectionDeps.where('dependsOnId').equals(sectionId).delete();

      // Find children sections and recursively delete or unparent
      const children = await db.sections.where('parentId').equals(sectionId).toArray();
      for (const child of children) {
        if (child.id) {
          await db.sections.update(child.id, { parentId: null });
        }
      }

      // Detach parts from this section
      const parts = await db.parts.where('sectionId').equals(sectionId).toArray();
      for (const part of parts) {
        if (part.id) {
          await db.parts.update(part.id, { sectionId: null });
        }
      }

      await db.sections.delete(sectionId);
    });
  },

  async getDependencies(sectionId: number): Promise<number[]> {
    const deps = await db.sectionDeps.where({ sectionId }).toArray();
    return deps.map((d) => d.dependsOnId);
  },

  async setDependencies(sectionId: number, dependsOnIds: number[]): Promise<void> {
    await db.transaction('rw', db.sectionDeps, async () => {
      await db.sectionDeps.where({ sectionId }).delete();
      const entries: SectionDep[] = dependsOnIds.map((dependsOnId) => ({
        sectionId,
        dependsOnId,
      }));
      await db.sectionDeps.bulkAdd(entries);
    });
  },
};
