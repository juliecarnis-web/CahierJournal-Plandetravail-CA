export type DayRuleType = 
  | 'Leçon' 
  | 'Modelage' 
  | 'Entrainement (Codage x4)' 
  | 'Entrainement (Automatisation x2)' 
  | 'Entrainement (Remémoration x1)' 
  | 'EVALUATION 1' 
  | 'EVALUATION 2' 
  | 'EVALUATION 3' 
  | 'EVALUATION 4' 
  | 'EVALUATION 5' 
  | 'EVALUATION 6' 
  | 'EVALUATION 7' 
  | 'EVALUATION 8' 
  | 'EVALUATION 9' 
  | 'Tache complexe' 
  | 'Blanc' 
  | 'Rien';

export interface LevelData {
  name: string;
  notions: { text: string; url: string }[];
}

export interface Reminder {
  id: string;
  text: string;
  completed: boolean;
}

export interface Period {
  id: string;
  name: string;
  start: string;
  end: string;
  workDays: number[]; // Per-period work days
}

export interface TeacherData {
  levels: LevelData[];
  periods: Period[];
  reminders: Reminder[];
  delay: number; // Retard
  homeworkUrl?: string;
}

export type ViewMode = 'teacher' | 'student';
