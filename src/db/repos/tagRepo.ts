import { db, type Tag, type Tagging } from '../schema';

export const tagRepo = {
  async getAll(): Promise<Tag[]> {
    return db.tags.toArray();
  },

  async create(name: string, color: string = '#10b981'): Promise<number> {
    const existing = await db.tags.where('name').equals(name.trim()).first();
    if (existing?.id) return existing.id;
    return db.tags.add({ name: name.trim(), color });
  },

  async update(id: number, updates: Partial<Tag>): Promise<void> {
    await db.tags.update(id, updates);
  },

  async delete(id: number): Promise<void> {
    await db.transaction('rw', [db.tags, db.taggings], async () => {
      await db.taggings.where('tagId').equals(id).delete();
      await db.tags.delete(id);
    });
  },

  async merge(sourceTagId: number, targetTagId: number): Promise<void> {
    if (sourceTagId === targetTagId) return;
    await db.transaction('rw', [db.tags, db.taggings], async () => {
      const taggings = await db.taggings.where('tagId').equals(sourceTagId).toArray();
      for (const t of taggings) {
        // Check if target already has tagging for this entity
        const exists = await db.taggings
          .where({ tagId: targetTagId, entityType: t.entityType, entityId: t.entityId })
          .first();
        if (!exists && t.id) {
          await db.taggings.update(t.id, { tagId: targetTagId });
        } else if (t.id) {
          await db.taggings.delete(t.id);
        }
      }
      await db.tags.delete(sourceTagId);
    });
  },

  // Taggings helpers
  async getTaggingsForEntity(entityType: Tagging['entityType'], entityId: number): Promise<Tag[]> {
    const taggings = await db.taggings.where({ entityType, entityId }).toArray();
    const tagIds = taggings.map((t) => t.tagId);
    if (tagIds.length === 0) return [];
    return db.tags.where('id').anyOf(tagIds).toArray();
  },

  async setTagsForEntity(
    entityType: Tagging['entityType'],
    entityId: number,
    tagIds: number[]
  ): Promise<void> {
    await db.transaction('rw', [db.taggings], async () => {
      await db.taggings.where({ entityType, entityId }).delete();
      const records: Tagging[] = tagIds.map((tagId) => ({
        tagId,
        entityType,
        entityId,
      }));
      if (records.length > 0) {
        await db.taggings.bulkAdd(records);
      }
    });
  },

  async getUsageCounts(): Promise<Map<number, number>> {
    const all = await db.taggings.toArray();
    const counts = new Map<number, number>();
    for (const t of all) {
      counts.set(t.tagId, (counts.get(t.tagId) || 0) + 1);
    }
    return counts;
  },
};
