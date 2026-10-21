import { db, type StudyCard, type StudyItem, type StudyLog, type StudyMemory, type StudyQuiz, type StudyResponseHistory, type StudySession, type StudyTopic, type StudyUnit } from '../schema';
import { addDays, formatLocalDate, parseLocalDate } from '../../core/scheduler';

async function removePendingTopicReferences(itemId: number, removedTopicIds: Set<number>): Promise<void> {
  if (removedTopicIds.size === 0) return;
  const sessions = await db.study_sessions.where({ itemId }).toArray();
  for (const session of sessions) {
    if (session.done === 1 || !session.topicIds.some((topicId) => removedTopicIds.has(topicId))) continue;
    const topicIds = session.topicIds.filter((topicId) => !removedTopicIds.has(topicId));
    if (topicIds.length === 0) {
      if (session.id !== undefined) await db.study_sessions.delete(session.id);
      continue;
    }
    const plannedMinutes = session.type === 'revise' || session.type === 'mock_test'
      ? session.plannedMinutes
      : (await db.study_topics.bulkGet(topicIds)).reduce((sum, topic) => sum + (topic?.minutes || 30), 0);
    if (session.id !== undefined) await db.study_sessions.update(session.id, { topicIds, plannedMinutes });
  }
}

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
        levelAndStyle: item.level || '',
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
      [db.study_items, db.study_units, db.study_topics, db.study_sessions, db.study_memory, db.study_cards, db.study_quizzes, db.study_logs, db.study_resources, db.study_response_history],
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
          db.study_response_history.where({ itemId: id }).delete(),
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

  getSessions(itemId: number): Promise<StudySession[]> {
    return db.study_sessions.where({ itemId }).sortBy('date');
  },

  getMemory(itemId: number): Promise<StudyMemory | undefined> { return db.study_memory.get(itemId); },
  async saveStudyResponse(input: Omit<StudyResponseHistory, 'id' | 'createdAt'>): Promise<number> {
    return db.study_response_history.add({ ...input, createdAt: new Date().toISOString() });
  },
  getStudyResponses(itemId: number): Promise<StudyResponseHistory[]> {
    return db.study_response_history.where({ itemId }).toArray().then((rows) => rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  deleteStudyResponse(id: number): Promise<void> { return db.study_response_history.delete(id); },
  async saveMemory(itemId: number, updates: Partial<Omit<StudyMemory, 'itemId' | 'updatedAt'>>): Promise<void> {
    const current = await db.study_memory.get(itemId);
    await db.study_memory.put({ itemId, summary: '', concepts: [], understood: [], weak: [], doubts: [], ...current, ...updates, updatedAt: new Date().toISOString() });
  },
  async getDailyLog(itemId: number, date: string): Promise<StudyLog | undefined> {
    return (await db.study_logs.where({ itemId }).toArray()).find((log) => log.date === date);
  },
  async getLogs(itemId: number): Promise<StudyLog[]> { return db.study_logs.where({ itemId }).toArray(); },
  async saveDailyLog(log: Omit<StudyLog, 'id'>): Promise<void> {
    const existing = await this.getDailyLog(log.itemId, log.date);
    await db.study_logs.put({ ...log, ...(existing?.id !== undefined ? { id: existing.id } : {}) });
  },
  async setSessionDone(id: number, done: boolean): Promise<void> {
    const session = await db.study_sessions.get(id);
    if (!session) return;
    await db.study_sessions.update(id, { done: done ? 1 : 0 });
    if (done && session.spacedReview !== 1 && session.type !== 'rest') {
      for (const topicId of session.topicIds) {
        const topic = await db.study_topics.get(topicId);
        if (topic && topic.status !== 'done') await this.updateTopic(topicId, { status: 'done' });
      }
    }
  },
  async setSessionMinutes(id: number, minutes: number): Promise<void> {
    await db.study_sessions.update(id, { actualMinutes: Math.max(0, Math.floor(minutes)) });
  },

  async importPlan(itemId: number, units: Array<{
    title: string;
    weight?: number;
    topics: Array<Pick<StudyTopic, 'title' | 'minutes'> & Partial<Pick<StudyTopic, 'sessionType' | 'pageStart' | 'pageEnd'>>>;
  }>): Promise<void> {
    await db.transaction('rw', [db.study_items, db.study_units, db.study_topics], async () => {
      const item = await db.study_items.get(itemId);
      if (!item) throw new Error('Study item no longer exists.');
      const existingUnits = await db.study_units.where({ itemId }).toArray();
      let unitOrder = existingUnits.length;
      for (const importedUnit of units) {
        const unitId = await db.study_units.add({
          itemId,
          title: importedUnit.title,
          order: unitOrder++,
          weight: importedUnit.weight,
        });
        const topicRecords: Omit<StudyTopic, 'id'>[] = importedUnit.topics.map((topic, order) => ({
          ...topic,
          itemId,
          unitId,
          order,
          status: 'not_started',
        }));
        if (topicRecords.length) await db.study_topics.bulkAdd(topicRecords);
      }
    });
  },

  async addTopics(topics: Omit<StudyTopic, 'id'>[]): Promise<void> {
    if (topics.length) await db.study_topics.bulkAdd(topics);
  },

  async splitTextbookPages(itemId: number, totalPages: number, pagesPerDay: number, minutesPerDay: number, selectedUnitId?: number): Promise<number> {
    return db.transaction('rw', [db.study_units, db.study_topics], async () => {
      let unitId = selectedUnitId;
      if (unitId) {
        const selectedUnit = await db.study_units.get(unitId);
        if (!selectedUnit || selectedUnit.itemId !== itemId) throw new Error('Choose a unit in this study item.');
      }
      if (!unitId) {
        const unit = await db.study_units.add({
          itemId,
          title: 'Textbook pages',
          order: await db.study_units.where({ itemId }).count(),
        });
        unitId = unit;
      }
      const existingTopics = await db.study_topics.where({ itemId }).toArray();
      const firstPage = Math.max(0, ...existingTopics.map((topic) => topic.pageEnd || 0)) + 1;
      if (firstPage > totalPages) throw new Error(`Page ${totalPages} is already covered by your outline.`);
      const existingUnitTopics = existingTopics.filter((topic) => topic.unitId === unitId);
      const newTopics: Omit<StudyTopic, 'id'>[] = [];
      for (let start = firstPage; start <= totalPages; start += pagesPerDay) {
        const end = Math.min(totalPages, start + pagesPerDay - 1);
        newTopics.push({
          itemId,
          unitId,
          title: `Pages ${start}-${end}`,
          pageStart: start,
          pageEnd: end,
          minutes: minutesPerDay,
          status: 'not_started',
          order: existingUnitTopics.length + newTopics.length,
        });
      }
      await db.study_topics.bulkAdd(newTopics);
      return newTopics.length;
    });
  },

  async replaceUnfinishedSessions(itemId: number, sessions: Omit<StudySession, 'id'>[]): Promise<void> {
    await db.transaction('rw', db.study_sessions, async () => {
      await db.study_sessions.where({ itemId }).and((session) => session.done !== 1 && session.spacedReview !== 1).delete();
      if (sessions.length) await db.study_sessions.bulkAdd(sessions);
    });
  },

  addUnit(itemId: number, title: string, order: number): Promise<number> {
    return db.study_units.add({ itemId, title, order });
  },

  updateUnit(id: number, updates: Partial<StudyUnit>): Promise<number> {
    return db.study_units.update(id, updates);
  },

  async deleteUnit(id: number): Promise<void> {
    await db.transaction('rw', [db.study_units, db.study_topics, db.study_sessions], async () => {
      const topics = await db.study_topics.where({ unitId: id }).toArray();
      const topicIds = new Set(topics.flatMap((topic) => topic.id === undefined ? [] : [topic.id]));
      if (topics.length > 0) {
        await removePendingTopicReferences(topics[0].itemId, topicIds);
      }
      await db.study_topics.where({ unitId: id }).delete();
      await db.study_units.delete(id);
    });
  },

  addTopic(topic: Omit<StudyTopic, 'id'>): Promise<number> {
    return db.study_topics.add(topic);
  },

  async updateTopic(id: number, updates: Partial<StudyTopic>): Promise<number> {
    return db.transaction('rw', [db.study_topics, db.study_sessions, db.study_items], async () => {
      const current = await db.study_topics.get(id);
      if (!current) return 0;
      const count = await db.study_topics.update(id, updates);
      if (updates.status === 'done' && current.status !== 'done') {
        const item = await db.study_items.get(current.itemId);
        const intervals = (item?.revisionIntervals?.filter((days) => Number.isInteger(days) && days > 0) || [1, 3, 7, 21, 45]).slice(0, 10);
        const today = formatLocalDate(new Date());
        const reviews: Omit<StudySession, 'id'>[] = intervals.map((days, stage) => ({
          itemId: current.itemId,
          date: formatLocalDate(addDays(parseLocalDate(today), days)),
          type: 'revise', topicIds: [id], plannedMinutes: Math.max(5, Math.min(30, current.minutes || 15)), done: 0,
          spacedReview: 1, reviewStage: stage, reviewInterval: days, reviewEase: 2.5,
        }));
        if (reviews.length) await db.study_sessions.bulkAdd(reviews);
      } else if (updates.status && updates.status !== 'done' && current.status === 'done') {
        await db.study_sessions.where({ itemId: current.itemId }).and((session) => session.spacedReview === 1 && session.done !== 1 && session.topicIds.includes(id)).delete();
      }
      return count;
    });
  },

  async rateTopicRevision(sessionId: number, rating: NonNullable<StudySession['reviewRating']>): Promise<void> {
    await db.transaction('rw', [db.study_sessions, db.study_topics, db.study_memory], async () => {
      const session = await db.study_sessions.get(sessionId);
      if (!session || session.spacedReview !== 1 || session.done === 1) return;
      const topicId = session.topicIds[0];
      const topic = await db.study_topics.get(topicId);
      if (!topic) return;
      const today = formatLocalDate(new Date());
      await db.study_sessions.update(sessionId, { done: 1, reviewRating: rating });
      const pending = (await db.study_sessions.where({ itemId: session.itemId }).toArray())
        .filter((entry) => entry.spacedReview === 1 && entry.done !== 1 && entry.topicIds.includes(topicId))
        .sort((a, b) => (a.reviewStage || 0) - (b.reviewStage || 0));
      if (rating === 'forgot') {
        await db.study_topics.update(topicId, { status: 'needs_revision' });
        const memory = await db.study_memory.get(session.itemId);
        const weak = [...new Set([...(memory?.weak || []), topic.title])];
        if (memory) await db.study_memory.put({ ...memory, weak, updatedAt: new Date().toISOString() });
        else await db.study_memory.put({ itemId: session.itemId, summary: '', concepts: [], understood: [], weak, doubts: [], updatedAt: new Date().toISOString() });
        await db.study_sessions.where({ itemId: session.itemId }).and((entry) => entry.spacedReview === 1 && entry.done !== 1 && entry.topicIds.includes(topicId)).delete();
        await db.study_sessions.add({ itemId: session.itemId, date: formatLocalDate(addDays(parseLocalDate(today), 1)), type: 'revise', topicIds: [topicId], plannedMinutes: 15, done: 0, spacedReview: 1, reviewStage: 0, reviewInterval: 1, reviewEase: Math.max(1.3, (session.reviewEase || 2.5) - 0.2) });
        return;
      }
      const currentInterval = Math.max(1, session.reviewInterval || 1);
      const ease = Math.max(1.3, (session.reviewEase || 2.5) + (rating === 'easy' ? 0.15 : rating === 'hard' ? -0.15 : 0));
      const item = await db.study_items.get(session.itemId);
      const configured = (item?.revisionIntervals?.filter((days) => Number.isInteger(days) && days > 0) || [1, 3, 7, 21, 45]);
      const nextStage = (session.reviewStage || 0) + 1;
      const next = pending[0];
      const baseline = configured[nextStage] || currentInterval * ease;
      const interval = rating === 'hard' ? Math.max(1, Math.round(baseline * 0.7)) : rating === 'easy' ? Math.max(baseline, Math.ceil(currentInterval * ease)) : Math.round(baseline);
      let anchor = formatLocalDate(addDays(parseLocalDate(today), interval));
      if (next?.id) await db.study_sessions.update(next.id, { date: anchor, reviewStage: nextStage, reviewInterval: interval, reviewEase: ease });
      else await db.study_sessions.add({ itemId: session.itemId, date: anchor, type: 'revise', topicIds: [topicId], plannedMinutes: Math.max(5, Math.min(30, topic.minutes || 15)), done: 0, spacedReview: 1, reviewStage: nextStage, reviewInterval: interval, reviewEase: ease });
      const future = pending.filter((entry) => entry.id !== next?.id);
      for (const entry of future) {
        const stage = Math.max(nextStage + 1, entry.reviewStage || 0);
        const days = configured[stage] || (entry.reviewInterval || 1);
        anchor = formatLocalDate(addDays(parseLocalDate(anchor), Math.max(1, days)));
        if (entry.id) await db.study_sessions.update(entry.id, { date: anchor, reviewStage: stage, reviewInterval: days, reviewEase: ease });
      }
    });
  },

  async importFlashcards(itemId: number, cards: Array<{ front: string; back: string; topicId?: number; tags?: string[] }>): Promise<number> {
    const today = formatLocalDate(new Date());
    const topics = await db.study_topics.where({ itemId }).toArray();
    const topicIds = new Set(topics.map((topic) => topic.id));
    if (cards.some((card) => card.topicId !== undefined && !topicIds.has(card.topicId))) throw new Error('A flashcard refers to a topic outside this study item.');
    const records: Omit<StudyCard, 'id'>[] = cards.map((card) => ({ itemId, ...card, interval: 0, ease: 2.5, dueDate: today, reviewCount: 0 }));
    if (!records.length) return 0;
    await db.study_cards.bulkAdd(records);
    return records.length;
  },
  getCards(itemId: number): Promise<StudyCard[]> { return db.study_cards.where({ itemId }).toArray(); },
  async rateFlashcard(id: number, rating: NonNullable<StudySession['reviewRating']>): Promise<void> {
    const card = await db.study_cards.get(id);
    if (!card) return;
    const today = formatLocalDate(new Date());
    const previous = card.interval || 0;
    const ease = Math.max(1.3, card.ease + (rating === 'easy' ? 0.15 : rating === 'hard' ? -0.15 : rating === 'forgot' ? -0.2 : 0));
    const interval = rating === 'forgot' ? 1 : rating === 'hard' ? Math.max(1, Math.round(Math.max(1, previous) * 1.2)) : rating === 'easy' ? Math.max(4, Math.ceil(Math.max(1, previous) * ease * 1.3)) : previous === 0 ? 1 : previous === 1 ? 3 : Math.round(previous * ease);
    await db.study_cards.update(id, { interval, ease, dueDate: formatLocalDate(addDays(parseLocalDate(today), interval)), reviewCount: (card.reviewCount || 0) + 1 });
  },
  getQuiz(itemId: number): Promise<StudyQuiz | undefined> { return db.study_quizzes.get(itemId); },
  async importQuizQuestions(itemId: number, questions: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction('rw', [db.study_items, db.study_topics, db.study_quizzes], async () => {
      if (!await db.study_items.get(itemId)) throw new Error('Study item no longer exists.');
      const topics = await db.study_topics.where({ itemId }).toArray();
      const topicIds = new Set(topics.map((topic) => topic.id));
      if (questions.some((question) => typeof question.topicId === 'number' && !topicIds.has(question.topicId))) throw new Error('A question refers to a topic outside this study item.');
      const current = await db.study_quizzes.get(itemId);
      await db.study_quizzes.put({ itemId, questions: [...(current?.questions || []), ...questions], attempts: current?.attempts || [] });
    });
  },
  async saveQuizAttempt(itemId: number, attempt: Record<string, unknown>): Promise<void> {
    await db.transaction('rw', [db.study_quizzes, db.study_topics, db.study_memory], async () => {
      const quiz = await db.study_quizzes.get(itemId);
      if (!quiz) throw new Error('Quiz questions are no longer available.');
      const attempts = [...quiz.attempts, attempt];
      await db.study_quizzes.put({ ...quiz, attempts });
      const questionResults = Array.isArray(attempt.questionResults) ? attempt.questionResults as Array<{ topicId?: number; correct: boolean }> : [];
      const topicIds = [...new Set(questionResults.flatMap((result) => result.topicId ? [result.topicId] : []))];
      const weakIds: number[] = [];
      for (const topicId of topicIds) {
        const recent = attempts.slice(-3).filter((entry) => {
          const results = Array.isArray(entry.questionResults) ? entry.questionResults as Array<{ topicId?: number; correct: boolean }> : [];
          return results.some((result) => result.topicId === topicId);
        });
        const lowAttempts = recent.filter((entry) => {
          const results = (entry.questionResults as Array<{ topicId?: number; correct: boolean }>) || [];
          const related = results.filter((result) => result.topicId === topicId);
          return related.length > 0 && related.filter((result) => result.correct).length / related.length < 0.5;
        }).length;
        if (recent.length >= 2 && lowAttempts >= 2) weakIds.push(topicId);
      }
      if (weakIds.length) {
        const weakTopics = await db.study_topics.bulkGet(weakIds);
        for (const topicId of weakIds) await db.study_topics.update(topicId, { status: 'needs_revision' });
        const memory = await db.study_memory.get(itemId);
        const weak = [...new Set([...(memory?.weak || []), ...weakTopics.flatMap((topic) => topic ? [topic.title] : [])])];
        if (memory) await db.study_memory.put({ ...memory, weak, updatedAt: new Date().toISOString() });
        else await db.study_memory.put({ itemId, summary: '', concepts: [], understood: [], weak, doubts: [], updatedAt: new Date().toISOString() });
      }
    });
  },

  async deleteTopic(id: number): Promise<void> {
    await db.transaction('rw', [db.study_topics, db.study_sessions], async () => {
      const topic = await db.study_topics.get(id);
      if (topic) {
        await removePendingTopicReferences(topic.itemId, new Set([id]));
      }
      await db.study_topics.delete(id);
    });
  },
};
