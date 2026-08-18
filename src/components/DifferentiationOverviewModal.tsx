import React, { useEffect, useState, useMemo } from 'react';
import { X, Users, Sparkles, RefreshCw, Layers, Calendar } from 'lucide-react';
import { api } from '../services/api.js';

interface DifferentiationOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId?: string;
  activeGrades?: string[];
  scheduledCompetenceCodes?: string[];
}

interface OverviewItem {
  competence_code: string;
  title?: string;
  domaine?: string;
  need_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
  success_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
  cohort_average: number;
  ent_optional: boolean;
}

const formatStudentTooltip = (s: { first_name?: string; last_name?: string; grade?: string }) => {
  const fn = (s.first_name || '').trim();
  const ln = (s.last_name || '').trim();
  const validLn = ln && ln !== '?' ? ln : '';
  const fullName = [fn, validLn].filter(Boolean).join(' ');
  const gr = (s.grade || '').trim();
  if (gr && gr.toUpperCase() !== 'TOUS') {
    return `${fullName} (${gr})`;
  }
  return fullName;
};

export const DifferentiationOverviewModal: React.FC<DifferentiationOverviewModalProps> = ({
  isOpen,
  onClose,
  teacherId = 'JulieCB',
  activeGrades,
  scheduledCompetenceCodes,
}) => {
  const [data, setData] = useState<OverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'scheduled' | 'all'>('scheduled');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDifferentiationOverview(teacherId, activeGrades, scheduledCompetenceCodes);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Erreur chargement aperçu différenciation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, teacherId, JSON.stringify(activeGrades), JSON.stringify(scheduledCompetenceCodes)]);

  const scheduledSet = useMemo(() => {
    return new Set((scheduledCompetenceCodes || []).map((c) => (c || '').trim().toUpperCase()));
  }, [scheduledCompetenceCodes]);

  const displayedData = useMemo(() => {
    if (filterMode === 'scheduled') {
      if (!scheduledCompetenceCodes || scheduledCompetenceCodes.length === 0) {
        return [];
      }
      return data.filter(
        (item) => item.competence_code && scheduledSet.has(item.competence_code.trim().toUpperCase())
      );
    }
    // Mode "Toutes les compétences" : tri décroissant par volume d'utilisation (nombre d'élèves/résultats associés)
    return [...data].sort((a, b) => {
      const countA = (a.need_group?.length || 0) + (a.success_group?.length || 0);
      const countB = (b.need_group?.length || 0) + (b.success_group?.length || 0);
      if (countB !== countA) {
        return countB - countA;
      }
      return (a.competence_code || '').localeCompare(b.competence_code || '');
    });
  }, [data, filterMode, scheduledCompetenceCodes, scheduledSet]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Panneau de Différenciation Intelligente
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                  Mode Aperçu / Test
                </span>
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Analyse basée sur les résultats élèves</span>
                {activeGrades && activeGrades.length > 0 && (
                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 font-bold text-[10px]">
                    Niveaux actifs : {activeGrades.join(', ')}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
              title="Actualiser"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('scheduled')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                filterMode === 'scheduled'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Programme du jour ({scheduledCompetenceCodes?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Toutes les compétences ({data.length})</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 italic">
            {filterMode === 'scheduled'
              ? 'Seules les compétences programmées aujourd’hui sont affichées.'
              : 'Affichage de l’ensemble de la base de données.'}
          </span>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-medium">Calcul des groupes et moyennes de cohorte en cours...</p>
            </div>
          ) : displayedData.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-slate-500 text-sm font-medium">
                {filterMode === 'scheduled'
                  ? 'Aucune compétence d’évaluation ou d’entraînement inscrite au programme du jour.'
                  : 'Aucune donnée de résultats ou compétences disponible.'}
              </p>
              {filterMode === 'scheduled' && data.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Afficher toutes les compétences ({data.length})
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedData.map((item, idx) => {
                // Dédoublonnage strict par ID pour sécurité absolue
                type StudentType = typeof item.need_group[0];
                const uniqueNeedGroup: StudentType[] = Array.from(
                  new Map<string, StudentType>(item.need_group.map((s) => [String(s.id), s])).values()
                );
                const uniqueSuccessGroup: StudentType[] = Array.from(
                  new Map<string, StudentType>(item.success_group.map((s) => [String(s.id), s])).values()
                );

                return (
                  <div
                    key={`${item.competence_code}-${idx}`}
                    className="p-4 bg-white rounded-2xl border border-slate-200/90 space-y-3.5 hover:border-slate-300 transition-all shadow-xs"
                  >
                    {/* Header Compétence */}
                    <div className="border-b border-slate-100 pb-2.5 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black bg-slate-800 text-white px-2 py-0.5 rounded-md">
                            {item.competence_code}
                          </span>
                          {item.domaine && (
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {item.domaine}
                            </span>
                          )}
                        </div>
                        {item.title && (
                          <p className="text-xs text-slate-800 font-bold mt-1.5 line-clamp-2">
                            {item.title}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* BLOC 1 : ÉVALUATION (Fond orange pastel) */}
                    <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                        <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs uppercase tracking-tight">
                          <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Bloc Évaluation</span>
                        </div>
                        <span className="text-[10px] font-extrabold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                          Ajustement élèves
                        </span>
                      </div>

                      {/* Évaluation prioritaire (vert clair doux) */}
                      <div className="p-2 bg-emerald-50/80 border border-emerald-200/80 rounded-lg text-xs space-y-1">
                        <span className="font-extrabold text-emerald-900 block text-[11px]">
                          🎯 Évaluation prioritaire (&lt; 3 réussites) :
                        </span>
                        {uniqueNeedGroup.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {uniqueNeedGroup.map((s) => (
                              <span
                                key={s.id}
                                title={formatStudentTooltip(s)}
                                className="inline-block bg-emerald-100/90 text-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded border border-emerald-300 hover:bg-emerald-200 transition-colors cursor-default"
                              >
                                {s.first_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-700/80 text-[11px] italic block">Aucun élève à évaluer en priorité</span>
                        )}
                      </div>

                      {/* Validé (vert profond) */}
                      <div className="p-2 bg-emerald-900/10 border border-emerald-900/20 rounded-lg text-xs space-y-1">
                        <span className="font-extrabold text-emerald-950 block text-[11px]">
                          ✅ Validé (&ge; 5 réussites) :
                        </span>
                        {uniqueSuccessGroup.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {uniqueSuccessGroup.map((s) => (
                              <span
                                key={s.id}
                                title={formatStudentTooltip(s)}
                                className="inline-block bg-emerald-800 text-white text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-900 shadow-2xs hover:bg-emerald-900 transition-colors cursor-default"
                              >
                                {s.first_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic block">Aucun élève validé pour l'instant</span>
                        )}
                      </div>
                    </div>

                    {/* BLOC 2 : ENTRAÎNEMENT (Fond violet pastel) */}
                    <div className="p-3 bg-purple-50/90 border border-purple-200/90 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-purple-200/60 pb-1.5">
                        <div className="flex items-center gap-1.5 text-purple-950 font-black text-xs uppercase tracking-tight">
                          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Bloc Entraînement</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-purple-800/70 block leading-tight">Moyenne Cohorte</span>
                          <span className="text-xs font-black text-purple-900">{item.cohort_average} / 5</span>
                        </div>
                      </div>

                      {item.ent_optional ? (
                        <div className="p-2 bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-2 text-xs font-bold text-purple-900 shadow-2xs">
                          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Cohorte en réussite, Entraînement facultatif (Moyenne = {item.cohort_average} / 5 &ge; 3)</span>
                        </div>
                      ) : (
                        <div className="p-2 bg-purple-100/50 border border-purple-200/70 rounded-lg text-xs font-medium text-purple-900">
                          Entraînement recommandé (Moyenne = {item.cohort_average} / 5 &lt; 3)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
          <span>Ces résultats s'affichent automatiquement sur les cartouches spiralaires au jour utile correspondant.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
