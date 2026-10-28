import { isAbsence } from "./firebase-attendance";
import type { CloudRow } from "./firebase-client";
import type { WorkTask } from "./firebase-workforce-domain";

/** Estimate based on the existing per-person task hours and due date, not a schedule. */
export function getWorkerDailyAvailability(
  workerId: string,
  date: string,
  attendance: CloudRow[],
  tasks: WorkTask[],
  options: { shiftHours?: number; excludeTaskId?: string } = {},
) {
  const shift = options.shiftHours ?? 8;
  if (!Number.isFinite(shift) || shift < 0) throw Error("Jornada inválida.");
  const record = attendance.find((row) => row.workerId === workerId && row.date === date);
  const absent = record ? isAbsence(String(record.status)) : false;
  const breaks = Math.max(0, Number(record?.breakMinutes) || 0) / 60;
  const relevant = tasks.filter((task) => task.id !== options.excludeTaskId && !task.isCancelled && task.status !== "done" && task.dueDate === date && task.assignees.includes(workerId));
  const committed = relevant.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
  const capacity = absent ? 0 : Math.max(0, shift - breaks);
  return {
    availableHours: Math.max(0, capacity - committed),
    overallocatedHours: Math.max(0, committed - capacity),
    committedHours: committed,
    absent,
    attendanceKnown: Boolean(record),
    incomplete: relevant.some((task) => task.estimatedHours === null),
  };
}
