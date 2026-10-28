"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readCompetencyProfiles, type CompetencyProfile } from "@/lib/firebase-competencies";
import { isAbsence } from "@/lib/firebase-attendance";
import { getWorkerDailyAvailability } from "@/lib/workforce-availability";
import type { WorkTask } from "@/lib/firebase-workforce-domain";
import type { CloudRow } from "@/lib/firebase-client";
import type { AuthUser } from "@/types/auth";

type Assignment = { workerId: string; taskId: string; slot: number; hours: number };
type Result = { feasible: boolean; assignments: Assignment[] };
const weights = { low: 1, normal: 3, high: 6, urgent: 10 };
const normalizeActivity = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("es");

export function DailyPlanner({ user, date, workers, attendance, tasks }: { user: AuthUser; date: string; workers: CloudRow[]; attendance: CloudRow[]; tasks: WorkTask[] }) {
  const [profiles, setProfiles] = useState<CompetencyProfile[]>();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [fixed, setFixed] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<Record<string, WorkTask["priority"]>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [tools, setTools] = useState<Record<string, number>>({});
  const [baseline, setBaseline] = useState<Result>();
  const [scenario, setScenario] = useState<Result>();
  const [computedKey, setComputedKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => { let active = true; void readCompetencyProfiles(user).then((value) => { if (active) setProfiles(value); }).catch(() => { if (active) setError("No se pudieron cargar las competencias."); }); return () => { active = false; }; }, [user]);
  const candidates = useMemo(() => tasks.filter((task) => task.status === "todo" && !task.isCancelled && !task.isBlocked && task.logCount === 0 && typeof task.estimatedHours === "number" && Number.isFinite(task.estimatedHours) && task.estimatedHours > 0 && Array.isArray(task.assignees) && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)), [tasks]);
  const stateKey = JSON.stringify({ date, excluded, fixed, priorities, dates, tools, workers, attendance, tasks, profiles });
  const toolNames = [...new Set(candidates.map((task) => task.limitingTools?.trim()).filter((value): value is string => Boolean(value)))];
  const input = useCallback((simulated: boolean) => {
    const activeCandidates = candidates.filter((task) => !fixed.includes(task.id) && !/[;,]/.test(task.limitingTools ?? "") && (simulated ? dates[task.id] ?? task.dueDate : task.dueDate) <= date);
    const activeIds = new Set(activeCandidates.map((task) => task.id));
    return {
      slots: 16,
      workers: workers.filter((worker) => worker.status === "active").map((worker) => {
        const present = attendance.find((row) => row.workerId === worker.id && row.date === date);
        const committed = tasks.filter((task) => !activeIds.has(task.id)).map((task) => fixed.includes(task.id) && task.dueDate <= date ? { ...task, dueDate: date } : task);
        const available = getWorkerDailyAvailability(worker.id, date, attendance, committed, { shiftHours: present?.status === "half" ? 4 : 8 });
        const profile = profiles?.find((entry) => entry.workerId === worker.id);
        return { id: worker.id, present: Boolean(present && ["present", "late", "half"].includes(String(present.status)) && !isAbsence(String(present.status)) && present.pendingConfirmation !== true) && !(simulated && excluded.includes(worker.id)), availableHours: available.availableHours, skills: Object.fromEntries(Object.entries(profile?.competencies ?? {}).map(([activity, level]) => [normalizeActivity(activity), level === "autonomous" ? "independent" : "assisted"])) };
      }),
      tasks: activeCandidates.map((task) => ({ id: task.id, activity: normalizeActivity(task.activity), hours: task.estimatedHours! * Math.max(1, task.assignees.length), priority: weights[simulated ? priorities[task.id] ?? task.priority : task.priority], tool: task.limitingTools?.trim() || undefined })),
      toolCapacities: Object.fromEntries([...new Set(activeCandidates.map((task) => task.limitingTools?.trim()).filter((value): value is string => Boolean(value)))].map((tool) => {
        const reserved = tasks.filter((task) => !activeIds.has(task.id) && !task.isCancelled && task.status !== "done" && (task.dueDate === date || (fixed.includes(task.id) && task.dueDate <= date)) && task.limitingTools?.trim() === tool).length;
        return [tool, Math.max(0, (simulated ? tools[tool] ?? 1 : 1) - reserved)];
      })),
    };
  }, [attendance, candidates, date, dates, excluded, fixed, priorities, profiles, tasks, tools, workers]);
  const solve = useCallback((model: ReturnType<typeof input>): Promise<Result> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("../../workers/daily-planner.worker.ts", import.meta.url));
      const timer = window.setTimeout(() => { worker.terminate(); reject(Error("El cálculo excedió el límite de seis segundos.")); }, 6000);
      worker.onmessage = (event: MessageEvent<{ result?: Result; error?: string }>) => { window.clearTimeout(timer); worker.terminate(); if (event.data.result) resolve(event.data.result); else reject(Error(event.data.error || "Cálculo no disponible.")); };
      worker.onerror = () => { window.clearTimeout(timer); worker.terminate(); reject(Error("No se pudo iniciar el cálculo.")); };
      worker.postMessage(model);
    });
  }, []);
  const calculate = useCallback(async () => {
    if (!profiles) return;
    const request = ++generation.current;
    setBusy(true); setError(""); setBaseline(undefined); setScenario(undefined);
    try { const [base, whatIf] = await Promise.all([solve(input(false)), solve(input(true))]); if (request === generation.current) { setBaseline(base); setScenario(whatIf); setComputedKey(stateKey); } }
    catch (failure) { if (request === generation.current) setError(failure instanceof Error ? failure.message : "No se pudo calcular."); }
    finally { if (request === generation.current) setBusy(false); }
  }, [input, profiles, solve, stateKey]);
  useEffect(() => {
    if (!profiles) return;
    const counter = generation;
    const timer = window.setTimeout(() => void calculate(), 300);
    return () => { window.clearTimeout(timer); counter.current++; };
  }, [calculate, profiles]);
  const summary = (result: Result, simulated: boolean) => {
    const model = input(simulated);
    const hours = result.assignments.reduce((sum, row) => sum + row.hours, 0);
    const required = model.tasks.reduce((sum, task) => sum + task.hours, 0);
    const covered = model.tasks.filter((task) => result.assignments.filter((row) => row.taskId === task.id).reduce((sum, row) => sum + row.hours, 0) >= task.hours).length;
    return { hours, covered, pending: Math.max(0, required - hours), taskCount: model.tasks.length };
  };
  function explanation(result: Result) {
    const model = input(true);
    return model.tasks.flatMap((task) => {
      const assigned = result.assignments.filter((row) => row.taskId === task.id).reduce((sum, row) => sum + row.hours, 0);
      const missing = Math.max(0, task.hours - assigned);
      if (!missing) return [];
      const eligible = model.workers.filter((worker) => worker.present && worker.availableHours > 0 && worker.skills[task.activity]);
      const reason = task.tool && model.toolCapacities[task.tool] === 0 ? `herramienta ${task.tool} no disponible en esta estimación` : !eligible.length ? "sin personal presente con competencia y horas disponibles" : "capacidad, acompañamiento o herramienta insuficiente";
      return [`${tasks.find((item) => item.id === task.id)?.title ?? "Tarea"}: faltan ${missing.toFixed(1)} h-persona; ${reason}.`];
    });
  }
  return <section className="space-y-4">
    <p className="text-xs text-neutral-500">Fecha {date}. Usa asistencia confirmada, competencias registradas y estimaciones por persona. La fecha límite aproxima el día de trabajo; los bloques no son horarios reales. Las herramientas de tareas fijas se reservan de forma conservadora para toda la jornada. Los registros sin competencias no se asignan.</p>
    {tasks.some((task) => task.status === "todo" && !task.isCancelled && (typeof task.estimatedHours !== "number" || !Number.isFinite(task.estimatedHours) || task.estimatedHours <= 0 || !Array.isArray(task.assignees) || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate))) && <p className="text-xs text-amber-700">Hay tareas sin fecha o estimación válidas; se excluyen hasta completar sus datos.</p>}
    {candidates.some((task) => /[;,]/.test(task.limitingTools ?? "")) && <p className="text-xs text-amber-700">Las tareas con varias herramientas en un solo campo se excluyen hasta registrar sus recursos por separado.</p>}
    <details><summary className="cursor-pointer font-semibold">Simular cambios</summary>
      <div className="mt-3 space-y-3 text-xs">
        {workers.filter((w) => w.status === "active").map((worker) => <label key={worker.id} className="flex gap-2"><input type="checkbox" checked={excluded.includes(worker.id)} onChange={(event) => setExcluded(event.target.checked ? [...excluded, worker.id] : excluded.filter((id) => id !== worker.id))} />Simular ausencia: {String(worker.firstName ?? "")} {String(worker.lastName ?? "")}</label>)}
        {toolNames.map((tool) => <label key={tool} className="flex items-center gap-2">{tool} · cantidad <input type="number" min="0" max="100" className="f-input w-20" value={tools[tool] ?? 1} onChange={(event) => setTools({ ...tools, [tool]: Number(event.target.value) })} /></label>)}
        {candidates.map((task) => <div key={task.id} className="rounded-lg border p-2"><p className="font-semibold">{task.title}</p><label className="mr-2">Prioridad <select value={priorities[task.id] ?? task.priority} onChange={(event) => setPriorities({ ...priorities, [task.id]: event.target.value as WorkTask["priority"] })} className="f-input"><option value="low">Baja</option><option value="normal">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Fecha límite <input type="date" className="f-input" value={dates[task.id] ?? task.dueDate} onChange={(event) => setDates({ ...dates, [task.id]: event.target.value })} /></label><label className="mt-2 flex gap-2"><input type="checkbox" checked={fixed.includes(task.id)} onChange={(event) => setFixed(event.target.checked ? [...fixed, task.id] : fixed.filter((id) => id !== task.id))} />Mantener asignación actual fija</label></div>)}
      </div>
    </details>
    <button className="f-button f-primary" disabled={busy || !profiles} onClick={() => void calculate()}>{busy ? "Calculando…" : "Calcular y comparar"}</button>
    <button className="f-button" type="button" disabled title="La aplicación requiere verificar cambios concurrentes de todas las fuentes.">Aplicar propuesta</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {baseline && scenario && computedKey === stateKey && <div className="space-y-3 text-sm"><p>Base: {summary(baseline, false).hours} h asignadas, {summary(baseline, false).covered}/{summary(baseline, false).taskCount} tareas cubiertas, {summary(baseline, false).pending} h pendientes.</p><p>Escenario: {summary(scenario, true).hours} h asignadas, {summary(scenario, true).covered}/{summary(scenario, true).taskCount} tareas cubiertas, {summary(scenario, true).pending} h pendientes.</p>{!scenario.feasible ? <p>La distribución es inviable con las restricciones seleccionadas.</p> : <><ul>{scenario.assignments.map((assignment) => <li key={`${assignment.workerId}:${assignment.taskId}:${assignment.slot}`}>{String(workers.find((worker) => worker.id === assignment.workerId)?.firstName ?? "Trabajador")} · {tasks.find((task) => task.id === assignment.taskId)?.title} · bloque {assignment.slot + 1}: {assignment.hours} h</li>)}</ul>{explanation(scenario).map((line) => <p key={line} className="text-xs text-amber-700">{line}</p>)}<p className="text-xs text-neutral-500">Los bloques son orientativos. Revisa personal, competencias y herramientas para las horas no cubiertas.</p></>}<p className="text-xs text-amber-700">Vista previa experimental: la aplicación al tablero está pendiente de validación transaccional.</p></div>}
  </section>;
}
