import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth";
import { IconLogout } from "./Icons";

const ROLE_LABELS: Record<string, string> = {
  analyst: "Категорийный аналитик",
  category_manager: "Руководитель категории",
  admin: "Администратор",
};

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const cls =
    size === "lg"
      ? "h-14 w-14 rounded-2xl text-2xl"
      : "h-9 w-9 rounded-xl text-sm";
  return (
    <div
      className={`flex items-center justify-center bg-pine-900 font-serif font-bold text-gold-400 ring-1 ring-gold-500/40 ${cls}`}
    >
      АВ
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-pine-800/60 bg-pine-900 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="text-sm font-bold leading-tight tracking-wide">
                Азбука Вкуса
              </div>
              <div className="text-xs leading-tight text-pine-200">
                Ценовой контур · динамическое ценообразование
              </div>
            </div>
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold leading-tight">{user.full_name}</div>
                <div className="text-xs leading-tight text-pine-200">
                  {ROLE_LABELS[user.role] ?? user.role}
                </div>
              </div>
              <button
                onClick={logout}
                title="Выйти"
                className="rounded-xl border border-pine-700 p-2 text-pine-100 transition hover:border-pine-500 hover:bg-pine-800"
              >
                <IconLogout className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
