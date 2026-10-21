import { db } from '../schema';
import { subDays, parseISO } from 'date-fns';
import { undoManager } from '../../core/undo';

export interface TrashItem {
  id: number;
  entityType: 'project' | 'section' | 'part' | 'snippet' | 'bug' | 'decision' | 'link' | 'checklist' | 'walkthrough';
  title: string;
  deleteBatchId: string;
  deletedAt: string;
  projectId?: number;
  parentName?: string;
}

export interface TrashBatch {
  deleteBatchId: string;
  deletedAt: string;
  daysRemaining: number;
  items: TrashItem[];
}

export const trashRepo = {
  async softDeleteProject(projectId: number): Promise<string> {
    const deleteBatchId = 'batch_' + Math.random().toString(36).substring(2, 9);
    const deletedAt = new Date().toISOString();

    await db.transaction(
      'rw',
      [
        db.projects,
        db.sections,
        db.parts,
        db.snippets,
        db.decisions,
        db.links,
        db.walkthroughs,
        db.bugs,
        db.checklists,
      ],
      async () => {
        // Find plans for project
        const plans = await db.plans.where({ projectId }).toArray();
        const planIds = plans.map((p) => p.id!).filter(Boolean);

        await db.projects.update(projectId, { deletedAt, deleteBatchId });
        await db.sections.where({ projectId }).modify({ deletedAt, deleteBatchId });
        if (planIds.length > 0) {
          await db.parts.where('planId').anyOf(planIds).modify({ deletedAt, deleteBatchId });
        }
        await db.snippets.where({ projectId }).modify({ deletedAt, deleteBatchId });
        await db.decisions.where({ projectId }).modify({ deletedAt, deleteBatchId });
        await db.links.where({ projectId }).modify({ deletedAt, deleteBatchId });
        await db.walkthroughs.where({ projectId }).modify({ deletedAt, deleteBatchId });
        await db.bugs.where({ projectId }).modify({ deletedAt, deleteBatchId });
        await db.checklists.where({ projectId }).modify({ deletedAt, deleteBatchId });
      }
    );

    // Register undo action
    undoManager.push({
      title: 'Delete project',
      undo: async () => {
        await trashRepo.restoreBatch(deleteBatchId);
      },
    });

    return deleteBatchId;
  },

  async softDeletePart(partId: number): Promise<string> {
    const deleteBatchId = 'batch_' + Math.random().toString(36).substring(2, 9);
    const deletedAt = new Date().toISOString();

    await db.parts.update(partId, { deletedAt, deleteBatchId });

    undoManager.push({
      title: 'Delete part',
      undo: async () => {
        await trashRepo.restoreBatch(deleteBatchId);
      },
    });

    return deleteBatchId;
  },

  async getTrashBatches(purgeDays: number = 30): Promise<TrashBatch[]> {
    const items: TrashItem[] = [];

    // Projects
    const projects = await db.projects.filter((p) => Boolean(p.deletedAt && p.deleteBatchId)).toArray();
    for (const p of projects) {
      items.push({
        id: p.id!,
        entityType: 'project',
        title: p.name,
        deleteBatchId: p.deleteBatchId!,
        deletedAt: p.deletedAt!,
      });
    }

    // Parts
    const parts = await db.parts.filter((p) => Boolean(p.deletedAt && p.deleteBatchId)).toArray();
    for (const p of parts) {
      items.push({
        id: p.id!,
        entityType: 'part',
        title: p.title,
        deleteBatchId: p.deleteBatchId!,
        deletedAt: p.deletedAt!,
      });
    }

    // Sections
    const sections = await db.sections.filter((s) => Boolean(s.deletedAt && s.deleteBatchId)).toArray();
    for (const s of sections) {
      items.push({
        id: s.id!,
        entityType: 'section',
        title: s.title,
        deleteBatchId: s.deleteBatchId!,
        deletedAt: s.deletedAt!,
        projectId: s.projectId,
      });
    }

    // Bugs
    const bugs = await db.bugs.filter((b) => Boolean(b.deletedAt && b.deleteBatchId)).toArray();
    for (const b of bugs) {
      items.push({
        id: b.id!,
        entityType: 'bug',
        title: b.title,
        deleteBatchId: b.deleteBatchId!,
        deletedAt: b.deletedAt!,
        projectId: b.projectId,
      });
    }

    // Group by deleteBatchId
    const batchMap = new Map<string, TrashItem[]>();
    for (const item of items) {
      if (!batchMap.has(item.deleteBatchId)) {
        batchMap.set(item.deleteBatchId, []);
      }
      batchMap.get(item.deleteBatchId)!.push(item);
    }

    const batches: TrashBatch[] = [];
    const now = new Date();

    for (const [batchId, batchItems] of batchMap.entries()) {
      const deletedAt = batchItems[0].deletedAt;
      const purgeLimitDate = subDays(now, purgeDays);
      const daysAgo = Math.floor((now.getTime() - parseISO(deletedAt).getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, purgeDays - daysAgo);

      batches.push({
        deleteBatchId: batchId,
        deletedAt,
        daysRemaining,
        items: batchItems,
      });
    }

    batches.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    return batches;
  },

  async restoreBatch(deleteBatchId: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.projects,
        db.sections,
        db.parts,
        db.snippets,
        db.decisions,
        db.links,
        db.walkthroughs,
        db.bugs,
        db.checklists,
      ],
      async () => {
        const clearObj = { deletedAt: null, deleteBatchId: null };
        await db.projects.where({ deleteBatchId }).modify(clearObj);
        await db.sections.where({ deleteBatchId }).modify(clearObj);
        await db.parts.where({ deleteBatchId }).modify(clearObj);
        await db.snippets.where({ deleteBatchId }).modify(clearObj);
        await db.decisions.where({ deleteBatchId }).modify(clearObj);
        await db.links.where({ deleteBatchId }).modify(clearObj);
        await db.walkthroughs.where({ deleteBatchId }).modify(clearObj);
        await db.bugs.where({ deleteBatchId }).modify(clearObj);
        await db.checklists.where({ deleteBatchId }).modify(clearObj);
      }
    );
  },

  async purgeBatch(deleteBatchId: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.projects,
        db.sections,
        db.parts,
        db.snippets,
        db.decisions,
        db.links,
        db.walkthroughs,
        db.bugs,
        db.checklists,
      ],
      async () => {
        await db.projects.where({ deleteBatchId }).delete();
        await db.sections.where({ deleteBatchId }).delete();
        await db.parts.where({ deleteBatchId }).delete();
        await db.snippets.where({ deleteBatchId }).delete();
        await db.decisions.where({ deleteBatchId }).delete();
        await db.links.where({ deleteBatchId }).delete();
        await db.walkthroughs.where({ deleteBatchId }).delete();
        await db.bugs.where({ deleteBatchId }).delete();
        await db.checklists.where({ deleteBatchId }).delete();
      }
    );
  },

  async emptyTrash(): Promise<void> {
    const batches = await this.getTrashBatches();
    for (const b of batches) {
      await this.purgeBatch(b.deleteBatchId);
    }
  },

  async autoPurgeOlderThan(days: number = 30): Promise<number> {
    const cutoff = subDays(new Date(), days).toISOString();
    let purgedCount = 0;

    const batches = await this.getTrashBatches(days);
    for (const b of batches) {
      if (b.deletedAt < cutoff) {
        await this.purgeBatch(b.deleteBatchId);
        purgedCount++;
      }
    }

    return purgedCount;
  },
};
