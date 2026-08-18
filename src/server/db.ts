/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';
import dotenv from 'dotenv';
import {
  ChronologicalProgression,
  ManualAdjustment,
  HomeworkAdjustment,
  Student,
  CustomTask,
  Competence,
  UserSettings,
  DelayEvent,
  DatabaseStatus,
  CreneauType,
  GradeLevel,
  ActivityType,
  ActivityCardItem,
  CustomHomework,
} from '../types.js';
import {
  calculateUsefulDayIndex,
  computeSequenceDayOfLife,
  getMorningTimelineStep,
  getAfternoonTimelineStep,
  getNextWorkingDateStr,
} from './spiralEngine.js';

dotenv.config();

const { Pool } = pg;

// Check if a Neon PostgreSQL connection string is configured
const connectionString =
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';

let pool: pg.Pool | null = null;
let isPostgresConnected = false;
let dbStatusMessage = 'Initialisation...';

if (connectionString && connectionString.trim().length > 0) {
  try {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    });
    // Test connection asynchronously
    pool
      .query('SELECT 1')
      .then(() => {
        isPostgresConnected = true;
        dbStatusMessage = 'Connecté à PostgreSQL Neon en production';
        console.log('✅ Connecté avec succès à PostgreSQL (Neon)');
        initializePostgresTables();
      })
      .catch((err) => {
        console.warn(
          '⚠️ Connexion PostgreSQL Neon échouée, bascule en mode simulation in-memory:',
          err.message
        );
        isPostgresConnected = false;
        dbStatusMessage = `Mode simulation (Connexion Neon échouée: ${err.message})`;
      });
  } catch (err: any) {
    console.warn(
      '⚠️ Erreur de configuration PostgreSQL, bascule en mode simulation:',
      err.message
    );
    isPostgresConnected = false;
    dbStatusMessage = 'Mode simulation active (DATABASE_URL non configuré)';
  }
} else {
  dbStatusMessage =
    'Mode simulation actif (Ajoutez DATABASE_URL dans les secrets AI Studio pour connecter Neon)';
}

// ==========================================
// IN-MEMORY / SIMULATION FALLBACK STORAGE
// ==========================================

let simCompetences: Competence[] = [
  {
    code: 'M-NUM-01',
    domaine: 'Mathématiques',
    prefixe: 'NUM',
    intitule: 'Les grands nombres jusqu’au milliard (lecture, écriture, comparaison)',
    cycle: 'Cycle 3',
  },
  {
    code: 'M-NUM-02',
    domaine: 'Mathématiques',
    prefixe: 'NUM',
    intitule: 'Fractions simples et encadrement entre deux entiers',
    cycle: 'Cycle 3',
  },
  {
    code: 'M-CAL-01',
    domaine: 'Mathématiques',
    prefixe: 'CAL',
    intitule: 'Division euclidienne à un et deux chiffres',
    cycle: 'Cycle 3',
  },
  {
    code: 'M-GEOM-01',
    domaine: 'Mathématiques',
    prefixe: 'GEOM',
    intitule: 'Reconnaitre et tracer des hauteurs dans un triangle',
    cycle: 'Cycle 3',
  },
  {
    code: 'F-GRAM-01',
    domaine: 'Français',
    prefixe: 'GRAM',
    intitule: 'L’accord sujet-verbe dans les cas complexes (sujet inversé, collectif)',
    cycle: 'Cycle 3',
  },
  {
    code: 'F-GRAM-02',
    domaine: 'Français',
    prefixe: 'GRAM',
    intitule: 'Identification et rôle des compléments circonstanciels de temps et de lieu',
    cycle: 'Cycle 3',
  },
  {
    code: 'F-CONJ-01',
    domaine: 'Français',
    prefixe: 'CONJ',
    intitule: 'Le passé composé des verbes des 1er et 2e groupes avec avoir et être',
    cycle: 'Cycle 3',
  },
  {
    code: 'H-HIST-01',
    domaine: 'Histoire',
    prefixe: 'HIST',
    intitule: 'Le temps des rois : Louis XIV et la monarchie absolue à Versailles',
    cycle: 'Cycle 3',
  },
  {
    code: 'S-SCI-01',
    domaine: 'Sciences',
    prefixe: 'SCI',
    intitule: 'Les chaînes alimentaires et la biodiversité dans l’écosystème forestier',
    cycle: 'Cycle 3',
  },
];

let simMatin: ChronologicalProgression[] = [
  {
    id: 1,
    ordre_sequence: 1,
    competence_code: 'M-NUM-01',
    grade: 'CE1',
    url: 'https://www.lumni.fr/video/lire-et-ecrire-les-nombres-jusqu-a-100',
    titre_chapitre: 'Chapitre 1 : Numération - Les nombres jusqu’à 100',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Les nombres jusqu’à 100 (lecture, écriture, unités et dizaines)',
    prefixe: 'NUM',
    domaine: 'Mathématiques',
  },
  {
    id: 2,
    ordre_sequence: 1,
    competence_code: 'M-NUM-01',
    grade: 'CE2',
    url: 'https://www.lumni.fr/video/lire-et-ecrire-les-nombres-jusqu-a-1000',
    titre_chapitre: 'Chapitre 1 : Numération - Les nombres jusqu’à 1 000',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Les nombres jusqu’à 1 000 (lecture, écriture, centaines)',
    prefixe: 'NUM',
    domaine: 'Mathématiques',
  },
  {
    id: 3,
    ordre_sequence: 1,
    competence_code: 'M-NUM-01',
    grade: 'CM1',
    url: 'https://www.lumni.fr/video/lire-et-ecrire-les-grands-nombres',
    titre_chapitre: 'Chapitre 1 : Numération - Les grands nombres',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Les grands nombres jusqu’au milliard (lecture, écriture, comparaison)',
    prefixe: 'NUM',
    domaine: 'Mathématiques',
  },
  {
    id: 4,
    ordre_sequence: 1,
    competence_code: 'M-NUM-02',
    grade: 'CM2',
    url: 'https://www.lumni.fr/video/fractions-simples-sur-une-droite-graduee',
    titre_chapitre: 'Chapitre 1 : Fractions et décimaux',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Fractions simples et encadrement entre deux entiers',
    prefixe: 'NUM',
    domaine: 'Mathématiques',
  },
  {
    id: 5,
    ordre_sequence: 2,
    competence_code: 'F-GRAM-01',
    grade: 'CE1',
    url: 'https://www.lumni.fr/video/reconnaitre-le-verbe-et-son-sujet',
    titre_chapitre: 'Chapitre 1 : Grammaire - Le sujet et le verbe',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Identification du verbe et du sujet dans la phrase simple',
    prefixe: 'GRAM',
    domaine: 'Français',
  },
  {
    id: 6,
    ordre_sequence: 2,
    competence_code: 'F-GRAM-01',
    grade: 'CE2',
    url: 'https://www.lumni.fr/video/l-accord-sujet-verbe',
    titre_chapitre: 'Chapitre 1 : Grammaire - L’accord sujet-verbe',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'L’accord sujet-verbe au présent de l’indicatif',
    prefixe: 'GRAM',
    domaine: 'Français',
  },
  {
    id: 7,
    ordre_sequence: 2,
    competence_code: 'F-GRAM-01',
    grade: 'CM1',
    url: 'https://www.lumni.fr/video/l-accord-sujet-verbe-cas-particuliers',
    titre_chapitre: 'Chapitre 1 : Grammaire - L’accord sujet-verbe complexe',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'L’accord sujet-verbe dans les cas complexes (sujet inversé, collectif)',
    prefixe: 'GRAM',
    domaine: 'Français',
  },
  {
    id: 8,
    ordre_sequence: 2,
    competence_code: 'F-CONJ-01',
    grade: 'CM2',
    url: 'https://www.lumni.fr/video/le-passe-compose-avec-etre-et-avoir',
    titre_chapitre: 'Chapitre 2 : Conjugaison - Le passé composé',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Le passé composé des verbes des 1er et 2e groupes avec avoir et être',
    prefixe: 'CONJ',
    domaine: 'Français',
  },
  {
    id: 9,
    ordre_sequence: 3,
    competence_code: 'M-CAL-01',
    grade: 'CM2',
    url: 'https://www.lumni.fr/video/la-division-euclidienne',
    titre_chapitre: 'Chapitre 2 : Calcul - La division euclidienne à 2 chiffres',
    teacher_id: 'JulieCB',
    creneau: 'matin',
    intitule: 'Division euclidienne à un et deux chiffres',
    prefixe: 'CAL',
    domaine: 'Mathématiques',
  },
];

let simAprem: ChronologicalProgression[] = [
  {
    id: 101,
    ordre_sequence: 1,
    competence_code: 'S-SCI-01',
    grade: 'CE1',
    url: 'https://www.lumni.fr/video/les-etats-de-l-eau',
    titre_chapitre: 'Découverte du monde : Les états de l’eau',
    teacher_id: 'JulieCB',
    creneau: 'aprem',
    intitule: 'L’eau liquide et la glace dans la nature',
    prefixe: 'SCI',
    domaine: 'Sciences',
  },
  {
    id: 102,
    ordre_sequence: 1,
    competence_code: 'S-SCI-01',
    grade: 'CE2',
    url: 'https://www.lumni.fr/video/le-cycle-de-l-eau',
    titre_chapitre: 'Sciences : Le cycle de l’eau',
    teacher_id: 'JulieCB',
    creneau: 'aprem',
    intitule: 'Comprendre les étapes du cycle naturel de l’eau',
    prefixe: 'SCI',
    domaine: 'Sciences',
  },
  {
    id: 103,
    ordre_sequence: 1,
    competence_code: 'H-HIST-01',
    grade: 'CM1',
    url: 'https://www.lumni.fr/video/louis-xiv-le-roi-soleil-et-versailles',
    titre_chapitre: 'Histoire : Louis XIV et la monarchie absolue',
    teacher_id: 'JulieCB',
    creneau: 'aprem',
    intitule: 'Le temps des rois : Louis XIV et la monarchie absolue à Versailles',
    prefixe: 'HIST',
    domaine: 'Histoire',
  },
  {
    id: 104,
    ordre_sequence: 1,
    competence_code: 'S-SCI-01',
    grade: 'CM2',
    url: 'https://www.lumni.fr/video/chaine-alimentaire-et-biodiversite',
    titre_chapitre: 'Sciences : Écosystème et chaînes alimentaires',
    teacher_id: 'JulieCB',
    creneau: 'aprem',
    intitule: 'Les chaînes alimentaires et la biodiversité dans l’écosystème forestier',
    prefixe: 'SCI',
    domaine: 'Sciences',
  },
  {
    id: 105,
    ordre_sequence: 2,
    competence_code: 'M-GEOM-01',
    grade: 'CM1',
    url: 'https://www.lumni.fr/video/tracer-une-hauteur-dans-un-triangle',
    titre_chapitre: 'Géométrie : Hauteurs d’un triangle',
    teacher_id: 'JulieCB',
    creneau: 'aprem',
    intitule: 'Reconnaitre et tracer des hauteurs dans un triangle',
    prefixe: 'GEOM',
    domaine: 'Mathématiques',
  },
  {
    id: 106,
    ordre_sequence: 4,
    competence_code: 'F-GRAM-02',
    grade: 'CM2',
    url: 'https://www.lumni.fr/video/reconnaitre-les-complements-circonstanciels',
    titre_chapitre: 'Grammaire AM : Les compléments circonstanciels',
    teacher_id: 'JulieCB',
    creneau: 'aprem',
    intitule: 'Identification et rôle des compléments circonstanciels de temps et de lieu',
    prefixe: 'GRAM',
    domaine: 'Français',
  },
];

let simSettings: UserSettings = {
  teacher_id: 'JulieCB',
  working_days: [1, 2, 4, 5], // Lundi, Mardi, Jeudi, Vendredi
  holidays: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'],
  delay_morning: 0,
  delay_afternoon: 0,
  delay_events: [],
  absences_count: 0, // Compteur de retard dynamique (0 par défaut)
  school_year_start: '2026-09-01',
  default_grades: ['CE1', 'CE2', 'CM1', 'CM2'],
  afternoon_wave_schedule: {
    open_days: 2,
    pause_days: 2,
  },
  periods: [
    { id: 1, name: 'Période 1', startDate: '2026-09-01', endDate: '2026-10-16', working_days: [1, 2, 4, 5] },
    { id: 2, name: 'Période 2', startDate: '2026-11-02', endDate: '2026-12-18', working_days: [1, 2, 4, 5] },
    { id: 3, name: 'Période 3', startDate: '2027-01-04', endDate: '2027-02-12', working_days: [1, 2, 4, 5] },
    { id: 4, name: 'Période 4', startDate: '2027-03-01', endDate: '2027-04-09', working_days: [1, 2, 4, 5] },
    { id: 5, name: 'Période 5', startDate: '2027-04-26', endDate: '2027-07-02', working_days: [1, 2, 4, 5] },
  ],
  evaluation_url: 'https://educonnect.education.gouv.fr',
  password_hash: 'enseignant123',
  show_report_not_done: false,
  auto_reschedule_enabled: false,
};



let simManualAdjustments: ManualAdjustment[] = [
  {
    id: 1,
    date: new Date().toISOString().split('T')[0],
    creneau: 'matin',
    grade: 'Tous',
    titre: 'Rituel de calcul mental et dictée flash jour 3',
    description: 'Dictée sur les homophones (a/à, et/est). Correction collective au tableau interactif.',
    type_activite: 'Entraînement',
    ordre: 1,
    fait: true,
    reporter_au_lendemain: true,
    teacher_id: 'JulieCB',
    is_custom: true,
  },
  {
    id: 2,
    date: new Date().toISOString().split('T')[0],
    creneau: 'aprem',
    grade: 'CM2',
    titre: 'Problèmes ouverts de recherche en petits groupes',
    description: 'Problème de la traversée de la rivière. Autonomie et schématisation exigée.',
    type_activite: 'Tâche complexe',
    ordre: 4,
    fait: false,
    reporter_au_lendemain: true,
    teacher_id: 'JulieCB',
    is_custom: true,
  },
];

let simCustomActivities: ManualAdjustment[] = [];

let simCustomHomework: CustomHomework[] = [];

let simHomework: HomeworkAdjustment[] = [
  {
    id: 1,
    date_assigned: new Date().toISOString().split('T')[0],
    date_due: getNextWorkingDateStr(new Date().toISOString().split('T')[0]),
    grade: 'CM1',
    subject: 'Mathématiques',
    description: 'Relire la leçon NUM-01 dans le cahier rouge et poser la division : 3 456 ÷ 8.',
    competence_code: 'M-NUM-01',
    teacher_id: 'JulieCB',
    done: false,
    difficulty_level: 'standard',
  },
  {
    id: 2,
    date_assigned: new Date().toISOString().split('T')[0],
    date_due: getNextWorkingDateStr(new Date().toISOString().split('T')[0]),
    grade: 'CM2',
    subject: 'Français',
    description: 'Apprendre par cœur les 5 verbes irréguliers au passé composé (voir mémo CONJ-01).',
    competence_code: 'F-CONJ-01',
    teacher_id: 'JulieCB',
    done: false,
    difficulty_level: 'standard',
  },
  {
    id: 3,
    date_assigned: new Date().toISOString().split('T')[0],
    date_due: getNextWorkingDateStr(new Date().toISOString().split('T')[0]),
    grade: 'CM1',
    subject: 'Mathématiques (Soutien)',
    description: 'Faire la fiche de consolidation calcul mental étape 2 (table de 7 et de 8).',
    competence_code: 'M-NUM-01',
    teacher_id: 'JulieCB',
    done: false,
    difficulty_level: 'soutien',
  },
];

let simStudents: Student[] = [
  { id: 1, first_name: 'Lucas', last_name: 'MARTIN', grade: 'CM1', group_level: 'standard', teacher_id: 'JulieCB' },
  { id: 2, first_name: 'Chloé', last_name: 'BERNARD', grade: 'CM1', group_level: 'approfondissement', teacher_id: 'JulieCB' },
  { id: 3, first_name: 'Gabriel', last_name: 'DUBOIS', grade: 'CM1', group_level: 'soutien', teacher_id: 'JulieCB' },
  { id: 4, first_name: 'Léa', last_name: 'THOMAS', grade: 'CM2', group_level: 'standard', teacher_id: 'JulieCB' },
  { id: 5, first_name: 'Hugo', last_name: 'ROBERT', grade: 'CM2', group_level: 'soutien', teacher_id: 'JulieCB' },
  { id: 6, first_name: 'Emma', last_name: 'RICHARD', grade: 'CM2', group_level: 'approfondissement', teacher_id: 'JulieCB' },
];

export interface StudentResult {
  id: number;
  student_id: number;
  competence_code: string;
  reussites: number;
  score: number;
  teacher_id: string;
}

export let simResults: StudentResult[] = [
  // M-NUM-01
  { id: 1, student_id: 1, competence_code: 'M-NUM-01', reussites: 2, score: 2, teacher_id: 'JulieCB' },
  { id: 2, student_id: 2, competence_code: 'M-NUM-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 3, student_id: 3, competence_code: 'M-NUM-01', reussites: 1, score: 1, teacher_id: 'JulieCB' },
  { id: 4, student_id: 4, competence_code: 'M-NUM-01', reussites: 7, score: 7, teacher_id: 'JulieCB' },
  { id: 5, student_id: 5, competence_code: 'M-NUM-01', reussites: 2, score: 2, teacher_id: 'JulieCB' },
  { id: 6, student_id: 6, competence_code: 'M-NUM-01', reussites: 8, score: 8, teacher_id: 'JulieCB' },

  // F-CONJ-01 (Moyenne = 6.83 > 5 -> ENT facultatif)
  { id: 7, student_id: 1, competence_code: 'F-CONJ-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 8, student_id: 2, competence_code: 'F-CONJ-01', reussites: 7, score: 7, teacher_id: 'JulieCB' },
  { id: 9, student_id: 3, competence_code: 'F-CONJ-01', reussites: 5, score: 5, teacher_id: 'JulieCB' },
  { id: 10, student_id: 4, competence_code: 'F-CONJ-01', reussites: 8, score: 8, teacher_id: 'JulieCB' },
  { id: 11, student_id: 5, competence_code: 'F-CONJ-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 12, student_id: 6, competence_code: 'F-CONJ-01', reussites: 9, score: 9, teacher_id: 'JulieCB' },

  // M-CALC-01
  { id: 13, student_id: 1, competence_code: 'M-CALC-01', reussites: 1, score: 1, teacher_id: 'JulieCB' },
  { id: 14, student_id: 2, competence_code: 'M-CALC-01', reussites: 5, score: 5, teacher_id: 'JulieCB' },
  { id: 15, student_id: 3, competence_code: 'M-CALC-01', reussites: 2, score: 2, teacher_id: 'JulieCB' },
  { id: 16, student_id: 4, competence_code: 'M-CALC-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 17, student_id: 5, competence_code: 'M-CALC-01', reussites: 0, score: 0, teacher_id: 'JulieCB' },
  { id: 18, student_id: 6, competence_code: 'M-CALC-01', reussites: 7, score: 7, teacher_id: 'JulieCB' },

  // F-GRAM-01 (Moyenne = 7.0 > 5 -> ENT facultatif)
  { id: 19, student_id: 1, competence_code: 'F-GRAM-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 20, student_id: 2, competence_code: 'F-GRAM-01', reussites: 8, score: 8, teacher_id: 'JulieCB' },
  { id: 21, student_id: 3, competence_code: 'F-GRAM-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 22, student_id: 4, competence_code: 'F-GRAM-01', reussites: 7, score: 7, teacher_id: 'JulieCB' },
  { id: 23, student_id: 5, competence_code: 'F-GRAM-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 24, student_id: 6, competence_code: 'F-GRAM-01', reussites: 9, score: 9, teacher_id: 'JulieCB' },

  // M-GEOM-01
  { id: 25, student_id: 1, competence_code: 'M-GEOM-01', reussites: 2, score: 2, teacher_id: 'JulieCB' },
  { id: 26, student_id: 2, competence_code: 'M-GEOM-01', reussites: 5, score: 5, teacher_id: 'JulieCB' },
  { id: 27, student_id: 3, competence_code: 'M-GEOM-01', reussites: 1, score: 1, teacher_id: 'JulieCB' },
  { id: 28, student_id: 4, competence_code: 'M-GEOM-01', reussites: 6, score: 6, teacher_id: 'JulieCB' },
  { id: 29, student_id: 5, competence_code: 'M-GEOM-01', reussites: 2, score: 2, teacher_id: 'JulieCB' },
  { id: 30, student_id: 6, competence_code: 'M-GEOM-01', reussites: 7, score: 7, teacher_id: 'JulieCB' },
];

let simCustomTasks: CustomTask[] = [
  { id: 1, teacher_id: 'JulieCB', task_text: 'Préparer les cahiers du jour', completed: false },
  { id: 2, teacher_id: 'JulieCB', task_text: 'Vérifier les cahiers de liaison', completed: true },
];

// ==========================================
// SQL INITIALIZATION WHEN USING NEON
// ==========================================
async function initializePostgresTables() {
  if (!pool || !isPostgresConnected) return;

  const createTablesSql = `
    CREATE TABLE IF NOT EXISTS competences (
      code VARCHAR(64) PRIMARY KEY,
      domaine VARCHAR(128) NOT NULL,
      prefixe VARCHAR(32) NOT NULL,
      intitule TEXT NOT NULL,
      cycle VARCHAR(32) DEFAULT 'Cycle 3'
    );

    CREATE TABLE IF NOT EXISTS chronological_progression_matin (
      id SERIAL PRIMARY KEY,
      ordre_sequence INTEGER NOT NULL,
      competence_code VARCHAR(64) NOT NULL,
      grade VARCHAR(32) NOT NULL,
      url TEXT,
      titre_chapitre TEXT NOT NULL,
      teacher_id VARCHAR(64) DEFAULT 'JulieCB'
    );

    CREATE TABLE IF NOT EXISTS chronological_progression_aprem (
      id SERIAL PRIMARY KEY,
      ordre_sequence INTEGER NOT NULL,
      competence_code VARCHAR(64) NOT NULL,
      grade VARCHAR(32) NOT NULL,
      url TEXT,
      titre_chapitre TEXT NOT NULL,
      teacher_id VARCHAR(64) DEFAULT 'JulieCB'
    );

    CREATE TABLE IF NOT EXISTS manual_adjustments (
      id SERIAL PRIMARY KEY,
      date VARCHAR(16) NOT NULL,
      creneau VARCHAR(16) NOT NULL,
      grade VARCHAR(32) NOT NULL,
      titre TEXT NOT NULL,
      description TEXT,
      type_activite VARCHAR(32) NOT NULL,
      ordre INTEGER DEFAULT 1,
      fait BOOLEAN DEFAULT false,
      reporter_au_lendemain BOOLEAN DEFAULT true,
      teacher_id VARCHAR(64) DEFAULT 'JulieCB',
      competence_code VARCHAR(64),
      url TEXT,
      is_custom BOOLEAN DEFAULT false,
      original_date VARCHAR(16)
    );

    CREATE TABLE IF NOT EXISTS custom_activities (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      date_ajustement TEXT,
      creneau TEXT NOT NULL,
      time_slot_id TEXT,
      grade TEXT NOT NULL,
      titre TEXT NOT NULL,
      titre_chapitre TEXT,
      description TEXT,
      type_activite TEXT NOT NULL,
      ordre INTEGER DEFAULT 1,
      fait BOOLEAN DEFAULT false,
      reporter_au_lendemain BOOLEAN DEFAULT true,
      teacher_id VARCHAR(64) DEFAULT 'JulieCB',
      competence_code VARCHAR(64),
      url TEXT,
      is_custom BOOLEAN DEFAULT true,
      original_date TEXT,
      matiere TEXT,
      domaine TEXT,
      pastel_color VARCHAR(32),
      recurrence TEXT,
      numero_exercice TEXT,
      progression_id INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS homework_manual_adjustments (
      id SERIAL PRIMARY KEY,
      date_due VARCHAR(16) NOT NULL,
      date_assigned VARCHAR(16) NOT NULL,
      grade VARCHAR(32) NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      competence_code VARCHAR(64),
      teacher_id VARCHAR(64) DEFAULT 'JulieCB',
      done BOOLEAN DEFAULT false,
      difficulty_level VARCHAR(32) DEFAULT 'standard'
    );

    CREATE TABLE IF NOT EXISTS custom_homework (
      id SERIAL PRIMARY KEY,
      date_due VARCHAR(16) NOT NULL,
      date_assigned VARCHAR(16),
      grade VARCHAR(32) NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT,
      teacher_id VARCHAR(64) DEFAULT 'JulieCB',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_tasks (
      id SERIAL PRIMARY KEY,
      teacher_id VARCHAR(100) NOT NULL DEFAULT 'JulieCB',
      task_text TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      teacher_id VARCHAR(50) DEFAULT 'default_teacher' UNIQUE,
      password_hash VARCHAR(255) DEFAULT 'HPF' NOT NULL,
      delay_morning INTEGER DEFAULT 0,
      delay_afternoon INTEGER DEFAULT 0,
      homework_url TEXT DEFAULT '',
      global_work_days JSONB DEFAULT '[1, 2, 4, 5]' NOT NULL,
      periods JSONB DEFAULT '[]' NOT NULL,
      evaluation_url TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_completions (
      id SERIAL PRIMARY KEY,
      activity_id INTEGER NOT NULL,
      activity_type VARCHAR(32) DEFAULT 'custom',
      date TEXT NOT NULL,
      done BOOLEAN DEFAULT true,
      teacher_id VARCHAR(64) DEFAULT 'JulieCB'
    );
  `;

  try {
    await pool.query(createTablesSql);
    
    // Execute migrations statement-by-statement so individual failures do not roll back the rest
    const migrationStatements = [
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS id SERIAL",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT 'HPF'",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS delay_morning INTEGER DEFAULT 0",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS delay_afternoon INTEGER DEFAULT 0",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS delay_events JSONB DEFAULT '[]'::jsonb",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS periods JSONB DEFAULT '[]'",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS evaluation_url TEXT",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS school_year_start VARCHAR(32) DEFAULT '2026-09-01'",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_grades JSONB DEFAULT '[\"CE1\",\"CE2\",\"CM1\",\"CM2\"]'",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS active_grades TEXT[] DEFAULT ARRAY['CE1','CE2','CM1','CM2']",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS afternoon_wave_schedule JSONB DEFAULT '{\"open_days\":2,\"pause_days\":2}'",
      "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_reschedule_enabled BOOLEAN DEFAULT false",
      "ALTER TABLE user_settings DROP COLUMN IF EXISTS holydays",
      "ALTER TABLE user_settings DROP COLUMN IF EXISTS homework_url",
      "ALTER TABLE user_settings DROP COLUMN IF EXISTS global_work_days",

      "ALTER TABLE competences ADD COLUMN IF NOT EXISTS domaine VARCHAR(128)",

      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS ordre_sequence INTEGER",
      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS competence_code VARCHAR(64)",
      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS grade VARCHAR(32)",
      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS titre_chapitre TEXT",
      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS domaine TEXT",
      "ALTER TABLE chronological_progression_matin ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(64) DEFAULT 'JulieCB'",

      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS ordre_sequence INTEGER",
      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS competence_code VARCHAR(64)",
      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS grade VARCHAR(32)",
      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS titre_chapitre TEXT",
      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS domaine TEXT",
      "ALTER TABLE chronological_progression_aprem ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(64) DEFAULT 'JulieCB'",

      // manual_adjustments columns
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS progression_id INTEGER",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS date TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS date_ajustement TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS grade TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS teacher_id TEXT DEFAULT 'JulieCB'",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS titre TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS type_activite TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS description TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS numero_exercice TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS report_j1 BOOLEAN DEFAULT true",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS reporter_au_lendemain BOOLEAN DEFAULT true",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS time_slot_id TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS creneau TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS ordre INTEGER DEFAULT 1",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS color_label TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS recurrence TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS fait BOOLEAN DEFAULT false",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS original_date TEXT",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'custom'",
      "ALTER TABLE manual_adjustments ADD COLUMN IF NOT EXISTS is_blank BOOLEAN DEFAULT false",

      "ALTER TABLE manual_adjustments ALTER COLUMN progression_id DROP NOT NULL",
      "ALTER TABLE manual_adjustments ALTER COLUMN date DROP NOT NULL",
      "ALTER TABLE manual_adjustments ALTER COLUMN creneau DROP NOT NULL",
      "ALTER TABLE manual_adjustments ALTER COLUMN grade DROP NOT NULL",
      "ALTER TABLE manual_adjustments ALTER COLUMN titre DROP NOT NULL",
      "ALTER TABLE manual_adjustments ALTER COLUMN type_activite DROP NOT NULL",

      "ALTER TABLE manual_adjustments DROP CONSTRAINT IF EXISTS manual_adjustments_unique_constraint",
      "DROP INDEX IF EXISTS manual_adjustments_unique_constraint",
      "ALTER TABLE manual_adjustments DROP CONSTRAINT IF EXISTS manual_adj_prog_date_grade_teacher_idx",
      "DROP INDEX IF EXISTS manual_adj_prog_date_grade_teacher_idx",
      "CREATE INDEX IF NOT EXISTS manual_adj_progression_id_idx ON manual_adjustments (progression_id) WHERE progression_id IS NOT NULL",
      "CREATE INDEX IF NOT EXISTS manual_adj_date_ajustement_idx ON manual_adjustments (date_ajustement)",

      // custom_activities columns
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS date TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS date_ajustement TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS recurrence TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS grade TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS teacher_id TEXT DEFAULT 'JulieCB'",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS time_slot_id TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS creneau TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS matiere TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS domaine TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS titre TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS type_activite TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS description TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS numero_exercice TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS pastel_color VARCHAR(32)",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS ordre INTEGER DEFAULT 1",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS reporter_au_lendemain BOOLEAN DEFAULT true",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS color_label TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS fait BOOLEAN DEFAULT false",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS progression_id INTEGER",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS original_date TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS date_fin TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS position_anchor TEXT",
      "ALTER TABLE custom_activities ADD COLUMN IF NOT EXISTS position_overrides JSONB DEFAULT '{}'",

      "CREATE UNIQUE INDEX IF NOT EXISTS activity_completions_uniq_idx ON activity_completions (activity_id, activity_type, date, teacher_id)",

      "ALTER TABLE custom_activities ALTER COLUMN date DROP NOT NULL",
      "ALTER TABLE custom_activities ALTER COLUMN creneau DROP NOT NULL",
      "ALTER TABLE custom_activities ALTER COLUMN grade DROP NOT NULL",
      "ALTER TABLE custom_activities ALTER COLUMN titre DROP NOT NULL",
      "ALTER TABLE custom_activities ALTER COLUMN type_activite DROP NOT NULL",

      // homework_manual_adjustments
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS date_due VARCHAR(16)",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS date_echeance VARCHAR(16)",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS date_assigned VARCHAR(16)",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS grade VARCHAR(32)",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS subject TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS description TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS titre_chapitre TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS competence_code VARCHAR(64)",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(64) DEFAULT 'JulieCB'",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(32) DEFAULT 'standard'",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS priority_status VARCHAR(32) DEFAULT 'prioritaire'",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS day_of_life INTEGER",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS modified_text TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS modified_url TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS modified_content TEXT",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS is_deferred BOOLEAN DEFAULT false",
      "ALTER TABLE homework_manual_adjustments ADD COLUMN IF NOT EXISTS source_task_id VARCHAR(128)",
      "UPDATE homework_manual_adjustments SET date_echeance = date_due WHERE (date_echeance IS NULL OR date_echeance = '') AND date_due IS NOT NULL",
      "UPDATE homework_manual_adjustments SET date_due = date_echeance WHERE (date_due IS NULL OR date_due = '') AND date_echeance IS NOT NULL",
      "UPDATE homework_manual_adjustments SET titre_chapitre = modified_text WHERE (titre_chapitre IS NULL OR titre_chapitre = '') AND modified_text IS NOT NULL AND modified_text != ''",
      "UPDATE homework_manual_adjustments SET titre_chapitre = subject WHERE (titre_chapitre IS NULL OR titre_chapitre = '') AND subject IS NOT NULL AND subject != 'Général'",
      "UPDATE homework_manual_adjustments SET source_task_id = competence_code WHERE competence_code IS NOT NULL AND competence_code != ''",
      "UPDATE homework_manual_adjustments SET source_task_id = COALESCE(NULLIF(source_task_id, ''), NULLIF(competence_code, ''), NULLIF(subject, ''), CONCAT('task_', id)) WHERE source_task_id IS NULL OR source_task_id = ''",
      "ALTER TABLE homework_manual_adjustments DROP CONSTRAINT IF EXISTS hma_date_grade_teacher_uniq_idx",
      "DROP INDEX IF EXISTS hma_date_grade_teacher_uniq_idx",
      "ALTER TABLE homework_manual_adjustments DROP CONSTRAINT IF EXISTS homework_manual_adjustments_date_echeance_grade_teacher_id_key",
      "DROP INDEX IF EXISTS homework_manual_adjustments_date_echeance_grade_teacher_id_key",
      "ALTER TABLE homework_manual_adjustments DROP CONSTRAINT IF EXISTS homework_manual_adjustments_date_due_grade_teacher_id_key",
      "DROP INDEX IF EXISTS homework_manual_adjustments_date_due_grade_teacher_id_key",
      "DELETE FROM homework_manual_adjustments a USING homework_manual_adjustments b WHERE a.id < b.id AND COALESCE(a.date_echeance, a.date_due) = COALESCE(b.date_echeance, b.date_due) AND a.grade = b.grade AND a.teacher_id = b.teacher_id AND a.source_task_id = b.source_task_id",
      "CREATE UNIQUE INDEX IF NOT EXISTS hma_date_grade_teacher_source_task_uniq_idx ON homework_manual_adjustments (date_echeance, grade, teacher_id, source_task_id)",

      "ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(100) DEFAULT 'JulieCB'",

      // custom_homework migrations
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS date_due VARCHAR(16)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS date_echeance VARCHAR(16)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS date_assigned VARCHAR(16)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS grade VARCHAR(50)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS subject VARCHAR(100)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS sub_domain VARCHAR(100)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS target_groups TEXT DEFAULT 'Tous'",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS title TEXT",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS description TEXT",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS exercise_number VARCHAR(64)",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS cartridge_color VARCHAR(64) DEFAULT 'standard'",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS position_rule VARCHAR(50) DEFAULT 'bottom'",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS recurrence VARCHAR(32) DEFAULT 'none'",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(64) DEFAULT 'JulieCB'",
      "ALTER TABLE custom_homework ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT true",
      "UPDATE custom_homework SET date_echeance = date_due WHERE (date_echeance IS NULL OR date_echeance = '') AND date_due IS NOT NULL",
      "UPDATE custom_homework SET date_due = date_echeance WHERE (date_due IS NULL OR date_due = '') AND date_echeance IS NOT NULL",
      "UPDATE custom_homework SET title = subject WHERE (title IS NULL OR title = '') AND subject IS NOT NULL"
    ];

    for (const stmt of migrationStatements) {
      try {
        await pool.query(stmt);
      } catch (e: any) {
        // Safe warning per statement
      }
    }

    // Clean up any other old index/constraint on homework_manual_adjustments without source_task_id
    try {
      await pool.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'homework_manual_adjustments'
              AND indexname NOT LIKE '%pkey%'
              AND indexname != 'hma_date_grade_teacher_source_task_uniq_idx'
              AND indexdef NOT LIKE '%source_task_id%'
          ) LOOP
            EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.indexname);
          END LOOP;
        END $$;
      `);
    } catch (e: any) {
      console.warn('Cleanup old indexes on homework_manual_adjustments:', e?.message || e);
    }
    // Seed default JulieCB settings if missing
    const res = await pool.query(
      'SELECT * FROM user_settings WHERE teacher_id = $1',
      ['JulieCB']
    );
    if (res.rows.length === 0) {
      console.log('🌱 Seeding PostgreSQL Neon avec les données de JulieCB...');
      await seedPostgresData();
    }
  } catch (err: any) {
    console.error('Erreur initialisation tables Postgres Neon:', err.message);
  }
}

async function seedPostgresData() {
  if (!pool) return;
  // Insert competences
  for (const c of simCompetences) {
    await pool.query(
      `INSERT INTO competences (code, domaine, prefixe, intitule, cycle)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET intitule = EXCLUDED.intitule`,
      [c.code, c.domaine, c.prefixe, c.intitule, c.cycle]
    );
  }

  // Check if matin table is empty
  const matinCheck = await pool.query('SELECT COUNT(*) FROM chronological_progression_matin');
  if (parseInt(matinCheck.rows[0].count, 10) === 0) {
    for (const m of simMatin) {
      await pool.query(
        `INSERT INTO chronological_progression_matin (ordre_sequence, competence_code, grade, url, titre_chapitre, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [m.ordre_sequence, m.competence_code, m.grade, m.url, m.titre_chapitre, m.teacher_id]
      );
    }
  }

  // Check if aprem table is empty
  const apremCheck = await pool.query('SELECT COUNT(*) FROM chronological_progression_aprem');
  if (parseInt(apremCheck.rows[0].count, 10) === 0) {
    for (const a of simAprem) {
      await pool.query(
        `INSERT INTO chronological_progression_aprem (ordre_sequence, competence_code, grade, url, titre_chapitre, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [a.ordre_sequence, a.competence_code, a.grade, a.url, a.titre_chapitre, a.teacher_id]
      );
    }
  }

  // Insert settings
  await pool.query(
    `INSERT INTO user_settings (teacher_id, delay_morning, delay_afternoon, periods, evaluation_url, password_hash, school_year_start, holidays)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (teacher_id) DO UPDATE SET
       delay_morning = EXCLUDED.delay_morning,
       delay_afternoon = EXCLUDED.delay_afternoon,
       periods = EXCLUDED.periods,
       evaluation_url = EXCLUDED.evaluation_url,
       password_hash = EXCLUDED.password_hash,
       school_year_start = EXCLUDED.school_year_start,
       holidays = EXCLUDED.holidays`,
    [
      simSettings.teacher_id,
      simSettings.delay_morning || 0,
      simSettings.delay_afternoon || 0,
      JSON.stringify(simSettings.periods || []),
      simSettings.evaluation_url || '',
      simSettings.password_hash || 'HPF',
      simSettings.school_year_start || '2026-09-01',
      JSON.stringify(simSettings.holidays || []),
    ]
  );
}

export async function ensurePostgresConnection(): Promise<boolean> {
  const connStr =
    process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || connectionString || '';
  if (!connStr || !connStr.trim()) {
    return false;
  }
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: connStr,
        ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false },
      });
    } catch (err: any) {
      console.warn('⚠️ Erreur création Pool Neon:', err.message);
      return false;
    }
  }
  if (!isPostgresConnected) {
    try {
      await pool.query('SELECT 1');
      isPostgresConnected = true;
      dbStatusMessage = 'Connecté à PostgreSQL Neon en production';
      console.log('✅ Connecté avec succès à PostgreSQL (Neon)');
      await initializePostgresTables();
    } catch (err: any) {
      console.warn('⚠️ Connexion PostgreSQL Neon échouée:', err.message);
      isPostgresConnected = false;
      dbStatusMessage = `Erreur Neon: ${err.message}`;
      return false;
    }
  }
  return true;
}

// ==========================================
// PUBLIC DATABASE METHODS (AUTO SIM/POSTGRES)
// ==========================================

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const isPg = await ensurePostgresConnection();
  return {
    connected: true,
    type: isPg ? 'neon-postgres' : 'simulation-memory',
    databaseUrlConfigured: !!(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || connectionString),
    tablesCount: 8,
    message: dbStatusMessage,
  };
}

// SERVER-SIDE IN-MEMORY CACHE FOR HIGH-FREQUENCY QUERIES
const serverCacheSettings = new Map<string, { data: UserSettings; ts: number }>();
const serverCacheProgression = new Map<string, { data: ChronologicalProgression[]; ts: number }>();
const serverCacheGrades = new Map<string, { data: GradeLevel[]; ts: number }>();

export function clearDbCaches() {
  serverCacheSettings.clear();
  serverCacheProgression.clear();
  serverCacheGrades.clear();
}

export async function resetAndSeedDatabase(): Promise<{ success: boolean; message: string }> {
  clearDbCaches();
  if (isPostgresConnected && pool) {
    await seedPostgresData();
    return { success: true, message: 'Base de données Neon PostgreSQL réinitialisée et alimentée.' };
  } else {
    // Reset simulation data to original defaults
    simSettings.absences_count = 0;
    return { success: true, message: 'Mode Simulation réinitialisé avec les données par défaut JulieCB.' };
  }
}

export async function getUserSettings(teacherId = 'JulieCB'): Promise<UserSettings> {
  const cached = serverCacheSettings.get(teacherId);
  if (cached && Date.now() - cached.ts < 30000) {
    return cached.data;
  }
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      let res = await pool.query('SELECT * FROM user_settings WHERE teacher_id = $1', [teacherId]);
      if (res.rows.length === 0) {
        res = await pool.query('SELECT * FROM user_settings WHERE teacher_id = $1', ['default_teacher']);
      }
      if (res.rows.length === 0) {
        res = await pool.query('SELECT * FROM user_settings ORDER BY id ASC LIMIT 1');
      }
      if (res.rows.length > 0) {
        const r = res.rows[0];

        let parsedGlobalWorkDays: number[] = [];
        try {
          if (typeof r.global_work_days === 'string') {
            parsedGlobalWorkDays = JSON.parse(r.global_work_days);
          } else if (Array.isArray(r.global_work_days)) {
            parsedGlobalWorkDays = r.global_work_days;
          } else if (typeof r.working_days === 'string') {
            parsedGlobalWorkDays = JSON.parse(r.working_days);
          } else if (Array.isArray(r.working_days)) {
            parsedGlobalWorkDays = r.working_days;
          }
        } catch (e) {
          console.warn('⚠️ Error parsing global_work_days:', e);
        }

        let parsedPeriods = simSettings.periods;
        try {
          if (typeof r.periods === 'string') {
            parsedPeriods = JSON.parse(r.periods);
          } else if (Array.isArray(r.periods)) {
            parsedPeriods = r.periods;
          }
          if (Array.isArray(parsedPeriods)) {
            parsedPeriods = parsedPeriods.map((p: any) => {
              const days = p.working_days || p.workingDays || [];
              return {
                id: p.id,
                name: p.name || `Période ${p.id}`,
                startDate: p.startDate,
                endDate: p.endDate,
                working_days: Array.isArray(days) ? days.map(Number) : [],
              };
            });
          }
        } catch (e) {
          console.warn('⚠️ Error parsing periods:', e);
        }

        let parsedHolidays = simSettings.holidays || [];
        try {
          if (typeof r.holidays === 'string') {
            parsedHolidays = JSON.parse(r.holidays);
          } else if (Array.isArray(r.holidays)) {
            parsedHolidays = r.holidays;
          }
        } catch (e) {
          console.warn('⚠️ Error parsing holidays:', e);
        }

        let parsedDefaultGrades = ['CE1', 'CE2', 'CM1', 'CM2'];
        try {
          if (typeof r.default_grades === 'string') {
            parsedDefaultGrades = JSON.parse(r.default_grades);
          } else if (Array.isArray(r.default_grades)) {
            parsedDefaultGrades = r.default_grades;
          }
        } catch (e) {
          console.warn('⚠️ Error parsing default_grades:', e);
        }

        let parsedActiveGrades = parsedDefaultGrades;
        try {
          if (r.active_grades) {
            if (Array.isArray(r.active_grades)) {
              parsedActiveGrades = r.active_grades;
            } else if (typeof r.active_grades === 'string') {
              if (r.active_grades.startsWith('{') && r.active_grades.endsWith('}')) {
                parsedActiveGrades = r.active_grades.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
              } else {
                parsedActiveGrades = JSON.parse(r.active_grades);
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ Error parsing active_grades:', e);
        }

        let parsedAfternoonWave = { open_days: 2, pause_days: 2 };
        try {
          if (typeof r.afternoon_wave_schedule === 'string') {
            parsedAfternoonWave = JSON.parse(r.afternoon_wave_schedule);
          } else if (typeof r.afternoon_wave_schedule === 'object' && r.afternoon_wave_schedule) {
            parsedAfternoonWave = r.afternoon_wave_schedule;
          }
        } catch (e) {
          console.warn('⚠️ Error parsing afternoon_wave_schedule:', e);
        }

        let parsedDelayEvents: DelayEvent[] = [];
        try {
          if (r.delay_events) {
            if (typeof r.delay_events === 'string') {
              parsedDelayEvents = JSON.parse(r.delay_events);
            } else if (Array.isArray(r.delay_events)) {
              parsedDelayEvents = r.delay_events;
            }
          }
        } catch (e) {
          console.warn('⚠️ Error parsing delay_events:', e);
        }

        const delayMorningVal = r.delay_morning !== undefined && r.delay_morning !== null
          ? Number(r.delay_morning)
          : (r.absences_count || 0);

        const delayAfternoonVal = r.delay_afternoon !== undefined && r.delay_afternoon !== null
          ? Number(r.delay_afternoon)
          : 0;

        const resultSettings: UserSettings = {
          teacher_id: r.teacher_id || teacherId,
          working_days: parsedGlobalWorkDays,
          holidays: parsedHolidays,
          delay_morning: delayMorningVal,
          delay_afternoon: delayAfternoonVal,
          delay_events: parsedDelayEvents,
          absences_count: delayMorningVal,
          school_year_start: r.school_year_start || '2026-09-01',
          default_grades: parsedDefaultGrades,
          active_grades: parsedActiveGrades.length > 0 ? parsedActiveGrades : parsedDefaultGrades,
          afternoon_wave_schedule: parsedAfternoonWave,
          periods: parsedPeriods,
          evaluation_url: r.evaluation_url || simSettings.evaluation_url || '',
          password_hash: r.password_hash || 'HPF',
          show_report_not_done: r.show_report_not_done !== undefined ? Boolean(r.show_report_not_done) : (simSettings.show_report_not_done || false),
          auto_reschedule_enabled: r.auto_reschedule_enabled !== undefined ? Boolean(r.auto_reschedule_enabled) : (simSettings.auto_reschedule_enabled || false),
        };
        serverCacheSettings.set(teacherId, { data: resultSettings, ts: Date.now() });
        return resultSettings;
      }
    } catch (err: any) {
      console.error('⚠️ Error fetching user_settings from Postgres:', err.message);
    }
  }
  return simSettings;
}

export async function updateUserSettings(
  settings: Partial<UserSettings>,
  teacherId = 'JulieCB'
): Promise<UserSettings> {
  clearDbCaches();
  await ensurePostgresConnection();
  const current = await getUserSettings(teacherId);

  const delayMorningVal = settings.delay_morning !== undefined
    ? settings.delay_morning
    : (settings.absences_count !== undefined ? settings.absences_count : current.delay_morning || 0);

  const delayAfternoonVal = settings.delay_afternoon !== undefined
    ? settings.delay_afternoon
    : (current.delay_afternoon !== undefined ? current.delay_afternoon : 0);

  const delayEventsVal = settings.delay_events !== undefined
    ? settings.delay_events
    : (current.delay_events || []);

  const activeGradesVal = settings.active_grades !== undefined
    ? settings.active_grades
    : (current.active_grades || current.default_grades || ['CE1', 'CE2', 'CM1', 'CM2']);

  const schoolYearStartVal = settings.school_year_start !== undefined
    ? settings.school_year_start
    : (current.school_year_start || '2026-09-01');

  let rawPeriods = settings.periods || current.periods || simSettings.periods;
  let cleanedPeriods = simSettings.periods;
  if (Array.isArray(rawPeriods)) {
    cleanedPeriods = rawPeriods.map((p: any) => {
      const days = p.working_days || p.workingDays || [];
      return {
        id: p.id,
        name: p.name || `Période ${p.id}`,
        startDate: p.startDate,
        endDate: p.endDate,
        working_days: Array.isArray(days) ? days.map(Number) : [],
      };
    });
  }

  const updated: UserSettings = {
    ...current,
    ...settings,
    teacher_id: teacherId,
    school_year_start: schoolYearStartVal,
    delay_morning: delayMorningVal,
    delay_afternoon: delayAfternoonVal,
    delay_events: delayEventsVal,
    absences_count: delayMorningVal,
    active_grades: activeGradesVal,
    periods: cleanedPeriods,
  };

  if (isPostgresConnected && pool) {
    const holidaysPayload = JSON.stringify(updated.holidays || []);
    const delayEventsPayload = JSON.stringify(updated.delay_events || []);
    await pool.query(
      `INSERT INTO user_settings (teacher_id, delay_morning, delay_afternoon, periods, evaluation_url, password_hash, active_grades, auto_reschedule_enabled, holidays, school_year_start, delay_events)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (teacher_id) DO UPDATE SET
         delay_morning = EXCLUDED.delay_morning,
         delay_afternoon = EXCLUDED.delay_afternoon,
         periods = EXCLUDED.periods,
         evaluation_url = EXCLUDED.evaluation_url,
         password_hash = EXCLUDED.password_hash,
         active_grades = EXCLUDED.active_grades,
         auto_reschedule_enabled = EXCLUDED.auto_reschedule_enabled,
         holidays = EXCLUDED.holidays,
         school_year_start = EXCLUDED.school_year_start,
         delay_events = EXCLUDED.delay_events`,
      [
        updated.teacher_id,
        updated.delay_morning,
        updated.delay_afternoon,
        JSON.stringify(updated.periods || simSettings.periods),
        updated.evaluation_url || '',
        updated.password_hash || 'HPF',
        updated.active_grades || ['CE1', 'CE2', 'CM1', 'CM2'],
        updated.auto_reschedule_enabled || false,
        holidaysPayload,
        updated.school_year_start || '2026-09-01',
        delayEventsPayload,
      ]
    );
  } else {
    simSettings = updated;
  }
  clearHomeworkCache();
  return updated;
}

export async function getCompetences(): Promise<Competence[]> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    const res = await pool.query('SELECT * FROM competences ORDER BY code ASC');
    return res.rows;
  }
  return simCompetences;
}

export async function getChronologicalProgression(
  creneau: CreneauType,
  teacherId = 'JulieCB'
): Promise<ChronologicalProgression[]> {
  const cacheKey = `${creneau}_${teacherId}`;
  const cached = serverCacheProgression.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30000) {
    return cached.data;
  }
  await ensurePostgresConnection();
  let resultList: ChronologicalProgression[] = [];
  if (isPostgresConnected && pool) {
    try {
      const tableName =
        creneau === 'matin'
          ? 'chronological_progression_matin'
          : 'chronological_progression_aprem';
      const res = await pool.query(
        `SELECT p.*, c.intitule, c.prefixe, c.domaine
         FROM ${tableName} p
         LEFT JOIN competences c ON p.competence_code = c.code
         WHERE p.teacher_id = $1 OR p.teacher_id IS NULL OR p.teacher_id = '' OR p.teacher_id = 'JulieCB' OR p.teacher_id = 'default_teacher'
         ORDER BY p.ordre_sequence ASC`,
        [teacherId]
      );
      resultList = res.rows.map((r) => ({
        ...r,
        creneau,
        ordre_sequence: Number(r.ordre_sequence) || 1,
      }));
      serverCacheProgression.set(cacheKey, { data: resultList, ts: Date.now() });
      return resultList;
    } catch (err: any) {
      console.error(`⚠️ Error querying ${creneau} progression from DB:`, err.message);
    }
  }

  const list = creneau === 'matin' ? simMatin : simAprem;
  resultList = list.map((p) => {
    const comp = simCompetences.find((c) => c.code === p.competence_code);
    return {
      ...p,
      creneau,
      ordre_sequence: Number(p.ordre_sequence) || 1,
      intitule: comp?.intitule || p.titre_chapitre,
      prefixe: comp?.prefixe || 'COMP',
      domaine: comp?.domaine || 'Général',
    };
  });
  serverCacheProgression.set(cacheKey, { data: resultList, ts: Date.now() });
  return resultList;
}

export async function getAvailableGrades(teacherId = 'JulieCB'): Promise<GradeLevel[]> {
  const cached = serverCacheGrades.get(teacherId);
  if (cached && Date.now() - cached.ts < 30000) {
    return cached.data;
  }
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT DISTINCT grade FROM chronological_progression_matin WHERE teacher_id = $1 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher'
         UNION
         SELECT DISTINCT grade FROM chronological_progression_aprem WHERE teacher_id = $1 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher'
         ORDER BY grade ASC`,
        [teacherId]
      );
      const grades = res.rows
        .map(r => r.grade)
        .filter(g => g && g !== 'Tous');
      if (grades.length > 0) {
        serverCacheGrades.set(teacherId, { data: grades, ts: Date.now() });
        return grades;
      }
    } catch (err: any) {
      console.error('⚠️ Error querying available grades from DB:', err.message);
    }
  }
  const allSim = [...simMatin, ...simAprem].map(i => i.grade).filter(g => g && g !== 'Tous');
  const distinct = Array.from(new Set(allSim));
  const resFallback = distinct.length > 0 ? distinct : ['CE1', 'CE2', 'CM1', 'CM2'];
  serverCacheGrades.set(teacherId, { data: resFallback, ts: Date.now() });
  return resFallback;
}

export async function importCsvProgression(
  creneau: CreneauType,
  rows: Array<Partial<ChronologicalProgression>>,
  clearExisting = false,
  teacherId = 'JulieCB'
): Promise<{ success: boolean; count: number; message: string }> {
  await ensurePostgresConnection();
  const tableName =
    creneau === 'matin'
      ? 'chronological_progression_matin'
      : 'chronological_progression_aprem';

  const creneauLabel = creneau === 'matin' ? 'Matin' : 'Après-midi';

  if (isPostgresConnected && pool) {
    if (clearExisting) {
      await pool.query(`DELETE FROM ${tableName} WHERE teacher_id = $1`, [teacherId]);
    }
    let count = 0;
    for (const r of rows) {
      const code = (r.competence_code || '').trim() || `COMP-${Date.now()}-${count}`;
      const ordre = Number(r.ordre_sequence) || (count + 1);
      const grade = (r.grade || 'CM1').trim();
      const url = (r.url || '').trim();
      const titre = (r.titre_chapitre || r.intitule || 'Activité').trim();
      const rowTeacherId = (r.teacher_id || teacherId || 'JulieCB').trim();

      if (r.intitule || r.domaine || r.prefixe) {
        await pool.query(
          `INSERT INTO competences (code, domaine, prefixe, intitule, cycle)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (code) DO UPDATE SET
             intitule = EXCLUDED.intitule,
             domaine = EXCLUDED.domaine,
             prefixe = EXCLUDED.prefixe`,
          [code, r.domaine || 'Général', r.prefixe || 'COMP', r.intitule || titre, 'Cycle 3']
        );
      }

      await pool.query(
        `INSERT INTO ${tableName} (ordre_sequence, competence_code, grade, url, titre_chapitre, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ordre, code, grade, url, titre, rowTeacherId]
      );
      count++;
    }
    return {
      success: true,
      count,
      message: `${count} séquences insérées avec succès dans la table ${tableName} (${creneauLabel}).`,
    };
  } else {
    const targetList = creneau === 'matin' ? simMatin : simAprem;
    if (clearExisting) {
      targetList.length = 0;
    }
    let count = 0;
    for (const r of rows) {
      count++;
      targetList.push({
        id: (targetList.length > 0 ? Math.max(...targetList.map(i => i.id)) : 0) + 1,
        ordre_sequence: Number(r.ordre_sequence) || count,
        competence_code: (r.competence_code || '').trim() || `COMP-${count}`,
        grade: (r.grade || 'CM1').trim(),
        url: (r.url || '').trim(),
        titre_chapitre: (r.titre_chapitre || r.intitule || 'Activité').trim(),
        teacher_id: (r.teacher_id || teacherId || 'JulieCB').trim(),
        creneau,
      });
    }
    return {
      success: true,
      count,
      message: `${count} séquences ajoutées dans la progression ${creneauLabel} en mémoire.`,
    };
  }
}

export async function truncateProgression(
  creneau: CreneauType,
  grade?: string,
  teacherId = 'JulieCB'
): Promise<{ success: boolean; message: string; deletedCount?: number }> {
  await ensurePostgresConnection();
  const tableName =
    creneau === 'matin'
      ? 'chronological_progression_matin'
      : 'chronological_progression_aprem';

  const creneauLabel = creneau === 'matin' ? 'Matin' : 'Après-midi';
  const targetGrade = (grade || 'Tous').trim();

  if (isPostgresConnected && pool) {
    if (!targetGrade || targetGrade === 'Tous' || targetGrade === 'all') {
      await pool.query(`TRUNCATE TABLE ${tableName}`);
      return {
        success: true,
        message: `Table ${tableName} (${creneauLabel}) intégralement vidée via TRUNCATE TABLE.`,
      };
    } else {
      const res = await pool.query(`DELETE FROM ${tableName} WHERE grade = $1`, [targetGrade]);
      return {
        success: true,
        message: `Table ${tableName} (${creneauLabel}) purgée pour le grade '${targetGrade}' (${res.rowCount || 0} lignes supprimées).`,
        deletedCount: res.rowCount || 0,
      };
    }
  } else {
    const targetList = creneau === 'matin' ? simMatin : simAprem;
    if (!targetGrade || targetGrade === 'Tous' || targetGrade === 'all') {
      const count = targetList.length;
      targetList.length = 0;
      return { success: true, message: `Table mémoire ${creneauLabel} intégralement vidée (${count} éléments).` };
    } else {
      const initialCount = targetList.length;
      const filtered = targetList.filter(
        (i) => (i.grade || '').trim().toUpperCase() !== targetGrade.toUpperCase()
      );
      const deletedCount = initialCount - filtered.length;
      if (creneau === 'matin') {
        simMatin.length = 0;
        simMatin.push(...filtered);
      } else {
        simAprem.length = 0;
        simAprem.push(...filtered);
      }
      return {
        success: true,
        message: `Table mémoire ${creneauLabel} purgée pour le grade '${targetGrade}' (${deletedCount} éléments supprimés).`,
        deletedCount,
      };
    }
  }
}

export async function addChronologicalProgression(
  item: Omit<ChronologicalProgression, 'id'>
): Promise<ChronologicalProgression> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    const tableName =
      item.creneau === 'matin'
        ? 'chronological_progression_matin'
        : 'chronological_progression_aprem';
    const res = await pool.query(
      `INSERT INTO ${tableName} (ordre_sequence, competence_code, grade, url, titre_chapitre, teacher_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        item.ordre_sequence,
        item.competence_code,
        item.grade,
        item.url,
        item.titre_chapitre,
        item.teacher_id || 'JulieCB',
      ]
    );
    return { ...res.rows[0], creneau: item.creneau };
  }

  const list = item.creneau === 'matin' ? simMatin : simAprem;
  const newId = (list.length > 0 ? Math.max(...list.map((i) => i.id)) : 0) + 1;
  const created: ChronologicalProgression = { ...item, id: newId };
  list.push(created);
  return created;
}

export async function getManualAdjustments(
  dateStr: string,
  teacherId = 'JulieCB'
): Promise<ManualAdjustment[]> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM manual_adjustments
         WHERE ((date::text = $1 OR date_ajustement::text = $1)
            OR (recurrence IS NOT NULL AND recurrence != '' AND recurrence != 'aucune'))
           AND (teacher_id = $2 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher')
         ORDER BY COALESCE(time_slot_id, creneau) ASC, COALESCE(order_index, ordre) ASC`,
        [dateStr, teacherId]
      );
      return res.rows.map((r) => {
        const origDate = r.date ? (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date)) : (r.date_ajustement ? (r.date_ajustement instanceof Date ? r.date_ajustement.toISOString().split('T')[0] : String(r.date_ajustement)) : dateStr);
        const adjDate = r.date_ajustement ? (r.date_ajustement instanceof Date ? r.date_ajustement.toISOString().split('T')[0] : String(r.date_ajustement)) : origDate;
        return {
          ...r,
          creneau: r.time_slot_id || r.creneau || 'matin',
          time_slot_id: r.time_slot_id || r.creneau || 'matin',
          date: origDate,
          date_ajustement: adjDate,
          ordre: r.order_index || r.ordre || 1,
          order_index: r.order_index || r.ordre || 1,
          reporter_au_lendemain: r.report_j1 ?? r.reporter_au_lendemain ?? true,
          report_j1: r.report_j1 ?? r.reporter_au_lendemain ?? true,
        };
      });
    } catch (err: any) {
      console.error('⚠️ Error querying manual_adjustments from DB:', err.message);
    }
  }
  return simManualAdjustments
    .filter(
      (a) =>
        (a.date === dateStr ||
          (a as any).date_ajustement === dateStr ||
          (a.recurrence && a.recurrence !== 'aucune')) &&
        (a.teacher_id === teacherId || a.teacher_id === 'JulieCB' || !a.teacher_id)
    )
    .map((r) => ({
      ...r,
      creneau: r.creneau || (r as any).time_slot_id || 'matin',
      time_slot_id: (r as any).time_slot_id || r.creneau || 'matin',
      date: (r as any).date_ajustement || r.date || dateStr,
      date_ajustement: (r as any).date_ajustement || r.date || dateStr,
      ordre: (r as any).order_index || r.ordre || 1,
      order_index: (r as any).order_index || r.ordre || 1,
    }));
}

export async function addManualAdjustment(
  adj: Partial<ManualAdjustment>
): Promise<ManualAdjustment> {
  await ensurePostgresConnection();
  const dateVal = String((adj as any).date_ajustement || adj.date || new Date().toISOString().split('T')[0]).trim();
  const timeSlotVal = String((adj as any).time_slot_id || adj.creneau || 'matin').trim();
  const gradeVal = String(adj.grade || 'Tous').trim();
  const teacherIdVal = String(adj.teacher_id || 'JulieCB').trim();
  const titreVal = String(adj.titre || (adj as any).titre_chapitre || 'Ajustement').trim() || 'Ajustement';
  const typeActiviteVal = String(adj.type_activite || 'Autre').trim() || 'Autre';
  
  const descriptionVal = adj.description && adj.description.trim() ? adj.description.trim() : null;
  const urlVal = adj.url && adj.url.trim() ? adj.url.trim() : null;
  const numExoVal = adj.numero_exercice && adj.numero_exercice.trim() ? adj.numero_exercice.trim() : null;
  const colorLabelVal = (adj as any).color_label && String((adj as any).color_label).trim() ? String((adj as any).color_label).trim() : null;
  
  const reportJ1Val = (adj as any).report_j1 ?? adj.reporter_au_lendemain ?? true;
  const rawOrder = (adj as any).order_index !== undefined ? (adj as any).order_index : adj.ordre;
  const orderIndexVal = rawOrder !== undefined && rawOrder !== null && !isNaN(Number(rawOrder)) ? Number(rawOrder) : null;
  const faitVal = Boolean(adj.fait);
  const progressionIdVal = adj.progression_id ? Number(adj.progression_id) : null;
  const originalDateVal = (adj as any).original_date && String((adj as any).original_date).trim() ? String((adj as any).original_date).trim() : null;
  const explicitId = (adj as any).id || (adj as any).db_id;

  if (isPostgresConnected && pool) {
    try {
      if (explicitId) {
        const updated = await pool.query(
          `UPDATE manual_adjustments
           SET progression_id = $1, date_ajustement = $2, date = $2, grade = $3, teacher_id = $4,
               titre = $5, type_activite = $6, description = $7, url = $8, numero_exercice = $9,
               report_j1 = $10, reporter_au_lendemain = $10, time_slot_id = $11, creneau = $11,
               order_index = COALESCE($12, order_index), ordre = COALESCE($12, ordre), fait = $13, color_label = $14, original_date = $15
           WHERE id = $16
           RETURNING *`,
          [
            progressionIdVal,
            dateVal,
            gradeVal,
            teacherIdVal,
            titreVal,
            typeActiviteVal,
            descriptionVal,
            urlVal,
            numExoVal,
            reportJ1Val,
            timeSlotVal,
            orderIndexVal,
            faitVal,
            colorLabelVal,
            originalDateVal,
            Number(explicitId),
          ]
        );
        if (updated.rows.length > 0) {
          const r = updated.rows[0];
          return {
            ...r,
            creneau: r.time_slot_id || r.creneau || timeSlotVal,
            time_slot_id: r.time_slot_id || r.creneau || timeSlotVal,
            date: r.date_ajustement || r.date || dateVal,
            date_ajustement: r.date_ajustement || r.date || dateVal,
            ordre: r.order_index || r.ordre || 1,
            order_index: r.order_index || r.ordre || 1,
            reporter_au_lendemain: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
            report_j1: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
            color_label: r.color_label || undefined,
          };
        }
      }

      // UPSERT behavior based on progression_id + date + creneau + type_activite + numero_exercice
      if (progressionIdVal) {
        const existing = await pool.query(
          `SELECT id FROM manual_adjustments
           WHERE progression_id = $1
             AND (date_ajustement::text = $2 OR date::text = $2)
             AND (COALESCE(time_slot_id, creneau) = $3 OR $3 IS NULL)
             AND (type_activite = $4 OR ($4 IS NULL AND type_activite IS NULL))
             AND (COALESCE(numero_exercice, '') = COALESCE($5, ''))
             AND (teacher_id = $6 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB')
           ORDER BY id DESC`,
          [progressionIdVal, dateVal, timeSlotVal, typeActiviteVal, numExoVal, teacherIdVal]
        );

        if (existing.rows.length > 0) {
          const targetId = existing.rows[0].id;
          const updated = await pool.query(
            `UPDATE manual_adjustments
             SET date_ajustement = $1, date = $1, grade = $2, teacher_id = $3,
                 titre = $4, type_activite = $5, description = $6, url = $7, numero_exercice = $8,
                 report_j1 = $9, reporter_au_lendemain = $9, time_slot_id = $10, creneau = $10,
                 order_index = COALESCE($11, order_index), ordre = COALESCE($11, ordre), fait = $12, color_label = $13, original_date = COALESCE($14, original_date)
             WHERE id = $15
             RETURNING *`,
            [
              dateVal,
              gradeVal,
              teacherIdVal,
              titreVal,
              typeActiviteVal,
              descriptionVal,
              urlVal,
              numExoVal,
              reportJ1Val,
              timeSlotVal,
              orderIndexVal,
              faitVal,
              colorLabelVal,
              originalDateVal,
              targetId,
            ]
          );
          const r = updated.rows[0];
          return {
            ...r,
            creneau: r.time_slot_id || r.creneau || timeSlotVal,
            time_slot_id: r.time_slot_id || r.creneau || timeSlotVal,
            date: r.date_ajustement || r.date || dateVal,
            date_ajustement: r.date_ajustement || r.date || dateVal,
            ordre: r.order_index || r.ordre || 1,
            order_index: r.order_index || r.ordre || 1,
            reporter_au_lendemain: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
            report_j1: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
            color_label: r.color_label || undefined,
          };
        }
      }

      const actionTypeVal = (adj as any).action_type || (adj as any).actionType || 'custom';
      const isBlankVal = Boolean((adj as any).is_blank || (adj as any).isBlank);

      try {
        const res = await pool.query(
          `INSERT INTO manual_adjustments
             (progression_id, date_ajustement, date, grade, teacher_id, titre, type_activite, description, url, numero_exercice, report_j1, reporter_au_lendemain, time_slot_id, creneau, order_index, ordre, fait, color_label, original_date, action_type, is_blank)
           VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $11, COALESCE($12, 1), COALESCE($12, 1), $13, $14, $15, $16, $17)
           RETURNING *`,
          [
            progressionIdVal,
            dateVal,
            gradeVal,
            teacherIdVal,
            titreVal,
            typeActiviteVal,
            descriptionVal,
            urlVal,
            numExoVal,
            reportJ1Val,
            timeSlotVal,
            orderIndexVal,
            faitVal,
            colorLabelVal,
            originalDateVal,
            actionTypeVal,
            isBlankVal,
          ]
        );
        const r = res.rows[0];
        return {
          ...r,
          creneau: r.time_slot_id || r.creneau || timeSlotVal,
          time_slot_id: r.time_slot_id || r.creneau || timeSlotVal,
          date: r.date_ajustement || r.date || dateVal,
          date_ajustement: r.date_ajustement || r.date || dateVal,
          ordre: r.order_index || r.ordre || orderIndexVal,
          order_index: r.order_index || r.ordre || orderIndexVal,
          reporter_au_lendemain: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
          report_j1: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
          color_label: r.color_label || undefined,
        };
      } catch (insertErr: any) {
        if (progressionIdVal) {
          const fallback = await pool.query(
            `UPDATE manual_adjustments
             SET date_ajustement = $1, date = $1, grade = $2, teacher_id = $3,
                 titre = $4, type_activite = $5, description = $6, url = $7, numero_exercice = $8,
                 report_j1 = $9, reporter_au_lendemain = $9, time_slot_id = $10, creneau = $10,
                 order_index = COALESCE($11, order_index), ordre = COALESCE($11, ordre), fait = $12, color_label = $13, original_date = COALESCE($14, original_date)
             WHERE progression_id = $15
               AND (date_ajustement::text = $1 OR date::text = $1)
               AND (COALESCE(time_slot_id, creneau) = $10 OR $10 IS NULL)
               AND (type_activite = $5 OR ($5 IS NULL AND type_activite IS NULL))
               AND (COALESCE(numero_exercice, '') = COALESCE($8, ''))
             RETURNING *`,
            [
              dateVal, gradeVal, teacherIdVal, titreVal, typeActiviteVal, descriptionVal,
              urlVal, numExoVal, reportJ1Val, timeSlotVal, orderIndexVal, faitVal, colorLabelVal,
              originalDateVal, progressionIdVal
            ]
          );
          if (fallback.rows.length > 0) {
            const r = fallback.rows[0];
            return {
              ...r,
              creneau: r.time_slot_id || r.creneau || timeSlotVal,
              time_slot_id: r.time_slot_id || r.creneau || timeSlotVal,
              date: r.date_ajustement || r.date || dateVal,
              date_ajustement: r.date_ajustement || r.date || dateVal,
              ordre: r.order_index || r.ordre || 1,
              order_index: r.order_index || r.ordre || 1,
              reporter_au_lendemain: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
              report_j1: r.report_j1 ?? r.reporter_au_lendemain ?? reportJ1Val,
              color_label: r.color_label || undefined,
            };
          }
        }
        throw insertErr;
      }
    } catch (err: any) {
      console.error('⚠️ [PostgreSQL addManualAdjustment Error]', err.message || err);
      throw err;
    }
  }

  let targetSimId = explicitId ? Number(explicitId) : null;
  if (!targetSimId && progressionIdVal) {
    const found = simManualAdjustments.find(
      (a) =>
        a.progression_id === progressionIdVal &&
        (a.date_ajustement || a.date) === dateVal &&
        (a.time_slot_id || a.creneau) === timeSlotVal &&
        a.type_activite === (typeActiviteVal || 'Autre') &&
        (a.numero_exercice || '') === (numExoVal || '')
    );
    if (found) {
      targetSimId = found.id;
    }
  }

  const created: ManualAdjustment = {
    id: targetSimId ? targetSimId : (simManualAdjustments.length > 0 ? Math.max(...simManualAdjustments.map((x) => x.id)) + 1 : 1),
    date: dateVal,
    date_ajustement: dateVal,
    creneau: timeSlotVal as any,
    time_slot_id: timeSlotVal,
    grade: gradeVal,
    teacher_id: teacherIdVal,
    titre: (adj.titre || (adj as any).titre_chapitre || 'Ajustement').trim(),
    description: descriptionVal || '',
    type_activite: adj.type_activite || 'Autre',
    url: urlVal || undefined,
    numero_exercice: numExoVal || undefined,
    color_label: colorLabelVal || undefined,
    reporter_au_lendemain: reportJ1Val,
    report_j1: reportJ1Val,
    ordre: orderIndexVal,
    order_index: orderIndexVal,
    fait: faitVal,
    is_custom: false,
    progression_id: progressionIdVal || undefined,
  };
  const idx = simManualAdjustments.findIndex((a) => a.id === created.id);
  if (idx >= 0) {
    simManualAdjustments[idx] = created;
  } else {
    simManualAdjustments.push(created);
  }
  return created;
}

export async function getBanaliseeStatusForDate(
  dateStr: string,
  creneau: 'matin' | 'aprem',
  teacherId = 'JulieCB'
): Promise<{ cumulativeCount: number; isBanaliseeToday: boolean }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT DISTINCT COALESCE(NULLIF(date_ajustement::text, ''), NULLIF(date::text, '')) as date
         FROM manual_adjustments
         WHERE (action_type = 'banalisee' OR is_blank = true OR type_activite = 'Banalisée')
           AND COALESCE(NULLIF(time_slot_id, ''), NULLIF(creneau, ''), 'matin') = $1
           AND COALESCE(NULLIF(date_ajustement::text, ''), NULLIF(date::text, '')) <= $2
           AND (teacher_id = $3 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher')`,
        [creneau, dateStr, teacherId]
      );
      const dates = res.rows.map((r) => String(r.date));
      const isBanaliseeToday = dates.includes(dateStr);
      return {
        cumulativeCount: dates.length,
        isBanaliseeToday,
      };
    } catch (err: any) {
      console.error('⚠️ Error querying banalisee adjustments:', err.message);
    }
  }

  const dates = Array.from(
    new Set(
      simManualAdjustments
        .filter(
          (a) =>
            ((a as any).action_type === 'banalisee' || (a as any).is_blank || a.type_activite === ('Banalisée' as any)) &&
            (a.creneau === creneau || (a as any).time_slot_id === creneau) &&
            ((a as any).date_ajustement || a.date || '') <= dateStr &&
            (a.teacher_id === teacherId || a.teacher_id === 'JulieCB' || !a.teacher_id)
        )
        .map((a) => (a as any).date_ajustement || a.date || '')
    )
  );

  return {
    cumulativeCount: dates.length,
    isBanaliseeToday: dates.includes(dateStr),
  };
}

export async function getUsefulDayInfo(
  dateStr: string,
  creneau: 'matin' | 'aprem',
  settings?: UserSettings,
  teacherId = 'JulieCB'
): Promise<{ usefulDay: number; delay: number; isBanaliseeToday: boolean; isWorkingDay: boolean; holidayReason?: string }> {
  if (!settings) {
    settings = await getUserSettings(teacherId);
  }
  const banaliseeStatus = await getBanaliseeStatusForDate(dateStr, creneau, teacherId);

  // The count of banalisations in manual_adjustments is the authoritative delay counter for this creneau
  const totalDelay = banaliseeStatus.cumulativeCount;
  const isBanaliseeToday = banaliseeStatus.isBanaliseeToday;

  const usefulInfo = calculateUsefulDayIndex(
    dateStr,
    {
      ...settings,
      delay_morning: creneau === 'matin' ? totalDelay : (settings.delay_morning || 0),
      delay_afternoon: creneau === 'aprem' ? totalDelay : (settings.delay_afternoon || 0),
      absences_count: creneau === 'matin' ? totalDelay : (settings.absences_count || 0),
    },
    creneau
  );

  return {
    usefulDay: usefulInfo.usefulDay,
    delay: totalDelay,
    isBanaliseeToday,
    isWorkingDay: usefulInfo.isWorkingDay,
    holidayReason: usefulInfo.holidayReason,
  };
}

export async function deleteBanaliseeAdjustment(
  dateStr: string,
  creneau: 'matin' | 'aprem',
  teacherId = 'JulieCB'
): Promise<boolean> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `DELETE FROM manual_adjustments
         WHERE (action_type = 'banalisee' OR is_blank = true OR type_activite = 'Banalisée')
           AND COALESCE(NULLIF(time_slot_id, ''), NULLIF(creneau, ''), 'matin') = $1
           AND COALESCE(NULLIF(date_ajustement::text, ''), NULLIF(date::text, '')) = $2
           AND (teacher_id = $3 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher')`,
        [creneau, dateStr, teacherId]
      );
      return true;
    } catch (err: any) {
      console.error('⚠️ Error deleting banalisee adjustment:', err.message);
    }
  }

  for (let i = simManualAdjustments.length - 1; i >= 0; i--) {
    const a = simManualAdjustments[i];
    const aDate = (a as any).date_ajustement || a.date;
    const aCreneau = a.creneau || (a as any).time_slot_id;
    if (
      aDate === dateStr &&
      aCreneau === creneau &&
      ((a as any).action_type === 'banalisee' || (a as any).is_blank || a.type_activite === ('Banalisée' as any))
    ) {
      simManualAdjustments.splice(i, 1);
    }
  }
  clearHomeworkCache();
  return true;
}

// ==========================================
// CUSTOM ACTIVITIES (NEON TABLE) METHODS
// ==========================================

// Helper function to resolve the effective position (time_slot_id & order_index)
// for a custom activity on a specific date, accounting for recurrence propagation
// and manual date-specific overrides.
export function resolveActivityPositionForDate(
  r: any,
  dateStr: string
): { time_slot_id: string; order_index: number } {
  const isRec = Boolean(r.recurrence && r.recurrence !== '' && r.recurrence !== 'aucune');
  const baseSlot = r.time_slot_id || r.creneau || 'matin';
  const baseOrder = r.order_index ?? r.ordre ?? 1;

  if (!isRec) {
    return { time_slot_id: baseSlot, order_index: baseOrder };
  }

  let overrides: Record<string, any> = {};
  if (r.position_overrides) {
    if (typeof r.position_overrides === 'string') {
      try {
        overrides = JSON.parse(r.position_overrides);
      } catch {
        overrides = {};
      }
    } else if (typeof r.position_overrides === 'object') {
      overrides = r.position_overrides;
    }
  }

  // 1. Direct manual override for dateStr (Priority: Manual override on specific date)
  if (overrides[dateStr]) {
    const ov = overrides[dateStr];
    return {
      time_slot_id: ov.time_slot_id || ov.creneau || baseSlot,
      order_index: ov.order_index ?? ov.ordre ?? baseOrder,
    };
  }

  // 2. Propagation from latest past occurrence date <= dateStr (Memorization: Last recorded position)
  const pastDates = Object.keys(overrides)
    .filter((d) => d <= dateStr)
    .sort((a, b) => b.localeCompare(a));

  if (pastDates.length > 0) {
    const latestDate = pastDates[0];
    const ov = overrides[latestDate];
    return {
      time_slot_id: ov.time_slot_id || ov.creneau || baseSlot,
      order_index: ov.order_index ?? ov.ordre ?? baseOrder,
    };
  }

  // 3. Fallback to default base position
  return { time_slot_id: baseSlot, order_index: baseOrder };
}

export async function getCustomActivities(
  dateStr: string,
  teacherId = 'JulieCB'
): Promise<ManualAdjustment[]> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM custom_activities
         WHERE ((date::text = $1 OR date_ajustement::text = $1)
            OR (recurrence IS NOT NULL AND recurrence != '' AND recurrence != 'aucune'
                AND (date IS NULL OR date::text <= $1)
                AND (date_fin IS NULL OR date_fin = '' OR date_fin::text >= $1)))
           AND (teacher_id = $2 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher')
         ORDER BY COALESCE(time_slot_id, creneau) ASC, COALESCE(order_index, ordre) ASC`,
        [dateStr, teacherId]
      );
      return res.rows.map((r) => {
        const startDate = r.date ? (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date)) : (r.original_date ? String(r.original_date) : dateStr);
        const origCreationDate = r.original_date ? (r.original_date instanceof Date ? r.original_date.toISOString().split('T')[0] : String(r.original_date)) : startDate;
        const adjDate = r.date_ajustement ? (r.date_ajustement instanceof Date ? r.date_ajustement.toISOString().split('T')[0] : String(r.date_ajustement)) : startDate;
        const pos = resolveActivityPositionForDate(r, dateStr);

        return {
          ...r,
          creneau: pos.time_slot_id as any,
          time_slot_id: pos.time_slot_id,
          date: startDate,
          original_date: origCreationDate,
          date_ajustement: adjDate,
          date_fin: r.date_fin ? String(r.date_fin) : null,
          ordre: pos.order_index,
          order_index: pos.order_index,
          is_custom: true,
          color_label: r.color_label || undefined,
          position_anchor: r.position_anchor || undefined,
          reporter_au_lendemain: r.reporter_au_lendemain ?? true,
          position_overrides: r.position_overrides || undefined,
        };
      });
    } catch (err: any) {
      console.error('⚠️ Error querying custom_activities from DB:', err.message);
    }
  }
  return simCustomActivities
    .filter(
      (a) =>
        (a.date === dateStr ||
          (a as any).date_ajustement === dateStr ||
          (a.recurrence &&
           a.recurrence !== 'aucune' &&
           (!a.date || a.date <= dateStr) &&
           (!(a as any).date_fin || (a as any).date_fin >= dateStr))) &&
        (a.teacher_id === teacherId || a.teacher_id === 'JulieCB' || !a.teacher_id)
    )
    .map((r) => {
      const pos = resolveActivityPositionForDate(r, dateStr);
      return {
        ...r,
        creneau: pos.time_slot_id as any,
        time_slot_id: pos.time_slot_id,
        date: r.date || (r as any).date_ajustement || dateStr,
        original_date: (r as any).original_date || r.date || dateStr,
        date_ajustement: (r as any).date_ajustement || r.date || dateStr,
        date_fin: (r as any).date_fin || null,
        ordre: pos.order_index,
        order_index: pos.order_index,
        position_anchor: r.position_anchor || undefined,
        is_custom: true,
      };
    });
}

export async function addCustomActivity(
  adj: Partial<ManualAdjustment>
): Promise<ManualAdjustment> {
  await ensurePostgresConnection();
  const startDateVal = String(adj.date || (adj as any).date_ajustement || new Date().toISOString().split('T')[0]).trim();
  const adjDateVal = String((adj as any).date_ajustement || adj.date || startDateVal).trim();
  const dateFinVal = (adj as any).date_fin && String((adj as any).date_fin).trim() ? String((adj as any).date_fin).trim() : null;
  const originalDateVal = (adj as any).original_date && String((adj as any).original_date).trim() ? String((adj as any).original_date).trim() : startDateVal;

  const timeSlotVal = String((adj as any).time_slot_id || adj.creneau || 'matin').trim();
  const gradeVal = String(adj.grade || 'Tous').trim();
  const teacherIdVal = String(adj.teacher_id || 'JulieCB').trim();
  const recurrenceVal = adj.recurrence || 'aucune';

  // Determine default reporter_au_lendemain based on user settings if not explicitly provided
  let reportJ1Val: boolean;
  if (adj.reporter_au_lendemain !== undefined && adj.reporter_au_lendemain !== null) {
    reportJ1Val = Boolean(adj.reporter_au_lendemain);
  } else if ((adj as any).report_j1 !== undefined && (adj as any).report_j1 !== null) {
    reportJ1Val = Boolean((adj as any).report_j1);
  } else {
    try {
      const settings = await getUserSettings(teacherIdVal);
      reportJ1Val = Boolean(settings?.auto_reschedule_enabled);
    } catch {
      reportJ1Val = false;
    }
  }
  
  const matiereVal = adj.matiere && adj.matiere.trim() ? adj.matiere.trim() : null;
  const domaineVal = adj.domaine && adj.domaine.trim() ? adj.domaine.trim() : null;
  const titreVal = String(adj.titre || (adj as any).titre_chapitre || 'Activité').trim() || 'Activité';
  const typeActiviteVal = String(adj.type_activite || 'Autre').trim() || 'Autre';
  const descriptionVal = adj.description && adj.description.trim() ? adj.description.trim() : null;
  const numExoVal = adj.numero_exercice && adj.numero_exercice.trim() ? adj.numero_exercice.trim() : null;
  const pastelColorVal = adj.pastel_color && adj.pastel_color.trim() ? adj.pastel_color.trim() : null;
  const urlVal = adj.url && adj.url.trim() ? adj.url.trim() : null;
  const colorLabelVal = (adj as any).color_label && String((adj as any).color_label).trim() ? String((adj as any).color_label).trim() : null;
  const positionAnchorVal = adj.position_anchor && String(adj.position_anchor).trim() ? String(adj.position_anchor).trim() : null;
  
  const rawOrderCustom = (adj as any).order_index !== undefined ? (adj as any).order_index : adj.ordre;
  const orderIndexVal = rawOrderCustom !== undefined && rawOrderCustom !== null && !isNaN(Number(rawOrderCustom)) ? Number(rawOrderCustom) : 1;
  const faitVal = Boolean(adj.fait);
  const explicitId = (adj as any).id || (adj as any).db_id;

  const initialOverrides = recurrenceVal !== 'aucune' ? JSON.stringify({
    [startDateVal]: {
      time_slot_id: timeSlotVal,
      creneau: timeSlotVal,
      order_index: orderIndexVal,
      ordre: orderIndexVal,
      position_anchor: positionAnchorVal,
    }
  }) : JSON.stringify({});

  if (isPostgresConnected && pool) {
    try {
      if (explicitId) {
        const updated = await pool.query(
          `UPDATE custom_activities
           SET date = COALESCE($1, date),
               date_fin = $2,
               date_ajustement = COALESCE($3, date_ajustement),
               recurrence = COALESCE($4, recurrence),
               grade = COALESCE($5, grade),
               teacher_id = COALESCE($6, teacher_id),
               time_slot_id = COALESCE($7, time_slot_id),
               creneau = COALESCE($7, creneau),
               matiere = COALESCE($8, matiere),
               domaine = COALESCE($9, domaine),
               titre = COALESCE($10, titre),
               type_activite = COALESCE($11, type_activite),
               description = COALESCE($12, description),
               numero_exercice = COALESCE($13, numero_exercice),
               pastel_color = COALESCE($14, pastel_color),
               url = COALESCE($15, url),
               order_index = COALESCE($16, order_index),
               ordre = COALESCE($16, ordre),
               fait = COALESCE($17, fait),
               color_label = COALESCE($18, color_label),
               original_date = COALESCE($19, original_date),
               reporter_au_lendemain = COALESCE($20, reporter_au_lendemain),
               position_anchor = COALESCE($21, position_anchor)
           WHERE id = $22
           RETURNING *`,
          [
            adj.date ? String(adj.date).trim() : startDateVal,
            dateFinVal,
            (adj as any).date_ajustement ? String((adj as any).date_ajustement).trim() : null,
            adj.recurrence !== undefined ? adj.recurrence : null,
            adj.grade !== undefined ? String(adj.grade).trim() : null,
            adj.teacher_id !== undefined ? String(adj.teacher_id).trim() : null,
            (adj as any).time_slot_id || adj.creneau ? String((adj as any).time_slot_id || adj.creneau).trim() : null,
            adj.matiere !== undefined ? (adj.matiere && adj.matiere.trim() ? adj.matiere.trim() : null) : null,
            adj.domaine !== undefined ? (adj.domaine && adj.domaine.trim() ? adj.domaine.trim() : null) : null,
            adj.titre || (adj as any).titre_chapitre ? String(adj.titre || (adj as any).titre_chapitre).trim() : null,
            adj.type_activite !== undefined ? String(adj.type_activite).trim() : null,
            adj.description !== undefined ? (adj.description && adj.description.trim() ? adj.description.trim() : null) : null,
            adj.numero_exercice !== undefined ? (adj.numero_exercice && adj.numero_exercice.trim() ? adj.numero_exercice.trim() : null) : null,
            adj.pastel_color !== undefined ? (adj.pastel_color && adj.pastel_color.trim() ? adj.pastel_color.trim() : null) : null,
            adj.url !== undefined ? (adj.url && adj.url.trim() ? adj.url.trim() : null) : null,
            orderIndexVal,
            adj.fait !== undefined ? Boolean(adj.fait) : null,
            (adj as any).color_label !== undefined ? ((adj as any).color_label ? String((adj as any).color_label).trim() : null) : null,
            (adj as any).original_date !== undefined ? ((adj as any).original_date ? String((adj as any).original_date).trim() : null) : null,
            adj.reporter_au_lendemain !== undefined ? Boolean(adj.reporter_au_lendemain) : null,
            positionAnchorVal,
            Number(explicitId),
          ]
        );
        if (updated.rows.length > 0) {
          const r = updated.rows[0];
          return {
            ...r,
            creneau: r.time_slot_id || r.creneau || timeSlotVal,
            time_slot_id: r.time_slot_id || r.creneau || timeSlotVal,
            date: r.date || startDateVal,
            original_date: r.original_date || originalDateVal,
            date_ajustement: r.date_ajustement || adjDateVal,
            date_fin: r.date_fin || null,
            ordre: r.order_index || r.ordre || 1,
            order_index: r.order_index || r.ordre || 1,
            is_custom: true,
            color_label: r.color_label || undefined,
            position_anchor: r.position_anchor || positionAnchorVal || undefined,
            reporter_au_lendemain: r.reporter_au_lendemain ?? reportJ1Val,
            report_j1: r.reporter_au_lendemain ?? reportJ1Val,
          };
        }
      }

      const res = await pool.query(
        `INSERT INTO custom_activities
           (date_ajustement, date, date_fin, recurrence, grade, teacher_id, time_slot_id, creneau, matiere, domaine, titre, type_activite, description, numero_exercice, pastel_color, url, order_index, ordre, fait, color_label, original_date, reporter_au_lendemain, position_anchor, position_overrides)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16, 1), COALESCE($16, 1), $17, $18, $19, $20, $21, $22::jsonb)
         RETURNING *`,
        [
          adjDateVal,
          startDateVal,
          dateFinVal,
          recurrenceVal,
          gradeVal,
          teacherIdVal,
          timeSlotVal,
          matiereVal,
          domaineVal,
          titreVal,
          typeActiviteVal,
          descriptionVal,
          numExoVal,
          pastelColorVal,
          urlVal,
          orderIndexVal,
          faitVal,
          colorLabelVal,
          originalDateVal,
          reportJ1Val,
          positionAnchorVal,
          initialOverrides,
        ]
      );
      const r = res.rows[0];
      return {
        ...r,
        creneau: r.time_slot_id || r.creneau || timeSlotVal,
        time_slot_id: r.time_slot_id || r.creneau || timeSlotVal,
        date: r.date || startDateVal,
        original_date: r.original_date || originalDateVal,
        date_ajustement: r.date_ajustement || adjDateVal,
        date_fin: r.date_fin || null,
        ordre: r.order_index || r.ordre || orderIndexVal,
        order_index: r.order_index || r.ordre || orderIndexVal,
        is_custom: true,
        color_label: r.color_label || undefined,
        position_anchor: r.position_anchor || positionAnchorVal || undefined,
        reporter_au_lendemain: r.reporter_au_lendemain ?? reportJ1Val,
        report_j1: r.reporter_au_lendemain ?? reportJ1Val,
      };
    } catch (err: any) {
      console.error('⚠️ [PostgreSQL addCustomActivity Error]', err.message || err);
      throw err;
    }
  }

  const created: ManualAdjustment = {
    id: explicitId ? Number(explicitId) : (simCustomActivities.length > 0 ? Math.max(...simCustomActivities.map((x) => x.id)) + 1 : 1),
    date: startDateVal,
    original_date: originalDateVal,
    date_ajustement: adjDateVal,
    date_fin: dateFinVal,
    creneau: timeSlotVal as any,
    time_slot_id: timeSlotVal,
    grade: gradeVal,
    teacher_id: teacherIdVal,
    recurrence: recurrenceVal,
    matiere: matiereVal || undefined,
    domaine: domaineVal || undefined,
    titre: titreVal,
    description: descriptionVal || '',
    type_activite: adj.type_activite || 'Autre',
    reporter_au_lendemain: reportJ1Val,
    report_j1: reportJ1Val,
    numero_exercice: numExoVal || undefined,
    pastel_color: pastelColorVal || undefined,
    url: urlVal || undefined,
    color_label: colorLabelVal || undefined,
    position_anchor: positionAnchorVal || undefined,
    ordre: orderIndexVal || 1,
    order_index: orderIndexVal || 1,
    fait: faitVal,
    is_custom: true,
    position_overrides: recurrenceVal !== 'aucune' ? {
      [startDateVal]: {
        time_slot_id: timeSlotVal,
        creneau: timeSlotVal,
        order_index: orderIndexVal || 1,
        ordre: orderIndexVal || 1,
        position_anchor: positionAnchorVal,
      }
    } : {},
  };
  const idx = simCustomActivities.findIndex((a) => a.id === created.id);
  if (idx >= 0) {
    simCustomActivities[idx] = created;
  } else {
    simCustomActivities.push(created);
  }
  return created;
}

export async function updateActivityPosition(params: {
  id?: number | string;
  db_id?: number;
  progression_id?: number;
  is_custom?: boolean;
  source?: string;
  date: string;
  time_slot_id: string;
  order_index: number;
  grade?: string;
  teacher_id?: string;
  titre?: string;
  type_activite?: string;
  description?: string;
  numero_exercice?: string;
}): Promise<{ success: boolean }> {
  await ensurePostgresConnection();
  const timeSlotId = params.time_slot_id;
  const orderIndex = Number(params.order_index);
  const dateStr = params.date;
  const teacherId = params.teacher_id || 'JulieCB';
  const grade = params.grade || 'Tous';
  const dbId = params.db_id || (typeof params.id === 'number' ? params.id : undefined);

  if (isPostgresConnected && pool) {
    try {
      // 1. Direct PK check: If dbId is provided, perform direct UPDATE on the target table
      if (dbId) {
        // A) Check custom_activities table
        const customFetch = await pool.query(
          `SELECT * FROM custom_activities WHERE id = $1`,
          [dbId]
        );

        if (customFetch.rows.length > 0) {
          const actRow = customFetch.rows[0];
          const isRecurring = Boolean(
            actRow.recurrence && actRow.recurrence !== '' && actRow.recurrence !== 'aucune'
          );

          if (isRecurring) {
            let overrides: Record<string, any> = {};
            if (actRow.position_overrides) {
              if (typeof actRow.position_overrides === 'string') {
                try { overrides = JSON.parse(actRow.position_overrides); } catch { overrides = {}; }
              } else if (typeof actRow.position_overrides === 'object') {
                overrides = { ...actRow.position_overrides };
              }
            }

            overrides[dateStr] = {
              time_slot_id: timeSlotId,
              creneau: timeSlotId,
              order_index: orderIndex,
              ordre: orderIndex,
            };

            const allOverrideDates = Object.keys(overrides).sort();
            const latestOverrideDate = allOverrideDates[allOverrideDates.length - 1];
            const updateBase = dateStr >= latestOverrideDate;

            if (updateBase) {
              await pool.query(
                `UPDATE custom_activities
                 SET position_overrides = $1::jsonb,
                     time_slot_id = $2, creneau = $2,
                     order_index = $3, ordre = $3
                 WHERE id = $4`,
                [JSON.stringify(overrides), timeSlotId, orderIndex, dbId]
              );
            } else {
              await pool.query(
                `UPDATE custom_activities
                 SET position_overrides = $1::jsonb
                 WHERE id = $2`,
                [JSON.stringify(overrides), dbId]
              );
            }
            return { success: true };
          } else {
            await pool.query(
              `UPDATE custom_activities
               SET time_slot_id = $1, creneau = $1, order_index = $2, ordre = $2
               WHERE id = $3`,
              [timeSlotId, orderIndex, dbId]
            );
            return { success: true };
          }
        }

        // B) Check manual_adjustments table directly by Primary Key (dbId)
        const manualFetch = await pool.query(
          `SELECT id FROM manual_adjustments WHERE id = $1`,
          [dbId]
        );

        if (manualFetch.rows.length > 0) {
          // Direct UPDATE on existing manual adjustment: only update position, keep all textual data intact
          await pool.query(
            `UPDATE manual_adjustments
             SET time_slot_id = $1, creneau = $1, order_index = $2, ordre = $2
             WHERE id = $3`,
            [timeSlotId, orderIndex, dbId]
          );
          return { success: true };
        }
      }

      // 2. Fallback: Native spiral card that has not yet been adjusted (no dbId or dbId not found in DB)
      if (params.progression_id) {
        const progId = Number(params.progression_id);
        const existing = await pool.query(
          `SELECT id FROM manual_adjustments
           WHERE progression_id = $1
             AND (date_ajustement::text = $2 OR date::text = $2)
             AND (teacher_id = $3 OR teacher_id IS NULL OR teacher_id = 'JulieCB')`,
          [progId, dateStr, teacherId]
        );

        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE manual_adjustments
             SET time_slot_id = $1, creneau = $1, order_index = $2, ordre = $2
             WHERE id = $3`,
            [timeSlotId, orderIndex, existing.rows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO manual_adjustments
               (progression_id, date_ajustement, date, grade, teacher_id, time_slot_id, creneau, order_index, ordre, titre, type_activite, description, numero_exercice)
             VALUES ($1, $2, $2, $3, $4, $5, $5, $6, $6, $7, $8, $9, $10)`,
            [
              progId,
              dateStr,
              grade,
              teacherId,
              timeSlotId,
              orderIndex,
              params.titre || 'Activité spiralaire',
              params.type_activite || 'Autre',
              params.description || null,
              params.numero_exercice || null,
            ]
          );
        }
        return { success: true };
      }

      return { success: true };
    } catch (err: any) {
      console.error('⚠️ [updateActivityPosition Error]', err.message);
      throw err;
    }
  }

  // Simulation mode
  if (dbId) {
    const act = simCustomActivities.find((a) => a.id === dbId);
    if (act) {
      const isRecurring = Boolean(act.recurrence && act.recurrence !== '' && act.recurrence !== 'aucune');
      if (isRecurring) {
        if (!act.position_overrides) act.position_overrides = {};
        if (typeof act.position_overrides === 'string') {
          try { act.position_overrides = JSON.parse(act.position_overrides); } catch { act.position_overrides = {}; }
        }
        (act.position_overrides as Record<string, any>)[dateStr] = {
          time_slot_id: timeSlotId,
          creneau: timeSlotId,
          order_index: orderIndex,
          ordre: orderIndex,
        };
        const allOverrideDates = Object.keys(act.position_overrides as Record<string, any>).sort();
        if (dateStr >= allOverrideDates[allOverrideDates.length - 1]) {
          act.time_slot_id = timeSlotId;
          act.creneau = timeSlotId as any;
          act.order_index = orderIndex;
          act.ordre = orderIndex;
        }
      } else {
        act.time_slot_id = timeSlotId;
        act.creneau = timeSlotId as any;
        act.order_index = orderIndex;
        act.ordre = orderIndex;
      }
    }
  }

  return { success: true };
}

export async function deleteCustomActivity(id: number): Promise<{ success: boolean }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      await pool.query('DELETE FROM custom_activities WHERE id = $1', [Number(id)]);
      return { success: true };
    } catch (err: any) {
      console.error('⚠️ [PostgreSQL deleteCustomActivity Error]', err.message || err);
      throw err;
    }
  }
  simCustomActivities = simCustomActivities.filter((a) => a.id !== Number(id));
  return { success: true };
}

let simActivityCompletions: {
  activity_id: number;
  activity_type: string;
  date: string;
  done: boolean;
  teacher_id: string;
}[] = [];

export async function getActivityCompletionsForDate(
  dateStr: string,
  teacherId = 'JulieCB'
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT activity_id, activity_type, done FROM activity_completions
         WHERE date = $1 AND (teacher_id = $2 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB')`,
        [dateStr, teacherId]
      );
      for (const row of res.rows) {
        map.set(`${row.activity_type || 'custom'}-${row.activity_id}`, Boolean(row.done));
      }
      return map;
    } catch (err: any) {
      console.error('⚠️ Error querying activity_completions:', err.message);
    }
  }
  for (const item of simActivityCompletions) {
    if (item.date === dateStr && (item.teacher_id === teacherId || item.teacher_id === 'JulieCB')) {
      map.set(`${item.activity_type || 'custom'}-${item.activity_id}`, item.done);
    }
  }
  return map;
}

export async function setActivityCompletion(
  activityId: number,
  activityType: string,
  dateStr: string,
  done: boolean,
  teacherId = 'JulieCB'
): Promise<void> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO activity_completions (activity_id, activity_type, date, done, teacher_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (activity_id, activity_type, date, teacher_id)
         DO UPDATE SET done = EXCLUDED.done`,
        [activityId, activityType, dateStr, Boolean(done), teacherId]
      );
      return;
    } catch (err: any) {
      console.error('⚠️ Error setting activity completion:', err.message);
    }
  }
  const idx = simActivityCompletions.findIndex(
    (c) => c.activity_id === activityId && c.activity_type === activityType && c.date === dateStr
  );
  if (idx !== -1) {
    simActivityCompletions[idx].done = done;
  } else {
    simActivityCompletions.push({
      activity_id: activityId,
      activity_type: activityType,
      date: dateStr,
      done,
      teacher_id: teacherId,
    });
  }
}

export async function toggleAdjustmentDone(
  id?: number | string,
  fait?: boolean,
  dateStr?: string,
  card?: any,
  teacherId = 'JulieCB'
): Promise<{ success: boolean }> {
  await ensurePostgresConnection();
  const targetId = id ? Number(id) : (card?.db_id ? Number(card.db_id) : undefined);
  const targetDate = dateStr || (card && card.date) || new Date().toISOString().split('T')[0];
  const isDone = Boolean(fait);

  if (!targetId || isNaN(targetId)) {
    return { success: true };
  }

  let isRecurring = Boolean(card?.recurrence && card.recurrence !== 'aucune');
  let activityType: 'custom' | 'manual' = (card?.is_custom || card?.source === 'custom') ? 'custom' : 'manual';

  if (isPostgresConnected && pool) {
    try {
      if (!card?.is_custom && card?.source !== 'custom') {
        const cRes = await pool.query(`SELECT id, recurrence FROM custom_activities WHERE id = $1`, [targetId]);
        if (cRes.rows.length > 0) {
          activityType = 'custom';
          if (cRes.rows[0].recurrence && cRes.rows[0].recurrence !== 'aucune') {
            isRecurring = true;
          }
        } else {
          const mRes = await pool.query(`SELECT id, recurrence FROM manual_adjustments WHERE id = $1`, [targetId]);
          if (mRes.rows.length > 0) {
            activityType = 'manual';
            if (mRes.rows[0].recurrence && mRes.rows[0].recurrence !== 'aucune') {
              isRecurring = true;
            }
          }
        }
      }

      await setActivityCompletion(targetId, activityType, targetDate, isDone, teacherId);

      if (!isRecurring) {
        if (activityType === 'custom') {
          await pool.query('UPDATE custom_activities SET fait = $1 WHERE id = $2', [isDone, targetId]);
        } else {
          await pool.query('UPDATE manual_adjustments SET fait = $1 WHERE id = $2', [isDone, targetId]);
        }
      }
      return { success: true };
    } catch (err: any) {
      console.error('⚠️ [PostgreSQL toggleAdjustmentDone Error]', err.message || err);
    }
  }

  await setActivityCompletion(targetId, activityType, targetDate, isDone, teacherId);
  if (!isRecurring) {
    if (activityType === 'custom') {
      const t1 = simCustomActivities.find((a) => a.id === targetId);
      if (t1) t1.fait = isDone;
    } else {
      const t2 = simManualAdjustments.find((a) => a.id === targetId);
      if (t2) t2.fait = isDone;
    }
  }
  return { success: true };
}

export async function deleteManualAdjustment(id: number): Promise<{ success: boolean }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      await pool.query('DELETE FROM custom_activities WHERE id = $1', [Number(id)]);
      await pool.query('DELETE FROM manual_adjustments WHERE id = $1', [Number(id)]);
      return { success: true };
    } catch (err: any) {
      console.error('⚠️ [PostgreSQL deleteManualAdjustment Error]', err.message || err);
      throw err;
    }
  }
  simCustomActivities = simCustomActivities.filter((a) => a.id !== Number(id));
  simManualAdjustments = simManualAdjustments.filter((a) => a.id !== Number(id));
  return { success: true };
}

/**
 * Report une activité individuelle au prochain jour travaillé :
 * Met à jour la bonne table selon la source (manual_adjustments avec report_j1=true ou custom_activities avec reporter_au_lendemain=true)
 * en conservant date = date initiale et en faisant avancer date_ajustement.
 */
export async function reportSingleActivity(
  id: number | string | undefined,
  source: string | undefined,
  currentDate: string,
  teacherId = 'JulieCB',
  card?: any
): Promise<{ success: boolean; nextWorkingDate: string }> {
  const settings = await getUserSettings(teacherId);
  const nextWorkingDate = getNextWorkingDateStr(currentDate, settings);

  const dbId = id ? Number(id) : (card?.db_id ? Number(card.db_id) : undefined);
  const isSpiral = Boolean(card?.progression_id || card?.source === 'progression' || (card && card.is_custom === false));
  const isCustom = isSpiral ? false : (source === 'custom' || card?.is_custom === true);

  await ensurePostgresConnection();

  if (isPostgresConnected && pool) {
    if (isCustom) {
      if (dbId && !isNaN(dbId)) {
        await pool.query(
          `UPDATE custom_activities
           SET date_ajustement = $1,
               reporter_au_lendemain = true,
               original_date = COALESCE(original_date, date, $2),
               date = COALESCE(date, $2)
           WHERE id = $3`,
          [nextWorkingDate, currentDate, dbId]
        );
      } else if (card) {
        await pool.query(
          `INSERT INTO custom_activities
             (date, date_ajustement, original_date, creneau, grade, teacher_id, titre, type_activite, description, url, numero_exercice, color_label, fait, reporter_au_lendemain)
           VALUES ($1, $2, $1, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, true)`,
          [
            currentDate,
            nextWorkingDate,
            card.creneau || 'matin',
            card.grade || 'Tous',
            teacherId,
            card.titre || card.titre_chapitre || 'Activité',
            card.type_activite || 'Autre',
            card.description || null,
            card.url || null,
            card.numero_exercice || null,
            card.color_label || null,
          ]
        );
      }
    } else {
      // Séquence spiralaire -> table manual_adjustments (colonne report_j1)
      const progId = card?.progression_id ? Number(card.progression_id) : undefined;
      let targetId = dbId && !isNaN(dbId) ? dbId : undefined;

      if (!targetId && progId) {
        const existing = await pool.query(
          `SELECT id FROM manual_adjustments
           WHERE progression_id = $1
             AND (teacher_id = $2 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB' OR teacher_id = 'default_teacher')
           ORDER BY id DESC`,
          [progId, teacherId]
        );
        if (existing.rows.length > 0) {
          targetId = existing.rows[0].id;
          if (existing.rows.length > 1) {
            await pool.query(
              `DELETE FROM manual_adjustments WHERE progression_id = $1 AND id != $2`,
              [progId, targetId]
            );
          }
        }
      }

      if (targetId) {
        await pool.query(
          `UPDATE manual_adjustments
           SET date_ajustement = $1,
               report_j1 = true,
               reporter_au_lendemain = true,
               date = COALESCE(date, $2),
               original_date = COALESCE(original_date, date, $2),
               creneau = COALESCE(NULLIF($9, ''), creneau),
               time_slot_id = COALESCE(NULLIF($9, ''), time_slot_id),
               grade = COALESCE(NULLIF($10, ''), grade),
               titre = COALESCE(NULLIF($4, ''), titre),
               description = COALESCE(NULLIF($5, ''), description),
               url = COALESCE(NULLIF($6, ''), url),
               numero_exercice = COALESCE(NULLIF($7, ''), numero_exercice),
               color_label = COALESCE(NULLIF($8, ''), color_label)
           WHERE id = $3`,
          [
            nextWorkingDate,
            currentDate,
            targetId,
            card?.titre_chapitre || card?.titre || '',
            card?.description || '',
            card?.url || '',
            card?.numero_exercice || '',
            card?.color_label || '',
            card?.creneau || card?.time_slot_id || '',
            card?.grade || '',
          ]
        );
      } else if (card) {
        try {
          const inserted = await pool.query(
            `INSERT INTO manual_adjustments
               (progression_id, date, date_ajustement, original_date, creneau, grade, teacher_id, titre, type_activite, description, url, numero_exercice, color_label, fait, report_j1, reporter_au_lendemain)
             VALUES ($1, $2, $3, $2, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, true, true)
             RETURNING id`,
            [
              progId || null,
              currentDate,
              nextWorkingDate,
              card.creneau || 'matin',
              card.grade || 'Tous',
              teacherId,
              card.titre_chapitre || card.titre || 'Activité',
              card.type_activite || 'Autre',
              card.description || null,
              card.url || null,
              card.numero_exercice || null,
              card.color_label || null,
            ]
          );
          if (inserted.rows.length > 0) {
            targetId = inserted.rows[0].id;
          }
        } catch (insertErr) {
          if (progId) {
            await pool.query(
              `UPDATE manual_adjustments
               SET date_ajustement = $1,
                   report_j1 = true,
                   reporter_au_lendemain = true,
                   original_date = COALESCE(original_date, date, $2)
               WHERE progression_id = $3`,
              [nextWorkingDate, currentDate, progId]
            );
          }
        }
      }

      if (progId && targetId) {
        await pool.query(
          `DELETE FROM manual_adjustments
           WHERE progression_id = $1
             AND id != $2`,
          [progId, targetId]
        );
      }
    }
  } else {
    // Mode simulation
    if (isCustom) {
      const sim = simCustomActivities.find((a) => a.id === dbId);
      if (sim) {
        (sim as any).date_ajustement = nextWorkingDate;
        sim.reporter_au_lendemain = true;
        if (!sim.date) sim.date = currentDate;
      } else if (card) {
        simCustomActivities.push({
          id: simCustomActivities.length + 1,
          date: currentDate,
          date_ajustement: nextWorkingDate,
          creneau: card.creneau || 'matin',
          grade: card.grade || 'Tous',
          teacher_id: teacherId,
          titre: card.titre || card.titre_chapitre || 'Activité',
          type_activite: card.type_activite || 'Autre',
          description: card.description || '',
          ordre: 1,
          fait: false,
          reporter_au_lendemain: true,
          is_custom: true,
        });
      }
    } else {
      const progId = card?.progression_id ? Number(card.progression_id) : undefined;
      let sim = dbId ? simManualAdjustments.find((a) => a.id === dbId) : undefined;
      if (!sim && progId) {
        sim = simManualAdjustments.find((a) => a.progression_id === progId);
      }
      if (sim) {
        (sim as any).date_ajustement = nextWorkingDate;
        (sim as any).report_j1 = true;
        sim.reporter_au_lendemain = true;
        if (!sim.date) sim.date = currentDate;
      } else if (card) {
        const newSim: ManualAdjustment = {
          id: simManualAdjustments.length > 0 ? Math.max(...simManualAdjustments.map((x) => x.id)) + 1 : 1,
          progression_id: card.progression_id,
          date: currentDate,
          date_ajustement: nextWorkingDate,
          creneau: card.creneau || 'matin',
          grade: card.grade || 'Tous',
          teacher_id: teacherId,
          titre: card.titre_chapitre || card.titre || 'Activité',
          type_activite: card.type_activite || 'Autre',
          description: card.description || '',
          ordre: 1,
          fait: false,
          reporter_au_lendemain: true,
          report_j1: true,
          is_custom: false,
        };
        simManualAdjustments.push(newSim);
        sim = newSim;
      }
      if (progId && sim) {
        simManualAdjustments = simManualAdjustments.filter(
          (a) => !(a.progression_id === progId && (a.date_ajustement === nextWorkingDate || a.date === nextWorkingDate) && a.id !== sim.id)
        );
      }
    }
  }

  return { success: true, nextWorkingDate };
}

/**
 * Logique de Report au jour x (Postponement):
 * Identifies all uncompleted activities (fait = false) for current date
 * and updates date_ajustement to next working date without deleting original records or modifying date.
 */
export async function reportUndoneActivitiesToNextWorkingDay(
  dateStr: string,
  teacherId = 'JulieCB',
  uncompletedCards?: ActivityCardItem[]
): Promise<{ postponedCount: number; count: number; targetDate: string; success: boolean }> {
  const settings = await getUserSettings(teacherId);
  const nextWorkingDate = getNextWorkingDateStr(dateStr, settings);

  let cardsToProcess: ActivityCardItem[] = uncompletedCards || [];

  if (!uncompletedCards || uncompletedCards.length === 0) {
    const existingAdj = await getManualAdjustments(dateStr, teacherId);
    const existingCustom = await getCustomActivities(dateStr, teacherId);
    cardsToProcess = [
      ...existingAdj.filter((a) => !a.fait).map((a) => ({
        ...a,
        id: `adj-${a.id}`,
        source: 'manual' as const,
        is_custom: false,
        db_id: a.id,
        competence_code: a.competence_code || 'PERSO',
        titre_chapitre: a.titre || 'Activité',
      })),
      ...existingCustom.filter((a) => !a.fait).map((a) => ({
        ...a,
        id: `custom-${a.id}`,
        source: 'manual' as const,
        is_custom: true,
        db_id: a.id,
        competence_code: a.competence_code || 'AUTRE',
        titre_chapitre: a.titre || 'Activité',
      })),
    ];
  }

  // Strictly filter by active_grades
  const activeGrades = (settings.active_grades && settings.active_grades.length > 0)
    ? settings.active_grades.map(g => g.trim().toUpperCase())
    : ['CE1', 'CE2', 'CM1', 'CM2'];

  cardsToProcess = cardsToProcess.filter((item) => {
    if (item.fait) return false;
    // Rule of Primacy: Individual card exception (reporter_au_lendemain === false OR report_j1 === false) overrides everything
    if (item.reporter_au_lendemain === false || (item as any).report_j1 === false) return false;
    const itemGrade = (item.grade || '').trim().toUpperCase();
    if (!itemGrade || itemGrade === 'TOUS') return true;
    return activeGrades.includes(itemGrade);
  });

  let count = 0;
  for (const item of cardsToProcess) {
    const targetSource = item.source || (item.is_custom ? 'custom' : 'manual');
    await reportSingleActivity(item.db_id, targetSource, dateStr, teacherId, item);
    count++;
  }

  return { postponedCount: count, count, targetDate: nextWorkingDate, success: true };
}

// ==========================================
// HOMEWORK (NEON TABLE) METHODS
// ==========================================

export async function getHomework(
  gradeFilter?: string,
  teacherId = 'JulieCB'
): Promise<HomeworkAdjustment[]> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    let sql = 'SELECT * FROM homework_manual_adjustments WHERE teacher_id = $1';
    const params: any[] = [teacherId];
    if (gradeFilter && gradeFilter !== 'Tous') {
      sql += ' AND (grade = $2 OR grade = $3)';
      params.push(gradeFilter, 'Tous');
    }
    sql += ' ORDER BY date_due ASC';
    const res = await pool.query(sql, params);
    return res.rows.map(row => ({
      ...row,
      date_due: row.date_due || row.date_echeance,
      date_echeance: row.date_echeance || row.date_due,
      titre_chapitre: row.titre_chapitre || row.modified_text || (row.subject && row.subject !== 'Général' ? row.subject : undefined),
      description: row.description || '',
      modified_text: row.titre_chapitre || row.modified_text || undefined,
      url: row.url || row.modified_url || undefined,
      is_hidden: Boolean(row.is_hidden),
      priority_status: row.priority_status || 'prioritaire',
      source_task_id: row.source_task_id || row.competence_code || (row.subject && row.subject !== 'Général' ? row.subject : null) || `task_${row.id}`,
    }));
  }

  let list = simHomework.filter((h) => h.teacher_id === teacherId);
  if (gradeFilter && gradeFilter !== 'Tous') {
    list = list.filter((h) => h.grade === gradeFilter || h.grade === 'Tous');
  }
  return list.sort((a, b) => a.date_due.localeCompare(b.date_due));
}

export async function getHomeworkConstraintsDiagnostic(): Promise<any> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const idxRes = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'homework_manual_adjustments';`
      );
      const conRes = await pool.query(
        `SELECT conname, pg_get_constraintdef(oid) as constraint_def
         FROM pg_constraint
         WHERE conrelid = 'homework_manual_adjustments'::regclass;`
      );
      return {
        isPostgresConnected: true,
        indexes: idxRes.rows,
        constraints: conRes.rows,
      };
    } catch (err: any) {
      return {
        isPostgresConnected: true,
        error: err?.message || err,
      };
    }
  }
  return { isPostgresConnected: false, mode: 'memory' };
}

export async function upsertHomeworkAdjustment(
  hw: Record<string, any>
): Promise<HomeworkAdjustment> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  const teacherId = hw.teacher_id || 'JulieCB';
  const dateEcheance = hw.date_echeance || hw.date_due || new Date().toISOString().split('T')[0];
  const dateDue = hw.date_due || dateEcheance;
  const dateAssigned = hw.date_assigned || dateEcheance;
  const grade = hw.grade || 'CE2';
  const subject = hw.subject || 'Général';
  const titreChapitre = hw.titre_chapitre || hw.modified_text || (subject !== 'Général' ? subject : null);
  const description = hw.description !== undefined && hw.description !== null ? String(hw.description) : '';
  const modifiedText = hw.modified_text || titreChapitre || description;
  const competenceCode = hw.competence_code || null;
  const url = hw.url || hw.modified_url || null;
  const modifiedUrl = hw.modified_url || url;
  const isHidden = hw.is_hidden ?? false;
  const priorityStatus = hw.priority_status || 'prioritaire';
  const done = hw.done ?? hw.is_completed ?? false;
  const difficultyLevel = hw.difficulty_level || 'standard';
  const dayOfLife = hw.day_of_life ?? null;

  let sourceTaskId = hw.source_task_id;
  if (competenceCode) {
    sourceTaskId = competenceCode;
  } else if (!sourceTaskId) {
    if (hw.id && hw.id > 0) {
      sourceTaskId = `task_${hw.id}`;
    } else if (hw.id && hw.id < 0) {
      sourceTaskId = `auto_${Math.abs(hw.id)}`;
    } else if (subject && subject !== 'Général') {
      sourceTaskId = `${subject}_${(description || titreChapitre || 'item').slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    } else {
      sourceTaskId = `task_${(description || titreChapitre || 'item').slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '_') || 'default'}`;
    }
  }

  if (isPostgresConnected && pool) {
    try {
      const sql = `
        INSERT INTO homework_manual_adjustments (
          date_due, date_echeance, date_assigned, grade, subject,
          description, titre_chapitre, modified_text, competence_code, url, modified_url,
          is_hidden, priority_status, teacher_id, done, difficulty_level, day_of_life,
          source_task_id
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18
        )
        ON CONFLICT (date_echeance, grade, teacher_id, source_task_id) DO UPDATE SET
          date_due = EXCLUDED.date_due,
          date_assigned = EXCLUDED.date_assigned,
          subject = EXCLUDED.subject,
          description = EXCLUDED.description,
          titre_chapitre = EXCLUDED.titre_chapitre,
          modified_text = EXCLUDED.modified_text,
          competence_code = EXCLUDED.competence_code,
          url = EXCLUDED.url,
          modified_url = EXCLUDED.modified_url,
          is_hidden = EXCLUDED.is_hidden,
          priority_status = EXCLUDED.priority_status,
          done = EXCLUDED.done,
          difficulty_level = EXCLUDED.difficulty_level,
          day_of_life = EXCLUDED.day_of_life
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        dateDue,
        dateEcheance,
        dateAssigned,
        grade,
        subject,
        description,
        titreChapitre,
        modifiedText,
        competenceCode,
        url,
        modifiedUrl,
        isHidden,
        priorityStatus,
        teacherId,
        done,
        difficultyLevel,
        dayOfLife,
        sourceTaskId,
      ]);
      const row = res.rows[0];
      return {
        ...row,
        date_due: row.date_due || row.date_echeance,
        date_echeance: row.date_echeance || row.date_due,
        titre_chapitre: row.titre_chapitre || row.modified_text || (row.subject && row.subject !== 'Général' ? row.subject : undefined),
        description: row.description || '',
        url: row.url || row.modified_url || undefined,
        is_hidden: Boolean(row.is_hidden),
        priority_status: row.priority_status || 'prioritaire',
        source_task_id: row.source_task_id,
      };
    } catch (err: any) {
      console.error('❌ ERREUR DETAILLEE SQL ON CONFLICT upsertHomeworkAdjustment:', {
        message: err?.message,
        detail: err?.detail,
        code: err?.code,
        constraint: err?.constraint,
        sourceTaskId,
        dateEcheance,
        grade,
        teacherId,
      });
      const findRes = await pool.query(
        `SELECT id FROM homework_manual_adjustments
         WHERE teacher_id = $1 AND grade = $2 AND (date_echeance = $3 OR date_due = $3)
           AND (source_task_id = $4 OR ($5::text IS NOT NULL AND competence_code = $5))`,
        [teacherId, grade, dateEcheance, sourceTaskId, competenceCode]
      );
      if (findRes.rows.length > 0) {
        const existingId = findRes.rows[0].id;
        const updateRes = await pool.query(
          `UPDATE homework_manual_adjustments SET
            date_due = $1, date_echeance = $2, date_assigned = $3, grade = $4, subject = $5,
            description = $6, titre_chapitre = $7, modified_text = $8, competence_code = $9, url = $10, modified_url = $11,
            is_hidden = $12, priority_status = $13, done = $14, difficulty_level = $15, day_of_life = $16,
            source_task_id = $17
           WHERE id = $18 RETURNING *`,
          [
            dateDue, dateEcheance, dateAssigned, grade, subject,
            description, titreChapitre, modifiedText, competenceCode, url, modifiedUrl,
            isHidden, priorityStatus, done, difficultyLevel, dayOfLife, sourceTaskId, existingId
          ]
        );
        const row = updateRes.rows[0];
        return {
          ...row,
          date_due: row.date_due || row.date_echeance,
          date_echeance: row.date_echeance || row.date_due,
          titre_chapitre: row.titre_chapitre || row.modified_text || (row.subject && row.subject !== 'Général' ? row.subject : undefined),
          description: row.description || '',
          url: row.url || row.modified_url || undefined,
          is_hidden: Boolean(row.is_hidden),
          priority_status: row.priority_status || 'prioritaire',
          source_task_id: row.source_task_id,
        };
      } else {
        const insertRes = await pool.query(
          `INSERT INTO homework_manual_adjustments (
            date_due, date_echeance, date_assigned, grade, subject,
            description, titre_chapitre, modified_text, competence_code, url, modified_url,
            is_hidden, priority_status, teacher_id, done, difficulty_level, day_of_life,
            source_task_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
          [
            dateDue, dateEcheance, dateAssigned, grade, subject,
            description, titreChapitre, modifiedText, competenceCode, url, modifiedUrl,
            isHidden, priorityStatus, teacherId, done, difficultyLevel, dayOfLife, sourceTaskId
          ]
        );
        const row = insertRes.rows[0];
        return {
          ...row,
          date_due: row.date_due || row.date_echeance,
          date_echeance: row.date_echeance || row.date_due,
          titre_chapitre: row.titre_chapitre || row.modified_text || (row.subject && row.subject !== 'Général' ? row.subject : undefined),
          description: row.description || '',
          url: row.url || row.modified_url || undefined,
          is_hidden: Boolean(row.is_hidden),
          priority_status: row.priority_status || 'prioritaire',
          source_task_id: row.source_task_id,
        };
      }
    }
  }

  // Fallback in memory
  const idx = simHomework.findIndex(
    (h) =>
      h.teacher_id === teacherId &&
      h.grade === grade &&
      (h.date_echeance === dateEcheance || h.date_due === dateDue) &&
      (h.source_task_id === sourceTaskId || (competenceCode && h.competence_code === competenceCode))
  );

  const updatedItem: HomeworkAdjustment = {
    id: idx >= 0 ? simHomework[idx].id : simHomework.length + 1,
    date_due: dateDue,
    date_echeance: dateEcheance,
    date_assigned: dateAssigned,
    grade: grade as GradeLevel,
    subject,
    titre_chapitre: titreChapitre || undefined,
    description,
    competence_code: competenceCode || undefined,
    url: url || undefined,
    is_hidden: isHidden,
    priority_status: priorityStatus,
    done,
    difficulty_level: difficultyLevel,
    day_of_life: dayOfLife || undefined,
    teacher_id: teacherId,
    source_task_id: sourceTaskId,
  };

  if (idx >= 0) {
    simHomework[idx] = updatedItem;
  } else {
    simHomework.push(updatedItem);
  }
  return updatedItem;
}

const weekHomeworkCache = new Map<string, { timestamp: number; data: Map<string, HomeworkAdjustment[]> }>();

export function clearHomeworkCache(): void {
  weekHomeworkCache.clear();
}

export async function getBatchCohortAverages(teacherId = 'JulieCB'): Promise<Map<string, number>> {
  const averageMap = new Map<string, number>();

  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(`
        SELECT 
          c.code as competence_code,
          AVG(COALESCE(r.score, r.reussites, 0))::float as cohort_avg
        FROM "Result" r
        INNER JOIN "Competence" c ON c.id = r."competenceId"
        GROUP BY c.code
      `);
      for (const row of res.rows) {
        if (row.competence_code) {
          averageMap.set(row.competence_code, Number(row.cohort_avg || 0));
        }
      }
    } catch {
      try {
        const res = await pool.query(`
          SELECT 
            c.code as competence_code,
            AVG(COALESCE(r.score, 0))::float as cohort_avg
          FROM result r
          INNER JOIN competence c ON c.id = r.competence_id
          GROUP BY c.code
        `);
        for (const row of res.rows) {
          if (row.competence_code) {
            averageMap.set(row.competence_code, Number(row.cohort_avg || 0));
          }
        }
      } catch {
        // Ignore fallback errors
      }
    }
  }

  if (simResults && simResults.length > 0) {
    const simGrouped = new Map<string, number[]>();
    for (const sr of simResults) {
      if (!sr.competence_code) continue;
      const list = simGrouped.get(sr.competence_code) || [];
      list.push(sr.reussites);
      simGrouped.set(sr.competence_code, list);
    }
    for (const [code, scores] of simGrouped.entries()) {
      if (!averageMap.has(code) && scores.length > 0) {
        const sum = scores.reduce((a, b) => a + Math.min(b, 5), 0);
        averageMap.set(code, sum / scores.length);
      }
    }
  }

  return averageMap;
}

export async function calculateWeeklyHomeworkPlan(
  dateStr: string,
  gradeFilter?: string,
  teacherId = 'JulieCB'
): Promise<Map<string, HomeworkAdjustment[]>> {
  await ensurePostgresConnection();

  // Calculate Monday date of the target date's week
  const dateObj = new Date(dateStr + 'T12:00:00Z');
  const dayOfWeek = dateObj.getUTCDay();
  const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayObj = new Date(dateObj);
  mondayObj.setUTCDate(dateObj.getUTCDate() + distToMonday);

  const mondayStr = mondayObj.toISOString().slice(0, 10);
  const cacheKey = `${mondayStr}_${gradeFilter || 'Tous'}_${teacherId}`;

  const cached = weekHomeworkCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 300000)) {
    return cached.data;
  }

  const weekDates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const wDay = new Date(mondayObj);
    wDay.setUTCDate(mondayObj.getUTCDate() + i);
    weekDates.push(wDay.toISOString().slice(0, 10));
  }

  // Single batch data prefetch
  const [settings, allManual, cohortAveragesMap, matinSeq, apremSeq] = await Promise.all([
    getUserSettings(teacherId),
    getHomework(gradeFilter, teacherId),
    getBatchCohortAverages(teacherId),
    getChronologicalProgression('matin', teacherId),
    getChronologicalProgression('aprem', teacherId),
  ]);

  // Batch precompute useful day info for all dates in this week
  const usefulDayInfoMap = new Map<string, { matin: any; aprem: any }>();
  await Promise.all(
    weekDates.map(async (d) => {
      const [matinInfo, apremInfo] = await Promise.all([
        getUsefulDayInfo(d, 'matin', settings, teacherId),
        getUsefulDayInfo(d, 'aprem', settings, teacherId),
      ]);
      usefulDayInfoMap.set(d, { matin: matinInfo, aprem: apremInfo });
    })
  );

  const allSeq = [...matinSeq, ...apremSeq];
  const assignedTrainingCompetencesThisWeek = new Set<string>();

  // Seed assigned competences with manual homework present in this week
  for (const wDate of weekDates) {
    const manualForWDate = allManual.filter(h => h.date_due === wDate || h.date_echeance === wDate);
    for (const m of manualForWDate) {
      if (m.competence_code) assignedTrainingCompetencesThisWeek.add(m.competence_code.toLowerCase().trim());
      if (m.titre_chapitre) assignedTrainingCompetencesThisWeek.add(m.titre_chapitre.toLowerCase().trim());
    }
  }

  const plan = new Map<string, HomeworkAdjustment[]>();
  let autoIdCounter = -1;

  for (const wDate of weekDates) {
    const dayInfos = usefulDayInfoMap.get(wDate)!;
    const usefulDayInfoMatin = dayInfos.matin;
    const usefulDayInfoAprem = dayInfos.aprem;
    const manualForDate = allManual.filter(h => h.date_due === wDate || h.date_echeance === wDate);

    const enrichedManualForDate = manualForDate.map(m => {
      const matchSeq = allSeq.find(s => 
        (s.competence_code && m.competence_code === s.competence_code) ||
        (s.titre_chapitre && m.titre_chapitre && m.titre_chapitre.toLowerCase().includes(s.titre_chapitre.toLowerCase())) ||
        (s.titre_chapitre && m.description.toLowerCase().includes(s.titre_chapitre.toLowerCase())) ||
        (s.intitule && m.description.toLowerCase().includes(s.intitule.toLowerCase()))
      );
      if (matchSeq) {
        const info = matchSeq.creneau === 'matin' ? usefulDayInfoMatin : usefulDayInfoAprem;
        const dLife = m.day_of_life || computeSequenceDayOfLife(info.usefulDay, matchSeq.ordre_sequence, matchSeq.creneau, settings);
        return {
          ...m,
          competence_code: m.competence_code || matchSeq.competence_code,
          titre_chapitre: m.titre_chapitre || matchSeq.intitule || matchSeq.titre_chapitre,
          day_of_life: dLife,
          url: m.url || matchSeq.url || undefined,
        };
      }
      return m;
    });

    const customItems: CustomHomework[] = await getCustomHomeworkForDate(wDate, gradeFilter, teacherId, settings);
    const customAsHomeworkAdjustments: HomeworkAdjustment[] = customItems.map(ch => ({
      id: Number(ch.id),
      date_due: ch.date_echeance || ch.date_due || wDate,
      date_echeance: ch.date_echeance || ch.date_due || wDate,
      date_assigned: ch.date_assigned || ch.date_echeance || wDate,
      grade: ch.grade,
      subject: ch.subject,
      sub_domain: ch.sub_domain,
      target_groups: ch.target_groups || 'Tous',
      title: ch.title || ch.subject,
      titre_chapitre: ch.title || ch.subject,
      description: ch.description || '',
      url: ch.url || undefined,
      exercise_number: ch.exercise_number || undefined,
      cartridge_color: ch.cartridge_color || 'standard',
      is_optional: Boolean(ch.is_optional),
      position_rule: ch.position_rule || 'bottom',
      recurrence: ch.recurrence || 'none',
      teacher_id: ch.teacher_id || teacherId,
      done: false,
      difficulty_level: 'standard',
      is_custom: true,
      priority_status: ch.is_optional ? 'facultatif' : 'prioritaire',
    }));

    if (!usefulDayInfoMatin.isWorkingDay || usefulDayInfoMatin.isBanaliseeToday || usefulDayInfoMatin.usefulDay <= 1) {
      plan.set(wDate, [...enrichedManualForDate, ...customAsHomeworkAdjustments]);
      continue;
    }

    const autoNonTrainingList: HomeworkAdjustment[] = [];
    const autoTrainingCandidates: { item: HomeworkAdjustment; seq: ChronologicalProgression; dayOfLife: number }[] = [];

    for (const seq of allSeq) {
      if (gradeFilter && gradeFilter !== 'Tous' && seq.grade !== gradeFilter && seq.grade !== 'Tous') {
        continue;
      }

      const seqUsefulInfo = seq.creneau === 'matin' ? usefulDayInfoMatin : usefulDayInfoAprem;
      const prevUsefulDay = seqUsefulInfo.usefulDay - 1;

      const dayOfLifeJMinus1 = computeSequenceDayOfLife(prevUsefulDay, seq.ordre_sequence, seq.creneau, settings);
      const dayOfLifeJ = computeSequenceDayOfLife(seqUsefulInfo.usefulDay, seq.ordre_sequence, seq.creneau, settings);

      const stepJMinus1 = seq.creneau === 'matin'
        ? getMorningTimelineStep(dayOfLifeJMinus1)
        : getAfternoonTimelineStep(dayOfLifeJMinus1);

      const baseTaskId = seq.competence_code || (seq.id ? `seq_${seq.id}` : `${seq.creneau}_${seq.ordre_sequence}`);

      if (stepJMinus1.type === 'Leçon') {
        const chapterTitle = seq.intitule || seq.titre_chapitre || seq.competence_code || 'Leçon';
        autoNonTrainingList.push({
          id: autoIdCounter--,
          date_due: wDate,
          date_echeance: wDate,
          date_assigned: wDate,
          grade: seq.grade,
          subject: seq.competence_code || seq.domaine || 'Mathématiques',
          titre_chapitre: chapterTitle,
          description: `Réviser la leçon.`,
          competence_code: seq.competence_code,
          source_task_id: `${baseTaskId}_lecon`,
          url: seq.url || undefined,
          day_of_life: dayOfLifeJMinus1,
          teacher_id: teacherId,
          done: false,
          difficulty_level: 'standard',
          is_auto: true,
          is_hidden: false,
          priority_status: 'prioritaire',
        });
      }

      if (stepJMinus1.type === 'Modelage') {
        const chapterTitle = seq.intitule || seq.titre_chapitre || seq.competence_code || 'Modelage';
        autoNonTrainingList.push({
          id: autoIdCounter--,
          date_due: wDate,
          date_echeance: wDate,
          date_assigned: wDate,
          grade: seq.grade,
          subject: seq.competence_code || seq.domaine || 'Français',
          titre_chapitre: chapterTitle,
          description: `Je peux refaire le modelage pour vérifier que j'ai compris la stratégie.`,
          competence_code: seq.competence_code,
          source_task_id: `${baseTaskId}_modelage`,
          url: seq.url || undefined,
          day_of_life: dayOfLifeJMinus1,
          teacher_id: teacherId,
          done: false,
          difficulty_level: 'standard',
          is_auto: true,
          is_hidden: false,
          priority_status: 'prioritaire',
        });
      }

      if (seq.creneau === 'matin' && dayOfLifeJ >= 3 && dayOfLifeJ <= 45 && stepJMinus1.type === null) {
        const chapterTitle = seq.intitule || seq.titre_chapitre || seq.competence_code || 'Entraînement';
        const item: HomeworkAdjustment = {
          id: autoIdCounter--,
          date_due: wDate,
          date_echeance: wDate,
          date_assigned: wDate,
          grade: seq.grade,
          subject: seq.competence_code || seq.domaine || 'Entraînement',
          titre_chapitre: chapterTitle,
          description: `Exercice d'entraînement.`,
          competence_code: seq.competence_code,
          source_task_id: `${baseTaskId}_entraînement`,
          url: seq.url || undefined,
          day_of_life: dayOfLifeJ,
          teacher_id: teacherId,
          done: false,
          difficulty_level: 'standard',
          is_auto: true,
          is_hidden: false,
          priority_status: 'prioritaire',
        };
        autoTrainingCandidates.push({ item, seq, dayOfLife: dayOfLifeJ });
      }
    }

    // Sort training candidates by recency: smaller dayOfLife first (most recent active chapters), then higher ordre_sequence
    autoTrainingCandidates.sort((a, b) => a.dayOfLife - b.dayOfLife || b.seq.ordre_sequence - a.seq.ordre_sequence);

    const finalTrainingForDay: HomeworkAdjustment[] = [];

    for (const { item, seq } of autoTrainingCandidates) {
      // 0. Deduplicate against manual homework for same date
      const existsManual = enrichedManualForDate.some(m =>
        (m.source_task_id && item.source_task_id && m.source_task_id === item.source_task_id) ||
        (m.competence_code && item.competence_code && m.competence_code === item.competence_code) ||
        m.description.toLowerCase() === item.description.toLowerCase()
      );
      if (existsManual) continue;

      // Filter 2: Cohort Mastery Filter (Cohort Average >= 4.0 => Exclude)
      if (item.competence_code) {
        const avgScore = cohortAveragesMap.get(item.competence_code);
        if (avgScore !== undefined && avgScore >= 4.0) {
          continue;
        }
      }

      // Filter 3: Anti-Redundancy with Cahier Journal of the Week
      let inClassTrainingThisWeek = false;
      for (const checkDate of weekDates) {
        const checkInfos = usefulDayInfoMap.get(checkDate);
        const checkInfo = seq.creneau === 'aprem' ? checkInfos?.aprem : checkInfos?.matin;
        if (checkInfo && checkInfo.isWorkingDay && checkInfo.usefulDay >= 1) {
          const checkDayOfLife = computeSequenceDayOfLife(checkInfo.usefulDay, seq.ordre_sequence, seq.creneau, settings);
          const checkStep = getMorningTimelineStep(checkDayOfLife);
          if (checkStep.type === 'Entraînement') {
            inClassTrainingThisWeek = true;
            break;
          }
        }
      }
      if (inClassTrainingThisWeek) continue;

      // Filter 4: Strict Weekly Anti-Duplicate across Training Items
      const codeKey = item.competence_code?.toLowerCase().trim();
      const titleKey = item.titre_chapitre?.toLowerCase().trim();

      if ((codeKey && assignedTrainingCompetencesThisWeek.has(codeKey)) ||
          (titleKey && assignedTrainingCompetencesThisWeek.has(titleKey))) {
        continue; // Already assigned on an earlier day in this week!
      }

      // Daily Quota (Max 4 training items per day)
      if (finalTrainingForDay.length >= 4) {
        break;
      }

      if (codeKey) assignedTrainingCompetencesThisWeek.add(codeKey);
      if (titleKey) assignedTrainingCompetencesThisWeek.add(titleKey);

      finalTrainingForDay.push(item);
    }

    const filteredNonTraining = autoNonTrainingList.filter(autoItem => {
      return !enrichedManualForDate.some(m =>
        (m.source_task_id && autoItem.source_task_id && m.source_task_id === autoItem.source_task_id) ||
        (m.competence_code && autoItem.competence_code && m.competence_code === autoItem.competence_code) ||
        m.description.toLowerCase() === autoItem.description.toLowerCase()
      );
    });

    plan.set(wDate, [...filteredNonTraining, ...finalTrainingForDay, ...enrichedManualForDate, ...customAsHomeworkAdjustments]);
  }

  weekHomeworkCache.set(cacheKey, { timestamp: Date.now(), data: plan });
  return plan;
}

export async function getHomeworkForDate(
  dateStr: string,
  gradeFilter?: string,
  teacherId = 'JulieCB'
): Promise<HomeworkAdjustment[]> {
  const plan = await calculateWeeklyHomeworkPlan(dateStr, gradeFilter, teacherId);
  return plan.get(dateStr) || [];
}

export async function addHomework(
  hw: Partial<HomeworkAdjustment> & { date_due: string; grade: GradeLevel }
): Promise<HomeworkAdjustment> {
  return upsertHomeworkAdjustment(hw);
}

export async function moveHomework(
  item: HomeworkAdjustment,
  currentDate: string,
  targetDate: string,
  teacherId = 'JulieCB'
): Promise<{ success: boolean }> {
  if (item.is_custom && item.id > 0) {
    await addCustomHomework({
      ...item,
      id: Number(item.id),
      date_due: targetDate,
      date_echeance: targetDate,
      date_assigned: targetDate,
      teacher_id: teacherId,
    });
    return { success: true };
  }

  if (item.id > 0) {
    await upsertHomeworkAdjustment({
      ...item,
      id: item.id,
      date_due: targetDate,
      date_echeance: targetDate,
      teacher_id: teacherId,
    });
  } else {
    // Hide original auto item on currentDate
    await upsertHomeworkAdjustment({
      ...item,
      id: undefined,
      date_due: currentDate,
      date_echeance: currentDate,
      is_hidden: true,
      teacher_id: teacherId,
    });
    // Create new item on targetDate
    await upsertHomeworkAdjustment({
      ...item,
      id: undefined,
      date_due: targetDate,
      date_echeance: targetDate,
      is_hidden: false,
      teacher_id: teacherId,
    });
  }
  return { success: true };
}

export async function duplicateHomework(
  item: HomeworkAdjustment,
  targetDate: string,
  teacherId = 'JulieCB'
): Promise<HomeworkAdjustment> {
  if (item.is_custom) {
    const cloned = await addCustomHomework({
      date_due: targetDate,
      date_echeance: targetDate,
      date_assigned: targetDate,
      grade: item.grade || 'Tous',
      subject: item.subject || 'Général',
      sub_domain: item.sub_domain || null,
      target_groups: item.target_groups || 'Tous',
      title: item.title || (item as any).titre_chapitre || item.subject || 'Devoir',
      description: item.description || item.modified_text || '',
      url: item.url || item.modified_url || null,
      exercise_number: item.exercise_number || null,
      cartridge_color: item.cartridge_color || 'standard',
      is_optional: Boolean(item.is_optional || item.priority_status === 'facultatif'),
      position_rule: item.position_rule || 'bottom',
      recurrence: 'none',
      teacher_id: teacherId,
      is_custom: true,
    });
    return cloned as any;
  }

  return upsertHomeworkAdjustment({
    ...item,
    id: undefined,
    date_due: targetDate,
    date_echeance: targetDate,
    is_hidden: false,
    teacher_id: teacherId,
  });
}

export async function toggleHomeworkDone(
  id: number,
  done: boolean
): Promise<{ success: boolean }> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    await pool.query('UPDATE homework_manual_adjustments SET done = $1 WHERE id = $2', [
      done,
      id,
    ]);
    return { success: true };
  }
  const item = simHomework.find((h) => h.id === id);
  if (item) item.done = done;
  return { success: true };
}

export async function deleteHomework(id: number): Promise<{ success: boolean }> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    await pool.query('DELETE FROM homework_manual_adjustments WHERE id = $1', [id]);
    return { success: true };
  }
  simHomework = simHomework.filter((h) => h.id !== id);
  return { success: true };
}

export async function deleteHomeworkAdjustment(params: {
  id?: number;
  date_echeance?: string;
  date_due?: string;
  grade?: string;
  teacher_id?: string;
  source_task_id?: string;
  competence_code?: string;
  description?: string;
}): Promise<{ success: boolean }> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  const id = params.id;
  const teacherId = params.teacher_id || 'JulieCB';
  const grade = params.grade;
  const dateEcheance = params.date_echeance || params.date_due;
  const sourceTaskId = params.source_task_id;
  const competenceCode = params.competence_code;
  const description = params.description;

  if (isPostgresConnected && pool) {
    if (id && id > 0) {
      await pool.query('DELETE FROM homework_manual_adjustments WHERE id = $1', [id]);
      return { success: true };
    }
    if (dateEcheance && grade) {
      if (sourceTaskId) {
        await pool.query(
          `DELETE FROM homework_manual_adjustments
           WHERE (date_echeance = $1 OR date_due = $1)
             AND grade = $2
             AND teacher_id = $3
             AND source_task_id = $4`,
          [dateEcheance, grade, teacherId, sourceTaskId]
        );
      } else {
        await pool.query(
          `DELETE FROM homework_manual_adjustments
           WHERE (date_echeance = $1 OR date_due = $1)
             AND grade = $2
             AND teacher_id = $3
             AND (
               ($4::text IS NOT NULL AND competence_code = $4)
               OR ($5::text IS NOT NULL AND LOWER(description) = LOWER($5))
             )`,
          [dateEcheance, grade, teacherId, competenceCode || null, description || null]
        );
      }
    }
    return { success: true };
  }

  if (id && id > 0) {
    simHomework = simHomework.filter((h) => h.id !== id);
  } else if (dateEcheance && grade) {
    simHomework = simHomework.filter(
      (h) =>
        !(
          h.teacher_id === teacherId &&
          h.grade === grade &&
          (h.date_echeance === dateEcheance || h.date_due === dateEcheance) &&
          (
            (sourceTaskId && h.source_task_id === sourceTaskId) ||
            (competenceCode && h.competence_code === competenceCode) ||
            (description && h.description.toLowerCase() === description.toLowerCase())
          )
        )
    );
  }
  return { success: true };
}

export async function getManualAdjustmentOptions(): Promise<{
  matieres: string[];
  domaines: string[];
  types: string[];
  competences: string[];
}> {
  await ensurePostgresConnection();

  if (isPostgresConnected && pool) {
    try {
      const matieresSet = new Set<string>();
      const domainesSet = new Set<string>();
      const typesSet = new Set<string>();
      const competencesSet = new Set<string>();

      try {
        const matRes = await pool.query(
          `SELECT DISTINCT matiere FROM custom_activities WHERE matiere IS NOT NULL AND matiere != ''`
        );
        matRes.rows.forEach((r) => matieresSet.add(r.matiere));
      } catch (e: any) {
        console.warn('Matiere options query warning:', e.message);
      }

      try {
        const domRes = await pool.query(
          `SELECT DISTINCT domaine FROM custom_activities WHERE domaine IS NOT NULL AND domaine != ''`
        );
        domRes.rows.forEach((r) => domainesSet.add(r.domaine));
      } catch (e: any) {
        console.warn('Domaine options query warning:', e.message);
      }

      try {
        const typeRes = await pool.query(
          `SELECT DISTINCT type_activite FROM custom_activities WHERE type_activite IS NOT NULL AND type_activite != ''`
        );
        typeRes.rows.forEach((r) => typesSet.add(r.type_activite));
      } catch (e: any) {
        console.warn('Type options query warning:', e.message);
      }

      try {
        const compRes = await pool.query(
          `SELECT DISTINCT competence_code FROM custom_activities WHERE competence_code IS NOT NULL AND competence_code != ''`
        );
        compRes.rows.forEach((r) => competencesSet.add(r.competence_code));
      } catch (e: any) {
        console.warn('Competences code options query warning:', e.message);
      }

      return {
        matieres: Array.from(matieresSet).sort(),
        domaines: Array.from(domainesSet).sort(),
        types: Array.from(typesSet).sort(),
        competences: Array.from(competencesSet).sort(),
      };
    } catch (err: any) {
      console.error('Error fetching options:', err.message);
    }
  }

  const matSet = new Set(simCustomActivities.map((a) => a.matiere).filter(Boolean) as string[]);
  const domSet = new Set(simCustomActivities.map((a) => a.domaine).filter(Boolean) as string[]);
  const typeSet = new Set(simCustomActivities.map((a) => a.type_activite).filter(Boolean) as string[]);
  const compSet = new Set(simCustomActivities.map((a) => a.competence_code).filter(Boolean) as string[]);

  return {
    matieres: Array.from(matSet).sort(),
    domaines: Array.from(domSet).sort(),
    types: Array.from(typeSet).sort(),
    competences: Array.from(compSet).sort(),
  };
}

/**
 * Migration from localStorage JSON array to PostgreSQL Neon table
 * This implements the requirement: "Module Planificateur de Devoirs: Migration depuis localStorage vers la base Neon"
 */
export async function migrateHomeworkFromLocalStorage(
  items: Omit<HomeworkAdjustment, 'id'>[],
  teacherId = 'JulieCB'
): Promise<{ migratedCount: number }> {
  let count = 0;
  for (const item of items) {
    await addHomework({
      ...item,
      teacher_id: teacherId,
    });
    count++;
  }
  return { migratedCount: count };
}

export async function getStudents(teacherId = 'JulieCB'): Promise<Student[]> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    const res = await pool.query('SELECT * FROM students WHERE teacher_id = $1 ORDER BY grade, last_name', [
      teacherId,
    ]);
    return res.rows;
  }
  return simStudents.filter((s) => s.teacher_id === teacherId);
}

// ==========================================
// CUSTOM TASKS (NEON TABLE 'custom_tasks') METHODS
// ==========================================

export async function getCustomTasks(teacherId = 'JulieCB'): Promise<CustomTask[]> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM custom_tasks WHERE teacher_id = $1 OR teacher_id IS NULL OR teacher_id = '' ORDER BY id ASC`,
        [teacherId]
      );
      return res.rows;
    } catch (err: any) {
      console.error('⚠️ Error querying custom_tasks from DB:', err.message);
    }
  }
  return simCustomTasks.filter((t) => t.teacher_id === teacherId || !t.teacher_id);
}

export async function addCustomTask(
  taskText: string,
  teacherId = 'JulieCB'
): Promise<CustomTask> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    const res = await pool.query(
      `INSERT INTO custom_tasks (teacher_id, task_text, completed)
       VALUES ($1, $2, false)
       RETURNING *`,
      [teacherId || 'JulieCB', taskText]
    );
    return res.rows[0];
  }

  const newId =
    (simCustomTasks.length > 0 ? Math.max(...simCustomTasks.map((x) => x.id)) : 0) + 1;
  const created: CustomTask = {
    id: newId,
    teacher_id: teacherId || 'JulieCB',
    task_text: taskText,
    completed: false,
    created_at: new Date().toISOString(),
  };
  simCustomTasks.push(created);
  return created;
}

export async function toggleCustomTaskCompleted(
  id: number,
  completed: boolean
): Promise<{ success: boolean }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    await pool.query('UPDATE custom_tasks SET completed = $1 WHERE id = $2', [
      completed,
      id,
    ]);
    return { success: true };
  }
  const task = simCustomTasks.find((t) => t.id === id);
  if (task) {
    task.completed = completed;
  }
  return { success: true };
}

export async function deleteCustomTask(id: number): Promise<{ success: boolean }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    await pool.query('DELETE FROM custom_tasks WHERE id = $1', [id]);
    return { success: true };
  }
  simCustomTasks = simCustomTasks.filter((t) => t.id !== id);
  return { success: true };
}

export async function truncateManualAdjustments(teacherId = 'JulieCB', grade?: string): Promise<{ success: boolean; message: string }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    if (grade && grade !== 'Tous' && grade !== 'all') {
      const res = await pool.query('DELETE FROM manual_adjustments WHERE grade = $1', [grade]);
      return { success: true, message: `Ajustements spiralaires purgés pour le grade '${grade}' (${res.rowCount || 0} lignes supprimées).` };
    } else {
      await pool.query('TRUNCATE TABLE manual_adjustments');
      return { success: true, message: 'Table manual_adjustments (ajustements spiralaires) effacée via TRUNCATE.' };
    }
  }
  if (grade && grade !== 'Tous' && grade !== 'all') {
    const initLen = simManualAdjustments.length;
    simManualAdjustments = simManualAdjustments.filter((a) => (a.grade || '').trim().toUpperCase() !== grade.trim().toUpperCase());
    return { success: true, message: `Ajustements spiralaires réinitialisés pour le grade '${grade}'.` };
  } else {
    simManualAdjustments.length = 0;
    return { success: true, message: 'Ajustements spiralaires réinitialisés.' };
  }
}

export async function truncateCustomActivities(teacherId = 'JulieCB', grade?: string): Promise<{ success: boolean; message: string }> {
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    if (grade && grade !== 'Tous' && grade !== 'all') {
      const res = await pool.query('DELETE FROM custom_activities WHERE grade = $1', [grade]);
      return { success: true, message: `Activités décrochées purgées pour le grade '${grade}' (${res.rowCount || 0} lignes supprimées).` };
    } else {
      await pool.query('TRUNCATE TABLE custom_activities');
      return { success: true, message: 'Table custom_activities (activités décrochées) effacée via TRUNCATE.' };
    }
  }
  if (grade && grade !== 'Tous' && grade !== 'all') {
    simCustomActivities = simCustomActivities.filter((a) => (a.grade || '').trim().toUpperCase() !== grade.trim().toUpperCase());
    return { success: true, message: `Activités décrochées réinitialisées pour le grade '${grade}'.` };
  } else {
    simCustomActivities.length = 0;
    return { success: true, message: 'Activités décrochées réinitialisées.' };
  }
}

export async function truncateHomeworkManualAdjustments(teacherId = 'JulieCB', grade?: string): Promise<{ success: boolean; message: string }> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    if (grade && grade !== 'Tous' && grade !== 'all') {
      const res = await pool.query('DELETE FROM homework_manual_adjustments WHERE grade = $1', [grade]);
      return { success: true, message: `Ajustements manuels de devoirs purgés pour le grade '${grade}' (${res.rowCount || 0} lignes supprimées).` };
    } else {
      await pool.query('TRUNCATE TABLE homework_manual_adjustments');
      return { success: true, message: 'Table homework_manual_adjustments (ajustements manuels de devoirs) effacée via TRUNCATE.' };
    }
  }
  simHomework.length = 0;
  return { success: true, message: 'Ajustements manuels de devoirs réinitialisés.' };
}

export async function truncateCustomHomework(teacherId = 'JulieCB', grade?: string): Promise<{ success: boolean; message: string }> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    if (grade && grade !== 'Tous' && grade !== 'all') {
      const res = await pool.query('DELETE FROM custom_homework WHERE grade = $1', [grade]);
      return { success: true, message: `Devoirs personnalisés purgés pour le grade '${grade}' (${res.rowCount || 0} lignes supprimées).` };
    } else {
      await pool.query('TRUNCATE TABLE custom_homework');
      return { success: true, message: 'Table custom_homework (devoirs personnalisés) effacée via TRUNCATE.' };
    }
  }
  simCustomHomework.length = 0;
  return { success: true, message: 'Devoirs personnalisés réinitialisés.' };
}

function toYYYYMMDD(val: any): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  return str.slice(0, 10);
}

function matchesCustomRecurrence(
  dateEcheanceRaw: any,
  dateStrRaw: any,
  recurrence?: string | null,
  settings?: UserSettings
): boolean {
  const dateEcheance = toYYYYMMDD(dateEcheanceRaw);
  const dateStr = toYYYYMMDD(dateStrRaw);

  if (!dateEcheance || !dateStr) return false;

  const isNoRecurrence = !recurrence || recurrence === 'none' || recurrence === 'aucune' || recurrence === '';

  // Exception: Single explicit addition targeting this exact date displays even if non-working day
  if (isNoRecurrence && dateEcheance === dateStr) {
    return true;
  }

  if (dateEcheance > dateStr) return false;

  // For recurring items or occurrences on other dates, check if target date is an active working day
  if (settings) {
    const usefulDayInfo = calculateUsefulDayIndex(dateStr, settings);
    if (!usefulDayInfo.isWorkingDay) {
      return false; // Skip recurring custom homework on non-working days (weekends, holidays, vacations, off-days)
    }
  }

  const dEch = new Date(dateEcheance + 'T00:00:00');
  const dTarget = new Date(dateStr + 'T00:00:00');

  if (isNaN(dEch.getTime()) || isNaN(dTarget.getTime())) return dateEcheance === dateStr;

  if (recurrence === 'daily' || recurrence === 'tous_les_jours') {
    return true;
  }
  if (recurrence === 'weekly' || recurrence === 'toutes_les_semaines') {
    return dEch.getDay() === dTarget.getDay();
  }
  if (recurrence === 'monthly' || recurrence === 'une_fois_par_mois') {
    return dEch.getDate() === dTarget.getDate();
  }
  return dateEcheance === dateStr;
}

export async function getCustomHomeworkForDate(
  dateStr: string,
  gradeFilter?: string,
  teacherId = 'JulieCB',
  settings?: UserSettings
): Promise<CustomHomework[]> {
  await ensurePostgresConnection();
  const userSettings = settings || (await getUserSettings(teacherId));

  if (isPostgresConnected && pool) {
    let sql = `SELECT * FROM custom_homework WHERE (teacher_id = $1 OR teacher_id IS NULL OR teacher_id = '' OR teacher_id = 'JulieCB')`;
    const params: any[] = [teacherId];
    if (gradeFilter && gradeFilter !== 'Tous' && gradeFilter !== 'all') {
      params.push(gradeFilter);
      sql += ` AND (grade = $${params.length} OR grade = 'Tous')`;
    }
    const res = await pool.query(sql, params);
    const rows: CustomHomework[] = res.rows.map(r => {
      const dEch = toYYYYMMDD(r.date_echeance) || toYYYYMMDD(r.date_due);
      const dDue = toYYYYMMDD(r.date_due) || toYYYYMMDD(r.date_echeance);
      const dAss = toYYYYMMDD(r.date_assigned) || dEch;
      return {
        ...r,
        id: Number(r.id),
        date_echeance: dEch,
        date_due: dDue,
        date_assigned: dAss,
        is_custom: true,
      };
    });
    return rows.filter(r => matchesCustomRecurrence(r.date_echeance || r.date_due || '', dateStr, r.recurrence, userSettings));
  }
  return simCustomHomework.filter(r => {
    if (gradeFilter && gradeFilter !== 'Tous' && gradeFilter !== 'all' && r.grade !== 'Tous' && r.grade !== gradeFilter) {
      return false;
    }
    return matchesCustomRecurrence(r.date_echeance || r.date_due || '', dateStr, r.recurrence, userSettings);
  });
}

export async function addCustomHomework(hw: Partial<CustomHomework>): Promise<CustomHomework> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  const dateDue = hw.date_echeance || hw.date_due || new Date().toISOString().split('T')[0];
  const dateEcheance = hw.date_echeance || hw.date_due || dateDue;
  const dateAssigned = hw.date_assigned || dateEcheance;
  const grade = hw.grade || 'Tous';
  const subject = hw.subject || 'Général';
  const subDomain = hw.sub_domain || null;
  const targetGroups = hw.target_groups || 'Tous';
  const title = hw.title || hw.subject || 'Devoir';
  const description = hw.description || '';
  const url = hw.url || null;
  const exerciseNumber = hw.exercise_number || null;
  const cartridgeColor = hw.cartridge_color || 'standard';
  const isOptional = Boolean(hw.is_optional);
  const positionRule = hw.position_rule || 'bottom';
  const recurrence = hw.recurrence || 'none';
  const teacherId = hw.teacher_id || 'JulieCB';

  if (isPostgresConnected && pool) {
    if (hw.id && Number(hw.id) > 0) {
      const res = await pool.query(
        `UPDATE custom_homework SET
          date_due = $1, date_echeance = $2, date_assigned = $3, grade = $4,
          subject = $5, sub_domain = $6, target_groups = $7, title = $8,
          description = $9, url = $10, exercise_number = $11, cartridge_color = $12,
          is_optional = $13, position_rule = $14, recurrence = $15, teacher_id = $16,
          is_custom = true
         WHERE id = $17 RETURNING *`,
        [
          dateDue, dateEcheance, dateAssigned, grade,
          subject, subDomain, targetGroups, title,
          description, url, exerciseNumber, cartridgeColor,
          isOptional, positionRule, recurrence, teacherId,
          Number(hw.id)
        ]
      );
      if (res.rows.length > 0) return { ...res.rows[0], is_custom: true };
    }

    const res = await pool.query(
      `INSERT INTO custom_homework
        (date_due, date_echeance, date_assigned, grade, subject, sub_domain, target_groups, title, description, url, exercise_number, cartridge_color, is_optional, position_rule, recurrence, teacher_id, is_custom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
       RETURNING *`,
      [
        dateDue, dateEcheance, dateAssigned, grade, subject, subDomain, targetGroups, title, description, url, exerciseNumber, cartridgeColor, isOptional, positionRule, recurrence, teacherId
      ]
    );
    return { ...res.rows[0], is_custom: true };
  }

  if (hw.id && Number(hw.id) > 0) {
    const idx = simCustomHomework.findIndex(item => item.id === Number(hw.id));
    if (idx !== -1) {
      const updated: CustomHomework = {
        ...simCustomHomework[idx],
        date_due: dateDue,
        date_echeance: dateEcheance,
        date_assigned: dateAssigned,
        grade: grade as any,
        subject,
        sub_domain: subDomain,
        target_groups: targetGroups,
        title,
        description,
        url,
        exercise_number: exerciseNumber,
        cartridge_color: cartridgeColor,
        is_optional: isOptional,
        position_rule: positionRule as any,
        recurrence,
        teacher_id: teacherId,
        is_custom: true,
      };
      simCustomHomework[idx] = updated;
      return updated;
    }
  }

  const newItem: CustomHomework = {
    id: Date.now(),
    date_due: dateDue,
    date_echeance: dateEcheance,
    date_assigned: dateAssigned,
    grade: grade as any,
    subject,
    sub_domain: subDomain,
    target_groups: targetGroups,
    title,
    description,
    url,
    exercise_number: exerciseNumber,
    cartridge_color: cartridgeColor,
    is_optional: isOptional,
    position_rule: positionRule as any,
    recurrence,
    teacher_id: teacherId,
    is_custom: true,
  };
  simCustomHomework.push(newItem);
  return newItem;
}

export async function deleteCustomHomework(id: number): Promise<{ success: boolean }> {
  clearHomeworkCache();
  await ensurePostgresConnection();
  if (isPostgresConnected && pool) {
    await pool.query('DELETE FROM custom_homework WHERE id = $1', [Number(id)]);
    return { success: true };
  }
  simCustomHomework = simCustomHomework.filter(item => item.id !== Number(id));
  return { success: true };
}

export async function getCustomHomeworkOptions(teacherId = 'JulieCB'): Promise<{ matieres: string[]; sub_domains: string[]; target_groups: string[] }> {
  await ensurePostgresConnection();
  const matieresSet = new Set<string>();
  const subDomainsSet = new Set<string>();
  const targetGroupsSet = new Set<string>();

  if (isPostgresConnected && pool) {
    // 1. custom_homework ONLY for subjects and sub-domains
    try {
      const res = await pool.query(`SELECT DISTINCT subject, sub_domain FROM custom_homework`);
      res.rows.forEach(r => {
        if (r.subject && r.subject.trim()) matieresSet.add(r.subject.trim());
        if (r.sub_domain && r.sub_domain.trim()) subDomainsSet.add(r.sub_domain.trim());
      });
    } catch (e) {
      try {
        const res = await pool.query(`SELECT DISTINCT subject FROM custom_homework`);
        res.rows.forEach(r => {
          if (r.subject && r.subject.trim()) matieresSet.add(r.subject.trim());
        });
      } catch (err) { /* ignore */ }
    }

    // 2. Read level column from "Student" or students table for dynamic target groups
    try {
      const resGroup = await pool.query(`SELECT DISTINCT level FROM "Student" WHERE level IS NOT NULL AND TRIM(level) != ''`);
      resGroup.rows.forEach(r => {
        if (r.level && r.level.trim()) targetGroupsSet.add(r.level.trim());
      });
    } catch (e) {
      try {
        const resGroup = await pool.query(`SELECT DISTINCT level FROM students WHERE level IS NOT NULL AND TRIM(level) != ''`);
        resGroup.rows.forEach(r => {
          if (r.level && r.level.trim()) targetGroupsSet.add(r.level.trim());
        });
      } catch (err) { /* ignore */ }
    }
  } else {
    simCustomHomework.forEach(item => {
      if (item.subject && item.subject.trim()) matieresSet.add(item.subject.trim());
      if (item.sub_domain && item.sub_domain.trim()) subDomainsSet.add(item.sub_domain.trim());
    });
    simStudents.forEach(s => {
      if ((s as any).level && String((s as any).level).trim()) {
        targetGroupsSet.add(String((s as any).level).trim());
      }
    });
  }

  return {
    matieres: Array.from(matieresSet).sort((a, b) => a.localeCompare(b, 'fr')),
    sub_domains: Array.from(subDomainsSet).sort((a, b) => a.localeCompare(b, 'fr')),
    target_groups: Array.from(targetGroupsSet).sort((a, b) => a.localeCompare(b, 'fr')),
  };
}

export async function getDifferentiationForCompetence(
  competenceCode: string,
  teacherId = 'JulieCB',
  activeGrades?: string[]
): Promise<{
  need_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
  success_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
  cohort_average: number;
  has_data: boolean;
}> {
  if (!competenceCode || competenceCode === 'PERSO' || competenceCode === 'AUTRE') {
    return { need_group: [], success_group: [], cohort_average: 0, has_data: false };
  }

  await ensurePostgresConnection();
  let targetActiveGrades = activeGrades;
  if (!targetActiveGrades || targetActiveGrades.length === 0) {
    const settings = await getUserSettings(teacherId);
    targetActiveGrades = settings.active_grades || [];
  }
  const normalizedActive = (targetActiveGrades || []).map((g) => g.trim().toUpperCase()).filter(Boolean);

  let studentResults: { student_id: string | number; first_name: string; last_name: string; grade: string; reussites: number }[] = [];

  if (isPostgresConnected && pool) {
    // Mode Lecture seule (SELECT uniquement) sur les tables "Student", "Competence", "Result"
    const selectQueries = [
      // Jointure sur le schéma exact : Result.competenceId = Competence.id, Result.studentId = Student.id, score (int)
      {
        sql: `SELECT 
                s.id as student_id,
                s."firstName" as first_name,
                s."lastName" as last_name,
                s.grade as grade,
                COALESCE(r.score, 0)::int as reussites
              FROM "Result" r
              INNER JOIN "Student" s ON s.id = r."studentId"
              INNER JOIN "Competence" c ON c.id = r."competenceId"
              WHERE c.code = $1
              ORDER BY s."lastName", s."firstName"`,
        params: [competenceCode],
      },
      // Variante avec COALESCE sur les noms si minuscules
      {
        sql: `SELECT 
                s.id as student_id,
                COALESCE(s."firstName", s.first_name, '') as first_name,
                COALESCE(s."lastName", s.last_name, '') as last_name,
                COALESCE(s.grade, '') as grade,
                COALESCE(r.score, r.reussites, 0)::int as reussites
              FROM "Result" r
              INNER JOIN "Student" s ON s.id = r."studentId"
              INNER JOIN "Competence" c ON (c.id = r."competenceId" OR c.code = $1)
              WHERE c.code = $1
              ORDER BY COALESCE(s."lastName", s.last_name), COALESCE(s."firstName", s.first_name)`,
        params: [competenceCode],
      },
    ];

    for (const queryObj of selectQueries) {
      try {
        const res = await pool.query(queryObj.sql, queryObj.params);
        if (res.rows && res.rows.length > 0) {
          studentResults = res.rows;
          break;
        }
      } catch (err: any) {
        // Option suivante
      }
    }
  }

  if (studentResults.length === 0) {
    // Mode simulation si aucune donnée Postgres n'est retournée
    const matchingSimResults = simResults.filter(
      (r) => r.competence_code === competenceCode && (r.teacher_id === teacherId || r.teacher_id === 'JulieCB')
    );
    for (const r of matchingSimResults) {
      const student = simStudents.find((s) => s.id === r.student_id);
      if (student) {
        studentResults.push({
          student_id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          grade: student.grade,
          reussites: r.reussites ?? r.score ?? 0,
        });
      }
    }
  }

  // Filtrage strict par niveau actif (active_grades)
  if (normalizedActive.length > 0) {
    studentResults = studentResults.filter((r) => {
      const normGrade = (r.grade || '').trim().toUpperCase();
      return normalizedActive.includes(normGrade) || normGrade === 'TOUS';
    });
  }

  // Dédoublonnage strict par élève unique en retenant la meilleure note / réussites
  const studentMap = new Map<string | number, { student_id: string | number; first_name: string; last_name: string; grade: string; reussites: number }>();
  for (const r of studentResults) {
    const sid = String(r.student_id);
    const scoreVal = Number(r.reussites ?? 0);
    const cleanFn = String(r.first_name || '').trim();
    const rawLn = String(r.last_name || '').trim();
    const cleanLn = rawLn === '?' ? '' : rawLn;

    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        student_id: r.student_id,
        first_name: cleanFn,
        last_name: cleanLn,
        grade: String(r.grade || '').trim(),
        reussites: scoreVal,
      });
    } else {
      const existing = studentMap.get(sid)!;
      if (scoreVal > existing.reussites) {
        studentMap.set(sid, {
          student_id: r.student_id,
          first_name: cleanFn,
          last_name: cleanLn,
          grade: String(r.grade || '').trim(),
          reussites: scoreVal,
        });
      }
    }
  }

  studentResults = Array.from(studentMap.values());

  if (studentResults.length === 0) {
    return { need_group: [], success_group: [], cohort_average: 0, has_data: false };
  }

  const need_group = studentResults
    .filter((r) => r.reussites < 3)
    .map((r) => ({ id: r.student_id, first_name: r.first_name, last_name: r.last_name, grade: r.grade }));

  const success_group = studentResults
    .filter((r) => r.reussites >= 5)
    .map((r) => ({ id: r.student_id, first_name: r.first_name, last_name: r.last_name, grade: r.grade }));

  // Plafonnement de la note à 5 max (5 = validé = 100%) pour éviter de fausser le score de base
  const total = studentResults.reduce((sum, r) => sum + Math.min(r.reussites, 5), 0);
  const cohort_average = studentResults.length > 0 ? Number((total / studentResults.length).toFixed(2)) : 0;

  return {
    need_group,
    success_group,
    cohort_average,
    has_data: true,
  };
}

export async function getAllDifferentiationOverview(
  teacherId = 'JulieCB',
  activeGrades?: string[],
  scheduledCodes?: string[]
) {
  await ensurePostgresConnection();
  let targetActiveGrades = activeGrades;
  if (!targetActiveGrades || targetActiveGrades.length === 0) {
    const settings = await getUserSettings(teacherId);
    targetActiveGrades = settings.active_grades || [];
  }
  const normalizedActive = (targetActiveGrades || []).map((g) => g.trim().toUpperCase()).filter(Boolean);

  let overviewList: {
    competence_code: string;
    title: string;
    domaine: string;
    need_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
    success_group: { id: number | string; first_name: string; last_name: string; grade?: string }[];
    cohort_average: number;
    ent_optional: boolean;
  }[] = [];

  if (isPostgresConnected && pool) {
    try {
      // Jointure directe simple et propre en lecture seule (SELECT)
      const res = await pool.query(`
        SELECT 
          c.id as competence_id,
          c.code as competence_code,
          c.title as title,
          COALESCE(c.domain, 'Général') as domaine,
          s.id as student_id,
          COALESCE(s."firstName", s.first_name, '') as first_name,
          COALESCE(s."lastName", s.last_name, '') as last_name,
          COALESCE(s.grade, '') as grade,
          COALESCE(r.score, 0)::int as score
        FROM "Competence" c
        LEFT JOIN "Result" r ON r."competenceId" = c.id
        LEFT JOIN "Student" s ON s.id = r."studentId"
        ORDER BY c.code, c.id, COALESCE(s."lastName", s.last_name), COALESCE(s."firstName", s.first_name)
      `);

      if (res.rows && res.rows.length > 0) {
        const compMap = new Map<string, {
          competence_code: string;
          title: string;
          domaine: string;
          students: { id: string | number; first_name: string; last_name: string; grade: string; score: number }[];
        }>();

        for (const row of res.rows) {
          const compKey = String(row.competence_code || row.competence_id || 'COMP');
          if (!compMap.has(compKey)) {
            compMap.set(compKey, {
              competence_code: String(row.competence_code || row.competence_id),
              title: String(row.title || row.competence_code || 'Sans titre'),
              domaine: String(row.domaine || 'Général'),
              students: [],
            });
          }

          if (row.student_id) {
            const studentGrade = String(row.grade || '').trim().toUpperCase();
            if (normalizedActive.length > 0 && !normalizedActive.includes(studentGrade) && studentGrade !== 'TOUS') {
              continue;
            }

            const compObj = compMap.get(compKey)!;
            const sid = String(row.student_id);
            const scoreVal = Number(row.score) || 0;
            const cleanFn = String(row.first_name || '').trim();
            const rawLn = String(row.last_name || '').trim();
            const cleanLn = rawLn === '?' ? '' : rawLn;

            const existingIdx = compObj.students.findIndex((s) => String(s.id) === sid);
            if (existingIdx >= 0) {
              if (scoreVal > compObj.students[existingIdx].score) {
                compObj.students[existingIdx].score = scoreVal;
              }
            } else {
              compObj.students.push({
                id: row.student_id,
                first_name: cleanFn,
                last_name: cleanLn,
                grade: String(row.grade || '').trim(),
                score: scoreVal,
              });
            }
          }
        }

        for (const [, compData] of compMap.entries()) {
          const need_group = compData.students
            .filter((s) => s.score < 3)
            .map((s) => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, grade: s.grade }));

          const success_group = compData.students
            .filter((s) => s.score >= 5)
            .map((s) => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, grade: s.grade }));

          // Plafonnement de la note à 5 max (5 = validé = 100%)
          const total = compData.students.reduce((sum, s) => sum + Math.min(s.score, 5), 0);
          const cohort_average = compData.students.length > 0
            ? Number((total / compData.students.length).toFixed(2))
            : 0;

          overviewList.push({
            competence_code: compData.competence_code,
            title: compData.title,
            domaine: compData.domaine,
            need_group,
            success_group,
            cohort_average,
            ent_optional: cohort_average >= 3,
          });
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Erreur lors de la récupération directe de l’aperçu de différenciation:', err.message);
    }
  }

  // Si des codes programmés sont spécifiés, s'assurer que TOUS soient présents dans overviewList
  const existingCodesSet = new Set(
    overviewList.map((item) => (item.competence_code || '').trim().toUpperCase())
  );
  const missingScheduledCodes = (scheduledCodes || []).filter(
    (code) => code && !existingCodesSet.has(code.trim().toUpperCase())
  );

  for (const code of missingScheduledCodes) {
    const diff = await getDifferentiationForCompetence(code, teacherId, normalizedActive);
    overviewList.push({
      competence_code: code,
      title: code,
      domaine: 'Général',
      need_group: diff.need_group,
      success_group: diff.success_group,
      cohort_average: diff.cohort_average,
      ent_optional: diff.cohort_average >= 3,
    });
    existingCodesSet.add(code.trim().toUpperCase());
  }

  if (overviewList.length > 0) {
    overviewList.sort((a, b) => {
      const countA = (a.need_group?.length || 0) + (a.success_group?.length || 0);
      const countB = (b.need_group?.length || 0) + (b.success_group?.length || 0);
      if (countB !== countA) return countB - countA;
      return (a.competence_code || '').localeCompare(b.competence_code || '');
    });
    return overviewList;
  }

  // Fallback si pas de données dans overviewList
  const uniqueCodes = Array.from(
    new Set([
      ...(scheduledCodes || []),
      ...simResults.map((r) => r.competence_code),
      ...simMatin.map((p) => p.competence_code),
      ...simAprem.map((p) => p.competence_code),
    ])
  ).filter(Boolean);

  const codes = uniqueCodes.map((code) => {
    const prog =
      simMatin.find((p) => p.competence_code === code) ||
      simAprem.find((p) => p.competence_code === code);
    return {
      code,
      title: prog?.intitule || prog?.titre_chapitre || code,
      domaine: prog?.domaine || 'Général',
    };
  });

  const results = [];
  for (const item of codes) {
    const diff = await getDifferentiationForCompetence(item.code, teacherId, normalizedActive);
    results.push({
      competence_code: item.code,
      title: item.title,
      domaine: item.domaine,
      need_group: diff.need_group,
      success_group: diff.success_group,
      cohort_average: diff.cohort_average,
      ent_optional: diff.cohort_average >= 3,
    });
  }

  return results;
}

