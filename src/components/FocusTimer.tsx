import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Timer, Bell, Coffee } from 'lucide-react';
import { timeRepo } from '../db/repos/timeRepo';

interface FocusTimerProps {
  projectId?: number;
  partId?: number;
  sectionId?: number;
  onTimeLogged?: (minutes: number) => void;
}

interface SavedTimerState {
  startedAt: string;
  accumulatedSeconds: number;
  isRunning: boolean;
  isPomodoro: boolean;
  pomodoroState: 'focus' | 'break';
  pomodoroSecondsLeft: number;
  projectId?: number;
  partId?: number;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  projectId,
  partId,
  sectionId,
  onTimeLogged,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isPomodoro, setIsPomodoro] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'break'>('focus');
  const [pomodoroLeft, setPomodoroLeft] = useState(25 * 60);

  const startTimeRef = useRef<string | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('focus_timer_state');
      if (saved) {
        const state: SavedTimerState = JSON.parse(saved);
        const now = Date.now();
        const start = new Date(state.startedAt).getTime();
        const elapsedSecs = Math.floor((now - start) / 1000);

        // Check if left running overnight (> 8 hours = 28800s)
        if (state.isRunning && elapsedSecs > 28800) {
          const keep = confirm(
            `A focus timer was left running for over ${Math.floor(elapsedSecs / 3600)} hours. Do you want to keep and save 60 minutes, or discard it?`
          );
          if (keep && state.projectId) {
            timeRepo.create({
              projectId: state.projectId,
              partId: state.partId,
              startedAt: state.startedAt,
              minutes: 60,
              source: 'timer',
              note: 'Recovered from overnight session',
            });
          }
          localStorage.removeItem('focus_timer_state');
        } else if (state.isRunning) {
          // Restore running timer
          setSeconds(state.accumulatedSeconds + elapsedSecs);
          setIsRunning(true);
          setIsPomodoro(state.isPomodoro);
          setPomodoroMode(state.pomodoroState);
          setPomodoroLeft(Math.max(0, state.pomodoroSecondsLeft - elapsedSecs));
          startTimeRef.current = state.startedAt;
        } else {
          setSeconds(state.accumulatedSeconds);
          setIsPomodoro(state.isPomodoro);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save state on change
  useEffect(() => {
    if (isRunning) {
      const state: SavedTimerState = {
        startedAt: startTimeRef.current || new Date().toISOString(),
        accumulatedSeconds: seconds,
        isRunning: true,
        isPomodoro,
        pomodoroState: pomodoroMode,
        pomodoroSecondsLeft: pomodoroLeft,
        projectId,
        partId,
      };
      localStorage.setItem('focus_timer_state', JSON.stringify(state));
    } else if (seconds === 0) {
      localStorage.removeItem('focus_timer_state');
    }
  }, [isRunning, seconds, isPomodoro, pomodoroMode, pomodoroLeft, projectId, partId]);

  // Main tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);

        if (isPomodoro) {
          setPomodoroLeft((p) => {
            if (p <= 1) {
              // Block ended
              triggerPomodoroAlert(pomodoroMode);
              if (pomodoroMode === 'focus') {
                setPomodoroMode('break');
                return 5 * 60; // 5 min break
              } else {
                setPomodoroMode('focus');
                return 25 * 60; // 25 min focus
              }
            }
            return p - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPomodoro, pomodoroMode]);

  const triggerPomodoroAlert = (mode: 'focus' | 'break') => {
    const title = mode === 'focus' ? '🎉 Focus session complete!' : '⚡ Break finished!';
    const body = mode === 'focus' ? 'Time for a 5-minute break.' : 'Ready to start another focus block?';

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' });
    } else {
      alert(`${title}\n${body}`);
    }
  };

  const handleStart = () => {
    if (!startTimeRef.current) {
      startTimeRef.current = new Date().toISOString();
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = async () => {
    setIsRunning(false);
    const loggedMinutes = Math.max(1, Math.round(seconds / 60));

    if (projectId) {
      await timeRepo.create({
        projectId,
        partId: partId || null,
        sectionId: sectionId || null,
        startedAt: startTimeRef.current || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        minutes: loggedMinutes,
        source: 'timer',
      });
      onTimeLogged?.(loggedMinutes);
    }

    setSeconds(0);
    setPomodoroLeft(25 * 60);
    startTimeRef.current = null;
    localStorage.removeItem('focus_timer_state');
  };

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 linear-surface border border-white/[0.08] px-2.5 py-1 rounded-lg text-xs">
      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-neutral-100">
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
        <Timer className="w-3.5 h-3.5 text-neutral-400" />
        <span>{isPomodoro ? formatTime(pomodoroLeft) : formatTime(seconds)}</span>
      </div>

      {isPomodoro && (
        <span
          className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold flex items-center gap-1 font-mono border ${
            pomodoroMode === 'focus'
              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}
        >
          {pomodoroMode === 'focus' ? <Bell className="w-2.5 h-2.5" /> : <Coffee className="w-2.5 h-2.5" />}
          {pomodoroMode}
        </span>
      )}

      <div className="flex items-center gap-0.5">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="p-1 text-neutral-400 hover:text-white hover:bg-white/[0.08] rounded transition-colors"
            title="Start Timer"
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="p-1 text-amber-400 hover:bg-white/[0.08] rounded transition-colors"
            title="Pause Timer"
          >
            <Pause className="w-3 h-3 fill-current" />
          </button>
        )}

        {(seconds > 0 || isRunning) && (
          <button
            onClick={handleStop}
            className="p-1 text-rose-400 hover:bg-white/[0.08] rounded transition-colors"
            title="Stop & Save Session"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        )}
      </div>

      <button
        onClick={() => {
          setIsPomodoro(!isPomodoro);
          setPomodoroMode('focus');
          setPomodoroLeft(25 * 60);
        }}
        className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors border ${
          isPomodoro
            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
            : 'border-white/[0.06] text-neutral-400 hover:text-white'
        }`}
        title="Toggle Pomodoro mode (25m / 5m)"
      >
        Pomo
      </button>
    </div>
  );
};
