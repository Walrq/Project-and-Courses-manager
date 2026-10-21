import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ensureDefaultTemplates } from './db/schema';
import { useUIStore } from './store/uiStore';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectPage } from './pages/ProjectPage';
import { TodayPage } from './pages/TodayPage';
import { CalendarPage } from './pages/CalendarPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { WeeklyReviewPage } from './pages/WeeklyReviewPage';
import { TrashPage } from './pages/TrashPage';
import { HomePage } from './pages/HomePage';
import { StudyPage } from './pages/StudyPage';
import { StudyItemPage } from './pages/StudyItemPage';
import { StudyTodayPage } from './pages/StudyTodayPage';
import { StudyHistoryPage } from './pages/StudyHistoryPage';

export function App() {
  const { theme, setInstallPrompt } = useUIStore();

  useEffect(() => {
    // 1. Ensure default prompt templates exist in Dexie
    ensureDefaultTemplates().catch(console.error);

    // 2. Synchronize theme class on document element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 3. Capture PWA beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [theme, setInstallPrompt]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="project/:id" element={<ProjectPage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="review" element={<WeeklyReviewPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="study/today" element={<StudyTodayPage />} />
          <Route path="study/history" element={<StudyHistoryPage />} />
          <Route path="history" element={<StudyHistoryPage />} />
          <Route path="study/:id" element={<StudyItemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
