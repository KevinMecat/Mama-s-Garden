"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { getCurrentUser } from "@/lib/auth-api";
import { isFirebaseMode } from "@/lib/api-client";
import { FirebaseWorkspace } from "@/components/firebase/firebase-workspace";
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
    <div className="min-h-svh bg-background font-sans text-neutral-900">
      <DashboardNavigation user={user} />
      <main id="dashboard-content" className="min-w-0 pt-14 lg:ml-60">
        {isFirebaseMode() ? (
          <Suspense
            fallback={
              <p role="status" className="p-8">
                Cargando datos de la finca…
              </p>
            }
          >
            <FirebaseWorkspace user={user} />
          </Suspense>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
