import { db, type StudyItem, type StudyTopic, type StudyUnit } from '../schema';

export const studyRepo = {
  getItems(): Promise<StudyItem[]> {
    return db.study_items.orderBy('createdAt').reverse().toArray();
  },

  getItem(id: number): Promise<StudyItem | undefined> {
    return db.study_items.get(id);
  },

  async createItem(item: Omit<StudyItem, 'id' | 'createdAt' | 'archived'>): Promise<number> {
    return db.transaction('rw', [db.study_items, db.study_memory], async () => {
      const id = await db.study_items.add({ ...item, createdAt: new Date().toISOString(), archived: 0 });
      await db.study_memory.add({
        itemId: id,
        summary: '',
        concepts: [],
        understood: [],
        weak: [],
        doubts: [],
        updatedAt: new Date().toISOString(),
      });
      return id;
    });
  },

  updateItem(id: number, updates: Partial<StudyItem>): Promise<number> {
    return db.study_items.update(id, updates);
  },

  async deleteItem(id: number): Promise<void> {
    await db.transaction(
      'rw',
      [db.study_items, db.study_units, db.study_topics, db.study_sessions, db.study_memory, db.study_cards, db.study_quizzes, db.study_logs, db.study_resources],
      async () => {
        await Promise.all([
          db.study_topics.where({ itemId: id }).delete(),
          db.study_units.where({ itemId: id }).delete(),
          db.study_sessions.where({ itemId: id }).delete(),
          db.study_memory.delete(id),
          db.study_cards.where({ itemId: id }).delete(),
          db.study_quizzes.where({ itemId: id }).delete(),
          db.study_logs.where({ itemId: id }).delete(),
          db.study_resources.where({ itemId: id }).delete(),
        ]);
        await db.study_items.delete(id);
      }
    );
  },

  getUnits(itemId: number): Promise<StudyUnit[]> {
    return db.study_units.where({ itemId }).sortBy('order');
  },

  getTopics(itemId: number): Promise<StudyTopic[]> {
    return db.study_topics.where({ itemId }).sortBy('order');
  },

  addUnit(itemId: number, title: string, order: number): Promise<number> {
    return db.study_units.add({ itemId, title, order });
  },

  updateUnit(id: number, updates: Partial<StudyUnit>): Promise<number> {
    return db.study_units.update(id, updates);
  },

  async deleteUnit(id: number): Promise<void> {
    await db.transaction('rw', [db.study_units, db.study_topics], async () => {
      await db.study_topics.where({ unitId: id }).delete();
      await db.study_units.delete(id);
    });
  },

  addTopic(topic: Omit<StudyTopic, 'id'>): Promise<number> {
    return db.study_topics.add(topic);
  },

  updateTopic(id: number, updates: Partial<StudyTopic>): Promise<number> {
    return db.study_topics.update(id, updates);
  },

  deleteTopic(id: number): Promise<void> {
    return db.study_topics.delete(id);
  },
};
