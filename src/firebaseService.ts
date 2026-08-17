import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth, isUsingMockConfig } from './firebase';
import { Habit, Completion, HabitNote } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ☀️ "Acordar no horário" — 15pts — "Levantar cedo"
// 🏃 "Caminhar / Alongamento" — 20pts — "Mínimo 20 minutos"
// "Estudar inglês" — 10pts — "10 min"
// "Ficar acordado durante o dia" — 50pts — ""
// 🌙 "Dormir no horário" — 15pts — "Rotina de sono consistente"
const INITIAL_SEED_HABITS = (userId: string): Habit[] => [
  {
    id: 'habit-1',
    name: 'Acordar no horário',
    emoji: '☀️',
    description: 'Levantar cedo',
    pts: 15,
    color: '#ffd166',
    createdAt: '2026-06-01'
  },
  {
    id: 'habit-2',
    name: 'Caminhar / Alongamento',
    emoji: '🏃',
    description: 'Mínimo 20 minutos',
    pts: 20,
    color: '#7fff6e',
    createdAt: '2026-06-01'
  },
  {
    id: 'habit-3',
    name: 'Estudar inglês',
    emoji: '📚',
    description: '10 min',
    pts: 10,
    color: '#3dffc3',
    createdAt: '2026-06-01'
  },
  {
    id: 'habit-4',
    name: 'Ficar acordado durante o dia',
    emoji: '⚡',
    description: '',
    pts: 50,
    color: '#bf5fff',
    createdAt: '2026-06-01'
  },
  {
    id: 'habit-5',
    name: 'Dormir no horário',
    emoji: '🌙',
    description: 'Rotina de sono consistente',
    pts: 15,
    color: '#ff5a5f',
    createdAt: '2026-06-01'
  }
];

const INITIAL_SEED_COMPLETIONS: Omit<Completion, 'id'>[] = [
  { habitId: 'habit-1', date: '2026-06-01' },
  { habitId: 'habit-1', date: '2026-06-02' },
  { habitId: 'habit-1', date: '2026-06-03' },
  { habitId: 'habit-1', date: '2026-06-04' },
  { habitId: 'habit-1', date: '2026-06-05' },
  { habitId: 'habit-1', date: '2026-06-06' },
  { habitId: 'habit-1', date: '2026-06-07' },

  { habitId: 'habit-2', date: '2026-06-01' },
  { habitId: 'habit-2', date: '2026-06-02' },
  { habitId: 'habit-2', date: '2026-06-03' },
  { habitId: 'habit-2', date: '2026-06-05' },
  { habitId: 'habit-2', date: '2026-06-06' },
  { habitId: 'habit-2', date: '2026-06-07' },

  { habitId: 'habit-3', date: '2026-06-02' },
  { habitId: 'habit-3', date: '2026-06-03' },
  { habitId: 'habit-3', date: '2026-06-04' },
  { habitId: 'habit-3', date: '2026-06-05' },
  { habitId: 'habit-3', date: '2026-06-07' },

  { habitId: 'habit-4', date: '2026-06-01' },
  { habitId: 'habit-4', date: '2026-06-03' },
  { habitId: 'habit-4', date: '2026-06-04' },
  { habitId: 'habit-4', date: '2026-06-05' },
  { habitId: 'habit-4', date: '2026-06-06' },
  { habitId: 'habit-4', date: '2026-06-07' },

  { habitId: 'habit-5', date: '2026-06-01' },
  { habitId: 'habit-5', date: '2026-06-02' },
  { habitId: 'habit-5', date: '2026-06-03' },
  { habitId: 'habit-5', date: '2026-06-04' },
  { habitId: 'habit-5', date: '2026-06-05' },
  { habitId: 'habit-5', date: '2026-06-06' },
  { habitId: 'habit-5', date: '2026-06-07' }
];

export async function validateFirestoreConnection() {
  if (isUsingMockConfig) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export async function getUserHabits(userId: string): Promise<Habit[]> {
  const path = `users/${userId}/habits`;
  
  if (isUsingMockConfig) {
    const key = `v_habits_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as Habit[];
      } catch (e) {
        console.error("Failed to parse local stored habits", e);
      }
    }
    
    // Seed and write
    const seedList = INITIAL_SEED_HABITS(userId);
    localStorage.setItem(key, JSON.stringify(seedList));
    
    // Seed completions
    const compKey = `v_completions_${userId}`;
    if (!localStorage.getItem(compKey)) {
      const initialComps: Completion[] = INITIAL_SEED_COMPLETIONS.map((rawComp) => ({
        id: `com-${Math.random().toString(36).substring(2, 11)}`,
        habitId: rawComp.habitId,
        date: rawComp.date
      }));
      localStorage.setItem(compKey, JSON.stringify(initialComps));
    }
    return seedList;
  }

  try {
    const qSnapshot = await getDocs(collection(db, path));
    const items: Habit[] = [];
    qSnapshot.forEach((docSnap) => {
      items.push(docSnap.data() as Habit);
    });

    if (items.length === 0) {
      // Auto seed 5 default habits
      const seedList = INITIAL_SEED_HABITS(userId);
      for (const h of seedList) {
        await saveHabit(userId, h);
      }
      // Auto seed list of completions for demo continuity
      for (const rawComp of INITIAL_SEED_COMPLETIONS) {
        const cId = `com-${Math.random().toString(36).substring(2, 11)}`;
        await saveCompletion(userId, {
          id: cId,
          habitId: rawComp.habitId,
          date: rawComp.date
        });
      }
      return seedList;
    }

    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getUserCompletions(userId: string): Promise<Completion[]> {
  const path = `users/${userId}/completions`;
  
  if (isUsingMockConfig) {
    const key = `v_completions_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as Completion[];
      } catch (e) {
        console.error("Failed to parse local completions", e);
      }
    }
    return [];
  }

  try {
    const qSnapshot = await getDocs(collection(db, path));
    const items: Completion[] = [];
    qSnapshot.forEach((docSnap) => {
      items.push(docSnap.data() as Completion);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveHabit(userId: string, habit: Habit): Promise<void> {
  const path = `users/${userId}/habits/${habit.id}`;
  
  if (isUsingMockConfig) {
    const key = `v_habits_${userId}`;
    const stored = localStorage.getItem(key);
    let habitsList: Habit[] = [];
    if (stored) {
      try { habitsList = JSON.parse(stored); } catch (e) {}
    }
    const idx = habitsList.findIndex((h) => h.id === habit.id);
    if (idx >= 0) {
      habitsList[idx] = habit;
    } else {
      habitsList.push(habit);
    }
    localStorage.setItem(key, JSON.stringify(habitsList));
    return;
  }

  try {
    await setDoc(doc(db, `users/${userId}/habits`, habit.id), habit);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const path = `users/${userId}/habits/${habitId}`;
  
  if (isUsingMockConfig) {
    const key = `v_habits_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        let habitsList: Habit[] = JSON.parse(stored);
        habitsList = habitsList.filter((h) => h.id !== habitId);
        localStorage.setItem(key, JSON.stringify(habitsList));
      } catch (e) {}
    }
    const compKey = `v_completions_${userId}`;
    const compsStored = localStorage.getItem(compKey);
    if (compsStored) {
      try {
        let compsList: Completion[] = JSON.parse(compsStored);
        compsList = compsList.filter((c) => c.habitId !== habitId);
        localStorage.setItem(compKey, JSON.stringify(compsList));
      } catch (e) {}
    }
    const noteKey = `v_notes_${userId}`;
    const notesStored = localStorage.getItem(noteKey);
    if (notesStored) {
      try {
        let notesList: HabitNote[] = JSON.parse(notesStored);
        notesList = notesList.filter((n) => n.habitId !== habitId);
        localStorage.setItem(noteKey, JSON.stringify(notesList));
      } catch (e) {}
    }
    return;
  }

  try {
    await deleteDoc(doc(db, `users/${userId}/habits`, habitId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCompletion(userId: string, completion: Completion): Promise<void> {
  const path = `users/${userId}/completions/${completion.id}`;
  
  if (isUsingMockConfig) {
    const key = `v_completions_${userId}`;
    const stored = localStorage.getItem(key);
    let list: Completion[] = [];
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) {}
    }
    const idx = list.findIndex((c) => c.id === completion.id);
    if (idx >= 0) {
      list[idx] = completion;
    } else {
      list.push(completion);
    }
    localStorage.setItem(key, JSON.stringify(list));
    return;
  }

  try {
    await setDoc(doc(db, `users/${userId}/completions`, completion.id), completion);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCompletion(userId: string, completionId: string): Promise<void> {
  const path = `users/${userId}/completions/${completionId}`;
  
  if (isUsingMockConfig) {
    const key = `v_completions_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        let list: Completion[] = JSON.parse(stored);
        list = list.filter((c) => c.id !== completionId);
        localStorage.setItem(key, JSON.stringify(list));
      } catch (e) {}
    }
    return;
  }

  try {
    await deleteDoc(doc(db, `users/${userId}/completions`, completionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getUserHabitNotes(userId: string): Promise<HabitNote[]> {
  const path = `users/${userId}/habitNotes`;
  
  if (isUsingMockConfig) {
    const key = `v_notes_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as HabitNote[];
      } catch (e) {
        console.error("Failed to parse local habit notes", e);
      }
    }
    return [];
  }

  try {
    const qSnapshot = await getDocs(collection(db, path));
    const items: HabitNote[] = [];
    qSnapshot.forEach((docSnap) => {
      items.push(docSnap.data() as HabitNote);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveHabitNote(userId: string, habitNote: HabitNote): Promise<void> {
  const path = `users/${userId}/habitNotes/${habitNote.id}`;
  
  if (isUsingMockConfig) {
    const key = `v_notes_${userId}`;
    const stored = localStorage.getItem(key);
    let list: HabitNote[] = [];
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) {}
    }
    const idx = list.findIndex((n) => n.id === habitNote.id);
    if (idx >= 0) {
      list[idx] = habitNote;
    } else {
      list.push(habitNote);
    }
    localStorage.setItem(key, JSON.stringify(list));
    return;
  }

  try {
    await setDoc(doc(db, `users/${userId}/habitNotes`, habitNote.id), habitNote);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHabitNote(userId: string, noteId: string): Promise<void> {
  const path = `users/${userId}/habitNotes/${noteId}`;
  
  if (isUsingMockConfig) {
    const key = `v_notes_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        let list: HabitNote[] = JSON.parse(stored);
        list = list.filter((n) => n.id !== noteId);
        localStorage.setItem(key, JSON.stringify(list));
      } catch (e) {}
    }
    return;
  }

  try {
    await deleteDoc(doc(db, `users/${userId}/habitNotes`, noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
