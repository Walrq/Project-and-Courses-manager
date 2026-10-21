import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, BookOpen, CalendarCheck2, Flame, FolderGit2 } from 'lucide-react';
import { db } from '../db/schema';
import { formatLocalDate } from '../core/scheduler';
import { DailyTechBrief } from '../components/DailyTechBrief';

function countStreak(dates: string[]): number {
  const completed = new Set(dates);
  const date = new Date();
  let key = formatLocalDate(date);
  if (!completed.has(key)) {
    date.setDate(date.getDate() - 1);
    key = formatLocalDate(date);
  }
  let streak = 0;
  while (completed.has(key)) {
    streak += 1;
    date.setDate(date.getDate() - 1);
    key = formatLocalDate(date);
  }
  return streak;
}

export const HomePage: React.FC = () => {
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const parts = useLiveQuery(() => db.parts.toArray(), []) || [];
  const studyItems = useLiveQuery(() => db.study_items.toArray(), []) || [];
  const studySessions = useLiveQuery(() => db.study_sessions.toArray(), []) || [];

  const projectStreak = useMemo(
    () => countStreak(parts.filter((part) => part.status === 'done' && part.completedAt).map((part) => part.completedAt!.slice(0, 10))),
    [parts]
  );
  const studyStreak = useMemo(
    () => countStreak(studySessions.filter((session) => session.done === 1).map((session) => session.date)),
    [studySessions]
  );
  const projectTodayCount = parts.filter((part) => part.plannedDate === today && !part.isRest && part.status !== 'skipped').length;
  const studyTodayCount = studySessions.filter((session) => session.date === today && session.done !== 1 && session.type !== 'rest').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="text-center space-y-2 pt-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-teal-500/20 border border-indigo-500/20 flex items-center justify-center">
          <CalendarCheck2 className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">What are you working on?</h1>
        <p className="text-sm text-neutral-500 dark:text-[#8a8f98]">Choose a module to continue.</p>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        <DailyTechBrief />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        <Link to="/dashboard" className="linear-card-hover group p-6 sm:p-8 flex flex-col min-h-64 border-indigo-500/10 hover:border-indigo-500/30">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-neutral-500 dark:text-[#8a8f98] mt-1">Plan and build your projects one day at a time.</p>
          <div className="grid grid-cols-3 gap-2 mt-auto pt-7">
            <Metric label="Active" value={projects.filter((project) => project.status === 'active').length} />
            <Metric label="Today" value={projectTodayCount} />
            <Metric label="Streak" value={`${projectStreak}d`} icon={<Flame className="w-3 h-3 text-orange-400" />} />
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-indigo-400 mt-5 group-hover:gap-2 transition-all">Open Projects <ArrowRight className="w-3.5 h-3.5" /></div>
        </Link>

        <Link to="/study" className="linear-card-hover group p-6 sm:p-8 flex flex-col min-h-64 border-teal-500/10 hover:border-teal-500/30">
          <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5">
            <BookOpen className="w-5 h-5 text-teal-400" />
          </div>
          <h2 className="text-lg font-semibold">Study</h2>
          <p className="text-sm text-neutral-500 dark:text-[#8a8f98] mt-1">Understand, remember, and finish a course or syllabus.</p>
          <div className="grid grid-cols-3 gap-2 mt-auto pt-7">
            <Metric label="Active" value={studyItems.filter((item) => item.archived === 0).length} />
            <Metric label="Today" value={studyTodayCount} />
            <Metric label="Streak" value={`${studyStreak}d`} icon={<Flame className="w-3 h-3 text-orange-400" />} />
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-teal-400 mt-5 group-hover:gap-2 transition-all">Open Study <ArrowRight className="w-3.5 h-3.5" /></div>
        </Link>
      </div>
      <p className="text-center text-[11px] text-neutral-500 dark:text-[#626670]">Project plans and study data are kept in separate local collections.</p>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-lg bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/[0.05] p-2.5">
    <div className="flex items-center gap-1 text-base font-semibold">{icon}{value}</div>
    <div className="text-[10px] text-neutral-500 dark:text-[#8a8f98] mt-0.5">{label}</div>
  </div>
);
