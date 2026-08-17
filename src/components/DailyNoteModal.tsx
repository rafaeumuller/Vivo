import React, { useState, useEffect } from 'react';
import { X, FileText, Trash2, Check, Clock, History, Sparkles, Calendar } from 'lucide-react';
import { Habit, HabitNote } from '../types';

interface DailyNoteModalProps {
  habit: Habit;
  date: string; // YYYY-MM-DD
  existingNote?: HabitNote | null;
  allHabitNotes?: HabitNote[];
  onSaveNote: (habitId: string, date: string, content: string) => Promise<void> | void;
  onDeleteNote?: (noteId: string) => Promise<void> | void;
  onClose: () => void;
}

export const DailyNoteModal: React.FC<DailyNoteModalProps> = ({
  habit,
  date,
  existingNote,
  allHabitNotes = [],
  onSaveNote,
  onDeleteNote,
  onClose,
}) => {
  const [noteContent, setNoteContent] = useState<string>(existingNote?.note || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setNoteContent(existingNote?.note || '');
  }, [existingNote, date]);

  // Format date display
  const formatDateFriendly = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length !== 3) return dStr;
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    
    const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const dayName = daysOfWeek[dateObj.getDay()];
    const dayNum = parts[2];
    const monthName = months[dateObj.getMonth()];
    const year = parts[0];
    
    return `${dayName}, ${dayNum} de ${monthName} de ${year}`;
  };

  // Filter other notes for this habit
  const pastNotes = allHabitNotes
    .filter((n) => n.habitId === habit.id && n.date !== date && n.note.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveNote(habit.id, date, noteContent.trim());
      onClose();
    } catch (err) {
      console.error('Failed to save habit daily note', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingNote || !onDeleteNote || isDeleting) return;
    if (!window.confirm('Deseja realmente remover a anotação deste dia?')) return;
    
    setIsDeleting(true);
    try {
      await onDeleteNote(existingNote.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete note', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const addSnippet = (snippet: string) => {
    setNoteContent((prev) => {
      if (!prev.trim()) return snippet;
      return `${prev.trim()} • ${snippet}`;
    });
  };

  // Quick suggestion chips
  const suggestions = [
    '🎯 Foco total',
    '⚡ Rendimento alto',
    '⏱️ 20 min completados',
    '💪 Superei a preguiça',
    '💧 Meta batida',
    '🧠 Boa concentração',
    '😴 Cansaço, mas concluído'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-[#0e0e17] border border-[#24243e] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Style Accent Top Bar */}
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: habit.color || '#3dffc3' }} />

        {/* Modal Header */}
        <div className="p-5 flex items-start justify-between border-b border-[#1c1c30] shrink-0">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl border border-white/10 shrink-0"
              style={{ backgroundColor: `${habit.color}18` }}
            >
              {habit.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#3dffc3] font-bold">
                  Anotação Diária
                </span>
              </div>
              <h2 className="text-lg font-bold font-display text-white truncate max-w-[280px] sm:max-w-md">
                {habit.name}
              </h2>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatDateFriendly(date)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#18182a] hover:bg-[#282842] text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Note text field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#3dffc3]" />
                  <span>Como foi seu hábito neste dia?</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  {noteContent.length}/2000 caracteres
                </span>
              </div>

              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Escreva detalhes, reflexões, duração, sensações ou metas atingidas para este hábito hoje..."
                className="w-full bg-[#141422] border border-[#262640] rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#3dffc3] transition resize-none leading-relaxed"
                autoFocus
              />
            </div>

            {/* Quick snippet chips */}
            <div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 mb-1.5">
                <Sparkles className="w-3 h-3 text-[#ffd166]" />
                <span>Sugestões rápidas para adicionar:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSnippet(s)}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#18182a] hover:bg-[#25253e] text-slate-300 hover:text-[#3dffc3] border border-white/5 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Past notes toggle */}
            {pastNotes.length > 0 && (
              <div className="pt-2 border-t border-[#1c1c30]">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between py-2 text-xs font-mono text-slate-400 hover:text-white transition"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#3dffc3]" />
                    Histórico de outras anotações ({pastNotes.length})
                  </span>
                  <span className="text-[10px] text-[#3dffc3]">
                    {showHistory ? 'Ocultar' : 'Exibir histórico'}
                  </span>
                </button>

                {showHistory && (
                  <div className="mt-2 space-y-2 max-h-44 overflow-y-auto pr-1">
                    {pastNotes.map((pn) => (
                      <div
                        key={pn.id}
                        className="bg-[#141424] border border-[#222238] rounded-lg p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span className="text-[#3dffc3] font-bold">
                            {pn.date.split('-').reverse().join('/')}
                          </span>
                          {pn.updatedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(pn.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {pn.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#1c1c30] flex items-center justify-between gap-3">
              <div>
                {existingNote && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-2 rounded-xl bg-[#ff5a5f]/10 hover:bg-[#ff5a5f]/20 text-[#ff5a5f] text-xs font-mono flex items-center gap-1.5 transition border border-[#ff5a5f]/20 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? 'Excluindo...' : 'Remover Anotação'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#18182a] text-slate-400 text-xs font-mono transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (!noteContent.trim() && !existingNote)}
                  className="px-5 py-2 rounded-xl bg-[#3dffc3] hover:bg-[#2fdca6] text-[#0a0a0f] text-xs font-mono font-bold transition shadow-lg shadow-[#3dffc3]/20 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Anotação'}</span>
                </button>
              </div>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};
