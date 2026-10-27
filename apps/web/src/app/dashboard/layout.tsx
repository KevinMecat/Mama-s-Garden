"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { getCurrentUser } from "@/lib/auth-api";
import { isDemoMode } from "@/lib/api-client";
import { resetDemo } from "@/lib/demo-api";
import type { AuthUser } from "@/types/auth";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getCurrentUser()
        .then((value) => {
          if (!active) return;
          if (!value) {
            setUser(undefined);
            router.replace("/login");
          } else {
            setError(false);
            setUser(value);
          }
        })
        .catch(() => {
          if (active) {
            setUser(undefined);
            setError(true);
          }
        });
    };
    refresh();
    window.addEventListener("finca:auth-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("finca:auth-changed", refresh);
    };
  }, [router]);
  if (error)
    return (
      <p role="alert" className="p-8">
        El servicio de datos no está disponible. Intenta nuevamente más tarde.
      </p>
    );
  if (!user)
    return (
      <p role="status" className="p-8">
        Verificando sesión…
      </p>
    );
  return (
    <div className="min-h-svh bg-[#f3f0e6] md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <DashboardNavigation user={user} />
      <main className="min-w-0">
        {isDemoMode() && (
          <aside className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950">
            <span>
              <strong>Modo Demostración / Offline</strong> · Datos ficticios
              guardados solo en este navegador. No ingreses datos reales.
            </span>
            <button
              type="button"
              onClick={resetDemo}
              className="rounded border border-amber-400 px-3 py-2 font-semibold"
            >
              Restablecer demo
            </button>
          </aside>
        )}
        {children}
      </main>
    </div>
  );
}
