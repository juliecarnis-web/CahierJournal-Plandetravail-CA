/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Lock,
  Unlock,
  Copy,
  Check,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Printer,
  Layers,
  KeyRound,
  X,
  AlertCircle,
  Filter,
  GraduationCap,
  Eye,
  EyeOff,
  CalendarDays,
  ArrowRight,
  CopyPlus,
  MoveRight,
  Save,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { HomeworkAdjustment, GradeLevel, UserSettings, CustomHomework } from '../types.js';
import { renderTextWithLinks } from '../utils/linkUtils.js';
import {
  shiftDateString,
  formatDateFrench,
  getPreviousWorkingDay,
  getEffectiveWorkingDaysOfWeek,
} from '../utils/dateUtils.js';
import { AddHomeworkModal } from './AddHomeworkModal.js';
import { AddCustomHomeworkModal } from './AddCustomHomeworkModal.js';
import { getColorLabelObject } from '../lib/colorLabels.js';
import { api } from '../services/api.js';

interface DevoirsViewProps {
  homework: HomeworkAdjustment[];
  currentDate: string;
  onDateChange: (date: string) => void;
  onReturnTeacher?: () => void;
  onAddHomework?: (hw: Partial<HomeworkAdjustment>) => Promise<void>;
  onToggleHomeworkDone?: (id: number, done: boolean) => void;
  onDeleteHomework?: (id: number) => void;
  teacherName?: string;
  settings?: UserSettings | null;
  isUnlocked?: boolean;
  onUnlockSuccess?: () => void;
}

export const DevoirsView: React.FC<DevoirsViewProps> = ({
  homework,
  currentDate,
  onDateChange,
  onReturnTeacher,
  onAddHomework,
  onToggleHomeworkDone,
  onDeleteHomework,
  teacherName,
  settings,
  isUnlocked: propsIsUnlocked = false,
  onUnlockSuccess,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(propsIsUnlocked);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const [copied, setCopied] = useState(false);
  const [fetchedSettings, setFetchedSettings] = useState<UserSettings | null>(null);
  const [isAddHomeworkOpen, setIsAddHomeworkOpen] = useState(false);
  const [isAddCustomHomeworkOpen, setIsAddCustomHomeworkOpen] = useState(false);
  const [editingCustomHomeworkItem, setEditingCustomHomeworkItem] = useState<Partial<CustomHomework> | null>(null);

  // Priority sorting/filtering state ('all', 'mandatory_first', 'optional_first', 'only_mandatory', 'only_optional')
  const [prioritySortFilter, setPrioritySortFilter] = useState<
    'all' | 'mandatory_first' | 'optional_first' | 'only_mandatory' | 'only_optional'
  >('all');

  // View mode state ('day' or 'week')
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [weekHomeworkMap, setWeekHomeworkMap] = useState<{ [dateStr: string]: HomeworkAdjustment[] }>({});

  // Local state for homework items to allow immediate UI edits
  const [localHomework, setLocalHomework] = useState<HomeworkAdjustment[]>(homework);
  const [editingText, setEditingText] = useState<{ [id: number]: string }>({});
  const [editingUrl, setEditingUrl] = useState<{ [id: number]: string }>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  // State for Rescheduling Modal ("Déplacer à" / "Dupliquer à")
  const [rescheduleItem, setRescheduleItem] = useState<HomeworkAdjustment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(currentDate);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync internal unlocked state with prop if changed externally
  useEffect(() => {
    if (propsIsUnlocked) {
      setIsUnlocked(true);
    }
  }, [propsIsUnlocked]);

  // Sync localHomework with incoming homework prop
  useEffect(() => {
    setLocalHomework(homework);
  }, [homework]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch teacher settings for active_grades
  const loadFreshSettings = useCallback(() => {
    const tid = teacherName || settings?.teacher_id || 'JulieCB';
    fetch(`/api/settings?teacher_id=${encodeURIComponent(tid)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setFetchedSettings(data);
        }
      })
      .catch((err) => console.error('Error fetching settings in DevoirsView:', err));
  }, [teacherName, settings?.teacher_id]);

  useEffect(() => {
    loadFreshSettings();
  }, [loadFreshSettings]);

  const activeSettings = fetchedSettings || settings;
  const teacherDisplayName = teacherName || activeSettings?.teacher_id || 'JulieCB';

  // Compute active_grades from settings or fall back to default
  const activeGrades = useMemo(() => {
    if (
      activeSettings?.active_grades &&
      Array.isArray(activeSettings.active_grades) &&
      activeSettings.active_grades.length > 0
    ) {
      return activeSettings.active_grades as GradeLevel[];
    }
    return ['CE2', 'CM2'] as GradeLevel[];
  }, [activeSettings?.active_grades]);

  // Compute effective working days for the week containing currentDate
  const effectiveWorkingDays = useMemo(() => {
    return getEffectiveWorkingDaysOfWeek(
      currentDate,
      activeSettings?.periods,
      activeSettings?.working_days
    );
  }, [currentDate, activeSettings?.periods, activeSettings?.working_days]);

  // Fetch / Refresh homework from DB
  const refreshHomeworkForDate = useCallback(async (dateStr: string) => {
    try {
      const res = await fetch(`/api/homework/${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (dateStr === currentDate) {
          setLocalHomework(data);
        }
        setWeekHomeworkMap((prev) => ({ ...prev, [dateStr]: data }));
        return data;
      }
    } catch (err) {
      console.error(`Error fetching homework for ${dateStr}:`, err);
    }
    return [];
  }, [currentDate]);

  const refreshAllHomework = useCallback(async () => {
    if (viewMode === 'week') {
      const entries = await Promise.all(
        effectiveWorkingDays.map(async (d) => {
          try {
            const res = await fetch(`/api/homework/${d}`);
            if (res.ok) {
              const data = await res.json();
              return [d, data] as [string, HomeworkAdjustment[]];
            }
          } catch {
            // ignore
          }
          return [d, []] as [string, HomeworkAdjustment[]];
        })
      );
      const mapObj: { [d: string]: HomeworkAdjustment[] } = {};
      for (const [d, items] of entries) {
        mapObj[d] = items;
      }
      setWeekHomeworkMap(mapObj);
      if (mapObj[currentDate]) {
        setLocalHomework(mapObj[currentDate]);
      }
    } else {
      await refreshHomeworkForDate(currentDate);
    }
  }, [viewMode, effectiveWorkingDays, currentDate, refreshHomeworkForDate]);

  useEffect(() => {
    refreshAllHomework();
  }, [refreshAllHomework]);

  // State for copying specific grade, day, or single homework item
  const [copiedGrade, setCopiedGrade] = useState<string | null>(null);
  const [copiedHwId, setCopiedHwId] = useState<number | string | null>(null);
  const [copiedDayDate, setCopiedDayDate] = useState<string | null>(null);

  // State for maintenance truncate modal
  const [truncateModalType, setTruncateModalType] = useState<'manual' | 'custom' | null>(null);
  const [isTruncating, setIsTruncating] = useState<boolean>(false);

  const handleConfirmTruncate = async () => {
    if (!truncateModalType) return;
    setIsTruncating(true);
    try {
      if (truncateModalType === 'manual') {
        const res = await api.truncateHomeworkManualAdjustments(teacherDisplayName);
        showToast(res.message || 'Ajustements manuels réinitialisés');
      } else if (truncateModalType === 'custom') {
        const res = await api.truncateCustomHomework(teacherDisplayName);
        showToast(res.message || 'Devoirs personnalisés réinitialisés');
      }
      setTruncateModalType(null);
      await refreshAllHomework();
      await refreshHomeworkForDate(currentDate);
      window.dispatchEvent(new Event('journal-updated'));
    } catch (err: any) {
      console.error('Truncate error:', err);
      showToast('Erreur lors de la réinitialisation');
    } finally {
      setIsTruncating(false);
    }
  };

  // Helper to categorize homework into Leçon (1), Modelage (2), Entraînement (3)
  const getHomeworkCategory = (hw: HomeworkAdjustment): { category: number; catLabel: string } => {
    const text = (
      (hw.subject || '') + ' ' +
      (hw.titre_chapitre || '') + ' ' +
      (hw.description || '') + ' ' +
      (hw.modified_text || '') + ' ' +
      (hw.competence_code || '')
    ).toLowerCase();

    if (text.includes('leçon') || text.includes('lecon') || text.includes('réviser')) {
      return { category: 1, catLabel: 'Leçon' };
    }
    if (text.includes('modelage')) {
      return { category: 2, catLabel: 'Modelage' };
    }
    return { category: 3, catLabel: 'Entraînement' };
  };

  // Helper to determine order weight based on position_rule or category
  const getHomeworkOrderWeight = (hw: HomeworkAdjustment): number => {
    const pos = (hw.position_rule || '').toLowerCase().trim();
    if (pos === 'top' || pos === 'first') return 0;
    if (pos === 'after_lecon') return 15;
    if (pos === 'after_modelage') return 25;
    if (pos === 'after_entrainement') return 35;
    if (pos === 'bottom' || pos === 'last') return 45;

    if (hw.is_custom) return 40;

    // Spiral / default category weights
    const cat = getHomeworkCategory(hw).category;
    if (cat === 1) return 10; // Leçon
    if (cat === 2) return 20; // Modelage
    return 30; // Entraînement
  };

  // Sort homework items respecting position_rule, categories, and priority filter
  const sortHomeworkItems = useCallback((items: HomeworkAdjustment[]): HomeworkAdjustment[] => {
    let filtered = [...items];
    if (prioritySortFilter === 'only_mandatory') {
      filtered = filtered.filter((item) => item.priority_status !== 'facultatif' && !item.is_optional);
    } else if (prioritySortFilter === 'only_optional') {
      filtered = filtered.filter((item) => item.priority_status === 'facultatif' || item.is_optional);
    }

    return filtered.sort((a, b) => {
      if (prioritySortFilter === 'mandatory_first') {
        const isOptA = a.priority_status === 'facultatif' || a.is_optional ? 1 : 0;
        const isOptB = b.priority_status === 'facultatif' || b.is_optional ? 1 : 0;
        if (isOptA !== isOptB) return isOptA - isOptB;
      } else if (prioritySortFilter === 'optional_first') {
        const isOptA = a.priority_status === 'facultatif' || a.is_optional ? 1 : 0;
        const isOptB = b.priority_status === 'facultatif' || b.is_optional ? 1 : 0;
        if (isOptA !== isOptB) return isOptB - isOptA;
      }

      const weightA = getHomeworkOrderWeight(a);
      const weightB = getHomeworkOrderWeight(b);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      if (weightA === 30) {
        const dolA = a.day_of_life ?? 999;
        const dolB = b.day_of_life ?? 999;
        if (dolA !== dolB) {
          return dolA - dolB;
        }
        return (a.competence_code || '').localeCompare(b.competence_code || '');
      }
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }, [prioritySortFilter]);

  // Unified helper for formatting homework text for clipboard
  const formatSingleHomeworkForCopy = (hw: HomeworkAdjustment, overrideDesc?: string): string => {
    const isOptional = hw.priority_status === 'facultatif';
    const statusBadge = isOptional ? '[FACULTATIF]' : '[OBLIGATOIRE]';
    const descToUse = (overrideDesc ?? hw.description ?? hw.modified_text ?? '').trim();

    if (hw.is_custom) {
      // CUSTOM HOMEWORK FORMAT:
      // • [MATIÈRE / SOUS-DOMAINE] (GRADE) [STATUT] 'Titre' : Description (Lien)
      const subjectStr = (hw.subject || 'DEVOIR').trim().toUpperCase();
      const subDomainStr = hw.sub_domain && hw.sub_domain.trim() ? ` / ${hw.sub_domain.trim().toUpperCase()}` : '';
      const categoryTag = `[${subjectStr}${subDomainStr}]`;

      const gradePart = hw.grade && hw.grade !== 'Tous' ? ` (${hw.grade.trim()})` : '';
      const titleText = (hw.title || (hw as any).titre_chapitre || '').trim();
      const titlePart = titleText ? ` '${titleText}'` : '';
      const descPart = descToUse ? (titlePart ? ` : ${descToUse}` : ` ${descToUse}`) : '';
      const urlPart = hw.url && hw.url.trim() ? ` (${hw.url.trim()})` : '';

      return `• ${categoryTag}${gradePart} ${statusBadge}${titlePart}${descPart}${urlPart}`;
    }

    // SPIRAL HOMEWORK FORMAT:
    // • [ÉTAPE] MATIÈRE (COMPÉTENCE) (GRADE) [STATUT] 'Titre Chapitre' : Description (Lien)
    const catInfo = getHomeworkCategory(hw);
    let stepLabel = catInfo.catLabel.toUpperCase();
    if (catInfo.category === 3) {
      const style = getHomeworkStyling(hw);
      if (style.typeLabel) {
        stepLabel = style.typeLabel.toUpperCase();
      }
    }
    const stepTag = `[${stepLabel}]`;

    const subjectStr = hw.subject ? hw.subject.trim() : '';
    const compStr = hw.competence_code
      ? ` (${hw.competence_code.trim()})`
      : (hw.subject !== 'FRANCAIS' && hw.subject !== 'MATHEMATIQUES' && hw.subject ? ` (${hw.subject.trim()})` : '');
    const gradeStr = hw.grade && hw.grade !== 'Tous' ? ` (${hw.grade.trim()})` : '';

    const chapterText = (hw.titre_chapitre || hw.title || '').trim();
    const chapterTitle = chapterText ? ` '${chapterText}'` : '';
    const descPart = descToUse ? ` : ${descToUse}` : '';
    const urlPart = hw.url && hw.url.trim() ? ` (${hw.url.trim()})` : '';

    return `• ${stepTag} ${subjectStr}${compStr}${gradeStr} ${statusBadge}${chapterTitle}${descPart}${urlPart}`;
  };

  // Copy homework text for a specific grade
  const handleCopyGradeHomework = (gradeName: string, items: HomeworkAdjustment[], targetDate?: string) => {
    const dateToUse = targetDate || currentDate;
    const visibleItems = items.filter((item) => !item.is_hidden);
    const sorted = sortHomeworkItems(visibleItems);
    if (sorted.length === 0) {
      navigator.clipboard.writeText(`Devoirs ${gradeName} - ${formatDateFrench(dateToUse)} :\nAucun devoir enregistré.`);
    } else {
      const lines = sorted.map((hw) => formatSingleHomeworkForCopy(hw, editingText[hw.id]));
      const textToCopy = `Devoirs ${gradeName} - ${formatDateFrench(dateToUse)} :\n\n${lines.join('\n\n')}`;
      navigator.clipboard.writeText(textToCopy);
    }
    setCopiedGrade(gradeName);
    setTimeout(() => setCopiedGrade(null), 2500);
  };

  // Copy single individual cartouche
  const handleCopySingleCartouche = (hw: HomeworkAdjustment, targetDate: string) => {
    const lineText = formatSingleHomeworkForCopy(hw, editingText[hw.id]);
    const gradeTag = hw.grade && hw.grade !== 'Tous' ? ` (${hw.grade})` : '';
    const textToCopy = `Devoir ${gradeTag} - ${formatDateFrench(targetDate)} :\n${lineText}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedHwId(hw.id);
    setTimeout(() => setCopiedHwId(null), 2500);
  };

  // Copy all homework items for a specific day in Week View
  const handleCopyDayHomework = (dayDate: string, items: HomeworkAdjustment[]) => {
    const visibleItems = items.filter((item) => !item.is_hidden);
    const sorted = sortHomeworkItems(visibleItems);
    if (sorted.length === 0) {
      navigator.clipboard.writeText(`Devoirs du ${formatDateFrench(dayDate)} :\nAucun devoir enregistré.`);
    } else {
      const lines = sorted.map((hw) => formatSingleHomeworkForCopy(hw, editingText[hw.id]));
      const textToCopy = `Devoirs du ${formatDateFrench(dayDate)} :\n\n${lines.join('\n\n')}`;
      navigator.clipboard.writeText(textToCopy);
    }
    setCopiedDayDate(dayDate);
    setTimeout(() => setCopiedDayDate(null), 2500);
  };

  // Grade filter state (default to 'Tous' if multiple active grades exist, or the single active grade)
  const [selectedGrade, setSelectedGrade] = useState<string>('Tous');

  // Ensure selectedGrade is valid when activeGrades change
  useEffect(() => {
    if (activeGrades.length === 1) {
      setSelectedGrade(activeGrades[0]);
    }
  }, [activeGrades]);

  const handleCopyLink = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'devoirs');
    url.searchParams.set('date', currentDate);
    if (selectedGrade && selectedGrade !== 'Tous') {
      url.searchParams.set('grade', selectedGrade);
    }
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenPlanDeTravailJMinusOne = () => {
    const prevWorkingDay = getPreviousWorkingDay(currentDate);
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'plan-de-travail');
    url.searchParams.set('date', prevWorkingDay);
    window.location.href = url.toString();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Veuillez saisir le mot de passe.');
      return;
    }
    setIsVerifyingPassword(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: passwordInput,
          teacherId: teacherDisplayName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsUnlocked(true);
          setIsLoginModalOpen(false);
          setPasswordInput('');
          if (onUnlockSuccess) onUnlockSuccess();
        } else {
          setPasswordError('Mot de passe incorrect.');
        }
      } else {
        setPasswordError('Mot de passe incorrect.');
      }
    } catch (err) {
      setPasswordError('Erreur lors de la vérification du mot de passe.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const shiftDate = (days: number) => {
    onDateChange(shiftDateString(currentDate, days));
  };

  // ==========================================
  // IN-LINE EDITING HANDLERS
  // ==========================================

  const getCartoucheSourceTaskId = (hw: HomeworkAdjustment): string => {
    if (hw.competence_code) {
      return hw.competence_code;
    }
    return (
      hw.source_task_id ||
      (hw.id > 0 ? `task_${hw.id}` : undefined) ||
      (hw.id < 0 ? `auto_${Math.abs(hw.id)}` : undefined) ||
      `task_${(hw.subject || 'item').toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    );
  };

  const handleTogglePriority = async (hw: HomeworkAdjustment, targetDate?: string) => {
    const newStatus = hw.priority_status === 'facultatif' ? 'prioritaire' : 'facultatif';
    const updatedItem = { ...hw, priority_status: newStatus };
    setLocalHomework((prev) => prev.map((item) => (item.id === hw.id ? updatedItem : item)));
    await handleSaveHomeworkCartouche(updatedItem, targetDate);
  };

  const handleToggleHide = async (hw: HomeworkAdjustment, targetDate?: string) => {
    const newHidden = !hw.is_hidden;
    const updatedItem = { ...hw, is_hidden: newHidden };
    setLocalHomework((prev) => prev.map((item) => (item.id === hw.id ? updatedItem : item)));
    await handleSaveHomeworkCartouche(updatedItem, targetDate);
  };

  const handleSaveDescription = async (hw: HomeworkAdjustment, targetDate?: string) => {
    const textVal = editingText[hw.id];
    if (textVal === undefined || textVal === hw.description) return;
    const updatedItem = { ...hw, description: textVal };
    setLocalHomework((prev) => prev.map((item) => (item.id === hw.id ? updatedItem : item)));
    await handleSaveHomeworkCartouche(updatedItem, targetDate);
  };

  const handleSaveUrl = async (hw: HomeworkAdjustment, targetDate?: string) => {
    const urlVal = editingUrl[hw.id];
    if (urlVal === undefined || urlVal === hw.url) return;
    const updatedItem = { ...hw, url: urlVal, modified_url: urlVal };
    setLocalHomework((prev) => prev.map((item) => (item.id === hw.id ? updatedItem : item)));
    await handleSaveHomeworkCartouche(updatedItem, targetDate);
  };

  const handleSaveHomeworkCartouche = async (hw: HomeworkAdjustment, targetDate?: string) => {
    const d = targetDate || hw.date_echeance || hw.date_due || currentDate;
    setSavingId(hw.id);
    const updatedDesc = editingText[hw.id] !== undefined ? editingText[hw.id] : (hw.description || '');
    const updatedUrl = editingUrl[hw.id] !== undefined ? editingUrl[hw.id] : (hw.modified_url || hw.url || '');

    if (hw.is_custom) {
      try {
        await api.addCustomHomework({
          id: Number(hw.id),
          date_echeance: d,
          date_due: d,
          date_assigned: hw.date_assigned || d,
          grade: hw.grade || 'Tous',
          teacher_id: teacherDisplayName,
          subject: hw.subject || 'Général',
          sub_domain: hw.sub_domain || null,
          target_groups: hw.target_groups || 'Tous',
          title: hw.title || (hw as any).titre_chapitre || hw.subject || 'Devoir',
          description: updatedDesc,
          url: updatedUrl || null,
          exercise_number: hw.exercise_number || null,
          cartridge_color: hw.cartridge_color || 'standard',
          is_optional: hw.priority_status === 'facultatif' || Boolean(hw.is_optional),
          position_rule: hw.position_rule || 'bottom',
          recurrence: hw.recurrence || 'none',
          is_custom: true,
        });
        showToast('Devoir personnalisé enregistré');
        await refreshHomeworkForDate(d);
        await refreshAllHomework();
        window.dispatchEvent(new Event('journal-updated'));
      } catch (err: any) {
        console.error('Error saving custom homework:', err);
        showToast('Erreur lors de l’enregistrement');
      } finally {
        setSavingId(null);
      }
      return;
    }

    const sourceTaskId = getCartoucheSourceTaskId(hw);

    const payload = {
      id: hw.id > 0 ? hw.id : undefined,
      date_echeance: d,
      date_due: d,
      date_assigned: hw.date_assigned || d,
      grade: hw.grade,
      teacher_id: teacherDisplayName,
      source_task_id: sourceTaskId,
      subject: hw.subject || 'Général',
      description: updatedDesc,
      titre_chapitre: hw.titre_chapitre || hw.modified_text || (hw.subject !== 'Général' ? hw.subject : undefined),
      modified_text: hw.titre_chapitre || hw.modified_text,
      url: updatedUrl || undefined,
      modified_url: updatedUrl || undefined,
      is_hidden: Boolean(hw.is_hidden),
      priority_status: hw.priority_status || 'prioritaire',
      difficulty_level: hw.difficulty_level || 'standard',
      competence_code: hw.competence_code,
      done: Boolean(hw.done),
      is_completed: Boolean(hw.done),
      is_deferred: false,
      day_of_life: hw.day_of_life,
    };

    try {
      await api.upsertHomeworkAdjustment(payload);
      showToast('Devoir enregistré en base de données');
      await refreshHomeworkForDate(d);
      await refreshAllHomework();
      window.dispatchEvent(new Event('journal-updated'));
    } catch (err: any) {
      console.error('Error saving homework cartouche:', err);
      showToast('Erreur lors de l’enregistrement');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteHomeworkCartouche = async (hw: HomeworkAdjustment, targetDate?: string) => {
    const d = targetDate || hw.date_echeance || hw.date_due || currentDate;
    const sourceTaskId = getCartoucheSourceTaskId(hw);

    try {
      if (hw.is_custom) {
        await api.deleteCustomHomework(Number(hw.id));
        showToast('Devoir personnalisé supprimé (DELETE SQL)');
      } else {
        await api.deleteHomeworkAdjustment({
          id: hw.id > 0 ? hw.id : undefined,
          date_echeance: d,
          date_due: d,
          grade: hw.grade,
          teacher_id: teacherDisplayName,
          source_task_id: sourceTaskId,
          competence_code: hw.competence_code,
          description: hw.description,
        });
        showToast('Ajustement supprimé — Devoir d’origine rétabli');
      }
      setEditingText((prev) => {
        const next = { ...prev };
        delete next[hw.id];
        return next;
      });
      setEditingUrl((prev) => {
        const next = { ...prev };
        delete next[hw.id];
        return next;
      });
      await refreshAllHomework();
      await refreshHomeworkForDate(d);
      window.dispatchEvent(new Event('journal-updated'));
    } catch (err: any) {
      console.error('Error deleting homework adjustment:', err);
      showToast('Erreur lors de la suppression');
    }
  };

  const handleMoveHomeworkAction = async () => {
    if (!rescheduleItem || !rescheduleDate) return;
    try {
      if (rescheduleItem.is_custom) {
        await api.addCustomHomework({
          ...rescheduleItem,
          id: Number(rescheduleItem.id),
          date_echeance: rescheduleDate,
          date_due: rescheduleDate,
          date_assigned: rescheduleDate,
        });
        showToast(`Devoir personnalisé déplacé au ${formatDateFrench(rescheduleDate)}`);
      } else {
        await api.moveHomework(rescheduleItem, currentDate, rescheduleDate);
        showToast(`Devoir déplacé au ${formatDateFrench(rescheduleDate)}`);
      }
      setRescheduleItem(null);
      await refreshAllHomework();
      await refreshHomeworkForDate(currentDate);
      await refreshHomeworkForDate(rescheduleDate);
      window.dispatchEvent(new Event('journal-updated'));
    } catch (err) {
      console.error('Error moving homework:', err);
      showToast('Erreur lors du déplacement');
    }
  };

  const handleDuplicateHomeworkAction = async () => {
    if (!rescheduleItem || !rescheduleDate) return;
    try {
      if (rescheduleItem.is_custom) {
        await api.addCustomHomework({
          date_echeance: rescheduleDate,
          date_due: rescheduleDate,
          date_assigned: rescheduleDate,
          grade: rescheduleItem.grade || 'Tous',
          subject: rescheduleItem.subject || 'Général',
          sub_domain: rescheduleItem.sub_domain || undefined,
          target_groups: rescheduleItem.target_groups || 'Tous',
          title: rescheduleItem.title || (rescheduleItem as any).titre_chapitre || rescheduleItem.subject || 'Devoir',
          description: editingText[rescheduleItem.id] ?? rescheduleItem.description ?? rescheduleItem.modified_text ?? '',
          url: editingUrl[rescheduleItem.id] ?? rescheduleItem.url ?? rescheduleItem.modified_url ?? undefined,
          exercise_number: rescheduleItem.exercise_number || undefined,
          cartridge_color: rescheduleItem.cartridge_color || 'standard',
          is_optional: rescheduleItem.priority_status === 'facultatif' || Boolean(rescheduleItem.is_optional),
          position_rule: rescheduleItem.position_rule || 'bottom',
          recurrence: 'none',
          teacher_id: teacherDisplayName,
          is_custom: true,
        });
        showToast(`Devoir personnalisé dupliqué au ${formatDateFrench(rescheduleDate)}`);
      } else {
        await api.duplicateHomework(rescheduleItem, rescheduleDate);
        showToast(`Devoir dupliqué au ${formatDateFrench(rescheduleDate)}`);
      }
      setRescheduleItem(null);
      await refreshAllHomework();
      await refreshHomeworkForDate(currentDate);
      await refreshHomeworkForDate(rescheduleDate);
      window.dispatchEvent(new Event('journal-updated'));
    } catch (err) {
      console.error('Error duplicating homework:', err);
      showToast('Erreur lors de la duplication');
    }
  };

  const getHomeworkStyling = (hw: HomeworkAdjustment) => {
    if (hw.is_custom) {
      const colorOpt = getColorLabelObject(hw.cartridge_color);
      if (colorOpt) {
        return {
          isCustom: true,
          typeLabel: hw.subject || 'Devoir',
          badgeBg: '',
          badgeStyle: {
            backgroundColor: colorOpt.hex,
            color: colorOpt.textHex,
            borderColor: colorOpt.borderHex,
          },
          cardBg: '',
          cardStyle: {
            backgroundColor: colorOpt.pastelHex || (colorOpt.hex + '18'),
            borderColor: colorOpt.borderHex,
          },
        };
      }
      return {
        isCustom: true,
        typeLabel: hw.subject || 'Devoir',
        badgeBg: 'bg-indigo-600 text-white border-indigo-700 font-bold',
        badgeStyle: undefined,
        cardBg: 'bg-indigo-50/90 border-indigo-200',
        cardStyle: undefined,
      };
    }

    const catInfo = getHomeworkCategory(hw);

    if (catInfo.category === 1) {
      return {
        isCustom: false,
        typeLabel: 'Leçon',
        badgeBg: 'bg-blue-100 text-blue-900 border-blue-200 font-bold',
        badgeStyle: undefined,
        cardBg: 'bg-blue-50/90 border-blue-200',
        cardStyle: undefined,
      };
    }

    if (catInfo.category === 2) {
      return {
        isCustom: false,
        typeLabel: 'Modelage',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
        badgeStyle: undefined,
        cardBg: 'bg-amber-50/90 border-amber-200',
        cardStyle: undefined,
      };
    }

    // Category 3: Entraînement -> Violet pastel
    const text = (
      (hw.subject || '') + ' ' +
      (hw.description || '') + ' ' +
      (hw.modified_text || '') + ' ' +
      (hw.competence_code || '')
    ).toLowerCase();

    if (text.includes('codage')) {
      return {
        isCustom: false,
        typeLabel: 'ENT • CODAGE (X4)',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
        badgeStyle: undefined,
        cardBg: 'bg-purple-50/90 border-purple-200',
        cardStyle: undefined,
      };
    }
    if (text.includes('mémorisation') || text.includes('memorisation') || text.includes('automatisation')) {
      return {
        isCustom: false,
        typeLabel: 'ENT • MÉMORISATION / AUTOMATISATION (X2)',
        badgeBg: 'bg-purple-200 text-purple-950 border-purple-300 font-bold',
        badgeStyle: undefined,
        cardBg: 'bg-purple-100/90 border-purple-300',
        cardStyle: undefined,
      };
    }
    if (text.includes('remémoration') || text.includes('rememoration')) {
      return {
        isCustom: false,
        typeLabel: 'ENT • REMÉMORATION (X1)',
        badgeBg: 'bg-purple-300 text-purple-950 border-purple-400 font-extrabold',
        badgeStyle: undefined,
        cardBg: 'bg-purple-200/90 border-purple-400',
        cardStyle: undefined,
      };
    }

    return {
      isCustom: false,
      typeLabel: 'ENT • ENTRAÎNEMENT',
      badgeBg: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
      badgeStyle: undefined,
      cardBg: 'bg-purple-50/90 border-purple-200',
      cardStyle: undefined,
    };
  };

  const renderCartouche = (hw: HomeworkAdjustment, targetDate: string) => {
    const style = getHomeworkStyling(hw);
    const catInfo = getHomeworkCategory(hw);
    const compCodeDisplay = !hw.is_custom ? (
      hw.competence_code ||
      (hw.subject !== 'FRANCAIS' &&
      hw.subject !== 'MATHEMATIQUES' &&
      hw.subject !== 'ENTRAINEMENT'
        ? hw.subject
        : null)
    ) : null;
    const isHidden = Boolean(hw.is_hidden);
    const isOptional = hw.priority_status === 'facultatif';
    const cardTitle = hw.title || (hw as any).titre_chapitre;

    return (
      <div
        key={`${targetDate}_${hw.id}`}
        className={`${
          isHidden && isUnlocked
            ? 'bg-slate-100/90 border-slate-300 border-dashed opacity-60'
            : style.cardBg
        } border-2 rounded-2xl p-4 md:p-5 shadow-2xs space-y-3 transition-all relative ${
          hw.done && !isUnlocked ? 'opacity-60 grayscale-[0.2]' : ''
        }`}
        style={!isHidden && style.cardStyle ? style.cardStyle : undefined}
      >
        {/* Badges, Priority, Hidden, Copy & Resource row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category / Subject Badge */}
            <span
              className={`text-xs md:text-sm uppercase font-black px-2.5 py-1 rounded-lg border tracking-tight shrink-0 ${style.badgeBg}`}
              style={style.badgeStyle}
            >
              {hw.is_custom ? (hw.subject || 'Devoir') : catInfo.catLabel}
            </span>

            {/* Competence Code */}
            {compCodeDisplay && (
              <span className="text-xs md:text-sm font-mono font-extrabold bg-indigo-100/90 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-lg tracking-tight">
                {compCodeDisplay}
              </span>
            )}

            {/* Priority Status Badge */}
            {isOptional ? (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2.5 py-1 rounded-lg tracking-tight uppercase">
                Facultatif
              </span>
            ) : (
              <span className="bg-emerald-50/80 text-emerald-800 border border-emerald-300 text-xs font-black px-2.5 py-1 rounded-lg tracking-tight uppercase">
                Obligatoire
              </span>
            )}

            {/* Titre Chapitre for non-custom items */}
            {!hw.is_custom && (hw.titre_chapitre || hw.modified_text) && (
              <span className="inline-flex items-center gap-1.5 bg-slate-100/90 text-slate-800 border border-slate-300 text-xs md:text-sm font-bold px-2.5 py-1 rounded-lg tracking-tight shrink-0 max-w-xs md:max-w-md truncate" title={hw.titre_chapitre || hw.modified_text}>
                <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 text-[10px] font-black uppercase px-1.5 py-0.5 rounded shrink-0">
                  Titre
                </span>
                <span className="truncate">{hw.titre_chapitre || hw.modified_text}</span>
              </span>
            )}

            {/* Hidden Badge in Edit Mode */}
            {isHidden && isUnlocked && (
              <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Masqué</span>
              </span>
            )}

            {/* Sub Domain Badge */}
            {hw.sub_domain && (
              <span className="text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg tracking-tight">
                {hw.sub_domain}
              </span>
            )}

            {/* Exercise Number Badge */}
            {hw.exercise_number && (
              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-lg tracking-tight">
                {hw.exercise_number}
              </span>
            )}

            {/* Target Groups Badge */}
            {hw.target_groups && hw.target_groups !== 'Tous' && (
              <span className="text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300 px-2 py-1 rounded-lg tracking-tight">
                Groupe: {hw.target_groups}
              </span>
            )}

            {/* Custom Homework Badge */}
            {hw.is_custom && (
              <span className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded-md tracking-wider">
                Custom
              </span>
            )}

            {hw.difficulty_level && hw.difficulty_level !== 'standard' && (
              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold px-2 py-0.5 rounded uppercase">
                DIFFÉRENCIÉ ({hw.difficulty_level})
              </span>
            )}
          </div>

          {/* Quick Copy Button & Resource link */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleCopySingleCartouche(hw, targetDate)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                copiedHwId === hw.id
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="Copier rapidement le texte et la ressource de ce devoir"
            >
              {copiedHwId === hw.id ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{copiedHwId === hw.id ? 'Copié !' : 'Copier'}</span>
            </button>

            {!isUnlocked && hw.url && (
              <a
                href={hw.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                title="Accéder à la ressource associée"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ressource</span>
              </a>
            )}
          </div>
        </div>

        {/* Prominent Title for Custom / Chapter Homeworks */}
        {cardTitle && (
          <div className="pt-1">
            <h4 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
              {cardTitle}
            </h4>
          </div>
        )}

        {/* Homework Description & URL (In-line Edit when unlocked, Read-only otherwise) */}
        {isUnlocked ? (
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Saisie / Modifications de l'enseignant (zone texte) :
              </label>
              <textarea
                value={editingText[hw.id] ?? hw.description}
                onChange={(e) =>
                  setEditingText((prev) => ({ ...prev, [hw.id]: e.target.value }))
                }
                onBlur={() => handleSaveDescription(hw, targetDate)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-normal text-xs md:text-sm text-slate-800 leading-normal whitespace-pre-line focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                rows={2}
                placeholder="Ajoutez vos consignes, exercices ou précisions..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Ressource URL associée :
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={editingUrl[hw.id] ?? (hw.url || '')}
                  onChange={(e) =>
                    setEditingUrl((prev) => ({ ...prev, [hw.id]: e.target.value }))
                  }
                  onBlur={() => handleSaveUrl(hw, targetDate)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {hw.url && (
                  <a
                    href={hw.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors shrink-0"
                    title="Tester le lien"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Read-only Description with line break preservation */
          hw.description ? (
            <p className="text-xs md:text-sm font-normal text-slate-800 leading-normal break-words whitespace-pre-line">
              {renderTextWithLinks(hw.description)}
            </p>
          ) : !hw.titre_chapitre && !hw.modified_text ? (
            <p className="text-xs text-slate-400 italic">Aucune consigne spécifique.</p>
          ) : null
        )}

        {/* Footer Controls for Teacher (when unlocked) */}
        {isUnlocked && (
          <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-end text-xs md:text-sm gap-1.5">
            {/* Priority Toggle */}
            <button
              type="button"
              onClick={() => handleTogglePriority(hw, targetDate)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isOptional
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              }`}
              title="Basculer la priorité entre Obligatoire et Facultatif"
            >
              {isOptional ? 'Rendre Obligatoire' : 'Rendre Facultatif'}
            </button>

            {/* Masquer / Démasquer Toggle */}
            <button
              type="button"
              onClick={() => handleToggleHide(hw, targetDate)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                isHidden
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
              title={isHidden ? 'Rendre visible aux élèves' : 'Masquer ce devoir aux élèves'}
            >
              {isHidden ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Démasquer</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Masquer</span>
                </>
              )}
            </button>

            {/* Reprogrammer / Déplacer / Dupliquer Button */}
            <button
              type="button"
              onClick={() => {
                setRescheduleItem(hw);
                setRescheduleDate(targetDate);
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Déplacer ou dupliquer à une autre date"
            >
              <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
              <span>Reprogrammer</span>
            </button>

            {/* Pencil / Edit Button */}
            <button
              type="button"
              onClick={() => {
                setEditingCustomHomeworkItem(hw);
                setIsAddCustomHomeworkOpen(true);
              }}
              className="p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl border border-indigo-200 hover:border-indigo-300 transition-colors cursor-pointer shrink-0"
              title="Éditer les détails du devoir (Modale complète custom_homework)"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Corbeille / Delete Button */}
            <button
              type="button"
              onClick={() => handleDeleteHomeworkCartouche(hw, targetDate)}
              className="p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl border border-rose-200 hover:border-rose-300 transition-colors cursor-pointer shrink-0"
              title="Supprimer ce devoir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold border border-slate-700 animate-bounce flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner - White Background matching Cahier Journal & Plan de travail */}
      <header className="bg-white text-slate-900 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between border-b border-slate-200 shrink-0 gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-xl text-indigo-600 shadow-2xs">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Devoirs - {teacherDisplayName}
            </h1>
            <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Page dédiée aux élèves et aux familles
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Button 'Plan de travail' */}
          <button
            onClick={handleOpenPlanDeTravailJMinusOne}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-xl border border-indigo-200 text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Consulter le Plan de Travail de la classe du jour précédent (J-1)"
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Plan de travail</span>
          </button>

          {/* Button 'Copier le lien' */}
          <button
            onClick={handleCopyLink}
            className={`px-3.5 py-2 font-bold rounded-xl text-xs flex items-center gap-2 transition-all border shadow-2xs cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Copier l'URL directe de cette page de devoirs pour la partager aux familles"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-indigo-600" />}
            <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
          </button>

          {/* Button 'Imprimer' */}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            title="Imprimer le cahier de devoirs du jour"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer</span>
          </button>

          {/* Teacher Unlock/Lock & Navigation Buttons */}
          {isUnlocked ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Session Enseignant : <strong>{teacherDisplayName}</strong></span>
              </div>

              {onReturnTeacher && (
                <button
                  onClick={onReturnTeacher}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  title="Retourner au Cahier Journal Enseignant"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cahier Journal</span>
                </button>
              )}

              <button
                onClick={() => {
                  setEditingCustomHomeworkItem(null);
                  setIsAddCustomHomeworkOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
                title="Créer un nouveau devoir personnalisé (Enregistré dans la table SQL custom_homework)"
              >
                <Plus className="w-4 h-4" />
                <span>Devoir personnalisé</span>
              </button>

              {/* Maintenance Tools (Fin d'année) */}
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTruncateModalType('manual')}
                  className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                  title="Outil de maintenance : Purger la table homework_manual_adjustments"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Purger ajustements</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTruncateModalType('custom')}
                  className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                  title="Outil de maintenance : Purger la table custom_homework"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Purger devoirs perso</span>
                </button>
              </div>

              <button
                onClick={() => setIsUnlocked(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                title="Verrouiller le mode enseignant"
              >
                <Unlock className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPasswordError('');
                setPasswordInput('');
                setIsLoginModalOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
              title="Connexion sécurisée Enseignant"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-none px-4 md:px-8 py-6 space-y-6">
        {/* Large Date Header Banner with Navigation Arrows & View Switcher */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => shiftDate(-7)}
              className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Semaine précédente (-7 jours)"
            >
              <ChevronsLeft className="w-4 h-4 text-indigo-600" />
              <span className="hidden lg:inline">-1 Sem.</span>
            </button>
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="flex-1 md:flex-none px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Jour précédent (-1 jour)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Jour préc.</span>
            </button>
          </div>

          <div className="text-center flex flex-col items-center mx-auto">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full mb-1 border border-indigo-100">
              Devoirs {viewMode === 'week' ? '— Vue Hebdomadaire' : ''}
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 capitalize tracking-tight">
                {viewMode === 'week'
                  ? `Semaine du ${formatDateFrench(effectiveWorkingDays[0])} au ${formatDateFrench(
                      effectiveWorkingDays[effectiveWorkingDays.length - 1]
                    )}`
                  : formatDateFrench(currentDate)}
              </h2>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    shiftDate(Number(e.target.value));
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                title="Saut de plusieurs semaines"
              >
                <option value="" disabled>Saut de semaines...</option>
                <option value="-42">- 6 Semaines</option>
                <option value="-35">- 5 Semaines</option>
                <option value="-28">- 4 Semaines</option>
                <option value="-21">- 3 Semaines</option>
                <option value="-14">- 2 Semaines</option>
                <option value="-7">- 1 Semaine</option>
                <option value="7">+ 1 Semaine</option>
                <option value="14">+ 2 Semaines</option>
                <option value="21">+ 3 Semaines</option>
                <option value="28">+ 4 Semaines</option>
                <option value="35">+ 5 Semaines</option>
                <option value="42">+ 6 Semaines</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'day'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Afficher les devoirs du jour sélectionné"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Vue Jour</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'week'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Afficher les devoirs de toute la semaine côte à côte"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Vue Semaine</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="flex-1 md:flex-none px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Jour suivant (+1 jour)"
            >
              <span>Jour suiv.</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftDate(7)}
              className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Semaine suivante (+7 jours)"
            >
              <span className="hidden lg:inline">+1 Sem.</span>
              <ChevronsRight className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        </div>

        {/* Grade & Priority Filter Selector Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>Niveau :</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {activeGrades.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedGrade('Tous')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedGrade === 'Tous'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tous ({activeGrades.join(', ')})
                </button>
              )}

              {activeGrades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedGrade === g
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Sort & Filter Selector */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Tri / Affichage :</span>
            <select
              value={prioritySortFilter}
              onChange={(e) => setPrioritySortFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Tous (Ordre standard)</option>
              <option value="mandatory_first">Obligatoires d'abord</option>
              <option value="optional_first">Optionnels d'abord</option>
              <option value="only_mandatory">Obligatoires seulement</option>
              <option value="only_optional">Optionnels seulement</option>
            </select>
          </div>
        </div>

        {/* Main Content Layout (Day View vs Week View) */}
        {viewMode === 'week' ? (
          /* WEEK VIEW: Side-by-side columns for effective working days */
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(
              effectiveWorkingDays.length,
              4
            )} xl:grid-cols-${effectiveWorkingDays.length} gap-5 w-full items-start`}
          >
            {effectiveWorkingDays.map((dayDate) => {
              const dayHomework = weekHomeworkMap[dayDate] || [];
              const rawGradeItems = dayHomework.filter(
                (hw) => selectedGrade === 'Tous' || hw.grade === selectedGrade || hw.grade === 'Tous'
              );
              const visibleItems = isUnlocked
                ? rawGradeItems
                : rawGradeItems.filter((hw) => !hw.is_hidden);
              const sortedItems = sortHomeworkItems(visibleItems);
              const isToday = dayDate === currentDate;

              return (
                <div
                  key={dayDate}
                  className={`bg-white border-2 ${
                    isToday ? 'border-indigo-400 ring-2 ring-indigo-200/50' : 'border-slate-200'
                  } rounded-2xl shadow-sm flex flex-col overflow-hidden w-full min-h-[350px]`}
                >
                  {/* Day Column Header */}
                  <div
                    className={`${
                      isToday ? 'bg-indigo-900' : 'bg-slate-800'
                    } text-white px-4 py-3 flex items-center justify-between border-b border-slate-700 shrink-0`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold capitalize text-white">
                          {formatDateFrench(dayDate)}
                        </h3>
                        {isToday && (
                          <span className="text-[10px] bg-indigo-500 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                        {sortedItems.length} devoir{sortedItems.length > 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyDayHomework(dayDate, sortedItems)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                          copiedDayDate === dayDate
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                        }`}
                        title={`Copier tous les devoirs pour le ${formatDateFrench(dayDate)}`}
                      >
                        {copiedDayDate === dayDate ? (
                          <Check className="w-3 h-3 text-white" />
                        ) : (
                          <Copy className="w-3 h-3 text-indigo-300" />
                        )}
                        <span>{copiedDayDate === dayDate ? 'Copié !' : 'Copier'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(dayDate);
                          setViewMode('day');
                        }}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-slate-600 shrink-0"
                        title="Basculer vers la vue détaillée de cette journée"
                      >
                        Vue Jour
                      </button>
                    </div>
                  </div>

                  {/* Day Cartouches List */}
                  <div className="p-3.5 flex-1 space-y-3 bg-slate-50/50">
                    {sortedItems.length === 0 ? (
                      <div className="p-6 text-center bg-white border border-dashed border-slate-200 rounded-xl space-y-1">
                        <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-500">
                          Aucun devoir à cette date
                        </p>
                      </div>
                    ) : (
                      sortedItems.map((hw) => renderCartouche(hw, dayDate))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DAY VIEW: Responsive Grade Cartouches Grid */
          <div
            className={`grid grid-cols-1 ${
              (selectedGrade === 'Tous' ? activeGrades.length : 1) === 2
                ? 'md:grid-cols-2'
                : (selectedGrade === 'Tous' ? activeGrades.length : 1) >= 3
                ? 'md:grid-cols-2 lg:grid-cols-3'
                : 'w-full'
            } gap-6 w-full`}
          >
            {(selectedGrade === 'Tous' ? activeGrades : [selectedGrade as GradeLevel]).map((gradeName) => {
              const rawGradeItems = localHomework.filter(
                (hw) => hw.grade === gradeName || hw.grade === 'Tous'
              );

              // Filter out hidden items in Read-Only mode
              const visibleGradeItems = isUnlocked
                ? rawGradeItems
                : rawGradeItems.filter((hw) => !hw.is_hidden);

              const sortedItems = sortHomeworkItems(visibleGradeItems);
              const isCopied = copiedGrade === gradeName;

              return (
                <div
                  key={gradeName}
                  className="bg-white border-2 border-slate-200/90 rounded-2xl shadow-sm flex flex-col overflow-hidden w-full"
                >
                  {/* Grade Cartouche Header with Copy Button */}
                  <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-indigo-500/20 text-indigo-300 p-2 rounded-xl border border-indigo-400/30">
                        <GraduationCap className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                          <span>Devoirs {gradeName}</span>
                          <span className="text-xs md:text-sm bg-indigo-950 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-800/60 font-bold">
                            {sortedItems.length}
                          </span>
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyGradeHomework(gradeName, sortedItems)}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer border shadow-2xs ${
                        isCopied
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title={`Copier l'ensemble des devoirs pour le niveau ${gradeName}`}
                    >
                      {isCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                      <span>{isCopied ? 'Copié !' : 'Copier'}</span>
                    </button>
                  </div>

                  {/* Grade Cartouche Content */}
                  <div className="p-4 md:p-6 flex-1 space-y-4 bg-slate-50/50">
                    {sortedItems.length === 0 ? (
                      <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-xl space-y-2">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-600">
                          Aucun devoir enregistré pour le niveau {gradeName} à cette date.
                        </p>
                      </div>
                    ) : (
                      sortedItems.map((hw) => renderCartouche(hw, currentDate))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Reschedule Modal ("Déplacer à" / "Dupliquer à") */}
      {rescheduleItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-700">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Reprogrammer le devoir</h3>
                  <p className="text-xs text-slate-500">{rescheduleItem.grade} • {rescheduleItem.subject}</p>
                </div>
              </div>
              <button
                onClick={() => setRescheduleItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-medium">
              <p className="font-bold text-slate-900 mb-1">Aperçu du devoir :</p>
              <p className="italic whitespace-pre-line break-words">{rescheduleItem.description}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Choisir la nouvelle date d'échéance :
              </label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRescheduleItem(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleMoveHomeworkAction}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MoveRight className="w-4 h-4" />
                <span>Déplacer à cette date</span>
              </button>
              <button
                type="button"
                onClick={handleDuplicateHomeworkAction}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CopyPlus className="w-4 h-4 text-indigo-400" />
                <span>Dupliquer à cette date</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Password Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Accès Enseignant</h3>
                  <p className="text-xs text-slate-500">Connexion pour {teacherDisplayName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setPasswordError('');
                  setPasswordInput('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Saisissez votre mot de passe enseignant :
                </label>
                <input
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
                {passwordError && (
                  <p className="text-xs font-bold text-rose-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginModalOpen(false);
                    setPasswordError('');
                    setPasswordInput('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingPassword ? (
                    <span>Vérification...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Déverrouiller</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Homework (Classic) */}
      <AddHomeworkModal
        isOpen={isAddHomeworkOpen}
        onClose={() => setIsAddHomeworkOpen(false)}
        currentDate={currentDate}
        onAddHomework={async (hw) => {
          if (onAddHomework) {
            await onAddHomework(hw);
          } else {
            await fetch('/api/homework', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(hw),
            });
          }
        }}
      />

      {/* Modal Add Custom Homework (Full custom_homework table mapping) */}
      <AddCustomHomeworkModal
        isOpen={isAddCustomHomeworkOpen}
        onClose={() => {
          setIsAddCustomHomeworkOpen(false);
          setEditingCustomHomeworkItem(null);
        }}
        currentDate={currentDate}
        activeGrades={activeGrades}
        initialData={editingCustomHomeworkItem}
        onSuccess={async () => {
          await refreshAllHomework();
          await refreshHomeworkForDate(currentDate);
          showToast(editingCustomHomeworkItem ? 'Devoir personnalisé modifié' : 'Devoir personnalisé enregistré');
        }}
      />

      {/* Truncate Confirmation Modal */}
      {truncateModalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {truncateModalType === 'manual'
                    ? 'Purger les ajustements manuels'
                    : 'Purger les devoirs personnalisés'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Outil de maintenance (Fin d’année)
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 font-semibold leading-relaxed">
              {truncateModalType === 'manual'
                ? 'Êtes-vous sûr de vouloir supprimer tous les ajustements manuels ?'
                : 'Êtes-vous sûr de vouloir supprimer tous les devoirs personnalisés ?'}
              <p className="mt-2 text-[11px] text-rose-700 font-normal">
                Cette opération enverra une requête TRUNCATE vers la base de données ({truncateModalType === 'manual' ? 'homework_manual_adjustments' : 'custom_homework'}).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isTruncating}
                onClick={() => setTruncateModalType(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isTruncating}
                onClick={handleConfirmTruncate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTruncating ? (
                  <span>Suppression...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmer la suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200 mt-auto">
        Cahier de Devoirs - {teacherDisplayName} © Planificateur Scolaire
      </footer>
    </div>
  );
};
