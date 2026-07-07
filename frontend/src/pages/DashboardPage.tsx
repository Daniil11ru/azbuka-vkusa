import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { Category, Metrics } from "../api/types";
import {
  CATEGORY_ICONS,
  IconAlert,
  IconChevronRight,
  IconClock,
  IconSparkles,
} from "../components/Icons";
import { ErrorNote, Spinner } from "../components/ui";

function KpiCard({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-2xl font-extrabold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-600">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/api/categories"),
  });
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api<Metrics>("/api/metrics"),
  });

  const totalAttention =
    categories.data?.reduce((acc, c) => acc + c.needs_attention, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold text-ink">Рабочий стол аналитика</h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {" · ночной расчёт завершён, рекомендации готовы к проверке"}
        </p>
      </div>

      {metrics.data && (
        <div className="grid animate-fade-up grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            value={String(metrics.data.sku_total)}
            label="SKU под управлением"
            hint="в пилотных категориях"
          />
          <KpiCard
            value={String(totalAttention)}
            label="Требуют внимания"
            hint="отклонение спроса, запасы, промо"
          />
          <KpiCard
            value={`${metrics.data.model_mape.toLocaleString("ru-RU")}%`}
            label="MAPE модели"
            hint={`${metrics.data.model_version}`}
          />
          <KpiCard
            value={
              metrics.data.approved_share_pct > 0
                ? `${metrics.data.approved_share_pct.toLocaleString("ru-RU")}%`
                : "—"
            }
            label="Принято рекомендаций"
            hint="из рассмотренных за период"
          />
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Категории товаров</h2>
          {metrics.data && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <IconClock className="h-4 w-4" />
              модель переобучена{" "}
              {new Date(metrics.data.trained_at).toLocaleDateString("ru-RU")}
            </div>
          )}
        </div>

        {categories.isLoading && <Spinner label="Загружаем категории..." />}
        {categories.isError && (
          <ErrorNote message={(categories.error as Error).message} />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.data?.map((category, i) => {
            const Icon = CATEGORY_ICONS[category.icon] ?? IconSparkles;
            return (
              <Link
                key={category.category_id}
                to={`/category/${category.category_id}`}
                state={{ name: category.name }}
                className="group animate-fade-up rounded-2xl bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pine-50 text-pine-700 transition group-hover:bg-pine-800 group-hover:text-gold-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <IconChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-pine-600" />
                </div>
                <div className="mt-4 text-base font-bold text-ink">{category.name}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {category.sku_count} SKU · MAPE{" "}
                  {(category.avg_mape * 100).toFixed(1).replace(".", ",")}%
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {category.needs_attention > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <IconAlert className="h-3.5 w-3.5" />
                      {category.needs_attention} к пересмотру
                    </span>
                  )}
                  {category.write_off_risk > 0 && (
                    <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                      риск списаний: {category.write_off_risk}
                    </span>
                  )}
                  {category.needs_attention === 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      всё в порядке
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
