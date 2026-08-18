/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DailyCahierJournal,
  DatabaseStatus,
  UserSettings,
  Competence,
  ChronologicalProgression,
  HomeworkAdjustment,
  CustomHomework,
  Student,
  ManualAdjustment,
} from '../types.js';

export const api = {
  async verifyPassword(password: string, teacherId = 'JulieCB'): Promise<{ success: boolean; message?: string }> {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, teacherId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Mot de passe incorrect' }));
      return { success: false, message: err.message || 'Mot de passe incorrect' };
    }
    return res.json();
  },

  async getDbStatus(): Promise<DatabaseStatus> {
    const res = await fetch('/api/db/status');
    if (!res.ok) throw new Error('Erreur de statut DB');
    return res.json();
  },

  async seedDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/db/seed', { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors du seed DB');
    return res.json();
  },

  async getSettings(): Promise<UserSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Erreur de lecture des paramètres');
    return res.json();
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Erreur de mise à jour des paramètres');
    return res.json();
  },

  async getCompetences(): Promise<Competence[]> {
    const res = await fetch('/api/competences');
    if (!res.ok) throw new Error('Erreur de lecture des compétences');
    return res.json();
  },

  async getStudents(): Promise<Student[]> {
    const res = await fetch('/api/students');
    if (!res.ok) throw new Error('Erreur de lecture des élèves');
    return res.json();
  },

  async getCahierJournal(date: string, grade = 'Tous'): Promise<DailyCahierJournal> {
    const res = await fetch(`/api/cahier-journal?date=${encodeURIComponent(date)}&grade=${encodeURIComponent(grade)}`);
    if (!res.ok) throw new Error('Erreur de lecture du cahier journal');
    return res.json();
  },

  async toggleActivityDone(id: number, fait: boolean): Promise<{ success: boolean }> {
    const res = await fetch('/api/cahier-journal/toggle-done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fait }),
    });
    if (!res.ok) throw new Error('Erreur de modification Fait');
    return res.json();
  },

  async reportUndoneToNextDay(date: string): Promise<{ postponedCount: number; targetDate: string }> {
    const res = await fetch('/api/cahier-journal/report-undone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    if (!res.ok) throw new Error('Erreur de report au lendemain');
    return res.json();
  },

  async reportActivity(params: {
    id?: number | string;
    db_id?: number;
    source?: string;
    is_custom?: boolean;
    currentDate: string;
    card?: any;
  }): Promise<{ success: boolean; nextWorkingDate: string }> {
    const res = await fetch('/api/report-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur lors du report de l’activité');
    }
    return res.json();
  },

  async addManualAdjustment(adj: Partial<ManualAdjustment>): Promise<ManualAdjustment> {
    const res = await fetch('/api/manual-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adj),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur d’enregistrement de la surcharge spiralaire');
    }
    return res.json();
  },

  async addCustomActivity(adj: Partial<ManualAdjustment>): Promise<ManualAdjustment> {
    const res = await fetch('/api/custom-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adj),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur d’enregistrement de l’activité manuelle');
    }
    return res.json();
  },

  async addManualActivity(adj: Partial<ManualAdjustment>): Promise<ManualAdjustment> {
    if (adj.progression_id || adj.is_custom === false) {
      return this.addManualAdjustment(adj);
    }
    return this.addCustomActivity(adj);
  },

  async getManualAdjustmentOptions(): Promise<{
    matieres: string[];
    domaines: string[];
    types: string[];
    competences: string[];
  }> {
    const res = await fetch('/api/cahier-journal/options');
    if (!res.ok) throw new Error('Erreur de lecture des options');
    return res.json();
  },

  async deleteManualActivity(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`/api/cahier-journal/activity/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur de suppression de l’activité');
    }
    return res.json();
  },

  async getProgressions(): Promise<{
    matin: ChronologicalProgression[];
    aprem: ChronologicalProgression[];
  }> {
    const res = await fetch('/api/progressions');
    if (!res.ok) throw new Error('Erreur de lecture des progressions');
    return res.json();
  },

  async addProgression(item: Partial<ChronologicalProgression>): Promise<ChronologicalProgression> {
    const res = await fetch('/api/progressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error('Erreur d’ajout de la séquence');
    return res.json();
  },

  async getHomework(grade = 'Tous'): Promise<HomeworkAdjustment[]> {
    const res = await fetch(`/api/homework?grade=${encodeURIComponent(grade)}`);
    if (!res.ok) throw new Error('Erreur de lecture des devoirs');
    return res.json();
  },

  async addHomework(hw: Partial<HomeworkAdjustment>): Promise<HomeworkAdjustment> {
    const res = await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hw),
    });
    if (!res.ok) throw new Error('Erreur d’ajout du devoir');
    return res.json();
  },

  async upsertHomework(hw: Record<string, any>): Promise<HomeworkAdjustment> {
    const res = await fetch('/api/homework-manual-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hw),
    });
    if (!res.ok) throw new Error('Erreur de mise à jour du devoir');
    return res.json();
  },

  async upsertHomeworkAdjustment(hw: Record<string, any>): Promise<HomeworkAdjustment> {
    const res = await fetch('/api/homework-manual-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hw),
    });
    if (!res.ok) throw new Error('Erreur d’enregistrement de l’ajustement');
    return res.json();
  },

  async deleteHomeworkAdjustment(params: {
    id?: number;
    date_echeance?: string;
    date_due?: string;
    grade?: string;
    teacher_id?: string;
    source_task_id?: string;
    competence_code?: string;
    description?: string;
  }): Promise<{ success: boolean }> {
    const res = await fetch('/api/homework-manual-adjustments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Erreur de suppression de l’ajustement');
    return res.json();
  },

  async moveHomework(item: HomeworkAdjustment, currentDate: string, targetDate: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/homework/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, current_date: currentDate, target_date: targetDate }),
    });
    if (!res.ok) throw new Error('Erreur lors du déplacement du devoir');
    return res.json();
  },

  async duplicateHomework(item: HomeworkAdjustment, targetDate: string): Promise<HomeworkAdjustment> {
    const res = await fetch('/api/homework/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, target_date: targetDate }),
    });
    if (!res.ok) throw new Error('Erreur lors de la duplication du devoir');
    return res.json();
  },

  async toggleHomeworkDone(id: number, done: boolean): Promise<{ success: boolean }> {
    const res = await fetch('/api/homework/toggle-done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, done }),
    });
    if (!res.ok) throw new Error('Erreur de mise à jour du devoir');
    return res.json();
  },

  async deleteHomework(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`/api/homework/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur de suppression du devoir');
    return res.json();
  },

  async migrateHomeworkFromLocalStorage(items: any[]): Promise<{ migratedCount: number }> {
    const res = await fetch('/api/homework/migrate-localstorage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Erreur lors de la migration des devoirs');
    return res.json();
  },

  async reorderActivities(items: Array<{
    id?: string | number;
    db_id?: number;
    progression_id?: number;
    is_custom?: boolean;
    source?: string;
    date: string;
    time_slot_id: string;
    order_index: number;
    grade?: string;
    titre?: string;
    type_activite?: string;
    description?: string;
    numero_exercice?: string;
  }>): Promise<{ success: boolean }> {
    const res = await fetch('/api/cahier-journal/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Erreur de réordonnancement');
    return res.json();
  },

  async truncateManualAdjustments(teacherId = 'JulieCB'): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/manual-adjustments/truncate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_id: teacherId }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur lors de l’effacement des ajustements spiralaires.');
    }
    return res.json();
  },

  async truncateCustomActivities(teacherId = 'JulieCB'): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/custom-activities/truncate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_id: teacherId }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur lors de l’effacement des activités décrochées.');
    }
    return res.json();
  },

  async truncateHomeworkManualAdjustments(teacherId = 'JulieCB', grade?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/homework-manual-adjustments/truncate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_id: teacherId, grade }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur lors de l’effacement des ajustements manuels de devoirs.');
    }
    return res.json();
  },

  async truncateCustomHomework(teacherId = 'JulieCB', grade?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/custom-homework/truncate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_id: teacherId, grade }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur lors de l’effacement des devoirs personnalisés.');
    }
    return res.json();
  },

  async getCustomHomeworkOptions(teacherId = 'JulieCB'): Promise<{ matieres: string[]; sub_domains: string[] }> {
    const res = await fetch(`/api/custom-homework/options?teacher_id=${encodeURIComponent(teacherId)}`);
    if (!res.ok) throw new Error('Erreur de lecture des options de devoirs personnalisés');
    return res.json();
  },

  async addCustomHomework(hw: Partial<CustomHomework>): Promise<CustomHomework> {
    const url = hw.id && Number(hw.id) > 0 ? `/api/custom-homework/${hw.id}` : '/api/custom-homework';
    const method = hw.id && Number(hw.id) > 0 ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hw),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur d’enregistrement du devoir personnalisé');
    }
    return res.json();
  },

  async deleteCustomHomework(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`/api/custom-homework/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur de suppression du devoir personnalisé');
    }
    return res.json();
  },

  async getDifferentiationOverview(
    teacherId = 'JulieCB',
    activeGrades?: string[],
    scheduledCodes?: string[]
  ): Promise<any[]> {
    let url = `/api/differentiation/overview?teacher_id=${encodeURIComponent(teacherId)}`;
    if (activeGrades && activeGrades.length > 0) {
      url += `&active_grades=${encodeURIComponent(activeGrades.join(','))}`;
    }
    if (scheduledCodes && scheduledCodes.length > 0) {
      url += `&scheduled_codes=${encodeURIComponent(scheduledCodes.join(','))}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Erreur lors de la récupération du récapitulatif de différenciation');
    }
    return res.json();
  },
};
