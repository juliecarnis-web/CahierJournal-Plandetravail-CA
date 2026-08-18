/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, BookOpen, Sparkles } from 'lucide-react';
import { GradeLevel, HomeworkAdjustment } from '../types.js';

interface AddHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  onAddHomework: (hw: Partial<HomeworkAdjustment>) => Promise<void>;
}

export const AddHomeworkModal: React.FC<AddHomeworkModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  onAddHomework,
}) => {
  const [subject, setSubject] = useState('Mathématiques');
  const [grade, setGrade] = useState<GradeLevel>('CM1');
  const [description, setDescription] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState<
    'standard' | 'soutien' | 'approfondissement'
  >('standard');
  const [competenceCode, setCompetenceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddHomework({
        date_assigned: currentDate,
        date_due: currentDate, // By default due for the next working day shown in the planner
        grade,
        subject,
        description: description.trim(),
        competence_code: competenceCode.trim() || undefined,
        done: false,
        difficulty_level: difficultyLevel,
        teacher_id: 'JulieCB',
      });
      setDescription('');
      setCompetenceCode('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Planifier un Devoir Différencié</h2>
            <p className="text-xs text-slate-400">
              Devoir enregistré dans la base de données PostgreSQL (Neon)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Matière / Domaine
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="Mathématiques">Mathématiques</option>
                <option value="Français">Français</option>
                <option value="Lecture">Lecture</option>
                <option value="Orthographe / Dictée">Orthographe / Dictée</option>
                <option value="Histoire">Histoire</option>
                <option value="Géographie">Géographie</option>
                <option value="Sciences">Sciences</option>
                <option value="Anglais">Anglais</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Niveau
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeLevel)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="CE1">CE1</option>
                <option value="CE2">CE2</option>
                <option value="CM1">CM1</option>
                <option value="CM2">CM2</option>
                <option value="Tous">Tous Niveaux</option>
              </select>
            </div>
          </div>

          {/* Différenciation */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Différenciation de la tâche
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDifficultyLevel('standard')}
                className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${
                  difficultyLevel === 'standard'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setDifficultyLevel('soutien')}
                className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${
                  difficultyLevel === 'soutien'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Soutien / Adapté
              </button>
              <button
                type="button"
                onClick={() => setDifficultyLevel('approfondissement')}
                className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${
                  difficultyLevel === 'approfondissement'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Approfondissement
              </button>
            </div>
          </div>

          {/* Consigne */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Consigne du Devoir *
            </label>
            <textarea
              rows={3}
              required
              placeholder="ex: Lire le chapitre 4 et répondre aux 3 questions dans le cahier du soir..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Code Compétence Lié (Optionnel)
            </label>
            <input
              type="text"
              placeholder="ex: M-NUM-01"
              value={competenceCode}
              onChange={(e) => setCompetenceCode(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Ajout...' : 'Ajouter le devoir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
