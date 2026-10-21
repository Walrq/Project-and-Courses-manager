import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useUIStore } from '../store/uiStore';
import { Toast } from './Toast';
import { NewProjectModal } from './NewProjectModal';
import { MissedDayModal } from './MissedDayModal';
import { formatLocalDate, findOverdueParts } from '../core/scheduler';
import {
  LayoutDashboard,
  FolderGit2,
  CalendarCheck2,
  Calendar,
  FileCode2,
  Settings,
  Plus,
  Moon,
  Sun,
  Download,
  CheckCircle,
  Search,
  BarChart3,
  Sparkles,
  Trash2,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { SearchModal } from './SearchModal';
import { UndoToast } from './UndoToast';
import { setupUndoKeyboardListener } from '../core/undo';
import { shouldTriggerReminder, sendDailyPartNotification } from '../core/notifications';
import { settingsRepo } from '../db/repos/settingsRepo';

export const Layout: React.FC = () => {
  const location = useLocation();
  const {
    activeProjectId,
    setActiveProjectId,
    theme,
    toggleTheme,
    showToast,
    isInstallable,
    installPrompt,
  } = useUIStore();

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMissedDayDismissed, setIsMissedDayDismissed] = useState(false);
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Global Ctrl+K / Cmd+K search listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global Ctrl+Z undo listener
  useEffect(() => {
    const cleanup = setupUndoKeyboardListener();
    return cleanup;
  }, []);

  // Live query for active projects list
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];

  // Auto-select first project if activeProjectId is not set
  useEffect(() => {
    if (projects.length > 0) {
      const savedId = localStorage.getItem('projectpilot_active_project');
      const found = projects.find((p) => p.id === Number(savedId));
      if (found && found.id) {
        if (activeProjectId !== found.id) setActiveProjectId(found.id);
      } else if (!activeProjectId && projects[0].id) {
        setActiveProjectId(projects[0].id);
      }
    }
  }, [projects, activeProjectId, setActiveProjectId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const activePlan = useLiveQuery(async () => {
    if (!activeProject?.id) return null;
    return db.plans.where({ projectId: activeProject.id }).first();
  }, [activeProject?.id]);

  const activeParts = useLiveQuery(async () => {
    if (!activePlan?.id) return [];
    return db.parts.where({ planId: activePlan.id }).sortBy('orderNo');
  }, [activePlan?.id]) || [];

  const missedParts = useMemo(() => {
    if (isMissedDayDismissed || !activePlan) return [];
    return findOverdueParts(activeParts, todayStr) as any[];
  }, [activeParts, todayStr, isMissedDayDismissed, activePlan]);

  // Check Daily Reminder Notification on mount / day change
  useEffect(() => {
    const checkDailyReminder = async () => {
      const enabled = await settingsRepo.get('notifications_enabled');
      if (enabled === 'true') {
        const reminderTime = (await settingsRepo.get('reminder_time')) || '09:00';
        const lastNotified = await settingsRepo.get('last_notified_date');
        if (shouldTriggerReminder(reminderTime, lastNotified)) {
          const todayPart = activeParts.find(
            (p) => p.plannedDate === todayStr && p.status === 'planned' && !p.isRest
          );
          if (todayPart && activeProject) {
            const sent = sendDailyPartNotification(todayPart.title, activeProject.name);
            if (sent) {
              await settingsRepo.set('last_notified_date', todayStr);
            }
          }
        }
      }
    };
    checkDailyReminder();
  }, [activeParts, activeProject, todayStr]);

  // Global PWA install handler
  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        showToast('ProjectPilot installed as app!', 'success');
      }
    } else {
      showToast('To install, use your browser menu: "Install app" or "Add to Home Screen".', 'info');
    }
  };

  const desktopNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderGit2 },
    { label: 'Today', path: '/today', icon: CalendarCheck2 },
    { label: 'Calendar', path: '/calendar', icon: Calendar },
    { label: 'Stats & Streak', path: '/stats', icon: BarChart3 },
    { label: 'Weekly Review', path: '/review', icon: Sparkles },
    { label: 'Templates', path: '/templates', icon: FileCode2 },
    { label: 'Trash', path: '/trash', icon: Trash2 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const mobileNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Today', path: '/today', icon: CalendarCheck2 },
    { label: 'Calendar', path: '/calendar', icon: Calendar },
    { label: 'Stats', path: '/stats', icon: BarChart3 },
    { label: 'Review', path: '/review', icon: Sparkles },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#fcfcfd] dark:bg-[#08090a] text-neutral-900 dark:text-[#f7f8f8] font-sans antialiased">
      {/* Global Undo Toast */}
      <UndoToast />

      {/* Toast notifications */}
      <Toast />

      {/* Global Search Palette (Ctrl+K) */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* New Project Wizard Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreated={(id) => setActiveProjectId(id)}
      />

      {/* Missed Day Dialog */}
      {!location.pathname.startsWith('/study') && activePlan && missedParts.length > 0 && (
        <MissedDayModal
          isOpen={missedParts.length > 0}
          onClose={() => setIsMissedDayDismissed(true)}
          missedParts={missedParts}
          allParts={activeParts}
          todayStr={todayStr}
          projectName={activeProject?.name || 'Project'}
          partsPerDay={activePlan.partsPerDay}
          restRule={activePlan.restRule}
          deadline={activePlan.deadline}
          onResolved={() => setIsMissedDayDismissed(true)}
        />
      )}

      {/* Desktop Sidebar (Linear Obsidian Style) */}
      <aside className="hidden md:flex flex-col w-60 border-r border-neutral-200/80 dark:border-white/[0.06] bg-[#fbfbfd] dark:bg-[#0c0d12] p-3 shrink-0 justify-between select-none">
        <div className="space-y-4">
          {/* Logo & Workspace title */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                <CheckCircle className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h1 className="font-semibold text-xs leading-tight tracking-tight text-neutral-900 dark:text-[#f7f8f8]">ProjectPilot</h1>
                <p className="text-[10px] text-neutral-400 dark:text-[#62666d] font-medium tracking-wide">Workspace</p>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-[#62666d] dark:hover:text-[#f7f8f8] hover:bg-neutral-100 dark:hover:bg-white/[0.06] rounded-md transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Active project selector & New Project CTA */}
          <div className="space-y-1.5 px-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-[#62666d] px-1 flex items-center justify-between">
              <span>Project</span>
              <button
                onClick={() => setIsNewProjectOpen(true)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold text-[11px] flex items-center gap-0.5 transition-colors"
                title="Create New Project"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            {projects.length > 0 ? (
              <div className="relative">
                <select
                  value={activeProjectId || ''}
                  onChange={(e) => setActiveProjectId(Number(e.target.value))}
                  className="w-full text-xs font-medium px-2.5 py-1.5 pr-7 rounded-lg bg-neutral-100 dark:bg-white/[0.04] hover:bg-neutral-200/50 dark:hover:bg-white/[0.07] border border-neutral-200 dark:border-white/[0.07] text-neutral-900 dark:text-[#f7f8f8] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 appearance-none truncate transition-colors cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-[#13151c] text-neutral-900 dark:text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-neutral-400 dark:text-[#62666d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <button
                onClick={() => setIsNewProjectOpen(true)}
                className="w-full text-xs py-1.5 px-2.5 border border-dashed border-neutral-300 dark:border-white/[0.1] hover:border-indigo-500 text-neutral-500 hover:text-indigo-500 dark:text-[#8a8f98] dark:hover:text-indigo-400 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3 h-3" /> Create first project
              </button>
            )}
          </div>

          {/* Quick Search Ctrl+K trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-neutral-200/80 dark:border-white/[0.06] bg-neutral-100/60 dark:bg-white/[0.03] text-neutral-400 dark:text-[#8a8f98] hover:text-neutral-900 dark:hover:text-[#f7f8f8] hover:border-neutral-300 dark:hover:border-white/[0.12] text-xs transition-all shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-[#62666d]" />
              <span className="text-xs">Search or jump to...</span>
            </span>
            <kbd className="linear-kbd">
              Ctrl+K
            </kbd>
          </button>

          {/* Navigation links */}
          <nav className="space-y-0.5">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-neutral-200/70 dark:bg-white/[0.08] text-neutral-900 dark:text-[#f7f8f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'text-neutral-600 dark:text-[#8a8f98] hover:bg-neutral-200/40 dark:hover:bg-white/[0.04] hover:text-neutral-900 dark:hover:text-[#f7f8f8]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-[#62666d]'}`} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Install PWA */}
        <div className="space-y-2.5 pt-3 border-t border-neutral-200/80 dark:border-white/[0.06] text-xs text-neutral-500 dark:text-[#8a8f98]">
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="w-full linear-btn-primary py-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Install App
            </button>
          )}

          <div className="px-2 py-1 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <span className="font-medium text-neutral-600 dark:text-[#8a8f98]">Local Mode</span>
            </div>
            <span className="text-[10px] text-neutral-400 dark:text-[#62666d] font-mono">100% Offline</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto max-h-screen">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0c0d12]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-neutral-900 dark:text-white">ProjectPilot</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-md"
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsNewProjectOpen(true)}
              className="p-1.5 text-indigo-500 rounded-md hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
              title="New Project"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-md"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="px-4 md:px-8 pt-3 max-w-6xl mx-auto w-full flex justify-end">
          <nav aria-label="Module switch" className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-white/[0.08] bg-neutral-100/70 dark:bg-white/[0.03] p-0.5">
            <NavLink to="/dashboard" className={`px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors ${!location.pathname.startsWith('/study') && location.pathname !== '/' ? 'bg-white dark:bg-white/[0.1] text-indigo-500 dark:text-indigo-300 shadow-sm' : 'text-neutral-500 dark:text-[#8a8f98] hover:text-neutral-900 dark:hover:text-white'}`}>
              <FolderGit2 className="w-3.5 h-3.5" /> Projects
            </NavLink>
            <NavLink to="/study" className={`px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors ${location.pathname.startsWith('/study') ? 'bg-white dark:bg-white/[0.1] text-teal-500 dark:text-teal-300 shadow-sm' : 'text-neutral-500 dark:text-[#8a8f98] hover:text-neutral-900 dark:hover:text-white'}`}>
              <BookOpen className="w-3.5 h-3.5" /> Study
            </NavLink>
          </nav>
        </div>

        <div className="flex-1 p-4 md:p-8 pt-3 md:pt-5 max-w-6xl mx-auto w-full">
          <Outlet context={{ openNewProject: () => setIsNewProjectOpen(true) }} />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-neutral-200 dark:border-white/[0.06] bg-white/95 dark:bg-[#0c0d12]/95 backdrop-blur-md flex items-center justify-around py-1.5 z-40">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-1 min-w-[50px] min-h-[44px] transition-colors ${
                isActive
                  ? 'text-indigo-500 dark:text-indigo-400 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
