import React, { useRef, useEffect } from 'react';
import { Habit, Completion } from '../types';

interface CanvasBarChartProps {
  habits: Habit[];
  completions: Completion[];
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
}

export const CanvasBarChart: React.FC<CanvasBarChartProps> = ({
  habits,
  completions,
  startDateStr,
  endDateStr,
}) => {
  const pointsCanvasRef = useRef<HTMLCanvasElement>(null);
  const freqCanvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to generate list of dates between start and end
  const getDatesInRange = (start: string, end: string) => {
    const dates: string[] = [];
    const curr = new Date(start + 'T12:00:00');
    const last = new Date(end + 'T12:00:00');
    
    // Safety break
    let count = 0;
    while (curr <= last && count < 100) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  };

  // 1st Chart: Points per day for the last 7 days (or selected range)
  useEffect(() => {
    const canvas = pointsCanvasRef.current;
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

    // Clear background
    ctx.fillStyle = '#11111a';
    ctx.fillRect(0, 0, width, height);

    // Get dates in range (defaulting to last 7 days if range is massive, but we can do range filtered)
    // For "Points per Day (Last 7 Days)" as per requirements:
    // "Gráfico de barras: pontos por dia nos últimos 7 dias"
    // Let's compute specifically the last 7 days from TODAY for points chart, or respect the custom filter if "Esta semana" / "Este mês" / "Tudo" is used.
    // Let's filter dates within the range.
    const allDates = getDatesInRange(startDateStr, endDateStr);
    // If range is empty or extremely long, let's limit it to a reasonable count for display, say last 10 days, or if it is exactly 7, 7.
    // Let's take the last 7 items if "Tudo" or "Este mês" is selected to avoid cluttering, or just render what fits.
    const displayedDates = allDates.slice(-10); // Display up to last 10 dates for points chart, or 7 if exactly 7

    // Calculate points per day
    const pointsMap: { [date: string]: number } = {};
    displayedDates.forEach((d) => {
      pointsMap[d] = 0;
    });

    completions.forEach((c) => {
      if (pointsMap[c.date] !== undefined) {
        const habit = habits.find((h) => h.id === c.habitId);
        if (habit) {
          pointsMap[c.date] += habit.pts;
        }
      }
    });

    const maxPoints = Math.max(...Object.values(pointsMap), 50); // Min y-max of 50

    // Margins
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Draw Y-axis grid lines and labels
    const gridLines = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#8f92a1';
    ctx.font = '10px "Space Mono", monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const yVal = Math.round((maxPoints / gridLines) * i);
      const yPos = height - paddingBottom - (chartHeight / gridLines) * i;
      
      // Line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, yPos);
      ctx.lineTo(width - paddingRight, yPos);
      ctx.stroke();

      // Label
      ctx.fillText(`${yVal}p`, paddingLeft - 8, yPos + 3);
    }

    // Draw bars
    const barWidth = Math.max(8, (chartWidth / displayedDates.length) * 0.5);
    const spacing = (chartWidth - barWidth * displayedDates.length) / (displayedDates.length - 1 || 1);

    displayedDates.forEach((date, index) => {
      const pts = pointsMap[date] || 0;
      const barHeight = (pts / maxPoints) * chartHeight;
      const x = paddingLeft + index * (barWidth + spacing);
      const y = height - paddingBottom - barHeight;

      // Draw shiny bar with glowing neon green
      const gradient = ctx.createLinearGradient(x, y, x, height - paddingBottom);
      gradient.addColorStop(0, '#7fff6e'); // main neon green
      gradient.addColorStop(1, '#133f11'); // dark green for depth

      ctx.save();
      ctx.shadowColor = '#7fff6e';
      ctx.shadowBlur = pts > 0 ? 8 : 0;
      ctx.fillStyle = gradient;

      // Rounded rectangle for bar top
      ctx.beginPath();
      if (barHeight > 4) {
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, Math.max(2, barHeight));
      }
      ctx.fill();
      ctx.restore();

      // Value text on top
      if (pts > 0) {
        ctx.fillStyle = '#7fff6e';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${pts}`, x + barWidth / 2, y - 6);
      }

      // X Label (Format YYYY-MM-DD to DD/MM)
      const parts = date.split('-');
      const xLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
      ctx.fillStyle = '#8f92a1';
      ctx.font = '9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(xLabel, x + barWidth / 2, height - paddingBottom + 15);
    });

  }, [habits, completions, startDateStr, endDateStr]);

  // 2nd Chart: Frequency per habit in the filtered period (last 7 days by default)
  useEffect(() => {
    const canvas = freqCanvasRef.current;
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

    // Clear background
    ctx.fillStyle = '#11111a';
    ctx.fillRect(0, 0, width, height);

    // Calculate how many times each habit was checked in range
    const datesMap: { [date: string]: boolean } = {};
    getDatesInRange(startDateStr, endDateStr).forEach((d) => {
      datesMap[d] = true;
    });

    const frequencyData = habits.map((h) => {
      const count = completions.filter((c) => c.habitId === h.id && datesMap[c.date]).length;
      return {
        habitName: h.name,
        emoji: h.emoji,
        color: h.color || '#3dffc3',
        count,
      };
    });

    const maxCount = Math.max(...frequencyData.map((fd) => fd.count), 4); // Min scale is 4

    // Set layout (horizontal bar chart to let text fit perfectly!)
    const paddingLeft = 110; // Extra room for habit names
    const paddingRight = 35;
    const paddingTop = 20;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const rowHeight = chartHeight / (habits.length || 1);
    const barHeight = Math.max(6, rowHeight * 0.45);

    // Horizontal grid lines / ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Draw ticks
    ctx.fillStyle = '#8f92a1';
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const tickVal = Math.round((maxCount / 4) * i);
      const xPos = paddingLeft + (chartWidth / 4) * i;
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(xPos, paddingTop);
      ctx.lineTo(xPos, height - paddingBottom);
      ctx.stroke();

      // Label at bottom
      ctx.fillText(`${tickVal}`, xPos, height - 6);
    }

    frequencyData.forEach((fd, index) => {
      const y = paddingTop + index * rowHeight + (rowHeight - barHeight) / 2;
      const barWidth = (fd.count / maxCount) * chartWidth;

      // Render habit label with emoji
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px "Syne", sans-serif';
      ctx.textAlign = 'left';
      
      const labelText = `${fd.emoji} ${fd.habitName}`;
      // Truncate if too long to avoid overflow
      let displayLabel = labelText;
      if (ctx.measureText(labelText).width > paddingLeft - 15) {
        displayLabel = labelText.substring(0, 12) + '...';
      }
      ctx.fillText(displayLabel, 10, y + barHeight / 2 + 4);

      // Draw colorful horizontal bar
      const gradient = ctx.createLinearGradient(paddingLeft, y, paddingLeft + barWidth, y);
      gradient.addColorStop(0, fd.color);
      gradient.addColorStop(1, '#0e111a');

      ctx.save();
      ctx.shadowColor = fd.color;
      ctx.shadowBlur = fd.count > 0 ? 5 : 0;
      ctx.fillStyle = gradient;

      ctx.beginPath();
      if (barWidth > 4) {
        ctx.roundRect(paddingLeft, y, barWidth, barHeight, [0, 4, 4, 0]);
      } else {
        ctx.rect(paddingLeft, y, Math.max(1, barWidth), barHeight);
      }
      ctx.fill();
      ctx.restore();

      // Show values next to bars
      ctx.fillStyle = fd.color;
      ctx.font = '10px "Space Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fd.count}x`, paddingLeft + barWidth + 6, y + barHeight / 2 + 4);
    });

  }, [habits, completions, startDateStr, endDateStr]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-[#11111a] border border-[#222235] p-4 rounded-xl flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            Pontos por Dia (Últimos dias)
          </h3>
          <span className="text-[10px] font-mono text-[#7fff6e] bg-[#7fff6e]/10 px-2 py-0.5 rounded">
            Foco Ativo ⚡
          </span>
        </div>
        <div className="relative w-full h-[200px]">
          <canvas ref={pointsCanvasRef} className="absolute inset-0 w-full h-full rounded" />
        </div>
      </div>

      <div className="bg-[#11111a] border border-[#222235] p-4 rounded-xl flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            Frequência por Hábito (Período)
          </h3>
          <span className="text-[10px] font-mono text-[#3dffc3] bg-[#3dffc3]/10 px-2 py-0.5 rounded">
            Repetições 🔄
          </span>
        </div>
        <div className="relative w-full h-[200px]">
          <canvas ref={freqCanvasRef} className="absolute inset-0 w-full h-full rounded" />
        </div>
      </div>
    </div>
  );
};
