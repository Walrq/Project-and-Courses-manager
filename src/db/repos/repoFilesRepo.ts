import { db, type RepoFile } from '../schema';
import { checkFileSafety } from '../../core/secretCheck';

export const MAX_SINGLE_FILE_CHARS = 100000;
export const MAX_PROJECT_REPO_CHARS = 5000000;

export const repoFilesRepo = {
  async getByProject(projectId: number): Promise<RepoFile[]> {
    return db.repoFiles.where({ projectId }).toArray();
  },

  async getTotalCharsForProject(projectId: number): Promise<number> {
    const files = await this.getByProject(projectId);
    return files.reduce((acc, f) => acc + (f.sizeChars || f.content.length), 0);
  },

  async saveFile(
    projectId: number,
    path: string,
    content: string,
    language: string = 'text',
    includeByDefault: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    const safety = checkFileSafety(path, content);
    if (!safety.isSafe) {
      return { success: false, error: safety.reason || 'File failed security / secret checks.' };
    }

    if (content.length > MAX_SINGLE_FILE_CHARS) {
      return {
        success: false,
        error: `File is larger than ${MAX_SINGLE_FILE_CHARS.toLocaleString()} characters limit (${content.length.toLocaleString()} chars). Skipped.`,
      };
    }

    const currentTotal = await this.getTotalCharsForProject(projectId);
    if (currentTotal + content.length > MAX_PROJECT_REPO_CHARS) {
      return {
        success: false,
        error: `Total stored repo text would exceed the ${MAX_PROJECT_REPO_CHARS.toLocaleString()} character capacity.`,
      };
    }

    const now = new Date().toISOString();
    const existing = await db.repoFiles.where({ projectId, path }).first();

    if (existing?.id) {
      await db.repoFiles.update(existing.id, {
        content,
        sizeChars: content.length,
        language,
        includeByDefault: includeByDefault ? 1 : 0,
        updatedAt: now,
      });
    } else {
      await db.repoFiles.add({
        projectId,
        path,
        content,
        sizeChars: content.length,
        language,
        includeByDefault: includeByDefault ? 1 : 0,
        updatedAt: now,
      });
    }

    return { success: true };
  },

  async deleteFile(id: number): Promise<void> {
    await db.repoFiles.delete(id);
  },

  async clearProjectFiles(projectId: number): Promise<void> {
    await db.repoFiles.where({ projectId }).delete();
  },
};
