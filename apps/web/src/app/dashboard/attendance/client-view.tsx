"use client";
import { ClientPage } from "@/components/client-page";
import { AttendanceBoard } from "@/components/payroll/attendance-board";
import { todayInGuatemala } from "@/lib/date";
import { getEmployees, getProjects, getWorkEntries, requireUser } from "@/lib/page-api";

async function loadPage() {
  await requireUser();
  const today = todayInGuatemala();
  const [employees, projects, entries] = await Promise.all([getEmployees(true), getProjects("active"), getWorkEntries(today)]);
  return <div className="mx-auto max-w-5xl px-4 py-7 sm:px-8 lg:px-10 lg:py-12"><header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Registro diario</p><h1 className="mt-3 font-sans text-3xl font-semibold text-brand-ink sm:text-4xl">Asistencia</h1><p className="mt-4 text-lg leading-8 text-brand-muted">Marca la jornada y el proyecto al que debe cargarse el costo de cada trabajador.</p></header><AttendanceBoard employees={employees} projects={projects} initialDate={today} initialEntries={entries} /></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
