import { calculateCriticalPath } from "./project-cpm";
import { isAbsence } from "./firebase-attendance";
import { getWorkerDailyAvailability } from "./workforce-availability";
import type { CloudRow } from "./firebase-client";
import type { WorkTask } from "./firebase-workforce-domain";

type ProjectTask = WorkTask & { dependencyTaskIds?: string[] };
type CapacityEstimate = { date: string; estimatedDemandHours: number; estimatedAvailableHours: number; incomplete: boolean; feasibility: "unknown" };

/** Due dates do not define a schedule: no resource infeasibility is asserted here. */
export function evaluateProjectCapacity(projectId: string, tasks: ProjectTask[], workers: CloudRow[], attendance: CloudRow[]) {
  const projectTasks = tasks.filter((task) => task.project === projectId && !task.isCancelled);
  let criticalTaskIds: string[] = [];
  let criticalPathError: string | null = null;
  if (projectTasks.length && projectTasks.every((task) => task.estimatedHours !== null && Number.isFinite(task.estimatedHours) && task.estimatedHours > 0)) {
    try {
      criticalTaskIds = calculateCriticalPath(projectTasks.map((task) => ({ id: task.id, duration: task.estimatedHours!, dependencies: task.dependencyTaskIds ?? [] }))).activities.filter((task) => task.critical).map((task) => task.id);
    } catch (error) { criticalPathError = error instanceof Error ? error.message : "No se pudo calcular la ruta."; }
  } else if (projectTasks.length) criticalPathError = "Faltan duraciones estimadas.";
  const dueDates = [...new Set(projectTasks.filter((task) => task.status !== "done").map((task) => task.dueDate))].sort();
  const estimates: CapacityEstimate[] = dueDates.map((date) => {
    const due = projectTasks.filter((task) => task.status !== "done" && task.dueDate === date);
    const activeWorkers = workers.filter((worker) => worker.status === "active");
    const unknownAttendance = activeWorkers.some((worker) => {
      const row = attendance.find((item) => item.workerId === worker.id && item.date === date);
      return !row || row.pendingConfirmation === true || (!["present", "late", "half"].includes(String(row.status)) && !isAbsence(String(row.status)));
    });
    const present = activeWorkers.filter((worker) => attendance.some((row) => row.workerId === worker.id && row.date === date && row.pendingConfirmation !== true && ["present", "late", "half"].includes(String(row.status))));
    const available = present.map((worker) => {
      const row = attendance.find((item) => item.workerId === worker.id && item.date === date);
      return getWorkerDailyAvailability(worker.id, date, attendance, tasks.filter((task) => task.project !== projectId), { shiftHours: row?.status === "half" ? 4 : 8 });
    });
    return {
      date,
      estimatedDemandHours: due.reduce((sum, task) => sum + (task.estimatedHours ?? 0) * task.assignees.length, 0),
      estimatedAvailableHours: available.reduce((sum, row) => sum + row.availableHours, 0),
      incomplete: unknownAttendance || !present.length || due.some((task) => task.estimatedHours == null) || available.some((row) => row.incomplete),
      feasibility: "unknown" as const,
    };
  });
  return { criticalTaskIds, criticalPathError, estimates, resourceCalendarVerified: false as const };
}
