import React, { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useUIStore } from '../store/uiStore';
import { formatLocalDate } from '../core/scheduler';
import {
  FolderGit2,
  CalendarCheck2,
  Plus,
  ArrowRight,
  ShieldAlert,
  Flame,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ContextType {
  openNewProject: () => void;
}

export const DashboardPage: React.FC = () => {
  const { openNewProject } = useOutletContext<ContextType>();
  const { setActiveProjectId } = useUIStore();

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const parts = useLiveQuery(() => db.parts.toArray(), []) || [];
  const sections = useLiveQuery(() => db.sections.toArray(), []) || [];
  const responses = useLiveQuery(() => db.responses.toArray(), []) || [];
  const backupSettings = useLiveQuery(() => db.settings.get('last_backup_date'), []);

  // Compute stats
  const activeProjects = projects.filter((p) => p.status === 'active');

  const todayParts = parts.filter(
    (p) => !p.isRest && p.plannedDate === todayStr && p.status !== 'skipped'
  );

  const overdueParts = parts.filter(
    (p) => !p.isRest && p.plannedDate && p.plannedDate < todayStr && p.status === 'planned'
  );

  // Compute completed streak (consecutive days leading up to today or yesterday with a done part)
  const streak = useMemo(() => {
    const doneDates = new Set(
      parts
        .filter((p) => p.status === 'done' && p.completedAt)
        .map((p) => p.completedAt!.split('T')[0])
    );
    let count = 0;
    let d = new Date();
    // Check today or yesterday
    let checkDateStr = formatLocalDate(d);
    if (!doneDates.has(checkDateStr)) {
      d.setDate(d.getDate() - 1);
      checkDateStr = formatLocalDate(d);
    }
    while (doneDates.has(checkDateStr)) {
      count++;
      d.setDate(d.getDate() - 1);
      checkDateStr = formatLocalDate(d);
    }
    return count;
  }, [parts]);

  // Check if backup is older than 7 days
  const needsBackupWarning = useMemo(() => {
    if (!backupSettings?.value) return projects.length > 0;
    const lastDate = new Date(backupSettings.value);
    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 3600 * 24);
    return diffDays > 7;
  }, [backupSettings, projects.length]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Backup Alert Banner */}
      {needsBackupWarning && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold text-amber-400">Backup recommendation:</span> No local backup exported recently. All data lives in your browser IndexedDB.
            </div>
          </div>
          <Link
            to="/settings"
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-xs rounded-md border border-amber-500/30 transition-colors shrink-0 ml-4"
          >
            Export Backup
          </Link>
        </div>
      )}

      {/* Top Welcome & KPI Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-neutral-200/60 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">
            Dashboard
          </h1>
          <p className="text-xs text-neutral-500 dark:text-[#8a8f98] mt-0.5">
            Today is <span className="font-medium text-neutral-700 dark:text-[#d0d3d8]">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </p>
        </div>

        <button
          onClick={openNewProject}
          className="linear-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" /> New Project
        </button>
      </div>

      {/* Quick Metrics Grid (Linear style cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="linear-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0">
            <CalendarCheck2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">{todayParts.length}</div>
            <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8a8f98]">Today's Parts</div>
          </div>
        </div>

        <Link
          to="/stats"
          className="linear-card-hover p-4 flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">{streak} days</div>
            <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8a8f98] group-hover:text-orange-400 transition-colors">Streak & Heatmap &rarr;</div>
          </div>
        </Link>

        <div className="linear-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">{overdueParts.length}</div>
            <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8a8f98]">Overdue Parts</div>
          </div>
        </div>

        <div className="linear-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
            <FolderGit2 className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">{activeProjects.length}</div>
            <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8a8f98]">Active Projects</div>
          </div>
        </div>
      </div>

      {/* Today's Focus Action Section */}
      <div className="linear-card p-5 relative overflow-hidden bg-gradient-to-b from-indigo-500/[0.04] to-transparent dark:from-indigo-500/[0.06] dark:to-transparent">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Today's Workflow
            </div>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">
              {todayParts.length > 0
                ? `${todayParts.length} part scheduled for today`
                : 'No parts scheduled for today'}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-[#8a8f98] max-w-xl">
              {todayParts.length > 0
                ? `Current part: "${todayParts[0].title}". Generate the daily prompt, execute in your favorite LLM, and update project memory.`
                : 'Take a rest day, or select an active project to schedule upcoming parts.'}
            </p>
          </div>

          <Link
            to="/today"
            className="linear-btn-primary shrink-0"
          >
            Open Today View <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Active Projects List with Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8]">Active Projects</h2>
          <Link
            to="/projects"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"
          >
            View all ({projects.length}) <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {activeProjects.length === 0 ? (
          <div className="linear-surface p-10 text-center border-dashed">
            <FolderGit2 className="w-10 h-10 text-neutral-400 dark:text-[#62666d] mx-auto mb-2.5" />
            <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">No active projects yet</h3>
            <p className="text-xs text-neutral-500 dark:text-[#8a8f98] mt-1 max-w-sm mx-auto">
              Create a new project from scratch, use a starter archetype, or let an AI generate the breakdown.
            </p>
            <button
              onClick={openNewProject}
              className="mt-3.5 linear-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" /> Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeProjects.map((project) => {
              const projectSections = sections.filter((s) => s.projectId === project.id);
              const projectParts = parts.filter((part) => {
                return projectSections.some((s) => s.id === part.sectionId);
              });

              const totalPartsCount = projectParts.length;
              const donePartsCount = projectParts.filter((p) => p.status === 'done').length;
              const progressPct =
                totalPartsCount > 0 ? Math.round((donePartsCount / totalPartsCount) * 100) : 0;

              return (
                <Link
                  key={project.id}
                  to={`/project/${project.id}`}
                  onClick={() => setActiveProjectId(project.id!)}
                  className="linear-card-hover p-4 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-semibold tracking-tight text-neutral-900 dark:text-[#f7f8f8] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {project.name}
                      </h3>
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                        {project.status}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-500 dark:text-[#8a8f98] line-clamp-2 mt-1">
                      {project.description || project.goal || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-[#8a8f98]">
                      <span>{projectSections.length} sections</span>
                      <span className="font-medium text-neutral-700 dark:text-[#d0d3d8]">
                        {donePartsCount}/{totalPartsCount} parts ({progressPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200/80 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
