import { db } from '../schema';

export const settingsRepo = {
  async get(key: string, defaultValue: string = ''): Promise<string> {
    const record = await db.settings.get(key);
    return record ? record.value : defaultValue;
  },

  async set(key: string, value: string): Promise<void> {
    await db.settings.put({ key, value });
  },

  async getAll(): Promise<Record<string, string>> {
    const list = await db.settings.toArray();
    const result: Record<string, string> = {};
    for (const item of list) {
      result[item.key] = item.value;
    }
    return result;
  },
};
