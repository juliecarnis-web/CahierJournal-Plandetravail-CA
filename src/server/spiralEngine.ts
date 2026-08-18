/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityType, CreneauType, GradeLevel, UserSettings, VacationRange } from '../types.js';

export const DEFAULT_VACATION_RANGES: VacationRange[] = [
  { name: 'Toussaint', startDate: '2026-10-17', endDate: '2026-11-01' },
  { name: 'Noël', startDate: '2026-12-19', endDate: '2027-01-03' },
  { name: 'Hiver', startDate: '2027-02-13', endDate: '2027-02-28' },
  { name: 'Printemps', startDate: '2027-04-10', endDate: '2027-04-25' },
];

export function getVacationRanges(settings?: UserSettings): VacationRange[] {
  if (!settings) return DEFAULT_VACATION_RANGES;

  const raw = settings.holidays || settings.vacations;
  if (Array.isArray(raw) && raw.length > 0) {
    const objects = raw.filter(
      (item: any) => item && typeof item === 'object' && item.startDate && item.endDate
    );
    if (objects.length > 0) {
      return objects.map((item: any, idx: number) => ({
        id: item.id || idx + 1,
        name: item.name || `Vacances ${idx + 1}`,
        startDate: item.startDate,
        endDate: item.endDate,
      }));
    }
  }

  return DEFAULT_VACATION_RANGES;
}

export interface SequenceStepResult {
  type: ActivityType | null;
  label: string;
  colorClass: string;
  badgeColor: string;
  orderPriority: number;
}

/**
 * Maps an activity type to its priority for daily sorting:
 * 1. Évaluations
 * 2. Modelage (inséré juste après évaluations et avant leçon)
 * 3. Leçon
 * 4. Tâche complexe
 * 5. Entraînement
 * 6. Révision / Autre
 */
export function getActivitySortPriority(type: ActivityType): number {
  switch (type) {
    case 'Évaluation':
      return 1;
    case 'Modelage':
      return 2;
    case 'Leçon':
      return 3;
    case 'Tâche complexe':
      return 4;
    case 'Entraînement':
      return 5;
    case 'Révision':
      return 6;
    case 'Autre':
    default:
      return 7;
  }
}

/**
 * Priority order accounting for postponed/reported ("En retard") status.
 * Reported Leçon (2.0) sits above scheduled Leçon (2.1).
 * Reported Modelage (3.0) sits above scheduled Modelage (3.1).
 * Reported Tâche complexe (4.0) sits above scheduled TC (4.1).
 * Reported Entraînements (5.0) are grouped together above scheduled Entraînements (5.1).
 */
export function getActivityTypeOrderPriority(type: ActivityType, isReported: boolean, isCustom?: boolean, positionAnchor?: string): number {
  if (positionAnchor && positionAnchor.trim() !== '') {
    switch (positionAnchor.trim()) {
      case 'top':
        return -10.0;
      case 'after_evaluation':
        return 1.5;
      case 'after_modelage':
        return 2.5;
      case 'after_lecon':
        return 3.5;
      case 'after_tache_complexe':
        return 4.5;
      case 'after_entrainement':
        return 5.5;
      case 'bottom':
        return 99.0;
      default:
        break;
    }
  }
  if (isCustom) {
    return 6.0;
  }
  switch (type) {
    case 'Évaluation':
      return 1.0;
    case 'Modelage':
      return isReported ? 2.0 : 2.1;
    case 'Leçon':
      return isReported ? 3.0 : 3.1;
    case 'Tâche complexe':
      return isReported ? 4.0 : 4.1;
    case 'Entraînement':
      return isReported ? 5.0 : 5.1;
    case 'Révision':
      return 5.5;
    case 'Autre':
    default:
      return 6.0;
  }
}

/**
  * Computes evaluation number (1..9) based on day of life or step label
  */
export function computeEvNumber(dayOfLife: number, creneau: CreneauType, stepLabel?: string): number {
  if (creneau === 'matin') {
    const mapMatin: Record<number, number> = { 5: 1, 7: 2, 11: 3, 15: 4, 22: 5, 31: 6, 40: 7, 51: 8, 63: 9 };
    if (mapMatin[dayOfLife]) return mapMatin[dayOfLife];
  } else {
    const mapAprem: Record<number, number> = { 9: 1, 15: 2, 27: 3, 43: 4, 59: 5 };
    if (mapAprem[dayOfLife]) return mapAprem[dayOfLife];
  }
  if (stepLabel) {
    const match = stepLabel.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}

/**
  * Computes training number (1..11) based on day of life or step label
  */
export function computeEntrainementNum(dayOfLife: number, creneau: CreneauType, stepLabel?: string): number {
  if (creneau === 'matin') {
    const mapMatin: Record<number, number> = { 3: 1, 4: 2, 6: 3, 8: 4, 13: 5, 19: 6, 27: 7, 36: 8, 47: 9, 59: 10, 73: 11 };
    if (mapMatin[dayOfLife]) return mapMatin[dayOfLife];
  } else {
    const mapAprem: Record<number, number> = { 5: 1, 7: 2, 13: 3, 19: 4, 23: 5, 31: 6, 39: 7, 47: 8, 53: 9, 67: 10, 73: 11 };
    if (mapAprem[dayOfLife]) return mapAprem[dayOfLife];
  }
  if (stepLabel) {
    const match = stepLabel.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}

/**
  * Groups training into Codage (x4), Mémorisation / Automatisation (x2), or Remémoration (x1)
  */
export function computeEntrainementGroup(num: number): 'Codage (x4)' | 'Mémorisation / Automatisation (x2)' | 'Remémoration (x1)' {
  if (num <= 4) return 'Codage (x4)';
  if (num <= 8) return 'Mémorisation / Automatisation (x2)';
  return 'Remémoration (x1)';
}

/**
 * Returns pastel styling classes for each sequence type
 */
export function getActivityStyling(type: ActivityType | null): {
  colorClass: string;
  badgeColor: string;
} {
  switch (type) {
    case 'Leçon':
      return {
        colorClass: 'bg-blue-50/90 border-l-4 border-blue-500 text-blue-950 hover:bg-blue-100/70',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      };
    case 'Modelage':
      return {
        colorClass: 'bg-amber-50/90 border-l-4 border-amber-500 text-amber-950 hover:bg-amber-100/70',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'Entraînement':
      return {
        colorClass: 'bg-purple-50/90 border-l-4 border-purple-500 text-purple-950 hover:bg-purple-100/70',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      };
    case 'Tâche complexe':
      return {
        colorClass: 'bg-rose-50/90 border-l-4 border-rose-600 text-rose-950 hover:bg-rose-100/70',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      };
    case 'Évaluation':
      return {
        colorClass: 'bg-orange-50/90 border-l-4 border-orange-500 text-orange-950 hover:bg-orange-100/70',
        badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
      };
    case 'Révision':
      return {
        colorClass: 'bg-slate-100 border-l-4 border-slate-600 text-slate-900 hover:bg-slate-200/80',
        badgeColor: 'bg-slate-200 text-slate-800 border-slate-300',
      };
    case 'Autre':
    default:
      return {
        colorClass: 'bg-teal-50/90 border-l-4 border-teal-500 text-teal-950 hover:bg-teal-100/70',
        badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      };
  }
}

/**
 * Timeline Matin (J1 à J73+)
 */
export function getMorningTimelineStep(dayOfLife: number): SequenceStepResult {
  if (dayOfLife <= 0) {
    return { type: null, label: 'En attente', colorClass: '', badgeColor: '', orderPriority: 99 };
  }

  const map: Record<number, { type: ActivityType; label: string }> = {
    1: { type: 'Leçon', label: 'Leçon inaugurale' },
    2: { type: 'Modelage', label: 'Modelage guidé' },
    3: { type: 'Entraînement', label: 'Entraînement 1 (Découverte)' },
    4: { type: 'Entraînement', label: 'Entraînement 2 (Consolidation)' },
    5: { type: 'Évaluation', label: 'Évaluation formative 1' },
    6: { type: 'Entraînement', label: 'Entraînement 3' },
    7: { type: 'Évaluation', label: 'Évaluation formative 2' },
    8: { type: 'Entraînement', label: 'Entraînement 4' },
    // J9 Blanc
    10: { type: 'Tâche complexe', label: 'Tâche complexe (Application)' },
    11: { type: 'Évaluation', label: 'Évaluation 3' },
    // J12 Blanc
    13: { type: 'Entraînement', label: 'Entraînement 5 (Ancrage)' },
    // J14 Blanc
    15: { type: 'Évaluation', label: 'Évaluation 4' },
    // J16-J18 Blanc
    19: { type: 'Entraînement', label: 'Entraînement 6' },
    // J20-J21 Blanc
    22: { type: 'Évaluation', label: 'Évaluation 5' },
    // J23-J26 Blanc
    27: { type: 'Entraînement', label: 'Entraînement 7' },
    // J28-J30 Blanc
    31: { type: 'Évaluation', label: 'Évaluation 6' },
    // J32-J35 Blanc
    36: { type: 'Entraînement', label: 'Entraînement 8' },
    // J37-J39 Blanc
    40: { type: 'Évaluation', label: 'Évaluation 7' },
    // J41-J46 Blanc
    47: { type: 'Entraînement', label: 'Entraînement 9' },
    // J48-J50 Blanc
    51: { type: 'Évaluation', label: 'Évaluation 8' },
    // J52-J58 Blanc
    59: { type: 'Entraînement', label: 'Entraînement 10' },
    // J60-J62 Blanc
    63: { type: 'Évaluation', label: 'Évaluation 9 (Sommative)' },
    // J64-J72 Blanc
    73: { type: 'Entraînement', label: 'Entraînement 11 (Maintien)' },
  };

  const exact = map[dayOfLife];
  if (exact) {
    const styling = getActivityStyling(exact.type);
    return {
      type: exact.type,
      label: exact.label,
      ...styling,
      orderPriority: getActivitySortPriority(exact.type),
    };
  }

  // Beyond J73: Bloc Révision every 8 days (81, 89, 97...)
  if (dayOfLife > 73 && (dayOfLife - 73) % 8 === 0) {
    const revNum = (dayOfLife - 73) / 8;
    const styling = getActivityStyling('Révision');
    return {
      type: 'Révision',
      label: `Révision spiralaire #${revNum}`,
      ...styling,
      orderPriority: getActivitySortPriority('Révision'),
    };
  }

  return {
    type: null, // Blanc / Rien
    label: 'Repos spiralaire (Blanc)',
    colorClass: '',
    badgeColor: '',
    orderPriority: 99,
  };
}

/**
 * Timeline Après-midi (J1 à J73+)
 * Chronologie interne d'une notion après-midi depuis son ouverture (dayOfLife)
 */
export function getAfternoonTimelineStep(dayOfLife: number): SequenceStepResult {
  if (dayOfLife <= 0) {
    return { type: null, label: 'En attente', colorClass: '', badgeColor: '', orderPriority: 99 };
  }

  // Grille des étapes selon le jour de vie d'une notion après-midi (dayOfLife = 1 le jour de son ouverture)
  const map: Record<number, { type: ActivityType; label: string }> = {
    1: { type: 'Leçon', label: 'Leçon AM' },
    3: { type: 'Modelage', label: 'Modelage AM' },
    5: { type: 'Entraînement', label: 'Entraînement 1 AM' },
    7: { type: 'Entraînement', label: 'Entraînement 2 AM' },
    9: { type: 'Évaluation', label: 'Évaluation 1 AM' },
    11: { type: 'Tâche complexe', label: 'Tâche complexe 1 AM' },
    13: { type: 'Entraînement', label: 'Entraînement 3 AM' },
    15: { type: 'Évaluation', label: 'Évaluation 2 AM' },
    19: { type: 'Entraînement', label: 'Entraînement 4 AM' },
    23: { type: 'Entraînement', label: 'Entraînement 5 AM' },
    27: { type: 'Évaluation', label: 'Évaluation 3 AM' },
    31: { type: 'Entraînement', label: 'Entraînement 6 AM' },
    35: { type: 'Tâche complexe', label: 'Tâche complexe 2 AM' },
    39: { type: 'Entraînement', label: 'Entraînement 7 AM' },
    43: { type: 'Évaluation', label: 'Évaluation 4 AM' },
    47: { type: 'Entraînement', label: 'Entraînement 8 AM' },
    53: { type: 'Entraînement', label: 'Entraînement 9 AM' },
    59: { type: 'Évaluation', label: 'Évaluation 5 AM' },
    67: { type: 'Entraînement', label: 'Entraînement 10 AM' },
    73: { type: 'Entraînement', label: 'Entraînement 11 AM' },
  };

  const exact = map[dayOfLife];
  if (exact) {
    const styling = getActivityStyling(exact.type);
    return {
      type: exact.type,
      label: exact.label,
      ...styling,
      orderPriority: getActivitySortPriority(exact.type),
    };
  }

  // Au-delà du jour de vie 73 (notion achevée) : Bloc Révision déclenché tous les 8 jours (dayOfLife 81, 89, 97...)
  if (dayOfLife > 73 && (dayOfLife - 73) % 8 === 0) {
    const revNum = (dayOfLife - 73) / 8;
    const styling = getActivityStyling('Révision');
    return {
      type: 'Révision',
      label: `Révision AM #${revNum} (Notion achevée)`,
      ...styling,
      orderPriority: getActivitySortPriority('Révision'),
    };
  }

  return {
    type: null,
    label: 'Repos spiralaire AM (Blanc)',
    colorClass: '',
    badgeColor: '',
    orderPriority: 99,
  };
}

/**
 * Resolves working days of week (0=Sunday, 1=Monday ... 6=Saturday) for a given date string (YYYY-MM-DD).
 * Reads in priority the specific working days configured for the period active on that date.
 * If periods are configured, dates outside all defined periods return [] (non-working / vacation days).
 */
export function getWorkingDaysForDate(dStr: string, settings?: UserSettings): number[] {
  if (settings?.periods && Array.isArray(settings.periods) && settings.periods.length > 0) {
    const activePeriod = settings.periods.find(
      (p) => p.startDate && p.endDate && dStr >= p.startDate && dStr <= p.endDate
    );
    if (activePeriod) {
      const pDays = activePeriod.working_days;
      if (Array.isArray(pDays)) {
        return pDays.map(Number);
      }
      return [];
    }
    // Date does not fall into any defined period -> non-working inter-period / vacation
    return [];
  }
  return settings?.working_days || [1, 2, 4, 5];
}

/**
 * Calculates the Useful Working Day index (#N) for a given date,
 * subtracting the dynamic delay counter (absences_count).
 *
 * Example: if date is the 10th working day since school start,
 * and teacher has 2 days of absence recorded, the effective useful day is 8.
 */
export function calculateUsefulDayIndex(
  dateStr: string,
  settings: UserSettings,
  creneau?: CreneauType
): {
  usefulDay: number;
  rawWorkingDay: number;
  isWorkingDay: boolean;
  holidayReason?: string;
  startDateStr: string;
  delayCount: number;
  delayMorning: number;
  delayAfternoon: number;
} {
  const targetDate = new Date(dateStr + 'T00:00:00');
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth(); // 0 = Jan ... 7 = Aug, 8 = Sept

  // School year starts Sept 1 of targetYear if month >= 7 (August/September), else targetYear - 1
  const schoolStartYear = targetMonth >= 7 ? targetYear : targetYear - 1;

  let startDateStr: string | undefined = settings.school_year_start;

  // Check if configured school_year_start matches target date's school year
  if (startDateStr) {
    const configuredYear = new Date(startDateStr + 'T00:00:00').getFullYear();
    if (Math.abs(configuredYear - schoolStartYear) >= 1) {
      startDateStr = undefined; // Outdated school year start, align to target date
    }
  }

  // If period 1 exists for this school year, use its startDate
  if (!startDateStr && settings.periods && settings.periods.length > 0) {
    const p1 = settings.periods[0];
    if (p1 && p1.startDate) {
      const p1Year = new Date(p1.startDate + 'T00:00:00').getFullYear();
      if (Math.abs(p1Year - schoolStartYear) <= 1) {
        startDateStr = p1.startDate;
      }
    }
  }

  if (!startDateStr) {
    startDateStr = `${schoolStartYear}-09-01`;
  }

  const startDate = new Date(startDateStr + 'T00:00:00');

  const holidaysList = settings?.holidays || [];
  const vacationRanges = getVacationRanges(settings);

  const delayMorning = settings.delay_morning !== undefined
    ? settings.delay_morning
    : (settings.absences_count || 0);
  const delayAfternoon = settings.delay_afternoon !== undefined
    ? settings.delay_afternoon
    : 0;

  const delayCount = creneau === 'aprem' ? delayAfternoon : delayMorning;

  // Check if date falls within one of the 4 school vacation ranges
  const activeVacation = vacationRanges.find(
    (v) => v.startDate && v.endDate && dateStr >= v.startDate && dateStr <= v.endDate
  );

  if (activeVacation) {
    return {
      usefulDay: 0,
      rawWorkingDay: 0,
      isWorkingDay: false,
      holidayReason: `Vacances scolaires (${activeVacation.name})`,
      startDateStr,
      delayCount,
      delayMorning,
      delayAfternoon,
    };
  }

  // Check if date is in explicit holidays list
  if (Array.isArray(holidaysList) && typeof holidaysList[0] === 'string' && (holidaysList as string[]).includes(dateStr)) {
    return {
      usefulDay: 0,
      rawWorkingDay: 0,
      isWorkingDay: false,
      holidayReason: 'Jour férié ou vacances scolaires',
      startDateStr,
      delayCount,
      delayMorning,
      delayAfternoon,
    };
  }

  // Check day of week
  const dayOfWeek = targetDate.getDay();
  const activeWorkingDays = getWorkingDaysForDate(dateStr, settings);
  if (!activeWorkingDays.includes(dayOfWeek)) {
    return {
      usefulDay: 0,
      rawWorkingDay: 0,
      isWorkingDay: false,
      holidayReason: 'Jour non travaillé dans le calendrier',
      startDateStr,
      delayCount,
      delayMorning,
      delayAfternoon,
    };
  }

  if (targetDate < startDate) {
    return {
      usefulDay: 0,
      rawWorkingDay: 0,
      isWorkingDay: false,
      holidayReason: 'Avant la rentrée scolaire',
      startDateStr,
      delayCount,
      delayMorning,
      delayAfternoon,
    };
  }

  // Count all valid working days between start_date and target_date inclusive
  let rawWorkingDaysCount = 0;
  let current = new Date(startDate);
  while (current <= targetDate) {
    const dStr = current.toISOString().split('T')[0];

    const vMatch = vacationRanges.find(
      (v) => v.startDate && v.endDate && dStr >= v.startDate && dStr <= v.endDate
    );

    if (vMatch) {
      // Jump to the day after vacation end date
      const [vYear, vMonth, vDay] = vMatch.endDate.split('-').map(Number);
      current = new Date(vYear, vMonth - 1, vDay + 1);
      continue;
    }

    const dow = current.getDay();
    const wDays = getWorkingDaysForDate(dStr, settings);
    const isExplicitHoliday = Array.isArray(holidaysList) && typeof holidaysList[0] === 'string' && (holidaysList as string[]).includes(dStr);

    if (wDays.includes(dow) && !isExplicitHoliday) {
      rawWorkingDaysCount++;
    }
    current.setDate(current.getDate() + 1);
  }

  const effectiveUsefulDay = Math.max(0, rawWorkingDaysCount - delayCount);

  return {
    usefulDay: effectiveUsefulDay,
    rawWorkingDay: rawWorkingDaysCount,
    isWorkingDay: true,
    startDateStr,
    delayCount,
    delayMorning,
    delayAfternoon,
  };
}

/**
 * Calculates the opening useful day for afternoon sequences based on waves.
 * e.g. open_days=2, pause_days=2:
 * Seq 1 -> Day 3, Seq 2 -> Day 4
 * Seq 3 -> Day 7, Seq 4 -> Day 8
 * Seq 5 -> Day 11, Seq 6 -> Day 12
 */
export function getAfternoonOpeningDay(
  ordreSequence: number,
  openDays = 2,
  pauseDays = 2
): number {
  if (ordreSequence <= 0) return 3;
  const zeroIndex = ordreSequence - 1;
  const waveNumber = Math.floor(zeroIndex / openDays);
  const posInWave = zeroIndex % openDays;
  return 3 + waveNumber * (openDays + pauseDays) + posInWave;
}

/**
 * Given the useful working day of the class (#N), computes the day of life
 * for a sequence in Morning or Afternoon.
 * For each level/grade and period, 'ordre_sequence' indicates the useful working day
 * when the competence starts (J1 of life).
 */
export function computeSequenceDayOfLife(
  usefulDay: number,
  ordreSequence: number,
  creneau: CreneauType,
  settings?: UserSettings
): number {
  if (creneau === 'aprem') {
    const openingDay = getAfternoonOpeningDay(ordreSequence);
    return usefulDay - openingDay + 1;
  }
  return usefulDay - ordreSequence + 1;
}

/**
 * Calculates the next useful working date string 'YYYY-MM-DD' after current dateStr.
 * Checks the 4 fixed vacation ranges; if candidate date falls in a vacation range,
 * automatically jumps to the next school return date (rentrée).
 */
export function getNextWorkingDateStr(
  dateStr: string,
  settings?: UserSettings
): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  let current = new Date(Date.UTC(year, month - 1, day + 1));
  const rawHolidays = settings?.holidays || [];
  const vacationRanges = getVacationRanges(settings);

  for (let i = 0; i < 365; i++) {
    const dStr = current.toISOString().split('T')[0];

    // Check if candidate date dStr falls into one of the 4 school vacation ranges
    const vacationMatch = vacationRanges.find(
      (v) => v.startDate && v.endDate && dStr >= v.startDate && dStr <= v.endDate
    );

    if (vacationMatch) {
      // Automatically jump to the next rentrée date (day after vacation endDate)
      const [vYear, vMonth, vDay] = vacationMatch.endDate.split('-').map(Number);
      current = new Date(Date.UTC(vYear, vMonth - 1, vDay + 1));
      continue; // re-evaluate from the rentrée date
    }

    // Check if dStr is an explicit holiday string
    if (Array.isArray(rawHolidays) && typeof rawHolidays[0] === 'string' && (rawHolidays as string[]).includes(dStr)) {
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    const dow = current.getUTCDay(); // 0 = Sun, 1 = Mon...
    const wDays = getWorkingDaysForDate(dStr, settings);
    if (wDays.includes(dow)) {
      return dStr;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  const fallback = new Date(Date.UTC(year, month - 1, day + 1));
  return fallback.toISOString().split('T')[0];
}
