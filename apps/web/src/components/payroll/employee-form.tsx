"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  createEmployee,
  deleteEmployee,
  PayrollApiError,
  updateEmployee,
} from "@/lib/payroll-api";
import type { Employee, SalaryRate } from "@/types/payroll";

interface EmployeeFormProps {
  employee?: Employee;
  rates?: SalaryRate[];
  today: string;
}

const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

export function EmployeeForm({ employee, rates = [], today }: EmployeeFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newRate, setNewRate] = useState("");
  const [rateDate, setRateDate] = useState(today);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const input = {
        first_name: String(form.get("first_name") ?? "").trim(),
        last_name: String(form.get("last_name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        hire_date: String(form.get("hire_date")),
        is_active: form.get("is_active") === "on",
        ...(newRate ? { new_daily_rate: newRate, rate_valid_from: rateDate } : {}),
      };
      if (employee) await updateEmployee(employee.id, input);
      else await createEmployee(input);
      router.replace("/dashboard/employees");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof PayrollApiError ? reason.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!employee || !window.confirm("¿Eliminar este empleado? Si tiene historial deberás desactivarlo.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteEmployee(employee.id);
      router.replace("/dashboard/employees");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof PayrollApiError ? reason.message : "No se pudo eliminar.");
      setBusy(false);
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-primary outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  const labelClass = "text-sm font-semibold text-brand-primary";

  return <form onSubmit={submit} className="mt-8 space-y-6">
    <div className="grid gap-5 sm:grid-cols-2">
      <div><label htmlFor="first_name" className={labelClass}>Nombres</label><input id="first_name" name="first_name" required maxLength={100} defaultValue={employee?.first_name} className={inputClass} /></div>
      <div><label htmlFor="last_name" className={labelClass}>Apellidos</label><input id="last_name" name="last_name" required maxLength={100} defaultValue={employee?.last_name} className={inputClass} /></div>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div><label htmlFor="phone" className={labelClass}>Teléfono</label><input id="phone" name="phone" type="tel" maxLength={30} defaultValue={employee?.phone} className={inputClass} /></div>
      <div><label htmlFor="hire_date" className={labelClass}>Fecha de contratación</label><input id="hire_date" name="hire_date" type="date" required defaultValue={employee?.hire_date ?? today} className={inputClass} /></div>
    </div>
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-border bg-brand-cream/40 px-4 text-sm font-semibold text-brand-primary"><input name="is_active" type="checkbox" defaultChecked={employee?.is_active ?? true} className="size-5 accent-brand-primary" />Empleado activo</label>

    <fieldset className="rounded-2xl border border-brand-border bg-brand-paper p-5">
      <legend className="px-2 font-display text-xl font-semibold text-brand-primary">{employee ? "Nueva tarifa salarial" : "Tarifa salarial inicial"}</legend>
      {employee ? <p className="mt-1 text-sm text-brand-muted">Déjalo vacío si no cambiarás el salario. Una tarifa nueva cerrará automáticamente la vigencia anterior.</p> : null}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="new_daily_rate" className={labelClass}>Salario diario (GTQ)</label><input id="new_daily_rate" name="new_daily_rate" type="number" inputMode="decimal" min="0.01" step="0.01" required={!employee} value={newRate} onChange={event => setNewRate(event.target.value)} className={inputClass} /></div>
        <div><label htmlFor="rate_valid_from" className={labelClass}>Vigente desde</label><input id="rate_valid_from" name="rate_valid_from" type="date" required={!employee || Boolean(newRate)} value={rateDate} onChange={event => setRateDate(event.target.value)} className={inputClass} /></div>
      </div>
    </fieldset>

    {rates.length ? <section aria-labelledby="salary-history-title"><h2 id="salary-history-title" className="font-display text-xl font-semibold text-brand-primary">Historial salarial</h2><div className="mt-3 grid gap-2">{rates.map(rate => <div key={rate.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm"><span className="font-semibold text-brand-primary">{money.format(Number(rate.daily_rate))} diarios</span><span className="text-brand-muted">{rate.valid_from} — {rate.valid_to ?? "Actual"}</span></div>)}</div></section> : null}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-between"><div>{employee ? <button type="button" onClick={remove} disabled={busy} className="min-h-12 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button> : null}</div><div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href="/dashboard/employees" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-bold text-brand-primary">Cancelar</Link><button disabled={busy} className="min-h-12 rounded-xl bg-brand-primary px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : employee ? "Guardar cambios" : "Agregar trabajador"}</button></div></div>
  </form>;
}
