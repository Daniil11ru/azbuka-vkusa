import { ReactNode, useEffect, useRef, useState } from "react";

import { RecommendationStatus } from "../api/types";
import { IconX } from "./Icons";

export const STATUS_META: Record<
  RecommendationStatus,
  { label: string; className: string }
> = {
  draft: { label: "Черновик", className: "bg-slate-100 text-slate-600" },
  review_required: { label: "Требует проверки", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Утверждена", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Отклонена", className: "bg-rose-100 text-rose-700" },
  exported: { label: "Выгружена", className: "bg-sky-100 text-sky-800" },
};

export function StatusBadge({ status }: { status: RecommendationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export function formatPrice(value: number): string {
  return (
    value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " ₽"
  );
}

export function formatQty(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

export function PriceDelta({ pct, className }: { pct: number; className?: string }) {
  const color =
    Math.abs(pct) < 0.05
      ? "bg-slate-100 text-slate-500"
      : pct > 0
        ? "bg-emerald-50 text-emerald-700"
        : "bg-rose-50 text-rose-600";
  const sign = pct > 0 ? "+" : "−";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${color} ${className ?? ""}`}
    >
      {Math.abs(pct) < 0.05
        ? "0%"
        : `${sign}${Math.abs(pct).toFixed(1).replace(".", ",")}%`}
    </span>
  );
}

export function SignalChip({ text }: { text: string }) {
  const styles: Record<string, string> = {
    "падение спроса": "bg-rose-50 text-rose-600 border-rose-200",
    "рост спроса": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "высокий запас": "bg-amber-50 text-amber-700 border-amber-200",
    "риск списаний": "bg-orange-50 text-orange-700 border-orange-200",
    промо: "bg-violet-50 text-violet-700 border-violet-200",
    "ручная проверка": "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        styles[text] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {text}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

/**
 * Горизонтальный скролл для широких таблиц: градиенты у краёв показывают,
 * что контент продолжается, а до первого свайпа висит пульсирующая стрелка.
 */
export function TableScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className="scrollbar-thin overflow-x-auto rounded-2xl">
        {children}
      </div>
      {canLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-2xl bg-gradient-to-r from-white to-transparent" />
      )}
      {canRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 rounded-r-2xl bg-gradient-to-l from-white via-white/50 to-transparent" />
      )}
      {canRight && !canLeft && (
        // sticky внутри absolute: стрелка едет вместе со страницей, пока таблица на экране
        <div className="pointer-events-none absolute inset-y-14 right-2.5">
          <button
            type="button"
            aria-label="Пролистать таблицу вправо"
            onClick={() =>
              ref.current?.scrollBy({
                left: Math.round(ref.current.clientWidth * 0.6),
                behavior: "smooth",
              })
            }
            className="pointer-events-auto sticky top-[45vh] flex h-9 w-9 animate-pulse-soft items-center justify-center rounded-full bg-pine-800/90 text-white shadow-lg transition hover:bg-pine-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-pine-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
