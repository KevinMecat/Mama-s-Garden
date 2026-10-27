"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { createPayrollPeriod, payPayrollPeriod, PayrollApiError } from "@/lib/payroll-api";
import type { FinancialCategory } from "@/types/finance";
import type { PayrollPeriod } from "@/types/payroll";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "USD" });

export function PayrollCalculator({ categories, initialPeriods, today }: { categories: FinancialCategory[]; initialPeriods: PayrollPeriod[]; today: string }) {
  const [periods, setPeriods] = useState(initialPeriods);
  const [period, setPeriod] = useState<PayrollPeriod | null>(initialPeriods.find(item => item.status !== "PAID") ?? null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const created = await createPayrollPeriod(startDate, endDate);
      if (created) { setPeriod(created); setPeriods(current => [created, ...current]); }
    } catch (reason) { setError(reason instanceof PayrollApiError ? reason.message : "No se pudo calcular."); }
    finally { setBusy(false); }
  }

  async function pay() {
    if (!period || !category) { setError("Selecciona una categoría financiera para contabilizar la nómina."); return; }
    if (!window.confirm("¿Aprobar y pagar esta planilla? La asistencia y los importes quedarán bloqueados.")) return;
    setBusy(true); setError("");
    try {
      const paid = await payPayrollPeriod(period.id, Number(category));
      if (paid) { setPeriod(paid); setPeriods(current => current.map(item => item.id === paid.id ? paid : item)); }
    } catch (reason) { setError(reason instanceof PayrollApiError ? reason.message : "No se pudo pagar."); }
    finally { setBusy(false); }
  }

  return <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
    <div className="space-y-5"><form onSubmit={calculate} className="rounded-2xl border border-brand-border bg-white p-5"><h2 className="font-sans text-2xl font-semibold text-brand-ink">Generar período</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><div><label htmlFor="payroll-start" className="text-sm font-semibold text-brand-ink">Desde</label><input id="payroll-start" type="date" required value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-ink" /></div><div><label htmlFor="payroll-end" className="text-sm font-semibold text-brand-ink">Hasta</label><input id="payroll-end" type="date" required value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-ink" /></div></div><button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Calculando…" : "Calcular planilla"}</button></form>
      {periods.length ? <section className="rounded-2xl border border-brand-border bg-white p-5"><h2 className="font-sans text-xl font-semibold text-brand-ink">Períodos</h2><div className="mt-4 grid gap-2">{periods.map(item => <button key={item.id} type="button" onClick={() => setPeriod(item)} className={`rounded-xl border p-3 text-left text-sm ${period?.id === item.id ? "border-brand-primary bg-brand-cream" : "border-brand-border"}`}><span className="block font-semibold text-brand-ink">{item.start_date} — {item.end_date}</span><span className="mt-1 block text-brand-muted">{item.status_label} · {money.format(Number(item.summary.grand_total))}</span></button>)}</div></section> : null}
    </div>
    <section className="rounded-2xl border border-brand-border bg-white p-5 sm:p-7"><h2 className="font-sans text-2xl font-semibold text-brand-ink">Vista previa</h2>{period ? <><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-brand-cream/60 p-4"><p className="text-xs font-semibold text-brand-muted">Total</p><p className="mt-2 font-sans text-2xl font-semibold text-brand-ink">{money.format(Number(period.summary.grand_total))}</p></div><div className="rounded-xl bg-brand-cream/60 p-4"><p className="text-xs font-semibold text-brand-muted">Trabajadores</p><p className="mt-2 font-sans text-2xl font-semibold text-brand-ink">{period.summary.employees.length}</p></div><div className="rounded-xl bg-brand-cream/60 p-4"><p className="text-xs font-semibold text-brand-muted">Proyectos</p><p className="mt-2 font-sans text-2xl font-semibold text-brand-ink">{period.summary.projects.length}</p></div></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[30rem] text-left text-sm"><thead className="text-xs uppercase text-brand-muted"><tr><th className="pb-3">Empleado</th><th className="pb-3">Días</th><th className="pb-3 text-right">A pagar</th></tr></thead><tbody>{period.summary.employees.map(row => <tr key={row.employee} className="border-t border-brand-border"><td className="py-3 font-semibold text-brand-ink">{row.employee_name}</td><td className="py-3 text-brand-muted">{row.worked_days}</td><td className="py-3 text-right font-semibold text-brand-ink">{money.format(Number(row.total_amount))}</td></tr>)}</tbody></table></div>{period.status !== "PAID" ? <div className="mt-6 border-t border-brand-border pt-5"><label htmlFor="payroll-category" className="text-sm font-semibold text-brand-ink">Categoría financiera del gasto</label><select id="payroll-category" value={category} onChange={event => setCategory(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-ink"><option value="">Selecciona una categoría</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!categories.length ? <p className="mt-2 text-sm text-amber-800">Crea una categoría activa en <Link href="/dashboard/finance/categories" className="font-semibold underline">Finanzas</Link>.</p> : null}<button type="button" onClick={pay} disabled={busy || !categories.length} className="mt-4 min-h-12 w-full rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Procesando…" : "Aprobar y pagar"}</button></div> : <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Planilla pagada y contabilizada por proyecto.</p>}</> : <div className="mt-8 rounded-xl border border-dashed border-brand-border p-10 text-center text-brand-muted">Selecciona fechas y calcula la primera planilla.</div>}{error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}</section>
  </div>;
}
