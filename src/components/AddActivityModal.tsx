/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Sun, Moon, Link as LinkIcon, Palette, Repeat, BookOpen, Tag, FileText, Check, Info, Calendar, RotateCcw } from 'lucide-react';
import { ActivityType, CreneauType, GradeLevel, ManualAdjustment, ActivityCardItem } from '../types.js';
import { api } from '../services/api.js';
import { CUSTOM_COLOR_LABELS } from '../lib/colorLabels.js';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCreneau: CreneauType;
  currentDate: string;
  onAddActivity: (adj: Partial<ManualAdjustment>) => Promise<void>;
  availableGrades?: GradeLevel[];
  initialActivity?: ActivityCardItem | null;
}

export const PASTEL_COLORS = [
  { id: 'pink', label: 'Rose Doux', hex: '#fce7f3', border: '#f472b6' },
  { id: 'sky', label: 'Bleu Ciel', hex: '#e0f2fe', border: '#38bdf8' },
  { id: 'mint', label: 'Menthe', hex: '#dcfce7', border: '#4ade80' },
  { id: 'lavender', label: 'Lavande', hex: '#f3e8ff', border: '#c084fc' },
  { id: 'peach', label: 'Pêche', hex: '#ffedd5', border: '#fb923c' },
  { id: 'yellow', label: 'Jaune Paille', hex: '#fef9c3', border: '#facc15' },
  { id: 'teal', label: 'Turquoise', hex: '#ccfbf1', border: '#2dd4bf' },
];

export const PRESET_TAGS = ['Soutien', 'Évaluation', 'Autonomie', 'Atelier', 'Devoirs'];

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  defaultCreneau,
  currentDate,
  onAddActivity,
  availableGrades = [],
  initialActivity = null,
}) => {
  const isSpiralEdit = Boolean(
    initialActivity && (
      initialActivity.progression_id ||
      (initialActivity.source === 'progression' && !initialActivity.is_custom)
    )
  );

  const [startDate, setStartDate] = useState(currentDate);
  const [dateFin, setDateFin] = useState('');
  const [dateAjustement, setDateAjustement] = useState(currentDate);
  const [creneau, setCreneau] = useState<CreneauType>(defaultCreneau);
  const [typeActivite, setTypeActivite] = useState<ActivityType>('Entraînement');
  const [grade, setGrade] = useState<GradeLevel>('Tous');
  const [matiere, setMatiere] = useState('');
  const [domaine, setDomaine] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [numeroExercice, setNumeroExercice] = useState('');
  const [competenceCode, setCompetenceCode] = useState('');
  const [url, setUrl] = useState('');
  const [pastelColor, setPastelColor] = useState('');
  const [colorLabel, setColorLabel] = useState('');
  const [positionAnchor, setPositionAnchor] = useState('');
  const [recurrence, setRecurrence] = useState('aucune');
  const [reporterAuLendemain, setReporterAuLendemain] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic dropdown options fetched from database
  const [options, setOptions] = useState<{
    matieres: string[];
    domaines: string[];
    types: string[];
    competences: string[];
  }>({
    matieres: [],
    domaines: [],
    types: [],
    competences: [],
  });

  useEffect(() => {
    if (isOpen) {
      api.getManualAdjustmentOptions().then(setOptions).catch(console.error);

      if (initialActivity) {
        setStartDate(initialActivity.date || initialActivity.original_date || currentDate);
        setDateFin(initialActivity.date_fin || '');
        setDateAjustement(initialActivity.date_ajustement || currentDate);
        setCreneau(initialActivity.creneau || defaultCreneau);
        setTypeActivite(initialActivity.type_activite || '');
        setGrade(initialActivity.grade || 'Tous');
        setTitre(initialActivity.titre || initialActivity.titre_chapitre || '');
        setDescription(initialActivity.description || '');
        setNumeroExercice(initialActivity.numero_exercice || '');
        setCompetenceCode(initialActivity.competence_code || '');
        setUrl(initialActivity.url || '');
        setMatiere(initialActivity.matiere || '');
        setDomaine(initialActivity.domaine || '');
        setPastelColor(initialActivity.pastel_color || '');
        setColorLabel(initialActivity.color_label || '');
        setPositionAnchor(initialActivity.position_anchor || '');
        setRecurrence(initialActivity.recurrence || 'aucune');
        setReporterAuLendemain(initialActivity.reporter_au_lendemain ?? true);
      } else {
        setStartDate(currentDate);
        setDateFin('');
        setDateAjustement(currentDate);
        setCreneau(defaultCreneau);
        setTypeActivite('');
        setGrade(availableGrades.length > 0 ? availableGrades[0] : 'Tous');
        setTitre('');
        setDescription('');
        setNumeroExercice('');
        setCompetenceCode('');
        setUrl('');
        setMatiere('');
        setDomaine('');
        setPastelColor('');
        setColorLabel('');
        setPositionAnchor('');
        setRecurrence('aucune');
        setReporterAuLendemain(true);
      }
    }
  }, [isOpen, initialActivity, currentDate, defaultCreneau, availableGrades]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSpiralEdit && !titre.trim()) return;

    setIsSubmitting(true);
    try {
      if (isSpiralEdit) {
        // Surcharge d'un cartouche spiralaire existant (manual_adjustments)
        await onAddActivity({
          id: initialActivity?.db_id,
          progression_id: initialActivity?.progression_id,
          date: dateAjustement,
          date_ajustement: dateAjustement,
          creneau,
          time_slot_id: creneau,
          grade: initialActivity?.grade || grade,
          teacher_id: 'JulieCB',
          description: description.trim() || undefined,
          url: url.trim() || undefined,
          numero_exercice: numeroExercice.trim() || undefined,
          color_label: colorLabel.trim() || undefined,
          reporter_au_lendemain: reporterAuLendemain,
          report_j1: reporterAuLendemain,
          is_custom: false,
        });
      } else {
        // Création ou modification d'une activité manuelle pure (custom_activities)
        const customPayload: any = {
          id: initialActivity?.db_id,
          date: startDate,
          date_fin: dateFin.trim() ? dateFin.trim() : null,
          original_date: initialActivity?.original_date || startDate,
          date_ajustement: initialActivity?.date_ajustement || startDate,
          recurrence,
          creneau,
          time_slot_id: creneau,
          grade,
          teacher_id: 'JulieCB',
          type_activite: typeActivite,
          matiere: matiere.trim() || undefined,
          domaine: domaine.trim() || undefined,
          titre: titre.trim(),
          titre_chapitre: titre.trim(),
          description: description.trim() || undefined,
          numero_exercice: numeroExercice.trim() || undefined,
          competence_code: competenceCode.trim() || undefined,
          url: url.trim() || undefined,
          pastel_color: pastelColor || undefined,
          color_label: colorLabel.trim() || undefined,
          position_anchor: positionAnchor || undefined,
          reporter_au_lendemain: reporterAuLendemain,
          report_j1: reporterAuLendemain,
          is_custom: true,
        };
        await onAddActivity(customPayload);
      }
      try {
        window.dispatchEvent(new Event('journal-updated'));
        localStorage.setItem('journal_last_update', Date.now().toString());
      } catch (e) {
        // ignore
      }
      onClose();
    } catch (err: any) {
      console.error('[AddActivityModal] Erreur de soumission:', err);
      alert(`Erreur d'enregistrement : ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>
                {isSpiralEdit
                  ? 'Surcharger le cartouche spiralaire'
                  : initialActivity
                  ? 'Modifier l’activité manuelle'
                  : 'Ajouter une Activité Manuelle'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isSpiralEdit
                ? 'Complément ou ajustement sur la séquence du jour'
                : `Création indépendante dans le cahier journal (${dateAjustement})`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Read-Only Info Box for Spiral Adjustments */}
          {isSpiralEdit && initialActivity && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-1">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Activité Spiralaire d'Origine (Non modifiable ici)</span>
              </div>
              <div className="text-xs text-indigo-950 font-semibold grid grid-cols-2 gap-2 bg-white/70 p-2.5 rounded-lg border border-indigo-100">
                <div>
                  <span className="text-[10px] text-indigo-500 uppercase font-bold block">Matière / Domaine</span>
                  <span>{initialActivity.matiere || 'Progression'} {initialActivity.domaine ? `• ${initialActivity.domaine}` : ''}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-500 uppercase font-bold block">Niveau & Code</span>
                  <span>{initialActivity.grade || 'Tous'} ({initialActivity.competence_code || 'SPIRALE'})</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-indigo-500 uppercase font-bold block">Titre / Séquence</span>
                  <span className="font-bold">{initialActivity.titre_chapitre || initialActivity.titre}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dates & Récurrence */}
          {!isSpiralEdit ? (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Programmation & Récurrence</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>Date de fin</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Optionnelle)</span>
                  </label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Non définie"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Règle de Récurrence</span>
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="aucune">Aucune récurrence (Activité ponctuelle)</option>
                  <option value="tous_les_jours">Tous les jours (Lundi-Vendredi)</option>
                  <option value="toutes les semaines">Toutes les semaines</option>
                  <option value="toutes les deux semaines">Toutes les 2 semaines</option>
                  <option value="une fois par mois">Une fois par mois</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 italic">
                  Si une date de fin est renseignée, l'activité récurrente s'arrêtera à cette date incluse.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Date de l'activité
              </label>
              <input
                type="date"
                value={dateAjustement}
                onChange={(e) => setDateAjustement(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              />
            </div>
          )}

          {/* Créneau */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Créneau horaire
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreneau('matin')}
                className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                  creneau === 'matin'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sun className="w-4 h-4 text-blue-600" />
                <span>Matin (Domino continu)</span>
              </button>
              <button
                type="button"
                onClick={() => setCreneau('aprem')}
                className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                  creneau === 'aprem'
                    ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Moon className="w-4 h-4 text-purple-600" />
                <span>Après-midi (Vagues)</span>
              </button>
            </div>
          </div>

          {/* Pure Custom Activity Specific Fields */}
          {!isSpiralEdit && (
            <>
              {/* Grade & Type Activité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Niveau concerné (Grade)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as GradeLevel)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="Tous">Tous Niveaux</option>
                    {(availableGrades.length > 0 ? availableGrades : ['CE1', 'CE2', 'CM1', 'CM2']).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Type d'Activité
                  </label>
                  <input
                    type="text"
                    list="types-list"
                    placeholder="ex: Leçon, Entraînement..."
                    value={typeActivite}
                    onChange={(e) => setTypeActivite(e.target.value as ActivityType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                  <datalist id="types-list">
                    {options.types.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Ancrage / Verrouillage Positionnel */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Ancrage / Emplacement de l'activité</span>
                  <span className="text-[10px] text-indigo-600 font-medium">Verrouille la position relative</span>
                </label>
                <select
                  value={positionAnchor}
                  onChange={(e) => setPositionAnchor(e.target.value)}
                  className="w-full p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Au fil du flux (Ordre logique par défaut)</option>
                  <option value="top">📌 Tout en haut (Au début du créneau)</option>
                  <option value="after_evaluation">📌 Après l'évaluation</option>
                  <option value="after_modelage">📌 Après le modelage</option>
                  <option value="after_lecon">📌 Après la leçon</option>
                  <option value="after_tache_complexe">📌 Après la tâche complexe</option>
                  <option value="after_entrainement">📌 Après l'entraînement</option>
                  <option value="bottom">📌 Tout en bas (À la fin du créneau)</option>
                </select>
              </div>

              {/* Matière & Domaine */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Matière
                  </label>
                  <input
                    type="text"
                    list="matieres-list"
                    placeholder="ex: Mathématiques"
                    value={matiere}
                    onChange={(e) => setMatiere(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium"
                  />
                  <datalist id="matieres-list">
                    {options.matieres.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Domaine
                  </label>
                  <input
                    type="text"
                    list="domaines-list"
                    placeholder="ex: Calcul mental"
                    value={domaine}
                    onChange={(e) => setDomaine(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium"
                  />
                  <datalist id="domaines-list">
                    {options.domaines.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Titre */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Titre / Chapitre de l'Activité *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: La soustraction posée avec retenue"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-bold"
                />
              </div>
            </>
          )}

          {/* Numéro d'exercice */}
          <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl">
            <label className="text-xs font-bold text-indigo-900 block mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Numéro(s) d'exercice(s) / Références</span>
            </label>
            <input
              type="text"
              placeholder="ex: 32 p.124 ou 43 rouge"
              value={numeroExercice}
              onChange={(e) => setNumeroExercice(e.target.value)}
              className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 placeholder-slate-700 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Description / Consignes / Modificatif</span>
            </label>
            <textarea
              rows={2}
              placeholder={isSpiralEdit ? "Consignes ajustées ou remarques pour cette séance..." : "Détails du déroulé, travail individuel ou en groupes..."}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          {/* URL support de cours */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Lien URL / Support de cours</span>
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          {/* Option de report automatique de la carte */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="reporterAuLendemain"
              checked={reporterAuLendemain}
              onChange={(e) => setReporterAuLendemain(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="reporterAuLendemain" className="text-xs text-amber-950 font-medium leading-tight cursor-pointer select-none">
              <span className="font-bold text-amber-900 block mb-0.5 flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Autoriser le report automatique de cette activité</span>
              </span>
              Si décoché, cette activité restera fixée à ce jour précis et ne sera jamais décalée au jour suivant (rituel non décalable), même si elle n'est pas cochée comme faite.
            </label>
          </div>

          {/* Color Label / Swatches for Cartouche Color */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-600" />
              <span>Couleur de l'activité (Numéro & Cartouche)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Reset / Standard button */}
              <button
                type="button"
                onClick={() => {
                  setColorLabel('');
                  setPastelColor('');
                }}
                className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border transition-all cursor-pointer ${
                  !colorLabel && !pastelColor
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title="Couleur standard"
              >
                Standard
              </button>

              {/* Pure Color Swatches (No text explicatif) */}
              {CUSTOM_COLOR_LABELS.map((cOption) => {
                const isSelected = colorLabel.toLowerCase().trim() === cOption.name.toLowerCase().trim();
                return (
                  <button
                    key={cOption.name}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setColorLabel('');
                        setPastelColor('');
                      } else {
                        setColorLabel(cOption.name);
                        if (cOption.pastelHex) {
                          setPastelColor(cOption.pastelHex);
                        }
                      }
                    }}
                    style={{
                      backgroundColor: cOption.hex,
                      borderColor: cOption.borderHex,
                    }}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    }`}
                    title={cOption.name}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Enregistrement...'
                  : isSpiralEdit
                  ? 'Enregistrer la surcharge'
                  : initialActivity
                  ? 'Enregistrer les modifications'
                  : 'Ajouter au Cahier'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
