import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import * as store from "firebase/firestore";

store.setLogLevel("silent");
const env = await initializeTestEnvironment({ projectId: "demo-planner-apply", firestore: { host: "127.0.0.1", port: Number(process.env.FIRESTORE_TEST_PORT || 8381), rules: fs.readFileSync("../../firebase/firestore.rules", "utf8") } });
let db;
const output = ts.transpileModule(fs.readFileSync("src/lib/firebase-planner-apply.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
new Function("exports", "require", output)(api, (name) => name === "firebase/firestore" ? store : { firebaseClient: async () => ({ db }) });
const manager = { id: "manager", role: "MANAGER", first_name: "Encargado" };
const when = store.Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));
const task = { title: "Prueba", activity: "Poda", project: "", location: "Lote", assignees: ["w1"], assigneeNames: { w1: "Persona" }, dueDate: "2026-10-27", priority: "normal", instructions: "", acceptanceCriteria: "Completo", targetQuantity: null, unit: "", estimatedHours: 2, status: "todo", isBlocked: false, blockReason: "", isCancelled: false, cancelReason: "", revision: 1, logCount: 0, latestLogId: "", latestReviewId: "", lastOperationId: "created", createdBy: "manager", updatedBy: "manager", createdAt: when, updatedAt: when };
const worker = { id: "w1", name: "Persona", profileRevision: 1, profileUpdatedAtMillis: null, adjustmentRevision: null, adjustmentUpdatedAtMillis: null, attendance: { source: "operational", revision: 1, updatedAtMillis: null, status: "present" } };

try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const seed = context.firestore();
    await store.setDoc(store.doc(seed, "users", "manager"), { role: "manager", active: true });
    await store.setDoc(store.doc(seed, "workers", "w1"), { firstName: "Persona", status: "active" });
    await store.setDoc(store.doc(seed, "workforce_profiles", "w1"), { workerId: "w1", competencies: { Poda: "autonomous" }, revision: 1 });
    await store.setDoc(store.doc(seed, "workforce_attendance", "w1_2026-10-27"), { workerId: "w1", date: "2026-10-27", revision: 1, status: "present" });
    for (const id of ["t1", "t2"]) await store.setDoc(store.doc(seed, "workforce_tasks", id), task);
  });
  db = env.authenticatedContext("manager").firestore();
  const unsigned = { id: "proposal-1", date: "2026-10-27", tasks: ["t1", "t2"].map((id) => ({ id, revision: 1, updatedAtMillis: when.toMillis() })), workers: [worker], assignments: ["t1", "t2"].map((taskId) => ({ taskId, hoursByWorker: { w1: 1 } })) };
  const proposal = { ...unsigned, snapshotFingerprint: await api.proposalFingerprint(unsigned) };

  // A legitimate request from a manager must fail until all model inputs are protected.
  await assert.rejects(() => api.applyDailyProposal(manager, proposal));
  for (const id of ["t1", "t2"]) {
    const current = (await store.getDoc(store.doc(db, "workforce_tasks", id))).data();
    assert.equal(current.revision, 1);
    assert.equal(current.lastAppliedProposalId, undefined);
  }
  assert.equal((await store.getDoc(store.doc(db, "workforce_plan_proposals", proposal.id))).exists(), false);
  assert.equal((await store.getDoc(store.doc(db, "workforce_history", `${proposal.id}-t1`))).exists(), false);

  // A caller bypassing the disabled UI cannot forge a plausible atomic application.
  const forgedId = "proposal-forged", eventId = `${forgedId}-t1`;
  const forged = store.writeBatch(db);
  forged.update(store.doc(db, "workforce_tasks", "t1"), { assignees: ["w1"], assigneeNames: { w1: "Persona" }, plannedHoursByWorker: { w1: 1 }, lastAppliedProposalId: forgedId, planApprovedBy: "manager", planApprovedAt: store.serverTimestamp(), revision: 2, lastOperationId: eventId, updatedBy: "manager", updatedAt: store.serverTimestamp() });
  forged.set(store.doc(db, "workforce_history", eventId), { taskId: "t1", assignees: ["w1"], action: "apply_proposal", fromStatus: "todo", toStatus: "todo", reason: "Prueba", revision: 2, actor: "manager", actorLabel: "Encargado", fingerprint: proposal.snapshotFingerprint, proposalId: forgedId, previousAssignees: ["w1"], previousPlannedHoursByWorker: {}, createdAt: store.serverTimestamp() });
  forged.set(store.doc(db, "workforce_plan_proposals", forgedId), { date: "2026-10-27", actor: "manager", fingerprint: proposal.snapshotFingerprint, taskIds: ["t1"], createdAt: store.serverTimestamp() });
  await assertFails(forged.commit());
  await assertFails(store.setDoc(store.doc(db, "workforce_plan_proposals", "direct"), { actor: "manager", createdAt: store.serverTimestamp() }));
  await assertFails(store.setDoc(store.doc(db, "workforce_history", "direct-apply"), { taskId: "t1", assignees: ["w1"], action: "apply_proposal", fromStatus: "todo", toStatus: "todo", reason: "Prueba", revision: 2, actor: "manager", actorLabel: "Encargado", fingerprint: proposal.snapshotFingerprint, createdAt: store.serverTimestamp() }));
  await assertFails(store.updateDoc(store.doc(db, "workforce_tasks", "t1"), { plannedHoursByWorker: { w1: 1 } }));
  const forgedCreation = store.writeBatch(db);
  forgedCreation.set(store.doc(db, "workforce_tasks", "forged-create"), { ...task, lastOperationId: "forged-create-event", createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp(), lastAppliedProposalId: "invented", planApprovedBy: "manager", planApprovedAt: store.serverTimestamp(), plannedHoursByWorker: { w1: 1 } });
  forgedCreation.set(store.doc(db, "workforce_history", "forged-create-event"), { taskId: "forged-create", assignees: ["w1"], action: "create", fromStatus: "", toStatus: "todo", reason: "Prueba", revision: 1, actor: "manager", actorLabel: "Encargado", fingerprint: "b".repeat(64), createdAt: store.serverTimestamp() });
  await assertFails(forgedCreation.commit());
  assert.equal((await store.getDoc(store.doc(db, "workforce_tasks", "t1"))).data().revision, 1);
  assert.equal((await store.getDoc(store.doc(db, "workforce_plan_proposals", forgedId))).exists(), false);
  console.log("PASS planner application disabled: legitimate and forged requests denied without writes.");
} finally { await env.cleanup(); }
