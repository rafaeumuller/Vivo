import React, { useRef, useEffect } from 'react';
import { X, Flame, Trophy, Calendar, CheckCircle, FileText, Plus, Clock } from 'lucide-react';
import { Habit, Completion, HabitNote } from '../types';

interface HabitDetailModalProps {
  habit: Habit;
  completions: Completion[];
  notes?: HabitNote[];
  onOpenDailyNote?: (habit: Habit, date: string) => void;
  onClose: () => void;
}

export const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  habit,
  completions,
  notes = [],
  onOpenDailyNote,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter completions for this habit
  const habitCompletions = completions.filter((c) => c.habitId === habit.id);
  const habitNotes = notes
    .filter((n) => n.habitId === habit.id && n.note.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  // 1. Calculate General Numbers
  const totalCheckins = habitCompletions.length;
  const totalXPGenerated = totalCheckins * habit.pts;

  // 2. Calculate current streak for this habit
  const calculateStreak = (): number => {
    if (totalCheckins === 0) return 0;
    
    // Sort completions in descending order by date
    const uniqueDates = Array.from(new Set(habitCompletions.map((c) => c.date))).sort().reverse();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If no completion today AND none yesterday, streak is 0
    if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let currentCheckDate = uniqueDates.includes(todayStr) ? todayStr : yesterdayStr;

    // Work backwards
    const dateCursor = new Date(currentCheckDate + 'T12:00:00');
    
    while (true) {
      const cursorStr = dateCursor.toISOString().split('T')[0];
      if (uniqueDates.includes(cursorStr)) {
        streak++;
        // Move back 1 day
        dateCursor.setDate(dateCursor.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const streak = calculateStreak();

  // Helper: Get list of YYYY-MM-DD for last N days ending today
  const getLastNDays = (n: number) => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  };

  const last28Days = getLastNDays(28);
  const last30Days = getLastNDays(30);

  // 3. Render 30-Day Activity Line Chart on a custom Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Dark grey background
    ctx.fillStyle = '#11111a';
    ctx.fillRect(0, 0, width, height);

    // Margins
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Cumulative points chart over 30 days
    const completedDatesSet = new Set(habitCompletions.map((c) => c.date));
    
    let cumulativeSum = 0;
    const pointsData = last30Days.map((date) => {
      if (completedDatesSet.has(date)) {
        cumulativeSum += habit.pts;
      }
      return cumulativeSum;
    });

    const maxPts = Math.max(...pointsData, habit.pts * 2);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#8f92a1';
    ctx.font = '8px "Space Mono", monospace';
    ctx.textAlign = 'right';

    // Horizontal grid
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxPts / 4) * i);
      const y = height - paddingBottom - (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();
      ctx.fillText(`${val}xp`, paddingLeft - 6, y + 3);
    }

    // Coordinates mapping
    const points = pointsData.map((val, index) => {
      const x = paddingLeft + (chartWidth / (last30Days.length - 1)) * index;
      const y = height - paddingBottom - (val / maxPts) * chartHeight;
      return { x, y };
    });

    // Draw line shadow area (glow/gradient)
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, height - paddingBottom);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
      ctx.closePath();

      const fillGradient = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
      fillGradient.addColorStop(0, `${habit.color}30`); // low opacity
      fillGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGradient;
      ctx.fill();

      // Draw Main Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = habit.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw dots for check-in days
      pointsData.forEach((val, idx) => {
        const date = last30Days[idx];
        if (completedDatesSet.has(date)) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = habit.color;
          ctx.lineWidth = 2;
          ctx.shadowColor = habit.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(points[idx].x, points[idx].y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // XAxis labels (Start, Middle, End date)
    ctx.fillStyle = '#8f92a1';
    ctx.textAlign = 'center';
    ctx.font = '8px "Space Mono", monospace';

    const labelDates = [0, Math.floor(last30Days.length / 2), last30Days.length - 1];
    labelDates.forEach((idx) => {
      const dStr = last30Days[idx];
      const parts = dStr.split('-');
      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
      const x = paddingLeft + (chartWidth / (last30Days.length - 1)) * idx;
      ctx.fillText(label, x, height - paddingBottom + 16);
    });

  }, [habit, completions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative w-full max-w-2xl bg-[#0d0d14] border border-[#22223a] rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Style Accent Top Bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: habit.color }} />

        {/* Modal Header */}
        <div className="p-6 flex items-start justify-between border-b border-[#1b1b2f]">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{habit.emoji}</span>
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                {habit.name}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {habit.description || 'Sem descrição cadastrada.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#2e2e46] text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Stats Grid */}
        <div className="p-6 grid grid-cols-3 gap-3">
          <div className="bg-[#11111a] border border-[#1f1f35] rounded-xl p-4 flex flex-col items-center text-center">
            <CheckCircle className="w-6 h-6 text-[#3dffc3] mb-1" />
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
              Total Concluído
            </span>
            <span className="text-xl font-mono font-bold text-white mt-1">
              {totalCheckins}x
            </span>
          </div>

          <div className="bg-[#11111a] border border-[#1f1f35] rounded-xl p-4 flex flex-col items-center text-center">
            <Flame className="w-6 h-6 text-[#ffd166] mb-1" />
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
              Sequência Atual
            </span>
            <span className="text-xl font-mono font-bold text-white mt-1">
              {streak} {streak === 1 ? 'dia' : 'dias'}
            </span>
          </div>

          <div className="bg-[#11111a] border border-[#1f1f35] rounded-xl p-4 flex flex-col items-center text-center">
            <Trophy className="w-6 h-6 text-[#7fff6e] mb-1" />
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
              XP Acumulado
            </span>
            <span className="text-xl font-mono font-bold text-white mt-1">
              +{totalXPGenerated} pts
            </span>
          </div>
        </div>

        {/* Heatmap & Plot Grid */}
        <div className="px-6 pb-6 space-y-6">
          {/* Heatmap Section */}
          <div className="bg-[#11111a] border border-[#1f1f35] p-4 rounded-xl">
            <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Mapa de Frequência (últimos 28 dias)
            </h3>
            
            {/* Sequential Grid */}
            <div className="grid grid-cols-7 gap-2">
              {last28Days.map((date) => {
                const isCompleted = habitCompletions.some((c) => c.date === date);
                const parts = date.split('-');
                const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;

                return (
                  <div
                    key={date}
                    className="relative group flex flex-col items-center justify-center p-2 rounded-lg border border-transparent transition"
                    style={{
                      backgroundColor: isCompleted ? `${habit.color}25` : '#171725',
                      borderColor: isCompleted ? habit.color : 'transparent',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mb-1 transition"
                      style={{
                        backgroundColor: isCompleted ? habit.color : '#333346',
                      }}
                    />
                    <span className="text-[9px] font-mono text-slate-500">
                      {parts[2]}
                    </span>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 bg-[#08080c] border border-[#1f1f35] text-[9px] text-slate-300 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none z-10 whitespace-nowrap">
                      {label}: {isCompleted ? 'Feito ✅' : 'Não feito ❌'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-right text-[9px] font-mono text-slate-500">
              &larr; mais antigo • mais recente &rarr;
            </div>
          </div>

          {/* Line Chart Section */}
          <div className="bg-[#11111a] border border-[#1f1f35] p-4 rounded-xl flex flex-col">
            <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-3 text-left">
              Evolução de XP Acumulado (Últimos 30 dias)
            </h3>
            <div className="relative w-full h-[140px]">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded" />
            </div>
          </div>

          {/* Daily Notes History Section */}
          <div className="bg-[#11111a] border border-[#1f1f35] p-4 rounded-xl flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#3dffc3]" />
                Diário de Anotações Diárias ({habitNotes.length})
              </h3>
              {onOpenDailyNote && (
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    onOpenDailyNote(habit, todayStr);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#3dffc3]/10 hover:bg-[#3dffc3]/20 text-[#3dffc3] text-[11px] font-mono flex items-center gap-1 transition border border-[#3dffc3]/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Anotação de Hoje</span>
                </button>
              )}
            </div>

            {habitNotes.length === 0 ? (
              <div className="py-4 text-center text-slate-500 font-mono text-xs">
                Nenhuma anotação registrada ainda para este hábito.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {habitNotes.map((hn) => (
                  <div
                    key={hn.id}
                    className="bg-[#161626] border border-[#232338] rounded-xl p-3.5 space-y-1.5 hover:border-[#3dffc3]/30 transition"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="text-[#3dffc3] font-bold">
                        {hn.date.split('-').reverse().join('/')}
                      </span>
                      {onOpenDailyNote && (
                        <button
                          type="button"
                          onClick={() => onOpenDailyNote(habit, hn.date)}
                          className="hover:text-white underline text-[10px] text-slate-500"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                    <p className="text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
                      {hn.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
