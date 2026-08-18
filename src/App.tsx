/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { HeaderTopBar, HeaderControlBar } from './components/Header.js';
import { CahierJournalSection } from './components/CahierJournalSection.js';
import { HomeworkSection } from './components/HomeworkSection.js';
import { PlanDeTravailView } from './components/PlanDeTravailView.js';
import { DevoirsView } from './components/DevoirsView.js';
import { SettingsModal } from './components/SettingsModal.js';
import { ProgressionsModal } from './components/ProgressionsModal.js';
import { AddActivityModal } from './components/AddActivityModal.js';
import { AddHomeworkModal } from './components/AddHomeworkModal.js';
import { LoginModal } from './components/LoginModal.js';
import { TodoNotesCartouche } from './components/TodoNotesCartouche.js';
import { FooterSettingsBar } from './components/FooterSettingsBar.js';
import { api } from './services/api.js';
import { formatDateFrench, shiftDateString } from './utils/dateUtils.js';
import {
  DailyCahierJournal,
  HomeworkAdjustment,
  UserSettings,
  DelayEvent,
  DatabaseStatus,
  GradeLevel,
  CreneauType,
  ChronologicalProgression,
  ManualAdjustment,
  ActivityCardItem,
} from './types.js';

export default function App() {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
    return new Date().toISOString().split('T')[0];
  });
  const [gradeFilter, setGradeFilter] = useState<GradeLevel>('Tous');
  const [isPlanDeTravail, setIsPlanDeTravail] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'plan-de-travail';
  });
  const [isDevoirsMode, setIsDevoirsMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'devoirs';
  });

  // Data states
  const [journal, setJournal] = useState<DailyCahierJournal | null>(null);
  const [homework, setHomework] = useState<HomeworkAdjustment[]>([]);
  const [availableGrades, setAvailableGrades] = useState<GradeLevel[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    absences_count: 0,
    working_days: [],
    school_year_start: '2026-09-01',
  });
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [matinProgression, setMatinProgression] = useState<ChronologicalProgression[]>([]);
  const [apremProgression, setApremProgression] = useState<ChronologicalProgression[]>([]);

  // Frontend in-memory cache for ultra-fast navigation & week jumps
  const journalCacheRef = React.useRef<Map<string, DailyCahierJournal>>(new Map());
  const homeworkCacheRef = React.useRef<Map<string, HomeworkAdjustment[]>>(new Map());

  const clearFrontendCache = useCallback(() => {
    journalCacheRef.current.clear();
    homeworkCacheRef.current.clear();
  }, []);

  // Loading & Action states
  const [isLoadingJournal, setIsLoadingJournal] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [hasLocalStorageItems, setHasLocalStorageItems] = useState<boolean>(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isProgressionsOpen, setIsProgressionsOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<ActivityCardItem | null>(null);
  const [addActivityModal, setAddActivityModal] = useState<{
    isOpen: boolean;
    creneau: CreneauType;
  }>({
    isOpen: false,
    creneau: 'matin',
  });
  const [isAddHomeworkOpen, setIsAddHomeworkOpen] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Check LocalStorage for homework migration badge
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cahier_journal_homework_backup');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHasLocalStorageItems(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch DB status & settings
  const fetchStatusAndSettings = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/db/status');
      if (statusRes.ok) {
        const st = await statusRes.json();
        setDbStatus(st);
      }
      const settingsRes = await fetch('/api/settings?teacher_id=JulieCB');
      if (settingsRes.ok) {
        const se = await settingsRes.json();
        setSettings(se);
      }
      const gradesRes = await fetch('/api/available-grades');
      if (gradesRes.ok) {
        const gr = await gradesRes.json();
        if (Array.isArray(gr) && gr.length > 0) {
          setAvailableGrades(gr);
        }
      }
    } catch {
      // Offline or fallback status
      setDbStatus({
        type: 'simulation-memory',
        message: 'Simulation active en mémoire.',
      });
    }
  }, []);

  // Fetch daily journal with cache support
  const fetchDailyJournal = useCallback(
    async (dateStr: string, grade: GradeLevel) => {
      const cacheKey = `${dateStr}_${grade}`;
      const cached = journalCacheRef.current.get(cacheKey);
      if (cached) {
        setJournal(cached);
        setIsLoadingJournal(false);
      } else {
        setIsLoadingJournal(true);
      }

      try {
        const url = `/api/cahier-journal/${dateStr}?grade=${encodeURIComponent(grade)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          journalCacheRef.current.set(cacheKey, data);
          setJournal(data);
          if (data?.available_grades && data.available_grades.length > 0) {
            setAvailableGrades(data.available_grades);
          }
        } else {
          if (!cached) setJournal(null);
        }
      } catch (err) {
        console.error('[CAHIER JOURNAL FRONTEND] Fetch Exception:', err);
        if (!cached) setJournal(null);
      } finally {
        setIsLoadingJournal(false);
      }
    },
    []
  );

  // Fetch homework with cache support
  const fetchHomework = useCallback(async (dateStr: string) => {
    const cached = homeworkCacheRef.current.get(dateStr);
    if (cached) {
      setHomework(cached);
    }
    try {
      const res = await fetch(`/api/homework/${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        homeworkCacheRef.current.set(dateStr, data);
        setHomework(data);
      }
    } catch {
      if (!cached) setHomework([]);
    }
  }, []);

  // Fetch progressions
  const fetchProgressions = useCallback(async () => {
    try {
      const matinRes = await fetch('/api/progression/matin');
      if (matinRes.ok) setMatinProgression(await matinRes.json());

      const apremRes = await fetch('/api/progression/aprem');
      if (apremRes.ok) setApremProgression(await apremRes.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatusAndSettings();
    fetchProgressions();
  }, [fetchStatusAndSettings, fetchProgressions]);

  useEffect(() => {
    if (currentDate) {
      fetchDailyJournal(currentDate, gradeFilter);
      fetchHomework(currentDate);

      // Background prefetch adjacent dates (-7, -1, +1, +7)
      const adjacentDates = [
        shiftDateString(currentDate, -7),
        shiftDateString(currentDate, -1),
        shiftDateString(currentDate, 1),
        shiftDateString(currentDate, 7),
      ];
      adjacentDates.forEach((d) => {
        const key = `${d}_${gradeFilter}`;
        if (!journalCacheRef.current.has(key)) {
          fetch(`/api/cahier-journal/${d}?grade=${encodeURIComponent(gradeFilter)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data) journalCacheRef.current.set(key, data);
            })
            .catch(() => {});
        }
        if (!homeworkCacheRef.current.has(d)) {
          fetch(`/api/homework/${d}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data) homeworkCacheRef.current.set(d, data);
            })
            .catch(() => {});
        }
      });
    }
  }, [currentDate, gradeFilter, fetchDailyJournal, fetchHomework]);

  useEffect(() => {
    const handleJournalUpdated = () => {
      clearFrontendCache();
      if (currentDate) {
        fetchDailyJournal(currentDate, gradeFilter);
        fetchHomework(currentDate);
      }
    };
    window.addEventListener('journal-updated', handleJournalUpdated);
    window.addEventListener('storage', handleJournalUpdated);
    return () => {
      window.removeEventListener('journal-updated', handleJournalUpdated);
      window.removeEventListener('storage', handleJournalUpdated);
    };
  }, [currentDate, gradeFilter, fetchDailyJournal, fetchHomework, clearFrontendCache]);

  // Seed Database
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await fetch('/api/seed', { method: 'POST' });
      await fetchStatusAndSettings();
      await fetchProgressions();
      await fetchDailyJournal(currentDate, gradeFilter);
      await fetchHomework(currentDate);
    } finally {
      setIsSeeding(false);
    }
  };

  // Toggle activity checkbox
  const handleToggleDone = async (
    idStr: string,
    dbId: number | undefined,
    currentFait: boolean,
    card?: any
  ) => {
    if (isPlanDeTravail) return;

    const nextFait = !currentFait;

    // Optimistic UI update
    setJournal((prev) => {
      if (!prev) return prev;
      const updateList = (list: any[]) =>
        list.map((item) =>
          item.id === idStr ? { ...item, fait: nextFait } : item
        );
      return {
        ...prev,
        matin: updateList(prev.matin),
        aprem: updateList(prev.aprem),
      };
    });

    try {
      const res = await fetch(`/api/activity-done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_str: idStr,
          db_id: dbId,
          fait: nextFait,
          date: currentDate,
          teacher_id: settings.teacher_id || 'JulieCB',
          card: card || (journal?.matin?.find((c) => c.id === idStr) || journal?.aprem?.find((c) => c.id === idStr)),
        }),
      });

      if (res.ok) {
        await fetchDailyJournal(currentDate, gradeFilter);
      } else {
        await fetchDailyJournal(currentDate, gradeFilter);
      }
    } catch {
      await fetchDailyJournal(currentDate, gradeFilter);
    }
  };

  // Delete manual activity
  const handleDeleteManualActivity = async (id: number) => {
    try {
      await api.deleteManualActivity(id);
      await fetchDailyJournal(currentDate, gradeFilter);
    } catch (err: any) {
      console.error('Erreur lors de la suppression de l’activité:', err);
      throw err;
    }
  };

  // Add customized activity
  const handleAddActivity = async (adj: Partial<ManualAdjustment>) => {
    try {
      await api.addManualActivity(adj);
      await fetchDailyJournal(currentDate, gradeFilter);
    } catch (err: any) {
      console.error('Erreur lors de l’enregistrement de l’activité:', err);
      alert(`Erreur d’enregistrement en base de données : ${err.message || String(err)}`);
      throw err;
    }
  };

  // Refresh journal when Todo Notes change in TodoNotesCartouche
  const handleAddTodo = async () => {
    await fetchDailyJournal(currentDate, gradeFilter);
  };

  // Toggle Todo Note completed status
  const handleToggleTodo = async (dbId: number, completed: boolean) => {
    try {
      await fetch(`/api/custom-tasks/${dbId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      await fetchDailyJournal(currentDate, gradeFilter);
    } catch {
      // ignore
    }
  };

  // Delete Todo Note callback to refresh journal
  const handleDeleteTodo = async () => {
    await fetchDailyJournal(currentDate, gradeFilter);
  };

  // Report undone activities to the next working day
  const handleReportUndone = async () => {
    try {
      const uncompletedMatin = journal?.matin?.filter((c) => !c.fait) || [];
      const uncompletedAprem = journal?.aprem?.filter((c) => !c.fait) || [];
      const uncompletedCards = [...uncompletedMatin, ...uncompletedAprem];

      if (uncompletedCards.length === 0) {
        alert('Toutes les activités de la journée sont déjà cochées ou il n’y a aucune activité à reporter.');
        return;
      }

      // Disparition immédiate et fluide des activités non faites du state local
      setJournal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          matin: prev.matin.filter((c) => c.fait),
          aprem: prev.aprem.filter((c) => c.fait),
        };
      });

      const res = await fetch('/api/report-undone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: currentDate,
          grade: gradeFilter,
          teacher_id: settings.teacher_id || 'JulieCB',
          uncompletedCards,
        }),
      });
      if (res.ok) {
        const { count, targetDate } = await res.json();
        alert(
          `${count} activité(s) non cochée(s) reportée(s) au prochain jour travaillé (${targetDate || 'J+1'}) !`
        );
        await fetchDailyJournal(currentDate, gradeFilter);
      } else {
        await fetchDailyJournal(currentDate, gradeFilter);
      }
    } catch (err: any) {
      console.error('Erreur lors du report général:', err);
      await fetchDailyJournal(currentDate, gradeFilter);
    }
  };

  // Toggle Homework checkbox
  const handleToggleHomeworkDone = async (id: number, done: boolean) => {
    if (isPlanDeTravail) return;

    setHomework((prev) =>
      prev.map((h) => (h.id === id ? { ...h, done } : h))
    );

    try {
      await fetch(`/api/homework/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
      await fetchHomework(currentDate);
    } catch {
      await fetchHomework(currentDate);
    }
  };

  // Delete Homework
  const handleDeleteHomework = async (id: number) => {
    try {
      await fetch(`/api/homework/${id}`, { method: 'DELETE' });
      setHomework((prev) => prev.filter((h) => h.id !== id));
      await fetchHomework(currentDate);
    } catch {
      await fetchHomework(currentDate);
    }
  };

  // Add Homework
  const handleAddHomework = async (hw: Partial<HomeworkAdjustment>) => {
    try {
      await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hw),
      });
      await fetchHomework(currentDate);
    } catch {
      // ignore
    }
  };

  // Migrate local storage homework to Postgres Neon
  const handleMigrateFromLocalStorage = async () => {
    try {
      const stored = localStorage.getItem('cahier_journal_homework_backup');
      if (!stored) return;
      const items: Partial<HomeworkAdjustment>[] = JSON.parse(stored);

      for (const item of items) {
        await fetch('/api/homework', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item,
            date_due: currentDate,
            teacher_id: 'JulieCB',
          }),
        });
      }

      localStorage.removeItem('cahier_journal_homework_backup');
      setHasLocalStorageItems(false);
      await fetchHomework(currentDate);
      alert('Devoirs migrés avec succès dans PostgreSQL !');
    } catch {
      alert('Erreur lors de la migration');
    }
  };

  // Save Settings
  const handleSaveSettings = async (updated: Partial<UserSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved);
      } else {
        setSettings((prev) => ({ ...prev, ...updated }));
      }
      await fetchDailyJournal(currentDate, gradeFilter);
    } catch (err) {
      console.error('Erreur sauvegarde paramètres:', err);
    }
  };

  // Add new Progression sequence
  const handleAddProgression = async (item: Partial<ChronologicalProgression>) => {
    try {
      await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      await fetchProgressions();
      await fetchDailyJournal(currentDate, gradeFilter);
    } catch {
      // ignore
    }
  };

  // Helper working days label
  const activeWorkingDays = settings.global_work_days || settings.working_days || [];
  const workingDaysLabel = activeWorkingDays
    .map((num) => {
      const names: Record<number, string> = {
        1: 'L',
        2: 'M',
        3: 'Me',
        4: 'J',
        5: 'V',
        6: 'S',
      };
      return names[num] || '?';
    })
    .join('-');

  const delayMorning = journal?.delay_morning !== undefined
    ? journal.delay_morning
    : (settings.delay_morning !== undefined
      ? settings.delay_morning
      : (settings.absences_count || 0));

  const delayAfternoon = journal?.delay_afternoon !== undefined
    ? journal.delay_afternoon
    : (settings.delay_afternoon !== undefined ? settings.delay_afternoon : 0);

  const activeGradesToUse = settings.active_grades && settings.active_grades.length > 0
    ? settings.active_grades
    : availableGrades;

  const handleIncrementDelayMorning = async () => {
    try {
      await fetch('/api/delay/toggle-banalisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: currentDate, creneau: 'matin', action: 'add', teacher_id: settings.teacher_id || 'JulieCB' }),
      });
    } catch (e) {
      console.warn('Error toggling delay:', e);
    }
    fetchDailyJournal(currentDate, gradeFilter);
  };

  const handleDecrementDelayMorning = async () => {
    try {
      await fetch('/api/delay/toggle-banalisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: currentDate, creneau: 'matin', action: 'remove', teacher_id: settings.teacher_id || 'JulieCB' }),
      });
    } catch (e) {
      console.warn('Error toggling delay:', e);
    }
    fetchDailyJournal(currentDate, gradeFilter);
  };

  const handleIncrementDelayAfternoon = async () => {
    try {
      await fetch('/api/delay/toggle-banalisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: currentDate, creneau: 'aprem', action: 'add', teacher_id: settings.teacher_id || 'JulieCB' }),
      });
    } catch (e) {
      console.warn('Error toggling delay:', e);
    }
    fetchDailyJournal(currentDate, gradeFilter);
  };

  const handleDecrementDelayAfternoon = async () => {
    try {
      await fetch('/api/delay/toggle-banalisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: currentDate, creneau: 'aprem', action: 'remove', teacher_id: settings.teacher_id || 'JulieCB' }),
      });
    } catch (e) {
      console.warn('Error toggling delay:', e);
    }
    fetchDailyJournal(currentDate, gradeFilter);
  };

  // Render Plan de travail mode
  if (isPlanDeTravail) {
    return (
      <PlanDeTravailView
        journal={journal}
        homework={homework}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onReturnTeacher={() => {
          setIsPlanDeTravail(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          window.history.replaceState({}, '', url.toString());
        }}
        onOpenDevoirs={() => {
          setIsPlanDeTravail(false);
          setIsDevoirsMode(true);
          const url = new URL(window.location.href);
          url.searchParams.set('mode', 'devoirs');
          window.history.pushState({}, '', url.toString());
        }}
        teacherName={settings.teacher_id || 'JulieCB'}
        settings={settings}
      />
    );
  }

  // Render Devoirs dedicated page
  if (isDevoirsMode) {
    return (
      <DevoirsView
        homework={homework}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onReturnTeacher={() => {
          setIsDevoirsMode(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          window.history.replaceState({}, '', url.toString());
        }}
        onAddHomework={handleAddHomework}
        onToggleHomeworkDone={handleToggleHomeworkDone}
        onDeleteHomework={handleDeleteHomework}
        teacherName={settings.teacher_id || 'JulieCB'}
        settings={settings}
        isUnlocked={isUnlocked}
        onUnlockSuccess={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="h-screen bg-[#F8FAFC] text-slate-800 flex flex-col overflow-hidden select-none font-sans">
      {/* Barre tout en haut figée / sticky (Titre App + Profil connecté) */}
      <HeaderTopBar
        isWorkingDay={journal?.is_working_day ?? true}
        holidayReason={journal?.holiday_reason}
        teacherName={settings.teacher_id || 'JulieCB'}
        isUnlocked={isUnlocked}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLock={() => setIsUnlocked(false)}
      />

      {/* Zone de contenu défilante (scrollable) */}
      <div className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-y-auto">
        {/* Bloc intermédiaire de contrôle (To-do, dates, filtres & boutons de pilotage) défilant naturellement */}
        <HeaderControlBar
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          gradeFilter={gradeFilter}
          onGradeFilterChange={setGradeFilter}
          availableGrades={activeGradesToUse}
          isWorkingDay={journal?.is_working_day ?? true}
          holidayReason={journal?.holiday_reason}
          isPlanDeTravail={isPlanDeTravail}
          isUnlocked={isUnlocked}
          autoRescheduleEnabled={Boolean(settings.auto_reschedule_enabled)}
          onTogglePlanDeTravail={() => {
            setIsPlanDeTravail(true);
            const url = new URL(window.location.href);
            url.searchParams.set('mode', 'plan-de-travail');
            window.history.pushState({}, '', url.toString());
          }}
          onOpenDevoirs={() => {
            const url = new URL(window.location.origin + window.location.pathname);
            url.searchParams.set('mode', 'devoirs');
            url.searchParams.set('date', currentDate);
            window.open(url.toString(), '_blank');
          }}
          onOpenSettings={async () => {
            await fetchStatusAndSettings();
            setIsSettingsOpen(true);
          }}
          onReportUndone={handleReportUndone}
          evaluationUrl={settings.evaluation_url}
          todos={journal?.todos}
          onAddTodo={handleAddTodo}
          onToggleTodoDone={(dbId, fait) => handleToggleTodo(dbId, fait)}
          onDeleteTodo={() => handleDeleteTodo()}
        />

        {/* Section Cahier Journal principale */}
        <main className="flex-1 flex flex-col gap-3 min-w-0 w-full">
          <CahierJournalSection
            journal={journal}
            isLoading={isLoadingJournal}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            isUnlocked={isUnlocked}
            onToggleDone={handleToggleDone}
            onDeleteManualActivity={handleDeleteManualActivity}
            onOpenNewActivity={(creneau) => {
              setEditingActivity(null);
              setAddActivityModal({ isOpen: true, creneau });
            }}
            onEditCard={(card) => {
              if (card.is_custom) {
                setEditingActivity(card);
                setAddActivityModal({ isOpen: true, creneau: card.creneau || 'matin' });
              }
            }}
            gradeFilter={gradeFilter}
            delayMorning={delayMorning}
            delayAfternoon={delayAfternoon}
            onIncrementDelayMorning={handleIncrementDelayMorning}
            onDecrementDelayMorning={handleDecrementDelayMorning}
            onIncrementDelayAfternoon={handleIncrementDelayAfternoon}
            onDecrementDelayAfternoon={handleDecrementDelayAfternoon}
            showReportNotDone={settings.show_report_not_done}
            onRefreshJournal={() => fetchDailyJournal(currentDate, gradeFilter)}
          />
        </main>

        {/* Rappel des paramètres & statut DB en bas de page */}
        <FooterSettingsBar
          dbStatus={dbStatus}
          workingDaysLabel={workingDaysLabel}
          onOpenProgressionsModal={() => setIsProgressionsOpen(true)}
        />
      </div>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(tid) => {
          setIsUnlocked(true);
          if (tid && tid !== settings.teacher_id) {
            setSettings((prev) => ({ ...prev, teacher_id: tid }));
          }
        }}
        teacherName={settings.teacher_id || 'JulieCB'}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        dbStatus={dbStatus}
        availableGrades={availableGrades}
        onRefreshData={() => {
          fetchDailyJournal(currentDate, gradeFilter);
          fetchProgressions();
        }}
      />

      <ProgressionsModal
        isOpen={isProgressionsOpen}
        onClose={() => setIsProgressionsOpen(false)}
        matin={matinProgression}
        aprem={apremProgression}
        onAddProgression={handleAddProgression}
      />

      <AddActivityModal
        isOpen={addActivityModal.isOpen}
        onClose={() => {
          setAddActivityModal((prev) => ({ ...prev, isOpen: false }));
          setEditingActivity(null);
        }}
        defaultCreneau={addActivityModal.creneau}
        currentDate={currentDate}
        onAddActivity={handleAddActivity}
        availableGrades={activeGradesToUse}
        initialActivity={editingActivity}
      />

      <AddHomeworkModal
        isOpen={isAddHomeworkOpen}
        onClose={() => setIsAddHomeworkOpen(false)}
        currentDate={currentDate}
        onAddHomework={handleAddHomework}
      />
    </div>
  );
}
