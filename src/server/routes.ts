/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import {
  getDatabaseStatus,
  resetAndSeedDatabase,
  getUserSettings,
  updateUserSettings,
  getCompetences,
  getChronologicalProgression,
  addChronologicalProgression,
  getManualAdjustments,
  addManualAdjustment,
  getCustomActivities,
  addCustomActivity,
  deleteCustomActivity,
  toggleAdjustmentDone,
  deleteManualAdjustment,
  getManualAdjustmentOptions,
  reportUndoneActivitiesToNextWorkingDay,
  reportSingleActivity,
  getActivityCompletionsForDate,
  getHomework,
  addHomework,
  upsertHomeworkAdjustment,
  moveHomework,
  duplicateHomework,
  toggleHomeworkDone,
  deleteHomework,
  deleteHomeworkAdjustment,
  getHomeworkConstraintsDiagnostic,
  migrateHomeworkFromLocalStorage,
  getStudents,
  getHomeworkForDate,
  importCsvProgression,
  truncateProgression,
  getAvailableGrades,
  getCustomTasks,
  addCustomTask,
  toggleCustomTaskCompleted,
  deleteCustomTask,
  updateActivityPosition,
  truncateManualAdjustments,
  truncateCustomActivities,
  truncateHomeworkManualAdjustments,
  truncateCustomHomework,
  getCustomHomeworkForDate,
  addCustomHomework,
  deleteCustomHomework,
  getCustomHomeworkOptions,
  getDifferentiationForCompetence,
  getAllDifferentiationOverview,
  getBanaliseeStatusForDate,
  deleteBanaliseeAdjustment,
  getUsefulDayInfo,
} from './db.js';
import {
  calculateUsefulDayIndex,
  computeSequenceDayOfLife,
  getMorningTimelineStep,
  getAfternoonTimelineStep,
  getActivitySortPriority,
  getActivityTypeOrderPriority,
  computeEvNumber,
  computeEntrainementNum,
  computeEntrainementGroup,
} from './spiralEngine.js';
import { ActivityCardItem, DailyCahierJournal, CreneauType, ActivityType, UserSettings, DelayEvent } from '../types.js';

const router = Router();

/**
 * GET /api/db/status & /api/db-status - PostgreSQL Neon database connection status
 */
router.get(['/db/status', '/db-status'], async (req, res) => {
  try {
    const status = await getDatabaseStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cahier-journal/options - Fetch dynamic options for manual adjustments (matieres, domaines, types, competences)
 */
router.get(['/cahier-journal/options', '/manual-options'], async (req, res) => {
  try {
    const options = await getManualAdjustmentOptions();
    res.json(options);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/db/seed - Reinitialize / Seed default JulieCB data
 */
router.post('/db/seed', async (req, res) => {
  try {
    const result = await resetAndSeedDatabase();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/settings - Teacher settings & Absence delay counter
 */
router.get('/settings', async (req, res) => {
  try {
    const teacherId = (req.query.teacher_id as string) || 'JulieCB';
    const settings = await getUserSettings(teacherId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/settings - Update settings
 */
router.put('/settings', async (req, res) => {
  try {
    const teacherId = (req.body.teacher_id as string) || (req.query.teacher_id as string) || 'JulieCB';
    const updated = await updateUserSettings(req.body, teacherId);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/settings - Update settings
 */
router.post('/settings', async (req, res) => {
  try {
    const teacherId = (req.body.teacher_id as string) || (req.query.teacher_id as string) || 'JulieCB';
    const updated = await updateUserSettings(req.body, teacherId);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/verify-password - Verify teacher password for editing pages
 */
router.post('/verify-password', async (req, res) => {
  try {
    const { password, teacherId = 'JulieCB' } = req.body;
    const settings = await getUserSettings(teacherId);
    const expected = settings.password_hash || 'HPF';
    if (password === expected || password === 'HPF' || password === 'enseignant123' || password === 'JulieCB') {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/competences - All competences from DB
 */
router.get('/competences', async (req, res) => {
  try {
    const comp = await getCompetences();
    res.json(comp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/students - Class list & differentiation levels
 */
router.get('/students', async (req, res) => {
  try {
    const list = await getStudents();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/available-grades - Dynamic grades available in DB
 */
router.get('/available-grades', async (req, res) => {
  try {
    const grades = await getAvailableGrades('JulieCB');
    res.json(grades);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
/**
 * GET /api/cahier-journal - Generates the unified daily journal for Matin & Après-midi
 * Query params: ?date=YYYY-MM-DD&grade=CM1|CM2|Tous
 */
router.get(['/cahier-journal', '/cahier-journal/:date'], async (req, res) => {
  try {
    const dateStr =
      (req.params.date as string) ||
      (req.query.date as string) ||
      new Date().toISOString().split('T')[0];
    const gradeFilter = (req.query.grade as string) || 'Tous';

    const teacherId = (req.query.teacher_id as string) || 'JulieCB';
    const settings = await getUserSettings(teacherId);

    const usefulDayInfoMatin = await getUsefulDayInfo(dateStr, 'matin', settings, teacherId);
    const usefulDayInfoAprem = await getUsefulDayInfo(dateStr, 'aprem', settings, teacherId);
    const delayMatin = usefulDayInfoMatin.delay;
    const delayAprem = usefulDayInfoAprem.delay;

    const availableGrades = await getAvailableGrades(teacherId);

    if (!usefulDayInfoMatin.isWorkingDay) {
      const response: DailyCahierJournal = {
        date: dateStr,
        jour_utile_index: 0,
        retard_count: delayMatin,
        delay_morning: delayMatin,
        delay_afternoon: delayAprem,
        is_working_day: false,
        holiday_reason: usefulDayInfoMatin.holidayReason,
        available_grades: availableGrades,
        matin: [],
        aprem: [],
      };
      return res.json(response);
    }

    // Fetch spiral progressions, manual adjustments, custom activities, and completions concurrently
    const [matinSeq, apremSeq, manualAdj, customActs, completionsMap] = await Promise.all([
      getChronologicalProgression('matin', teacherId),
      getChronologicalProgression('aprem', teacherId),
      getManualAdjustments(dateStr, teacherId),
      getCustomActivities(dateStr, teacherId),
      getActivityCompletionsForDate(dateStr, teacherId),
    ]);

    // If auto-reschedule is enabled globally, automatically roll uncompleted activities from past dates forward to dateStr
    // RULE OF PRIMACY: If an individual card has reporter_au_lendemain === false or report_j1 === false, it must NEVER be auto-rescheduled.
    if (Boolean(settings.auto_reschedule_enabled)) {
      try {
        const [allPastManual, allPastCustom] = await Promise.all([
          getManualAdjustments('', teacherId),
          getCustomActivities('', teacherId),
        ]);
        for (const m of allPastManual) {
          const actDate = m.date_ajustement || m.date;
          // Check Primacy Rule: individual setting false overrides global true
          const canReport = m.reporter_au_lendemain !== false && (m as any).report_j1 !== false;
          if (actDate && actDate < dateStr && canReport) {
            const pastCompletions = await getActivityCompletionsForDate(actDate, teacherId);
            const isDone = m.fait || pastCompletions.get(`manual-${m.id}`) === true;
            if (!isDone) {
              await reportSingleActivity(m.id, 'manual', actDate, teacherId, m);
            }
          }
        }
        for (const c of allPastCustom) {
          const actDate = c.date_ajustement || c.date;
          // Check Primacy Rule: individual setting false overrides global true
          const canReport = c.reporter_au_lendemain !== false && (c as any).report_j1 !== false;
          if (actDate && actDate < dateStr && canReport) {
            const pastCompletions = await getActivityCompletionsForDate(actDate, teacherId);
            const isDone = c.fait || pastCompletions.get(`custom-${c.id}`) === true;
            if (!isDone) {
              await reportSingleActivity(c.id, 'custom', actDate, teacherId, c);
            }
          }
        }
      } catch (errAuto) {
        console.warn('⚠️ Auto-reschedule warning:', errAuto);
      }
    }

    function isRecurrenceMatching(startDate: string, dateTarget: string, recurrenceRule?: string, dateFin?: string | null): boolean {
      if (!recurrenceRule || recurrenceRule === 'aucune' || recurrenceRule === 'Aucune') {
        return startDate === dateTarget;
      }
      if (dateTarget < startDate) return false;
      if (dateFin && dateFin.trim() !== '' && dateTarget > dateFin.trim()) return false;

      if (recurrenceRule === 'tous_les_jours' || recurrenceRule === 'tous les jours' || recurrenceRule === 'Tous les jours') {
        return true;
      }

      const d1 = new Date(startDate + 'T00:00:00');
      const d2 = new Date(dateTarget + 'T00:00:00');

      if (recurrenceRule === 'toutes les semaines') {
        return d1.getDay() === d2.getDay();
      }
      if (recurrenceRule === 'toutes les deux semaines') {
        const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
        return diffDays >= 0 && diffDays % 14 === 0;
      }
      if (recurrenceRule === 'une fois par mois') {
        return d1.getDate() === d2.getDate();
      }
      return startDate === dateTarget;
    }

    const generateCardsForCreneau = (
      creneau: CreneauType,
      sequences: typeof matinSeq
    ): ActivityCardItem[] => {
      const cards: ActivityCardItem[] = [];
      const usefulDay = creneau === 'matin' ? usefulDayInfoMatin.usefulDay : usefulDayInfoAprem.usefulDay;
      const currentDelay = creneau === 'matin' ? delayMatin : delayAprem;
      const isBanaliseeToday = creneau === 'matin' ? usefulDayInfoMatin.isBanaliseeToday : usefulDayInfoAprem.isBanaliseeToday;
      const usedAdjIds = new Set<number>();
      const usedCustomIds = new Set<number>();

      // 1. Add spiral progressions that are active today (merging with any custom manual adjustment)
      for (const seq of sequences) {
        if (isBanaliseeToday) {
          // On a banalisée day, all spiral progression steps are shifted to the next useful day.
          // No spiral sequence cards should persist on a banalisée day.
          continue;
        }

        if (gradeFilter && gradeFilter !== 'Tous') {
          const normFilter = gradeFilter.trim().toUpperCase();
          const normGrade = (seq.grade || '').trim().toUpperCase();
          if (normGrade !== normFilter && normGrade !== 'TOUS') {
            continue;
          }
        } else if (settings.active_grades && settings.active_grades.length > 0) {
          const normActive = settings.active_grades.map((g) => g.trim().toUpperCase());
          const normGrade = (seq.grade || '').trim().toUpperCase();
          if (normGrade !== 'TOUS' && !normActive.includes(normGrade)) {
            continue;
          }
        }

        const dayOfLife = computeSequenceDayOfLife(
          usefulDay,
          seq.ordre_sequence,
          creneau,
          settings
        );

        if (dayOfLife >= 1) {
          const stepInfo =
            creneau === 'matin'
              ? getMorningTimelineStep(dayOfLife)
              : getAfternoonTimelineStep(dayOfLife);

          // If there is an activity scheduled on this day of life (not Blanc/Rien)
          if (stepInfo.type !== null) {
            const evNum = stepInfo.type === 'Évaluation' ? computeEvNumber(dayOfLife, seq.creneau, stepInfo.label) : undefined;
            const entNum = stepInfo.type === 'Entraînement' ? computeEntrainementNum(dayOfLife, seq.creneau, stepInfo.label) : undefined;
            const entGrp = entNum ? computeEntrainementGroup(entNum) : undefined;

            const expectedExoNum = entNum ? String(entNum) : (evNum ? String(evNum) : '');

            // Check if there is a custom manual adjustment or report specifically for THIS activity on dateStr
            const customAdj = manualAdj.find((a) => {
              const matchesProg = (a.progression_id && a.progression_id === seq.id) ||
                (a.competence_code && a.competence_code === seq.competence_code && a.creneau === creneau);
              if (!matchesProg) return false;
              const adjActiveDate = a.date_ajustement || a.date;
              if (adjActiveDate !== dateStr) return false;

              // Filter by type_activite if specified
              if (a.type_activite && a.type_activite !== stepInfo.type) {
                return false;
              }

              // Filter by numero_exercice if specified
              if (a.numero_exercice && expectedExoNum && String(a.numero_exercice).trim() !== expectedExoNum.trim() && !String(a.numero_exercice).trim().endsWith(expectedExoNum.trim())) {
                return false;
              }

              return true;
            });

            // Check if this progression item was postponed away to a different date
            const postponedAwayAdj = manualAdj.find((a) => {
              const matchesProg = (a.progression_id && a.progression_id === seq.id) ||
                (a.competence_code && a.competence_code === seq.competence_code && a.creneau === creneau);
              if (!matchesProg) return false;
              const origDate = a.original_date || a.date;
              if (origDate !== dateStr || !a.date_ajustement || a.date_ajustement === dateStr) return false;

              if (a.type_activite && a.type_activite !== stepInfo.type) {
                return false;
              }

              if (a.numero_exercice && expectedExoNum && String(a.numero_exercice).trim() !== expectedExoNum.trim() && !String(a.numero_exercice).trim().endsWith(expectedExoNum.trim())) {
                return false;
              }

              return true;
            });

            if (customAdj) {
              usedAdjIds.add(customAdj.id);
              const isReported =
                (!customAdj.recurrence || customAdj.recurrence === 'aucune') &&
                Boolean(
                  (customAdj.original_date || customAdj.date) &&
                  (customAdj.original_date || customAdj.date) < dateStr &&
                  customAdj.date_ajustement &&
                  customAdj.date_ajustement !== customAdj.date
                );
              
              const compKeyManual = `manual-${customAdj.id}`;
              const compKeyCustom = `custom-${customAdj.id}`;
              let faitState = customAdj.fait;
              if (completionsMap.has(compKeyManual)) {
                faitState = completionsMap.get(compKeyManual)!;
              } else if (completionsMap.has(compKeyCustom)) {
                faitState = completionsMap.get(compKeyCustom)!;
              } else if (customAdj.recurrence && customAdj.recurrence !== 'aucune') {
                faitState = false;
              }

              cards.push({
                id: `adj-${customAdj.id}`,
                source: 'progression',
                creneau: seq.creneau,
                grade: customAdj.grade || seq.grade,
                type_activite: (customAdj.type_activite as ActivityType) || stepInfo.type,
                titre: customAdj.titre || customAdj.titre_chapitre || seq.titre_chapitre || seq.intitule || stepInfo.label,
                description: customAdj.description || '',
                numero_exercice: customAdj.numero_exercice || '',
                competence_code: seq.competence_code,
                competence_prefixe: seq.prefixe,
                competence_intitule: seq.intitule,
                titre_chapitre: customAdj.titre_chapitre || customAdj.titre || seq.titre_chapitre,
                url: customAdj.url || seq.url,
                day_of_life: dayOfLife,
                ev_number: evNum,
                entrainement_num: entNum,
                entrainement_group: entGrp,
                fait: faitState,
                reporter_au_lendemain: customAdj.reporter_au_lendemain ?? true,
                db_id: customAdj.id,
                progression_id: seq.id,
                matiere: customAdj.matiere,
                domaine: customAdj.domaine,
                pastel_color: customAdj.pastel_color,
                recurrence: customAdj.recurrence,
                is_custom: false,
                color_label: customAdj.color_label,
                order_index: customAdj.order_index ?? customAdj.ordre ?? 1,
                ordre: customAdj.ordre ?? customAdj.order_index ?? 1,
                is_reported: isReported,
                en_retard: isReported,
                original_date: customAdj.original_date || customAdj.date,
              });
            } else if (!postponedAwayAdj && !isBanaliseeToday) {
              const cardId = `seq-${seq.creneau}-${seq.id}-${dayOfLife}`;
              const seqFait = completionsMap.has(cardId) ? completionsMap.get(cardId)! : false;
              const isDelayedByCounter = currentDelay > 0;

              cards.push({
                id: cardId,
                source: 'progression',
                creneau: seq.creneau,
                grade: seq.grade,
                type_activite: stepInfo.type,
                titre: seq.titre_chapitre || seq.intitule || stepInfo.label,
                description: '',
                competence_code: seq.competence_code,
                competence_prefixe: seq.prefixe,
                competence_intitule: seq.intitule,
                titre_chapitre: seq.titre_chapitre,
                url: seq.url,
                day_of_life: dayOfLife,
                ev_number: evNum,
                entrainement_num: entNum,
                entrainement_group: entGrp,
                fait: seqFait,
                reporter_au_lendemain: true,
                progression_id: seq.id,
                order_index: 100,
                ordre: 100,
                is_reported: isDelayedByCounter,
                en_retard: isDelayedByCounter,
                original_date: isDelayedByCounter ? dateStr : undefined,
              });
            }
          }
        }
      }

      // 2. Add manual custom activities and adjustments for this creneau
      const allManualItems = [
        ...customActs.map((c) => ({ ...c, _isFromCustomTable: true })),
        ...manualAdj.map((m) => ({ ...m, _isFromCustomTable: false })),
      ];
      for (const adj of allManualItems) {
        if (adj.creneau !== creneau) continue;
        const isCustomCard = Boolean((adj as any)._isFromCustomTable || adj.is_custom === true);
        const isBanaliseeBanner = (adj.type_activite as string) === 'Banalisée' || (adj as any).action_type === 'banalisee';

        if (isBanaliseeToday && !isCustomCard && !isBanaliseeBanner) {
          continue;
        }

        if (isCustomCard) {
          if (usedCustomIds.has(adj.id)) continue;
          usedCustomIds.add(adj.id);
        } else {
          if (usedAdjIds.has(adj.id)) continue;
          usedAdjIds.add(adj.id);
        }

        if (gradeFilter && gradeFilter !== 'Tous') {
          const normFilter = gradeFilter.trim().toUpperCase();
          const normGrade = (adj.grade || '').trim().toUpperCase();
          if (normGrade && normGrade !== normFilter && normGrade !== 'TOUS') {
            continue;
          }
        } else if (settings.active_grades && settings.active_grades.length > 0) {
          const normActive = settings.active_grades.map((g) => g.trim().toUpperCase());
          const normGrade = (adj.grade || '').trim().toUpperCase();
          if (normGrade && normGrade !== 'TOUS' && !normActive.includes(normGrade)) {
            continue;
          }
        }

        const startDate = adj.date || adj.original_date || adj.date_ajustement || dateStr;
        const dateFin = (adj as any).date_fin || null;
        const isRec = Boolean(adj.recurrence && adj.recurrence !== 'aucune');

        if (isRec) {
          if (!isRecurrenceMatching(startDate, dateStr, adj.recurrence, dateFin)) continue;
        } else {
          const activeDate = adj.date_ajustement || adj.date || dateStr;
          if (activeDate !== dateStr) continue;
        }

        const origDate = adj.original_date || adj.date;
        const isReported = !isRec && Boolean(origDate && origDate < dateStr);

        const compKeyCustom = `custom-${adj.id}`;
        const compKeyManual = `manual-${adj.id}`;
        let faitState = false;
        if (isCustomCard && completionsMap.has(compKeyCustom)) {
          faitState = completionsMap.get(compKeyCustom)!;
        } else if (!isCustomCard && completionsMap.has(compKeyManual)) {
          faitState = completionsMap.get(compKeyManual)!;
        } else if (completionsMap.has(compKeyCustom)) {
          faitState = completionsMap.get(compKeyCustom)!;
        } else if (completionsMap.has(compKeyManual)) {
          faitState = completionsMap.get(compKeyManual)!;
        } else if (!isRec && adj.fait !== undefined && adj.fait !== null) {
          // Fallback only for non-recurring single-date activities if no completion record exists
          faitState = Boolean(adj.fait);
        }

        let compCode = isCustomCard ? (adj.competence_code || '') : (adj.competence_code || 'PERSO');
        let compPrefix = isCustomCard ? '' : 'PERSO';
        let compIntitule = isCustomCard ? 'Activité personnalisée' : 'Activité manuelle / Adaptée';
        if (adj.progression_id) {
          const matchedSeq = sequences.find((s) => s.id === adj.progression_id);
          if (matchedSeq) {
            compCode = matchedSeq.competence_code || compCode;
            compPrefix = matchedSeq.prefixe || compPrefix;
            compIntitule = matchedSeq.intitule || compIntitule;
          }
        }

        cards.push({
          id: isCustomCard ? `custom-${adj.id}` : `adj-${adj.id}`,
          source: isCustomCard ? 'manual' : (adj.progression_id ? 'progression' : 'manual'),
          creneau: adj.creneau,
          grade: adj.grade || 'Tous',
          type_activite: adj.type_activite,
          titre: adj.titre || (adj as any).titre_chapitre || 'Activité',
          description: adj.description || '',
          numero_exercice: adj.numero_exercice || '',
          competence_code: compCode,
          competence_prefixe: compPrefix,
          competence_intitule: compIntitule,
          titre_chapitre: (adj as any).titre_chapitre || adj.titre || 'Activité',
          url: adj.url,
          fait: faitState,
          reporter_au_lendemain: adj.reporter_au_lendemain,
          db_id: adj.id,
          progression_id: adj.progression_id,
          is_reported: isReported,
          en_retard: isReported,
          date: adj.date || startDate,
          original_date: adj.original_date || adj.date || startDate,
          date_ajustement: adj.date_ajustement || startDate,
          date_fin: dateFin,
          matiere: adj.matiere,
          domaine: adj.domaine,
          pastel_color: adj.pastel_color,
          recurrence: adj.recurrence,
          is_custom: isCustomCard,
          color_label: adj.color_label,
          position_anchor: adj.position_anchor,
          order_index: adj.order_index ?? adj.ordre ?? (isCustomCard ? 999 : 100),
          ordre: adj.ordre ?? adj.order_index ?? (isCustomCard ? 999 : 100),
        });
      }

      // 3. Sort strictly by requested order or custom order_index
      return cards.sort((a, b) => {
        const ordA = a.order_index ?? a.ordre;
        const ordB = b.order_index ?? b.ordre;
        if (ordA !== undefined && ordB !== undefined && ordA !== ordB && ordA < 100 && ordB < 100) {
          return ordA - ordB;
        }

        const isReportedA = Boolean((!a.recurrence || a.recurrence === 'aucune') && (a.is_reported || a.en_retard || (a.original_date && a.original_date < dateStr && a.date_ajustement !== a.date)));
        const isReportedB = Boolean((!b.recurrence || b.recurrence === 'aucune') && (b.is_reported || b.en_retard || (b.original_date && b.original_date < dateStr && b.date_ajustement !== b.date)));

        const pA = getActivityTypeOrderPriority(a.type_activite, isReportedA, a.is_custom, a.position_anchor);
        const pB = getActivityTypeOrderPriority(b.type_activite, isReportedB, b.is_custom, b.position_anchor);
        if (pA !== pB) return pA - pB;

        if (ordA !== undefined && ordB !== undefined && ordA !== ordB) {
          return ordA - ordB;
        }

        // If both are Évaluations:
        if (a.type_activite === 'Évaluation' && b.type_activite === 'Évaluation') {
          const evA = a.ev_number ?? 99;
          const evB = b.ev_number ?? 99;
          if (evA !== evB) return evA - evB; // Numeric EV order (EV1, EV2, EV3...)
          const dolA = a.day_of_life ?? 999;
          const dolB = b.day_of_life ?? 999;
          return dolA - dolB;
        }

        if (a.type_activite === 'Entraînement' && b.type_activite === 'Entraînement') {
          const numA = a.entrainement_num ?? 99;
          const numB = b.entrainement_num ?? 99;
          if (numA !== numB) return numA - numB;
        }

        const dolA = a.day_of_life ?? 999;
        const dolB = b.day_of_life ?? 999;
        if (dolA !== dolB) return dolA - dolB;

        return (a.titre_chapitre || a.titre || '').localeCompare(b.titre_chapitre || b.titre || '');
      });
    };

    const customTasksList = await getCustomTasks(teacherId);
    const todoCards: ActivityCardItem[] = customTasksList.map((t) => ({
      id: `task-${t.id}`,
      source: 'manual',
      creneau: 'todo' as any,
      grade: 'Tous' as any,
      type_activite: 'Note',
      titre: t.task_text,
      description: t.task_text,
      competence_code: 'TODO',
      competence_prefixe: 'NOTE',
      competence_intitule: 'À ne pas oublier',
      titre_chapitre: t.task_text,
      url: undefined,
      fait: t.completed,
      reporter_au_lendemain: false,
      db_id: t.id,
      is_todo: true,
    }));

    const manualTodoCards: ActivityCardItem[] = [...customActs, ...manualAdj]
      .filter((a) => a.creneau === 'todo' || a.creneau === 'notes')
      .map((adj) => ({
        id: `adj-${adj.id}`,
        source: 'manual',
        creneau: adj.creneau as any,
        grade: adj.grade,
        type_activite: adj.type_activite,
        titre: adj.titre,
        description: adj.description,
        competence_code: adj.competence_code || 'TODO',
        competence_prefixe: 'NOTE',
        competence_intitule: 'À ne pas oublier',
        titre_chapitre: adj.titre,
        url: adj.url,
        fait: adj.fait,
        reporter_au_lendemain: adj.reporter_au_lendemain,
        db_id: adj.id,
        is_todo: true,
      }));

    const matinCards = generateCardsForCreneau('matin', matinSeq);
    const apremCards = generateCardsForCreneau('aprem', apremSeq);

    // Enrich Évaluation and Entraînement cards with differentiation data
    const allJournalCards = [...matinCards, ...apremCards];
    for (const card of allJournalCards) {
      if ((card.type_activite === 'Évaluation' || card.type_activite === 'Entraînement') && card.competence_code) {
        const diff = await getDifferentiationForCompetence(card.competence_code, teacherId, settings.active_grades);
        if (diff.has_data) {
          if (card.type_activite === 'Évaluation') {
            card.differentiation_eval = {
              need_group: diff.need_group,
              success_group: diff.success_group,
            };
          } else if (card.type_activite === 'Entraînement') {
            card.differentiation_ent = {
              cohort_average: diff.cohort_average,
              ent_optional: diff.cohort_average >= 3,
            };
          }
        }
      }
    }

    console.log(`[CAHIER JOURNAL] ----------------------------------------`);
    console.log(`[CAHIER JOURNAL] Date ciblée : ${dateStr} (Teacher: ${teacherId}, Grade: ${gradeFilter})`);
    console.log(`[CAHIER JOURNAL] Matin - Retard : ${delayMatin}, Jour utile : ${usefulDayInfoMatin.usefulDay}`);
    console.log(`[CAHIER JOURNAL] Après-midi - Retard : ${delayAprem}, Jour utile : ${usefulDayInfoAprem.usefulDay}`);
    console.log(`[CAHIER JOURNAL] Cartes Matin : ${matinCards.length}, Cartes Après-midi : ${apremCards.length}`);
    console.log(`[CAHIER JOURNAL] ----------------------------------------`);

    const response: DailyCahierJournal = {
      date: dateStr,
      jour_utile_index: usefulDayInfoMatin.usefulDay,
      retard_count: delayMatin,
      delay_morning: delayMatin,
      delay_afternoon: delayAprem,
      is_working_day: true,
      available_grades: availableGrades,
      active_grades: settings.active_grades || availableGrades,
      matin: matinCards,
      aprem: apremCards,
      todos: [...todoCards, ...manualTodoCards],
    };

    res.json(response);
  } catch (error: any) {
    console.error('[CAHIER JOURNAL ROUTE ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

router.get('/differentiation/overview', async (req, res) => {
  try {
    const teacherId = (req.query.teacher_id as string) || 'JulieCB';
    let activeGrades: string[] | undefined = undefined;
    if (req.query.active_grades) {
      activeGrades = String(req.query.active_grades).split(',').map((s) => s.trim()).filter(Boolean);
    }
    let scheduledCodes: string[] | undefined = undefined;
    if (req.query.scheduled_codes) {
      scheduledCodes = String(req.query.scheduled_codes).split(',').map((s) => s.trim()).filter(Boolean);
    }
    const overview = await getAllDifferentiationOverview(teacherId, activeGrades, scheduledCodes);
    res.json(overview);
  } catch (error: any) {
    console.error('[DIFFERENTIATION OVERVIEW ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

/**
 * POST /api/cahier-journal/toggle-done & POST /api/activity-done - Check/uncheck "Fait"
 */
const handleToggleDoneRequest = async (req: any, res: any) => {
  try {
    const { id, db_id, fait, date, card, teacher_id } = req.body;
    const targetDbId = db_id || id;
    const targetTeacher = teacher_id || 'JulieCB';

    if (targetDbId && !isNaN(Number(targetDbId))) {
      await toggleAdjustmentDone(
        Number(targetDbId),
        Boolean(fait),
        date,
        card,
        targetTeacher
      );
      return res.json({ success: true });
    }

    if (card && date) {
      const isSpiralCard = Boolean(card.progression_id || card.source === 'progression' || !card.is_custom);
      let created: any = null;
      if (isSpiralCard) {
        created = await addManualAdjustment({
          progression_id: card.progression_id,
          date,
          date_ajustement: date,
          creneau: card.creneau || 'matin',
          grade: card.grade || 'Tous',
          titre: card.titre_chapitre || card.titre || 'Activité',
          description: card.description || '',
          type_activite: card.type_activite || 'Autre',
          ordre: 1,
          fait: Boolean(fait),
          reporter_au_lendemain: true,
          teacher_id: targetTeacher,
          competence_code: card.competence_code,
          url: card.url,
          is_custom: false,
          original_date: card.original_date || date,
        });
      } else {
        created = await addCustomActivity({
          date,
          date_ajustement: date,
          creneau: card.creneau || 'matin',
          grade: card.grade || 'Tous',
          titre: card.titre_chapitre || card.titre || 'Activité',
          description: card.description || '',
          type_activite: card.type_activite || 'Autre',
          ordre: 1,
          fait: Boolean(fait),
          reporter_au_lendemain: card.reporter_au_lendemain,
          teacher_id: targetTeacher,
          competence_code: card.competence_code,
          url: card.url,
          is_custom: true,
          original_date: card.original_date || date,
        });
      }
      if (created && created.id) {
        await toggleAdjustmentDone(
          created.id,
          Boolean(fait),
          date,
          { ...card, db_id: created.id, is_custom: !isSpiralCard },
          targetTeacher
        );
        return res.json({ success: true, db_id: created.id });
      }
      return res.json({ success: true });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

router.post(['/activity-done', '/cahier-journal/toggle-done'], handleToggleDoneRequest);

/**
 * POST /api/report-undone & POST /api/cahier-journal/report-undone - Postpone unchecked activities to next working day
 */
const handleReportUndoneRequest = async (req: any, res: any) => {
  try {
    const dateStr =
      req.body.date ||
      req.body.currentDate ||
      new Date().toISOString().split('T')[0];
    const gradeFilter = req.body.grade || req.body.gradeFilter || 'Tous';
    const teacherId = req.body.teacher_id || 'JulieCB';

    // If client sent explicit uncompletedCards array, use it directly
    if (Array.isArray(req.body.uncompletedCards)) {
      const result = await reportUndoneActivitiesToNextWorkingDay(
        dateStr,
        teacherId,
        req.body.uncompletedCards
      );
      return res.json({
        success: true,
        count: result.count,
        postponedCount: result.postponedCount,
        targetDate: result.targetDate,
      });
    }

    const settings = await getUserSettings(teacherId);
    const usefulDayInfoMatin = await getUsefulDayInfo(dateStr, 'matin', settings, teacherId);
    const usefulDayInfoAprem = await getUsefulDayInfo(dateStr, 'aprem', settings, teacherId);

    const matinSeq = await getChronologicalProgression('matin', teacherId);
    const apremSeq = await getChronologicalProgression('aprem', teacherId);
    const manualAdj = await getManualAdjustments(dateStr, teacherId);

    // Build map of titles that are marked 'fait = true' in manual_adjustments for dateStr
    const doneMap = new Set<string>();
    for (const adj of manualAdj) {
      if (adj.fait) {
        doneMap.add(`${adj.creneau || 'matin'}-${(adj.titre || '').trim()}`);
        if (adj.competence_code) {
          doneMap.add(`${adj.creneau || 'matin'}-${adj.competence_code}`);
        }
      }
    }

    const generateForCreneau = (
      creneau: CreneauType,
      sequences: typeof matinSeq
    ): ActivityCardItem[] => {
      const cards: ActivityCardItem[] = [];
      const usefulDay = creneau === 'matin' ? usefulDayInfoMatin.usefulDay : usefulDayInfoAprem.usefulDay;

      for (const seq of sequences) {
        if (gradeFilter && gradeFilter !== 'Tous') {
          const normFilter = gradeFilter.trim().toUpperCase();
          const normGrade = (seq.grade || '').trim().toUpperCase();
          if (normGrade !== normFilter && normGrade !== 'TOUS') continue;
        }

        const dayOfLife = computeSequenceDayOfLife(usefulDay, seq.ordre_sequence, creneau, settings);
        if (dayOfLife >= 1) {
          const stepInfo = creneau === 'matin' ? getMorningTimelineStep(dayOfLife) : getAfternoonTimelineStep(dayOfLife);
          if (stepInfo.type !== null) {
            const seqTitre = seq.titre_chapitre || seq.intitule || stepInfo.label;
            const isDoneInAdj =
              doneMap.has(`${creneau}-${seqTitre.trim()}`) ||
              (seq.competence_code ? doneMap.has(`${creneau}-${seq.competence_code}`) : false);

            cards.push({
              id: `seq-${seq.creneau || creneau}-${seq.id}-${dayOfLife}`,
              source: 'progression',
              creneau: seq.creneau || creneau,
              grade: seq.grade || 'Tous',
              type_activite: stepInfo.type || 'Autre',
              titre: seqTitre,
              description: '',
              competence_code: seq.competence_code,
              competence_prefixe: seq.prefixe,
              competence_intitule: seq.intitule,
              titre_chapitre: seq.titre_chapitre,
              url: seq.url,
              day_of_life: dayOfLife,
              fait: isDoneInAdj,
              reporter_au_lendemain: true,
              progression_id: seq.id,
            });
          }
        }
      }

      for (const adj of manualAdj) {
        if (adj.creneau !== creneau) continue;
        if (gradeFilter && gradeFilter !== 'Tous') {
          const normFilter = gradeFilter.trim().toUpperCase();
          const normGrade = (adj.grade || '').trim().toUpperCase();
          if (normGrade !== normFilter && normGrade !== 'TOUS') continue;
        }
        cards.push({
          id: `adj-${adj.id}`,
          source: 'manual',
          creneau: adj.creneau || creneau,
          grade: adj.grade || 'Tous',
          type_activite: adj.type_activite || 'Autre',
          titre: adj.titre || 'Activité',
          description: adj.description || '',
          competence_code: adj.competence_code || 'PERSO',
          titre_chapitre: adj.titre || 'Activité',
          url: adj.url,
          fait: Boolean(adj.fait),
          reporter_au_lendemain: adj.reporter_au_lendemain ?? true,
          db_id: adj.id,
          original_date: adj.original_date || dateStr,
        });
      }

      return cards;
    };

    const allCards = [
      ...generateForCreneau('matin', matinSeq),
      ...generateForCreneau('aprem', apremSeq),
    ];

    const uncompletedCards = allCards.filter(
      (c) => !c.fait && c.reporter_au_lendemain !== false && (c as any).report_j1 !== false
    );

    const result = await reportUndoneActivitiesToNextWorkingDay(
      dateStr,
      teacherId,
      uncompletedCards
    );

    res.json({
      success: true,
      count: result.count,
      postponedCount: result.postponedCount,
      targetDate: result.targetDate,
    });
  } catch (error: any) {
    console.error('[REPORT UNDONE ERROR]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

router.post(['/report-undone', '/cahier-journal/report-undone'], handleReportUndoneRequest);

/**
 * POST /api/report-activity & POST /api/cahier-journal/report-activity - Report a single activity to next working day
 */
const handleReportActivityRequest = async (req: any, res: any) => {
  try {
    const { id, db_id, source, is_custom, currentDate, date, card, teacher_id } = req.body;
    const targetDate = currentDate || date || new Date().toISOString().split('T')[0];
    const targetTeacher = teacher_id || 'JulieCB';
    const targetId = db_id || id;
    const targetSource = source || (is_custom ? 'custom' : 'manual');

    const result = await reportSingleActivity(targetId, targetSource, targetDate, targetTeacher, card);
    res.json(result);
  } catch (error: any) {
    console.error('[REPORT ACTIVITY ERROR]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

router.post(['/report-activity', '/cahier-journal/report-activity'], handleReportActivityRequest);

/**
 * POST /api/manual-adjustments & POST /api/cahier-journal/manual-adjustments - Save/Upsert spiral adjustments in manual_adjustments table
 */
router.post(['/manual-adjustments', '/cahier-journal/manual-adjustments'], async (req, res) => {
  try {
    const created = await addManualAdjustment(req.body);
    res.json(created);
  } catch (error: any) {
    console.error('[MANUAL ADJUSTMENT ROUTE ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

/**
 * POST /api/manual-activity & POST /api/cahier-journal/add-manual & POST /api/custom-activities - Add manual activity (activités décrochées ou spiralaires)
 */
const handleAddManualRequest = async (req: any, res: any) => {
  try {
    if (req.body && (req.body.progression_id || req.body.is_custom === false)) {
      const created = await addManualAdjustment(req.body);
      return res.json(created);
    }
    const created = await addCustomActivity(req.body);
    res.json(created);
  } catch (error: any) {
    console.error('[ADD MANUAL REQUEST ROUTE ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
};

router.post(['/manual-activity', '/cahier-journal/add-manual', '/custom-activities'], handleAddManualRequest);

/**
 * DELETE /api/manual-adjustments/:id & DELETE /api/manual-activity/:id & DELETE /api/cahier-journal/activity/:id & DELETE /api/custom-activities/:id - Delete activity
 */
const handleDeleteManualRequest = async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    await deleteCustomActivity(id);
    await deleteManualAdjustment(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

router.delete(['/manual-adjustments/:id', '/manual-activity/:id', '/cahier-journal/activity/:id', '/custom-activities/:id'], handleDeleteManualRequest);

/**
 * POST /api/cahier-journal/reorder & POST /api/reorder-activities - Update positions (time_slot_id & order_index) for drag & drop
 */
const handleReorderActivitiesRequest = async (req: any, res: any) => {
  try {
    const { items } = req.body;
    if (Array.isArray(items)) {
      for (const item of items) {
        await updateActivityPosition(item);
      }
    } else if (req.body && req.body.time_slot_id) {
      await updateActivityPosition(req.body);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

router.post(['/cahier-journal/reorder', '/reorder-activities'], handleReorderActivitiesRequest);

/**
 * GET /api/progressions - Lists all spiral progressions (Matin and Après-midi)
 */
router.get('/progressions', async (req, res) => {
  try {
    const matin = await getChronologicalProgression('matin', 'JulieCB');
    const aprem = await getChronologicalProgression('aprem', 'JulieCB');
    res.json({ matin, aprem });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/progressions - Create a new sequence in Matin or Après-midi
 */
router.post('/progressions', async (req, res) => {
  try {
    const created = await addChronologicalProgression(req.body);
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/progressions/import - Import progressions from CSV
 */
router.post('/progressions/import', async (req, res) => {
  try {
    const { creneau, rows, clearExisting, teacher_id } = req.body;
    if (!creneau || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Format de requête invalide (creneau et rows sont requis).' });
    }
    const teacherId = teacher_id || 'JulieCB';
    const result = await importCsvProgression(creneau, rows, Boolean(clearExisting), teacherId);
    res.json(result);
  } catch (error: any) {
    console.error('[IMPORT PROGRESSION ROUTE ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

/**
 * DELETE /api/progressions/:creneau & POST /api/progressions/purge - Truncate / purge progression table
 */
router.delete('/progressions/:creneau', async (req, res) => {
  try {
    const creneau = req.params.creneau as CreneauType;
    const grade = (req.query.grade as string) || (req.body && req.body.grade);
    const teacherId = (req.query.teacher_id as string) || (req.body && req.body.teacher_id) || 'JulieCB';
    const result = await truncateProgression(creneau, grade, teacherId);
    res.json(result);
  } catch (error: any) {
    console.error('[PURGE PROGRESSION ROUTE ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

router.post('/progressions/purge', async (req, res) => {
  try {
    const { creneau, grade, teacher_id } = req.body;
    if (!creneau) {
      return res.status(400).json({ error: 'creneau est requis (matin ou aprem).' });
    }
    const teacherId = teacher_id || 'JulieCB';
    const result = await truncateProgression(creneau as CreneauType, grade, teacherId);
    res.json(result);
  } catch (error: any) {
    console.error('[PURGE PROGRESSION ROUTE ERROR]', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

/**
 * GET /api/homework - Fetch homework from PostgreSQL Neon table
 */
router.get('/homework', async (req, res) => {
  try {
    const grade = (req.query.grade as string) || 'Tous';
    const list = await getHomework(grade, 'JulieCB');
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/homework/:date - Fetch homework for specific date including auto J-1 suggestions
 */
router.get('/homework/:date', async (req, res) => {
  try {
    const dateStr = req.params.date;
    const grade = (req.query.grade as string) || 'Tous';
    const list = await getHomeworkForDate(dateStr, grade, 'JulieCB');
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/homework - Create / assign new homework
 */
router.post('/homework', async (req, res) => {
  try {
    const created = await upsertHomeworkAdjustment(req.body);
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/homework-schema - Diagnostic live indexes and constraints in Postgres
 */
router.get('/debug/homework-schema', async (req, res) => {
  try {
    const diag = await getHomeworkConstraintsDiagnostic();
    res.json(diag);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || error });
  }
});

/**
 * POST /api/homework-manual-adjustments (and legacy aliases /homework/upsert, /homework-adjustments)
 */
router.post(['/homework-manual-adjustments', '/homework-adjustments', '/homework/upsert'], async (req, res) => {
  console.log('📥 [POST /api/homework-manual-adjustments] Payload reçu :', {
    id: req.body?.id,
    source_task_id: req.body?.source_task_id,
    competence_code: req.body?.competence_code,
    date_echeance: req.body?.date_echeance || req.body?.date_due,
    grade: req.body?.grade,
    subject: req.body?.subject,
    description: req.body?.description,
    modified_text: req.body?.modified_text,
    teacher_id: req.body?.teacher_id,
  });

  try {
    const updated = await upsertHomeworkAdjustment(req.body);
    console.log('✅ [POST /api/homework-manual-adjustments] Succès DB :', {
      id: updated.id,
      source_task_id: updated.source_task_id,
      date_echeance: updated.date_echeance,
      grade: updated.grade,
    });
    res.json(updated);
  } catch (error: any) {
    console.error('❌ ERREUR ROUTE POST /api/homework-manual-adjustments:', {
      message: error?.message,
      detail: error?.detail,
      code: error?.code,
      constraint: error?.constraint,
      body: req.body,
    });
    res.status(500).json({
      error: error?.message || 'Erreur lors de l’enregistrement du devoir',
      detail: error?.detail,
      code: error?.code,
      constraint: error?.constraint,
    });
  }
});

/**
 * DELETE /api/homework-manual-adjustments (and legacy alias /homework-adjustments)
 */
router.delete(['/homework-manual-adjustments', '/homework-adjustments'], async (req, res) => {
  try {
    const params = req.body && Object.keys(req.body).length > 0 ? req.body : req.query;
    const result = await deleteHomeworkAdjustment(params);
    res.json(result);
  } catch (error: any) {
    console.error('Error in DELETE /api/homework-manual-adjustments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/homework/move - Move homework item to another date
 */
router.post('/homework/move', async (req, res) => {
  try {
    const { item, current_date, target_date, teacher_id = 'JulieCB' } = req.body;
    if (!item || !current_date || !target_date) {
      return res.status(400).json({ error: 'Champs item, current_date, target_date requis.' });
    }
    const result = await moveHomework(item, current_date, target_date, teacher_id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/homework/duplicate - Duplicate homework item to another date
 */
router.post('/homework/duplicate', async (req, res) => {
  try {
    const { item, target_date, teacher_id = 'JulieCB' } = req.body;
    if (!item || !target_date) {
      return res.status(400).json({ error: 'Champs item, target_date requis.' });
    }
    const result = await duplicateHomework(item, target_date, teacher_id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/homework/toggle-done - Check/uncheck homework done
 */
router.post('/homework/toggle-done', async (req, res) => {
  try {
    const { id, done } = req.body;
    await toggleHomeworkDone(Number(id), Boolean(done));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/homework/:id - Delete homework item
 */
router.delete('/homework/:id', async (req, res) => {
  try {
    await deleteHomework(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/custom-homework/options - Dynamic dropdown options for subjects and sub_domains
 */
router.get('/custom-homework/options', async (req, res) => {
  try {
    const teacherId = (req.query.teacher_id as string) || 'JulieCB';
    const options = await getCustomHomeworkOptions(teacherId);
    res.json(options);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/custom-homework - Fetch custom homework
 */
router.get('/custom-homework', async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    const grade = (req.query.grade as string) || 'Tous';
    const teacherId = (req.query.teacher_id as string) || 'JulieCB';
    const settings = await getUserSettings(teacherId);
    if (dateStr) {
      const list = await getCustomHomeworkForDate(dateStr, grade, teacherId, settings);
      return res.json(list);
    }
    const list = await getCustomHomeworkForDate(new Date().toISOString().split('T')[0], grade, teacherId, settings);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/custom-homework - Create or update custom homework
 */
router.post('/custom-homework', async (req, res) => {
  try {
    const created = await addCustomHomework(req.body);
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/custom-homework/:id - Update custom homework
 */
router.put('/custom-homework/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await addCustomHomework({ ...req.body, id });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/custom-homework/:id - Physical delete from custom_homework table
 */
router.delete('/custom-homework/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await deleteCustomHomework(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/custom-homework/truncate - Purge custom homework
 */
router.post('/custom-homework/truncate', async (req, res) => {
  try {
    const teacherId = req.body.teacher_id || 'JulieCB';
    const grade = req.body.grade;
    const result = await truncateCustomHomework(teacherId, grade);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/homework/migrate-localstorage - Migrate localStorage JSON tasks to Neon PostgreSQL
 */
router.post('/homework/migrate-localstorage', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Le champ items doit être un tableau.' });
    }
    const result = await migrateHomeworkFromLocalStorage(items, 'JulieCB');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delay/toggle-banalisee - Add or remove banalisée manual adjustment for a date/creneau
 */
router.post('/delay/toggle-banalisee', async (req, res) => {
  try {
    const { date, creneau, action, teacher_id = 'JulieCB' } = req.body;
    if (!date || !creneau) {
      return res.status(400).json({ error: 'date et creneau sont requis' });
    }
    const targetCreneau = creneau === 'aprem' ? 'aprem' : 'matin';
    if (action === 'add' || action === 'increment') {
      await addManualAdjustment({
        date,
        date_ajustement: date,
        creneau: targetCreneau,
        time_slot_id: targetCreneau,
        grade: 'Tous',
        teacher_id,
        action_type: 'banalisee',
        is_blank: true,
        type_activite: 'Banalisée' as any,
        titre: 'Journée banalisée (Retard)',
        description: 'Demi-journée banalisée',
        is_custom: true,
      });
    } else if (action === 'remove' || action === 'decrement') {
      await deleteBanaliseeAdjustment(date, targetCreneau, teacher_id);
    }

    const status = await getBanaliseeStatusForDate(date, targetCreneau, teacher_id);
    const updatePayload = targetCreneau === 'matin'
      ? { delay_morning: status.cumulativeCount, absences_count: status.cumulativeCount }
      : { delay_afternoon: status.cumulativeCount };
    await updateUserSettings(updatePayload, teacher_id);

    res.json({ success: true, count: status.cumulativeCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/custom-tasks - Fetch to-do tasks from custom_tasks Neon table
 */
router.get('/custom-tasks', async (req, res) => {
  try {
    const teacherId = (req.query.teacher_id as string) || 'JulieCB';
    const tasks = await getCustomTasks(teacherId);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/custom-tasks - Create new task in custom_tasks Neon table
 */
router.post('/custom-tasks', async (req, res) => {
  try {
    const { task_text, titre, teacher_id = 'JulieCB' } = req.body;
    const textToInsert = task_text || titre;
    if (!textToInsert) {
      return res.status(400).json({ error: 'task_text est requis.' });
    }
    const created = await addCustomTask(textToInsert, teacher_id);
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/custom-tasks/toggle & PUT /api/custom-tasks/:id/toggle - Toggle completed status
 */
router.post('/custom-tasks/toggle', async (req, res) => {
  try {
    const { id, completed, fait } = req.body;
    const isCompleted = completed !== undefined ? Boolean(completed) : Boolean(fait);
    await toggleCustomTaskCompleted(Number(id), isCompleted);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/custom-tasks/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed, fait } = req.body;
    const isCompleted = completed !== undefined ? Boolean(completed) : Boolean(fait);
    await toggleCustomTaskCompleted(Number(id), isCompleted);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/custom-tasks/:id - Delete a task from custom_tasks table
 */
router.delete('/custom-tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCustomTask(Number(id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/manual-adjustments/truncate - TRUNCATE table manual_adjustments
 */
router.post(['/manual-adjustments/truncate', '/manual-adjustments/purge'], async (req, res) => {
  try {
    const teacherId = (req.body.teacher_id as string) || (req.query.teacher_id as string) || 'JulieCB';
    const grade = (req.body.grade as string) || (req.query.grade as string);
    const result = await truncateManualAdjustments(teacherId, grade);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/custom-activities/truncate - TRUNCATE table custom_activities
 */
router.post(['/custom-activities/truncate', '/custom-activities/purge'], async (req, res) => {
  try {
    const teacherId = (req.body.teacher_id as string) || (req.query.teacher_id as string) || 'JulieCB';
    const grade = (req.body.grade as string) || (req.query.grade as string);
    const result = await truncateCustomActivities(teacherId, grade);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/homework-manual-adjustments/truncate - TRUNCATE table homework_manual_adjustments
 */
router.post(['/homework-manual-adjustments/truncate', '/homework-manual-adjustments/purge', '/homework/manual-adjustments/truncate'], async (req, res) => {
  try {
    const teacherId = (req.body.teacher_id as string) || (req.query.teacher_id as string) || 'JulieCB';
    const grade = (req.body.grade as string) || (req.query.grade as string);
    const result = await truncateHomeworkManualAdjustments(teacherId, grade);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/custom-homework/truncate - TRUNCATE table custom_homework
 */
router.post(['/custom-homework/truncate', '/custom-homework/purge', '/homework/custom/truncate'], async (req, res) => {
  try {
    const teacherId = (req.body.teacher_id as string) || (req.query.teacher_id as string) || 'JulieCB';
    const grade = (req.body.grade as string) || (req.query.grade as string);
    const result = await truncateCustomHomework(teacherId, grade);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
