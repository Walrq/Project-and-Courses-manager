import { db, type Link } from '../schema';

export const MAX_PASTED_TEXT_LENGTH = 20000;

export const linkRepo = {
  async getByProject(projectId: number): Promise<Link[]> {
    return db.links.where({ projectId }).toArray();
  },

  async getById(id: number): Promise<Link | undefined> {
    return db.links.get(id);
  },

  async create(link: Omit<Link, 'id'>): Promise<number> {
    const sanitized: Omit<Link, 'id'> = {
      ...link,
      pastedText: link.pastedText ? link.pastedText.slice(0, MAX_PASTED_TEXT_LENGTH) : undefined,
    };
    return db.links.add(sanitized);
  },

  async update(id: number, updates: Partial<Link>): Promise<void> {
    const sanitized = { ...updates };
    if (sanitized.pastedText !== undefined) {
      sanitized.pastedText = sanitized.pastedText
        ? sanitized.pastedText.slice(0, MAX_PASTED_TEXT_LENGTH)
        : undefined;
    }
    await db.links.update(id, sanitized);
  },

  async delete(id: number): Promise<void> {
    await db.links.delete(id);
  },
};
