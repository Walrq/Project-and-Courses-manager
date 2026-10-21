import React, { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { calculateTimeStats, type TimeStatsSummary } from '../core/timeStats';
import { BarChart3, Clock, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';

export const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<TimeStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scalingApplied, setScalingApplied] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [parts, sections, logs] = await Promise.all([
      db.parts.filter((p) => !p.deletedAt).toArray(),
      db.sections.filter((s) => !s.deletedAt).toArray(),
      db.timeLogs.toArray(),
    ]);

    const summary = calculateTimeStats(parts, sections, logs);
    setStats(summary);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyEstimateCorrection = async () => {
    if (!stats || stats.suggestedRatio === 1) return;
    const confirmed = confirm(
      `Scale all remaining unfinished part estimates by factor of ${stats.suggestedRatio}x?`
    );
    if (!confirmed) return;

    const parts = await db.parts.filter((p) => !p.deletedAt && p.status === 'planned' && !p.isRest).toArray();

    for (const p of parts) {
      if (p.id && p.estMinutes) {
        const scaled = Math.round(p.estMinutes * stats.suggestedRatio);
        await db.parts.update(p.id, { estMinutes: scaled });
      }
    }

    setScalingApplied(true);
    await loadData();
    setTimeout(() => setScalingApplied(false), 3000);
  };

  if (loading) {
    return <div className="p-8 text-center text-neutral-500 text-xs font-mono">Calculating stats...</div>;
  }

  if (!stats) return null;

  const maxDayMinutes = Math.max(1, ...stats.last30Days.map((d) => d.minutes));

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5 tracking-tight">
          <BarChart3 className="w-6 h-6 text-indigo-400" />
          Time & Effort Statistics
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Compare estimated vs actual time, identify overruns, and calibrate your schedule.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Total Focused Time</span>
          <div className="text-2xl font-bold text-neutral-100 flex items-baseline gap-1 font-mono">
            {stats.totalHours} <span className="text-xs text-neutral-400 font-normal">hours</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">{stats.totalActualMinutes.toLocaleString()} total minutes</span>
        </div>

        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Estimate Accuracy Ratio</span>
          <div className="text-2xl font-bold text-neutral-100 flex items-baseline gap-1 font-mono">
            {stats.overallAccuracyRatio}x
          </div>
          <span className="text-[11px] text-neutral-500">
            {stats.overallAccuracyRatio > 1.2
              ? 'Estimates run lower than actual'
              : stats.overallAccuracyRatio < 0.8
              ? 'Estimates run higher than actual'
              : 'Estimates are well calibrated'}
          </span>
        </div>

        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Avg Session Length</span>
          <div className="text-2xl font-bold text-neutral-100 flex items-baseline gap-1 font-mono">
            {stats.averageSessionMinutes} <span className="text-xs text-neutral-400 font-normal">min</span>
          </div>
          <span className="text-[11px] text-neutral-500">per logged focus block</span>
        </div>

        <div className="linear-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Most Productive Day</span>
          <div className="text-2xl font-bold text-indigo-400 font-mono">{stats.mostProductiveWeekday}</div>
          <span className="text-[11px] text-neutral-500">Least: {stats.leastProductiveWeekday}</span>
        </div>
      </div>

      {/* Estimate Correction Notice */}
      {stats.suggestedRatio !== 1 && (
        <div className="bg-indigo-500/[0.08] border border-indigo-500/20 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-neutral-200">
                Calibrate Remaining Work: {stats.suggestedRatio}x Ratio
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Your actual work time averages {stats.suggestedRatio}x of original estimates. Scale remaining planned parts to match reality.
              </p>
            </div>
          </div>

          <button
            onClick={handleApplyEstimateCorrection}
            className="linear-btn-primary !text-xs shrink-0"
          >
            {scalingApplied ? 'Scaled Remaining Parts!' : 'Apply Estimate Correction'}
          </button>
        </div>
      )}

      {/* 30-Day SVG Activity Bar Chart */}
      <div className="linear-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            Daily Focused Minutes (Last 30 Days)
          </h3>
          <span className="text-[11px] font-mono text-neutral-500">Max day: {maxDayMinutes}m</span>
        </div>

        <div className="h-32 flex items-end gap-1.5 pt-4">
          {stats.last30Days.map((d) => {
            const heightPercent = Math.max(4, Math.round((d.minutes / maxDayMinutes) * 100));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 bg-[#0c0d12] border border-white/[0.1] text-[10px] text-neutral-200 font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {d.date}: {d.minutes} mins
                </div>

                <div
                  className={`w-full rounded-t transition-all ${
                    d.minutes > 0 ? 'bg-indigo-500 hover:bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]' : 'bg-white/[0.04]'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sections Accuracy & Overruns */}
      <div className="linear-card p-6 space-y-4">
        <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          Section Estimate Accuracy & Overruns
        </h3>

        {stats.sectionStats.length === 0 ? (
          <p className="text-xs text-neutral-500">No sections found.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {stats.sectionStats.map((s) => (
              <div key={s.sectionId} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-200">{s.sectionTitle}</span>
                    {s.isOverrun && (
                      <span className="px-2 py-0.5 rounded text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium flex items-center gap-1 font-mono">
                        <AlertTriangle className="w-2.5 h-2.5" /> Overrun ({s.accuracyRatio}x)
                      </span>
                    )}
                  </div>
                  <div className="text-neutral-500 mt-0.5 font-mono text-[11px]">
                    Estimated: {s.estimatedMinutes}m | Actual: {s.actualMinutes}m
                  </div>
                </div>

                <div className="text-right font-mono font-medium text-neutral-300">
                  {s.accuracyRatio}x
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
