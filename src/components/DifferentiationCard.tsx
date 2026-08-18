import React from 'react';
import { Users, Sparkles } from 'lucide-react';
import { DifferentiationEvalData, DifferentiationEntData } from '../types.js';

interface DifferentiationCardProps {
  typeActivite?: string;
  differentiationEval?: DifferentiationEvalData;
  differentiationEnt?: DifferentiationEntData;
  compact?: boolean;
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

export const DifferentiationCard: React.FC<DifferentiationCardProps> = ({
  typeActivite,
  differentiationEval,
  differentiationEnt,
  compact = false,
}) => {
  if (typeActivite === 'Évaluation' && differentiationEval) {
    // Dédoublonnage strict par ID
    type StudentItem = typeof differentiationEval.need_group[0];
    const uniqueNeed: StudentItem[] = Array.from(
      new Map<string, StudentItem>(differentiationEval.need_group.map((s) => [String(s.id), s])).values()
    );
    const uniqueSuccess: StudentItem[] = Array.from(
      new Map<string, StudentItem>(differentiationEval.success_group.map((s) => [String(s.id), s])).values()
    );

    const hasNeed = uniqueNeed.length > 0;
    const hasSuccess = uniqueSuccess.length > 0;

    if (!hasNeed && !hasSuccess) return null;

    return (
      <div
        className={`bg-amber-50/90 border border-amber-200 rounded-md text-xs text-slate-800 shadow-2xs space-y-1.5 ${
          compact ? 'p-1.5 my-1' : 'p-2 my-1.5'
        }`}
      >
        <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-[11px] uppercase tracking-tight">
          <Users className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Groupes de différenciation :</span>
        </div>

        {hasNeed && (
          <div className="text-[11px] flex items-start gap-1 flex-wrap">
            <span className="font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] shrink-0">
              Évaluation prioritaire (&lt; 3) :
            </span>
            <div className="flex flex-wrap gap-1 items-center">
              {uniqueNeed.map((s) => (
                <span
                  key={s.id}
                  title={formatStudentTooltip(s)}
                  className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.2 rounded font-medium text-[10px] hover:bg-emerald-100 transition-colors cursor-default"
                >
                  {s.first_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasSuccess && (
          <div className="text-[11px] flex items-start gap-1 flex-wrap">
            <span className="font-bold text-white bg-emerald-800 border border-emerald-900 px-1.5 py-0.5 rounded text-[10px] shrink-0 shadow-2xs">
              Validé (&ge; 5) :
            </span>
            <div className="flex flex-wrap gap-1 items-center">
              {uniqueSuccess.map((s) => (
                <span
                  key={s.id}
                  title={formatStudentTooltip(s)}
                  className="bg-emerald-700 text-white font-semibold px-1.5 py-0.2 rounded text-[10px] hover:bg-emerald-800 transition-colors cursor-default"
                >
                  {s.first_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (typeActivite === 'Entraînement' && differentiationEnt && differentiationEnt.ent_optional) {
    return (
      <div
        className={`bg-purple-50/90 border border-purple-200 rounded-md flex items-center justify-between text-xs font-bold text-purple-900 shadow-2xs ${
          compact ? 'p-1.5 my-1' : 'p-2 my-1.5'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Cohorte en réussite, ENT facultatif</span>
        </div>
        {differentiationEnt.cohort_average > 0 && (
          <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-extrabold">
            Moy. {differentiationEnt.cohort_average} / 5
          </span>
        )}
      </div>
    );
  }

  return null;
};
