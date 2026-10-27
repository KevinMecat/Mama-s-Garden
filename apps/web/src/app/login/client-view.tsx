"use client";
import { ClientPage } from "@/components/client-page";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getCurrentUser } from "@/lib/page-api";
import { redirect } from "@/lib/client-navigation";

async function loadPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");

  return (
    <PublicShell>
      <div className="grid min-h-[calc(100svh-4.5rem)] bg-brand-paper lg:grid-cols-[minmax(0,1.05fr)_minmax(30rem,0.95fr)]">
      <section className="relative min-h-64 overflow-hidden lg:min-h-full">
        <Image
          src="https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=1800&q=85"
          alt="Campos cultivados rodeados de naturaleza"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/90 via-brand-primary/35 to-transparent lg:bg-gradient-to-r" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10 lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
            Gestión con propósito
          </p>
          <h1 className="mt-3 max-w-xl font-sans text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">
            Cada jornada de la finca, mejor organizada.
          </h1>
        </div>
      </section>

      <section className="flex items-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-secondary">
            Acceso privado
          </p>
          <h2 className="mt-3 font-sans text-4xl font-semibold tracking-tight text-brand-ink sm:text-5xl">
            Bienvenido de nuevo
          </h2>
          <p className="mt-4 text-base leading-7 text-brand-muted">
            Ingresa con el correo y la contraseña de tu cuenta de la finca.
          </p>

          <LoginForm />

          <p className="mt-7 text-center text-sm text-brand-muted">
            ¿Necesitas acceso? Solicítalo al administrador de la finca.
          </p>
          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>
      </div>
    </PublicShell>
  );
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
