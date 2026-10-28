"use client";

import { useEffect, useRef, useState } from "react";
import { calculateCriticalPath } from "@/lib/project-cpm";
import { readWorkforce } from "@/lib/firebase-workforce";
import { readProjectGraph, saveProjectDependencies, type ProjectGraph, type ProjectTask } from "@/lib/firebase-project-graph";
import { isAbsence } from "@/lib/firebase-attendance";
import { getWorkerDailyAvailability } from "@/lib/workforce-availability";
import type { AuthUser } from "@/types/auth";
import type { CloudRow } from "@/lib/firebase-client";

export function FirebaseProjectTimeline({ user, project, workers, attendance }: { user: AuthUser; project: CloudRow; workers: CloudRow[]; attendance: CloudRow[] }) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [graph, setGraph] = useState<ProjectGraph>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const pending = useRef(new Map<string, string>());
  const canPlan = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role);

  async function refresh() {
    const [work, currentGraph] = await Promise.all([readWorkforce(user), readProjectGraph(project.id)]);
    setTasks(work.tasks);
    setGraph(currentGraph);
    return { tasks: work.tasks, graph: currentGraph };
  }
  useEffect(() => {
    if (!canPlan) return;
    let active = true;
    void Promise.all([readWorkforce(user), readProjectGraph(project.id)]).then(([work, currentGraph]) => {
      if (active) { setTasks(work.tasks); setGraph(currentGraph); setLoading(false); }
    }).catch(() => { if (active) { setError("No se pudo consultar la ruta del proyecto."); setLoading(false); } });
    return () => { active = false; };
  }, [user, project.id, canPlan]);
  if (!canPlan) return null;
  if (loading) return <p role="status" className="mt-4 text-xs text-neutral-500">Consultando tareas del proyecto…</p>;
  if (!graph) return <p role="alert" className="mt-4 text-xs text-red-700">{error}</p>;
  const projectTasks = tasks.filter((task) => task.project === project.id && !task.isCancelled);
  const current = projectTasks.find((task) => task.id === selected);
  const missingDuration = projectTasks.filter((task) => task.estimatedHours === null || !Number.isFinite(task.estimatedHours) || task.estimatedHours <= 0);
  let cpm: ReturnType<typeof calculateCriticalPath> | undefined;
  let cpmError = "";
  if (projectTasks.length && !missingDuration.length) {
    try {
      cpm = calculateCriticalPath(projectTasks.map((task) => ({ id: task.id, duration: task.estimatedHours!, dependencies: graph.edges[task.id] ?? task.dependencyTaskIds ?? [] })));
    } catch (e) { cpmError = e instanceof Error ? e.message : "No se pudo calcular la ruta."; }
  }
  const days = [...new Set(projectTasks.map((task) => task.dueDate))].sort();
  async function save() {
    if (!current || locked.current) return;
    const key = JSON.stringify({ taskId: current.id, revision: current.revision, graphRevision: graph!.revision, dependencies });
    const operation = pending.current.get(key) ?? crypto.randomUUID();
    pending.current.set(key, operation);
    locked.current = true; setBusy(true); setError("");
    try {
      await saveProjectDependencies(user, current, tasks, dependencies, graph!.revision, operation);
      await refresh();
      pending.current.delete(key);
      setSelected("");
    } catch (e) { setError(e instanceof Error && !e.message.includes("Firebase") ? e.message : "No se confirmó el cambio. Actualiza antes de reintentar."); }
    finally { locked.current = false; setBusy(false); }
  }
  return (
    <section className="mt-5 border-t border-neutral-200 pt-4" aria-label={`Ruta del proyecto ${String(project.name ?? "")}`}>
      <h3 className="text-sm font-semibold">Dependencias y ruta crítica</h3>
      <p className="mt-2 text-xs text-neutral-500">El cálculo usa horas previstas por persona como duración aproximada. No determina fechas reales ni considera turnos o disponibilidad de herramientas.</p>
      {!projectTasks.length && <p className="mt-3 text-xs text-neutral-500">Este proyecto no tiene tareas registradas.</p>}
      {missingDuration.length > 0 && <p className="mt-3 text-xs text-amber-700">Falta la estimación de duración de {missingDuration.length} tarea(s). Completa las horas previstas para calcular la ruta.</p>}
      {cpmError && <p role="alert" className="mt-3 text-xs text-red-700">{cpmError}</p>}
      {cpm && <p className="mt-3 text-xs">Duración estimada de la ruta: <strong>{cpm.projectDuration.toFixed(1)} h</strong> · sin validación de calendario ni recursos.</p>}
      <ul className="mt-3 space-y-2">
        {projectTasks.map((task) => {
          const result = cpm?.activities.find((row) => row.id === task.id);
          const blockers = graph.edges[task.id] ?? task.dependencyTaskIds ?? [];
          return <li key={task.id} className="rounded-lg border border-neutral-200 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{task.title}</strong>{result?.critical && <span className="rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-900">Ruta crítica</span>}</div>
            <p className="mt-1 text-neutral-500">Predecesoras: {blockers.length ? blockers.map((id) => projectTasks.find((other) => other.id === id)?.title ?? "Tarea no disponible").join(", ") : "Ninguna"}{result ? ` · holgura ${result.slack.toFixed(1)} h` : ""}</p>
            {task.status !== "done" && !task.isBlocked && <button type="button" className="f-button mt-2" disabled={busy} onClick={() => { setSelected(task.id); setDependencies(blockers); setError(""); }}>Editar dependencias</button>}
          </li>;
        })}
      </ul>
      {days.length > 0 && <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold">Capacidad por fecha límite</summary>
        <p className="mt-2 text-neutral-500">La fecha límite no es un horario de trabajo. Se descuentan estimaciones de otros proyectos con la misma fecha; esta comparación no demuestra que las tareas se solapen.</p>
        {days.map((day) => {
          const planned = projectTasks.filter((task) => task.dueDate === day && task.status !== "done");
          const missing = planned.some((task) => task.estimatedHours === null);
          const hours = planned.reduce((sum, task) => sum + (task.estimatedHours ?? 0) * task.assignees.length, 0);
          const activeWorkers = workers.filter((worker) => worker.status === "active");
          const unknownAttendance = activeWorkers.some((worker) => {
            const row = attendance.find((item) => item.workerId === worker.id && item.date === day);
            return !row || row.pendingConfirmation === true || (!["present", "late", "half"].includes(String(row.status)) && !isAbsence(String(row.status)));
          });
          const present = activeWorkers.filter((worker) => attendance.some((row) => row.workerId === worker.id && row.date === day && row.pendingConfirmation !== true && ["present", "late", "half"].includes(String(row.status))));
          const available = present.map((worker) => {
            const row = attendance.find((item) => item.workerId === worker.id && item.date === day);
            return getWorkerDailyAvailability(worker.id, day, attendance, tasks.filter((task) => task.project !== project.id), { shiftHours: row?.status === "half" ? 4 : 8 });
          });
          const capacity = available.reduce((sum, value) => sum + value.availableHours, 0);
          const incomplete = unknownAttendance || missing || available.some((value) => value.incomplete);
          return <p key={day} className="mt-2">{day}: {hours.toFixed(1)} h-persona estimadas · {capacity.toFixed(1)} h disponibles en personas marcadas presentes{incomplete ? " · estimaciones incompletas" : ""}{hours > capacity && present.length ? " · revisar capacidad" : ""}{!present.length ? " · sin presencia registrada" : ""}</p>;
        })}
      </details>}
      {selected && current && <div className="mt-4 rounded-xl border border-neutral-200 p-4 text-xs">
        <h4 className="font-semibold">Predecesoras de {current.title}</h4>
        <p className="mt-1 text-neutral-500">Selecciona las tareas que deben terminar antes. Se comprobarán los ciclos al guardar.</p>
        {tasks.filter((task) => task.project === project.id && task.id !== current.id && (!task.isCancelled || dependencies.includes(task.id))).map((task) => <label key={task.id} className="mt-2 flex items-center gap-2"><input type="checkbox" checked={dependencies.includes(task.id)} disabled={busy} onChange={(event) => setDependencies(event.target.checked ? [...dependencies, task.id] : dependencies.filter((id) => id !== task.id))} />{task.title}{task.isCancelled ? " · cancelada, quita esta dependencia" : ""}</label>)}
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="f-button f-primary" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar dependencias"}</button><button type="button" className="f-button" disabled={busy} onClick={() => setSelected("")}>Cancelar</button></div>
      </div>}
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    </section>
  );
}
