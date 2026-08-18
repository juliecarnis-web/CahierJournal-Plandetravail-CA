/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Check, Link, Tag, Layers, Calendar, Users, Palette, CheckCircle2, AlertCircle } from 'lucide-react';
import { GradeLevel, CustomHomework } from '../types.js';
import { CUSTOM_COLOR_LABELS, getColorLabelObject } from '../lib/colorLabels.js';
import { api } from '../services/api.js';

interface AddCustomHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  activeGrades?: GradeLevel[];
  initialData?: Partial<CustomHomework> | null;
  onSuccess?: () => void;
}

export const AddCustomHomeworkModal: React.FC<AddCustomHomeworkModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  activeGrades = ['CE2', 'CM2'],
  initialData = null,
  onSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [isCustomSubject, setIsCustomSubject] = useState(false);

  const [subDomain, setSubDomain] = useState('');
  const [customSubDomainInput, setCustomSubDomainInput] = useState('');
  const [isCustomSubDomain, setIsCustomSubDomain] = useState(false);

  const [grade, setGrade] = useState<GradeLevel>('CM2');
  const [targetGroups, setTargetGroups] = useState<string>('Tous');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [exerciseNumber, setExerciseNumber] = useState('');

  const [cartridgeColor, setCartridgeColor] = useState<string>('standard');
  const [isOptional, setIsOptional] = useState<boolean>(false);
  const [positionRule, setPositionRule] = useState<string>('bottom');
  const [recurrence, setRecurrence] = useState<string>('none');
  const [dateEcheance, setDateEcheance] = useState<string>(currentDate);

  const [matieresOptions, setMatieresOptions] = useState<string[]>([]);
  const [subDomainsOptions, setSubDomainsOptions] = useState<string[]>([]);
  const [targetGroupsOptions, setTargetGroupsOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available grade choices dynamically from user settings
  const gradeChoices = React.useMemo(() => {
    const list: GradeLevel[] = [...activeGrades];
    if (!list.includes('Tous' as GradeLevel)) {
      list.push('Tous' as GradeLevel);
    }
    return list;
  }, [activeGrades]);

  // Computed dynamic options lists ensuring current value is included
  const displayedMatieres = React.useMemo(() => {
    const list = [...matieresOptions];
    if (subject && subject !== 'CUSTOM_NEW' && !list.includes(subject)) {
      list.unshift(subject);
    }
    return list;
  }, [matieresOptions, subject]);

  const displayedSubDomains = React.useMemo(() => {
    const list = [...subDomainsOptions];
    if (subDomain && subDomain !== 'CUSTOM_NEW' && !list.includes(subDomain)) {
      list.unshift(subDomain);
    }
    return list;
  }, [subDomainsOptions, subDomain]);

  // Load dynamic options from API when modal opens
  useEffect(() => {
    if (isOpen) {
      api.getCustomHomeworkOptions()
        .then(data => {
          const matList = data.matieres || [];
          const subList = data.sub_domains || [];
          const grpList = (data as any).target_groups || [];

          setMatieresOptions(matList);
          setSubDomainsOptions(subList);
          setTargetGroupsOptions(grpList);

          if (!initialData) {
            if (matList.length > 0) {
              setSubject(matList[0]);
              setIsCustomSubject(false);
            } else {
              setSubject('');
              setIsCustomSubject(true);
            }

            if (subList.length > 0) {
              setSubDomain(subList[0]);
              setIsCustomSubDomain(false);
            } else {
              setSubDomain('');
              setIsCustomSubDomain(false);
            }
          }
        })
        .catch(err => console.error('Error fetching homework options:', err));
    }
  }, [isOpen, initialData]);

  // Pre-fill fields if initialData is provided for editing
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (initialData) {
        // Matière
        const initialSubject = initialData.subject || '';
        setSubject(initialSubject);
        setCustomSubjectInput(initialSubject);
        setIsCustomSubject(false);

        // Sous-domaine
        const initialSubDomain = initialData.sub_domain || '';
        setSubDomain(initialSubDomain);
        setCustomSubDomainInput(initialSubDomain);
        setIsCustomSubDomain(false);

        setGrade(initialData.grade || (activeGrades[0] || 'CM2'));
        setTargetGroups(initialData.target_groups || 'Tous');
        setTitle(initialData.title || (initialData as any).titre_chapitre || '');
        setDescription(initialData.description || '');
        setUrl(initialData.url || '');
        setExerciseNumber(initialData.exercise_number || '');
        setCartridgeColor(initialData.cartridge_color || 'standard');
        setIsOptional(Boolean(initialData.is_optional || (initialData as any).priority_status === 'facultatif'));
        setPositionRule(initialData.position_rule || 'bottom');
        setRecurrence(initialData.recurrence || 'none');
        setDateEcheance(initialData.date_echeance || (initialData as any).date_due || currentDate);
      } else {
        setCustomSubjectInput('');
        setCustomSubDomainInput('');
        setGrade(activeGrades[0] || 'CM2');
        setTargetGroups('Tous');
        setTitle('');
        setDescription('');
        setUrl('');
        setExerciseNumber('');
        setCartridgeColor('standard');
        setIsOptional(false);
        setPositionRule('bottom');
        setRecurrence('none');
        setDateEcheance(currentDate);
      }
    }
  }, [isOpen, initialData, currentDate, activeGrades]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = isCustomSubject ? customSubjectInput.trim() : subject;
    const finalSubDomain = isCustomSubDomain ? customSubDomainInput.trim() : subDomain;
    const finalTitle = title.trim() || finalSubject;

    if (!finalSubject) {
      setErrorMsg('Veuillez spécifier la matière.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: Partial<CustomHomework> = {
        id: initialData?.id && Number(initialData.id) > 0 ? Number(initialData.id) : undefined,
        subject: finalSubject,
        sub_domain: finalSubDomain || null,
        grade: grade,
        target_groups: targetGroups.trim() || 'Tous',
        title: finalTitle,
        description: description.trim() || null,
        url: url.trim() || null,
        exercise_number: exerciseNumber.trim() || null,
        cartridge_color: cartridgeColor,
        is_optional: isOptional,
        position_rule: positionRule as any,
        recurrence: recurrence,
        date_echeance: dateEcheance,
        date_due: dateEcheance,
        date_assigned: currentDate,
        teacher_id: 'JulieCB',
        is_custom: true,
      };

      await api.addCustomHomework(payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving custom homework:', err);
      setErrorMsg(err.message || 'Erreur lors de l’enregistrement du devoir personnalisé.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-lg text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {initialData?.id ? 'Modifier le Devoir Personnalisé' : 'Nouveau Devoir Personnalisé'}
              </h2>
              <p className="text-xs text-slate-400">
                Enregistrement direct dans la table SQL <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300 font-mono">custom_homework</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Grade & Date d'échéance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Niveau / Grade *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {gradeChoices.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      grade === g
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Date d'échéance *
              </label>
              <input
                type="date"
                required
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Matière & Sous-domaine */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Matière *</label>
                <button
                  type="button"
                  onClick={() => setIsCustomSubject(!isCustomSubject)}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  {isCustomSubject ? 'Choisir dans la liste' : '+ Saisir autre'}
                </button>
              </div>
              {isCustomSubject ? (
                <input
                  type="text"
                  required
                  placeholder="ex: Enseignement Moral et Civique"
                  value={customSubjectInput}
                  onChange={(e) => setCustomSubjectInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              ) : (
                <select
                  value={subject}
                  onChange={(e) => {
                    if (e.target.value === 'CUSTOM_NEW') {
                      setIsCustomSubject(true);
                    } else {
                      setSubject(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {displayedMatieres.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="CUSTOM_NEW">+ Nouvelle matière...</option>
                </select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Sous-domaine</label>
                <button
                  type="button"
                  onClick={() => setIsCustomSubDomain(!isCustomSubDomain)}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  {isCustomSubDomain ? 'Choisir dans la liste' : '+ Saisir autre'}
                </button>
              </div>
              {isCustomSubDomain ? (
                <input
                  type="text"
                  placeholder="ex: Calcul mental"
                  value={customSubDomainInput}
                  onChange={(e) => setCustomSubDomainInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              ) : (
                <select
                  value={subDomain}
                  onChange={(e) => {
                    if (e.target.value === 'CUSTOM_NEW') {
                      setIsCustomSubDomain(true);
                    } else {
                      setSubDomain(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Aucun sous-domaine --</option>
                  {displayedSubDomains.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="CUSTOM_NEW">+ Nouveau sous-domaine...</option>
                </select>
              )}
            </div>
          </div>

          {/* Row 3: Titre & Numéro d'exercice */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Titre du devoir / Chapitre *
              </label>
              <input
                type="text"
                required
                placeholder="ex: La division à deux chiffres / Fiche de lecture n°3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                N° Exercice / Page
              </label>
              <input
                type="text"
                placeholder="ex: n° 4 p. 52"
                value={exerciseNumber}
                onChange={(e) => setExerciseNumber(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description / Consigne */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Description & Consignes
            </label>
            <textarea
              rows={3}
              placeholder="ex: Apprendre la leçon dans le cahier rouge, puis effectuer l'exercice n°4 dans le cahier du soir..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Row 4: Lien URL & Ciblage des groupes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Link className="w-3.5 h-3.5 text-slate-500" />
                <span>Lien URL (Ressource / Fichier)</span>
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Ciblage des groupes d'élèves</span>
              </label>
              <select
                value={targetGroups}
                onChange={(e) => setTargetGroups(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Tous">Tous les élèves (Classe entière)</option>
                {targetGroupsOptions.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Position Rule & Recurrence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Règle de positionnement dans la colonne</span>
              </label>
              <select
                value={positionRule}
                onChange={(e) => setPositionRule(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="bottom">Tout en bas (par défaut)</option>
                <option value="top">Tout en haut</option>
                <option value="after_lecon">Après la Leçon</option>
                <option value="after_modelage">Après le Modelage</option>
                <option value="after_entrainement">Après les Entraînements</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Récurrence</span>
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="none">Unique (sans récurrence)</option>
                <option value="daily">Chaque jour utile</option>
                <option value="weekly">Chaque semaine (même jour)</option>
                <option value="monthly">Chaque mois (même date)</option>
              </select>
            </div>
          </div>

          {/* Row 6: Color Selector & Optional Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                <span>Couleur du cartouche</span>
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setCartridgeColor('standard')}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                    cartridgeColor === 'standard'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Standard
                </button>
                {CUSTOM_COLOR_LABELS.map((c) => {
                  const isSelected = cartridgeColor === c.name || cartridgeColor === c.hex;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => setCartridgeColor(c.name)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                        isSelected ? 'border-slate-900 ring-2 ring-indigo-500 scale-110' : 'border-white shadow-sm'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Caractère facultatif
              </label>
              <button
                type="button"
                onClick={() => setIsOptional(!isOptional)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isOptional
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOptional ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-xs font-bold">
                    {isOptional ? 'Devoir FACULTATIF' : 'Devoir OBLIGATOIRE'}
                  </span>
                </div>
                <span className="text-[11px] underline font-semibold">
                  {isOptional ? 'Basculer en Obligatoire' : 'Basculer en Facultatif'}
                </span>
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Enregistrement...' : (initialData?.id ? 'Enregistrer les modifications' : 'Ajouter le devoir')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
