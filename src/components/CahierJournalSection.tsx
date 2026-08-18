/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sun,
  Moon,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Minus,
  AlertCircle,
  Copy,
  Check,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Tag,
  Repeat,
  Save,
  CheckCircle2,
  Target,
  Calendar,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Sparkles,
  CopyPlus,
  X,
} from 'lucide-react';
import { ActivityCardItem, DailyCahierJournal, GradeLevel, isActivityEnRetard } from '../types.js';
import { formatDateFrench, shiftDateString } from '../utils/dateUtils.js';
import { api } from '../services/api.js';
import { DifferentiationCard } from './DifferentiationCard.js';
import { DifferentiationOverviewModal } from './DifferentiationOverviewModal.js';
import {
  SPIRAL_COLOR_LABELS,
  CUSTOM_COLOR_LABELS,
  ALL_COLOR_LABELS,
  getColorLabelStyle,
  getColorLabelObject,
} from '../lib/colorLabels.js';
import { renderTextWithLinks } from '../utils/linkUtils.js';
import { getTopLevelDisplayItems, buildClonedActivityPayload } from '../utils/cahierJournalUtils.js';

interface CahierJournalSectionProps {
  journal: DailyCahierJournal | null;
  isLoading: boolean;
  onToggleDone: (idStr: string, dbId: number | undefined, currentFait: boolean) => void;
  onDeleteManualActivity: (id: number) => void;
  onOpenNewActivity: (creneau: 'matin' | 'aprem', grade?: GradeLevel) => void;
  isPlanDeTravail?: boolean;
  onEditCard?: (card: ActivityCardItem) => void;
  gradeFilter?: GradeLevel;
  delayMorning?: number;
  delayAfternoon?: number;
  onIncrementDelayMorning?: () => void;
  onDecrementDelayMorning?: () => void;
  onIncrementDelayAfternoon?: () => void;
  onDecrementDelayAfternoon?: () => void;
  showReportNotDone?: boolean;
  onRefreshJournal?: () => void;
  isUnlocked?: boolean;
  currentDate?: string;
  onDateChange?: (date: string) => void;
}

export const CahierJournalSection: React.FC<CahierJournalSectionProps> = ({
  journal,
  isLoading,
  onToggleDone,
  onDeleteManualActivity,
  onOpenNewActivity,
  isPlanDeTravail = false,
  onEditCard,
  gradeFilter = 'Tous',
  delayMorning,
  delayAfternoon,
  onIncrementDelayMorning,
  onDecrementDelayMorning,
  onIncrementDelayAfternoon,
  onDecrementDelayAfternoon,
  showReportNotDone = false,
  onRefreshJournal,
  isUnlocked = false,
  currentDate,
  onDateChange,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedGrandId, setCopiedGrandId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingCardId, setIsDeletingCardId] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Duplication activity state
  const [duplicatingCard, setDuplicatingCard] = useState<ActivityCardItem | null>(null);
  const [duplicateTargetDate, setDuplicateTargetDate] = useState<string>('');
  const [isSubmittingDuplicate, setIsSubmittingDuplicate] = useState(false);

  const handleConfirmDuplication = async (card: ActivityCardItem, targetDate: string) => {
    if (!targetDate) return;
    setIsSubmittingDuplicate(true);
    try {
      const isSpiral = Boolean(card.progression_id || (card.source === 'progression' && !card.is_custom));
      const payload = buildClonedActivityPayload(card, targetDate);

      if (isSpiral) {
        await api.addManualAdjustment(payload);
      } else {
        await api.addCustomActivity(payload);
      }
      setDuplicatingCard(null);
      if (onRefreshJournal) await onRefreshJournal();
      try {
        window.dispatchEvent(new Event('journal-updated'));
        localStorage.setItem('journal_last_update', Date.now().toString());
      } catch (e) {}
    } catch (err: any) {
      console.error('Erreur lors de la duplication:', err);
      alert(`Erreur de duplication : ${err.message || String(err)}`);
    } finally {
      setIsSubmittingDuplicate(false);
    }
  };

  // Local inline editing states for cards
  const [inlineStates, setInlineStates] = useState<
    Record<
      string,
      {
        description?: string;
        url?: string;
        numero_exercice?: string;
        color_label?: string;
        titre?: string;
      }
    >
  >({});

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showHiddenCols, setShowHiddenCols] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const d = journal?.date || currentDate;
    if (d) {
      try {
        const storedHidden = localStorage.getItem(`hidden_cards_${d}`);
        if (storedHidden) {
          setHiddenCardIds(new Set(JSON.parse(storedHidden)));
        } else {
          setHiddenCardIds(new Set());
        }
        const storedOrders = localStorage.getItem(`column_orders_${d}`);
        if (storedOrders) {
          setColumnOrders(JSON.parse(storedOrders));
        } else {
          setColumnOrders({});
        }
      } catch (e) {
        setHiddenCardIds(new Set());
        setColumnOrders({});
      }
    } else {
      setColumnOrders({});
    }
  }, [journal?.date, currentDate]);

  const getCardValue = (
    card: ActivityCardItem,
    field: string
  ): string => {
    if (inlineStates[card.id] && inlineStates[card.id][field] !== undefined) {
      return inlineStates[card.id][field]!;
    }
    if (field === 'titre') {
      return card.titre || card.titre_chapitre || '';
    }
    return (card[field as keyof ActivityCardItem] as string) || '';
  };

  const handleInlineChange = (card: ActivityCardItem, field: string, val: string) => {
    setInlineStates((prev) => ({
      ...prev,
      [card.id]: {
        ...prev[card.id],
        [field]: val,
      },
    }));
  };

  // État visuel d'auto-save par carte ('saving' | 'saved')
  const [savingStates, setSavingStates] = useState<Record<string, 'saving' | 'saved'>>({});

  const setCardSavingState = (cardId: string, state: 'saving' | 'saved' | null) => {
    setSavingStates((prev) => {
      const copy = { ...prev };
      if (state === null) {
        delete copy[cardId];
      } else {
        copy[cardId] = state;
      }
      return copy;
    });
  };

  // Enregistrer une surcharge spiralaire individuelle (Auto-save)
  const saveSingleSpiralAdjustment = async (card: ActivityCardItem, overrides?: Record<string, any>) => {
    try {
      const isEvalOrEnt = card.type_activite === 'Évaluation' || card.type_activite === 'Entraînement';
      const description = overrides?.description !== undefined ? overrides.description : getCardValue(card, 'description');
      const url = overrides?.url !== undefined ? overrides.url : getCardValue(card, 'url');
      const inlineExo = overrides?.numero_exercice !== undefined ? overrides.numero_exercice : getCardValue(card, 'numero_exercice');
      const defaultExo = card.entrainement_num ? String(card.entrainement_num) : (card.ev_number ? String(card.ev_number) : (card.numero_exercice || ''));
      const numExo = isEvalOrEnt ? (inlineExo || defaultExo) : (inlineExo || card.numero_exercice);
      const colorLabel = overrides?.color_label !== undefined ? overrides.color_label : (isEvalOrEnt ? getCardValue(card, 'color_label') : undefined);

      // Mise à jour synchrone de l'objet carte en mémoire pour réactivité immédiate
      if (description !== undefined) card.description = description;
      if (url !== undefined) card.url = url;
      if (numExo !== undefined) card.numero_exercice = numExo;
      if (colorLabel !== undefined) card.color_label = colorLabel;

      setCardSavingState(card.id, 'saving');

      await api.addManualAdjustment({
        id: card.db_id,
        progression_id: card.progression_id,
        date: journal?.date || new Date().toISOString().split('T')[0],
        date_ajustement: journal?.date || new Date().toISOString().split('T')[0],
        creneau: card.creneau || 'matin',
        time_slot_id: card.creneau || 'matin',
        grade: card.grade,
        teacher_id: 'JulieCB',
        titre: card.titre_chapitre || card.titre || 'Activité spiralaire',
        type_activite: card.type_activite || 'Autre',
        description: description ? description.trim() : undefined,
        url: url ? url.trim() : undefined,
        numero_exercice: numExo ? numExo.trim() : undefined,
        color_label: colorLabel ? colorLabel.trim() : undefined,
        reporter_au_lendemain: card.reporter_au_lendemain ?? true,
        order_index: card.order_index ?? card.ordre,
        ordre: card.order_index ?? card.ordre,
        is_custom: false,
      });

      setCardSavingState(card.id, 'saved');
      setTimeout(() => setCardSavingState(card.id, null), 2000);
    } catch (err: any) {
      console.error('Erreur lors de l’enregistrement de la surcharge spiralaire:', err);
      setCardSavingState(card.id, null);
    }
  };

  // Report d'une activité individuelle au prochain jour utile
  const handleReportSingleCard = async (card: ActivityCardItem) => {
    try {
      const isSpiral = Boolean(card.progression_id || card.source === 'progression' || !card.is_custom);

      const res = await api.reportActivity({
        id: card.db_id,
        db_id: card.db_id,
        source: isSpiral ? 'manual' : 'custom',
        is_custom: !isSpiral,
        currentDate: journal?.date || new Date().toISOString().split('T')[0],
        card,
      });
      setSaveSuccessMsg(`Activité reportée au ${res.nextWorkingDate} !`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      if (onRefreshJournal) await onRefreshJournal();
    } catch (err: any) {
      console.error('Erreur lors du report de l’activité:', err);
      alert(`Erreur de report : ${err.message || String(err)}`);
    }
  };

  // Enregistrer une activité personnalisée pure (UPDATE en BDD Auto-save)
  const saveSingleCustomActivity = async (card: ActivityCardItem, overrides?: Record<string, any>) => {
    try {
      const titre = overrides?.titre !== undefined ? overrides.titre : (getCardValue(card, 'titre') || card.titre || card.titre_chapitre || 'Activité');
      const description = overrides?.description !== undefined ? overrides.description : getCardValue(card, 'description');
      const url = overrides?.url !== undefined ? overrides.url : getCardValue(card, 'url');
      const numExo = overrides?.numero_exercice !== undefined ? overrides.numero_exercice : getCardValue(card, 'numero_exercice');
      const colorLabel = overrides?.color_label !== undefined ? overrides.color_label : getCardValue(card, 'color_label');
      const pastelColor = overrides?.pastel_color !== undefined ? overrides.pastel_color : card.pastel_color;

      const startDateVal = overrides?.date !== undefined ? overrides.date : (getCardValue(card, 'date') || card.date || card.original_date || journal?.date);
      const dateFinVal = overrides?.date_fin !== undefined ? overrides.date_fin : getCardValue(card, 'date_fin');
      const recurrenceVal = overrides?.recurrence !== undefined ? overrides.recurrence : (getCardValue(card, 'recurrence') || card.recurrence || 'aucune');

      // Mise à jour synchrone de l'objet carte en mémoire pour réactivité immédiate
      if (titre !== undefined) {
        card.titre = titre;
        card.titre_chapitre = titre;
      }
      if (description !== undefined) card.description = description;
      if (url !== undefined) card.url = url;
      if (numExo !== undefined) card.numero_exercice = numExo;
      if (colorLabel !== undefined) card.color_label = colorLabel;
      if (pastelColor !== undefined) card.pastel_color = pastelColor;
      if (startDateVal !== undefined) card.date = startDateVal;
      if (dateFinVal !== undefined) card.date_fin = dateFinVal;
      if (recurrenceVal !== undefined) card.recurrence = recurrenceVal;

      setCardSavingState(card.id, 'saving');

      await api.addCustomActivity({
        id: card.db_id,
        date: startDateVal,
        date_fin: dateFinVal && dateFinVal.trim() !== '' ? dateFinVal.trim() : null,
        original_date: card.original_date || startDateVal,
        date_ajustement: card.date_ajustement || startDateVal,
        creneau: card.creneau || 'matin',
        time_slot_id: card.creneau || 'matin',
        grade: card.grade || 'Tous',
        teacher_id: 'JulieCB',
        type_activite: card.type_activite || 'Autre',
        titre: titre ? titre.trim() : '',
        titre_chapitre: titre ? titre.trim() : '',
        description: description ? description.trim() : undefined,
        url: url ? url.trim() : undefined,
        numero_exercice: numExo ? numExo.trim() : undefined,
        pastel_color: pastelColor || undefined,
        color_label: colorLabel ? colorLabel.trim() : undefined,
        recurrence: recurrenceVal,
        matiere: card.matiere || undefined,
        domaine: card.domaine || undefined,
        order_index: card.order_index ?? card.ordre,
        ordre: card.order_index ?? card.ordre,
        is_custom: true,
      });

      setCardSavingState(card.id, 'saved');
      setTimeout(() => setCardSavingState(card.id, null), 2000);

      if (overrides?.date && overrides.date !== journal?.date && onRefreshJournal) {
        await onRefreshJournal();
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour de l’activité manuelle:', err);
      setCardSavingState(card.id, null);
    }
  };

  // Bouton Copier / Coller (Dupliquer) pour cartouches d'activités
  const duplicateCustomActivity = async (card: ActivityCardItem) => {
    try {
      const targetDate = journal?.date || currentDate || new Date().toISOString().split('T')[0];
      const isSpiral = Boolean(card.progression_id || (card.source === 'progression' && !card.is_custom));
      const payload = buildClonedActivityPayload(card, targetDate);

      payload.titre = `${payload.titre} (Copie)`;
      payload.titre_chapitre = `${payload.titre_chapitre} (Copie)`;

      // Copier dans le presse-papier
      const lines = [
        `[${card.type_activite || 'Activité'}] ${payload.titre}`,
        card.description ? `Description : ${card.description}` : '',
        card.numero_exercice ? `N° Exercice : ${card.numero_exercice}` : '',
        card.url ? `Lien : ${card.url}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await navigator.clipboard.writeText(lines);
      } catch (e) {}

      if (isSpiral) {
        await api.addManualAdjustment(payload);
      } else {
        await api.addCustomActivity(payload);
      }

      setCopiedId(card.id);
      setSaveSuccessMsg('Activité copiée dans le presse-papier et dupliquée dans le journal !');
      setTimeout(() => {
        setCopiedId(null);
        setSaveSuccessMsg(null);
      }, 3000);

      if (onRefreshJournal) await onRefreshJournal();
    } catch (err: any) {
      console.error('Erreur lors de la duplication:', err);
      alert(`Erreur lors de la duplication : ${err.message || String(err)}`);
    }
  };

  // Helper badge info & styling
  const getCardBadgeInfo = (card: ActivityCardItem) => {
    if (card.is_custom) {
      return {
        label: card.type_activite || 'Activité',
        badgeBg: 'bg-slate-200 text-slate-800 border-slate-300 font-bold',
        cardBg: 'bg-slate-50 border-slate-200 text-slate-900',
      };
    }
    switch (card.type_activite) {
      case 'Leçon':
        return {
          label: 'Leçon',
          badgeBg: 'bg-blue-100 text-blue-900 border-blue-200 font-bold',
          cardBg: 'bg-blue-50/90 border-blue-200 text-slate-900',
        };
      case 'Modelage':
        return {
          label: 'Modelage',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
          cardBg: 'bg-amber-50/90 border-amber-200 text-slate-900',
        };
      case 'Tâche complexe':
        return {
          label: 'TC',
          badgeBg: 'bg-rose-100 text-rose-900 border-rose-200 font-bold',
          cardBg: 'bg-rose-50/90 border-rose-200 text-slate-900',
        };
      case 'Entraînement': {
        const entNum = card.entrainement_num || 1;
        const group =
          card.entrainement_group ||
          (card.entrainement_num
            ? card.entrainement_num <= 4
              ? 'Codage (x4)'
              : card.entrainement_num <= 8
              ? 'Mémorisation / Automatisation (x2)'
              : 'Remémoration (x1)'
            : 'Codage (x4)');

        let categoryLabel = 'CODAGE (X4)';
        if (group.includes('Mémorisation') || group.includes('Automatisation')) {
          categoryLabel = 'AUTOMATISATION (X2)';
        } else if (group.includes('Remémoration')) {
          categoryLabel = 'REMÉMORATION (X1)';
        }

        const entLabel = `ENT ${entNum}`;

        return {
          label: `${entLabel} • ${categoryLabel}`,
          entLabel,
          categoryLabel,
          badgeBg: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
          cardBg: 'bg-purple-50/90 border-purple-200 text-slate-900',
        };
      }
      case 'Évaluation': {
        const evNum = card.ev_number || 1;
        return {
          label: `EV${evNum}`,
          badgeBg: 'bg-orange-100 text-orange-950 border-orange-200 font-extrabold',
          cardBg: 'bg-orange-50/90 border-orange-200 text-slate-900',
        };
      }
      case 'Révision':
        return {
          label: 'Révision',
          badgeBg: 'bg-slate-700 text-white border-slate-600 font-bold',
          cardBg: 'bg-slate-100 border-slate-300 text-slate-900',
        };
      default:
        return {
          label: card.type_activite || 'Activité',
          badgeBg: 'bg-slate-200 text-slate-800 border-slate-300 font-bold',
          cardBg: 'bg-slate-50 border-slate-200 text-slate-900',
        };
    }
  };

  const handleCopyCardContent = async (card: ActivityCardItem) => {
    const badgeInfo = getCardBadgeInfo(card);
    const titleText = getCardValue(card, 'titre') || card.titre_chapitre || card.titre || 'Activité';
    const descriptionText = getCardValue(card, 'description') || card.description || '';
    const urlText = getCardValue(card, 'url') || card.url || '';
    const numExoText = getCardValue(card, 'numero_exercice') || card.numero_exercice || '';
    const colorLabelText = getCardValue(card, 'color_label') || card.color_label || '';

    const lines: string[] = [];

    let line1 = `[${badgeInfo.label}]`;
    if (card.competence_code) {
      line1 += ` ${card.competence_code}`;
    }
    if (card.grade && card.grade !== 'Tous') {
      line1 += ` (${card.grade})`;
    }
    line1 += ` : ${titleText}`;
    lines.push(line1);

    if (descriptionText && !descriptionText.startsWith('Séquence #')) {
      lines.push(`Consignes : ${descriptionText}`);
    }

    if (numExoText || colorLabelText) {
      let exoLine = 'N° Exercice : ';
      if (numExoText) exoLine += numExoText;
      if (colorLabelText) exoLine += numExoText ? ` (${colorLabelText})` : colorLabelText;
      lines.push(exoLine);
    }

    if (urlText) {
      lines.push(`URL : ${urlText}`);
    }

    const textToCopy = lines.join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      setCopiedId(card.id);
      setSaveSuccessMsg('Contenu du cartouche copié dans le presse-papier !');
      setTimeout(() => {
        setCopiedId(null);
        setSaveSuccessMsg(null);
      }, 2500);
    } catch (err) {
      console.error('Erreur lors de la copie du cartouche:', err);
    }
  };

  const handleCopyGrandCartouche = async (
    typeTitle: string,
    cards: ActivityCardItem[],
    colKey: string
  ) => {
    const header = `=== GRAND CARTOUCHE : ${typeTitle.toUpperCase()} ===\n`;

    const cardTexts = cards.map((card, idx) => {
      const badgeInfo = getCardBadgeInfo(card);
      const titleText = getCardValue(card, 'titre') || card.titre_chapitre || card.titre || 'Activité';
      const descriptionText = getCardValue(card, 'description') || card.description || '';
      const urlText = getCardValue(card, 'url') || card.url || '';
      const numExoText = getCardValue(card, 'numero_exercice') || card.numero_exercice || '';
      const colorLabelText = getCardValue(card, 'color_label') || card.color_label || '';

      const lines: string[] = [];
      let l1 = `${idx + 1}. [${badgeInfo.label}]`;
      if (card.competence_code) l1 += ` ${card.competence_code}`;
      if (card.grade && card.grade !== 'Tous') l1 += ` (${card.grade})`;
      l1 += ` : ${titleText}`;
      lines.push(l1);

      if (descriptionText && !descriptionText.startsWith('Séquence #')) {
        lines.push(`   Consignes : ${descriptionText}`);
      }
      if (numExoText || colorLabelText) {
        let exoLine = '   N° Exercice : ';
        if (numExoText) exoLine += numExoText;
        if (colorLabelText) exoLine += numExoText ? ` (${colorLabelText})` : colorLabelText;
        lines.push(exoLine);
      }
      if (urlText) {
        lines.push(`   URL : ${urlText}`);
      }

      return lines.join('\n');
    });

    const fullText = header + cardTexts.join('\n\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      const key = `${typeTitle}-${colKey}`;
      setCopiedGrandId(key);
      setSaveSuccessMsg(`Grand cartouche ${typeTitle} copié dans le presse-papier !`);
      setTimeout(() => {
        setCopiedGrandId(null);
        setSaveSuccessMsg(null);
      }, 2500);
    } catch (err) {
      console.error('Erreur lors de la copie du grand cartouche:', err);
    }
  };

  const handleToggleHideCard = async (card: ActivityCardItem) => {
    const isCurrentlyHidden = hiddenCardIds.has(card.id) || Boolean(card.fait);
    const d = journal?.date || currentDate;

    if (isCurrentlyHidden) {
      // Démasquer
      const next = new Set(hiddenCardIds);
      next.delete(card.id);
      setHiddenCardIds(next);
      if (d) {
        try {
          localStorage.setItem(`hidden_cards_${d}`, JSON.stringify(Array.from(next)));
        } catch (e) {}
      }
      card.fait = false;
      if (onToggleDone) {
        await onToggleDone(card.id, card.db_id, false, card);
      }
    } else {
      // Masquer
      const next = new Set(hiddenCardIds);
      next.add(card.id);
      setHiddenCardIds(next);
      if (d) {
        try {
          localStorage.setItem(`hidden_cards_${d}`, JSON.stringify(Array.from(next)));
        } catch (e) {}
      }
      card.fait = true;
      if (onToggleDone) {
        await onToggleDone(card.id, card.db_id, true, card);
      }
    }
    try {
      window.dispatchEvent(new Event('journal-updated'));
    } catch (e) {}
  };

  const handleDeleteCard = async (card: ActivityCardItem) => {
    setIsDeletingCardId(card.id);
    setDeleteErrorMsg(null);

    try {
      if (card.db_id) {
        await onDeleteManualActivity(card.db_id);
      }

      if (onRefreshJournal) {
        await onRefreshJournal();
      }
    } catch (err: any) {
      console.error('Erreur lors de la suppression en BDD:', err);
      setDeleteErrorMsg(`Erreur de suppression en base de données : ${err.message || String(err)}`);
    } finally {
      setIsDeletingCardId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleUnhideAll = async () => {
    setHiddenCardIds(new Set());
    const d = journal?.date || currentDate;
    if (d) {
      try {
        localStorage.removeItem(`hidden_cards_${d}`);
      } catch (e) {}
    }
    if (journal) {
      const allCards = [...(journal.matin || []), ...(journal.aprem || [])];
      for (const card of allCards) {
        if (card.fait) {
          card.fait = false;
          if (onToggleDone) {
            await onToggleDone(card.id, card.db_id, false, card);
          }
        }
      }
    }
    if (onRefreshJournal) await onRefreshJournal();
    try {
      window.dispatchEvent(new Event('journal-updated'));
    } catch (e) {}
  };

  interface ColumnDisplayItem {
    id: string;
    type: 'eval_group' | 'entrainement_group' | 'card';
    defaultSortOrder: number;
    card?: ActivityCardItem;
    cards?: ActivityCardItem[];
  }

  // Reordering helpers
  const saveReorder = async (
    colKey: string,
    newOrderIds: string[],
    columnCards: ActivityCardItem[],
    topLevelItems: ColumnDisplayItem[]
  ) => {
    const itemMap = new Map(topLevelItems.map((it) => [it.id, it]));
    const timeSlotFromCol = colKey.split('-')[0] || 'matin';

    let currentRank = 1;
    const itemsToSave: any[] = [];

    for (const itemId of newOrderIds) {
      const displayItem = itemMap.get(itemId);
      if (!displayItem) continue;

      if (displayItem.type === 'card' && displayItem.card) {
        const card = displayItem.card;
        card.order_index = currentRank;
        card.ordre = currentRank;
        itemsToSave.push({
          id: card.id,
          db_id: card.db_id,
          progression_id: card.progression_id,
          is_custom: Boolean(card.is_custom),
          source: card.source,
          date: journal?.date || new Date().toISOString().split('T')[0],
          time_slot_id: card.creneau || timeSlotFromCol,
          order_index: currentRank,
          grade: card.grade,
          titre: card.titre || card.titre_chapitre || 'Activité',
          type_activite: card.type_activite || 'Autre',
          description: card.description || undefined,
          numero_exercice: card.numero_exercice || undefined,
        });
        currentRank++;
      } else if (displayItem.type === 'eval_group' && displayItem.cards) {
        for (const card of displayItem.cards) {
          card.order_index = currentRank;
          card.ordre = currentRank;
          itemsToSave.push({
            id: card.id,
            db_id: card.db_id,
            progression_id: card.progression_id,
            is_custom: Boolean(card.is_custom),
            source: card.source,
            date: journal?.date || new Date().toISOString().split('T')[0],
            time_slot_id: card.creneau || timeSlotFromCol,
            order_index: currentRank,
            grade: card.grade,
            titre: card.titre || card.titre_chapitre || 'Activité',
            type_activite: card.type_activite || 'Autre',
            description: card.description || undefined,
            numero_exercice: card.numero_exercice || undefined,
          });
          currentRank++;
        }
      } else if (displayItem.type === 'entrainement_group' && displayItem.cards) {
        for (const card of displayItem.cards) {
          card.order_index = currentRank;
          card.ordre = currentRank;
          itemsToSave.push({
            id: card.id,
            db_id: card.db_id,
            progression_id: card.progression_id,
            is_custom: Boolean(card.is_custom),
            source: card.source,
            date: journal?.date || new Date().toISOString().split('T')[0],
            time_slot_id: card.creneau || timeSlotFromCol,
            order_index: currentRank,
            grade: card.grade,
            titre: card.titre || card.titre_chapitre || 'Activité',
            type_activite: card.type_activite || 'Autre',
            description: card.description || undefined,
            numero_exercice: card.numero_exercice || undefined,
          });
          currentRank++;
        }
      }
    }

    if (itemsToSave.length > 0) {
      try {
        await api.reorderActivities(itemsToSave as any);
        setColumnOrders({});
        if (onRefreshJournal) await onRefreshJournal();
        window.dispatchEvent(new Event('journal-updated'));
        try {
          localStorage.setItem('journal_last_update', Date.now().toString());
        } catch {}
      } catch (err) {
        console.error('Erreur lors du réordonnancement auto-save:', err);
      }
    }
  };

  const moveItem = (
    colKey: string,
    itemId: string,
    direction: 'up' | 'down',
    topLevelItems: ColumnDisplayItem[],
    visibleCards: ActivityCardItem[]
  ) => {
    const currentOrder = columnOrders[colKey] || topLevelItems.map((it) => it.id);
    const index = currentOrder.indexOf(itemId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    setColumnOrders((prev) => ({
      ...prev,
      [colKey]: newOrder,
    }));
    saveReorder(colKey, newOrder, visibleCards, topLevelItems);
  };

  const handleDragStart = (cardId: string) => {
    setDraggedCardId(cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropItem = (
    colKey: string,
    targetItemId: string,
    topLevelItems: ColumnDisplayItem[],
    visibleCards: ActivityCardItem[]
  ) => {
    if (!draggedCardId || draggedCardId === targetItemId) return;

    const currentOrder = columnOrders[colKey] || topLevelItems.map((it) => it.id);
    const fromIndex = currentOrder.indexOf(draggedCardId);
    const toIndex = currentOrder.indexOf(targetItemId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    setColumnOrders((prev) => ({
      ...prev,
      [colKey]: newOrder,
    }));
    saveReorder(colKey, newOrder, visibleCards, topLevelItems);
    setDraggedCardId(null);
  };

  const renderCard = (
    card: ActivityCardItem,
    colKey: string,
    index: number,
    totalCards: number,
    columnCards: ActivityCardItem[],
    topIndex?: number,
    totalTopItems?: number,
    topLevelItems?: ColumnDisplayItem[],
    isInBlock?: boolean
  ) => {
    const badgeInfo = getCardBadgeInfo(card);
    const isDone = card.fait;
    const isSpiral = Boolean(card.progression_id || card.source === 'progression' || !card.is_custom);
    const isEvalOrEnt = card.type_activite === 'Évaluation' || card.type_activite === 'Entraînement';

    const displayTitle = card.titre_chapitre || card.titre;
    const currentNumExo = getCardValue(card, 'numero_exercice');
    const currentColorLabel = getCardValue(card, 'color_label');
    const colorOpt = getColorLabelObject(currentColorLabel);
    
    const activeColorStyle = colorOpt
      ? {
          backgroundColor: colorOpt.hex,
          color: colorOpt.textHex,
          borderColor: colorOpt.borderHex,
        }
      : getColorLabelStyle(currentColorLabel);

    const customBgStyle = (card.is_custom && colorOpt)
      ? { backgroundColor: card.pastel_color || colorOpt.pastelHex || colorOpt.hex, borderColor: colorOpt.borderHex }
      : card.pastel_color
      ? { backgroundColor: card.pastel_color, borderColor: 'rgba(0,0,0,0.15)' }
      : undefined;

    const surtitreText = card.is_custom
      ? ((card.competence_code && card.competence_code !== 'PERSO' && card.competence_code !== 'AUTRE')
          ? `${card.competence_code}${card.grade && card.grade !== 'Tous' ? ` (${card.grade})` : ''}`
          : (card.grade && card.grade !== 'Tous' ? card.grade : ''))
      : `${card.competence_code || 'COMP'}${card.grade && card.grade !== 'Tous' ? ` (${card.grade})` : ''}`;

    const isDragging = draggedCardId === card.id;
    const cardUniqueKey = `${colKey}-${card.id}-${topIndex ?? index}-${index}`;

    if (!isUnlocked) {
      return (
        <div
          key={cardUniqueKey}
          style={customBgStyle}
          className={`${card.pastel_color ? 'border text-slate-900' : badgeInfo.cardBg} rounded-xl p-3 shadow-2xs border flex flex-col gap-2 transition-all relative`}
        >
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {badgeInfo.entLabel && badgeInfo.categoryLabel ? (
                <>
                  <span
                    className="text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 bg-purple-700 text-white border-purple-800 shadow-2xs"
                    title={`Ordre de l'entraînement : ${badgeInfo.entLabel}`}
                  >
                    {badgeInfo.entLabel}
                  </span>
                  <span
                    className="text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 bg-purple-100 text-purple-900 border-purple-200"
                    title={`Catégorie : ${badgeInfo.categoryLabel}`}
                  >
                    {badgeInfo.categoryLabel}
                  </span>
                </>
              ) : (
                <span
                  className={`text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 ${badgeInfo.badgeBg}`}
                >
                  {badgeInfo.label}
                </span>
              )}

              {isActivityEnRetard(card, journal?.date) && (
                <span
                  className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-tight shrink-0 bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1 shadow-2xs"
                  title={`Reporté du ${card.original_date || 'jour précédent'}`}
                >
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>En retard</span>
                </span>
              )}

              {surtitreText && (
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter truncate">
                  {surtitreText}
                </span>
              )}
            </div>

            {getCardValue(card, 'url') && (
              <a
                href={getCardValue(card, 'url')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-white/90 hover:bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs transition-all shrink-0 cursor-pointer"
              >
                <span>Ressource</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {(currentNumExo || (currentColorLabel && !ALL_COLOR_LABELS.some((c) => c.name.toLowerCase() === currentColorLabel.toLowerCase()))) && (
            <div
              style={
                activeColorStyle || {
                  backgroundColor: '#e0e7ff',
                  color: '#1e1b4b',
                  borderColor: '#c7d2fe',
                }
              }
              className="px-2.5 py-0.5 rounded text-[11px] font-extrabold flex items-center gap-1.5 w-fit border shadow-2xs my-0.5"
            >
              <Tag className="w-3 h-3 shrink-0" />
              <span>
                {currentNumExo
                  ? currentNumExo.trim().toLowerCase().startsWith('ex')
                    ? currentNumExo.trim()
                    : `Ex : ${currentNumExo.trim()}`
                  : currentColorLabel}
              </span>
            </div>
          )}

          <h4 className="font-bold text-sm text-slate-900 leading-snug whitespace-pre-wrap">
            {renderTextWithLinks(displayTitle)}
          </h4>

          {card.description && !card.description.startsWith('Séquence #') && (
            <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-wrap">
              {renderTextWithLinks(card.description)}
            </p>
          )}

          {/* Differentiation Callout for Évaluation & Entraînement */}
          <DifferentiationCard
            typeActivite={card.type_activite}
            differentiationEval={card.differentiation_eval}
            differentiationEnt={card.differentiation_ent}
          />

          {card.day_of_life !== undefined && card.day_of_life > 0 && (
            <div className="flex justify-end mt-0.5">
              <span className="text-[10px] font-medium text-slate-400">
                J de vie #{card.day_of_life}
              </span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={cardUniqueKey}
        draggable
        onDragStart={() => handleDragStart(card.id)}
        onDragOver={handleDragOver}
        onDrop={() => handleDropItem(colKey, card.id, topLevelItems || [], columnCards)}
        onDragEnd={() => setDraggedCardId(null)}
        style={customBgStyle}
        className={`${card.pastel_color ? 'border text-slate-900' : badgeInfo.cardBg} rounded-lg p-2.5 shadow-xs border flex flex-col gap-2 transition-all relative group cursor-grab active:cursor-grabbing ${
          isDone ? 'opacity-60 grayscale-[0.2]' : ''
        } ${isDragging ? 'opacity-40 border-indigo-500 ring-2 ring-indigo-300 scale-[0.98]' : ''}`}
      >
        {/* Top Header Row */}
        <div className="flex justify-between items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* Drag Handle */}
            <span
              className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5"
              title="Maintenir et glisser pour réordonner"
            >
              <GripVertical className="w-3.5 h-3.5 shrink-0" />
            </span>

            {/* Checkbox Fait */}
            {!isPlanDeTravail && (
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => onToggleDone(card.id, card.db_id, isDone, card)}
                title="Marquer comme fait"
                className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-indigo-600 shrink-0"
              />
            )}

            {/* Type Badge(s) */}
            {badgeInfo.entLabel && badgeInfo.categoryLabel ? (
              <>
                <span
                  className="text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 bg-purple-700 text-white border-purple-800 shadow-2xs"
                  title={`Ordre de l'entraînement : ${badgeInfo.entLabel}`}
                >
                  {badgeInfo.entLabel}
                </span>
                <span
                  className="text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 bg-purple-100 text-purple-900 border-purple-200"
                  title={`Catégorie : ${badgeInfo.categoryLabel}`}
                >
                  {badgeInfo.categoryLabel}
                </span>
              </>
            ) : (
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded-md border font-extrabold tracking-tight shrink-0 ${badgeInfo.badgeBg}`}
              >
                {badgeInfo.label}
              </span>
            )}

            {/* En retard Badge */}
            {isActivityEnRetard(card, journal?.date) && (
              <span
                className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-tight shrink-0 bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1 shadow-2xs"
                title={`Activité reportée (Date d'origine : ${card.original_date || card.date || 'initiale'})`}
              >
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>En retard</span>
              </span>
            )}

            {/* Récurrence Badge */}
            {card.recurrence && card.recurrence !== 'aucune' && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 bg-purple-50 text-purple-800 border-purple-200 flex items-center gap-1"
                title={`Récurrence: ${card.recurrence}`}
              >
                <Repeat className="w-3 h-3 text-purple-600" />
                <span className="capitalize">{card.recurrence}</span>
              </span>
            )}

            {/* Surtitre: Competence Code & Grade */}
            {surtitreText && (
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter truncate">
                {surtitreText}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Auto-Save Indicator Badge */}
            {savingStates[card.id] === 'saving' && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs animate-pulse shrink-0">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600 shrink-0" />
                <span className="hidden sm:inline">Enregistrement...</span>
              </span>
            )}
            {savingStates[card.id] === 'saved' && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs shrink-0">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Enregistré ✓</span>
              </span>
            )}

            {/* Reorder Up / Down */}
            {!isInBlock && topLevelItems && topIndex !== undefined && totalTopItems !== undefined && (
              <div className="flex items-center bg-white/80 rounded border border-slate-200">
                <button
                  type="button"
                  disabled={topIndex === 0}
                  onClick={() => moveItem(colKey, card.id, 'up', topLevelItems, columnCards)}
                  className="p-0.5 text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-500 cursor-pointer"
                  title="Monter l'activité"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={topIndex === totalTopItems - 1}
                  onClick={() => moveItem(colKey, card.id, 'down', topLevelItems, columnCards)}
                  className="p-0.5 text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-500 cursor-pointer"
                  title="Descendre l'activité"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* URL External Link */}
            {getCardValue(card, 'url') && (
              <a
                href={getCardValue(card, 'url')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-white rounded transition-colors"
                title="Ouvrir la ressource dans un nouvel onglet"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Quick Copy Button */}
            <button
              type="button"
              onClick={() => handleCopyCardContent(card)}
              className={`p-1 rounded transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                copiedId === card.id
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent'
              }`}
              title="Copier-coller le contenu du cartouche"
            >
              {copiedId === card.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-black text-emerald-700">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold hidden sm:inline">Copier</span>
                </>
              )}
            </button>

            {/* Edit in Modal for Custom Activity */}
            {onEditCard && card.is_custom && (
              <button
                type="button"
                onClick={() => onEditCard(card)}
                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer"
                title="Modifier dans la modale"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Duplicate Activity Button */}
            <button
              type="button"
              onClick={() => {
                if (duplicatingCard?.id === card.id) {
                  setDuplicatingCard(null);
                } else {
                  setDuplicatingCard(card);
                  setDuplicateTargetDate(shiftDateString(journal?.date || currentDate || new Date().toISOString().split('T')[0], 1));
                }
              }}
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer flex items-center gap-1"
              title="Dupliquer à une autre date"
            >
              <CopyPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[10px] font-bold text-indigo-700 hidden sm:inline">Dupliquer</span>
            </button>

            {/* Eye / Hide / Unhide Button */}
            <button
              type="button"
              onClick={() => handleToggleHideCard(card)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                hiddenCardIds.has(card.id) || card.fait
                  ? 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white'
              }`}
              title={
                hiddenCardIds.has(card.id) || card.fait
                  ? "Démasquer et réactiver l'activité"
                  : "Masquer visuellement du journal"
              }
            >
              {hiddenCardIds.has(card.id) || card.fait ? (
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Trash Button & Inline Confirmation */}
            {confirmDeleteId === card.id ? (
              <div className="flex items-center gap-1 bg-red-50 border border-red-300 px-1.5 py-0.5 rounded text-[11px] font-bold text-red-900 shadow-2xs">
                <span className="text-[10px] whitespace-nowrap">Supprimer ?</span>
                <button
                  type="button"
                  onClick={() => handleDeleteCard(card)}
                  disabled={isDeletingCardId === card.id}
                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-[10px] font-extrabold cursor-pointer transition-colors shadow-2xs"
                  title="Confirmer la suppression définitive"
                >
                  {isDeletingCardId === card.id ? '...' : 'Oui'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={isDeletingCardId === card.id}
                  className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-extrabold cursor-pointer transition-colors"
                  title="Annuler"
                >
                  Non
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(card.id)}
                className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-colors cursor-pointer"
                title="Supprimer définitivement l'activité de la base de données"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Duplication Popover */}
        {duplicatingCard?.id === card.id && (
          <div className="mb-2 p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl flex flex-col gap-2 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <CopyPlus className="w-4 h-4 text-indigo-600" />
                <span>Dupliquer cette activité</span>
              </span>
              <button
                type="button"
                onClick={() => setDuplicatingCard(null)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                title="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-indigo-800 font-medium">
              Choisissez la date de destination. L'activité sera dupliquée indépendamment avec son titre, contenu et ancrage positionnel.
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="date"
                value={duplicateTargetDate}
                onChange={(e) => setDuplicateTargetDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              <button
                type="button"
                disabled={isSubmittingDuplicate || !duplicateTargetDate}
                onClick={() => handleConfirmDuplication(card, duplicateTargetDate)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
              >
                {isSubmittingDuplicate ? 'Duplication...' : 'Dupliquer maintenant'}
              </button>
            </div>
          </div>
        )}

        {/* Position Anchor Badge if present */}
        {card.position_anchor && (
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-1 w-fit" title={`Position verrouillée : ${card.position_anchor}`}>
            📌 {card.position_anchor === 'top' ? 'Tout en haut' : card.position_anchor === 'bottom' ? 'Tout en bas' : card.position_anchor.replace('after_', 'Après ').replace('_', ' ')}
          </span>
        )}

        {/* Dynamic Badge for Exercice + Color Label Style */}
        {(currentNumExo || (currentColorLabel && !ALL_COLOR_LABELS.some((c) => c.name.toLowerCase() === currentColorLabel.toLowerCase()))) && (isSpiral ? isEvalOrEnt : true) && (
          <div
            style={
              activeColorStyle || {
                backgroundColor: '#e0e7ff',
                color: '#1e1b4b',
                borderColor: '#c7d2fe',
              }
            }
            className="px-2 py-0.5 rounded text-[11px] font-extrabold flex items-center gap-1.5 w-fit border shadow-2xs transition-all"
          >
            <Tag className="w-3 h-3 shrink-0" />
            <span>
              {currentNumExo
                ? currentNumExo.trim().toLowerCase().startsWith('ex')
                  ? currentNumExo.trim()
                  : `Ex : ${currentNumExo.trim()}`
                : currentColorLabel}
            </span>
          </div>
        )}

        {/* SPIRAL CARD INLINE EDITING */}
        {isSpiral ? (
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-200/80">
            {/* Title (Read-only display for Spiral Card) */}
            <h4 className={`font-bold leading-snug text-sm text-slate-900 whitespace-pre-wrap ${isDone ? 'line-through text-slate-500' : ''}`}>
              {displayTitle}
            </h4>

            {/* Description / Consignes inline */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-tight block">
                Consignes / Remarques inline :
              </label>
              <textarea
                rows={2}
                placeholder="Ajouter des consignes ou remarques..."
                value={getCardValue(card, 'description')}
                onChange={(e) => handleInlineChange(card, 'description', e.target.value)}
                onBlur={() => saveSingleSpiralAdjustment(card)}
                className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium resize-y"
              />
            </div>

            {/* URL input inline */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold text-slate-600 uppercase shrink-0">URL :</span>
              <input
                type="url"
                placeholder="https://lien-exercice.fr"
                value={getCardValue(card, 'url')}
                onChange={(e) => handleInlineChange(card, 'url', e.target.value)}
                onBlur={() => saveSingleSpiralAdjustment(card)}
                className="w-full p-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Conditionnel STRICT: Seulement pour Évaluation et Entraînement */}
            {isEvalOrEnt && (() => {
              const isEval = card.type_activite === 'Évaluation';
              const isEnt = card.type_activite === 'Entraînement';

              const containerBgClass = isEval
                ? 'bg-orange-100/90 border-orange-300 text-orange-950'
                : isEnt
                ? 'bg-purple-100/90 border-purple-300 text-purple-950'
                : 'bg-amber-100/90 border-amber-300 text-amber-950';

              const labelClass = isEval
                ? 'text-orange-950'
                : isEnt
                ? 'text-purple-950'
                : 'text-amber-950';

              const inputBgClass = isEval
                ? 'bg-orange-50 border-orange-300 text-slate-900 placeholder-slate-700 placeholder:text-slate-700 focus:ring-orange-500'
                : isEnt
                ? 'bg-purple-50 border-purple-300 text-slate-900 placeholder-slate-700 placeholder:text-slate-700 focus:ring-purple-500'
                : 'bg-amber-50 border-amber-300 text-slate-900 placeholder-slate-700 placeholder:text-slate-700 focus:ring-amber-500';

              return (
                <div className={`p-2 rounded-md space-y-2 mt-1 border ${containerBgClass}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold uppercase shrink-0 ${labelClass}`}>
                      N° d'exercice :
                    </span>
                    <input
                      type="text"
                      placeholder="ex: Ex 32 p.124"
                      value={getCardValue(card, 'numero_exercice')}
                      onChange={(e) => handleInlineChange(card, 'numero_exercice', e.target.value)}
                      onBlur={() => saveSingleSpiralAdjustment(card)}
                      className={`flex-1 p-1 rounded text-xs font-bold focus:outline-none focus:ring-1 border ${inputBgClass}`}
                    />
                  </div>

                  {/* Palette 10 couleurs spiralaires */}
                  <div>
                    <span className={`text-[10px] font-extrabold block mb-1 ${labelClass}`}>
                      Label coloré (Palette Spiralaires) :
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SPIRAL_COLOR_LABELS.map((opt) => {
                        const isSelected = currentColorLabel.toLowerCase().trim() === opt.name.toLowerCase().trim();
                        return (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : opt.name;
                              handleInlineChange(card, 'color_label', newVal);
                              saveSingleSpiralAdjustment(card, { color_label: newVal });
                            }}
                            style={{
                              backgroundColor: opt.hex,
                              borderColor: opt.borderHex,
                            }}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                              isSelected ? 'ring-2 ring-slate-900 ring-offset-1 scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                            }`}
                            title={opt.name}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Différenciation intelligentes */}
                  <DifferentiationCard
                    typeActivite={card.type_activite}
                    differentiationEval={card.differentiation_eval}
                    differentiationEnt={card.differentiation_ent}
                    compact
                  />
                </div>
              );
            })()}

            {/* Action Row for Spiral Card: Reporter (Auto-save actif) */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleReportSingleCard(card)}
                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded border border-amber-300 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Reporter cette activité au prochain jour utile"
              >
                <RotateCcw className="w-3 h-3 text-amber-600" />
                <span>Reporter</span>
              </button>
            </div>
          </div>
        ) : (
          /* PURE CUSTOM CARD INLINE EDITING */
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-200/80">
            {/* Titre éditable inline */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-tight block">
                Titre de l'activité :
              </label>
              <input
                type="text"
                placeholder="Nom de l'activité..."
                value={getCardValue(card, 'titre')}
                onChange={(e) => handleInlineChange(card, 'titre', e.target.value)}
                onBlur={() => saveSingleCustomActivity(card)}
                className="w-full p-1.5 bg-white border border-slate-300 rounded text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Description inline */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-tight block">
                Description / Consignes :
              </label>
              <textarea
                rows={2}
                placeholder="Description de l'activité pure..."
                value={getCardValue(card, 'description')}
                onChange={(e) => handleInlineChange(card, 'description', e.target.value)}
                onBlur={() => saveSingleCustomActivity(card)}
                className="w-full p-1.5 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
              />
            </div>

            {/* URL inline */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold text-slate-600 uppercase shrink-0">URL :</span>
              <input
                type="url"
                placeholder="https://..."
                value={getCardValue(card, 'url')}
                onChange={(e) => handleInlineChange(card, 'url', e.target.value)}
                onBlur={() => saveSingleCustomActivity(card)}
                className="w-full p-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Dates & Récurrence inline */}
            <div className="bg-slate-50 border border-slate-200 p-2 rounded-md space-y-2 mt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Dates & Récurrence :</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-600 block mb-0.5">
                    Date de début :
                  </label>
                  <input
                    type="date"
                    value={getCardValue(card, 'date') || card.date || card.original_date || journal?.date || ''}
                    onChange={(e) => {
                      handleInlineChange(card, 'date', e.target.value);
                      saveSingleCustomActivity(card, { date: e.target.value });
                    }}
                    className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-600 block mb-0.5">
                    Date de fin (optionnelle) :
                  </label>
                  <input
                    type="date"
                    value={getCardValue(card, 'date_fin') !== undefined ? getCardValue(card, 'date_fin') : (card.date_fin || '')}
                    onChange={(e) => {
                      handleInlineChange(card, 'date_fin', e.target.value);
                      saveSingleCustomActivity(card, { date_fin: e.target.value });
                    }}
                    className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Pas de fin"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-600 block mb-0.5 flex items-center gap-1">
                  <Repeat className="w-3 h-3 text-indigo-600" />
                  <span>Récurrence :</span>
                </label>
                <select
                  value={getCardValue(card, 'recurrence') !== undefined ? getCardValue(card, 'recurrence') : (card.recurrence || 'aucune')}
                  onChange={(e) => {
                    handleInlineChange(card, 'recurrence', e.target.value);
                    saveSingleCustomActivity(card, { recurrence: e.target.value });
                  }}
                  className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="aucune">Aucune récurrence</option>
                  <option value="tous_les_jours">Tous les jours (Lundi-Vendredi)</option>
                  <option value="toutes les semaines">Toutes les semaines</option>
                  <option value="toutes les deux semaines">Toutes les 2 semaines</option>
                  <option value="une fois par mois">Une fois par mois</option>
                </select>
              </div>
            </div>

            {/* Numéro d'exercice & Label Coloré (Toujours disponible pour créations pures) */}
            <div className="bg-indigo-100/90 border border-indigo-300 p-2 rounded-md space-y-2 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-indigo-950 uppercase shrink-0">
                  N° d'exercice :
                </span>
                <input
                  type="text"
                  placeholder="ex: Ex 12 p.45"
                  value={getCardValue(card, 'numero_exercice')}
                  onChange={(e) => handleInlineChange(card, 'numero_exercice', e.target.value)}
                  onBlur={() => saveSingleCustomActivity(card)}
                  className="flex-1 p-1 bg-indigo-50 border border-indigo-300 rounded text-xs font-bold text-slate-900 placeholder-slate-700 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Palette 8 couleurs créations pures */}
              <div>
                <span className="text-[9px] font-extrabold text-indigo-900 block mb-1">
                  Label coloré (Palette Activités Pures) :
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CUSTOM_COLOR_LABELS.map((opt) => {
                    const isSelected = currentColorLabel.toLowerCase().trim() === opt.name.toLowerCase().trim();
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => {
                          let newLabel = opt.name;
                          let newPastel = opt.pastelHex || '';
                          if (isSelected) {
                            newLabel = '';
                            newPastel = '';
                          }
                          handleInlineChange(card, 'color_label', newLabel);
                          handleInlineChange(card, 'pastel_color', newPastel);
                          saveSingleCustomActivity(card, { color_label: newLabel, pastel_color: newPastel });
                        }}
                        style={{
                          backgroundColor: opt.hex,
                          borderColor: opt.borderHex,
                        }}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-1 scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                        title={opt.name}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Row: Reporter (si pas de récurrence) (Auto-save actif) */}
            {(() => {
              const currentRec = getCardValue(card, 'recurrence') || card.recurrence || 'aucune';
              const hasActiveRecurrence = Boolean(currentRec && currentRec.trim().toLowerCase() !== 'aucune');
              if (hasActiveRecurrence) return null;
              return (
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleReportSingleCard(card)}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded border border-amber-300 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="Reporter cette activité au prochain jour utile"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-600" />
                    <span>Reporter</span>
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Bottom Footer Row */}
        <div className="flex items-center justify-between gap-2 mt-0.5 pt-1 border-t border-slate-100">
          {/* Badge Report non fait si option activée */}
          {showReportNotDone && !isDone && card.reporter_au_lendemain && (
            <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 font-bold">
              Report non fait
            </span>
          )}

          {/* Jour de vie (J de vie) en bas à droite */}
          {card.day_of_life !== undefined && card.day_of_life > 0 && (
            <span className="text-[10px] font-medium text-slate-400 ml-auto">
              J de vie {card.day_of_life}
            </span>
          )}
        </div>
      </div>
    );
  };

  const matinCards = journal?.matin || [];
  const apremCards = journal?.aprem || [];

  const scheduledCompetenceCodes = React.useMemo(() => {
    const allCards = [...matinCards, ...apremCards];
    const codes = new Set<string>();
    for (const card of allCards) {
      if (
        card.competence_code &&
        card.competence_code !== 'PERSO' &&
        card.competence_code !== 'AUTRE' &&
        card.competence_code !== 'TODO'
      ) {
        codes.add(card.competence_code);
      }
    }
    return Array.from(codes);
  }, [matinCards, apremCards]);

  const renderCreneauColumns = (
    creneau: 'matin' | 'aprem',
    cards: ActivityCardItem[]
  ) => {
    let activeGrades: string[] = [];

    if (gradeFilter && gradeFilter !== 'Tous') {
      activeGrades = [gradeFilter];
    } else if (journal?.active_grades && journal.active_grades.length > 0) {
      activeGrades = journal.active_grades;
    } else {
      const gradesFromCards = Array.from(
        new Set([
          ...(journal?.available_grades || []),
          ...cards.map((c) => c.grade),
        ])
      ).filter((g) => g && g !== 'Tous');

      const defaultOrder = ['CE1', 'CE2', 'CM1', 'CM2', '6EME'];
      gradesFromCards.sort((a, b) => {
        const idxA = defaultOrder.indexOf(a.trim().toUpperCase());
        const idxB = defaultOrder.indexOf(b.trim().toUpperCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.localeCompare(b);
      });

      activeGrades = gradesFromCards;
    }

    if (activeGrades.length === 0 && cards.length > 0) {
      activeGrades = ['Tous'];
    }

    if (cards.length === 0 && (!gradeFilter || gradeFilter === 'Tous')) {
      return (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-400 uppercase">
              Aucune activité planifiée pour le {creneau === 'matin' ? 'matin' : 'après-midi'}
            </p>
          </div>
        </div>
      );
    }

    const gridColsClass =
      activeGrades.length === 1
        ? 'grid-cols-1'
        : activeGrades.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : activeGrades.length === 3
        ? 'grid-cols-1 md:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

    return (
      <div className={`grid ${gridColsClass} gap-3`}>
        {activeGrades.map((grade) => {
          const normGrade = grade.trim().toUpperCase();
          const colKey = `${creneau}-${normGrade}`;

          const rawGradeCards = cards.filter((c) => {
            const cG = (c.grade || '').trim().toUpperCase();
            return cG === normGrade || cG === 'TOUS' || normGrade === 'TOUS';
          });

          // Sort according to custom column order if exists
          const customOrder = columnOrders[colKey];
          let gradeCards = [...rawGradeCards];
          if (customOrder && customOrder.length > 0) {
            gradeCards.sort((a, b) => {
              const idxA = customOrder.indexOf(a.id);
              const idxB = customOrder.indexOf(b.id);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return 0;
            });
          } else {
            gradeCards.sort((a, b) => {
              const orderA = a.order_index ?? a.ordre ?? 999;
              const orderB = b.order_index ?? b.ordre ?? 999;
              return orderA - orderB;
            });
          }

          // Filter active cards vs hidden/done cards
          const isShowHidden = Boolean(showHiddenCols[colKey]);

          const activeCards = gradeCards.filter((c) => !c.fait && !hiddenCardIds.has(c.id));
          const hiddenAndDoneCards = gradeCards.filter((c) => c.fait || hiddenCardIds.has(c.id));
          const hiddenCount = hiddenAndDoneCards.length;

          const visibleCards = isShowHidden ? gradeCards : activeCards;

          const topLevelItems = getTopLevelDisplayItems(visibleCards, customOrder) as ColumnDisplayItem[];

          return (
            <div
              key={grade}
              className="flex flex-col gap-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/80 min-w-0"
            >
              <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-md border border-slate-200 shadow-2xs">
                <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  Niveau {grade}
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {visibleCards.length} activ.
                </span>
              </div>

              <div className="space-y-3 min-h-[50px]">
                {topLevelItems.length > 0 ? (
                  topLevelItems.map((displayItem, topIndex) => {
                    if (displayItem.type === 'eval_group') {
                      return (
                        <div
                          key="block-evals"
                          draggable={isUnlocked}
                          onDragStart={() => handleDragStart('block-evals')}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDropItem(colKey, 'block-evals', topLevelItems, visibleCards)}
                          onDragEnd={() => setDraggedCardId(null)}
                          className={`bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-orange-500/10 border-2 border-orange-300 rounded-xl p-2.5 shadow-xs space-y-2 relative transition-all ${
                            draggedCardId === 'block-evals' ? 'opacity-40 border-dashed border-orange-500 ring-2 ring-orange-300 scale-[0.99]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-600 text-white px-2.5 py-1.5 rounded-lg font-black text-xs shadow-2xs">
                            <div className="flex items-center gap-1.5">
                              {isUnlocked && (
                                <span
                                  className="cursor-grab active:cursor-grabbing hover:bg-white/20 p-0.5 rounded transition-colors"
                                  title="Faire glisser tout le bloc Évaluations"
                                >
                                  <GripVertical className="w-3.5 h-3.5 text-white/90" />
                                </span>
                              )}
                              <span className="p-1 bg-white/20 rounded">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              </span>
                              <span className="uppercase tracking-wider">
                                Évaluations ({displayItem.cards!.length})
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {isUnlocked && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(colKey, 'block-evals', 'up', topLevelItems, visibleCards)}
                                    disabled={topIndex === 0}
                                    className="p-1 hover:bg-white/20 rounded disabled:opacity-30 disabled:hover:bg-transparent text-white transition-all cursor-pointer"
                                    title="Monter le bloc Évaluations"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(colKey, 'block-evals', 'down', topLevelItems, visibleCards)}
                                    disabled={topIndex === topLevelItems.length - 1}
                                    className="p-1 hover:bg-white/20 rounded disabled:opacity-30 disabled:hover:bg-transparent text-white transition-all cursor-pointer"
                                    title="Descendre le bloc Évaluations"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyGrandCartouche('Évaluations', displayItem.cards!, colKey)
                                }
                                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ml-1"
                                title="Copier tout le grand cartouche d'évaluations dans le presse-papier"
                              >
                                {copiedGrandId === `Évaluations-${colKey}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-300" />
                                    <span>Copié !</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copier-coller</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {displayItem.cards!.map((card, idx) =>
                              renderCard(card, colKey, idx, displayItem.cards!.length, visibleCards, topIndex, topLevelItems.length, topLevelItems, true)
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (displayItem.type === 'entrainement_group') {
                      return (
                        <div
                          key="block-entrainements"
                          draggable={isUnlocked}
                          onDragStart={() => handleDragStart('block-entrainements')}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDropItem(colKey, 'block-entrainements', topLevelItems, visibleCards)}
                          onDragEnd={() => setDraggedCardId(null)}
                          className={`bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-purple-500/10 border-2 border-purple-300 rounded-xl p-2.5 shadow-xs space-y-2.5 relative transition-all ${
                            draggedCardId === 'block-entrainements' ? 'opacity-40 border-dashed border-purple-500 ring-2 ring-purple-300 scale-[0.99]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-black text-xs shadow-2xs">
                            <div className="flex items-center gap-1.5">
                              {isUnlocked && (
                                <span
                                  className="cursor-grab active:cursor-grabbing hover:bg-white/20 p-0.5 rounded transition-colors"
                                  title="Faire glisser tout le bloc Entraînements"
                                >
                                  <GripVertical className="w-3.5 h-3.5 text-white/90" />
                                </span>
                              )}
                              <span className="p-1 bg-white/20 rounded">
                                <Target className="w-3.5 h-3.5 text-white" />
                              </span>
                              <span className="uppercase tracking-wider">
                                Entraînements ({displayItem.cards!.length})
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {isUnlocked && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(colKey, 'block-entrainements', 'up', topLevelItems, visibleCards)}
                                    disabled={topIndex === 0}
                                    className="p-1 hover:bg-white/20 rounded disabled:opacity-30 disabled:hover:bg-transparent text-white transition-all cursor-pointer"
                                    title="Monter le bloc Entraînements"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(colKey, 'block-entrainements', 'down', topLevelItems, visibleCards)}
                                    disabled={topIndex === topLevelItems.length - 1}
                                    className="p-1 hover:bg-white/20 rounded disabled:opacity-30 disabled:hover:bg-transparent text-white transition-all cursor-pointer"
                                    title="Descendre le bloc Entraînements"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyGrandCartouche('Entraînements', displayItem.cards!, colKey)
                                }
                                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ml-1"
                                title="Copier tout le grand cartouche d'entraînements dans le presse-papier"
                              >
                                {copiedGrandId === `Entraînements-${colKey}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-300" />
                                    <span>Copié !</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copier-coller</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {displayItem.cards!.map((card, idx) =>
                              renderCard(card, colKey, idx, displayItem.cards!.length, visibleCards, topIndex, topLevelItems.length, topLevelItems, true)
                            )}
                          </div>
                        </div>
                      );
                    }

                    return renderCard(
                      displayItem.card!,
                      colKey,
                      topIndex,
                      topLevelItems.length,
                      visibleCards,
                      topIndex,
                      topLevelItems.length,
                      topLevelItems,
                      false
                    );
                  })
                ) : (
                  <div className="h-14 border border-dashed border-slate-200 rounded-md flex items-center justify-center text-[11px] font-medium text-slate-400 italic">
                    {hiddenCount > 0
                      ? 'Toutes les activités sont masquées ou faites'
                      : `Aucune activité ${grade}`}
                  </div>
                )}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowHiddenCols((prev) => ({
                        ...prev,
                        [colKey]: !prev[colKey],
                      }))
                    }
                    className="w-full text-center py-1.5 px-2 text-[11px] text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-md border border-slate-300 font-bold transition-all cursor-pointer shadow-2xs mt-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {isShowHidden
                        ? `Masquer ${hiddenCount} activité(s) masquée(s) / faite(s)`
                        : `Réafficher ${hiddenCount} activité(s) masquée(s) / faite(s)`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 w-full select-none">
      {/* Large Date Navigation Banner (Positioned above Matin block) - ALWAYS VISIBLE */}
      {currentDate && onDateChange && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onDateChange(shiftDateString(currentDate, -7))}
              className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Semaine précédente (-7 jours)"
            >
              <ChevronsLeft className="w-4 h-4 text-indigo-600" />
              <span className="hidden md:inline">-1 Sem.</span>
            </button>
            <button
              type="button"
              onClick={() => onDateChange(shiftDateString(currentDate, -1))}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Jour précédent (-1 jour)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Jour préc.</span>
            </button>
          </div>

          <div className="text-center flex flex-col items-center mx-auto">
            <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full border border-indigo-100">
                Cahier journal du jour
              </span>
              <button
                type="button"
                onClick={() => setIsDiffModalOpen(true)}
                className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-black text-[10px] uppercase flex items-center gap-1 shadow-2xs transition-all cursor-pointer border border-amber-600"
                title="Ouvrir le panneau d'analyse de différenciation globale (Mode aperçu / test)"
              >
                <Users className="w-3 h-3" />
                <span>Différencier (Aperçu)</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={currentDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight cursor-pointer bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-2"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onDateChange(shiftDateString(currentDate, Number(e.target.value)));
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                title="Saut de plusieurs semaines"
              >
                <option value="" disabled>Saut de semaines...</option>
                <option value="-42">- 6 Semaines</option>
                <option value="-35">- 5 Semaines</option>
                <option value="-28">- 4 Semaines</option>
                <option value="-21">- 3 Semaines</option>
                <option value="-14">- 2 Semaines</option>
                <option value="-7">- 1 Semaine</option>
                <option value="7">+ 1 Semaine</option>
                <option value="14">+ 2 Semaines</option>
                <option value="21">+ 3 Semaines</option>
                <option value="28">+ 4 Semaines</option>
                <option value="35">+ 5 Semaines</option>
                <option value="42">+ 6 Semaines</option>
              </select>
            </div>
            <p className="text-xs md:text-sm font-bold text-slate-600 capitalize mt-0.5">
              {formatDateFrench(currentDate)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => onDateChange(shiftDateString(currentDate, 1))}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Jour suivant (+1 jour)"
            >
              <span>Jour suiv.</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDateChange(shiftDateString(currentDate, 7))}
              className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-200 cursor-pointer shadow-2xs"
              title="Semaine suivante (+7 jours)"
            >
              <span className="hidden md:inline">+1 Sem.</span>
              <ChevronsRight className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        </div>
      )}

      {deleteErrorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs flex items-center justify-between font-medium shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{deleteErrorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteErrorMsg(null)}
            className="text-red-700 font-bold hover:underline text-xs cursor-pointer ml-2"
          >
            Fermer
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center text-slate-400 font-medium">
            Chargement de la progression spiralaire Matin...
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center text-slate-400 font-medium">
            Chargement de la progression spiralaire Après-midi...
          </div>
        </div>
      ) : journal && !journal.is_working_day ? (
        <div className="flex items-center justify-center bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
          <div className="text-center max-w-md">
            <div className="inline-flex p-3 bg-amber-50 text-amber-600 rounded-full mb-3 border border-amber-200">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Jour non travaillé / Vacances
            </h3>
            <p className="text-xs md:text-sm text-slate-600 mt-1 font-medium leading-relaxed">
              {journal.holiday_reason ||
                'Cette date est un jour férié, une période de vacances ou un jour non travaillé par l’enseignant.'}
            </p>
            <p className="text-xs font-bold text-indigo-600 mt-3 bg-indigo-50 border border-indigo-100 rounded-lg py-1.5 px-3">
              La progression spiralaire est en pause : aucune séquence ne sera incrémentée.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Matin */}
      <section className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded">
              <Sun className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-bold text-slate-700 text-sm">Matin</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Delay Counter Matin */}
            {delayMorning !== undefined && (
              <div className="flex items-center bg-orange-50 border border-orange-200 rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-orange-700 mr-1.5">
                  Retard Matin :
                </span>
                <div className="flex items-center gap-1">
                  {isUnlocked && (
                    <button
                      type="button"
                      onClick={onDecrementDelayMorning}
                      title="Diminuer le retard du matin (-1 jour)"
                      className="w-5 h-5 flex items-center justify-center bg-white border border-orange-300 rounded text-orange-800 font-bold hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  <span
                    className="text-xs font-black text-orange-800 min-w-[28px] text-center"
                    title="Compteur de retard Matin"
                  >
                    +{delayMorning}J
                  </span>
                  {isUnlocked && (
                    <button
                      type="button"
                      onClick={onIncrementDelayMorning}
                      title="Augmenter le retard du matin (+1 jour)"
                      className="w-5 h-5 flex items-center justify-center bg-white border border-orange-300 rounded text-orange-800 font-bold hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isPlanDeTravail && isUnlocked && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenNewActivity('matin')}
                  className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Ajouter une activité personnalisée pour le matin"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-3">
          {renderCreneauColumns('matin', matinCards)}
        </div>
      </section>

      {/* Après-midi */}
      <section className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-100 text-purple-700 rounded">
              <Moon className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-bold text-slate-700 text-sm">Après-midi</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Delay Counter Après-midi */}
            {delayAfternoon !== undefined && (
              <div className="flex items-center bg-orange-50 border border-orange-200 rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-orange-700 mr-1.5">
                  Retard A-Midi :
                </span>
                <div className="flex items-center gap-1">
                  {isUnlocked && (
                    <button
                      type="button"
                      onClick={onDecrementDelayAfternoon}
                      title="Diminuer le retard de l'après-midi (-1 jour)"
                      className="w-5 h-5 flex items-center justify-center bg-white border border-orange-300 rounded text-orange-800 font-bold hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  <span
                    className="text-xs font-black text-orange-800 min-w-[28px] text-center"
                    title="Compteur de retard Après-midi"
                  >
                    +{delayAfternoon}J
                  </span>
                  {isUnlocked && (
                    <button
                      type="button"
                      onClick={onIncrementDelayAfternoon}
                      title="Augmenter le retard de l'après-midi (+1 jour)"
                      className="w-5 h-5 flex items-center justify-center bg-white border border-orange-300 rounded text-orange-800 font-bold hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isPlanDeTravail && isUnlocked && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenNewActivity('aprem')}
                  className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Ajouter une activité personnalisée pour l'après-midi"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-3">
          {renderCreneauColumns('aprem', apremCards)}
        </div>
      </section>
      </>
      )}

      {/* Floating Save Notification Toast */}
      {saveSuccessMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-extrabold flex items-center gap-2.5">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Panel / Modal de Différenciation globale (Mode test / aperçu) */}
      <DifferentiationOverviewModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        activeGrades={journal?.active_grades}
        scheduledCompetenceCodes={scheduledCompetenceCodes}
      />
    </div>
  );
};
