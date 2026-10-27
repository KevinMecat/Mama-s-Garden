"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { getEmployees, requireAdministrator } from "@/lib/page-api";
const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

async function loadPage() {
  await requireAdministrator();
  const employees = await getEmployees();
  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Recursos humanos</p><h1 className="mt-3 font-sans text-3xl font-semibold text-brand-ink sm:text-4xl">Personal</h1><p className="mt-4 text-lg text-brand-muted">Administra trabajadores y conserva el historial de sus salarios diarios.</p></div><Link href="/dashboard/employees/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white">Agregar trabajador</Link></header>
    {employees.length ? <div className="mt-9 grid gap-4 sm:grid-cols-2">{employees.map(employee => <article key={employee.id} className="rounded-2xl border border-brand-border bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-sans text-xl font-semibold text-brand-ink">{employee.full_name}</h2><p className="mt-1 text-sm text-brand-muted">{employee.phone || "Sin teléfono"}</p></div><span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand-ink">{employee.is_active ? "Activo" : "Inactivo"}</span></div><dl className="mt-5 grid grid-cols-2 gap-4 border-t border-brand-border pt-4 text-sm"><div><dt className="text-brand-muted">Contratación</dt><dd className="mt-1 font-semibold text-brand-ink">{employee.hire_date}</dd></div><div><dt className="text-brand-muted">Tarifa actual</dt><dd className="mt-1 font-semibold text-brand-ink">{employee.current_daily_rate ? `${money.format(Number(employee.current_daily_rate))}/día` : "Sin tarifa"}</dd></div></dl><Link href={`/dashboard/employees/edit?id=${employee.id}`} className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand-secondary hover:underline">Editar trabajador</Link></article>)}</div> : <div className="mt-10 rounded-xl border border-dashed border-brand-border bg-white px-6 py-14 text-center"><h2 className="font-sans text-2xl font-semibold text-brand-ink">No hay empleados registrados aún.</h2><p className="mt-2 text-brand-muted">Presiona “Agregar trabajador” para crear el primero.</p></div>}
  </div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
