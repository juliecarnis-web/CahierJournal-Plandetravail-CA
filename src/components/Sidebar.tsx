/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, Calendar, Layers, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { DatabaseStatus } from '../types.js';

interface SidebarProps {
  dbStatus: DatabaseStatus | null;
  workingDaysLabel: string;
  onOpenSettings: () => void;
  onOpenProgressionsModal: () => void;
  onSeedDatabase: () => void;
  isSeeding: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  dbStatus,
  workingDaysLabel,
  onOpenSettings,
  onOpenProgressionsModal,
  onSeedDatabase,
  isSeeding,
}) => {
  const isNeonConnected = dbStatus?.type === 'neon-postgres';

  return (
    <aside className="w-64 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm shrink-0 select-none">
      {/* Calendrier & Rythmes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Calendrier & Rythmes
          </h3>
          <button
            onClick={onOpenSettings}
            className="text-[10px] text-indigo-600 font-bold hover:underline"
          >
            Modifier
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-sm">
            <span className="text-slate-600 text-xs font-medium">Jours Ouvrés</span>
            <span className="font-bold text-xs">{workingDaysLabel || 'L-M-J-V'}</span>
          </div>
          <div
            onClick={onOpenProgressionsModal}
            className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-sm cursor-pointer hover:bg-slate-100/80 transition-colors"
            title="Cliquez pour consulter le tableau chronologique complet de progression"
          >
            <span className="text-slate-600 text-xs font-medium">Progression</span>
            <span className="font-bold text-xs text-indigo-600 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Période 5
            </span>
          </div>
        </div>
      </div>

      {/* Légende Activités */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Légende Activités
        </h3>
        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="w-3 h-3 rounded-sm bg-[#DBEAFE] border border-blue-200 shrink-0" />
            <span>Leçon (Bleu pastel)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="w-3 h-3 rounded-sm bg-[#FEF9C3] border border-yellow-200 shrink-0" />
            <span>Modelage (Jaune pastel)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="w-3 h-3 rounded-sm bg-[#F3E8FF] border border-purple-200 shrink-0" />
            <span>Entraînement (Violet pastel)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="w-3 h-3 rounded-sm bg-[#FEE2E2] border border-red-200 shrink-0" />
            <span>Tâche Complexe (Bordeaux)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="w-3 h-3 rounded-sm bg-[#FFEDD5] border border-orange-200 shrink-0" />
            <span>Évaluation (Saumon pastel)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="w-3 h-3 rounded-sm bg-[#334155] shrink-0" />
            <span>Révisions (Gris profond)</span>
          </div>
        </div>
      </div>

      {/* Rythmes d'ouverture explanation badge */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1">
        <p className="font-bold text-slate-800 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          Matin : Ouverture Continue
        </p>
        <p className="text-[10px] text-slate-500 leading-snug">
          1 nouvelle compétence/jour utile (Effet domino J1→J2...).
        </p>
        <p className="font-bold text-slate-800 flex items-center gap-1 pt-1 border-t border-slate-100">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
          Aprem : Vagues Rythmées
        </p>
        <p className="text-[10px] text-slate-500 leading-snug">
          Ouverture par vagues, pause rythmée après 2 séquences.
        </p>
      </div>

      {/* Neon DB Status Box */}
      <div className="mt-auto bg-indigo-900 rounded-lg p-3.5 text-white shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase font-bold opacity-60 tracking-wider">
            Database Status
          </div>
          <button
            onClick={onSeedDatabase}
            disabled={isSeeding}
            title="Réinitialiser et alimenter les données PostgreSQL/Simulation"
            className="text-[10px] bg-indigo-800 hover:bg-indigo-700 text-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isSeeding ? 'animate-spin' : ''}`} />
            Seed
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <div
            className={`w-2 h-2 rounded-full ${
              isNeonConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          {isNeonConnected
            ? 'Neon (PostgreSQL) Connected'
            : 'Simulation Memory Active'}
        </div>

        <p className="text-[10px] text-indigo-200 mt-1.5 line-clamp-2 leading-snug">
          {dbStatus?.message || 'Prêt pour le pilotage quotidien.'}
        </p>
      </div>
    </aside>
  );
};
