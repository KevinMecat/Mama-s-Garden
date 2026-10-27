"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, logout } from "@/lib/auth-api";
import type { AuthUser } from "@/types/auth";

export const AUTH_CHANGED_EVENT = "finca:auth-changed";

export function AuthControls() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>();
  const [isClosingSession, setIsClosingSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        if (isMounted) setUser(currentUser);
      } catch {
        if (isMounted) setUser(null);
      }
    }

    function handleAuthChange() {
      void loadUser();
    }

    void loadUser();
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      isMounted = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, []);

  async function handleLogout() {
    setIsClosingSession(true);

    try {
      await logout();
      setUser(null);
      router.replace("/");
      router.refresh();
    } finally {
      setIsClosingSession(false);
    }
  }

  if (user === undefined) {
    return (
      <span
        aria-label="Verificando sesión"
        className="h-11 w-28 animate-pulse rounded-full bg-brand-soft"
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:px-5"
      >
        Iniciar sesión
      </Link>
    );
  }

  const displayName = user.first_name.trim() || user.email;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden max-w-48 text-right sm:block">
        <p className="truncate text-sm font-semibold text-brand-ink">{displayName}</p>
        <p className="text-xs text-brand-muted">{user.role_label}</p>
      </div>
      <Link
        href="/dashboard"
        className="hidden min-h-11 items-center justify-center rounded-full bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary lg:inline-flex"
      >
        Dashboard
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isClosingSession}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-border bg-white px-4 text-sm font-semibold text-brand-ink transition hover:bg-brand-cream disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        <span className="sm:hidden">Salir</span>
        <span className="hidden sm:inline">
          {isClosingSession ? "Cerrando…" : "Cerrar sesión"}
        </span>
      </button>
    </div>
  );
}
