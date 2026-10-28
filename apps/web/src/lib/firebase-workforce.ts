import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseClient, type CloudRow } from "@/lib/firebase-client";
import type { AuthUser } from "@/types/auth";
import {
  canPlan,
  transition,
  validatePlan,
  type Plan,
  type WorkTask,
  type WorkLog,
  type TaskReview,
  type TaskEvent,
  type Command,
} from "@/lib/firebase-workforce-domain";

export async function workerBinding(user: AuthUser) {
  if (user.role !== "WORKER") return null;
  const { db } = await firebaseClient();
  const snapshot = await getDocFromServer(
    doc(db, "workforce_accounts", String(user.id)),
  );
  return snapshot.exists() ? String(snapshot.data().workerId) : null;
}
export async function readWorkforce(user: AuthUser) {
  const { db } = await firebaseClient(),
    workerId = await workerBinding(user);
  if (user.role === "WORKER" && !workerId)
    return { tasks: [], logs: [], reviews: [], events: [], workerId };
  const read = async <T>(name: string): Promise<T[]> => {
    const source = collection(db, name);
    const q =
      user.role === "WORKER"
        ? query(source, where("assignees", "array-contains", workerId))
        : query(source);
    const result = await getDocsFromServer(q);
    return result.docs.map((row) => ({ ...row.data(), id: row.id }) as T);
  };
  const [tasks, logs, reviews, events] = await Promise.all([
    read<WorkTask>("workforce_tasks"),
    read<WorkLog>("workforce_logs"),
    read<TaskReview>("workforce_reviews"),
    read<TaskEvent>("workforce_history"),
  ]);
  return { tasks, logs, reviews, events, workerId };
}
async function fingerprint(value: unknown) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(bytes)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function createWorkTask(
  user: AuthUser,
  plan: Plan,
  taskId: string,
  operationId: string,
) {
  if (!canPlan(user.role))
    throw Error("Solo el Administrador o Encargado puede planificar.");
  validatePlan(plan);
  const { db } = await firebaseClient(),
    actor = String(user.id),
    signature = await fingerprint({ action: "create", taskId, plan });
  await runTransaction(db, async (tx) => {
    const eventRef = doc(db, "workforce_history", operationId),
      taskRef = doc(db, "workforce_tasks", taskId);
    const [event, task] = await Promise.all([
      tx.get(eventRef),
      tx.get(taskRef),
    ]);
    if (event.exists()) {
      if (
        event.data().fingerprint !== signature ||
        event.data().actor !== actor
      )
        throw Error("Operación incompatible.");
      return;
    }
    if (task.exists()) throw Error("La tarea ya existe. Actualiza el tablero.");
    tx.set(taskRef, {
      ...plan,
      status: "todo",
      isBlocked: false,
      blockReason: "",
      isCancelled: false,
      cancelReason: "",
      revision: 1,
      logCount: 0,
      cumulativeReportedQuantity: 0,
      lastProgressDelta: 0,
      progressCount: 0,
      latestLogId: "",
      latestReviewId: "",
      lastOperationId: operationId,
      createdBy: actor,
      updatedBy: actor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(eventRef, {
      taskId,
      assignees: plan.assignees,
      action: "create",
      fromStatus: "",
      toStatus: "todo",
      reason: "Planificación creada",
      revision: 1,
      actor,
      actorLabel: user.first_name || user.role_label || "Cuenta autorizada",
      fingerprint: signature,
      createdAt: serverTimestamp(),
    });
  });
}
export async function commandWorkTask(
  user: AuthUser,
  task: WorkTask,
  command: Command,
  operationId: string,
  boundWorker: string | null,
) {
  const { db } = await firebaseClient(),
    actor = String(user.id),
    signature = await fingerprint({
      taskId: task.id,
      revision: task.revision,
      command,
    });
  await runTransaction(db, async (tx) => {
    const taskRef = doc(db, "workforce_tasks", task.id),
      eventRef = doc(db, "workforce_history", operationId);
    const [event, snapshot] = await Promise.all([
      tx.get(eventRef),
      tx.get(taskRef),
    ]);
    if (event.exists()) {
      if (
        event.data().fingerprint !== signature ||
        event.data().actor !== actor
      )
        throw Error("Operación incompatible.");
      return;
    }
    if (!snapshot.exists() || snapshot.data().revision !== task.revision)
      throw Error(
        "Otra persona actualizó esta tarea. Recarga el tablero antes de continuar.",
      );
    const current = { ...snapshot.data(), id: task.id } as WorkTask;
    const log = current.latestLogId
      ? await tx.get(doc(db, "workforce_logs", current.latestLogId))
      : null;
    const next = transition(
      current,
      command,
      user.role,
      boundWorker,
      log?.exists() ? ({ ...log.data(), id: log.id } as WorkLog) : undefined,
    );
    const { id: ignoredId, ...saved } = next;
    void ignoredId;
    if (command.action === "submit" || command.action === "progress") {
      const workDate =
        command.log.workDate instanceof Date
          ? command.log.workDate
          : new Date(String(command.log.workDate));
      if (
        !Number.isFinite(workDate.getTime()) ||
        workDate.getTime() > Date.now()
      )
        throw Error("La fecha trabajada no puede estar en el futuro.");
      saved.latestLogId = operationId;
      if (command.action === "progress") {
        if ((current.cumulativeReportedQuantity === undefined || current.progressCount === undefined) && current.logCount > 0) throw Error("Esta tarea tiene avances anteriores que necesitan conciliación antes de continuar.");
        saved.lastProgressDelta = command.log.quantity ?? 0;
        saved.cumulativeReportedQuantity = (current.cumulativeReportedQuantity ?? 0) + saved.lastProgressDelta;
        saved.progressCount = (current.progressCount ?? 0) + 1;
      }
      tx.set(doc(db, "workforce_logs", operationId), {
        ...command.log,
        workDate: Timestamp.fromDate(workDate),
        taskId: task.id,
        assignees: current.assignees,
        createdBy: actor,
        createdAt: serverTimestamp(),
      });
    }
    if (command.action === "accept" || command.action === "return") {
      saved.latestReviewId = operationId;
      tx.set(doc(db, "workforce_reviews", operationId), {
        taskId: task.id,
        assignees: current.assignees,
        logId: current.latestLogId,
        accepted: command.action === "accept",
        acceptedQuantity:
          command.action === "accept" ? command.acceptedQuantity : null,
        observations: command.observations.trim(),
        ...(command.action === "accept" && command.legacyReportedQuantity !== undefined ? { legacyReportedQuantity: command.legacyReportedQuantity } : {}),
        createdBy: actor,
        createdAt: serverTimestamp(),
      });
    }
    tx.set(taskRef, {
      ...saved,
      revision: current.revision + 1,
      lastOperationId: operationId,
      updatedBy: actor,
      updatedAt: serverTimestamp(),
    });
    tx.set(eventRef, {
      taskId: task.id,
      assignees: saved.assignees,
      action: command.action,
      fromStatus: current.status,
      toStatus: next.status,
      reason:
        "reason" in command
          ? command.reason.trim()
          : "observations" in command
            ? command.observations.trim()
            : command.action === "submit" || command.action === "progress"
              ? command.log.result.trim()
              : "",
      revision: current.revision + 1,
      actor,
      actorLabel: user.first_name || user.role_label || "Cuenta autorizada",
      fingerprint: signature,
      createdAt: serverTimestamp(),
    });
  });
}
export async function uploadEvidence(
  taskId: string,
  file: File,
  evidenceId: string,
) {
  const { auth, storage } = await firebaseClient();
  if (
    !auth.currentUser ||
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    )
  )
    throw Error("Adjunta JPG, PNG, WebP o PDF de hasta 5 MB.");
  const path = `workforce-evidence/${taskId}/${auth.currentUser.uid}/${evidenceId}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return path;
}
export async function evidenceUrl(path: string) {
  if (!/^workforce-evidence\/[^/]+\/[^/]+\/[^/]+$/.test(path))
    throw Error("Archivo inválido.");
  const { storage } = await firebaseClient();
  return getDownloadURL(ref(storage, path));
}
export async function workerAdjustments(user: AuthUser): Promise<CloudRow[]> {
  const { db } = await firebaseClient();
  if (user.role === "WORKER") {
    const id = await workerBinding(user);
    if (!id) return [];
    const row = await getDocFromServer(
      doc(db, "workforce_worker_adjustments", id),
    );
    return row.exists() ? [{ ...row.data(), id: row.id }] : [];
  }
  const rows = await getDocsFromServer(
    collection(db, "workforce_worker_adjustments"),
  );
  return rows.docs.map((row) => ({ ...row.data(), id: row.id }));
}
export type WorkerPatch = {
  firstName: string;
  lastName: string;
  age: number;
  area: string;
  profile: string;
  status: "active" | "inactive";
};
export async function adjustWorker(
  user: AuthUser,
  workerId: string,
  patch: WorkerPatch,
  expectedRevision: number,
  operationId: string,
  reason: string,
) {
  if (user.role !== "ADMIN" || !reason.trim())
    throw Error("Se requiere Administrador y motivo.");
  const { db } = await firebaseClient(),
    signature = await fingerprint({
      workerId,
      patch,
      expectedRevision,
      reason,
    });
  await runTransaction(db, async (tx) => {
    const record = doc(db, "workforce_worker_adjustments", workerId),
      event = doc(db, "workforce_worker_history", operationId),
      settings = doc(db, "workforce_settings", "people");
    const [old, previous, config] = await Promise.all([
      tx.get(record),
      tx.get(event),
      tx.get(settings),
    ]);
    if (previous.exists()) {
      if (previous.data().fingerprint !== signature)
        throw Error("Operación incompatible.");
      return;
    }
    if ((old.data()?.revision ?? 0) !== expectedRevision)
      throw Error("El perfil cambió. Actualiza antes de editar.");
    const inactive = new Set<string>(config.data()?.inactiveWorkerIds ?? []);
    if (patch.status === "inactive") inactive.add(workerId);
    else inactive.delete(workerId);
    tx.set(record, {
      ...patch,
      revision: expectedRevision + 1,
      lastOperationId: operationId,
      updatedBy: String(user.id),
      updatedAt: serverTimestamp(),
    });
    tx.set(settings, { inactiveWorkerIds: [...inactive] });
    tx.set(event, {
      workerId,
      patch,
      revision: expectedRevision + 1,
      reason: reason.trim(),
      actor: String(user.id),
      fingerprint: signature,
      createdAt: serverTimestamp(),
    });
  });
}
export async function workforceUsers(user: AuthUser): Promise<CloudRow[]> {
  if (user.role !== "ADMIN") return [];
  const { db } = await firebaseClient(),
    rows = await getDocsFromServer(collection(db, "users"));
  return rows.docs.map((row) => ({ ...row.data(), id: row.id }));
}
export async function bindWorkforceAccount(
  user: AuthUser,
  uid: string,
  workerId: string,
) {
  if (user.role !== "ADMIN")
    throw Error("Solo el Administrador vincula cuentas existentes.");
  const { db } = await firebaseClient();
  await runTransaction(db, async (tx) => {
    const target = doc(db, "workforce_accounts", uid),
      old = await tx.get(target);
    if (old.exists()) throw Error("La cuenta ya tiene un vínculo permanente.");
    tx.set(target, {
      workerId,
      createdBy: String(user.id),
      createdAt: serverTimestamp(),
    });
  });
}
export function applyAdjustments(workers: CloudRow[], patches: CloudRow[]) {
  return workers.map((worker) => ({
    ...worker,
    ...patches.find((p) => p.id === worker.id),
    id: worker.id,
  }));
}
// Writes are deliberately confined to workforce_*; original payroll, salary,
// attendance, worker and financial documents are never mutation targets.
export type WorkforceDocument = DocumentData;
