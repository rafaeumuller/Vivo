import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Flame,
  Award,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  X,
  Sparkles,
  Info,
  LogIn,
  LogOut,
  User as UserIcon,
  Activity,
  Edit2,
  FileText
} from 'lucide-react';
import { Habit, Completion, HabitNote, getLevelForXP } from './types';
import { CalendarCard } from './components/CalendarCard';
import { CanvasBarChart } from './components/CanvasBarChart';
import { HabitDetailModal } from './components/HabitDetailModal';
import { DailyNoteModal } from './components/DailyNoteModal';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  getUserHabits,
  getUserCompletions,
  getUserHabitNotes,
  saveHabit,
  deleteHabit,
  saveCompletion,
  deleteCompletion,
  saveHabitNote,
  deleteHabitNote,
  validateFirestoreConnection
} from './firebaseService';

// --- DATE ENGINE UTILITIES ---
const getTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekDates = (baseStr: string = getTodayStr()): { start: string; end: string } => {
  const baseDate = new Date(baseStr + 'T12:00:00');
  const day = baseDate.getDay();
  // Adjust so Monday is 0, Sunday is 6
  const diffSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - diffSinceMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
};

const getMappedXPRatio = (xp: number): number => {
  if (xp <= 0) return 0;
  // 6 intervals (0 to 100, 100 to 300, 300 to 700, 700 to 1500, 1500 to 3000, 3000 to 6000, 6000+)
  // We can treat each of the 6 intervals as occupying 14.285% of the bar (which is 1/7 of the space).
  if (xp < 100) {
    return (xp / 100) * 14.285;
  }
  if (xp < 300) {
    return 14.285 + ((xp - 100) / 200) * 14.285;
  }
  if (xp < 700) {
    return 28.57 + ((xp - 300) / 400) * 14.285;
  }
  if (xp < 1500) {
    return 42.855 + ((xp - 700) / 800) * 14.285;
  }
  if (xp < 3000) {
    return 57.14 + ((xp - 1500) / 1500) * 14.285;
  }
  if (xp < 6000) {
    return 71.425 + ((xp - 3000) / 3000) * 14.285;
  }
  const eliteProgress = Math.min(4000, xp - 6000);
  return 85.71 + (eliteProgress / 4000) * 14.29;
};

export default function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState<User | { uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showLoginHelp, setShowLoginHelp] = useState<boolean>(false);

  // --- CORE STATE ---
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [habitNotes, setHabitNotes] = useState<HabitNote[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  
  // Date focused on standard interactive calendar (initialises to current date)
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStr());

  // Interactive UI triggers
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [selectedHabitForDetail, setSelectedHabitForDetail] = useState<Habit | null>(null);
  const [activeDailyNoteModal, setActiveDailyNoteModal] = useState<{ habit: Habit; date: string } | null>(null);

  // New Habit Input Forms
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('🧘');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [newHabitPts, setNewHabitPts] = useState<number>(15);
  const [newHabitColor, setNewHabitColor] = useState('#7fff6e');

  // --- EDIT HABIT STATE ---
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editEmoji, setEditEmoji] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPts, setEditPts] = useState<number>(15);
  const [editColor, setEditColor] = useState<string>('#3dffc3');

  // Filter settings
  const [filterType, setFilterType] = useState<'semana' | 'mes' | 'tudo' | 'personalizado'>('semana');
  const [filterStartDate, setFilterStartDate] = useState<string>(() => getWeekDates().start);
  const [filterEndDate, setFilterEndDate] = useState<string>(() => getWeekDates().end);

  // Feedback Toaster list
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  // Validate connection initially
  useEffect(() => {
    validateFirestoreConnection();

    // Check for redirect login result (useful in WebViews or when signInWithRedirect is triggered)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          triggerToast(`Bem-vindo, ${result.user.displayName || 'Usuário'}! ⚡`);
        }
      })
      .catch((err) => {
        console.error("Erro no retorno de autenticação via redirect:", err);
      });
  }, []);

  // Monitor Firebase Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // If there's a stored demo session, keep it
        const savedDemo = sessionStorage.getItem('vivo_demo_user');
        if (savedDemo) {
          setUser(JSON.parse(savedDemo));
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Firestore user data when user changes
  useEffect(() => {
    if (!user) {
      setHabits([]);
      setCompletions([]);
      setHabitNotes([]);
      return;
    }

    const loadUserData = async () => {
      setDataLoading(true);
      try {
        const [userHabits, userCompletions, userNotes] = await Promise.all([
          getUserHabits(user.uid),
          getUserCompletions(user.uid),
          getUserHabitNotes(user.uid),
        ]);
        setHabits(userHabits);
        setCompletions(userCompletions);
        setHabitNotes(userNotes);
      } catch (err) {
        triggerToast("Erro ao carregar dados do banco de dados.");
      } finally {
        setDataLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  // --- TRIGGER FEEDBACK TOAST ---
  const triggerToast = (text: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  };

  // --- LOGIN ACTIONS ---
  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      
      const isWebView = /wv|WebView/i.test(navigator.userAgent);
      if (isWebView) {
        // Embedded WebView environment: use redirect instead of popup
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      try {
        const result = await signInWithPopup(auth, googleProvider);
        setUser(result.user);
        triggerToast(`Bem-vindo, ${result.user.displayName || 'Usuário'}! ⚡`);
      } catch (popupErr: any) {
        if (
          popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/popup-closed-by-user' ||
          popupErr.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          // Fallback to redirect if popups are blocked or unsupported
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }
    } catch (e: any) {
      console.error("Firebase auth error:", e);
      let errorMsg = "Erro ao autenticar com Google.";
      if (e.code === 'auth/popup-blocked') {
        errorMsg = "O navegador bloqueou o pop-up de login do Google. Por favor, ative os pop-ups!";
        setAuthError("POPUP_BLOCKED");
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMsg = "Domínio não cadastrado na lista de domínios autorizados do Firebase Console!";
        setAuthError("UNAUTHORIZED_DOMAIN");
      } else if (e.code === 'auth/operation-not-allowed') {
        errorMsg = "O login do Google não está ativo no console do Firebase Authentication!";
        setAuthError("OPERATION_NOT_ALLOWED");
      } else if (e.code === 'auth/invalid-api-key' || (e.message && e.message.toLowerCase().includes('api-key-not-valid'))) {
        errorMsg = "Chave de API inválida no Firebase!";
        setAuthError("INVALID_API_KEY");
      } else {
        errorMsg = `Erro de Autenticação (${e.code || 'sem código'}): ${e.message || 'Houve um erro geral'}`;
        setAuthError(e.code || "UNKNOWN");
      }
      triggerToast(errorMsg);
      setShowLoginHelp(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const mockUser = {
      uid: "demo-user-123",
      displayName: "Paciente de Teste VIVO",
      email: "demo.paciente@psicologia.com",
      photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
    };
    sessionStorage.setItem('vivo_demo_user', JSON.stringify(mockUser));
    setUser(mockUser);
    triggerToast("Entrou no modo de demonstração rápida! 🧪");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    sessionStorage.removeItem('vivo_demo_user');
    setUser(null);
    triggerToast("Sessão finalizada.");
  };

  // --- STREAK SYSTEMS ---
  // GENERAL: Consec days with >= 1 completion
  const calculateGeneralStreak = (): number => {
    if (completions.length === 0) return 0;
    
    // Set of sorted checkin dates (descending)
    const uniqueDates = Array.from(new Set(completions.map((c) => c.date))).sort().reverse();
    const todayStr = getTodayStr(); 
    
    const yesterday = new Date(todayStr + 'T12:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If no completions today and yesterday, streak broke
    if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let currentCheckDate = uniqueDates.includes(todayStr) ? todayStr : yesterdayStr;

    const dateCursor = new Date(currentCheckDate + 'T12:00:00');
    while (true) {
      const cursorStr = dateCursor.toISOString().split('T')[0];
      if (uniqueDates.includes(cursorStr)) {
        streak++;
        dateCursor.setDate(dateCursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  // INDIVIDUAL HABIT STREAK:
  const getHabitStreak = (habitId: string): number => {
    const habitComplets = completions.filter((c) => c.habitId === habitId);
    if (habitComplets.length === 0) return 0;

    const uniqueDates = Array.from(new Set(habitComplets.map((c) => c.date))).sort().reverse();
    const todayStr = getTodayStr();

    const yesterday = new Date(todayStr + 'T12:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let currentCheckDate = uniqueDates.includes(todayStr) ? todayStr : yesterdayStr;

    const dateCursor = new Date(currentCheckDate + 'T12:00:00');
    while (true) {
      const cursorStr = dateCursor.toISOString().split('T')[0];
      if (uniqueDates.includes(cursorStr)) {
        streak++;
        dateCursor.setDate(dateCursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  // --- SCORE & LEVELS COMPUTATION ---
  const totalLifetimeXP = completions.reduce((accum, comp) => {
    const habit = habits.find((h) => h.id === comp.habitId);
    return accum + (habit ? habit.pts : 0);
  }, 0);

  // Compute Current Level details
  const levelInfo = getLevelForXP(totalLifetimeXP);
  
  // Progress ratio towards the next level
  const nextLevelXPNeeded = levelInfo.maxPts === 999999 ? 0 : levelInfo.maxPts - levelInfo.minPts;
  const currentXPInRange = levelInfo.maxPts === 999999 ? 100 : totalLifetimeXP - levelInfo.minPts;
  const xpBarRatio = getMappedXPRatio(totalLifetimeXP);

  // --- STATS FOR SELECTED DATE ---
  const selectedDateCompletions = completions.filter((c) => c.date === selectedDate);
  const selectedDateXP = selectedDateCompletions.reduce((accum, comp) => {
    const h = habits.find((habit) => habit.id === comp.habitId);
    return accum + (h ? h.pts : 0);
  }, 0);

  // --- FILTER PERIODS ENGINE ---
  const handleFilterClick = (type: 'semana' | 'mes' | 'tudo') => {
    setFilterType(type);
    const baseDate = new Date();
    
    if (type === 'semana') {
      const day = baseDate.getDay();
      const diffSinceMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() - diffSinceMonday);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      setFilterStartDate(monday.toISOString().split('T')[0]);
      setFilterEndDate(sunday.toISOString().split('T')[0]);
    } else if (type === 'mes') {
      const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

      setFilterStartDate(firstDay.toISOString().split('T')[0]);
      setFilterEndDate(lastDay.toISOString().split('T')[0]);
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setFilterStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setFilterEndDate(getTodayStr());
    }
  };

  const handleCustomStartDateChange = (val: string) => {
    setFilterType('personalizado');
    setFilterStartDate(val);
  };

  const handleCustomEndDateChange = (val: string) => {
    setFilterType('personalizado');
    setFilterEndDate(val);
  };

  // --- STATS EARNED WITHIN SELECTED RANGE ---
  const rangeCompletions = completions.filter(
    (c) => c.date >= filterStartDate && c.date <= filterEndDate
  );
  
  const rangeXP = rangeCompletions.reduce((accum, comp) => {
    const h = habits.find((tab) => tab.id === comp.habitId);
    return accum + (h ? h.pts : 0);
  }, 0);

  // --- INTERACTION ACTIONS ---
  const handleToggleHabit = async (habit: Habit) => {
    if (!user) return;
    const exists = completions.find((c) => c.habitId === habit.id && c.date === selectedDate);
    
    if (exists) {
      // Remove
      const updatedCompletions = completions.filter((c) => c.id !== exists.id);
      setCompletions(updatedCompletions);
      await deleteCompletion(user.uid, exists.id);
      triggerToast(`Progresso desfeito: -${habit.pts} XP`);
    } else {
      // Add
      const newCompletion: Completion = {
        id: 'comp-' + Date.now().toString() + '-' + Math.round(Math.random() * 100),
        habitId: habit.id,
        date: selectedDate,
      };
      const updatedCompletions = [...completions, newCompletion];
      setCompletions(updatedCompletions);
      await saveCompletion(user.uid, newCompletion);
      triggerToast(`+${habit.pts} XP — ${habit.emoji} ${habit.name}! 🔥`);
    }
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    if (!user) return;
    e.preventDefault();
    if (!newHabitName.trim()) {
      triggerToast('O nome do hábito é obrigatório.');
      return;
    }

    const newHabit: Habit = {
      id: 'habit-' + Date.now().toString(),
      name: newHabitName.trim(),
      emoji: newHabitEmoji.trim() || '💡',
      description: newHabitDescription.trim(),
      pts: Number(newHabitPts) || 15,
      color: newHabitColor,
      createdAt: selectedDate,
    };

    const updatedHabits = [...habits, newHabit];
    setHabits(updatedHabits);
    await saveHabit(user.uid, newHabit);
    
    setNewHabitName('');
    setNewHabitDescription('');
    setShowAddForm(false);
    triggerToast(`Hábito "${newHabit.name}" criado com sucesso! 💎`);
  };

  const handleDeleteHabit = async (id: string, name: string) => {
    if (!user) return;
    const confirm = window.confirm(`Deseja realmente remover o hábito: "${name}"? Todo o histórico de pontuações dele será deletado do seu perfil.`);
    if (!confirm) return;

    const updatedHabits = habits.filter((h) => h.id !== id);
    const updatedComplets = completions.filter((c) => c.habitId !== id);
    const updatedNotes = habitNotes.filter((n) => n.habitId !== id);

    setHabits(updatedHabits);
    setCompletions(updatedComplets);
    setHabitNotes(updatedNotes);
    
    await deleteHabit(user.uid, id);
    triggerToast(`Hábito "${name}" foi removido.`);
  };

  const handleSaveHabitDailyNote = async (habitId: string, date: string, text: string) => {
    if (!user) return;
    const existing = habitNotes.find((n) => n.habitId === habitId && n.date === date);

    if (!text.trim()) {
      if (existing) {
        await handleDeleteHabitDailyNote(existing.id);
      }
      return;
    }

    const noteObj: HabitNote = {
      id: existing ? existing.id : `note-${habitId}-${date}-${Math.random().toString(36).substring(2, 7)}`,
      habitId,
      date,
      note: text.trim(),
      updatedAt: new Date().toISOString(),
    };

    const updated = existing
      ? habitNotes.map((n) => (n.id === noteObj.id ? noteObj : n))
      : [...habitNotes, noteObj];

    setHabitNotes(updated);
    await saveHabitNote(user.uid, noteObj);
    triggerToast('Anotação diária registrada com sucesso! ✍️');
  };

  const handleDeleteHabitDailyNote = async (noteId: string) => {
    if (!user) return;
    const updated = habitNotes.filter((n) => n.id !== noteId);
    setHabitNotes(updated);
    await deleteHabitNote(user.uid, noteId);
    triggerToast('Anotação diária removida.');
  };

  const handleStartEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setEditName(habit.name);
    setEditEmoji(habit.emoji);
    setEditDescription(habit.description);
    setEditPts(habit.pts);
    setEditColor(habit.color);
  };

  const handleUpdateHabit = async (e: React.FormEvent) => {
    if (!user || !editingHabit) return;
    e.preventDefault();
    if (!editName.trim()) {
      triggerToast('O nome do hábito é obrigatório.');
      return;
    }

    const updatedHabit: Habit = {
      ...editingHabit,
      name: editName.trim(),
      emoji: editEmoji.trim() || '💡',
      description: editDescription.trim(),
      pts: Number(editPts) || 15,
      color: editColor,
    };

    const updatedHabits = habits.map((h) => h.id === editingHabit.id ? updatedHabit : h);
    setHabits(updatedHabits);
    await saveHabit(user.uid, updatedHabit);
    
    setEditingHabit(null);
    triggerToast(`Hábito "${updatedHabit.name}" atualizado de forma segura! ⚙️`);

    // Force updates on opened detail modals
    if (selectedHabitForDetail && selectedHabitForDetail.id === editingHabit.id) {
      setSelectedHabitForDetail(updatedHabit);
    }
  };

  // --- LOADING AUTH STATE RENDER ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-slate-100 font-sans">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7fff6e] to-[#3dffc3] flex items-center justify-center font-bold text-[#0a0a0f] text-2xl font-display shadow-lg shadow-[#7fff6e]/20"
        >
          VI
        </motion.div>
        <p className="mt-4 font-mono text-xs text-slate-400 tracking-wider">Iniciando painel VIVO...</p>
      </div>
    );
  }

  // --- UNAUTHENTICATED LOGIN SCREEN RENDER ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col justify-between p-6 relative font-sans leading-relaxed overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#7fff6e]/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#3dffc3]/5 blur-[120px] pointer-events-none" />

        {/* Top Header */}
        <div className="max-w-4xl w-full mx-auto flex justify-between items-center py-4 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7fff6e] to-[#3dffc3] flex items-center justify-center font-bold text-[#0a0a0f] text-sm font-display tracking-tight">
              VI
            </div>
            <span className="text-sm font-black font-display tracking-wider text-white">VIVO</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 bg-[#161626] px-2.5 py-1 rounded border border-white/5 uppercase">
            Psicoterapia & Rotinas
          </span>
        </div>

        {/* Main Pitch Card Container */}
        <div className="max-w-md w-full mx-auto my-auto z-10 text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-display uppercase">
              Monitore seus <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7fff6e] to-[#3dffc3] drop-shadow-[0_0_15px_rgba(127,255,110,0.3)]">
                Hábitos Diários
              </span>
            </h1>
            <p className="text-slate-400 text-sm max-w-sm mx-auto font-sans leading-relaxed">
              O rastreador pessoal "VIVO" ajuda a monitorar sua rotina ativa, acumular pontos, subir de nível e gerar relatórios visuais precisos para suas sessões com o psicólogo.
            </p>
          </div>

          {/* Seed Preview Visual Cards */}
          <div className="bg-[#12121e] border border-[#232338] rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-white/5 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              <span>HÁBITOS DE SUPORTE DIURNO</span>
              <span className="text-[#7fff6e]">Seed padrão</span>
            </div>
            <div className="flex gap-2 items-center text-xs">
              <span className="text-lg">☀️</span>
              <div className="flex-1">
                <p className="font-bold text-slate-200">Acordar no horário</p>
                <p className="text-[10px] text-slate-500">Levantar cedo</p>
              </div>
              <span className="font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded text-slate-400">+15 XP</span>
            </div>
            <div className="flex gap-2 items-center text-xs">
              <span className="text-lg">🏃</span>
              <div className="flex-1">
                <p className="font-bold text-slate-200">Caminhar / Alongamento</p>
                <p className="text-[10px] text-slate-400">Mínimo 20 minutos</p>
              </div>
              <span className="font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded text-slate-400">+20 XP</span>
            </div>
          </div>

          {/* Interactivity Auth Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-[#141424] hover:bg-[#1a1a2e] border border-[#3dffc3]/30 hover:border-[#3dffc3] text-white font-mono text-xs font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-[#3dffc3]/5 focus:outline-none"
            >
              <LogIn className="w-4 h-4 text-[#3dffc3]" />
              <span>LOGAR COM CONTA GOOGLE</span>
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-600 flex items-center justify-center gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5" />
            <span>Dados criptografados e salvos em nuvem de forma privada.</span>
          </div>

        </div>

        {/* Footer */}
        <p className="text-[10px] font-mono text-slate-600 text-center mt-auto z-10 select-none">
          VIVO Applet • Desenvolvido com Firebase Auth & Cloud Firestore
        </p>

      </div>
    );
  }

  // --- AUTHENTICATED CORE DASHBOARD RENDER ---
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col relative font-sans leading-relaxed select-none pb-12">
      
      {/* Toast Feedback Drawer */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.8, x: 100 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 50 }}
              className="bg-[#11111a]/95 border border-[#3dffc3] shadow-lg shadow-[#3dffc3]/10 text-xs text-white p-3.5 rounded-xl font-mono flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#3dffc3]" />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* FIXED NAVBAR */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1b1b2d] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7fff6e] to-[#3dffc3] flex items-center justify-center font-bold text-[#0a0a0f] text-lg font-display tracking-tight shadow-md">
            VI
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white font-display">
              VIVO <span className="text-[9px] font-mono font-medium text-slate-500 bg-[#161626] px-1.5 py-0.5 rounded border border-white/5 tracking-normal uppercase">ONLINE DB</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">Psicoterapia & Rotina</p>
          </div>
        </div>

        {/* User Info & Signout and level Badging */}
        <div className="flex items-center gap-3">
          {/* Level Badging Badge */}
          <div className="bg-[#10101b] border border-[#ffd166]/20 bg-gradient-to-r from-[#ffd166]/5 to-transparent px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-[#ffd166] animate-pulse" />
            <div className="text-right">
              <div className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest">Nível {levelInfo.level}</div>
              <div className="text-xs font-bold text-[#ffd166] font-display">{levelInfo.title}</div>
            </div>
          </div>

          {/* User Account avatar profile dropdown */}
          <div className="flex items-center gap-2.5 bg-[#141424] border border-[#25253e] py-1 pl-2.5 pr-2.5 rounded-xl">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'Photo'} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#3dffc3] text-[#0a0a0f] font-bold text-xs flex items-center justify-center">
                {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-[10px] font-black text-slate-200 capitalize truncate max-w-[100px]">
                {user.displayName || 'Usuário'}
              </p>
              <p className="text-[8px] font-mono text-slate-500 truncate max-w-[100px]">{user.email || 'Conectado'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Encerrar Sessão"
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition focus:outline-none"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* CORE WRAPPED LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-6 flex flex-col gap-6">

        {/* LOADING DATA BLOCK SPINNER */}
        {dataLoading && (
          <div className="order-1 lg:order-none bg-[#12121e] border border-[#222238] px-4 py-2 text-center rounded-xl font-mono text-[11px] text-[#3dffc3] flex items-center justify-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#3dffc3] animate-bounce" />
            <span>Sincronizando com Firestore cloud database...</span>
          </div>
        )}

        {/* STATS HERO (3 Cards) */}
        <div className="order-3 lg:order-none grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Day Score Tracker */}
          <div className="bg-[#11111a] border border-[#1f1f32] p-4 rounded-xl flex flex-col justify-between relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#3dffc3]/5 rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] tracking-wider uppercase text-slate-400 font-mono">Foco no Dia</p>
                <p className="text-xs font-mono font-semibold text-slate-500 mt-1">
                  {selectedDate === getTodayStr() ? `Hoje (${new Date().getDate()} de ${['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][new Date().getMonth()]})` : selectedDate.split('-').reverse().join('/')}
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded text-[#3dffc3] bg-[#3dffc3]/15">STATUS</span>
            </div>
            
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white tracking-tighter">
                {selectedDateXP}
              </span>
              <span className="text-xs text-slate-400 font-mono">pts hoje</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-405">
              {selectedDateCompletions.length} de {habits.length} hábitos marcados.
            </div>
          </div>

          {/* Filtering Metrics Cumulative Range */}
          <div className="bg-[#11111a] border border-[#1f1f32] p-4 rounded-xl flex flex-col justify-between relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#7fff6e]/5 rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] tracking-wider uppercase text-slate-400 font-mono">Foco no Período</p>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  {filterStartDate.split('-').slice(1).reverse().join('/')} até {filterEndDate.split('-').slice(1).reverse().join('/')}
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded text-[#7fff6e] bg-[#7fff6e]/15 uppercase">
                {filterType}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-[#7fff6e] tracking-tighter">
                {rangeXP}
              </span>
              <span className="text-xs text-slate-400 font-mono">pts obtidos</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-405">
              {rangeCompletions.length} check-ins válidos no período.
            </div>
          </div>

          {/* Core Streaks Hero metrics */}
          <div className="bg-[#11111a] border border-[#1f1f32] p-4 rounded-xl flex flex-col justify-between relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#ffd166]/5 rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] tracking-wider uppercase text-slate-400 font-mono">Sequência Geral</p>
                <p className="text-xs font-mono font-semibold text-slate-500 mt-1">Consistency Streak</p>
              </div>
              <Flame className="w-5 h-5 text-[#ffd166] drop-shadow-[0_0_8px_#ffd16644] animate-bounce" />
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-[#ffd166] tracking-tighter">
                {calculateGeneralStreak()}
              </span>
              <span className="text-xs text-slate-400 font-mono">dias seguidos</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-455">
              Considera dias com pelo menos 1 hábito feito.
            </div>
          </div>

        </div>

        {/* PROGRESS BAR BARRA XP CONTAINER */}
        <div className="order-4 lg:order-none bg-[#11111a] border border-[#1f1f32] p-4 rounded-xl flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5 font-mono">
            <div className="text-slate-300">
              XP Total Acumulado: <span className="text-white font-bold">{totalLifetimeXP} pts</span>
            </div>
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              {levelInfo.maxPts === 999999 ? (
                <span>Parabéns! Você alcançou o ranking máximo de Elite! 🔥</span>
              ) : (
                <>
                  <span>Nível seguinte em: <strong className="text-[#ffd166]">{(levelInfo.maxPts - totalLifetimeXP)} pts</strong></span>
                  <span className="text-slate-500 bg-[#171725] px-2 py-0.5 rounded text-[10px]">
                    Nível {levelInfo.level + 1}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Outer track */}
          <div className="w-full h-3 rounded-full bg-[#181829] overflow-hidden p-[2px]">
            {/* Inner responsive bar */}
            <div
              className="h-full rounded-full shimmer-progress transition-all duration-700 ease-out shadow-[0_0_12px_rgba(127,255,110,0.5)]"
              style={{ width: `${xpBarRatio}%` }}
            />
          </div>

          {/* Level guidelines overview bar */}
          <div className="grid grid-cols-7 text-[8px] sm:text-[9px] font-mono text-slate-500 text-center uppercase tracking-tighter sm:tracking-normal mt-0.5">
            <div>Inic. (0+)</div>
            <div>Ativo (100+)</div>
            <div>Discip. (300+)</div>
            <div>Focado (700+)</div>
            <div>Resil. (1500+)</div>
            <div>Consist. (3000+)</div>
            <div>Elite (6000+)</div>
          </div>
        </div>

        {/* PERIOD FILTERS CONTAINER */}
        <div className="order-2 lg:order-none bg-[#11111a] border border-[#1f1f32] p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#3dffc3]" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Filtros de Relatório</h4>
          </div>

          {/* Range quick selections */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="bg-[#171726] border border-[#26263e] p-1 rounded-xl flex gap-1 w-full sm:w-auto justify-between">
              <button
                onClick={() => handleFilterClick('semana')}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg font-bold transition flex-grow sm:flex-grow-0 ${
                  filterType === 'semana' ? 'bg-[#3dffc3] text-[#0a0a0f]' : 'text-slate-400 hover:text-slate-200 hover:bg-[#202035]'
                }`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => handleFilterClick('mes')}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg font-bold transition flex-grow sm:flex-grow-0 ${
                  filterType === 'mes' ? 'bg-[#3dffc3] text-[#0a0a0f]' : 'text-slate-400 hover:text-slate-200 hover:bg-[#202035]'
                }`}
              >
                Este Mês
              </button>
              <button
                onClick={() => handleFilterClick('tudo')}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg font-bold transition flex-grow sm:flex-grow-0 ${
                  filterType === 'tudo' ? 'bg-[#3dffc3] text-[#0a0a0f]' : 'text-slate-400 hover:text-slate-200 hover:bg-[#202035]'
                }`}
              >
                Tudo
              </button>
            </div>

            {/* Custom calendars */}
            <div className="flex items-center gap-2 text-xs font-mono w-full sm:w-auto mt-2 sm:mt-0">
              <div className="flex items-center gap-1.5 bg-[#171726] border border-[#26263e] px-2 rounded-lg py-1 flex-1">
                <span className="text-slate-500">De:</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => handleCustomStartDateChange(e.target.value)}
                  className="bg-transparent text-slate-200 text-[11px] focus:outline-none focus:text-[#3dffc3] w-full"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[#171726] border border-[#26263e] px-2 rounded-lg py-1 flex-1">
                <span className="text-slate-500">Até:</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => handleCustomEndDateChange(e.target.value)}
                  className="bg-transparent text-slate-200 text-[11px] focus:outline-none focus:text-[#3dffc3] w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PRIMARY MAIN DASHBOARD GRID */}
        <div className="order-5 lg:order-none grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: HABITS LIST CHECKLIST (Full check-offs) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Mobile-only Navigable monthly calendar (Foco Mensal) */}
            <div className="block lg:hidden">
              <CalendarCard
                habits={habits}
                completions={completions}
                notes={habitNotes}
                selectedDateStr={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-display text-white tracking-wide">
                  Seus Hábitos
                </h2>
                <p className="text-[10px] text-slate-404 font-mono mt-0.5">
                  Marcando hábitos para o dia: <strong className="text-[#3dffc3]">{selectedDate.split('-').reverse().join('/')}</strong>
                </p>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-[#171726] hover:bg-[#25253a] text-[#3dffc3] border border-[#3dffc3]/20 hover:border-[#3dffc3]/40 p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-mono focus:outline-none"
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showAddForm ? 'Cancelar' : 'Novo Hábito'}</span>
              </button>
            </div>

            {/* COLLAPSIBLE ADD HABIT DRAWER */}
            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateHabit}
                  className="bg-[#131320] border border-[#292942] rounded-xl p-5 overflow-hidden shadow-xl space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-[#222238]">
                    <Sparkles className="w-4 h-4 text-[#7fff6e]" />
                    <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">Configurar Novo Hábito</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Nome do Hábito *</label>
                      <input
                        type="text"
                        placeholder="Ex: Beber 2L de água, Meditar"
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        className="w-full bg-[#1c1c2e] border border-[#2d2d46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3dffc3] placeholder-slate-550"
                      />
                    </div>

                    {/* Emoji */}
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Emoji/Ícone</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={2}
                          value={newHabitEmoji}
                          onChange={(e) => setNewHabitEmoji(e.target.value)}
                          className="w-14 bg-[#1c1c2e] border border-[#2d2d46] rounded-lg p-2 text-center text-lg focus:outline-none focus:border-[#3dffc3]"
                        />
                        <div className="flex flex-wrap gap-1">
                          {['🧘', '🏃', '☀️', '🌙', '📚', '⚡', '💧', '🍏', '🤝', '✍️', '🦷'].map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => setNewHabitEmoji(e)}
                              className={`p-1 text-sm bg-[#1c1c2e] hover:bg-[#2d2d46] rounded transition ${
                                newHabitEmoji === e ? 'border border-[#3dffc3]' : ''
                              }`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Descrição curta</label>
                      <input
                        type="text"
                        placeholder="Ex: Pelo menos 15 min"
                        value={newHabitDescription}
                        onChange={(e) => setNewHabitDescription(e.target.value)}
                        className="w-full bg-[#1c1c2e] border border-[#2d2d46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3dffc3]"
                      />
                    </div>

                    {/* Difficulty Score */}
                    <div>
                      <label className="block text-[10px] font-mono text-slate-405 uppercase tracking-widest mb-1.5 flex justify-between">
                        <span>XP Customizado (1 a 100)</span>
                        <strong className="text-[#3dffc3]">{newHabitPts} pts</strong>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={newHabitPts}
                          onChange={(e) => setNewHabitPts(Number(e.target.value))}
                          className="w-full accent-[#3dffc3] bg-[#1c1c2e]"
                        />
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={newHabitPts}
                          onChange={(e) => setNewHabitPts(Math.min(100, Math.max(1, Number(e.target.value))))}
                          className="w-14 bg-[#1c1c2e] border border-[#2d2d46] rounded-lg p-1.5 text-center text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset color pickers */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Cor Tema do Hábito</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={newHabitColor}
                        onChange={(e) => setNewHabitColor(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <div className="flex flex-wrap gap-2">
                        {['#7fff6e', '#3dffc3', '#ffd166', '#bf5fff', '#ff5a5f', '#ff7f50', '#a0522d'].map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setNewHabitColor(col)}
                            className="w-6 h-6 rounded-full border border-white/10 relative transition hover:opacity-80"
                            style={{ backgroundColor: col }}
                          >
                            {newHabitColor === col && (
                              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[#0a0a0f]">&bull;</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submission actions */}
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 rounded-lg bg-transparent hover:bg-[#1a1a2e] text-slate-400 text-xs font-mono transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-[#3dffc3] hover:bg-[#2fdca6] text-[#0a0a0f] text-xs font-mono font-bold transition shadow-lg shadow-[#3dffc3]/20"
                    >
                      Gravar Hábito
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* HABITS GRID WRAPPER */}
            {habits.length === 0 ? (
              <div className="bg-[#11111a] border border-[#1f1f32] p-8 text-center rounded-xl flex flex-col items-center justify-center">
                <Info className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm text-slate-400 font-mono">Sem hábitos cadastrados para hoje.</p>
                <p className="text-xs text-slate-500 mt-1">Clique em "Novo Hábito" para registrar seus focos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {habits.map((habit) => {
                  const isChecked = completions.some((c) => c.habitId === habit.id && c.date === selectedDate);
                  const individualStreak = getHabitStreak(habit.id);
                  const currentDailyNote = habitNotes.find((n) => n.habitId === habit.id && n.date === selectedDate);

                  return (
                    <div
                      key={habit.id}
                      className="bg-[#11111a] hover:bg-[#151523] border border-[#1f1f3a]/80 shadow rounded-xl p-4 flex flex-col relative group transition duration-150 overflow-hidden"
                      style={{ borderTop: `3px solid ${habit.color || '#3dffc3'}` }}
                    >
                      <div className="flex items-center justify-between w-full">
                        {/* Left: Check and details */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0 mr-2">
                          {/* Interactive custom Check circle */}
                          <button
                            onClick={() => handleToggleHabit(habit)}
                            className="flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition focus:outline-none"
                            style={{
                              borderColor: isChecked ? habit.color : '#2d2d46',
                              backgroundColor: isChecked ? `${habit.color}20` : 'transparent',
                            }}
                          >
                            {isChecked && <Check className="w-4 h-4" style={{ color: habit.color }} />}
                          </button>

                          <div className="min-w-0">
                            {/* Title with detail click */}
                            <button
                              onClick={() => setSelectedHabitForDetail(habit)}
                              className="font-bold text-sm text-slate-100 font-display flex items-center gap-1.5 hover:underline focus:outline-none shrink-0"
                            >
                              <span>{habit.emoji}</span>
                              <span className="truncate text-left text-white">{habit.name}</span>
                            </button>
                            
                            <p className="text-[11px] text-slate-400 truncate">
                              {habit.description || <span className="italic text-slate-600 font-mono">sem descrição</span>}
                            </p>
                          </div>
                        </div>

                        {/* Right: Scores, Streak counters, daily note button, quick edits/deletes */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Daily Note Button */}
                          <button
                            title={currentDailyNote ? "Ver/Editar anotação diária" : "Fazer anotação para este dia"}
                            onClick={() => setActiveDailyNoteModal({ habit, date: selectedDate })}
                            className={`p-2 rounded-lg border transition flex items-center gap-1 text-xs font-mono ${
                              currentDailyNote
                                ? 'bg-[#ffd166]/15 text-[#ffd166] border-[#ffd166]/40 hover:bg-[#ffd166]/25'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-[#1a1a2e] border-transparent'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            {currentDailyNote && (
                              <span className="hidden sm:inline text-[10px] font-bold">Nota</span>
                            )}
                          </button>

                          {/* Streak Fire indicator */}
                          {individualStreak > 0 && (
                            <div className="flex items-center gap-1 bg-[#ff5a5f]/10 border border-[#ff5a5f]/20 px-2 py-0.5 rounded-lg text-[#ff5a5f] font-mono text-[10px] font-bold">
                              <Flame className="w-3 h-3 text-[#ff5a5f]" />
                              <span>{individualStreak}d</span>
                            </div>
                          )}

                          {/* Difficulty Points Badge */}
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold bg-[#131322] border border-white/5 opacity-80 rounded-lg px-2 py-1 select-none text-slate-350">
                              +{habit.pts} XP
                            </span>
                          </div>

                          {/* Actions drop menu */}
                          <button
                            title="Editar Hábito"
                            onClick={() => handleStartEditHabit(habit)}
                            className="lg:opacity-0 lg:group-hover:opacity-100 hover:bg-amber-500/15 hover:text-amber-400 p-2 rounded-lg text-slate-500 hover:border-amber-500/30 border border-transparent transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            title="Remover Hábito"
                            onClick={() => handleDeleteHabit(habit.id, habit.name)}
                            className="lg:opacity-0 lg:group-hover:opacity-100 hover:bg-[#ff5a5f]/15 hover:text-white p-2 rounded-lg text-slate-500 hover:border-[#ff5a5f]/30 border border-transparent transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Daily Note Excerpt preview box */}
                      {currentDailyNote && (
                        <div
                          onClick={() => setActiveDailyNoteModal({ habit, date: selectedDate })}
                          className="mt-3 pt-2.5 border-t border-[#1b1b2d] flex items-start gap-2 text-xs cursor-pointer group/note hover:opacity-90 transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#ffd166] shrink-0 mt-0.5" />
                          <p className="text-slate-300 text-[11px] font-sans italic line-clamp-2 leading-relaxed flex-1">
                            "{currentDailyNote.note}"
                          </p>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 group-hover/note:text-[#ffd166] underline">
                            Editar nota
                          </span>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

            {/* Disclaimer Help Box */}
            <div className="bg-[#10101b] border border-[#2d2f40]/50 p-3 rounded-xl flex items-start gap-2.5 mt-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="text-[11px] font-mono text-slate-400">
                <span className="text-[#3dffc3] font-bold">Dados em Nuvem</span>: Seus hábitos, anotações diárias e histórico de evolução agora são mantidos de forma 100% segura e sincronizada na nuvem com o banco de dados Firebase Firestore.
              </div>
            </div>

          </div>

          {/* RIGHT: SIDEBAR (Calendar card & Realtime Canvas graphs) */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-6">
            
            {/* Navigable monthly calendar */}
            <div className="hidden lg:block">
              <CalendarCard
                habits={habits}
                completions={completions}
                notes={habitNotes}
                selectedDateStr={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
              />
            </div>

            {/* Relational reports graphs metrics */}
            <div className="bg-[#11111a] border border-[#1f1f32] p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d2f40]">
                <h3 className="font-bold font-display text-sm text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#7fff6e]" />
                  Análise de Evolução
                </h3>
                <span className="text-[9px] font-mono text-slate-500 bg-[#0d0d14] px-2 py-0.5 rounded border border-white/5">
                  Live Canvas Rendering
                </span>
              </div>

              {/* Graphic canvases mapping */}
              <CanvasBarChart
                habits={habits}
                completions={completions}
                startDateStr={filterStartDate}
                endDateStr={filterEndDate}
              />
            </div>

          </div>

        </div>

      </main>

      {/* CORE HABIT DETAIL DIALOG MODAL */}
      {selectedHabitForDetail && (
        <HabitDetailModal
          habit={selectedHabitForDetail}
          completions={completions}
          notes={habitNotes}
          onOpenDailyNote={(habit, date) => setActiveDailyNoteModal({ habit, date })}
          onClose={() => setSelectedHabitForDetail(null)}
        />
      )}

      {/* DAILY NOTE MODAL */}
      {activeDailyNoteModal && (
        <DailyNoteModal
          habit={activeDailyNoteModal.habit}
          date={activeDailyNoteModal.date}
          existingNote={habitNotes.find(
            (n) => n.habitId === activeDailyNoteModal.habit.id && n.date === activeDailyNoteModal.date
          )}
          allHabitNotes={habitNotes}
          onSaveNote={handleSaveHabitDailyNote}
          onDeleteNote={handleDeleteHabitDailyNote}
          onClose={() => setActiveDailyNoteModal(null)}
        />
      )}

      {/* EDIT HABIT DIALOG MODAL */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={handleUpdateHabit}
            className="relative w-full max-w-xl bg-[#0d0d14] border border-[#22223a] rounded-2xl overflow-hidden shadow-2xl space-y-4"
          >
            <div className="h-1.5 w-full" style={{ backgroundColor: editColor }} />
            
            <div className="p-6 pb-0 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold font-display text-white uppercase tracking-wider">Editar Hábito</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Modificando dados essenciais do hábito</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingHabit(null)}
                className="p-1 px-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#2e2e46] text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Nome do Hábito *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Beber 2L de água, Meditar"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#1c1c2e] border border-[#2d2d46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3dffc3]"
                  />
                </div>

                {/* Emoji */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Emoji/Ícone</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      className="w-12 bg-[#1c1c2e] border border-[#2d2d46] rounded-lg p-2 text-center text-base focus:outline-none focus:border-[#3dffc3]"
                    />
                    <div className="flex flex-wrap gap-1">
                      {['🧘', '🏃', '☀️', '🌙', '📚', '⚡', '💧', '🍏', '🤝', '✍️', '🦷'].map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setEditEmoji(e)}
                          className={`p-1 text-sm bg-[#1c1c2e] hover:bg-[#2d2d46] rounded transition ${
                            editEmoji === e ? 'border border-[#3dffc3]' : ''
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Descrição curta</label>
                  <input
                    type="text"
                    placeholder="Ex: Pelo menos 15 min"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-[#1c1c2e] border border-[#2d2d46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3dffc3]"
                  />
                </div>

                {/* Difficulty Score */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                    <span>XP Customizado (1 a 100)</span>
                    <strong className="text-amber-400">{editPts} pts</strong>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={editPts}
                      onChange={(e) => setEditPts(Number(e.target.value))}
                      className="w-full accent-[#3dffc3] bg-[#1c1c2e]"
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editPts}
                      onChange={(e) => setEditPts(Math.min(100, Math.max(1, Number(e.target.value))))}
                      className="w-14 bg-[#1c1c2e] border border-[#2d2d46] rounded-lg p-1.5 text-center text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Preset color pickers */}
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Cor Tema do Hábito</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['#7fff6e', '#3dffc3', '#ffd166', '#bf5fff', '#ff5a5f', '#ff7f50', '#a0522d'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setEditColor(col)}
                        className="w-6 h-6 rounded-full border border-white/10 relative transition hover:opacity-80"
                        style={{ backgroundColor: col }}
                      >
                        {editColor === col && (
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[#0a0a0f]">&bull;</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-[#12121e] border border-[#22223a] p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{editEmoji}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{editName || 'Nome do Hábito'}</h4>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{editDescription || 'Sem descrição'}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${editColor}15`, color: editColor, border: `1px solid ${editColor}30` }}>
                  +{editPts} XP
                </span>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1b1b2f]">
                <button
                  type="button"
                  onClick={() => setEditingHabit(null)}
                  className="bg-[#171726] hover:bg-[#222236] text-slate-400 border border-white/5 py-2 px-4 rounded-xl transition text-xs font-mono"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-[#0a0a0f] py-2 px-5 rounded-xl transition text-xs font-mono font-bold flex items-center gap-1"
                >
                  <span>Salvar Alterações</span>
                </button>
              </div>

            </div>
          </motion.form>
        </div>
      )}

    </div>
  );
}
