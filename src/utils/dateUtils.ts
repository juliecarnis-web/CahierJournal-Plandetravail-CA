/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Safely shifts a date string in 'YYYY-MM-DD' format by N days without timezone offset issues.
 */
export function shiftDateString(dateStr: string, days: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().split('T')[0];
}

/**
 * Formats 'YYYY-MM-DD' into French long date string using UTC to avoid locale shifts.
 */
export function formatDateFrench(dateStr: string, includeYear = false): string {
  try {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Computes the previous working day (J-1 worked day) for the class.
 * Default working days: Monday (1), Tuesday (2), Thursday (4), Friday (5).
 * (Excludes Wednesday (3), Saturday (6), Sunday (0)).
 */
export function getPreviousWorkingDay(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  
  // Step back 1 day at a time until landing on Monday, Tuesday, Thursday, or Friday
  for (let i = 0; i < 14; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 5) {
      return d.toISOString().split('T')[0];
    }
  }
  return shiftDateString(dateStr, -1);
}

/**
 * Calculates the Monday date string ('YYYY-MM-DD') for the week containing `dateStr`.
 */
export function getMondayOfCurrentWeek(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Returns the effective working dates ('YYYY-MM-DD') for the week containing `dateStr`.
 * Uses period definitions from user settings or working_days array, defaulting to [1, 2, 4, 5].
 */
export function getEffectiveWorkingDaysOfWeek(
  dateStr: string,
  periods?: any[],
  defaultWorkingDays?: number[]
): string[] {
  const monday = getMondayOfCurrentWeek(dateStr);
  const result: string[] = [];

  for (let i = 0; i < 7; i++) {
    const candidate = shiftDateString(monday, i);
    const [year, month, day] = candidate.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

    // Check if candidate falls in a period
    let workingDaysForDate: number[] | null = null;
    if (periods && Array.isArray(periods) && periods.length > 0) {
      const activePeriod = periods.find(
        (p) => p.startDate && p.endDate && p.startDate <= candidate && candidate <= p.endDate
      );
      if (activePeriod && Array.isArray(activePeriod.working_days) && activePeriod.working_days.length > 0) {
        workingDaysForDate = activePeriod.working_days;
      }
    }

    if (!workingDaysForDate) {
      if (defaultWorkingDays && Array.isArray(defaultWorkingDays) && defaultWorkingDays.length > 0) {
        workingDaysForDate = defaultWorkingDays;
      } else {
        workingDaysForDate = [1, 2, 4, 5]; // Mon, Tue, Thu, Fri
      }
    }

    if (workingDaysForDate.includes(dayOfWeek)) {
      result.push(candidate);
    }
  }

  if (result.length === 0) {
    return [0, 1, 3, 4].map((offset) => shiftDateString(monday, offset));
  }

  return result;
}

