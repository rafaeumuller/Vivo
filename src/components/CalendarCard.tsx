import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Target, FileText } from 'lucide-react';
import { Habit, Completion, HabitNote } from '../types';

interface CalendarCardProps {
  habits: Habit[];
  completions: Completion[];
  notes?: HabitNote[];
  selectedDateStr: string;
  onSelectDate: (date: string) => void;
}

export const CalendarCard: React.FC<CalendarCardProps> = ({
  habits,
  completions,
  notes = [],
  selectedDateStr,
  onSelectDate,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Days in current month
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate();
  };

  // First day of current month (day of week: 0 to 6)
  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay();
    // Adjust so monday is index 0:
    // Sunday: 0 -> adjusted to 6. Monday: 1 -> adjusted to 0
    return day === 0 ? 6 : day - 1;
  };

  const daysCount = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getDayStatus = (dateStr: string) => {
    const dayCompletions = completions.filter((c) => c.date === dateStr);
    const activeHabits = habits.length;

    if (activeHabits === 0) return 'none';
    if (dayCompletions.length === 0) return 'none';
    if (dayCompletions.length === activeHabits) return 'full';
    return 'partial';
  };

  const renderDays = () => {
    const cells = [];
    const totalSlots = firstDayIndex + daysCount;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Padding empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="h-9 w-full" />);
    }

    // Days slots
    for (let day = 1; day <= daysCount; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = getDayStatus(dayStr);
      const isSelected = selectedDateStr === dayStr;
      const isToday = todayStr === dayStr;
      const hasNotes = notes.some((n) => n.date === dayStr && n.note.trim().length > 0);

      let bgClass = 'bg-[#151522] text-slate-400 hover:bg-[#202035]';
      let borderClass = 'border border-transparent';

      if (status === 'full') {
        bgClass = 'bg-[#143d11] text-[#7fff6e] font-bold hover:bg-[#1a5416] shadow-inner';
      } else if (status === 'partial') {
        bgClass = 'bg-[#7fff6e]/10 text-[#7fff6e] hover:bg-[#7fff6e]/20';
      }

      if (isToday) {
        borderClass = 'border-2 border-[#3dffc3]';
      } else if (isSelected) {
        borderClass = 'border border-white/50';
      }

      cells.push(
        <button
          key={`day-${day}`}
          onClick={() => onSelectDate(dayStr)}
          className={`h-9 w-full flex flex-col items-center justify-center rounded-lg text-xs transition duration-150 ${bgClass} ${borderClass} relative focus:outline-none`}
        >
          {hasNotes && (
            <span
              title="Possui anotação"
              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#ffd166] ring-1 ring-[#11111a]"
            />
          )}
          <span className="font-mono">{day}</span>
          {status === 'full' && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#7fff6e]" />
          )}
          {status === 'partial' && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#3dffc3]/70" />
          )}
        </button>
      );
    }

    return cells;
  };

  return (
    <div className="bg-[#11111a] border border-[#222235] rounded-xl p-4 flex flex-col select-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3dffc3]" />
          Foco Mensal
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg bg-[#1a1a2e] hover:bg-[#2e2e4a] text-slate-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-200 font-mono">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-lg bg-[#1a1a2e] hover:bg-[#2e2e4a] text-slate-400 hover:text-white transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week Day Labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {renderDays()}
      </div>

      {/* Caption */}
      <div className="mt-4 pt-3 border-t border-[#1f1f35] flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-[#7fff6e]/10 border border-[#7fff6e]/30 inline-block" />
          <span>Parcial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-[#143d11] border border-[#7fff6e] inline-block" />
          <span>Feito</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffd166] inline-block" />
          <span>Anotação</span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-[#3dffc3]">
          <span className="w-2 h-2 rounded border border-[#3dffc3] bg-[#11111a] inline-block" />
          <span>Hoje</span>
        </div>
      </div>
    </div>
  );
};
