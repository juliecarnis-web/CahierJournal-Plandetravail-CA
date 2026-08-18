/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CreneauType = 'matin' | 'aprem' | 'todo' | 'notes';
export type GradeLevel = string;
export type ActivityType =
  | 'Évaluation'
  | 'Leçon'
  | 'Modelage'
  | 'Tâche complexe'
  | 'Entraînement'
  | 'Révision'
  | 'Note'
  | 'Autre';

export interface PeriodConfig {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  working_days: number[]; // [1, 2, 4, 5]
}

export interface ChronologicalProgression {
  id: number;
  ordre_sequence: number;
  competence_code: string;
  grade: GradeLevel;
  url: string;
  titre_chapitre: string;
  teacher_id: string;
  creneau: CreneauType;
  // Enriched fields from Competence table
  intitule?: string;
  prefixe?: string;
  domaine?: string;
}

export interface ManualAdjustment {
  id: number;
  date: string; // YYYY-MM-DD
  creneau: CreneauType;
  grade: GradeLevel;
  titre: string;
  titre_chapitre?: string;
  time_slot_id?: string;
  description: string;
  type_activite: ActivityType;
  ordre: number;
  fait: boolean;
  reporter_au_lendemain: boolean;
  teacher_id: string;
  competence_code?: string;
  url?: string;
  is_custom: boolean;
  original_date?: string;
  progression_id?: number;
  day_of_life?: number;
  matiere?: string;
  domaine?: string;
  pastel_color?: string;
  recurrence?: string;
  numero_exercice?: string;
  date_ajustement?: string;
  date_fin?: string | null;
  report_j1?: boolean;
  order_index?: number;
  color_label?: string;
  position_anchor?: string;
  position_overrides?: Record<string, any> | string;
  action_type?: string;
  is_blank?: boolean;
}

export interface HomeworkAdjustment {
  id: number;
  date_due: string; // YYYY-MM-DD
  date_echeance?: string; // YYYY-MM-DD
  date_assigned: string; // YYYY-MM-DD
  grade: GradeLevel;
  subject: string; // Mathématiques, Français, Histoire, Sciences, or Competence Code...
  sub_domain?: string | null;
  target_groups?: string | null;
  title?: string;
  description: string; // Free text additions & teacher manual modifications
  titre_chapitre?: string; // Unique and non-modifiable title of competence/chapter
  modified_text?: string;
  modified_url?: string;
  competence_code?: string;
  source_task_id?: string;
  url?: string;
  exercise_number?: string | null;
  cartridge_color?: string;
  is_optional?: boolean;
  position_rule?: 'top' | 'after_lecon' | 'after_modelage' | 'after_entrainement' | 'bottom' | string;
  recurrence?: string;
  day_of_life?: number;
  teacher_id: string;
  done: boolean;
  difficulty_level: 'standard' | 'soutien' | 'approfondissement';
  is_auto?: boolean;
  is_hidden?: boolean;
  is_custom?: boolean;
  priority_status?: 'prioritaire' | 'facultatif' | string;
}

export interface CustomHomework {
  id: number;
  subject: string;
  sub_domain?: string | null;
  grade: GradeLevel;
  target_groups?: string | null;
  title: string;
  description?: string | null;
  url?: string | null;
  exercise_number?: string | null;
  cartridge_color?: string;
  is_optional: boolean;
  position_rule?: 'top' | 'after_lecon' | 'after_modelage' | 'after_entrainement' | 'bottom' | string;
  recurrence?: string;
  date_echeance: string; // YYYY-MM-DD
  date_assigned?: string;
  date_due?: string;
  teacher_id?: string;
  created_at?: string;
  is_custom?: boolean;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  grade: GradeLevel;
  group_level: 'standard' | 'soutien' | 'approfondissement';
  teacher_id: string;
}

export interface CustomTask {
  id: number;
  teacher_id: string;
  task_text: string;
  completed: boolean;
  created_at?: string;
}

export interface Competence {
  code: string;
  domaine: string;
  intitule: string;
  cycle: string;
  prefixe: string;
}

export interface VacationRange {
  id?: string | number;
  name: string; // 'Toussaint' | 'Noël' | 'Hiver' | 'Printemps' | string
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface DelayEvent {
  id?: string;
  date: string; // YYYY-MM-DD
  creneau: 'matin' | 'aprem';
  amount: number; // +1 or -1
}

export interface UserSettings {
  id?: number;
  teacher_id: string;
  working_days: number[]; // e.g. [1, 2, 4, 5] (Monday, Tuesday, Thursday, Friday)
  holidays: (string | VacationRange)[]; // array of ISO dates or VacationRange objects
  vacations?: VacationRange[];
  delay_morning?: number; // Compteur de retard Matin
  delay_afternoon?: number; // Compteur de retard Après-midi
  delay_events?: DelayEvent[]; // Journal horodaté des événements de retard
  absences_count: number; // Compteur de retard dynamique (e.g. 0, 1, 2...)
  school_year_start: string; // YYYY-MM-DD e.g. "2025-09-01"
  default_grades: GradeLevel[];
  active_grades?: GradeLevel[]; // Grades actifs pour l'année en cours
  afternoon_wave_schedule: {
    open_days: number; // how many working days in a wave (default 2)
    pause_days: number; // how many pause days after a wave (default 2)
  };
  periods?: PeriodConfig[];
  evaluation_url?: string;
  password_hash?: string;
  show_report_not_done?: boolean; // Option pour afficher "report non fait"
  auto_reschedule_enabled?: boolean; // Option pour activer le report automatique
}

export interface DifferentiationEvalData {
  need_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
  success_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
}

export interface DifferentiationEntData {
  cohort_average: number;
  ent_optional: boolean;
}

export interface ActivityCardItem {
  id: string; // unique ID for React key
  source: 'progression' | 'manual';
  creneau: CreneauType;
  grade: GradeLevel;
  type_activite: ActivityType;
  titre: string;
  description?: string;
  competence_code: string;
  competence_prefixe?: string;
  competence_intitule?: string;
  titre_chapitre: string;
  url?: string;
  day_of_life?: number;
  fait: boolean;
  reporter_au_lendemain: boolean;
  db_id?: number; // DB ID in manual_adjustments if persisted
  progression_id?: number;
  matiere?: string;
  domaine?: string;
  pastel_color?: string;
  recurrence?: string;
  is_todo?: boolean;
  is_reported?: boolean;
  en_retard?: boolean;
  original_date?: string;
  ev_number?: number;
  entrainement_num?: number;
  entrainement_group?: 'Codage (x4)' | 'Mémorisation (x2)' | 'Mémorisation / Automatisation (x2)' | 'Remémoration (x1)';
  numero_exercice?: string;
  is_custom?: boolean;
  color_label?: string;
  position_anchor?: string;
  date?: string;
  date_ajustement?: string;
  date_fin?: string | null;
  report_j1?: boolean;
  order_index?: number;
  ordre?: number;
  differentiation_eval?: DifferentiationEvalData;
  differentiation_ent?: DifferentiationEntData;
}

export interface SpiralTimelineStep {
  day_of_life: number;
  type_activite: ActivityType | null;
  label: string;
  colorClass: string;
  badgeColor: string;
}

export interface DailyCahierJournal {
  date: string;
  jour_utile_index: number; // e.g. 14 (Jour utile #14)
  retard_count: number; // from absences_count
  delay_morning?: number;
  delay_afternoon?: number;
  is_working_day: boolean;
  holiday_reason?: string;
  available_grades?: GradeLevel[];
  active_grades?: GradeLevel[];
  matin: ActivityCardItem[];
  aprem: ActivityCardItem[];
  todos?: ActivityCardItem[];
}

export interface DatabaseStatus {
  connected: boolean;
  type: 'neon-postgres' | 'simulation-memory';
  databaseUrlConfigured: boolean;
  tablesCount: number;
  message: string;
}

/**
 * Utility to determine if an activity should display the "EN RETARD" badge.
 * Must only be true if:
 * 1. The activity is NOT completed (!card.fait).
 * 2. Recurrent activities are NOT marked late based on initial creation date comparison.
 * 3. Non-recurrent activities have been explicitly reported or postponed past their date without completion.
 */
export function isActivityEnRetard(card: ActivityCardItem, journalDate?: string): boolean {
  if (card.fait) return false;

  const isRecurrent = Boolean(card.recurrence && card.recurrence !== 'aucune');

  if (isRecurrent) {
    return Boolean(card.en_retard || card.is_reported);
  }

  if (card.en_retard || card.is_reported) return true;

  const refDate = journalDate || card.date_ajustement;
  if (!refDate) return false;

  if (card.original_date && card.original_date < refDate) return true;
  if (card.date_ajustement && card.date && card.date_ajustement > card.date) return true;
  if (card.report_j1 && card.date && card.date < refDate) return true;
  if (card.is_custom && card.reporter_au_lendemain && card.date && card.date < refDate) return true;

  return false;
}
