export interface Habit {
  id: string;
  name: string;
  emoji: string;
  description: string;
  pts: number;
  color: string;
  createdAt: string; // YYYY-MM-DD
}

export interface Completion {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
}

export interface HabitNote {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  note: string;
  updatedAt?: string;
}

export interface LevelInfo {
  level: number;
  title: string;
  minPts: number;
  maxPts: number;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, title: 'Iniciante', minPts: 0, maxPts: 100 },
  { level: 2, title: 'Ativo', minPts: 100, maxPts: 300 },
  { level: 3, title: 'Disciplinado', minPts: 300, maxPts: 700 },
  { level: 4, title: 'Focado', minPts: 700, maxPts: 1500 },
  { level: 5, title: 'Resiliente', minPts: 1500, maxPts: 3000 },
  { level: 6, title: 'Consistente', minPts: 3000, maxPts: 6000 },
  { level: 7, title: 'Elite', minPts: 6000, maxPts: 999999 },
];

export function getLevelForXP(xp: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minPts) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}
