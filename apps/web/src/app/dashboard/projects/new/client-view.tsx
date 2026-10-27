"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { ProjectForm } from "@/components/projects/project-form";
import { requireAdministrator } from "@/lib/page-api";

async function loadPage() {
  await requireAdministrator();

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <Link href="/dashboard/projects" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
        Volver a proyectos
      </Link>
      <div className="mt-4 rounded-[1.75rem] border border-brand-border bg-brand-surface p-6 shadow-[0_18px_55px_rgba(72,73,39,0.08)] sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Nuevo centro de costos</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-brand-primary sm:text-5xl">Crear proyecto</h1>
        <p className="mt-4 max-w-2xl leading-7 text-brand-muted">
          Define la iniciativa antes de registrar movimientos. Luego podrás asignar trabajadores y operaciones financieras sin mezclar fondos.
        </p>
        <ProjectForm />
      </div>
    </div>
  );
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
