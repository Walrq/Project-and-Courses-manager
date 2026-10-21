/**
 * Utilities for File System Access API and Auto-Backup.
 */

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Prompts the user to pick a folder on their local computer to save backups.
 */
export async function pickBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await (window as any).showDirectoryPicker({
      id: 'projectpilot_backups',
      mode: 'readwrite',
    });
    return handle as FileSystemDirectoryHandle;
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Writes backup JSON data to a chosen directory handle.
 */
export async function saveBackupToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  backupData: any,
  customFilename?: string
): Promise<{ success: boolean; filename: string }> {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `projectpilot-backup-${dateStr}.json`;

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(JSON.stringify(backupData, null, 2));
  await writable.close();

  return { success: true, filename };
}

/**
 * Checks whether backups are overdue (more than thresholdDays old, default 7).
 */
export function isBackupOverdue(
  lastBackupDateStr?: string | null,
  thresholdDays: number = 7,
  referenceDate: Date = new Date()
): boolean {
  if (!lastBackupDateStr) return true;

  const lastBackup = new Date(lastBackupDateStr);
  if (isNaN(lastBackup.getTime())) return true;

  const diffMs = referenceDate.getTime() - lastBackup.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= thresholdDays;
}
