"use client";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import { EmployeeForm } from "@/components/payroll/employee-form";
import { todayInGuatemala } from "@/lib/date";
import { getEmployee, getSalaryRates, requireAdministrator } from "@/lib/page-api";

async function loadPage({ params }: ClientPageProps) {
  await requireAdministrator();
  const { id } = await params;
  const [employee, rates] = await Promise.all([getEmployee(id), getSalaryRates(id)]);
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Personal</p><h1 className="mt-3 font-sans text-3xl font-semibold text-brand-ink">Editar trabajador</h1><EmployeeForm employee={employee} rates={rates} today={todayInGuatemala()} /></div></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
