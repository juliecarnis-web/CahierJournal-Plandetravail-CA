/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BookOpen,
  Settings,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Notebook,
  Layers,
  GraduationCap,
  User,
  Lock,
  LogOut,
} from 'lucide-react';
import { GradeLevel, ActivityCardItem } from '../types.js';
import { TodoNotesCartouche } from './TodoNotesCartouche.js';

interface HeaderTopBarProps {
  isWorkingDay?: boolean;
  holidayReason?: string;
  teacherName?: string;
  isUnlocked?: boolean;
  onOpenLoginModal?: () => void;
  onLock?: () => void;
}

export const HeaderTopBar: React.FC<HeaderTopBarProps> = ({
  isWorkingDay = true,
  holidayReason,
  teacherName = 'JulieCB',
  isUnlocked = false,
  onOpenLoginModal,
  onLock,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 shrink-0 shadow-2xs select-none px-4 py-2.5 z-30 flex items-center justify-between w-full flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-xl shadow-xs">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 leading-tight">
            Cahier Journal & Planificateur
          </h1>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            Gestion de classe, programmation spiralaire & suivi des activités
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isWorkingDay && (
          <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
            {holidayReason || 'Jour non travaillé'}
          </span>
        )}

        {isUnlocked ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-lg text-xs font-bold text-emerald-800 shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Session Enseignant : <strong>{teacherName}</strong></span>
            </div>
            <button
              type="button"
              onClick={onLock}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Verrouiller (Passer en Mode Lecture Seule)"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Se connecter pour déverrouiller le mode édition"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-300" />
            <span>Connexion</span>
          </button>
        )}
      </div>
    </header>
  );
};

interface HeaderControlBarProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  gradeFilter: GradeLevel;
  onGradeFilterChange: (grade: GradeLevel) => void;
  retardCount?: number;
  onIncrementRetard?: () => void;
  onDecrementRetard?: () => void;
  isWorkingDay?: boolean;
  holidayReason?: string;
  isPlanDeTravail: boolean;
  onTogglePlanDeTravail: () => void;
  onOpenSettings: () => void;
  onReportUndone: () => void;
  evaluationUrl?: string;
  availableGrades?: GradeLevel[];
  onOpenDevoirs?: () => void;
  todos?: ActivityCardItem[];
  onAddTodo?: (titre: string) => void;
  onToggleTodoDone?: (id: number, fait: boolean) => void;
  onDeleteTodo?: (id: number) => void;
  isUnlocked?: boolean;
  autoRescheduleEnabled?: boolean;
}

export const HeaderControlBar: React.FC<HeaderControlBarProps> = ({
  currentDate,
  gradeFilter,
  onGradeFilterChange,
  isPlanDeTravail,
  onTogglePlanDeTravail,
  onOpenSettings,
  onReportUndone,
  evaluationUrl,
  availableGrades = [],
  onOpenDevoirs,
  todos,
  onAddTodo,
  onToggleTodoDone,
  onDeleteTodo,
  isUnlocked = false,
  autoRescheduleEnabled = false,
}) => {
  const handleOpenPlanInNewTab = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'plan-de-travail');
    url.searchParams.set('date', currentDate);
    window.open(url.toString(), '_blank');
  };

  const handleOpenDevoirsInNewTab = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'devoirs');
    url.searchParams.set('date', currentDate);
    window.open(url.toString(), '_blank');
  };

  const handleOpenEvaluation = () => {
    const activeUrl = evaluationUrl && evaluationUrl.trim() ? evaluationUrl.trim() : 'https://educonnect.education.gouv.fr';
    let targetUrl = activeUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-xs shrink-0 select-none">
      {/* Partie gauche : Widget To-Do Post-it */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0">
        <TodoNotesCartouche
          todos={todos}
          onAddTodo={onAddTodo}
          onToggleDone={onToggleTodoDone}
          onDeleteTodo={onDeleteTodo}
          isUnlocked={isUnlocked}
        />
      </div>

      {/* Partie droite : Barre de navigation unifiée & actions */}
      <div className="flex-1 flex flex-col items-end justify-center gap-2 min-w-0">
        <div className="flex items-center justify-end gap-2 flex-wrap w-full">
          {!isPlanDeTravail ? (
            <>
              {/* 1. Suivi & Évaluations */}
              <button
                type="button"
                onClick={handleOpenEvaluation}
                title={
                  evaluationUrl
                    ? `Ouvrir l'outil Suivi & Évaluations (${evaluationUrl})`
                    : "Configurer l'URL de l'outil Suivi & Évaluations dans les paramètres"
                }
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Suivi & Évaluations</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-500 opacity-70" />
              </button>

              {/* 2. Plan de travail */}
              <button
                type="button"
                onClick={handleOpenPlanInNewTab}
                title="Ouvrir la page dédiée du Plan de Travail (Élèves)"
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-xl border border-indigo-200 text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Plan de travail</span>
              </button>

              {/* 3. Devoirs */}
              <button
                type="button"
                onClick={handleOpenDevoirsInNewTab}
                title="Ouvrir la page dédiée des Devoirs (Élèves & Parents)"
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold rounded-xl border border-purple-200 text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Notebook className="w-4 h-4 text-purple-600" />
                <span>Devoirs</span>
              </button>

              {/* 4. Filtre / Choix du Niveau */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs flex items-center gap-1">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight mr-1">
                  Niveau :
                </span>
                <select
                  value={gradeFilter}
                  onChange={(e) => onGradeFilterChange(e.target.value as GradeLevel)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="Tous">Tous Niveaux</option>
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Actions (Visible ONLY when edition mode is UNLOCKED) */}
              {isUnlocked && (
                <>
                  {/* 5. Report au jour x (si auto-reschedule désactivé) ou Badge d'information (si auto-reschedule actif) */}
                  {autoRescheduleEnabled ? (
                    <div
                      title="Le report automatique est activé dans vos paramètres. Les activités non réalisées sont automatiquement décalées au chargement du journal."
                      className="px-3.5 py-2 bg-emerald-50 text-emerald-800 font-extrabold rounded-xl border border-emerald-300 flex items-center gap-1.5 shadow-2xs text-xs opacity-90 cursor-default"
                    >
                      <RotateCcw className="w-4 h-4 text-emerald-600 animate-pulse" />
                      <span>Report auto actif</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onReportUndone}
                      title="Reporter les activités non cochées au prochain jour travaillé (jour x)"
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold rounded-xl border border-amber-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <span>Report au jour x</span>
                    </button>
                  )}

                  {/* 6. Paramètres (Engrenage) */}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="p-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors shadow-2xs cursor-pointer"
                    title="Paramètres, calendrier & configuration"
                  >
                    <Settings className="w-4 h-4 text-slate-200" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Mode Plan de travail
              </span>
              <button
                type="button"
                onClick={onTogglePlanDeTravail}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-xs hover:bg-indigo-100 transition-colors"
              >
                Retour Enseignant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface HeaderProps extends HeaderTopBarProps, HeaderControlBarProps {}

export const Header: React.FC<HeaderProps> = (props) => {
  return (
    <>
      <HeaderTopBar
        isWorkingDay={props.isWorkingDay}
        holidayReason={props.holidayReason}
        teacherName={props.teacherName}
        isUnlocked={props.isUnlocked}
        onOpenLoginModal={props.onOpenLoginModal}
        onLock={props.onLock}
      />
      <HeaderControlBar {...props} />
    </>
  );
};
