/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityCardItem } from '../types.js';

/**
 * Constructs a fresh, independent payload from a source activity card,
 * cloning all user-visible fields and metadata (titre, description, pastel_color,
 * color_label, position_anchor, numero_exercice, url, etc.), setting the target date,
 * resetting status ('fait': false), resetting recurrence ('aucune'),
 * and assigning an autonomous date (original_date & date_ajustement set to targetDate).
 */
export function buildClonedActivityPayload(
  source: ActivityCardItem,
  targetDate: string
) {
  const isCustom = source.is_custom !== false && !source.progression_id;
  const titreText = source.titre || source.titre_chapitre || 'Activité';
  const titreChapitreText = source.titre_chapitre || source.titre || 'Activité';

  return {
    titre: titreText,
    titre_chapitre: titreChapitreText,
    description: source.description || '',
    type_activite: source.type_activite || 'Autre',
    matiere: source.matiere || '',
    domaine: source.domaine || '',
    pastel_color: source.pastel_color || '',
    color_label: source.color_label || '',
    position_anchor: source.position_anchor || '',
    creneau: source.creneau || 'matin',
    time_slot_id: source.creneau || 'matin',
    grade: source.grade || 'Tous',
    url: source.url || '',
    numero_exercice: source.numero_exercice || '',
    date: targetDate,
    original_date: targetDate,
    date_ajustement: targetDate,
    recurrence: 'aucune',
    fait: false,
    reporter_au_lendemain: source.reporter_au_lendemain ?? true,
    teacher_id: 'JulieCB',
    is_custom: isCustom,
    ...(source.progression_id ? { progression_id: source.progression_id } : {}),
    ...(source.competence_code ? { competence_code: source.competence_code } : {}),
  };
}

export interface DisplayItem {
  id: string;
  type: 'eval_group' | 'entrainement_group' | 'card';
  defaultSortOrder: number;
  card?: ActivityCardItem;
  cards?: ActivityCardItem[];
}

/**
 * Calculates priority for a display item (block or single card)
 * respecting position_anchor, type_activite, and custom flags.
 * Exact mirror of CahierJournalSection logic.
 */
export function getItemPriority(item: { type: string; card?: ActivityCardItem }): number {
  if (item.type === 'eval_group') return 10;
  if (item.type === 'entrainement_group') return 50;
  if (item.card) {
    const anchor = (item.card.position_anchor || '').trim().toLowerCase();
    if (anchor) {
      switch (anchor) {
        case 'top':
          return -10;
        case 'after_evaluation':
          return 15;
        case 'after_modelage':
          return 25;
        case 'after_lecon':
          return 35;
        case 'after_tache_complexe':
          return 45;
        case 'after_entrainement':
          return 55;
        case 'bottom':
          return 99;
        default:
          break;
      }
    }

    const ord = item.card.order_index ?? item.card.ordre;
    if (item.card.is_custom && ord !== undefined && ord !== null && ord <= 1) {
      return -10;
    }

    const t = item.card.type_activite;
    if (t === 'Évaluation') return 10;
    if (t === 'Modelage') return 20;
    if (t === 'Leçon') return 30;
    if (t === 'Tâche complexe') return 40;
    if (t === 'Entraînement') return 50;
    return 60;
  }
  return 60;
}

/**
 * Compares two display items by priority and then default sort order.
 */
export function sortDisplayItems(a: DisplayItem, b: DisplayItem): number {
  const prioA = getItemPriority(a);
  const prioB = getItemPriority(b);
  if (prioA !== prioB) {
    return prioA - prioB;
  }
  const ordA = a.defaultSortOrder;
  const ordB = b.defaultSortOrder;
  if (ordA !== undefined && ordB !== undefined && ordA !== ordB) {
    return ordA - ordB;
  }
  return 0;
}

/**
 * Constructs and sorts the top-level display items for a given set of cards,
 * grouping Évaluations into an eval_group block, Entraînements into an entrainement_group block,
 * and applying position_anchor and custom column ordering if present.
 */
export function getTopLevelDisplayItems(
  cards: ActivityCardItem[],
  customOrder?: string[]
): DisplayItem[] {
  if (!cards || cards.length === 0) return [];

  const evalCards = cards
    .filter((c) => c.type_activite === 'Évaluation')
    .sort((a, b) => (a.ev_number || 1) - (b.ev_number || 1));

  const entrainementCards = cards
    .filter((c) => c.type_activite === 'Entraînement')
    .sort((a, b) => (a.entrainement_num || 1) - (b.entrainement_num || 1));

  const otherCards = cards.filter(
    (c) => c.type_activite !== 'Évaluation' && c.type_activite !== 'Entraînement'
  );

  const topLevelItems: DisplayItem[] = [];

  if (evalCards.length > 0) {
    const minOrd = Math.min(...evalCards.map((c) => c.order_index ?? c.ordre ?? 100));
    topLevelItems.push({
      id: 'block-evals',
      type: 'eval_group',
      defaultSortOrder: minOrd,
      cards: evalCards,
    });
  }

  if (entrainementCards.length > 0) {
    const minOrd = Math.min(...entrainementCards.map((c) => c.order_index ?? c.ordre ?? 100));
    topLevelItems.push({
      id: 'block-entrainements',
      type: 'entrainement_group',
      defaultSortOrder: minOrd,
      cards: entrainementCards,
    });
  }

  for (const card of otherCards) {
    topLevelItems.push({
      id: card.id,
      type: 'card',
      defaultSortOrder: card.order_index ?? card.ordre ?? 100,
      card,
    });
  }

  if (customOrder && customOrder.length > 0) {
    topLevelItems.sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return sortDisplayItems(a, b);
    });
  } else {
    topLevelItems.sort(sortDisplayItems);
  }

  return topLevelItems;
}
