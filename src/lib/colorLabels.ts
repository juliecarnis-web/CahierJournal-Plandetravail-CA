/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ColorLabelOption {
  name: string;
  hex: string;
  textHex: string;
  borderHex: string;
  pastelHex?: string;
}

// 10 Couleurs pour cartouches spiralaires ('manual_adjustments') - Uniquement pour Évaluation et Entraînement
export const SPIRAL_COLOR_LABELS: ColorLabelOption[] = [
  { name: 'Orange', hex: '#f97316', textHex: '#ffffff', borderHex: '#ea580c', pastelHex: '#ffedd5' },
  { name: 'Vert sapin', hex: '#14532d', textHex: '#ffffff', borderHex: '#052e16', pastelHex: '#dcfce7' },
  { name: 'Bleu marine', hex: '#1e3a8a', textHex: '#ffffff', borderHex: '#172554', pastelHex: '#dbeafe' },
  { name: 'Fuchsia', hex: '#d946ef', textHex: '#ffffff', borderHex: '#c026d3', pastelHex: '#fae8ff' },
  { name: 'Rouge profond', hex: '#991b1b', textHex: '#ffffff', borderHex: '#7f1d1d', pastelHex: '#fee2e2' },
  { name: 'Vert prairie', hex: '#15803d', textHex: '#ffffff', borderHex: '#166534', pastelHex: '#dcfce7' },
  { name: 'Bleu roi', hex: '#1d4ed8', textHex: '#ffffff', borderHex: '#1e40af', pastelHex: '#dbeafe' },
  { name: 'Jaune bouton d\'or', hex: '#eab308', textHex: '#0f172a', borderHex: '#ca8a04', pastelHex: '#fef9c3' },
  { name: 'Noir', hex: '#09090b', textHex: '#ffffff', borderHex: '#27272a', pastelHex: '#f4f4f5' },
  { name: 'Gris', hex: '#64748b', textHex: '#ffffff', borderHex: '#475569', pastelHex: '#f1f5f9' },
];

// Couleurs pour cartouches création pure ('custom_activities')
export const CUSTOM_COLOR_LABELS: ColorLabelOption[] = [
  { name: 'Orange', hex: '#f97316', textHex: '#ffffff', borderHex: '#ea580c', pastelHex: '#ffedd5' },
  { name: 'Violet', hex: '#8b5cf6', textHex: '#ffffff', borderHex: '#7c3aed', pastelHex: '#f3e8ff' },
  { name: 'Vert sapin', hex: '#14532d', textHex: '#ffffff', borderHex: '#052e16', pastelHex: '#dcfce7' },
  { name: 'Bleu turquoise', hex: '#06b6d4', textHex: '#ffffff', borderHex: '#0891b2', pastelHex: '#ccfbf1' },
  { name: 'Marron clair', hex: '#b45309', textHex: '#ffffff', borderHex: '#78350f', pastelHex: '#fef3c7' },
  { name: 'Marron foncé', hex: '#451a03', textHex: '#ffffff', borderHex: '#292524', pastelHex: '#fde68a' },
  { name: 'Jaune un peu orange', hex: '#f59e0b', textHex: '#0f172a', borderHex: '#d97706', pastelHex: '#fef3c7' },
  { name: 'Orange un peu marron', hex: '#c2410c', textHex: '#ffffff', borderHex: '#9a3412', pastelHex: '#ffedd5' },
  { name: 'Bleu marine', hex: '#1e3a8a', textHex: '#ffffff', borderHex: '#172554', pastelHex: '#dbeafe' },
  { name: 'Bleu roi', hex: '#1d4ed8', textHex: '#ffffff', borderHex: '#1e40af', pastelHex: '#e0e7ff' },
  { name: 'Gris foncé', hex: '#334155', textHex: '#ffffff', borderHex: '#1e293b', pastelHex: '#f1f5f9' },
];

export const ALL_COLOR_LABELS = [...SPIRAL_COLOR_LABELS, ...CUSTOM_COLOR_LABELS];

export function getColorLabelObject(labelName?: string | null): ColorLabelOption | null {
  if (!labelName) return null;
  const target = labelName.trim().toLowerCase();
  return ALL_COLOR_LABELS.find((c) => c.name.toLowerCase() === target) || null;
}

export function getColorLabelStyle(labelName?: string | null) {
  const item = getColorLabelObject(labelName);
  if (!item) return null;
  return {
    backgroundColor: item.hex,
    color: item.textHex,
    borderColor: item.borderHex,
  };
}
