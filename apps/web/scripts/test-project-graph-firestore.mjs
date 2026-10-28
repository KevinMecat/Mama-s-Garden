import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import ts from "typescript";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as store from "firebase/firestore";

// This project exists only in the loopback emulator.
const env = await initializeTestEnvironment({ projectId: "demo-project-graph", firestore: { host: "127.0.0.1", port: 8381, rules: fs.readFileSync("../../firebase/firestore.rules", "utf8") } });
const compile = (path, requires) => {
  const result = {};
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", "require", "crypto", "TextEncoder", source)(result, requires, crypto.webcrypto, TextEncoder);
  return result;
};
const cpm = compile("src/lib/project-cpm.ts", () => ({}));
let db = env.authenticatedContext("admin").firestore();
const graphApi = compile("src/lib/firebase-project-graph.ts", (name) => name === "firebase/firestore" ? store : name === "./project-cpm" ? cpm : { firebaseClient: async () => ({ db }) });
const admin = { id: "admin", role: "ADMIN", first_name: "Persona de prueba" };
const worker = { id: "worker", role: "WORKER" };
const op = () => crypto.randomUUID();
const makeTask = (id) => ({ id, title: `Tarea ${id}`, activity: "Prueba", project: "p1", location: "Lote", assignees: ["w1"], assigneeNames: { w1: "Persona" }, dueDate: "2026-10-28", priority: "normal", instructions: "", acceptanceCriteria: "Completa", targetQuantity: null, unit: "", estimatedHours: 2, status: "todo", isBlocked: false, blockReason: "", isCancelled: false, cancelReason: "", revision: 1, logCount: 0, latestLogId: "", latestReviewId: "", lastOperationId: op(), createdBy: "admin", updatedBy: "admin", createdAt: store.Timestamp.fromMillis(1), updatedAt: store.Timestamp.fromMillis(1) });
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const d = context.firestore();
    for (const [uid, role] of [["admin", "admin"], ["worker", "worker"]]) await store.setDoc(store.doc(d, "users", uid), { active: true, role });
    await store.setDoc(store.doc(d, "workers", "w1"), { status: "active" });
    await store.setDoc(store.doc(d, "microbusinesses", "p1"), { name: "Unidad aislada" });
    for (const id of ["a", "b", "c"]) { const { id: ignored, ...row } = makeTask(id); void ignored; await store.setDoc(store.doc(d, "workforce_tasks", id), row); }
  });
  const tasks = await Promise.all(["a", "b", "c"].map(async (id) => ({ ...((await store.getDoc(store.doc(db, "workforce_tasks", id))).data()), id })));
  const operation = op();
  await graphApi.saveProjectDependencies(admin, tasks[0], tasks, ["b"], 0, operation);
  await graphApi.saveProjectDependencies(admin, tasks[0], tasks, ["b"], 0, operation);
  assert.deepEqual((await store.getDoc(store.doc(db, "workforce_tasks", "a"))).data().dependencyTaskIds, ["b"]);
  assert.equal((await graphApi.readProjectGraph("p1")).revision, 1);
  await assert.rejects(() => graphApi.saveProjectDependencies(admin, tasks[1], tasks, ["a"], 1, op()), /ciclo/);
  await assert.rejects(() => graphApi.saveProjectDependencies(admin, tasks[2], tasks, ["a"], 0, op()), /cambiaron/);
  await assert.rejects(() => graphApi.saveProjectDependencies(worker, tasks[1], tasks, [], 1, op()), /Encargado/);
  await assertFails(store.updateDoc(store.doc(db, "workforce_tasks", "b"), { dependencyTaskIds: ["a"] }));
  await assertFails(store.setDoc(store.doc(db, "workforce_project_graphs", "p1"), { projectId: "p1", revision: 2, edges: { a: ["b"], b: ["a"] }, lastTaskId: "b", lastOperationId: op(), updatedBy: "admin", updatedAt: store.serverTimestamp() }));
  const concurrent = await Promise.allSettled([
    graphApi.saveProjectDependencies(admin, tasks[1], tasks, ["c"], 1, op()),
    graphApi.saveProjectDependencies(admin, tasks[2], tasks, ["b"], 1, op()),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  const finalGraph = await graphApi.readProjectGraph("p1");
  assert.doesNotThrow(() => graphApi.validateProjectGraph(tasks, "p1", finalGraph.edges));
  console.log("PASS isolated project graph: cycles, stale graph, idempotency, role and linked writes.");
} finally { await env.cleanup(); }
