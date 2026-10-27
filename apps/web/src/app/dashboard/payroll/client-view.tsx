"use client";
import { ClientPage } from "@/components/client-page";
import { PayrollCalculator } from "@/components/payroll/payroll-calculator";
import { todayInGuatemala } from "@/lib/date";
import { getFinancialCategories, getPayrollPeriods, requireAdministrator } from "@/lib/page-api";

async function loadPage() {
  await requireAdministrator();
  const [categories, periods] = await Promise.all([getFinancialCategories(true), getPayrollPeriods()]);
  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Planilla automatizada</p><h1 className="mt-3 font-sans text-3xl font-semibold text-brand-ink sm:text-4xl">Nómina</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-brand-muted">Calcula según asistencia y tarifas vigentes. Al pagar, cada proyecto recibe únicamente su gasto laboral correspondiente.</p></header><PayrollCalculator categories={categories} initialPeriods={periods} today={todayInGuatemala()} /></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
