import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { IconCheck, IconLoader } from "../components/Icons";
import { ErrorNote } from "../components/ui";

interface CalculationState {
  storeId: number;
  storeName?: string;
  targetDate: string;
  skuIds: number[];
  categoryName: string;
}

const STAGES = [
  {
    title: "Загрузка данных",
    detail: "Продажи, остатки, цены и промокалендарь из аналитической витрины",
  },
  {
    title: "Расчёт признаков",
    detail: "Лаги продаж 7/14 дней, скользящее среднее, сезонность, out-of-stock",
  },
  {
    title: "Прогнозирование спроса",
    detail: "Градиентный бустинг CatBoost по паре SKU–магазин",
  },
  {
    title: "Применение ценовой политики",
    detail: "Коридор маржи, шаг изменения, промоограничения, округление ,90 ₽",
  },
];

const STAGE_MS = 1250;

export default function CalculationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CalculationState | null;

  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const batchRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!state || startedRef.current) return;
    startedRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= STAGES.length; i++) {
      timers.push(setTimeout(() => setStage(i), i * STAGE_MS));
    }

    api<{ batch_id: string }>("/api/recommendations/calculate", {
      method: "POST",
      body: {
        store_id: state.storeId,
        target_date: state.targetDate,
        sku_ids: state.skuIds,
      },
    })
      .then((data) => {
        batchRef.current = data.batch_id;
      })
      .catch((err) => {
        timers.forEach(clearTimeout);
        setError(err instanceof Error ? err.message : "Не удалось выполнить расчёт");
      });

    return () => timers.forEach(clearTimeout);
  }, [state]);

  // Переходим к результатам, когда анимация завершена и batch получен
  useEffect(() => {
    if (stage < STAGES.length || error) return;
    const poll = setInterval(() => {
      if (batchRef.current) {
        clearInterval(poll);
        navigate(`/results/${batchRef.current}`, { replace: true });
      }
    }, 150);
    return () => clearInterval(poll);
  }, [stage, error, navigate]);

  if (!state) return <Navigate to="/" replace />;

  const progress = Math.min((stage / STAGES.length) * 100, 100);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-lg animate-fade-up rounded-3xl bg-white p-8 shadow-card">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pine-800 text-gold-300">
            {error ? (
              <span className="text-xl font-bold">!</span>
            ) : (
              <IconLoader className="h-7 w-7 animate-spin" />
            )}
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-ink">
            {error ? "Расчёт прерван" : "Рассчитываем рекомендации"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {state.categoryName} · {state.skuIds.length} SKU ·{" "}
            {new Date(state.targetDate).toLocaleDateString("ru-RU")}
            {state.storeName && <> · {state.storeName}</>}
          </p>
        </div>

        {!error && (
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pine-600 to-gold-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="mt-6 space-y-1">
          {STAGES.map((s, i) => {
            const done = stage > i;
            const active = stage === i && !error;
            return (
              <div
                key={s.title}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                  active ? "bg-pine-50" : ""
                }`}
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-emerald-100 text-emerald-700"
                      : active
                        ? "bg-pine-800 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      done || active ? "text-ink" : "text-slate-400"
                    } ${active ? "animate-pulse-soft" : ""}`}
                  >
                    {s.title}
                  </div>
                  <div className="text-xs text-slate-400">{s.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 space-y-4">
            <ErrorNote message={error} />
            <button
              onClick={() => navigate(-1)}
              className="w-full rounded-xl bg-pine-800 py-3 text-sm font-bold text-white transition hover:bg-pine-700"
            >
              Вернуться к выбору позиций
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
