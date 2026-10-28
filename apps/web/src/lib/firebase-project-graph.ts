import { doc, getDocFromServer, runTransaction, serverTimestamp } from "firebase/firestore";
import { firebaseClient } from "./firebase-client";
import { calculateCriticalPath } from "./project-cpm";
import type { WorkTask } from "./firebase-workforce-domain";
import type { AuthUser } from "@/types/auth";

export type ProjectTask = WorkTask & { dependencyTaskIds?: string[] };
export type ProjectGraph = { projectId: string; revision: number; edges: Record<string, string[]> };

export async function readProjectGraph(projectId: string): Promise<ProjectGraph> {
  const { db } = await firebaseClient();
  const snapshot = await getDocFromServer(doc(db, "workforce_project_graphs", projectId));
  return snapshot.exists() ? snapshot.data() as ProjectGraph : { projectId, revision: 0, edges: {} };
}

export function validateProjectGraph(tasks: ProjectTask[], projectId: string, edges: Record<string, string[]>) {
  // Keep cancelled nodes in the graph until incoming references are removed;
  // otherwise two affected tasks could be impossible to repair one at a time.
  const project = tasks.filter((task) => task.project === projectId);
  return calculateCriticalPath(project.map((task) => ({ id: task.id, duration: 1, dependencies: edges[task.id] ?? task.dependencyTaskIds ?? [] })));
}

export async function saveProjectDependencies(user: AuthUser, task: ProjectTask, allTasks: ProjectTask[], dependencies: string[], graphRevision: number, operationId: string) {
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role)) throw Error("Solo el Administrador o Encargado puede editar dependencias.");
  if (!task.project || task.status === "done" || task.isCancelled) throw Error("Selecciona una tarea activa de un proyecto.");
  if (dependencies.length > 20 || new Set(dependencies).size !== dependencies.length || dependencies.includes(task.id)) throw Error("Las dependencias no son válidas.");
  const { db } = await firebaseClient();
  const signatureInput = JSON.stringify({ taskId: task.id, revision: task.revision, graphRevision, dependencies });
  const signatureBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureInput));
  const fingerprint = [...new Uint8Array(signatureBytes)].map((n) => n.toString(16).padStart(2, "0")).join("");
  await runTransaction(db, async (tx) => {
    const taskRef = doc(db, "workforce_tasks", task.id), graphRef = doc(db, "workforce_project_graphs", task.project), eventRef = doc(db, "workforce_history", operationId);
    const [existing, target, graph, ...prerequisites] = await Promise.all([
      tx.get(eventRef), tx.get(taskRef), tx.get(graphRef), ...dependencies.map((id) => tx.get(doc(db, "workforce_tasks", id))),
    ]);
    if (existing.exists()) {
      if (existing.data().fingerprint !== fingerprint || existing.data().actor !== String(user.id)) throw Error("La operación no coincide con el intento anterior.");
      return;
    }
    if (!target.exists() || target.data().revision !== task.revision || target.data().project !== task.project) throw Error("La tarea cambió. Actualiza antes de guardar.");
    if ((graph.data()?.revision ?? 0) !== graphRevision) throw Error("Las dependencias cambiaron. Actualiza antes de guardar.");
    if (prerequisites.some((row) => !row.exists() || row.data().project !== task.project || row.data().isCancelled)) throw Error("Una dependencia ya no pertenece al proyecto o fue cancelada.");
    const edges = { ...(graph.data()?.edges ?? {}), [task.id]: dependencies } as Record<string, string[]>;
    validateProjectGraph(allTasks, task.project, edges);
    tx.update(taskRef, { dependencyTaskIds: dependencies, revision: task.revision + 1, lastOperationId: operationId, updatedBy: String(user.id), updatedAt: serverTimestamp() });
    tx.set(graphRef, { projectId: task.project, revision: graphRevision + 1, edges, lastTaskId: task.id, lastOperationId: operationId, updatedBy: String(user.id), updatedAt: serverTimestamp() });
    tx.set(eventRef, { taskId: task.id, assignees: target.data().assignees, action: "dependencies", fromStatus: target.data().status, toStatus: target.data().status, reason: "Dependencias actualizadas", revision: task.revision + 1, actor: String(user.id), actorLabel: user.first_name || user.role_label || "Cuenta autorizada", fingerprint, createdAt: serverTimestamp() });
  });
}
