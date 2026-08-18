/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers, Calendar, Database, Sparkles } from 'lucide-react';
import { DatabaseStatus } from '../types.js';

interface FooterSettingsBarProps {
  dbStatus: DatabaseStatus | null;
  workingDaysLabel: string;
  onOpenProgressionsModal: () => void;
}

export const FooterSettingsBar: React.FC<FooterSettingsBarProps> = ({
  dbStatus,
  workingDaysLabel,
  onOpenProgressionsModal,
}) => {
  const isNeonConnected = dbStatus?.type === 'neon-postgres';

  return (
    <footer className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm select-none shrink-0 flex flex-wrap items-center justify-between gap-4">
      {/* 1. Calendrier & Paramètres actifs (sans bouton Modifier) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span className="font-medium">Jours ouvrés :</span>
          <span className="font-bold text-slate-800">{workingDaysLabel || 'L-M-J-V'}</span>
        </div>

        <div
          onClick={onOpenProgressionsModal}
          title="Cliquez pour consulter le tableau chronologique complet"
          className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          <span className="font-medium">Progression :</span>
          <span className="font-bold text-indigo-700">Période 5</span>
        </div>
      </div>

      {/* 2. Légende Activités compacte */}
      <div className="hidden lg:flex items-center gap-3 text-[11px] font-medium text-slate-600">
        <span className="text-slate-400 font-bold uppercase text-[10px]">Légende :</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#DBEAFE] border border-blue-300" />
          Leçon
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#FEF9C3] border border-yellow-300" />
          Modelage
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#F3E8FF] border border-purple-300" />
          Entraînement
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#FEE2E2] border border-red-300" />
          Tâche Comp.
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#FFEDD5] border border-orange-300" />
          Éval.
        </span>
      </div>

      {/* 3. Statut Base de données Neon */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
            isNeonConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
          title={dbStatus?.message || 'Statut DB'}
        >
          <Database
            className={`w-3.5 h-3.5 ${
              isNeonConnected ? 'text-emerald-600' : 'text-amber-600'
            }`}
          />
          <span>{isNeonConnected ? 'Neon PostgreSQL (Production)' : 'Simulation Mémoire'}</span>
        </div>
      </div>
    </footer>
  );
};
