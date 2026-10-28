import type { CloudRow } from "./firebase-client";
import type { TaskEvent, WorkLog, WorkTask } from "./firebase-workforce-domain";
import { getWorkerDailyAvailability } from "./workforce-availability";
import { isAbsence, workedMinutes } from "./firebase-attendance";
import { evaluateProjectCapacity } from "./project-capacity";
import type { ProjectGraph } from "./firebase-project-graph";

export type OperationalAlert = {
  id: string;
  title: string;
  evidence: string;
  review: string;
  action: { label: string; kind: "attendance" | "task" | "project"; id?: string };
};

export type AlertInput = {
  date: string;
  today: string;
  /** Finca clock in minutes after midnight; inject it separately for reproducible calculations. */
  currentMinutes: number;
  workers: CloudRow[];
  attendance: CloudRow[];
  tasks: WorkTask[];
  logs: WorkLog[];
  events: TaskEvent[];
  criticalTaskIds?: readonly string[];
  resourceRiskTaskIds?: readonly string[];
  /** Quantified, attributable capacity evidence supplied by the project calculation. */
  resourceRiskEvidence?: Readonly<Record<string, string>>;
  gapHours?: number;
  shiftEndMinutes?: number;
};

const workerName = (worker: CloudRow | undefined) => worker ? `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim() || "Trabajador" : "Trabajador";
const timestampMillis = (value: unknown): number | null => {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  return null;
};
const localDate = (value: unknown): string | null => {
  const millis = timestampMillis(value);
  return millis === null || !Number.isFinite(millis) ? null : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" }).format(millis);
};

/** Derive only risks backed by a complete project graph and identified assumptions. */
export function deriveProjectRiskEvidence(input: Pick<AlertInput, "date" | "today" | "workers" | "attendance" | "tasks">, graphs: readonly ProjectGraph[]) {
  const criticalTaskIds: string[] = [], resourceRiskTaskIds: string[] = [];
  const resourceRiskEvidence: Record<string, string> = {};
  const unavailableProjectIds: string[] = [];
  for (const graph of graphs) {
    const projectTasks = input.tasks.filter((task) => task.project === graph.projectId);
    const byId = new Map(projectTasks.map((task) => [task.id, task]));
    const edges = graph.edges ?? {};
    const same = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const inconsistent = Object.keys(edges).some((id) => !byId.has(id)) || projectTasks.some((task) => {
      const field = (task as WorkTask & { dependencyTaskIds?: string[] }).dependencyTaskIds ?? [];
      const graphEdges = edges[task.id] ?? [];
      return !Array.isArray(field) || !Array.isArray(graphEdges) || !same(field, graphEdges);
    });
    if (inconsistent) { unavailableProjectIds.push(graph.projectId); continue; }
    let result: ReturnType<typeof evaluateProjectCapacity>;
    try { result = evaluateProjectCapacity(graph.projectId, input.tasks, input.workers, input.attendance); }
    catch { unavailableProjectIds.push(graph.projectId); continue; }
    if (result.criticalPathError) { unavailableProjectIds.push(graph.projectId); continue; }
    criticalTaskIds.push(...result.criticalTaskIds);
    const dayEstimate = result.estimates.find((estimate) => estimate.date === input.date);
    const activeWorkers = input.workers.filter((worker) => worker.status === "active");
    const statuses = new Set(["present", "late", "half", "absent", "excused", "leave", "sick", "rest"]);
    const missingPresence = !activeWorkers.length || activeWorkers.some((worker) => {
      const record = input.attendance.find((row) => row.workerId === worker.id && row.date === input.date);
      return !record || record.pendingConfirmation === true || !statuses.has(String(record.status));
    });
    const dueTasks = projectTasks.filter((task) => !task.isCancelled && task.status !== "done" && task.dueDate === input.date);
    const missingEstimates = dueTasks.some((task) => !Array.isArray(task.assignees) || !task.assignees.length || typeof task.estimatedHours !== "number" || !Number.isFinite(task.estimatedHours) || task.estimatedHours <= 0);
    if (input.date > input.today || !dayEstimate || dayEstimate.incomplete || missingPresence || missingEstimates || dayEstimate.estimatedDemandHours <= dayEstimate.estimatedAvailableHours) continue;
    for (const task of dueTasks.filter((entry) => result.criticalTaskIds.includes(entry.id))) {
      resourceRiskTaskIds.push(task.id);
      resourceRiskEvidence[task.id] = `Para la fecha límite ${input.date}: demanda estimada ${dayEstimate.estimatedDemandHours.toFixed(1)} h-persona y capacidad estimada ${dayEstimate.estimatedAvailableHours.toFixed(1)} h. La fecha límite no confirma que las tareas se solapen.`;
    }
  }
  return { criticalTaskIds, resourceRiskTaskIds, resourceRiskEvidence, unavailableProjectIds };
}

export function selectOperationalAlerts(input: AlertInput): OperationalAlert[] {
  const { date, today, workers, attendance, tasks, logs, events } = input;
  const gapHours = input.gapHours ?? 1.5;
  if (!Number.isFinite(gapHours) || gapHours < 0) throw Error("El umbral de brecha debe ser un número no negativo.");
  const alert: OperationalAlert[] = [];
  const people = new Map(workers.map((worker) => [worker.id, worker]));
  for (const row of attendance.filter((item) => item.date === date && typeof item.workerId === "string")) {
    const worker = people.get(String(row.workerId));
    if (!worker || row.pendingConfirmation === true || isAbsence(String(row.status))) continue;
    const arrival = typeof row.arrival === "string" ? row.arrival : "";
    const departure = typeof row.departure === "string" ? row.departure : "";
    if (arrival && !departure && (date < today || (date === today && input.currentMinutes >= (input.shiftEndMinutes ?? 18 * 60)))) {
      alert.push({ id: `exit:${row.workerId}:${date}`, title: `Salida pendiente · ${workerName(worker)}`, evidence: `Entrada registrada a las ${arrival}; no aparece una salida para ${date}.`, review: "Comprueba si la jornada terminó y registra o corrige la salida.", action: { label: "Abrir asistencia", kind: "attendance" } });
    }
    const recorded = workedMinutes({ arrival, departure, nextDay: row.nextDay === true, breakMinutes: Number(row.breakMinutes) || 0 });
    if (recorded !== null && recorded > 0) {
      const taskMinutes = logs.filter((log) => localDate(log.workDate) === date).reduce((sum, log) => sum + (Number(log.minutes?.[String(row.workerId)]) || 0), 0);
      const difference = Math.abs(recorded - taskMinutes) / 60;
      if (difference > gapHours) alert.push({ id: `gap:${row.workerId}:${date}`, title: `Diferencia de horas · ${workerName(worker)}`, evidence: `Asistencia ${(recorded / 60).toFixed(2)} h; tareas ${(taskMinutes / 60).toFixed(2)} h; diferencia ${difference.toFixed(2)} h.`, review: "Compara los registros: parte de la jornada puede corresponder a actividades sin tareas.", action: { label: "Abrir asistencia", kind: "attendance" } });
    }
  }
  for (const worker of workers.filter((item) => item.status === "active")) {
    const amount = getWorkerDailyAvailability(worker.id, date, attendance, tasks.filter((task) => Array.isArray(task.assignees)));
    if (amount.overallocatedHours > 0) alert.push({ id: `over:${worker.id}:${date}`, title: `Sobreasignación estimada · ${workerName(worker)}`, evidence: `${amount.committedHours.toFixed(2)} h previstas; exceso ${amount.overallocatedHours.toFixed(2)} h${!amount.attendanceKnown || amount.incomplete ? "; faltan datos de asistencia o estimación" : ""}.`, review: "Revisa las asignaciones y sus horas; se usa la fecha límite como aproximación.", action: { label: "Ver trabajador", kind: "project", id: `/dashboard/workforce?worker=${encodeURIComponent(worker.id)}` } });
  }
  const critical = new Set(input.criticalTaskIds ?? []), resourceRisk = new Set(input.resourceRiskTaskIds ?? []);
  const active = tasks.filter((task) => !task.isCancelled && task.status !== "done");
  for (const task of active) {
    const problems = [task.isBlocked ? `bloqueada${task.blockReason ? `: ${task.blockReason}` : ""}` : "", !Array.isArray(task.assignees) || !task.assignees.length ? "sin responsable" : "", typeof task.estimatedHours !== "number" || !Number.isFinite(task.estimatedHours) || task.estimatedHours <= 0 ? "sin estimación de horas" : ""].filter(Boolean);
    if (problems.length) alert.push({ id: `task:${task.id}`, title: `Tarea requiere atención · ${task.title}`, evidence: problems.join("; "), review: "Abre la tarea y completa la planificación o resuelve el bloqueo.", action: { label: "Ver tarea", kind: "task", id: task.id } });
    const late = critical.has(task.id) && task.dueDate < today;
    const capacityEvidence = critical.has(task.id) && resourceRisk.has(task.id) ? input.resourceRiskEvidence?.[task.id]?.trim() : undefined;
    if (late || capacityEvidence) alert.push({ id: `critical:${task.id}`, title: `Ruta crítica en riesgo · ${task.title}`, evidence: [late ? `La fecha límite ${task.dueDate} ya venció.` : "", capacityEvidence ?? ""].filter(Boolean).join(" "), review: "Revisa dependencias, fecha y recursos del proyecto.", action: { label: "Ver tarea", kind: "task", id: task.id } });
  }
  const recentStart = Date.parse(`${today}T06:00:00Z`) - 30 * 86400000;
  const recentEnd = Date.parse(`${today}T06:00:00Z`) + 86400000;
  const returned = new Map<string, { count: number; task: WorkTask }>();
  for (const event of events.filter((item) => item.action === "return")) {
    const when = timestampMillis(event.createdAt);
    const task = tasks.find((item) => item.id === event.taskId);
    if (!task || when === null || when < recentStart || when >= recentEnd) continue;
    const row = returned.get(task.activity) ?? { count: 0, task };
    row.count++;
    returned.set(task.activity, row);
  }
  for (const [activity, row] of returned) if (row.count >= 2) alert.push({ id: `rework:${activity}`, title: `Retrabajo recurrente · ${activity}`, evidence: `${row.count} devoluciones en los últimos 30 días.`, review: "Revisa los criterios de aceptación y los motivos de devolución.", action: { label: "Revisar tarea", kind: "task", id: row.task.id } });
  return alert;
}
