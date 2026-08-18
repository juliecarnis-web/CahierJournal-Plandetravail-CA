/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Layers, Sun, Moon, ExternalLink, Plus } from 'lucide-react';
import { ChronologicalProgression } from '../types.js';

interface ProgressionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matin: ChronologicalProgression[];
  aprem: ChronologicalProgression[];
  onAddProgression: (item: Partial<ChronologicalProgression>) => Promise<void>;
}

export const ProgressionsModal: React.FC<ProgressionsModalProps> = ({
  isOpen,
  onClose,
  matin,
  aprem,
  onAddProgression,
}) => {
  const [tab, setTab] = useState<'matin' | 'aprem'>('matin');
  const [isAdding, setIsAdding] = useState(false);
  const [titreChapitre, setTitreChapitre] = useState('');
  const [competenceCode, setCompetenceCode] = useState('');
  const [grade, setGrade] = useState<'CM1' | 'CM2' | 'Tous'>('CM1');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentList = tab === 'matin' ? matin : aprem;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titreChapitre.trim()) return;
    setIsSubmitting(true);
    try {
      const nextOrder =
        currentList.length > 0
          ? Math.max(...currentList.map((i) => i.ordre_sequence)) + 1
          : 1;

      await onAddProgression({
        ordre_sequence: nextOrder,
        competence_code: competenceCode.trim() || `COMP-${nextOrder}`,
        grade,
        url: url.trim() || undefined,
        titre_chapitre: titreChapitre.trim(),
        creneau: tab,
        teacher_id: 'JulieCB',
      });
      setTitreChapitre('');
      setCompetenceCode('');
      setUrl('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Progression Spiralaire Complète</h2>
              <p className="text-xs text-slate-400">
                Tables PostgreSQL : <code className="text-indigo-300">chronological_progression_matin</code> et{' '}
                <code className="text-indigo-300">chronological_progression_aprem</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('matin')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                tab === 'matin'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Matin ({matin.length} séquences - Domino Continu)</span>
            </button>
            <button
              onClick={() => setTab('aprem')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                tab === 'aprem'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Après-midi ({aprem.length} séquences - Vagues)</span>
            </button>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une séquence</span>
          </button>
        </div>

        {/* Add Sequence Form */}
        {isAdding && (
          <form
            onSubmit={handleAddSubmit}
            className="bg-indigo-50/70 border-b border-indigo-200 p-4 shrink-0 grid grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">
                Titre du Chapitre / Séquence *
              </label>
              <input
                type="text"
                required
                placeholder="ex: Numération : Fractions"
                value={titreChapitre}
                onChange={(e) => setTitreChapitre(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">
                Code Compétence
              </label>
              <input
                type="text"
                placeholder="ex: M-NUM-05"
                value={competenceCode}
                onChange={(e) => setCompetenceCode(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">
                Lien URL / Ressource
              </label>
              <input
                type="url"
                placeholder="https://www.lumni.fr/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as any)}
                className="p-2 bg-white border border-slate-300 rounded text-xs font-bold"
              >
                <option value="CE1">CE1</option>
                <option value="CE2">CE2</option>
                <option value="CM1">CM1</option>
                <option value="CM2">CM2</option>
                <option value="Tous">Tous</option>
              </select>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {isSubmitting ? '...' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {/* Table List */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                <th className="py-2 px-3">Ordre #</th>
                <th className="py-2 px-3">Code Compétence</th>
                <th className="py-2 px-3">Titre du Chapitre</th>
                <th className="py-2 px-3">Niveau</th>
                <th className="py-2 px-3">Ressource / Lien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {currentList.map((seq) => (
                <tr
                  key={seq.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="py-2.5 px-3 font-black text-indigo-600">
                    #{seq.ordre_sequence}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                    {seq.competence_code}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {seq.intitule || seq.titre_chapitre}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {seq.grade}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {seq.url ? (
                      <a
                        href={seq.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-bold text-[11px]"
                      >
                        <span>Ouvrir</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Aucun lien</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Total : <strong>{currentList.length}</strong> séquences chargées de la base de données.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
