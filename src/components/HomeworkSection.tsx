/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Check, Trash2, Database, Share2, Upload } from 'lucide-react';
import { HomeworkAdjustment } from '../types.js';

interface HomeworkSectionProps {
  homework: HomeworkAdjustment[];
  onToggleDone: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onOpenAddModal: () => void;
  onMigrateFromLocalStorage: () => void;
  hasLocalStorageItems: boolean;
  isPlanDeTravail?: boolean;
}

export const HomeworkSection: React.FC<HomeworkSectionProps> = ({
  homework,
  onToggleDone,
  onDelete,
  onOpenAddModal,
  onMigrateFromLocalStorage,
  hasLocalStorageItems,
  isPlanDeTravail = false,
}) => {
  const getSubjectColor = (subject: string) => {
    if (subject.toLowerCase().includes('math')) return 'text-emerald-300';
    if (subject.toLowerCase().includes('fran') || subject.toLowerCase().includes('lect'))
      return 'text-indigo-300';
    if (subject.toLowerCase().includes('hist') || subject.toLowerCase().includes('géo'))
      return 'text-amber-300';
    return 'text-purple-300';
  };

  const getHomeworkBadgeInfo = (hw: HomeworkAdjustment) => {
    const text = (hw.subject + ' ' + hw.description).toLowerCase();
    if (text.includes('modelage')) {
      return {
        label: 'Modelage',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
      };
    }
    if (text.includes('leçon') || text.includes('réviser') || text.includes('lecon')) {
      return {
        label: 'Leçon',
        badgeBg: 'bg-blue-100 text-blue-900 border-blue-200 font-bold',
      };
    }
    if (text.includes('codage')) {
      return {
        label: 'ENT • CODAGE (X4)',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
      };
    }
    if (text.includes('mémorisation') || text.includes('memorisation') || text.includes('automatisation')) {
      return {
        label: 'ENT • MÉMORISATION / AUTOMATISATION (X2)',
        badgeBg: 'bg-purple-200 text-purple-950 border-purple-300 font-bold',
      };
    }
    if (text.includes('remémoration') || text.includes('rememoration')) {
      return {
        label: 'ENT • REMÉMORATION (X1)',
        badgeBg: 'bg-purple-300 text-purple-950 border-purple-400 font-extrabold',
      };
    }
    if (text.includes('entraînement') || text.includes('entrainement')) {
      return {
        label: 'ENT • ENTRAÎNEMENT',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
      };
    }
    return {
      label: hw.subject || 'Devoir',
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-200 font-bold',
    };
  };

  return (
    <section className="h-32 bg-slate-800 text-white border border-slate-700 rounded-xl shadow-inner p-3 flex gap-4 shrink-0 select-none">
      {/* Left title & due day indicator */}
      <div className="w-32 flex flex-col border-r border-slate-600 pr-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            Devoirs
          </h3>
          <span className="text-[9px] bg-slate-700 text-slate-300 px-1 rounded font-bold">
            NEON DB
          </span>
        </div>
        <div className="mt-auto">
          <p className="text-2xl font-black text-white leading-none">J+1</p>
          <p className="text-[10px] text-slate-400 mt-1">Pour le lendemain</p>
        </div>
      </div>

      {/* Homework Cards Grid */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-y-auto pr-1">
        {homework.length === 0 ? (
          <div className="col-span-3 flex items-center justify-center bg-slate-700/30 rounded border border-slate-700/50 text-slate-400 text-xs italic">
            Aucun devoir planifié. Cliquez sur "Ajouter" pour créer un devoir différencié.
          </div>
        ) : (
          homework.map((hw) => {
            const isDiff = hw.difficulty_level !== 'standard';
            const badge = getHomeworkBadgeInfo(hw);
            return (
              <div
                key={hw.id}
                className={`bg-slate-700/50 p-2.5 rounded border border-slate-600 relative flex flex-col justify-between transition-opacity ${
                  hw.done ? 'opacity-50' : ''
                }`}
              >
                {isDiff && (
                  <div
                    className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-500 text-[8px] font-black rounded uppercase text-slate-900"
                    title={`Différenciation : ${hw.difficulty_level}`}
                  >
                    DIFFÉRENCIÉ ({hw.difficulty_level})
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[8px] uppercase px-1.5 py-0.2 rounded border tracking-tight ${badge.badgeBg}`}>
                      {badge.label}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${getSubjectColor(
                        hw.subject
                      )} uppercase tracking-wide`}
                    >
                      {hw.subject} • {hw.grade}
                    </span>
                  </div>

                  <p className="text-xs leading-snug mt-1 text-slate-200 line-clamp-2">
                    {hw.description}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-600/50 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {!isPlanDeTravail && (
                      <input
                        type="checkbox"
                        checked={hw.done}
                        onChange={() => onToggleDone(hw.id, !hw.done)}
                        className="w-3.5 h-3.5 rounded border-slate-500 accent-indigo-500 cursor-pointer"
                        title="Marquer comme fait / vérifié"
                      />
                    )}
                    <span className={hw.done ? 'line-through text-slate-400' : 'text-slate-300 font-bold'}>
                      {hw.done ? 'Fait' : 'À faire'}
                    </span>
                  </div>

                  {!isPlanDeTravail && (
                    <button
                      onClick={() => onDelete(hw.id)}
                      className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
                      title="Supprimer ce devoir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right action buttons */}
      {!isPlanDeTravail && (
        <div className="w-32 flex flex-col items-center justify-center gap-2 border-l border-slate-600 pl-3 shrink-0">
          <button
            onClick={onOpenAddModal}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold rounded uppercase transition-colors flex items-center justify-center gap-1 shadow-sm"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>

          {hasLocalStorageItems && (
            <button
              onClick={onMigrateFromLocalStorage}
              className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded uppercase transition-colors flex items-center justify-center gap-1 shadow-sm"
              title="Migrer les devoirs existants dans localStorage vers PostgreSQL Neon"
            >
              <Upload className="w-3 h-3" />
              Migrer local
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="w-full py-1.5 bg-slate-600 hover:bg-slate-500 text-[10px] font-bold rounded uppercase transition-colors flex items-center justify-center"
          >
            Différencier
          </button>
        </div>
      )}
    </section>
  );
};
