import { db, type Template } from '../schema';
import { DEFAULT_TEMPLATES, type TemplateKind } from '../../core/templates';

export const templateRepo = {
  async getAll(): Promise<Template[]> {
    return db.templates.toArray();
  },

  async getByKind(kind: TemplateKind): Promise<Template | undefined> {
    return db.templates.where({ kind }).first();
  },

  async update(id: number, updates: Partial<Template>): Promise<void> {
    await db.templates.update(id, {
      ...updates,
      isDefault: 0, // marked as user-edited
    });
  },

  async resetToDefault(id: number): Promise<void> {
    const template = await db.templates.get(id);
    if (!template) return;
    const defaultDef = DEFAULT_TEMPLATES.find((t) => t.kind === template.kind);
    if (defaultDef) {
      await db.templates.update(id, {
        name: defaultDef.name,
        body: defaultDef.body,
        isDefault: 1,
      });
    }
  },
};
