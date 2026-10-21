import { db, type Checklist, type ChecklistItem, type ChecklistTemplate } from '../schema';

export const checklistRepo = {
  // Templates
  async getTemplates(): Promise<ChecklistTemplate[]> {
    return db.checklistTemplates.toArray();
  },

  async createTemplate(data: Omit<ChecklistTemplate, 'id'>): Promise<number> {
    return db.checklistTemplates.add(data);
  },

  // Checklists
  async getChecklistsForProject(projectId: number): Promise<Array<Checklist & { items: ChecklistItem[] }>> {
    const lists = await db.checklists
      .where({ projectId })
      .filter((c) => !c.deletedAt)
      .toArray();

    const result: Array<Checklist & { items: ChecklistItem[] }> = [];
    for (const l of lists) {
      if (!l.id) continue;
      const items = await db.checklistItems.where('checklistId').equals(l.id).sortBy('orderNo');
      result.push({ ...l, items });
    }
    return result;
  },

  async getChecklistsForPart(partId: number): Promise<Array<Checklist & { items: ChecklistItem[] }>> {
    const lists = await db.checklists
      .where({ partId })
      .filter((c) => !c.deletedAt)
      .toArray();

    const result: Array<Checklist & { items: ChecklistItem[] }> = [];
    for (const l of lists) {
      if (!l.id) continue;
      const items = await db.checklistItems.where('checklistId').equals(l.id).sortBy('orderNo');
      result.push({ ...l, items });
    }
    return result;
  },

  async createChecklist(
    data: Omit<Checklist, 'id'>,
    itemTexts: string[] = []
  ): Promise<number> {
    return db.transaction('rw', [db.checklists, db.checklistItems], async () => {
      const checklistId = await db.checklists.add(data);
      const items: ChecklistItem[] = itemTexts.map((text, idx) => ({
        checklistId,
        text,
        done: 0,
        orderNo: idx + 1,
      }));
      if (items.length > 0) {
        await db.checklistItems.bulkAdd(items);
      }
      return checklistId;
    });
  },

  async createFromTemplate(
    templateId: number,
    projectId: number,
    partId?: number | null
  ): Promise<number | undefined> {
    const template = await db.checklistTemplates.get(templateId);
    if (!template) return undefined;

    return this.createChecklist(
      {
        projectId,
        partId,
        name: template.name,
        createdFromTemplateId: template.id,
      },
      template.items
    );
  },

  async toggleItem(itemId: number, done: boolean): Promise<void> {
    await db.checklistItems.update(itemId, { done: done ? 1 : 0 });
  },

  async addItem(checklistId: number, text: string): Promise<number> {
    const count = await db.checklistItems.where('checklistId').equals(checklistId).count();
    return db.checklistItems.add({
      checklistId,
      text,
      done: 0,
      orderNo: count + 1,
    });
  },

  async deleteItem(itemId: number): Promise<void> {
    await db.checklistItems.delete(itemId);
  },

  async deleteChecklist(id: number): Promise<void> {
    await db.transaction('rw', [db.checklists, db.checklistItems], async () => {
      await db.checklistItems.where('checklistId').equals(id).delete();
      await db.checklists.delete(id);
    });
  },
};
