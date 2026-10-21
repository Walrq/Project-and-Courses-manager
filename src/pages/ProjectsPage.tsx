import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { projectRepo } from '../db/repos/projectRepo';
import { useUIStore } from '../store/uiStore';
import {
  FolderGit2,
  Plus,
  Search,
  Trash2,
  ArrowRight,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';

interface ContextType {
  openNewProject: () => void;
}

export const ProjectsPage: React.FC = () => {
  const { openNewProject } = useOutletContext<ContextType>();
  const { setActiveProjectId, showToast } = useUIStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'done' | 'archived'>('all');
  const [projectToDelete, setProjectToDelete] = useState<{ id: number; name: string } | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const sections = useLiveQuery(() => db.sections.toArray(), []) || [];
  const parts = useLiveQuery(() => db.parts.toArray(), []) || [];

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      await projectRepo.deleteCascade(projectToDelete.id);
      showToast(`Project '${projectToDelete.name}' and all associated data deleted.`, 'info');
      setProjectToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Delete failed: ${msg}`, 'error');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    await projectRepo.update(id, { status: nextStatus as any });
    showToast(`Project status updated to ${nextStatus}`, 'info');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-neutral-100">Delete Project?</h3>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-neutral-200">"{projectToDelete.name}"</span>?
              This will permanently remove all sections, scheduled parts, memory, and prompts.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="linear-btn-secondary !text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition-all"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Projects
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your offline project plans and generation contexts.
          </p>
        </div>

        <button
          onClick={openNewProject}
          className="linear-btn-primary !text-xs shadow-linear-glow"
        >
          <Plus className="w-3.5 h-3.5" /> New Project
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'paused', 'done', 'archived'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors border ${
                statusFilter === st
                  ? 'bg-white/[0.1] border-white/[0.15] text-neutral-100 shadow-xs'
                  : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
          <FolderGit2 className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-300">No matching projects</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            {search ? 'Try clearing your search query.' : 'Create a new project to start scheduling daily parts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const projectSections = sections.filter((s) => s.projectId === project.id);
            const projectParts = parts.filter((part) =>
              projectSections.some((s) => s.id === part.sectionId)
            );
            const totalParts = projectParts.length;
            const doneParts = projectParts.filter((p) => p.status === 'done').length;
            const progressPct = totalParts > 0 ? Math.round((doneParts / totalParts) * 100) : 0;

            return (
              <div
                key={project.id}
                className="linear-card-hover p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/project/${project.id}`}
                      onClick={() => setActiveProjectId(project.id!)}
                      className="font-semibold text-neutral-100 hover:text-indigo-400 transition-colors line-clamp-1 text-sm"
                    >
                      {project.name}
                    </Link>

                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border font-mono ${
                        project.status === 'active'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : project.status === 'done'
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          : 'bg-white/[0.04] border-white/[0.08] text-neutral-400'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 line-clamp-2 mt-2">
                    {project.description || project.goal || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-1 font-mono">
                      <span>{projectSections.length} sections</span>
                      <span className="text-neutral-300">
                        {doneParts}/{totalParts} parts ({progressPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300 shadow-sm"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(project.id!, project.status)}
                        className="p-1.5 text-neutral-500 hover:text-neutral-200 rounded-lg transition-colors"
                        title={project.status === 'active' ? 'Pause project' : 'Resume project'}
                      >
                        {project.status === 'active' ? (
                          <PauseCircle className="w-4 h-4" />
                        ) : (
                          <PlayCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => setProjectToDelete({ id: project.id!, name: project.name })}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <Link
                      to={`/project/${project.id}`}
                      onClick={() => setActiveProjectId(project.id!)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
