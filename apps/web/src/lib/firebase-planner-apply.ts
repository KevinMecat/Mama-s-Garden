import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { firebaseClient } from "@/lib/firebase-client";
import type { AuthUser } from "@/types/auth";

type AttendanceSnapshot =
  | { source: "operational"; revision: number; updatedAtMillis: number | null; status: string }
  | { source: "legacy"; id: string; updatedAtMillis: number | null; status: string; arrival: string; departure: string; breakMinutes: number }
  | null;
export type PlannerWorkerSnapshot = {
  id: string;
  name: string;
  profileRevision: number | null;
  profileUpdatedAtMillis: number | null;
  adjustmentRevision: number | null;
  adjustmentUpdatedAtMillis: number | null;
  attendance: AttendanceSnapshot;
};
export type PlannerTaskSnapshot = { id: string; revision: number; updatedAtMillis: number };
export type PlannerAssignment = { taskId: string; hoursByWorker: Record<string, number> };
export type DailyProposal = {
  id: string;
  date: string;
  tasks: PlannerTaskSnapshot[];
  workers: PlannerWorkerSnapshot[];
  assignments: PlannerAssignment[];
  snapshotFingerprint: string;
};

// Sort keys so equivalent payloads always produce the same retry fingerprint.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export async function proposalFingerprint(proposal: Omit<DailyProposal, "snapshotFingerprint">) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(proposal)));
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function validId(value: string) { return /^[A-Za-z0-9_-]{1,120}$/.test(value); }
export function serverTimestampMillis(value: unknown) { return value instanceof Timestamp ? value.toMillis() : null; }

/**
 * Writes at most three task revisions and their history entries atomically.
 * Firestore's client SDK cannot transactionally query collections: unseen new
 * tasks, workers or historical attendance records are NOT protected against
 * phantoms. Never claim this as a complete schedule snapshot without a shared
 * revision guard updated by every relevant writer.
 * The aggregate hours payload also cannot prove per-slot tool availability,
 * supervision overlap, fixed assignments or remaining worker capacity. The
 * module is experimental and must not be exposed to users until those checks
 * are independently enforced against the confirmed snapshot.
 */
export async function applyDailyProposal(user: AuthUser, proposal: DailyProposal) {
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role)) throw Error("Solo un encargado puede aplicar una propuesta.");
  if (!validId(proposal.id) || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.date) || Number.isNaN(Date.parse(`${proposal.date}T00:00:00Z`)) || new Date(`${proposal.date}T00:00:00Z`).toISOString().slice(0, 10) !== proposal.date) throw Error("Propuesta inválida.");
  if (!proposal.assignments.length || proposal.assignments.length > 3 || proposal.workers.length > 6 || proposal.tasks.length > 30)
    throw Error("La propuesta excede el límite de la aplicación atómica: tres tareas y seis personas.");
  if (new Set(proposal.tasks.map((item) => item.id)).size !== proposal.tasks.length || new Set(proposal.workers.map((item) => item.id)).size !== proposal.workers.length || new Set(proposal.assignments.map((item) => item.taskId)).size !== proposal.assignments.length)
    throw Error("La propuesta contiene identificadores duplicados.");
  if (proposal.tasks.some((task) => !validId(task.id) || !Number.isInteger(task.revision) || task.revision < 1 || !Number.isFinite(task.updatedAtMillis)) || proposal.workers.some((worker) => !validId(worker.id) || !worker.name.trim() || worker.name.length > 140 || (worker.attendance?.source === "legacy" && !validId(worker.attendance.id)))) throw Error("La instantánea está incompleta.");
  const unsigned = { id: proposal.id, date: proposal.date, tasks: proposal.tasks, workers: proposal.workers, assignments: proposal.assignments };
  if (await proposalFingerprint(unsigned) !== proposal.snapshotFingerprint) throw Error("La propuesta cambió. Vuelve a calcularla.");
  const byWorker = new Map(proposal.workers.map((item) => [item.id, item]));
  const byTask = new Map(proposal.tasks.map((item) => [item.id, item]));
  for (const assignment of proposal.assignments) {
    const hours = Object.entries(assignment.hoursByWorker);
    if (!byTask.has(assignment.taskId) || !hours.length || hours.length > 6 || hours.some(([id, amount]) => !byWorker.has(id) || !Number.isFinite(amount) || amount <= 0 || amount > 24))
      throw Error("La propuesta contiene asignaciones inválidas.");
  }
  const { db } = await firebaseClient();
  try {
    await runTransaction(db, async (tx) => {
    const receiptRef = doc(db, "workforce_plan_proposals", proposal.id);
    const receipt = await tx.get(receiptRef);
    if (receipt.exists()) {
      if (receipt.data().actor !== String(user.id) || receipt.data().fingerprint !== proposal.snapshotFingerprint) throw Error("La propuesta ya existe con otro contenido.");
      return;
    }
    // All reads precede every write, as required by Firestore transactions.
    const taskDocs = await Promise.all(proposal.tasks.map((task) => tx.get(doc(db, "workforce_tasks", task.id))));
    const workerDocs = await Promise.all(proposal.workers.map(async (worker) => {
      const refs = [doc(db, "workers", worker.id), doc(db, "workforce_worker_adjustments", worker.id), doc(db, "workforce_profiles", worker.id), doc(db, "workforce_attendance", `${worker.id}_${proposal.date}`)];
      const result = await Promise.all(refs.map((ref) => tx.get(ref)));
      const legacy = worker.attendance?.source === "legacy" ? await tx.get(doc(db, "attendance", worker.attendance.id)) : null;
      return { result, legacy };
    }));
    for (let index = 0; index < proposal.tasks.length; index++) {
      const expected = proposal.tasks[index], snapshot = taskDocs[index], actual = snapshot.data();
      if (!snapshot.exists() || actual?.revision !== expected.revision || serverTimestampMillis(actual?.updatedAt) !== expected.updatedAtMillis)
        throw Error("Una tarea cambió. Vuelve a calcular la propuesta.");
    }
    for (let index = 0; index < proposal.workers.length; index++) {
      const expected = proposal.workers[index], { result, legacy } = workerDocs[index];
      const [person, adjustment, profile, operational] = result;
      const state = adjustment.exists() ? adjustment.data().status : person.data()?.status;
      if (!person.exists() || state !== "active" || (adjustment.data()?.revision ?? null) !== expected.adjustmentRevision || serverTimestampMillis(adjustment.data()?.updatedAt) !== expected.adjustmentUpdatedAtMillis || (profile.data()?.revision ?? null) !== expected.profileRevision || serverTimestampMillis(profile.data()?.updatedAt) !== expected.profileUpdatedAtMillis)
        throw Error("El personal o sus competencias cambiaron. Vuelve a calcular la propuesta.");
      const attendance = expected.attendance;
      if (attendance?.source === "operational") {
        if (!operational.exists() || operational.data().workerId !== expected.id || operational.data().date !== proposal.date || operational.data().revision !== attendance.revision || serverTimestampMillis(operational.data().updatedAt) !== attendance.updatedAtMillis || operational.data().status !== attendance.status || !["present", "late", "half"].includes(attendance.status)) throw Error("La asistencia cambió. Vuelve a calcular la propuesta.");
      } else if (attendance?.source === "legacy") {
        const actual = legacy?.data();
        if (operational.exists() || !legacy?.exists() || actual?.workerId !== expected.id || actual?.date !== proposal.date || serverTimestampMillis(actual?.updatedAt) !== attendance.updatedAtMillis || actual?.status !== attendance.status || String(actual?.arrival ?? "") !== attendance.arrival || String(actual?.departure ?? "") !== attendance.departure || Number(actual?.breakMinutes ?? 0) !== attendance.breakMinutes || !["present", "late", "half"].includes(attendance.status))
          throw Error("La asistencia histórica cambió. Vuelve a calcular la propuesta.");
      } else if (operational.exists()) throw Error("La asistencia cambió. Vuelve a calcular la propuesta.");
    }
    for (const assignment of proposal.assignments) {
      const snapshotIndex = proposal.tasks.findIndex((item) => item.id === assignment.taskId);
      const task = taskDocs[snapshotIndex].data()!;
      if (task.status !== "todo" || task.isBlocked || task.isCancelled || task.logCount !== 0 || task.lastAppliedProposalId === proposal.id) throw Error("Una tarea ya no puede planificarse. Vuelve a calcular.");
      const assignees = Object.keys(assignment.hoursByWorker).sort();
      if (assignees.some((id) => !byWorker.get(id)?.attendance)) throw Error("La propuesta contiene una persona sin asistencia confirmada.");
      const eventId = `${proposal.id}-${assignment.taskId}`;
      const names = Object.fromEntries(assignees.map((id) => [id, byWorker.get(id)!.name]));
      tx.update(doc(db, "workforce_tasks", assignment.taskId), {
        assignees, assigneeNames: names, plannedHoursByWorker: assignment.hoursByWorker,
        lastAppliedProposalId: proposal.id, planApprovedBy: String(user.id), planApprovedAt: serverTimestamp(),
        revision: task.revision + 1, lastOperationId: eventId, updatedBy: String(user.id), updatedAt: serverTimestamp(),
      });
      tx.set(doc(db, "workforce_history", eventId), {
        taskId: assignment.taskId, assignees, action: "apply_proposal", fromStatus: task.status, toStatus: task.status,
        reason: "Propuesta diaria aprobada", revision: task.revision + 1, actor: String(user.id),
        actorLabel: user.first_name || user.role_label || "Cuenta autorizada", fingerprint: proposal.snapshotFingerprint,
        proposalId: proposal.id, previousAssignees: task.assignees, previousPlannedHoursByWorker: task.plannedHoursByWorker ?? {}, createdAt: serverTimestamp(),
      });
    }
    tx.set(receiptRef, { date: proposal.date, actor: String(user.id), fingerprint: proposal.snapshotFingerprint, taskIds: proposal.assignments.map((item) => item.taskId), createdAt: serverTimestamp() });
    });
  } catch (error) {
    if (error instanceof Error && error.name !== "FirebaseError") throw error;
    // A simultaneous identical commit can be rejected by immutable receipt
    // rules before Firestore reports a transaction conflict. Confirm the
    // server receipt before deciding whether the operation actually failed.
    for (const delay of [0, 100, 250, 500]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const receipt = await getDocFromServer(doc(db, "workforce_plan_proposals", proposal.id));
        if (receipt.exists()) {
          if (receipt.data().actor === String(user.id) && receipt.data().fingerprint === proposal.snapshotFingerprint) return;
          throw Error("La propuesta ya existe con otro contenido.");
        }
      } catch (readError) {
        if (readError instanceof Error && readError.message === "La propuesta ya existe con otro contenido.") throw readError;
      }
    }
    throw error;
  }
}
