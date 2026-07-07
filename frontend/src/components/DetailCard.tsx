import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RecommendationDetail } from "../api/types";
import { formatPrice, formatQty } from "./ui";

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** График: 8 недель факта + пунктирный прогноз на неделю вперёд */
export function DemandChart({ detail }: { detail: RecommendationDetail }) {
  const data = useMemo(() => {
    const points = detail.series.map((p) => ({
      date: p.date,
      qty: p.qty ?? null,
      forecast: p.forecast_qty ?? null,
      promoQty: p.promo ? (p.qty ?? null) : null,
    }));
    // соединяем факт и прогноз в одну визуальную линию
    const lastFact = [...points].reverse().find((p) => p.qty !== null);
    if (lastFact) lastFact.forecast = lastFact.qty;
    return points;
  }, [detail.series]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="qtyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#335f4b" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#335f4b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDay}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${formatQty(value)} шт`,
            name === "qty" ? "Продажи" : name === "forecast" ? "Прогноз" : "Промо-день",
          ]}
          labelFormatter={(label: string) =>
            new Date(label).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              weekday: "short",
            })
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(19,41,33,0.12)",
          }}
        />
        <Area
          type="monotone"
          dataKey="qty"
          stroke="#335f4b"
          strokeWidth={2}
          fill="url(#qtyFill)"
          dot={false}
          connectNulls
          name="qty"
        />
        <Line
          type="monotone"
          dataKey="promoQty"
          stroke="none"
          dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
          isAnimationActive={false}
          name="promoQty"
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#c4a464"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={false}
          connectNulls
          name="forecast"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Ценовой коридор: границы из маржи и шага изменения, маркеры цен */
export function PriceCorridor({ detail }: { detail: RecommendationDetail }) {
  const { price_lower: lower, price_upper: upper } = detail;
  const span = upper - lower || 1;
  const pos = (v: number) => Math.min(Math.max(((v - lower) / span) * 100, 0), 100);

  return (
    <div className="pt-7">
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-rose-100 via-emerald-100 to-amber-100">
        {/* текущая цена */}
        <div
          className="absolute -top-6 -translate-x-1/2 text-center"
          style={{ left: `${pos(detail.current_price)}%` }}
        >
          <div className="whitespace-nowrap text-[10px] font-semibold text-slate-400">
            сейчас
          </div>
          <div className="mx-auto h-4 w-0.5 bg-slate-400" />
        </div>
        {/* рекомендованная цена */}
        <div
          className="absolute -bottom-[26px] -translate-x-1/2 text-center"
          style={{ left: `${pos(detail.recommended_price)}%` }}
        >
          <div className="mx-auto h-4 w-1 rounded bg-pine-700" />
          <div className="whitespace-nowrap text-[10px] font-bold text-pine-700">
            рекомендация
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-between text-xs text-slate-400">
        <div>
          <div className="font-semibold tabular-nums text-slate-600">{formatPrice(lower)}</div>
          <div>нижняя граница (маржа, шаг −12%)</div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums text-slate-600">{formatPrice(upper)}</div>
          <div>верхняя граница (шаг +7%)</div>
        </div>
      </div>
    </div>
  );
}

/** Вклад факторов — аналог важности признаков модели */
export function FactorBars({ detail }: { detail: RecommendationDetail }) {
  return (
    <div className="space-y-2.5">
      {detail.factors.map((f) => {
        const width = Math.min(Math.abs(f.impact) * 50, 50);
        const positive = f.impact >= 0;
        return (
          <div key={f.feature} className="grid grid-cols-[130px_1fr] items-center gap-3">
            <div>
              <div className="text-xs font-semibold text-ink">{f.label}</div>
              <div className="text-[10px] leading-tight text-slate-400">{f.detail}</div>
            </div>
            <div className="relative h-3 rounded-full bg-slate-100">
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
              <div
                className={`absolute inset-y-0 rounded-full ${
                  positive ? "left-1/2 bg-pine-500" : "right-1/2 bg-amber-400"
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex justify-between px-[142px] text-[10px] text-slate-400">
        <span>давит на снижение</span>
        <span>давит на повышение</span>
      </div>
    </div>
  );
}
