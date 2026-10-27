"use client";

import { useMemo, useState } from "react";

import { getAttendance, PayrollApiError, saveBulkAttendance } from "@/lib/payroll-api";
import type { Employee, WorkEntry, WorkEntryStatus } from "@/types/payroll";
import type { Project } from "@/types/project";

interface AttendanceRow {
  project: string;
  status: WorkEntryStatus;
}

const statuses: Array<{ value: WorkEntryStatus; label: string }> = [
  { value: "PRESENT", label: "Presente" },
  { value: "HALF_DAY", label: "½ día" },
  { value: "ABSENT", label: "Ausente" },
];

function makeRows(employees: Employee[], entries: WorkEntry[]) {
  return Object.fromEntries(employees.map(employee => {
    const entry = entries.find(item => item.employee === employee.id);
    return [employee.id, { project: entry ? String(entry.project) : "", status: entry?.status ?? "PRESENT" }];
  })) as Record<number, AttendanceRow>;
}

export function AttendanceBoard({ employees, projects, initialDate, initialEntries }: { employees: Employee[]; projects: Project[]; initialDate: string; initialEntries: WorkEntry[] }) {
  const [workDate, setWorkDate] = useState(initialDate);
  const [rows, setRows] = useState(() => makeRows(employees, initialEntries));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const ready = employees.length > 0 && projects.length > 0;
  const allAssigned = useMemo(() => employees.every(employee => rows[employee.id]?.project), [employees, rows]);

  async function changeDate(value: string) {
    setWorkDate(value);
    setLoading(true);
    setMessage("");
    try {
      const entries = value === initialDate ? initialEntries : await getAttendance(value);
      setRows(makeRows(employees, entries));
    } catch (reason) {
      setMessage(reason instanceof PayrollApiError ? reason.message : "No se pudo cargar la fecha.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(employeeId: number, values: Partial<AttendanceRow>) {
    setRows(current => ({ ...current, [employeeId]: { ...current[employeeId], ...values } }));
  }

  async function save() {
    if (!allAssigned) { setMessage("Selecciona un proyecto para cada trabajador."); return; }
    setSaving(true); setMessage("");
    try {
      await saveBulkAttendance({ work_date: workDate, entries: employees.map(employee => ({ employee: employee.id, project: Number(rows[employee.id].project), status: rows[employee.id].status })) });
      setMessage("Asistencia guardada correctamente.");
    } catch (reason) {
      setMessage(reason instanceof PayrollApiError ? reason.message : "No se pudo guardar la asistencia.");
    } finally { setSaving(false); }
  }

  if (!employees.length) return <div className="mt-8 rounded-2xl border border-dashed border-brand-border bg-white p-10 text-center"><h2 className="font-sans text-2xl font-semibold text-brand-ink">No hay empleados activos.</h2><p className="mt-2 text-brand-muted">Agrega tu primer trabajador desde Personal.</p></div>;

  return <div className="mt-8">
    <div className="sticky top-0 z-10 rounded-2xl border border-brand-border bg-brand-paper/95 p-4 shadow-sm backdrop-blur sm:flex sm:items-end sm:justify-between sm:gap-5"><div className="w-full sm:max-w-xs"><label htmlFor="work-date" className="text-sm font-semibold text-brand-ink">Fecha de asistencia</label><input id="work-date" type="date" value={workDate} onChange={event => void changeDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-ink outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25" /></div><button type="button" onClick={save} disabled={!ready || !allAssigned || saving || loading} className="mt-4 min-h-12 w-full rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white disabled:opacity-50 sm:mt-0 sm:w-auto">{saving ? "Guardando…" : "Guardar asistencia"}</button></div>
    {loading ? <p className="mt-4 text-sm text-brand-muted">Cargando asistencia…</p> : null}
    <div className="mt-5 grid gap-4">{employees.map(employee => { const row = rows[employee.id]; return <article key={employee.id} className="rounded-2xl border border-brand-border bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-sans text-xl font-semibold text-brand-ink">{employee.full_name}</h2><span className="text-xs font-semibold text-brand-muted">{employee.current_daily_rate ? `$${employee.current_daily_rate}/día` : "Sin tarifa"}</span></div><div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={`Estado de ${employee.full_name}`}>{statuses.map(status => <button key={status.value} type="button" onClick={() => updateRow(employee.id, { status: status.value })} aria-pressed={row?.status === status.value} className={`min-h-11 rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${row?.status === status.value ? "bg-brand-primary text-white" : "border border-brand-border bg-brand-paper text-brand-ink"}`}>{status.label}</button>)}</div><label htmlFor={`project-${employee.id}`} className="mt-4 block text-sm font-semibold text-brand-ink">Cargar tiempo al proyecto</label><select id={`project-${employee.id}`} value={row?.project ?? ""} onChange={event => updateRow(employee.id, { project: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-3 text-brand-ink outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25"><option value="">Selecciona un proyecto</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></article>; })}</div>
    {message ? <p role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${message.includes("correctamente") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{message}</p> : null}
  </div>;
}
