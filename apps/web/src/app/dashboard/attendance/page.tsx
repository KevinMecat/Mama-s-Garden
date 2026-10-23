import { AttendanceBoard } from "@/components/payroll/attendance-board";
import { todayInGuatemala } from "@/lib/date";
import { getServerEmployees, getServerProjects, getServerWorkEntries, requireUser } from "@/lib/server-api";

export const metadata = { title: "Asistencia" };
export default async function AttendancePage() {
  await requireUser();
  const today = todayInGuatemala();
  const [employees, projects, entries] = await Promise.all([getServerEmployees(true), getServerProjects("active"), getServerWorkEntries(today)]);
  return <div className="mx-auto max-w-5xl px-4 py-7 sm:px-8 lg:px-10 lg:py-12"><header><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Registro diario</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary sm:text-5xl">Asistencia</h1><p className="mt-4 text-lg leading-8 text-brand-muted">Marca la jornada y el proyecto al que debe cargarse el costo de cada trabajador.</p></header><AttendanceBoard employees={employees} projects={projects} initialDate={today} initialEntries={entries} /></div>;
}
