import React, { useState, useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import { exportDatabaseToJSON, downloadBackupFile, restoreDatabaseFromJSON } from '../db/backup';
import {
  isFileSystemAccessSupported,
  pickBackupDirectory,
  saveBackupToDirectory,
  isBackupOverdue,
} from '../core/autoBackup';
import {
  getNotificationPermission,
  sendDailyPartNotification,
} from '../core/notifications';
import { settingsRepo } from '../db/repos/settingsRepo';
import {
  HardDrive,
  Download,
  Upload,
  Moon,
  Sun,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FolderDown,
  Bell,
  BellRing,
  FolderCheck,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    theme,
    toggleTheme,
    showToast,
    isInstallable,
    installPrompt,
  } = useUIStore();

  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: number; quotaMB: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);

  // Auto-backup states
  const [backupDirHandle, setBackupDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [isSavingToDir, setIsSavingToDir] = useState(false);

  // Notifications states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  // Load storage estimation and persistence
  useEffect(() => {
    if (navigator.storage) {
      if (navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          setStorageEstimate({
            usageMB: est.usage ? Math.round((est.usage / (1024 * 1024)) * 100) / 100 : 0,
            quotaMB: est.quota ? Math.round((est.quota / (1024 * 1024)) * 100) / 100 : 0,
          });
        });
      }

      if (navigator.storage.persisted) {
        navigator.storage.persisted().then((persisted) => {
          setIsPersisted(persisted);
        });
      }
    }
  }, []);

  const handleRequestPersist = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      if (granted) {
        showToast('Persistent storage granted by browser!', 'success');
      } else {
        showToast('Browser did not grant persistent storage.', 'info');
      }
    }
  };

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const lastBackup = await settingsRepo.get('last_backup_date');
      setLastBackupDate(lastBackup);

      const notifEnabled = await settingsRepo.get('notifications_enabled');
      setNotificationsEnabled(notifEnabled === 'true');

      const savedTime = await settingsRepo.get('reminder_time');
      if (savedTime) setReminderTime(savedTime);

      setPermissionStatus(getNotificationPermission());
    };
    loadSettings();
  }, []);

  const handleSelectBackupFolder = async () => {
    try {
      const handle = await pickBackupDirectory();
      if (handle) {
        setBackupDirHandle(handle);
        showToast(`Backup folder selected: "${handle.name}"`, 'success');
      }
    } catch (err: any) {
      showToast(`Could not select folder: ${err.message}`, 'error');
    }
  };

  const handleSaveToFolder = async () => {
    if (!backupDirHandle) {
      showToast('Please select a backup folder first.', 'info');
      return;
    }
    setIsSavingToDir(true);
    try {
      const json = await exportDatabaseToJSON();
      const res = await saveBackupToDirectory(backupDirHandle, json);
      const now = new Date().toISOString();
      await settingsRepo.set('last_backup_date', now);
      setLastBackupDate(now);
      showToast(`Saved backup "${res.filename}" to folder!`, 'success');
    } catch (err: any) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setIsSavingToDir(false);
    }
  };

  const handleToggleNotifications = async () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    await settingsRepo.set('notifications_enabled', String(next));
    showToast(`Reminders ${next ? 'enabled' : 'disabled'}`, 'info');
  };

  const handleChangeReminderTime = async (time: string) => {
    setReminderTime(time);
    await settingsRepo.set('reminder_time', time);
  };

  const handleTestNotification = async () => {
    const sent = await sendDailyPartNotification('Part #1: Core Setup', 'Verify database migration and schema setup.');
    if (sent) {
      showToast('Test notification dispatched!', 'success');
    } else {
      showToast('Could not send notification. Please allow permissions in browser.', 'info');
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportDatabaseToJSON();
      downloadBackupFile(json);
      const now = new Date().toISOString();
      await settingsRepo.set('last_backup_date', now);
      setLastBackupDate(now);
      showToast('Backup exported and downloaded!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Export failed: ${msg}`, 'error');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreFileContent(content);
      setRestoreConfirmOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreFileContent) return;
    setIsRestoring(true);
    try {
      const result = await restoreDatabaseFromJSON(restoreFileContent);
      if (result.success) {
        showToast('Database restored successfully from backup!', 'success');
        setRestoreConfirmOpen(false);
        setRestoreFileContent(null);
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast(result.error || 'Restore failed.', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Restore failed: ${msg}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
      {/* Restore Confirmation Dialog */}
      {restoreConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-neutral-100">
                Replace Current Database?
              </h3>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Restoring this backup will <strong className="text-rose-400">completely replace</strong> all current projects, parts, memory, and prompts. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRestoreConfirmOpen(false);
                  setRestoreFileContent(null);
                }}
                className="linear-btn-secondary !text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
          Settings & Data Safety
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Configure appearance, manage local IndexedDB backups, and check offline storage.
        </p>
      </div>

      {/* Critical Data Safety Notice */}
      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] space-y-2">
        <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Local Device Privacy & Storage Policy</span>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Your data lives <strong className="text-neutral-200">only in this browser on this device</strong>. Clearing your browser site data or cookies deletes it. No data is ever sent to any remote server or AI API. Keep regular backups to protect your projects.
        </p>
      </div>

      {/* Appearance Section */}
      <div className="linear-card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Appearance</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-xs text-neutral-200">Color Theme</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">Switch between dark mode and light mode</div>
          </div>

          <button
            onClick={toggleTheme}
            className="linear-btn-secondary !text-xs"
          >
            {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <span className="capitalize">{theme} Mode</span>
          </button>
        </div>
      </div>

      {/* Storage & Persistence Status */}
      <div className="linear-card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Local Storage Status
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#0a0b0f] border border-white/[0.06]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Database Space Used</span>
            <div className="text-xl font-bold text-neutral-100 mt-1 font-mono">
              {storageEstimate ? `${storageEstimate.usageMB} MB` : 'Checking...'}
            </div>
            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Available quota: {storageEstimate ? `${storageEstimate.quotaMB} MB` : 'Checking...'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0a0b0f] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Eviction Protection</span>
              <div className="flex items-center gap-1.5 mt-1 font-mono">
                {isPersisted ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Persisted (Protected)
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-400">
                    Standard (Best-effort)
                  </span>
                )}
              </div>
            </div>

            {!isPersisted && (
              <button
                onClick={handleRequestPersist}
                className="mt-2 text-left text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Request Eviction Protection &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overdue backup warning */}
      {isBackupOverdue(lastBackupDate) && (
        <div className="p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold text-neutral-200">Weekly Backup Reminder:</span>{' '}
              {lastBackupDate
                ? `Your last backup was on ${new Date(lastBackupDate).toLocaleDateString()}. Browser storage can be cleared by OS disk cleanup.`
                : 'You have not exported a backup yet. Export one now to protect your data.'}
            </div>
          </div>
          <button
            onClick={handleExportBackup}
            className="linear-btn-secondary !text-amber-300 !border-amber-500/30 hover:!bg-amber-500/20 !text-xs shrink-0"
          >
            Export Now
          </button>
        </div>
      )}

      {/* Backup and Restore */}
      <div className="linear-card p-5 space-y-4">
        <p className="text-xs text-neutral-400">
          Progress Den automatically downloads one backup each day when you open the app and have saved project or study data. Your browser may ask you to allow automatic downloads; files go to its usual Downloads location.
        </p>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Backup & Disaster Recovery</h2>
          {lastBackupDate && (
            <span className="text-[11px] text-neutral-500 font-mono">
              Last backup: {new Date(lastBackupDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Native Directory Auto-Backup (File System Access API) */}
        {isFileSystemAccessSupported() && (
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0a0b0f] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-medium text-xs text-neutral-200 flex items-center gap-2">
                  <FolderDown className="w-3.5 h-3.5 text-indigo-400" /> Auto-Save to Local Folder
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Pick a folder on your computer to save daily timestamped JSON backups directly.
                </p>
              </div>

              {backupDirHandle && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <FolderCheck className="w-3.5 h-3.5" /> Folder: {backupDirHandle.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSelectBackupFolder}
                className="linear-btn-secondary !text-xs"
              >
                <FolderDown className="w-3.5 h-3.5 text-indigo-400" />
                {backupDirHandle ? 'Change Backup Folder' : 'Select Backup Folder'}
              </button>

              {backupDirHandle && (
                <button
                  type="button"
                  disabled={isSavingToDir}
                  onClick={handleSaveToFolder}
                  className="linear-btn-primary !text-xs shadow-linear-glow"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isSavingToDir ? 'Saving...' : 'Save Backup to Folder Now'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0a0b0f] flex flex-col justify-between space-y-3">
            <div>
              <h3 className="font-medium text-xs text-neutral-200">Export Backup File</h3>
              <p className="text-[11px] text-neutral-400 mt-1">
                Download a timestamped <code className="text-indigo-400 font-mono">.json</code> snapshot containing all your projects, plans, notes, memory, and prompts.
              </p>
            </div>

            <button
              onClick={handleExportBackup}
              className="linear-btn-primary !text-xs shadow-linear-glow"
            >
              <Download className="w-3.5 h-3.5" /> Export Backup File (.json)
            </button>
          </div>

          {/* Restore */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0a0b0f] flex flex-col justify-between space-y-3">
            <div>
              <h3 className="font-medium text-xs text-neutral-200">Restore from Backup</h3>
              <p className="text-[11px] text-neutral-400 mt-1">
                Restore data from a previously exported backup file. Validates schemas with Zod before writing.
              </p>
            </div>

            <label className="linear-btn-secondary !text-xs cursor-pointer flex items-center justify-center gap-2">
              <Upload className="w-3.5 h-3.5 text-neutral-400" /> Select Backup File to Restore
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelected}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Daily Reminders & Notifications */}
      <div className="linear-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-indigo-400" /> Daily Check-In Reminders
            </h2>
            <p className="text-[11px] text-neutral-400">
              Receive a gentle browser notification when today's part is ready to begin.
            </p>
          </div>

          <button
            onClick={handleToggleNotifications}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              notificationsEnabled
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'linear-btn-secondary'
            }`}
          >
            {notificationsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {notificationsEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/[0.06]">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Reminder Time
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => handleChangeReminderTime(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-[#0a0b0f] text-neutral-100 font-mono focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="linear-btn-secondary !text-xs"
                >
                  <BellRing className="w-3 h-3 text-indigo-400" /> Test Notification
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Permission Status
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] font-mono border ${
                    permissionStatus === 'granted'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : permissionStatus === 'denied'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}
                >
                  {permissionStatus}
                </span>
                <span className="text-neutral-500 text-[11px]">
                  {permissionStatus === 'granted'
                    ? 'Browser allowed notifications.'
                    : 'Permission needed from browser.'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* App Installation */}
      {isInstallable && (
        <div className="linear-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Install Progress Den App</h2>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Install as a standalone desktop or mobile application for quick access and full offline reliability.
              </p>
            </div>
            <button
              onClick={() => {
                if (installPrompt) {
                  installPrompt.prompt();
                } else {
                  showToast('Use browser menu: "Install Progress Den"', 'info');
                }
              }}
              className="linear-btn-primary !text-xs shadow-linear-glow"
            >
              <Download className="w-3.5 h-3.5" /> Install App
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
