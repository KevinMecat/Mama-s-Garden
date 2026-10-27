"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/auth-api";
import type { AuthUser } from "@/types/auth";

const activeLinks = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/projects", label: "Proyectos", exact: false },
  { href: "/dashboard/finance", label: "Finanzas", exact: false },
  { href: "/dashboard/products", label: "Productos", exact: false },
  { href: "/dashboard/production", label: "Producción", exact: false },
  { href: "/dashboard/sales", label: "Ventas", exact: false },
  { href: "/dashboard/employees", label: "Personal", exact: false },
  { href: "/dashboard/attendance", label: "Asistencia", exact: false },
  { href: "/dashboard/payroll", label: "Nómina", exact: false },
];

const upcomingLinks: string[] = [];

export function DashboardNavigation({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isClosingSession, setIsClosingSession] = useState(false);

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  async function handleLogout() {
    setIsClosingSession(true);
    try {
      await logout();
      window.dispatchEvent(new Event("finca:auth-changed"));
      router.replace("/");
      router.refresh();
    } finally {
      setIsClosingSession(false);
    }
  }

  const displayName = user.first_name.trim() || user.email;

  return (
    <aside className="border-b border-brand-border bg-brand-primary text-white md:sticky md:top-0 md:flex md:h-svh md:flex-col md:border-r md:border-b-0">
      <div className="flex min-h-18 items-center justify-between gap-3 px-4 sm:px-6 md:px-5">
        <Link
          href="/dashboard"
          aria-label="Ir al dashboard de Mama's Garden"
          className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-paper">
            <Image src="/brand/logo.svg" alt="" width={38} height={38} className="size-9" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-semibold">Mama&apos;s Garden</span>
            <span className="block text-xs text-white/60">Gestión de finca</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 md:hidden">
          <span className="hidden rounded-md border border-white/15 px-2 py-1 text-[0.65rem] font-bold tracking-wide text-white/70 min-[430px]:inline-flex">
            {user.role_label}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isClosingSession}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-3 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isClosingSession ? "Cerrando…" : "Salir"}
          </button>
        </div>
      </div>

      <nav aria-label="Navegación del dashboard" className="overflow-x-auto px-4 pb-3 sm:px-6 md:px-4 md:py-6">
        <div className="flex min-w-max gap-2 md:min-w-0 md:flex-col">
          {activeLinks.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? "bg-brand-paper text-brand-primary" : "text-white/78 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {upcomingLinks.map((label) => (
            <span
              key={label}
              aria-disabled="true"
              title="Disponible en una fase posterior"
              className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/38"
            >
              {label}
              <span className="text-[0.62rem] font-bold uppercase tracking-wider">Próximo</span>
            </span>
          ))}
        </div>
      </nav>

      <div className="hidden mt-auto border-t border-white/10 p-4 md:block">
        <div className="rounded-2xl bg-white/7 p-4">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="mt-1 text-xs text-white/55">{user.role_label}</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isClosingSession}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/20 px-3 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isClosingSession ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </aside>
  );
}
