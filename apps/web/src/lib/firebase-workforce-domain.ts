import type { UserRole } from "@/types/auth";

export const columns = {
  todo: "Por hacer",
  in_progress: "En curso",
  review: "Por revisar",
  done: "Finalizado",
} as const;
export const priorities = {
  low: "Baja",
  normal: "Media",
  high: "Alta",
  urgent: "Urgente",
} as const;
export type Status = keyof typeof columns;
export type Plan = {
  title: string;
  activity: string;
  project: string;
  location: string;
  assignees: string[];
  assigneeNames: Record<string, string>;
  dueDate: string;
  priority: keyof typeof priorities;
  instructions: string;
  acceptanceCriteria: string;
  targetQuantity: number | null;
  unit: string;
  estimatedHours: number | null;
};
export type WorkTask = Plan & {
  id: string;
  status: Status;
  isBlocked: boolean;
  blockReason: string;
  isCancelled: boolean;
  cancelReason: string;
  revision: number;
  logCount: number;
  latestLogId: string;
  latestReviewId: string;
  lastOperationId: string;
  createdBy: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
export type WorkLog = {
  id: string;
  taskId: string;
  result: string;
  criterionMet: boolean;
  quantity: number | null;
  minutes: Record<string, number>;
  incidents: string;
  evidence: string[];
  workDate: unknown;
  createdBy: string;
  createdAt?: unknown;
};
export type TaskReview = {
  id: string;
  taskId: string;
  logId: string;
  accepted: boolean;
  acceptedQuantity: number | null;
  observations: string;
  createdBy: string;
  createdAt?: unknown;
};
export type TaskEvent = {
  id: string;
  taskId: string;
  assignees: string[];
  action: string;
  fromStatus: string;
  toStatus: Status;
  reason: string;
  revision: number;
  actor: string;
  actorLabel: string;
  createdAt?: unknown;
};
export type Command =
  | { action: "start" }
  | { action: "edit"; plan: Plan }
  | { action: "block" | "unblock" | "cancel"; reason: string }
  | {
      action: "submit";
      log: Omit<WorkLog, "id" | "taskId" | "createdBy" | "createdAt">;
    }
  | {
      action: "accept" | "return";
      observations: string;
      acceptedQuantity: number | null;
    };
export const canPlan = (role: UserRole) =>
  ["ADMIN", "MANAGER", "SUPERVISOR"].includes(role);
export function validatePlan(plan: Plan) {
  if (
    !plan.title.trim() ||
    plan.title.length > 160 ||
    !plan.activity.trim() ||
    !plan.location.trim() ||
    !plan.acceptanceCriteria.trim()
  )
    throw Error("Completa título, labor, ubicación y criterio de aceptación.");
  if (
    !plan.assignees.length ||
    plan.assignees.length > 6 ||
    new Set(plan.assignees).size !== plan.assignees.length
  )
    throw Error("Asigna entre una y seis personas diferentes.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(plan.dueDate) ||
    !Object.hasOwn(priorities, plan.priority)
  )
    throw Error("Fecha o prioridad inválida.");
  if (
    plan.targetQuantity !== null &&
    (!Number.isFinite(plan.targetQuantity) ||
      plan.targetQuantity <= 0 ||
      !plan.unit.trim())
  )
    throw Error("Una meta numérica necesita cantidad positiva y unidad.");
  if (
    plan.estimatedHours !== null &&
    (!Number.isFinite(plan.estimatedHours) ||
      plan.estimatedHours <= 0 ||
      plan.estimatedHours > 24)
  )
    throw Error("Las horas previstas deben estar entre 0 y 24.");
}
export function transition(
  task: WorkTask,
  command: Command,
  role: UserRole,
  workerId: string | null,
  latestLog?: WorkLog,
) {
  const manager = canPlan(role);
  if (!manager && (!workerId || !task.assignees.includes(workerId)))
    throw Error("No tienes permiso para esta tarea.");
  if (task.isCancelled || task.status === "done")
    throw Error("La tarea ya está cerrada; conserva su historial.");
  const next = { ...task };
  if (
    command.action === "block" ||
    command.action === "unblock" ||
    command.action === "cancel"
  ) {
    if (!command.reason.trim())
      throw Error("Escribe el motivo para el historial.");
    if (command.action === "cancel") {
      if (role !== "ADMIN")
        throw Error("Solo el Administrador puede cancelar.");
      next.isCancelled = true;
      next.cancelReason = command.reason.trim();
    } else {
      next.isBlocked = command.action === "block";
      next.blockReason =
        command.action === "block" ? command.reason.trim() : "";
    }
    return next;
  }
  if (task.isBlocked) throw Error("Resuelve el bloqueo antes de continuar.");
  switch (command.action) {
    case "edit":
      if (
        !manager ||
        task.logCount !== 0 ||
        !["todo", "in_progress"].includes(task.status)
      )
        throw Error(
          "La planificación con resultados no se puede sobrescribir. Duplica la tarea.",
        );
      validatePlan(command.plan);
      Object.assign(next, command.plan);
      break;
    case "start":
      if (task.status !== "todo")
        throw Error("Solo se puede iniciar una tarea por hacer.");
      next.status = "in_progress";
      break;
    case "submit": {
      if (task.status !== "in_progress")
        throw Error("Primero inicia la tarea.");
      const log = command.log;
      if (!log.result.trim() || typeof log.criterionMet !== "boolean")
        throw Error("Describe el resultado y el cumplimiento del criterio.");
      if (
        task.assignees.some(
          (id) =>
            !Number.isInteger(log.minutes[id]) ||
            log.minutes[id] < 1 ||
            log.minutes[id] > 1440,
        ) ||
        Object.keys(log.minutes).some((id) => !task.assignees.includes(id))
      )
        throw Error(
          "Registra minutos reales positivos por cada integrante de la cuadrilla.",
        );
      if (
        !manager &&
        (task.assignees.length !== 1 || task.assignees[0] !== workerId)
      )
        throw Error(
          "El Encargado registra el cierre conjunto de la cuadrilla; cada persona conserva su tiempo explícito.",
        );
      if (
        task.targetQuantity !== null &&
        (log.quantity === null ||
          !Number.isFinite(log.quantity) ||
          log.quantity < 0)
      )
        throw Error("Registra la cantidad realizada, incluso si fue cero.");
      if (task.targetQuantity === null && log.quantity !== null)
        throw Error("Una labor de cumplimiento no lleva cantidad numérica.");
      next.status = "review";
      next.logCount++;
      break;
    }
    case "accept":
    case "return":
      if (role !== "ADMIN" || task.status !== "review" || !latestLog)
        throw Error("Solo el Administrador revisa un cierre registrado.");
      if (command.action === "return" && !command.observations.trim())
        throw Error("Explica qué debe corregirse.");
      if (command.action === "accept") {
        if (!latestLog.criterionMet)
          throw Error(
            "No se puede aceptar un criterio incumplido. Devuelve la tarea.",
          );
        if (
          task.targetQuantity !== null &&
          (command.acceptedQuantity === null ||
            !Number.isFinite(command.acceptedQuantity) ||
            command.acceptedQuantity < 0 ||
            command.acceptedQuantity > (latestLog.quantity ?? -1))
        )
          throw Error(
            "La cantidad aceptada debe estar entre cero y la cantidad reportada.",
          );
        if (task.targetQuantity === null && command.acceptedQuantity !== null)
          throw Error("Esta tarea se acepta por cumplimiento.");
      }
      next.status = command.action === "accept" ? "done" : "in_progress";
      break;
  }
  return next;
}
export function duplicatePlan(task: WorkTask, dueDate: string): Plan {
  const {
    title,
    activity,
    project,
    location,
    assignees,
    assigneeNames,
    priority,
    instructions,
    acceptanceCriteria,
    targetQuantity,
    unit,
    estimatedHours,
  } = task;
  return {
    title,
    activity,
    project,
    location,
    assignees: [...assignees],
    assigneeNames: { ...assigneeNames },
    dueDate,
    priority,
    instructions,
    acceptanceCriteria,
    targetQuantity,
    unit,
    estimatedHours,
  };
}
export function productivity(
  task: WorkTask,
  log?: WorkLog,
  review?: TaskReview,
  allLogs: WorkLog[] = log ? [log] : [],
) {
  if (task.targetQuantity === null)
    return { label: "Por cumplimiento", value: null };
  if (!review?.accepted || !log)
    return { label: "Pendiente de aceptación", value: null };
  const minutes = allLogs
    .filter((entry) => entry.taskId === task.id)
    .reduce(
      (sum, entry) =>
        sum + Object.values(entry.minutes).reduce((a, b) => a + b, 0),
      0,
    );
  if (minutes <= 0 || review.acceptedQuantity === null)
    return { label: "Sin horas registradas", value: null };
  return {
    label:
      task.assignees.length > 1
        ? "Resultado de cuadrilla / hora-persona"
        : "Resultado / hora",
    value: review.acceptedQuantity / (minutes / 60),
  };
}
