import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useUIStore } from '../store/uiStore';
import { formatLocalDate, parseLocalDate, isRestDay } from '../core/scheduler';
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  X,
} from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const { activeProjectId } = useUIStore();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const plan = useLiveQuery(async () => {
    if (!activeProject?.id) return null;
    return db.plans.where({ projectId: activeProject.id }).first();
  }, [activeProject?.id]);

  const parts = useLiveQuery(async () => {
    if (!plan?.id) return [];
    return db.parts.where({ planId: plan.id }).toArray();
  }, [plan?.id]) || [];

  // Generate calendar grid for currentMonth
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);
    const totalDays = lastDayOfMonth.getDate();

    const grid: Array<{ dateStr: string; dayNumber: number; inCurrentMonth: boolean }> = [];

    // Preceding padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i, 12, 0, 0);
      grid.push({ dateStr: formatLocalDate(d), dayNumber: d.getDate(), inCurrentMonth: false });
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d, 12, 0, 0);
      grid.push({ dateStr: formatLocalDate(dateObj), dayNumber: d, inCurrentMonth: true });
    }

    // Trailing padding to make multiple of 7
    const remaining = 7 - (grid.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i, 12, 0, 0);
        grid.push({ dateStr: formatLocalDate(d), dayNumber: d.getDate(), inCurrentMonth: false });
      }
    }

    return grid;
  }, [year, month]);

  // Selected Day parts
  const selectedDayParts = useMemo(() => {
    if (!selectedDay) return [];
    return parts.filter((p) => p.plannedDate === selectedDay);
  }, [selectedDay, parts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Schedule Calendar
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Visualizing work parts, rest intervals, and milestones for{' '}
            <span className="font-semibold text-neutral-200">{activeProject?.name || 'All Projects'}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            className="linear-btn-secondary !p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-xs min-w-[140px] text-center text-neutral-100 font-mono">
            {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="linear-btn-secondary !p-2"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-400 font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <span>Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Rest Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-400" />
          <span>Skipped</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full border border-indigo-400" />
          <span>Today</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="linear-card overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02] text-center py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar days cells */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {daysInMonth.map((cell) => {
            const dayParts = parts.filter((p) => p.plannedDate === cell.dateStr);
            const isToday = cell.dateStr === todayStr;
            const isSelected = cell.dateStr === selectedDay;

            // Rest day check via plan rule
            const dateObj = parseLocalDate(cell.dateStr);
            const isRest = plan?.restRule
              ? isRestDay(dateObj, cell.dayNumber, plan.restRule)
              : false;

            return (
              <button
                key={cell.dateStr}
                onClick={() => setSelectedDay(cell.dateStr)}
                className={`min-h-[92px] p-2.5 border-b border-r border-white/[0.04] text-left flex flex-col justify-between transition-all relative ${
                  !cell.inCurrentMonth ? 'opacity-20 bg-white/[0.01]' : 'hover:bg-white/[0.02]'
                } ${isSelected ? 'ring-1 ring-indigo-500 bg-indigo-500/[0.05] z-10' : ''} ${
                  isToday ? 'bg-indigo-500/[0.03]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-linear-glow'
                        : 'text-neutral-300'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {isRest && (
                    <span title="Rest Day">
                      <Coffee className="w-3 h-3 text-amber-400" />
                    </span>
                  )}
                </div>

                {/* Day parts pills */}
                <div className="space-y-1 mt-1.5 w-full overflow-hidden">
                  {dayParts.map((p) => (
                    <div
                      key={p.id}
                      className={`text-[9px] px-1.5 py-0.5 rounded truncate font-medium border ${
                        p.status === 'done'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : p.status === 'skipped'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}
                    >
                      {p.title}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Drawer / Details Modal */}
      {selectedDay && (
        <div className="linear-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="font-semibold text-sm text-neutral-100">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {selectedDayParts.length} parts scheduled
              </span>
            </div>

            <button
              onClick={() => setSelectedDay(null)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {selectedDayParts.length === 0 ? (
              <p className="text-xs text-neutral-500 py-2">No parts scheduled for this day.</p>
            ) : (
              selectedDayParts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg border border-white/[0.06] bg-[#0a0b0f] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        p.status === 'done' ? 'bg-emerald-400' : 'bg-indigo-500'
                      }`}
                    />
                    <span className="font-medium text-neutral-100">{p.title}</span>
                    {p.goal && <span className="text-neutral-400">— {p.goal}</span>}
                  </div>

                  <span className="font-bold uppercase text-[9px] text-neutral-500 font-mono">{p.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
