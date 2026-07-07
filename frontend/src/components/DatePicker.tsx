import { useEffect, useMemo, useRef, useState } from "react";

import { IconCalendar } from "./Icons";

const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/** "2026-07-09" -> {y, m (0-11), d} без сюрпризов с часовыми поясами */
function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** ISO-дата по локальному времени (toISOString даёт UTC и после полуночи съезжает на день) */
export function toLocalISO(date: Date): string {
  return toISO(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatRuDate(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${d} ${MONTHS_GEN[m]} ${y}`;
}

interface DatePickerProps {
  value: string; // ISO YYYY-MM-DD
  min?: string;
  onChange: (iso: string) => void;
}

export default function DatePicker({ value, min, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [view, setView] = useState({ y: selected.y, m: selected.m });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const todayISO = useMemo(() => toLocalISO(new Date()), []);

  // сетка дней: недели начинаются с понедельника
  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < offset; i++) {
      const d = new Date(view.y, view.m, i - offset + 1);
      cells.push({
        iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: toISO(view.y, view.m, d), day: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells.length - offset - daysInMonth + 1;
      const d = new Date(view.y, view.m + 1, last);
      cells.push({
        iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        inMonth: false,
      });
    }
    return cells;
  }, [view]);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  };

  const openPicker = () => {
    setView({ y: selected.y, m: selected.m });
    setOpen((o) => !o);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
          open
            ? "border-pine-500 ring-2 ring-pine-100"
            : "border-slate-200 hover:border-pine-300"
        }`}
      >
        <IconCalendar className="h-4 w-4 text-pine-600" />
        {formatRuDate(value)}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[292px] animate-fade-up rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
          {/* Шапка: месяц и навигация */}
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-pine-50 hover:text-pine-700"
              aria-label="Предыдущий месяц"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <div className="text-sm font-bold text-ink">
              {MONTHS_NOM[view.m]} {view.y}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-pine-50 hover:text-pine-700"
              aria-label="Следующий месяц"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={`py-1 text-center text-[11px] font-semibold uppercase ${
                  i >= 5 ? "text-gold-600" : "text-slate-400"
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Сетка дней */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((cell) => {
              const disabled = min !== undefined && cell.iso < min;
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayISO;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm tabular-nums transition ${
                    isSelected
                      ? "bg-pine-800 font-bold text-white shadow"
                      : disabled
                        ? "cursor-not-allowed text-slate-300"
                        : cell.inMonth
                          ? "font-medium text-ink hover:bg-pine-50 hover:text-pine-800"
                          : "text-slate-300 hover:bg-slate-50"
                  } ${isToday && !isSelected ? "ring-1 ring-inset ring-gold-500" : ""}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Быстрый выбор */}
          <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
            {[
              { label: "Сегодня", iso: todayISO },
              {
                label: "Завтра",
                iso: (() => {
                  const t = new Date();
                  t.setDate(t.getDate() + 1);
                  return toLocalISO(t);
                })(),
              },
            ].map((q) => {
              const disabled = min !== undefined && q.iso < min;
              return (
                <button
                  key={q.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(q.iso);
                    setOpen(false);
                  }}
                  className="flex-1 rounded-lg bg-pine-50 py-1.5 text-xs font-semibold text-pine-800 transition hover:bg-pine-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
