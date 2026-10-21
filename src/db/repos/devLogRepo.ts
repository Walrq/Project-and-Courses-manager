import { db, type DevLog } from '../schema';
import { format } from 'date-fns';

export const devLogRepo = {
  async getByProject(projectId: number): Promise<DevLog[]> {
    return db.devLog.where({ projectId }).reverse().sortBy('date');
  },

  async logEntry(
    projectId: number,
    text: string,
    kind: DevLog['kind'] = 'note',
    options: {
      partId?: number | null;
      minutes?: number;
      date?: string;
      source?: 'auto' | 'manual';
    } = {}
  ): Promise<number> {
    const today = options.date || format(new Date(), 'yyyy-MM-dd');
    const now = new Date().toISOString();

    return db.devLog.add({
      projectId,
      date: today,
      text: text.trim(),
      kind,
      partId: options.partId,
      minutes: options.minutes,
      source: options.source || 'manual',
      createdAt: now,
    });
  },

  async exportToMarkdown(projectId: number, projectName: string): Promise<string> {
    const entries = await this.getByProject(projectId);
    const lines: string[] = [`# Changelog & Dev Log: ${projectName}\n`];

    // Group by date
    const dateMap = new Map<string, DevLog[]>();
    for (const entry of entries) {
      if (!dateMap.has(entry.date)) {
        dateMap.set(entry.date, []);
      }
      dateMap.get(entry.date)!.push(entry);
    }

    for (const [date, items] of dateMap.entries()) {
      lines.push(`## ${date}`);
      for (const item of items) {
        const kindTag = item.kind ? `[${item.kind.toUpperCase()}] ` : '';
        const mins = item.minutes ? ` (${item.minutes}m)` : '';
        lines.push(`- **${kindTag}**${item.text}${mins}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  },
};
