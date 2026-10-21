import { db, type TimeLog } from '../schema';

export const timeRepo = {
  async getByProject(projectId: number): Promise<TimeLog[]> {
    return db.timeLogs.where({ projectId }).toArray();
  },

  async getByPart(partId: number): Promise<TimeLog[]> {
    return db.timeLogs.where({ partId }).toArray();
  },

  async getAll(): Promise<TimeLog[]> {
    return db.timeLogs.toArray();
  },

  async create(data: Omit<TimeLog, 'id'>): Promise<number> {
    return db.timeLogs.add(data);
  },

  async update(id: number, updates: Partial<TimeLog>): Promise<void> {
    await db.timeLogs.update(id, updates);
  },

  async delete(id: number): Promise<void> {
    await db.timeLogs.delete(id);
  },
};
