import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import {
  BatchSummary,
  Recommendation,
  RecommendationDetail,
  REJECT_REASONS,
  RejectReasonCode,
} from "../api/types";
import { DemandChart, FactorBars, PriceCorridor } from "../components/DetailCard";
import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconClock,
  IconTag,
  IconX,
} from "../components/Icons";
import {
  ErrorNote,
  formatPrice,
  formatQty,
  Modal,
  PriceDelta,
  Spinner,
  StatusBadge,
} from "../components/ui";

function KpiTile({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-ink">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function ResultsPage() {
  const { batchId } = useParams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectReasonCode>("disagree_with_forecast");
  const [rejectComment, setRejectComment] = useState("");

  const batch = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => api<BatchSummary>(`/api/recommendations/batch/${batchId}`),
  });

  useEffect(() => {
    if (batch.data && selectedId === null && batch.data.items.length > 0) {
      setSelectedId(batch.data.items[0].recommendation_id);
    }
  }, [batch.data, selectedId]);

  const detail = useQuery({
    queryKey: ["recommendation", selectedId],
    queryFn: () => api<RecommendationDetail>(`/api/recommendations/${selectedId}`),
    enabled: selectedId !== null,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["batch", batchId] });
    queryClient.invalidateQueries({ queryKey: ["recommendation", selectedId] });
    queryClient.invalidateQueries({ queryKey: ["metrics"] });
  };

  const approve = useMutation({
    mutationFn: (id: number) =>
      api(`/api/recommendations/${id}/approve`, { method: "POST" }),
    onSuccess: refresh,
  });

  const reject = useMutation({
    mutationFn: (args: { id: number; reason_code: RejectReasonCode; comment?: string }) =>
      api(`/api/recommendations/${args.id}/reject`, {
        method: "POST",
        body: { reason_code: args.reason_code, comment: args.comment || null },
      }),
    onSuccess: () => {
      setRejectOpen(false);
      setRejectComment("");
      refresh();
    },
  });

  if (batch.isLoading) return <Spinner label="Загружаем результаты расчёта..." />;
  if (batch.isError) return <ErrorNote message={(batch.error as Error).message} />;
  if (!batch.data) return null;

  const { items, store, target_date, model_version, counts } = batch.data;
  const decided = (counts.approved ?? 0) + (counts.rejected ?? 0) + (counts.exported ?? 0);

  return (
    <div className="space-y-5">
      {/* Шапка расчёта */}
      <div className="animate-fade-up">
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-pine-700"
        >
          <IconArrowLeft className="h-4 w-4" />
          На рабочий стол
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Ценовые рекомендации</h1>
            <p className="mt-1 text-sm text-slate-500">
              {store.name} · на {new Date(target_date).toLocaleDateString("ru-RU")} · модель{" "}
              <span className="font-mono text-xs">{model_version}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-600 shadow-card">
              {items.length} позиций
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
              решено: {decided}
            </span>
            {(counts.review_required ?? 0) > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                на проверке: {counts.review_required}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid animate-fade-up grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        {/* Список рекомендаций */}
        <div className="scrollbar-thin max-h-[75vh] space-y-2 overflow-y-auto pr-1">
          {items.map((item: Recommendation) => (
            <button
              key={item.recommendation_id}
              onClick={() => setSelectedId(item.recommendation_id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedId === item.recommendation_id
                  ? "border-pine-600 bg-white shadow-card ring-1 ring-pine-600"
                  : "border-transparent bg-white shadow-card hover:border-pine-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold leading-snug text-ink">{item.sku_name}</div>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm tabular-nums text-slate-400 line-through">
                  {formatPrice(item.current_price)}
                </span>
                <span className="text-base font-extrabold tabular-nums text-ink">
                  {formatPrice(item.recommended_price)}
                </span>
                <PriceDelta pct={item.change_pct} />
              </div>
              <div className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-500">
                {item.reason}
              </div>
            </button>
          ))}
        </div>

        {/* Карточка выбранной рекомендации */}
        <div className="min-h-[75vh]">
          {detail.isLoading && <Spinner label="Готовим карточку товара..." />}
          {detail.isError && <ErrorNote message={(detail.error as Error).message} />}
          {detail.data && (
            <div key={detail.data.recommendation_id} className="animate-fade-up space-y-4">
              {/* Заголовок и действия */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-ink">
                        {detail.data.sku_name}
                      </h2>
                      <StatusBadge status={detail.data.status} />
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {detail.data.sku_id} · {detail.data.brand} · {detail.data.category_name}{" "}
                      · {detail.data.store_name}
                    </div>
                  </div>
                  {["draft", "review_required"].includes(detail.data.status) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve.mutate(detail.data!.recommendation_id)}
                        disabled={approve.isPending}
                        className="flex items-center gap-1.5 rounded-xl bg-pine-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pine-700 disabled:opacity-50"
                      >
                        <IconCheck className="h-4 w-4" />
                        Принять рекомендацию
                      </button>
                      <button
                        onClick={() => setRejectOpen(true)}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <IconX className="h-4 w-4" />
                        Отклонить
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-baseline gap-3">
                  <span className="text-sm text-slate-400">текущая</span>
                  <span className="text-xl font-bold tabular-nums text-slate-400 line-through decoration-slate-300">
                    {formatPrice(detail.data.current_price)}
                  </span>
                  <span className="text-sm text-slate-400">рекомендованная</span>
                  <span className="text-3xl font-extrabold tabular-nums text-pine-800">
                    {formatPrice(detail.data.recommended_price)}
                  </span>
                  <PriceDelta pct={detail.data.change_pct} className="text-sm" />
                </div>

                <div className="mt-3 rounded-xl bg-pine-50 px-4 py-3 text-sm leading-relaxed text-pine-900">
                  {detail.data.reason}
                </div>

                {approve.isError && (
                  <div className="mt-3">
                    <ErrorNote message={(approve.error as Error).message} />
                  </div>
                )}

                {/* Показатели */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiTile
                    label="Прогноз спроса"
                    value={`${formatQty(detail.data.forecast_qty)} шт`}
                    sub={`базовый: ${formatQty(detail.data.expected_qty)} шт`}
                  />
                  <KpiTile
                    icon={<IconTag className="h-3.5 w-3.5" />}
                    label="Маржа"
                    value={`${detail.data.financials.margin_recommended_pct.toLocaleString("ru-RU")}%`}
                    sub={`сейчас: ${detail.data.financials.margin_current_pct.toLocaleString("ru-RU")}%`}
                  />
                  <KpiTile
                    icon={<IconBox className="h-3.5 w-3.5" />}
                    label="Запас"
                    value={`${detail.data.stock_cover_days.toLocaleString("ru-RU")} дн.`}
                    sub={`${formatQty(detail.data.stock_qty)} шт на остатке`}
                  />
                  <KpiTile
                    icon={<IconClock className="h-3.5 w-3.5" />}
                    label="Кач-во прогноза"
                    value={`MAPE ${(detail.data.model_mape * 100).toFixed(1).replace(".", ",")}%`}
                    sub={
                      detail.data.shelf_life_days <= 3
                        ? `срок годности ${detail.data.shelf_life_days} дн.`
                        : "стабильная позиция"
                    }
                  />
                </div>
              </div>

              {/* График спроса */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">
                    Продажи за 8 недель и прогноз
                  </h3>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-5 rounded bg-pine-600" /> факт
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-5 rounded border-b-2 border-dashed border-gold-500" />{" "}
                      прогноз
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-500" /> промо-дни
                    </span>
                  </div>
                </div>
                <DemandChart detail={detail.data} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Ценовой коридор */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="text-sm font-bold text-ink">Ценовой коридор</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Ограничения: минимальная маржа, шаг изменения за цикл
                  </p>
                  <PriceCorridor detail={detail.data} />
                </div>

                {/* Факторы решения */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">Факторы решения</h3>
                  <FactorBars detail={detail.data} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Ожидаемый эффект */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">
                    Ожидаемый эффект на дату расчёта
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Выручка</span>
                      <span className="font-semibold tabular-nums">
                        {formatPrice(detail.data.financials.revenue_current)} →{" "}
                        {formatPrice(detail.data.financials.revenue_recommended)}{" "}
                        <PriceDelta pct={detail.data.financials.revenue_delta_pct} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Валовая прибыль</span>
                      <span className="font-semibold tabular-nums">
                        {formatPrice(detail.data.financials.profit_current)} →{" "}
                        {formatPrice(detail.data.financials.profit_recommended)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Маржинальность</span>
                      <span className="font-semibold tabular-nums">
                        {detail.data.financials.margin_current_pct.toLocaleString("ru-RU")}% →{" "}
                        {detail.data.financials.margin_recommended_pct.toLocaleString("ru-RU")}
                        %
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-snug text-slate-400">
                    Оценка при прогнозном спросе; фактический эффект сверяется после
                    применения цены.
                  </p>
                </div>

                {/* Сработавшие ограничения */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">Сработавшие ограничения</h3>
                  {detail.data.constraints.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Расчёт прошёл без корректировок: цена внутри допустимого коридора.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.data.constraints.map((c) => (
                        <li
                          key={c}
                          className="flex items-start gap-2 text-sm leading-snug text-slate-600"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно отклонения */}
      {rejectOpen && detail.data && (
        <Modal title="Отклонить рекомендацию" onClose={() => setRejectOpen(false)}>
          <p className="mb-4 text-sm text-slate-500">
            Причина отклонения сохраняется в журнале и используется для настройки правил
            расчёта.
          </p>
          <div className="space-y-2">
            {REJECT_REASONS.map((r) => (
              <label
                key={r.code}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                  rejectReason === r.code
                    ? "border-pine-600 bg-pine-50 font-semibold text-pine-900"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  checked={rejectReason === r.code}
                  onChange={() => setRejectReason(r.code)}
                  className="accent-pine-700"
                />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            rows={2}
            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-pine-500 focus:ring-2 focus:ring-pine-100"
          />
          {reject.isError && (
            <div className="mt-3">
              <ErrorNote message={(reject.error as Error).message} />
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() =>
                reject.mutate({
                  id: detail.data!.recommendation_id,
                  reason_code: rejectReason,
                  comment: rejectComment,
                })
              }
              disabled={reject.isPending}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
            >
              Отклонить
            </button>
            <button
              onClick={() => setRejectOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Отмена
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
