/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  UserSettings,
  PeriodConfig,
  VacationRange,
  DatabaseStatus,
  GradeLevel,
} from '../types.js';
import {
  X,
  Save,
  Calendar,
  Clock,
  AlertTriangle,
  Upload,
  Trash2,
  Plus,
  Check,
  Globe,
  Filter,
  Layers,
  FileSpreadsheet,
  Info,
  RefreshCw,
  CheckSquare,
} from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (updated: Partial<UserSettings>) => Promise<void>;
  dbStatus?: DatabaseStatus;
  availableGrades?: string[];
  onRefreshData?: () => void;
}

const ALL_GRADES: GradeLevel[] = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Lundi' },
  { id: 2, label: 'Mardi' },
  { id: 3, label: 'Mercredi' },
  { id: 4, label: 'Jeudi' },
  { id: 5, label: 'Vendredi' },
  { id: 6, label: 'Samedi' },
];

const DEFAULT_PERIODS: PeriodConfig[] = [
  { id: 1, name: 'Période 1', startDate: '2026-09-01', endDate: '2026-10-16', working_days: [1, 2, 4, 5] },
  { id: 2, name: 'Période 2', startDate: '2026-11-02', endDate: '2026-12-18', working_days: [1, 2, 4, 5] },
  { id: 3, name: 'Période 3', startDate: '2027-01-04', endDate: '2027-02-12', working_days: [1, 2, 4, 5] },
  { id: 4, name: 'Période 4', startDate: '2027-03-01', endDate: '2027-04-09', working_days: [1, 2, 4, 5] },
  { id: 5, name: 'Période 5', startDate: '2027-04-26', endDate: '2027-07-02', working_days: [1, 2, 4, 5] },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  dbStatus,
  availableGrades = [],
  onRefreshData,
}) => {
  // 1. Date de début de l'année scolaire
  const [schoolYearStart, setSchoolYearStart] = useState<string>('2026-09-01');

  // 2. Les 5 périodes travaillées
  const [periods, setPeriods] = useState<PeriodConfig[]>(DEFAULT_PERIODS);

  // 3. Périodes de congés (Vacances)
  const [vacationRanges, setVacationRanges] = useState<VacationRange[]>([]);
  const [newVacName, setNewVacName] = useState<string>('');
  const [newVacStart, setNewVacStart] = useState<string>('');
  const [newVacEnd, setNewVacEnd] = useState<string>('');

  // 4. Import CSV pour progressions
  const [csvCreneau, setCsvCreneau] = useState<'matin' | 'aprem'>('matin');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsedRows, setCsvParsedRows] = useState<any[]>([]);
  const [csvImportMessage, setCsvImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // 5. Outil de suivi des évaluations (aucun fallback par défaut)
  const [evaluationUrl, setEvaluationUrl] = useState<string>('');

  // 6. Sélecteur de grades actifs
  const [activeGrades, setActiveGrades] = useState<GradeLevel[]>(['CE1', 'CE2', 'CM1', 'CM2']);

  // 7. Zone Danger (Truncate par grade)
  const [dangerGradeFilter, setDangerGradeFilter] = useState<string>('Tous');
  const [dangerActionState, setDangerActionState] = useState<{ loading: boolean; message: string | null; error: boolean }>({
    loading: false,
    message: null,
    error: false,
  });

  const selectableDangerGrades = React.useMemo(() => {
    const merged = new Set<string>(ALL_GRADES);
    const sources = [
      ...(Array.isArray(availableGrades) ? availableGrades : []),
      ...(Array.isArray(settings?.active_grades) ? settings.active_grades : []),
      ...(Array.isArray(settings?.default_grades) ? settings.default_grades : []),
      ...(Array.isArray(activeGrades) ? activeGrades : []),
    ];

    sources.forEach((g) => {
      if (g && typeof g === 'string' && g !== 'Tous') {
        merged.add(g);
      }
    });

    return Array.from(merged);
  }, [availableGrades, settings?.active_grades, settings?.default_grades, activeGrades]);

  // 8. Auto Reschedule
  const [autoRescheduleEnabled, setAutoRescheduleEnabled] = useState<boolean>(false);

  // 9. Compteurs de retard (Matin / Après-midi)
  const [delayMorning, setDelayMorning] = useState<number>(0);
  const [delayAfternoon, setDelayAfternoon] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<'cal' | 'vac' | 'grades' | 'eval' | 'csv' | 'danger'>('cal');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Initialisation lors de l'ouverture de la modale
  useEffect(() => {
    if (isOpen && settings) {
      // 1. Start date
      setSchoolYearStart(settings.school_year_start || '2026-09-01');

      // 2. Periods
      if (settings.periods && settings.periods.length > 0) {
        // Ensure 5 periods
        const existing = [...settings.periods];
        while (existing.length < 5) {
          const id = existing.length + 1;
          existing.push({
            id,
            name: `Période ${id}`,
            startDate: '2026-09-01',
            endDate: '2026-10-31',
            working_days: [1, 2, 4, 5],
          });
        }
        setPeriods(existing.slice(0, 5));
      } else {
        setPeriods(DEFAULT_PERIODS);
      }

      // 3. Holidays / Vacations
      const rawHolidays = settings.holidays || settings.holydays || settings.vacations || [];
      const parsedRanges: VacationRange[] = [];
      rawHolidays.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null && 'startDate' in item && 'endDate' in item) {
          parsedRanges.push({
            id: item.id || idx + 1,
            name: item.name || `Congé ${idx + 1}`,
            startDate: item.startDate,
            endDate: item.endDate,
          });
        } else if (typeof item === 'string') {
          parsedRanges.push({
            id: idx + 1,
            name: `Jour férié / Congé ${idx + 1}`,
            startDate: item,
            endDate: item,
          });
        }
      });
      setVacationRanges(parsedRanges);

      // 5. Evaluation URL (Strictly no forced default)
      setEvaluationUrl(settings.evaluation_url || '');

      // 6. Active Grades
      if (settings.active_grades && settings.active_grades.length > 0) {
        setActiveGrades(settings.active_grades);
      } else if (settings.default_grades && settings.default_grades.length > 0) {
        setActiveGrades(settings.default_grades);
      } else {
        setActiveGrades(['CE1', 'CE2', 'CM1', 'CM2']);
      }

      // 7. Auto Reschedule
      setAutoRescheduleEnabled(Boolean(settings.auto_reschedule_enabled));

      // 8. Compteurs de retard (Matin / Après-midi)
      setDelayMorning(Number(settings.delay_morning || 0));
      setDelayAfternoon(Number(settings.delay_afternoon || 0));

      setCsvFile(null);
      setCsvParsedRows([]);
      setCsvImportMessage(null);
      setDangerActionState({ loading: false, message: null, error: false });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  // --- Handlers Périodes ---
  const handlePeriodDateChange = (id: number, field: 'startDate' | 'endDate', value: string) => {
    setPeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleToggleWorkingDay = (periodId: number, dayId: number) => {
    setPeriods((prev) =>
      prev.map((p) => {
        if (p.id !== periodId) return p;
        const days = p.working_days || [];
        const exists = days.includes(dayId);
        const nextDays = exists ? days.filter((d) => d !== dayId) : [...days, dayId].sort();
        return { ...p, working_days: nextDays };
      })
    );
  };

  // --- Handlers Vacances ---
  const handleAddVacation = () => {
    if (!newVacStart || !newVacEnd) return;
    const nameToUse = newVacName.trim() || `Congés (${newVacStart} au ${newVacEnd})`;
    const newEntry: VacationRange = {
      id: Date.now(),
      name: nameToUse,
      startDate: newVacStart,
      endDate: newVacEnd,
    };
    setVacationRanges((prev) => [...prev, newEntry]);
    setNewVacName('');
    setNewVacStart('');
    setNewVacEnd('');
  };

  const handleDeleteVacation = (id: string | number) => {
    setVacationRanges((prev) => prev.filter((v) => v.id !== id));
  };

  // --- Handlers Active Grades ---
  const handleToggleGrade = (grade: GradeLevel) => {
    setActiveGrades((prev) => {
      if (prev.includes(grade)) {
        if (prev.length === 1) return prev; // Au moins un grade actif
        return prev.filter((g) => g !== grade);
      }
      return [...prev, grade];
    });
  };

  // --- Handlers CSV Import ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvImportMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setCsvParsedRows([]);
        return;
      }

      const rows: any[] = [];
      // Détection du séparateur (virgule ou point-virgule)
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';

      let startIndex = 0;
      const firstParts = firstLine.split(separator).map((s) => s.trim().replace(/^"|"$/g, ''));
      const isHeader = isNaN(Number(firstParts[0]));

      if (isHeader) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(separator).map((s) => s.trim().replace(/^"|"$/g, ''));

        if (parts.length >= 3) {
          const ordre_sequence = parseInt(parts[0], 10) || 1;
          const competence_code = parts[1] || 'COMP';
          const grade = parts[2] || 'Tous';
          const titre_chapitre = parts[3] || parts[1] || 'Séquence';
          const url = parts[4] || '';
          const intitule = parts[5] || titre_chapitre;
          const prefixe = parts[6] || 'PROG';
          const domaine = parts[7] || 'Général';

          rows.push({
            ordre_sequence,
            competence_code,
            grade,
            titre_chapitre,
            url,
            intitule,
            prefixe,
            domaine,
            teacher_id: settings.teacher_id || 'JulieCB',
            creneau: csvCreneau,
          });
        }
      }
      setCsvParsedRows(rows);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportCsv = async () => {
    if (csvParsedRows.length === 0) {
      setCsvImportMessage({ type: 'error', text: 'Aucune ligne valide à importer.' });
      return;
    }

    setIsImporting(true);
    setCsvImportMessage(null);

    try {
      const response = await fetch('/api/progressions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creneau: csvCreneau,
          rows: csvParsedRows,
          clearExisting: false, // Importation cumulative obligatoire
          teacher_id: settings.teacher_id || 'JulieCB',
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erreur lors de l’importation CSV');
      }

      const resData = await response.json();
      setCsvImportMessage({
        type: 'success',
        text: `Succès : ${resData.importedCount || csvParsedRows.length} séquences ajoutées de manière cumulative (${csvCreneau.toUpperCase()}).`,
      });
      setCsvFile(null);
      setCsvParsedRows([]);
      onRefreshData?.();
    } catch (err: any) {
      setCsvImportMessage({
        type: 'error',
        text: err.message || 'Erreur lors de l’importation du fichier CSV.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  // --- Handlers Zone Danger (Truncate) ---
  const handleTruncateAction = async (
    target: 'matin' | 'aprem' | 'manual' | 'custom' | 'homework_manual' | 'custom_homework',
    label: string
  ) => {
    const confirmMessage = `Êtes-vous sûr de vouloir purger définitivement ${label} pour le filtre grade : [${dangerGradeFilter}] ?\n\nCette action est irréversible !`;
    if (!window.confirm(confirmMessage)) return;

    setDangerActionState({ loading: true, message: `Purge de ${label} en cours...`, error: false });

    try {
      let endpoint = '';
      let bodyData: any = { teacher_id: settings.teacher_id || 'JulieCB', grade: dangerGradeFilter };

      if (target === 'matin') {
        endpoint = '/api/progressions/purge';
        bodyData.creneau = 'matin';
      } else if (target === 'aprem') {
        endpoint = '/api/progressions/purge';
        bodyData.creneau = 'aprem';
      } else if (target === 'manual') {
        endpoint = '/api/manual-adjustments/truncate';
      } else if (target === 'custom') {
        endpoint = '/api/custom-activities/truncate';
      } else if (target === 'homework_manual') {
        endpoint = '/api/homework-manual-adjustments/truncate';
      } else if (target === 'custom_homework') {
        endpoint = '/api/custom-homework/truncate';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de l’action de purge.');
      }

      const resData = await res.json();
      setDangerActionState({
        loading: false,
        message: resData.message || `Purge de ${label} effectuée avec succès.`,
        error: false,
      });

      onRefreshData?.();
    } catch (err: any) {
      setDangerActionState({
        loading: false,
        message: err.message || 'Erreur lors de la purge.',
        error: true,
      });
    }
  };

  // --- Enregistrement Global des Paramètres ---
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveNotification(null);

    // Construction du tableau d'accumulation des jours de travail globaux
    const flatDays: number[] = periods.flatMap((p) => p.working_days || [1, 2, 4, 5]);
    const uniqueDaysSet = new Set<number>(flatDays);
    const allWorkingDays: number[] = Array.from(uniqueDaysSet).sort((a: number, b: number) => a - b);

    const updatedSettings: Partial<UserSettings> = {
      teacher_id: settings.teacher_id || 'JulieCB',
      school_year_start: schoolYearStart,
      periods,
      holidays: vacationRanges,
      evaluation_url: evaluationUrl, // Strictement la saisie utilisateur
      active_grades: activeGrades,
      working_days: allWorkingDays,
      auto_reschedule_enabled: autoRescheduleEnabled,
      delay_morning: delayMorning,
      delay_afternoon: delayAfternoon,
    };

    try {
      await onSaveSettings(updatedSettings);
      setSaveNotification('Paramètres enregistrés avec succès !');
      setTimeout(() => {
        setSaveNotification(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      setSaveNotification(`Erreur d'enregistrement: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* Header Modal */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Paramètres & Jours Utiles</h2>
              <p className="text-xs text-slate-400">Configuration complète de l'année scolaire, des vacances et des progressions</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {dbStatus && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                  dbStatus.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {dbStatus.connected ? 'Base Neon Active' : 'Mode Simulation'}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Navigation Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('cal')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'cal'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            1. Début Année & 5 Périodes
          </button>

          <button
            onClick={() => setActiveTab('vac')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'vac'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            2. Vacances & Congés
          </button>

          <button
            onClick={() => setActiveTab('grades')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'grades'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            3. Grades Actifs
          </button>

          <button
            onClick={() => setActiveTab('eval')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'eval'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-4 h-4" />
            4. Suivi Évaluations
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'csv'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            5. Import CSV
          </button>

          <button
            onClick={() => setActiveTab('danger')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'danger'
                ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm'
                : 'text-red-500 hover:bg-red-50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            6. Zone Danger
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
          
          {/* TAB 1: CALENDRIER & 5 PÉRIODES */}
          {activeTab === 'cal' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* 1. Date de début de l'année scolaire */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <label className="text-sm font-bold text-slate-800">
                    1. Date de début de l'année scolaire (school_year_start)
                  </label>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <input
                    type="date"
                    value={schoolYearStart}
                    onChange={(e) => setSchoolYearStart(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm font-medium text-slate-800"
                  />
                  <span className="text-xs text-slate-500 font-medium">Format : YYYY-MM-DD</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Définit le point de départ officiel (Jour #1) pour le calcul de l'index des jours utiles travaillés tout au long de l'année scolaire. Les dates antérieures à ce point de départ sont ignorées.
                  </span>
                </div>
              </div>

              {/* 2. Les 5 Périodes travaillées */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">2. Les 5 Périodes travaillées de l'année</h3>
                      <p className="text-xs text-slate-500">Dates de début/fin et jours effectifs de classe par période</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {periods.map((period, index) => (
                    <div key={period.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                          {period.name || `Période ${index + 1}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Date de début</label>
                          <input
                            type="date"
                            value={period.startDate}
                            onChange={(e) => handlePeriodDateChange(period.id, 'startDate', e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Date de fin</label>
                          <input
                            type="date"
                            value={period.endDate}
                            onChange={(e) => handlePeriodDateChange(period.id, 'endDate', e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                          Jours effectifs travaillés (Jours utiles) :
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          {DAYS_OF_WEEK.map((day) => {
                            const isChecked = (period.working_days || []).includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => handleToggleWorkingDay(period.id, day.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                  isChecked
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5" />}
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Les 5 périodes définissent les plages calendaires actives. Seuls les jours de la semaine cochés compris dans les intervalles [Date début, Date fin] de chaque période sont inclus dans le calcul des jours utiles. Les week-ends (samedi/dimanche) sont ignorés par défaut.
                  </span>
                </div>
              </div>

              {/* 3. Report automatique des activités non faites */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <label htmlFor="auto_reschedule_checkbox" className="text-sm font-bold text-slate-800 cursor-pointer block">
                        3. Reporter automatiquement des activités non faites (auto_reschedule_enabled)
                      </label>
                      <p className="text-xs text-slate-500">
                        Repousse automatiquement toutes les tâches non faites/non cochées au jour utile suivant
                      </p>
                    </div>
                  </div>
                  <input
                    id="auto_reschedule_checkbox"
                    type="checkbox"
                    checked={autoRescheduleEnabled}
                    onChange={(e) => setAutoRescheduleEnabled(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Comportement :</strong> Si cette case est cochée, toute activité non terminée en fin de journée est reportée au prochain jour travaillé. Les reports spiralaires sont enregistrés dans <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">manual_adjustments</code> et les activités custom dans <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">custom_activities</code>. Ce report ponctuel n'affecte pas le calcul mathématique global du jour utile (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">usefulDay</code>).
                  </span>
                </div>
              </div>

              {/* 4. Compteurs de retard (Retard Matin & Après-midi) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      4. Compteurs de retard (Retard Matin & Après-midi)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Décale le calcul global du jour utile (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">usefulDay</code>) de la progression spiralaire
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Retard Matin */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Retard Matin</span>
                      <span className="text-[11px] text-slate-500">Demi-journées du matin neutralisées</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDelayMorning((prev) => Math.max(0, prev - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-sm cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={delayMorning}
                        onChange={(e) => setDelayMorning(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-14 text-center px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setDelayMorning((prev) => prev + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-sm cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Retard Après-midi */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Retard Après-midi</span>
                      <span className="text-[11px] text-slate-500">Demi-journées de l'après-midi neutralisées</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDelayAfternoon((prev) => Math.max(0, prev - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-sm cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={delayAfternoon}
                        onChange={(e) => setDelayAfternoon(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-14 text-center px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setDelayAfternoon((prev) => prev + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-sm cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-800 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Effet du retard :</strong> Ajouter du retard décale directement l'incrémentation des compétences prévues dans les tables de progression du matin et de l'après-midi. À n'utiliser qu'en cas d'événement exceptionnel (ex: sortie scolaire, grève, absence).
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VACANCES & CONGÉS */}
          {activeTab === 'vac' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">3. Périodes de congés (Vacances & Jours Fériés)</h3>
                    <p className="text-xs text-slate-500">Configuration liée à la colonne <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">holidays</code></p>
                  </div>
                </div>

                {/* Formulaire d'ajout rapide */}
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 space-y-3">
                  <span className="text-xs font-bold text-amber-900 block">Ajouter une nouvelle période de vacances :</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nom (ex: Vacances de Toussaint)"
                      value={newVacName}
                      onChange={(e) => setNewVacName(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="date"
                      value={newVacStart}
                      onChange={(e) => setNewVacStart(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="date"
                      value={newVacEnd}
                      onChange={(e) => setNewVacEnd(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVacation}
                    disabled={!newVacStart || !newVacEnd}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter ce congé
                  </button>
                </div>

                {/* Liste des vacances configurées */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-600 block">Périodes enregistrées ({vacationRanges.length}) :</span>
                  {vacationRanges.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Aucune période de vacances configurée pour le moment.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {vacationRanges.map((v) => (
                        <div key={v.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800">{v.name}</span>
                            <span className="block text-slate-500">
                              Du <strong>{v.startDate}</strong> au <strong>{v.endDate}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteVacation(v.id!)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Les dates comprises dans ces vacances sont totalement exclues du calcul des jours utiles. Les cours et séances spiralaires sont automatiquement suspendus durant ces périodes.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GRADES ACTIFS */}
          {activeTab === 'grades' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">6. Sélecteur de grades actifs (active_grades)</h3>
                    <p className="text-xs text-slate-500">Sélectionnez les niveaux de classe suivis cette année</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  {ALL_GRADES.map((grade) => {
                    const isSelected = activeGrades.includes(grade);
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => handleToggleGrade(grade)}
                        className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm font-bold'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-sm">{grade}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Filtre les compétences et séquences chronologiques dans le cahier journal et les plannings selon les niveaux actifs cochés.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SUIVI DES ÉVALUATIONS */}
          {activeTab === 'eval' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">5. Outil de suivi des évaluations (evaluation_url)</h3>
                    <p className="text-xs text-slate-500">Lien vers votre plateforme externe de saisie des évaluations</p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    URL d'évaluation :
                  </label>
                  <input
                    type="url"
                    value={evaluationUrl}
                    onChange={(e) => setEvaluationUrl(e.target.value)}
                    placeholder="Saisissez l'URL (ex: https://educonnect.education.gouv.fr)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">Strictement aucune valeur par défaut forcée. Renseignez l'adresse complète avec HTTP ou HTTPS.</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Cet outil n'affecte pas directement le calcul des jours utiles. Il s'agit d'un raccourci direct permettant d'accéder à votre livret d'évaluations externe.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: IMPORT CSV */}
          {activeTab === 'csv' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">4. Import CSV pour les progressions chronologiques</h3>
                    <p className="text-xs text-slate-500">Chargement des séquences de manière cumulative</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Créneau cible :
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCsvCreneau('matin')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                          csvCreneau === 'matin'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        Compétences Matin
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsvCreneau('aprem')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                          csvCreneau === 'aprem'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        Compétences Après-midi
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fichier CSV :
                    </label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                    />
                  </div>
                </div>

                {csvParsedRows.length > 0 && (
                  <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-900">
                        {csvParsedRows.length} lignes valides détectées
                      </span>
                      <span className="text-purple-700 font-mono">
                        Créneau : {csvCreneau.toUpperCase()}
                      </span>
                    </div>

                    <div className="max-h-36 overflow-y-auto border border-purple-200 rounded-lg bg-white text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-purple-100/50 sticky top-0 text-purple-900">
                          <tr>
                            <th className="p-1.5 border-b">Ordre</th>
                            <th className="p-1.5 border-b">Code</th>
                            <th className="p-1.5 border-b">Grade</th>
                            <th className="p-1.5 border-b">Titre Chapitre</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {csvParsedRows.slice(0, 5).map((r, i) => (
                            <tr key={i}>
                              <td className="p-1.5 font-mono">{r.ordre_sequence}</td>
                              <td className="p-1.5 font-bold text-indigo-600">{r.competence_code}</td>
                              <td className="p-1.5">{r.grade}</td>
                              <td className="p-1.5 truncate max-w-[200px]">{r.titre_chapitre}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={handleImportCsv}
                      disabled={isImporting}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Importer ces {csvParsedRows.length} séquences (Mode Cumulatif)
                    </button>
                  </div>
                )}

                {csvImportMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      csvImportMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {csvImportMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {csvImportMessage.text}
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Les fichiers CSV importés ici s'inscrivent de manière cumulative dans les tables de progressions chronologiques. Les données existantes sont préservées. Seule une action de réinitialisation explicitement exécutée dans la Zone Danger permet de vider ces tables.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ZONE DANGER */}
          {activeTab === 'danger' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-red-50/50 p-5 rounded-2xl border border-red-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-red-200/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-red-900">7. Zone Danger (Actions de réinitialisation)</h3>
                      <p className="text-xs text-red-600">Actions de type Truncate / Purge définitive des tables</p>
                    </div>
                  </div>

                  {/* Filtre dynamique par grade */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-red-200">
                    <Filter className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-bold text-slate-700">Filtre Grade :</span>
                    <select
                      value={dangerGradeFilter}
                      onChange={(e) => setDangerGradeFilter(e.target.value)}
                      className="text-xs font-bold text-red-600 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="Tous">Tous les grades (Purge complète)</option>
                      {selectableDangerGrades.map((g) => (
                        <option key={g} value={g}>
                          Uniquement {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {dangerActionState.message && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      dangerActionState.error
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {dangerActionState.error ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <Check className="w-4 h-4 text-emerald-600" />}
                    {dangerActionState.message}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Purge Matin */}
                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2 shadow-xs">
                    <span className="text-xs font-bold text-slate-800 block">
                      Compétences Matin
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Cible : <code className="font-mono text-indigo-600">chronological_progression_matin</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTruncateAction('matin', 'Compétences Matin')}
                      disabled={dangerActionState.loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purger Matin [{dangerGradeFilter}]
                    </button>
                  </div>

                  {/* Purge Après-midi */}
                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2 shadow-xs">
                    <span className="text-xs font-bold text-slate-800 block">
                      Compétences Après-midi
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Cible : <code className="font-mono text-indigo-600">chronological_progression_aprem</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTruncateAction('aprem', 'Compétences Après-midi')}
                      disabled={dangerActionState.loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purger Après-midi [{dangerGradeFilter}]
                    </button>
                  </div>

                  {/* Purge Manual Adjustments */}
                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2 shadow-xs">
                    <span className="text-xs font-bold text-slate-800 block">
                      Ajustements manuels spiralaires
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Cible : <code className="font-mono text-indigo-600">manual_adjustments</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTruncateAction('manual', 'Ajustements Manuels')}
                      disabled={dangerActionState.loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purger Ajustements [{dangerGradeFilter}]
                    </button>
                  </div>

                  {/* Purge Custom Activities */}
                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2 shadow-xs">
                    <span className="text-xs font-bold text-slate-800 block">
                      Activités personnalisées
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Cible : <code className="font-mono text-indigo-600">custom_activities</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTruncateAction('custom', 'Activités Personnalisées')}
                      disabled={dangerActionState.loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purger Activités Perso [{dangerGradeFilter}]
                    </button>
                  </div>

                  {/* Purge Devoirs Ajustements */}
                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2 shadow-xs">
                    <span className="text-xs font-bold text-slate-800 block">
                      Ajustements devoirs
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Cible : <code className="font-mono text-indigo-600">homework_manual_adjustments</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTruncateAction('homework_manual', 'Ajustements Devoirs')}
                      disabled={dangerActionState.loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purger Devoirs Spiralaires [{dangerGradeFilter}]
                    </button>
                  </div>

                  {/* Purge Custom Homework */}
                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2 shadow-xs">
                    <span className="text-xs font-bold text-slate-800 block">
                      Devoirs personnalisés
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Cible : <code className="font-mono text-indigo-600">custom_homework</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTruncateAction('custom_homework', 'Devoirs Personnalisés')}
                      disabled={dangerActionState.loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purger Devoirs Perso [{dangerGradeFilter}]
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-red-100/60 rounded-xl text-xs text-red-900 flex items-start gap-2 border border-red-200">
                  <Info className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rôle sur le calcul des jours utiles :</strong> Les actions de réinitialisation suppriment définitivement les progressions ou ajustements. Réexécutez un import CSV ou saisissez de nouveaux ajustements pour recalculer les séquences spiralaires.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with Save Actions */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800">
          <div className="flex items-center gap-2">
            {saveNotification && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {saveNotification}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer les paramètres
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
