import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { Product, Store } from "../api/types";
import DatePicker, { toLocalISO } from "../components/DatePicker";
import {
  IconArrowLeft,
  IconSearch,
  IconSparkles,
  IconStore,
  IconTrendDown,
  IconTrendUp,
} from "../components/Icons";
import { ErrorNote, formatPrice, SignalChip, Spinner, TableScroll } from "../components/ui";

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "attention", label: "Требуют внимания" },
  { key: "риск списаний", label: "Риск списаний" },
  { key: "промо", label: "Промо" },
  { key: "ручная проверка", label: "Ручная проверка" },
] as const;

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalISO(d);
}

export default function CategoryPage() {
  const { categoryId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const categoryName = (location.state as { name?: string })?.name ?? "Категория";

  const [storeId, setStoreId] = useState(1);
  const [targetDate, setTargetDate] = useState(tomorrowISO());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<Store[]>("/api/stores"),
  });
  const products = useQuery({
    queryKey: ["products", categoryId, storeId],
    queryFn: () =>
      api<Product[]>(`/api/products?category_id=${categoryId}&store_id=${storeId}`),
  });

  const filtered = useMemo(() => {
    let rows = products.data ?? [];
    if (filter === "attention") rows = rows.filter((p) => p.signals.length > 0);
    else if (filter !== "all") rows = rows.filter((p) => p.signals.includes(filter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.sku_name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          String(p.sku_id).includes(q),
      );
    }
    return rows;
  }, [products.data, filter, search]);

  const toggle = (skuId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) next.delete(skuId);
      else next.add(skuId);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every((p) => selected.has(p.sku_id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.sku_id)));
    }
  };

  const startCalculation = () => {
    navigate("/calculation", {
      state: {
        storeId,
        storeName: stores.data?.find((s) => s.store_id === storeId)?.name,
        targetDate,
        skuIds: Array.from(selected),
        categoryName,
      },
    });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="animate-fade-up">
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-pine-700"
        >
          <IconArrowLeft className="h-4 w-4" />
          Категории
        </Link>
        <h1 className="text-2xl font-extrabold text-ink">{categoryName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Выберите позиции для расчёта рекомендованных цен
        </p>
      </div>

      {/* Панель параметров расчёта; z-30 — чтобы календарь раскрывался поверх секций ниже */}
      <div className="relative z-30 flex animate-fade-up flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <IconStore className="h-4 w-4 text-pine-600" />
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(Number(e.target.value));
              setSelected(new Set());
            }}
            className="bg-transparent text-sm font-medium outline-none"
          >
            {stores.data?.map((s) => (
              <option key={s.store_id} value={s.store_id}>
                {s.name} · {s.format}
              </option>
            ))}
          </select>
        </div>
        <DatePicker
          value={targetDate}
          min={toLocalISO(new Date())}
          onChange={setTargetDate}
        />
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <IconSearch className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, бренду, артикулу"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex animate-fade-up flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === f.key
                ? "bg-pine-800 text-white shadow"
                : "bg-white text-slate-600 shadow-card hover:bg-pine-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {products.isLoading && <Spinner label="Загружаем ассортимент..." />}
      {products.isError && <ErrorNote message={(products.error as Error).message} />}

      {/* Таблица SKU */}
      {products.data && (
        <div className="animate-fade-up rounded-2xl bg-white shadow-card">
          <TableScroll>
            <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((p) => selected.has(p.sku_id))}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-pine-700"
                  />
                </th>
                <th className="px-3 py-3 font-semibold">Товар</th>
                <th className="px-3 py-3 text-right font-semibold">Цена</th>
                <th className="px-3 py-3 text-right font-semibold">Спрос, шт/день</th>
                <th className="px-3 py-3 text-right font-semibold">Тренд 7д</th>
                <th className="px-3 py-3 text-right font-semibold">Запас, дни</th>
                <th className="px-3 py-3 font-semibold">Сигналы</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.sku_id}
                  onClick={() => toggle(p.sku_id)}
                  className={`cursor-pointer border-b border-slate-50 transition last:border-0 ${
                    selected.has(p.sku_id) ? "bg-pine-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.sku_id)}
                      onChange={() => toggle(p.sku_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-pine-700"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-ink">{p.sku_name}</div>
                    <div className="text-xs text-slate-400">
                      {p.sku_id} · {p.brand}
                      {p.is_private_label && " · СТМ"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">
                    {formatPrice(p.current_price)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {p.mean_7.toLocaleString("ru-RU")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                        p.trend_pct <= -5
                          ? "text-rose-600"
                          : p.trend_pct >= 5
                            ? "text-emerald-600"
                            : "text-slate-400"
                      }`}
                    >
                      {p.trend_pct <= -5 ? (
                        <IconTrendDown className="h-4 w-4" />
                      ) : p.trend_pct >= 5 ? (
                        <IconTrendUp className="h-4 w-4" />
                      ) : null}
                      {p.trend_pct > 0 ? "+" : p.trend_pct < 0 ? "−" : ""}
                      {Math.abs(p.trend_pct).toFixed(1).replace(".", ",")}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {p.stock_cover_days.toFixed(1)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.signals.map((s) => (
                        <SignalChip key={s} text={s} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    По заданным условиям позиции не найдены
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </TableScroll>
        </div>
      )}

      {/* Плавающая панель запуска расчёта */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 py-4 shadow-[0_-8px_24px_rgba(19,41,33,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="text-sm text-slate-600">
              Выбрано позиций:{" "}
              <span className="font-bold text-ink">{selected.size}</span>
              <span className="ml-2 hidden text-slate-400 sm:inline">
                расчёт на {new Date(targetDate).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <button
              onClick={startCalculation}
              className="flex items-center gap-2 rounded-xl bg-pine-800 px-6 py-3 text-sm font-bold text-white transition hover:bg-pine-700"
            >
              <IconSparkles className="h-4 w-4" />
              Рассчитать рекомендации
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
