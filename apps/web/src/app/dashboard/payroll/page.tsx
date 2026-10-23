import { PayrollCalculator } from "@/components/payroll/payroll-calculator";
import { todayInGuatemala } from "@/lib/date";
import { getServerFinancialCategories, getServerPayrollPeriods, requireAdministrator } from "@/lib/server-api";

export const metadata = { title: "Nómina" };
export default async function PayrollPage() {
  await requireAdministrator();
  const [categories, periods] = await Promise.all([getServerFinancialCategories(true), getServerPayrollPeriods()]);
  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><header><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Planilla automatizada</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary sm:text-5xl">Nómina</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-brand-muted">Calcula según asistencia y tarifas vigentes. Al pagar, cada proyecto recibe únicamente su gasto laboral correspondiente.</p></header><PayrollCalculator categories={categories} initialPeriods={periods} today={todayInGuatemala()} /></div>;
}
