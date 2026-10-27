"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { TransactionForm } from "@/components/finance/transaction-form";
import {
  getFinancialCategories,
  getProjects,
  requireUser,
} from "@/lib/page-api";

async function loadPage() {
  const user = await requireUser();
  const [projects, categories] = await Promise.all([
    getProjects("active"),
    getFinancialCategories(true),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <Link href="/dashboard/finance" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">Volver a finanzas</Link>
      <div className="mt-4 rounded-[1.75rem] border border-brand-border bg-brand-surface p-6 shadow-[0_18px_55px_rgba(72,73,39,0.08)] sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Nuevo movimiento</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-brand-primary sm:text-5xl">Registrar gasto o inversión</h1>
        <p className="mt-4 max-w-2xl leading-7 text-brand-muted">El proyecto es obligatorio. La fotografía de la factura es opcional y quedará vinculada directamente a este movimiento.</p>
        <TransactionForm projects={projects} categories={categories} role={user.role} today={today} />
      </div>
    </div>
  );
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
