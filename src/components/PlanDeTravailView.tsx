/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Lock,
  Sun,
  Moon,
  AlertCircle,
  Filter,
  X,
  KeyRound,
  Tag,
  GraduationCap,
  CheckCircle2,
  Target,
  Users,
  Sparkles,
} from 'lucide-react';
import { DailyCahierJournal, HomeworkAdjustment, UserSettings, ActivityCardItem, isActivityEnRetard } from '../types.js';
import { renderTextWithLinks } from '../utils/linkUtils.js';
import { DifferentiationCard } from './DifferentiationCard.js';
import { shiftDateString, formatDateFrench } from '../utils/dateUtils.js';
import { getColorLabelStyle, getColorLabelObject, ALL_COLOR_LABELS } from '../lib/colorLabels.js';
import { getTopLevelDisplayItems, DisplayItem } from '../utils/cahierJournalUtils.js';

interface PlanDeTravailViewProps {
  journal: DailyCahierJournal | null;
  homework?: HomeworkAdjustment[];
  currentDate: string;
  onDateChange?: (date: string) => void;
  onReturnTeacher?: () => void;
  onOpenDevoirs?: () => void;
  teacherName?: string;
  settings?: UserSettings | null;
}

export const PlanDeTravailView: React.FC<PlanDeTravailViewProps> = ({
  journal,
  homework,
  currentDate,
  onDateChange,
  onReturnTeacher,
  onOpenDevoirs,
  teacherName,
  settings,
}) => {
  const [copied, setCopied] = useState(false);
  const [fetchedSettings, setFetchedSettings] = useState<UserSettings | null>(null);
  const [fetchedJournal, setFetchedJournal] = useState<DailyCahierJournal | null>(null);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({});

  // Password Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Sync hidden card IDs and custom column orders from localStorage
  const loadLocalVisibilityAndOrders = useCallback(() => {
    const dateToUse = currentDate || journal?.date;
    if (!dateToUse) return;
    try {
      const storedHidden = localStorage.getItem(`hidden_cards_${dateToUse}`);
      if (storedHidden) {
        setHiddenCardIds(new Set(JSON.parse(storedHidden)));
      } else {
        setHiddenCardIds(new Set());
      }
      const storedOrders = localStorage.getItem(`column_orders_${dateToUse}`);
      if (storedOrders) {
        setColumnOrders(JSON.parse(storedOrders));
      } else {
        setColumnOrders({});
      }
    } catch (e) {
      setHiddenCardIds(new Set());
      setColumnOrders({});
    }
  }, [currentDate, journal?.date]);

  // Fresh fetch settings on mount and on window focus/visibilitychange
  const loadFreshSettings = useCallback(() => {
    const tid = teacherName || settings?.teacher_id || 'JulieCB';
    fetch(`/api/settings?teacher_id=${encodeURIComponent(tid)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active_grades) {
          setFetchedSettings(data);
        }
      })
      .catch((err) => console.error('Error fetching settings in PlanDeTravailView:', err));
  }, [teacherName, settings?.teacher_id]);

  const loadFreshJournal = useCallback(() => {
    const dateToFetch = currentDate || journal?.date;
    if (!dateToFetch) return;
    fetch(`/api/cahier-journal/${dateToFetch}?grade=Tous`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.cards) {
          setFetchedJournal(data);
        }
      })
      .catch((err) => console.error('Error fetching journal in PlanDeTravailView:', err));
  }, [currentDate, journal?.date]);

  useEffect(() => {
    loadLocalVisibilityAndOrders();

    const handleUpdate = () => {
      loadLocalVisibilityAndOrders();
    };

    window.addEventListener('focus', handleUpdate);
    document.addEventListener('visibilitychange', handleUpdate);
    window.addEventListener('journal-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('focus', handleUpdate);
      document.removeEventListener('visibilitychange', handleUpdate);
      window.removeEventListener('journal-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadLocalVisibilityAndOrders]);

  // Sync fetchedSettings when settings prop changes
  useEffect(() => {
    if (settings) {
      setFetchedSettings(settings);
    }
  }, [settings]);

  const activeSettings = settings || fetchedSettings;
  const activeJournal = journal || fetchedJournal;
  const teacherDisplayName = teacherName || activeSettings?.teacher_id || 'JulieCB';

  const allActiveGrades = useMemo(() => {
    if (
      activeSettings?.active_grades &&
      Array.isArray(activeSettings.active_grades) &&
      activeSettings.active_grades.length > 0
    ) {
      return activeSettings.active_grades;
    }
    if (
      journal?.active_grades &&
      Array.isArray(journal.active_grades) &&
      journal.active_grades.length > 0
    ) {
      return journal.active_grades;
    }
    if (
      journal?.available_grades &&
      Array.isArray(journal.available_grades) &&
      journal.available_grades.length > 0
    ) {
      return journal.available_grades;
    }
    return ['CE2', 'CM2'];
  }, [activeSettings?.active_grades, journal?.active_grades, journal?.available_grades]);

  // Grade selection checkboxes state
  const [checkedGrades, setCheckedGrades] = useState<string[]>(allActiveGrades);

  // Automatically purge any grade from checkedGrades that is no longer in allActiveGrades
  useEffect(() => {
    setCheckedGrades((prevChecked) => {
      const valid = prevChecked.filter((cg) =>
        allActiveGrades.some((ag) => ag.trim().toUpperCase() === cg.trim().toUpperCase())
      );
      if (valid.length === 0) {
        return allActiveGrades;
      }
      return valid;
    });
  }, [allActiveGrades]);

  const validCheckedGrades = useMemo(() => {
    return checkedGrades.filter((cg) =>
      allActiveGrades.some((ag) => ag.trim().toUpperCase() === cg.trim().toUpperCase())
    );
  }, [checkedGrades, allActiveGrades]);

  const gradesToDisplay = useMemo(() => {
    if (validCheckedGrades.length > 0) return validCheckedGrades;
    if (allActiveGrades.length > 0) return allActiveGrades;
    return ['Classe'];
  }, [validCheckedGrades, allActiveGrades]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenDevoirs = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'devoirs');
    url.searchParams.set('date', currentDate);
    window.open(url.toString(), '_blank');
  };

  const handleDateShift = (offset: number) => {
    const newDate = shiftDateString(currentDate, offset);
    if (onDateChange) {
      onDateChange(newDate);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('date', newDate);
      window.history.pushState({}, '', url.toString());
      window.location.reload();
    }
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
          setIsLoginModalOpen(false);
          setPasswordInput('');
          if (onReturnTeacher) {
            onReturnTeacher();
          } else {
            const url = new URL(window.location.href);
            url.searchParams.delete('mode');
            window.location.href = url.toString();
          }
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

  const getDisplayItemsForGradeAndCreneau = (
    cards: ActivityCardItem[],
    grade: string,
    creneau: 'matin' | 'aprem'
  ): DisplayItem[] => {
    if (!cards || cards.length === 0) return [];

    let filtered = cards;
    if (grade !== 'Classe') {
      const normGrade = grade.trim().toUpperCase();
      filtered = cards.filter((card) => {
        if (!card.grade || card.grade === 'Tous') return true;
        return card.grade.trim().toUpperCase() === normGrade;
      });
    }

    // Filter active cards: exclude hidden cards and done/fait cards
    const activeCards = filtered.filter((c) => !c.fait && !hiddenCardIds.has(c.id));

    const normGradeStr = grade === 'Classe' ? 'TOUS' : grade.trim().toUpperCase();
    const colKey = `${creneau}-${normGradeStr}`;
    const customOrder = columnOrders[colKey];

    return getTopLevelDisplayItems(activeCards, customOrder);
  };

  const getCardBadgeInfo = (card: ActivityCardItem) => {
    if (card.is_custom) {
      return {
        label: card.type_activite || 'Activité',
        badgeBg: 'bg-slate-200 text-slate-800 border-slate-300 font-bold',
        cardBg: 'bg-slate-50 border-slate-200 text-slate-900',
      };
    }
    switch (card.type_activite) {
      case 'Leçon':
        return {
          label: 'Leçon',
          badgeBg: 'bg-blue-100 text-blue-900 border-blue-200 font-bold',
          cardBg: 'bg-blue-50/90 border-blue-200 text-slate-900',
        };
      case 'Modelage':
        return {
          label: 'Modelage',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
          cardBg: 'bg-amber-50/90 border-amber-200 text-slate-900',
        };
      case 'Tâche complexe':
        return {
          label: 'TC',
          badgeBg: 'bg-rose-100 text-rose-900 border-rose-200 font-bold',
          cardBg: 'bg-rose-50/90 border-rose-200 text-slate-900',
        };
      case 'Entraînement': {
        const entNum = card.entrainement_num || 1;
        const group =
          card.entrainement_group ||
          (card.entrainement_num
            ? card.entrainement_num <= 4
              ? 'Codage (x4)'
              : card.entrainement_num <= 8
              ? 'Mémorisation / Automatisation (x2)'
              : 'Remémoration (x1)'
            : 'Codage (x4)');

        let categoryLabel = 'CODAGE (X4)';
        if (group.includes('Mémorisation') || group.includes('Automatisation')) {
          categoryLabel = 'AUTOMATISATION (X2)';
        } else if (group.includes('Remémoration')) {
          categoryLabel = 'REMÉMORATION (X1)';
        }

        const entLabel = `ENT ${entNum}`;

        return {
          label: `${entLabel} • ${categoryLabel}`,
          entLabel,
          categoryLabel,
          badgeBg: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
          cardBg: 'bg-purple-50/90 border-purple-200 text-slate-900',
        };
      }
      case 'Évaluation': {
        const evNum = card.ev_number || 1;
        return {
          label: `EV${evNum}`,
          badgeBg: 'bg-orange-100 text-orange-950 border-orange-200 font-extrabold',
          cardBg: 'bg-orange-50/90 border-orange-200 text-slate-900',
        };
      }
      case 'Révision':
        return {
          label: 'Révision',
          badgeBg: 'bg-slate-700 text-white border-slate-600 font-bold',
          cardBg: 'bg-slate-100 border-slate-300 text-slate-900',
        };
      default:
        return {
          label: card.type_activite || 'Activité',
          badgeBg: 'bg-slate-200 text-slate-800 border-slate-300 font-bold',
          cardBg: 'bg-slate-50 border-slate-200 text-slate-900',
        };
    }
  };

  const renderReadOnlyCard = (card: ActivityCardItem, idx?: number) => {
    const badgeInfo = getCardBadgeInfo(card);
    const displayTitle = card.titre_chapitre || card.titre;

    const numExo = card.numero_exercice;
    const colorLabel = card.color_label;
    const colorOpt = getColorLabelObject(colorLabel);

    const colorStyle = colorOpt
      ? {
          backgroundColor: colorOpt.hex,
          color: colorOpt.textHex,
          borderColor: colorOpt.borderHex,
        }
      : getColorLabelStyle(colorLabel);

    const isDone = card.fait;

    // Apply custom pastel color from DB if defined (custom_activities or manual_adjustments)
    const customBgStyle = (card.is_custom && colorOpt)
      ? { backgroundColor: card.pastel_color || colorOpt.pastelHex || colorOpt.hex, borderColor: colorOpt.borderHex }
      : card.pastel_color
      ? { backgroundColor: card.pastel_color, borderColor: 'rgba(0,0,0,0.18)' }
      : undefined;

    const surtitreText = card.is_custom
      ? ((card.competence_code && card.competence_code !== 'PERSO' && card.competence_code !== 'AUTRE')
          ? `${card.competence_code}${card.grade && card.grade !== 'Tous' ? ` (${card.grade})` : ''}`
          : (card.grade && card.grade !== 'Tous' ? card.grade : ''))
      : `${card.competence_code || 'COMP'}${card.grade && card.grade !== 'Tous' ? ` (${card.grade})` : ''}`;

    return (
      <div
        key={idx !== undefined ? `${card.id}-${idx}` : card.id}
        style={customBgStyle}
        className={`${
          card.pastel_color
            ? 'border text-slate-900 shadow-2xs'
            : `${badgeInfo.cardBg} border shadow-xs`
        } rounded-xl p-3.5 flex flex-col gap-2 transition-all relative ${
          isDone ? 'opacity-65 grayscale-[0.2]' : ''
        }`}
      >
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Done Badge */}
            {isDone && (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-tight shrink-0 bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 shadow-2xs">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Fait</span>
              </span>
            )}

            {/* Type Badges */}
            {badgeInfo.entLabel && badgeInfo.categoryLabel ? (
              <>
                <span
                  className="text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 bg-purple-700 text-white border-purple-800 shadow-2xs"
                  title={`Ordre de l'entraînement : ${badgeInfo.entLabel}`}
                >
                  {badgeInfo.entLabel}
                </span>
                <span
                  className="text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 bg-purple-100 text-purple-900 border-purple-200"
                  title={`Catégorie : ${badgeInfo.categoryLabel}`}
                >
                  {badgeInfo.categoryLabel}
                </span>
              </>
            ) : (
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded-md border tracking-tight shrink-0 font-extrabold ${badgeInfo.badgeBg}`}
              >
                {badgeInfo.label}
              </span>
            )}

            {/* Position Anchor Badge */}
            {card.position_anchor && (
              <span
                className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                title={`Position ancrée : ${card.position_anchor}`}
              >
                📌 {card.position_anchor === 'top' ? 'Tout en haut' : card.position_anchor === 'bottom' ? 'Tout en bas' : card.position_anchor.replace('after_', 'Après ').replace('_', ' ')}
              </span>
            )}

            {/* En Retard / Postponed Badge */}
            {isActivityEnRetard(card, journal?.date) && (
              <span
                className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-tight shrink-0 bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1 shadow-2xs"
                title={`Reporté du ${card.original_date || 'jour précédent'}`}
              >
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>En retard</span>
              </span>
            )}

            {/* Competence code & Grade */}
            {surtitreText && (
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter truncate">
                {surtitreText}
              </span>
            )}
          </div>

          {/* External Resource URL */}
          {card.url && (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-white/90 hover:bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs transition-all shrink-0 cursor-pointer"
            >
              <span>Ressource</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Dynamic Badge for Exercice & Color Label */}
        {(numExo || (colorLabel && !ALL_COLOR_LABELS.some((c) => c.name.toLowerCase() === colorLabel.toLowerCase()))) && (
          <div
            style={
              colorStyle || {
                backgroundColor: '#e0e7ff',
                color: '#1e1b4b',
                borderColor: '#c7d2fe',
              }
            }
            className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1.5 w-fit border shadow-2xs my-0.5"
          >
            <Tag className="w-3 h-3 shrink-0" />
            <span>
              {numExo
                ? numExo.trim().toLowerCase().startsWith('ex')
                  ? numExo.trim()
                  : `Ex : ${numExo.trim()}`
                : colorLabel}
            </span>
          </div>
        )}

        <h4 className="font-bold text-base text-slate-900 leading-snug whitespace-pre-wrap">
          {renderTextWithLinks(displayTitle)}
        </h4>

        {card.description && !card.description.startsWith('Séquence #') && (
          <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-wrap">
            {renderTextWithLinks(card.description)}
          </p>
        )}

        {/* Differentiation Callout for Évaluation & Entraînement */}
        <DifferentiationCard
          typeActivite={card.type_activite}
          differentiationEval={card.differentiation_eval}
          differentiationEnt={card.differentiation_ent}
        />

        {card.day_of_life !== undefined && card.day_of_life > 0 && (
          <div className="flex justify-end mt-0.5">
            <span className="text-[10px] font-medium text-slate-400">
              J de vie #{card.day_of_life}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCardsList = (items: DisplayItem[]) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="space-y-3">
        {items.map((item) => {
          if (item.type === 'eval_group') {
            return (
              <div
                key="block-evals"
                className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-orange-500/10 border-2 border-orange-300 rounded-xl p-2.5 shadow-xs space-y-2 relative"
              >
                <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-600 text-white px-2.5 py-1.5 rounded-lg font-black text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-white/20 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="uppercase tracking-wider">
                      Évaluations ({item.cards!.length})
                    </span>
                  </div>
                </div>
                <div className="space-y-2">{item.cards!.map(renderReadOnlyCard)}</div>
              </div>
            );
          }
          if (item.type === 'entrainement_group') {
            return (
              <div
                key="block-entrainements"
                className="bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-purple-500/10 border-2 border-purple-300 rounded-xl p-2.5 shadow-xs space-y-2.5 relative"
              >
                <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-black text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-white/20 rounded">
                      <Target className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="uppercase tracking-wider">
                      Entraînements ({item.cards!.length})
                    </span>
                  </div>
                </div>
                <div className="space-y-2">{item.cards!.map(renderReadOnlyCard)}</div>
              </div>
            );
          }
          return renderReadOnlyCard(item.card!);
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col select-none font-sans">
      {/* Top Banner - White Background */}
      <header className="bg-white text-slate-900 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between border-b border-slate-200 shrink-0 gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-xl text-indigo-600 shadow-2xs">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Plan de travail - {teacherDisplayName}
            </h1>
            <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Mode élève & remplaçant
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenDevoirs}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            title="Consulter les devoirs"
          >
            <BookOpen className="w-4 h-4" />
            <span>Devoirs</span>
          </button>

          <button
            onClick={handleCopyLink}
            className={`px-3.5 py-2 font-bold rounded-xl text-xs flex items-center gap-2 transition-all border shadow-2xs cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Copier l'URL directe du Plan de Travail"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-indigo-600" />}
            <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            title="Imprimer le Plan de Travail"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer</span>
          </button>

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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Large Date Header Banner with Navigation Arrows & Week Jumps */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleDateShift(-7)}
              className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Semaine précédente (-7 jours)"
            >
              <ChevronsLeft className="w-4 h-4 text-indigo-600" />
              <span className="hidden md:inline">-1 Sem.</span>
            </button>
            <button
              type="button"
              onClick={() => handleDateShift(-1)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Jour précédent (-1 jour)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Jour préc.</span>
            </button>
          </div>

          <div className="text-center flex flex-col items-center mx-auto">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full mb-1 border border-indigo-100">
              Plan de travail du jour
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 capitalize tracking-tight">
                {formatDateFrench(currentDate)}
              </h2>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleDateShift(Number(e.target.value));
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

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleDateShift(1)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Jour suivant (+1 jour)"
            >
              <span>Jour suiv.</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDateShift(7)}
              className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Semaine suivante (+7 jours)"
            >
              <span className="hidden md:inline">+1 Sem.</span>
              <ChevronsRight className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        </div>

        {/* Dynamic Grade Selector (active_grades checkboxes) */}
        {allActiveGrades.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>Afficher les niveaux :</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (validCheckedGrades.length === allActiveGrades.length) {
                    setCheckedGrades([]);
                  } else {
                    setCheckedGrades(allActiveGrades);
                  }
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 mr-1 cursor-pointer"
              >
                {validCheckedGrades.length === allActiveGrades.length ? 'Tout décocher' : 'Tout cocher'}
              </button>

              {allActiveGrades.map((grade) => {
                const normGrade = grade.trim().toUpperCase();
                const isChecked = checkedGrades.some((g) => g.trim().toUpperCase() === normGrade);

                return (
                  <label
                    key={grade}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCheckedGrades((prev) => [...prev, grade]);
                        } else {
                          setCheckedGrades((prev) =>
                            prev.filter((g) => g.trim().toUpperCase() !== normGrade)
                          );
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer accent-indigo-600"
                    />
                    <span>{grade}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Multi-Grade Columns Layout */}
        {gradesToDisplay.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm italic shadow-2xs">
            Aucun niveau sélectionné. Veuillez cocher au moins un niveau ci-dessus pour afficher le plan de travail.
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 ${
              gradesToDisplay.length > 1
                ? gradesToDisplay.length === 2
                  ? 'md:grid-cols-2'
                  : 'md:grid-cols-2 lg:grid-cols-3'
                : 'w-full'
            } gap-6 w-full`}
          >
            {gradesToDisplay.map((grade) => {
              const morningItems = getDisplayItemsForGradeAndCreneau(activeJournal?.matin || [], grade, 'matin');
              const afternoonItems = getDisplayItemsForGradeAndCreneau(activeJournal?.aprem || [], grade, 'aprem');
              const totalMorningCards = morningItems.reduce((acc, it) => acc + (it.cards ? it.cards.length : 1), 0);
              const totalAfternoonCards = afternoonItems.reduce((acc, it) => acc + (it.cards ? it.cards.length : 1), 0);
              const totalCards = totalMorningCards + totalAfternoonCards;
              const isSingleGrade = gradesToDisplay.length === 1;

              return (
                <div key={grade} className="flex flex-col gap-4 w-full">
                  {/* Grade Column Header */}
                  <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs font-extrabold text-sm">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="w-4.5 h-4.5 text-indigo-400" />
                      {grade === 'Classe' ? 'Toutes les activités' : `Niveau ${grade}`}
                    </span>
                    <span className="text-xs font-bold bg-slate-800 text-indigo-300 px-2.5 py-1 rounded-full border border-slate-700">
                      {totalCards} activité{totalCards > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Matin & Après-midi blocks */}
                  <div className={`grid grid-cols-1 ${isSingleGrade ? 'md:grid-cols-2' : ''} gap-6 w-full`}>
                    {/* Matin Column */}
                    <section className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col h-full">
                      <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-amber-100 p-1.5 rounded-xl text-amber-700">
                            <Sun className="w-4.5 h-4.5 text-amber-600" />
                          </div>
                          <h3 className="font-extrabold text-slate-900 text-sm">Matin</h3>
                        </div>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                          {totalMorningCards}
                        </span>
                      </div>

                      <div className="p-3.5 space-y-3 flex-1">
                        {morningItems.length > 0 ? (
                          renderCardsList(morningItems)
                        ) : (
                          <p className="text-xs text-slate-400 italic text-center py-6">
                            Aucune activité pour le matin.
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Après-midi Column */}
                    <section className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col h-full">
                      <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-100 p-1.5 rounded-xl text-indigo-700">
                            <Moon className="w-4.5 h-4.5 text-indigo-600" />
                          </div>
                          <h3 className="font-extrabold text-slate-900 text-sm">Après-midi</h3>
                        </div>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                          {totalAfternoonCards}
                        </span>
                      </div>

                      <div className="p-3.5 space-y-3 flex-1">
                        {afternoonItems.length > 0 ? (
                          renderCardsList(afternoonItems)
                        ) : (
                          <p className="text-xs text-slate-400 italic text-center py-6">
                            Aucune activité pour l'après-midi.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Password Login Modal */}
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

      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200 mt-auto">
        Plan de Travail - Cahier Journal Spiralaire © {teacherDisplayName}
      </footer>
    </div>
  );
};

