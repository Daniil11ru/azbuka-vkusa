import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { BrandMark } from "../components/Layout";
import { IconLoader, IconShield } from "../components/Icons";
import { ErrorNote } from "../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("analyst");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Брендовая панель */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-pine-900 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #c4a464 0, transparent 45%), radial-gradient(circle at 80% 90%, #44775f 0, transparent 50%)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <BrandMark size="lg" />
          <div>
            <div className="text-xl font-extrabold tracking-wide">Азбука Вкуса</div>
            <div className="text-sm text-pine-200">Ценовой контур</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-extrabold leading-snug">
            Рекомендованная цена —{" "}
            <span className="text-gold-400">с объяснением, почему именно такая</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-pine-100">
            Система прогнозирует спрос по каждой паре SKU–магазин и рассчитывает цену с
            учётом маржи, остатков, промоактивности и сроков годности. Решение всегда
            остаётся за аналитиком.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[
              ["10,8%", "MAPE модели на пилоте"],
              ["1 250", "SKU в ночном расчёте"],
              ["< 2 с", "отклик экрана рекомендаций"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-pine-800/70 px-3 py-4">
                <div className="text-xl font-extrabold text-gold-300">{value}</div>
                <div className="mt-1 text-[11px] leading-tight text-pine-200">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-pine-300">
          <IconShield className="h-4 w-4" />
          Пилотный контур · доступ по ролям · все действия журналируются
        </div>
      </div>

      {/* Форма входа */}
      <div className="flex flex-1 items-center justify-center bg-ivory p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div>
              <div className="text-sm font-bold">Азбука Вкуса</div>
              <div className="text-xs text-slate-500">Ценовой контур</div>
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-ink">Вход в систему</h2>
          <p className="mt-1 text-sm text-slate-500">
            Используйте корпоративную учётную запись
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Логин
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-pine-500 focus:ring-2 focus:ring-pine-100"
                placeholder="analyst"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-pine-500 focus:ring-2 focus:ring-pine-100"
                placeholder="••••••••"
              />
            </div>

            {error && <ErrorNote message={error} />}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine-800 py-3 text-sm font-bold text-white transition hover:bg-pine-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <IconLoader className="h-4 w-4 animate-spin" />}
              Войти
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-xs text-slate-500">
            Демо-доступ: логин <span className="font-mono font-semibold">analyst</span>,
            пароль <span className="font-mono font-semibold">azbuka2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
