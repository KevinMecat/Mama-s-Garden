import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import * as store from "firebase/firestore";
store.setLogLevel("silent");

// This test uses an isolated demo project on the local emulator only.
const env = await initializeTestEnvironment({
  projectId: "demo-competencies-security",
  firestore: { host: "127.0.0.1", port: 8381, rules: fs.readFileSync("../../firebase/firestore.rules", "utf8") },
});
let db;
const output = ts.transpileModule(fs.readFileSync("src/lib/firebase-competencies.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
new Function("exports", "require", output)(api, (name) => name === "firebase/firestore" ? store : name.endsWith("firebase-client") ? { firebaseClient: async () => ({ db }) } : { workerBinding: async () => "w1" });
const admin = { id: "admin", role: "ADMIN" }, manager = { id: "manager", role: "MANAGER" }, worker = { id: "worker", role: "WORKER" };
const select = (user) => { db = env.authenticatedContext(user.id).firestore(); };
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const seed = context.firestore();
    for (const [id, role] of [["admin", "admin"], ["manager", "manager"], ["supervisor", "supervisor"], ["worker", "worker"], ["other", "worker"]])
      await store.setDoc(store.doc(seed, "users", id), { role, active: true });
    await store.setDoc(store.doc(seed, "workers", "w1"), { firstName: "Persona", status: "active", profile: "Original" });
    await store.setDoc(store.doc(seed, "workers", "w2"), { firstName: "Otra", status: "active" });
    await store.setDoc(store.doc(seed, "workforce_accounts", "worker"), { workerId: "w1" });
    await store.setDoc(store.doc(seed, "workforce_accounts", "other"), { workerId: "w2" });
  });
  select(manager);
  const competencies = { Poda: "autonomous", Riego: "supervised" };
  await api.saveCompetencies(manager, "w1", competencies, 0, "op-create", "Prueba aislada");
  await api.saveCompetencies(manager, "w1", competencies, 0, "op-create", "Prueba aislada");
  const created = await api.readCompetencyProfile("w1");
  assert.equal(created.revision, 1);
  assert.deepEqual(created.competencies, competencies);
  await assert.rejects(() => api.saveCompetencies(manager, "w1", { Poda: "supervised" }, 0, "op-stale", "Prueba aislada"), /cambiaron/);
  await assert.rejects(() => api.saveCompetencies(manager, "w1", { Poda: "supervised" }, 0, "op-create", "Prueba aislada"), /incompatible/);
  await api.saveCompetencies(manager, "w1", { Poda: "supervised" }, 1, "op-update", "Cambio revisado");
  const history = await store.getDoc(store.doc(db, "workforce_profile_history", "op-update"));
  assert.deepEqual(history.data().previousCompetencies, competencies);
  assert.deepEqual(history.data().competencies, { Poda: "supervised" });
  await assertFails(store.updateDoc(store.doc(db, "workforce_profile_history", "op-update"), { reason: "cambio" }));
  await assertFails(store.deleteDoc(store.doc(db, "workforce_profiles", "w1")));
  await assertFails(store.updateDoc(store.doc(db, "workforce_profiles", "w1"), { competencies: { Poda: "injected" } }));
  const forged = store.writeBatch(db);
  forged.set(store.doc(db, "workforce_profiles", "w2"), { workerId: "w2", competencies: { Poda: "injected" }, revision: 1, lastOperationId: "forged", updatedBy: "manager", updatedAt: store.serverTimestamp() });
  forged.set(store.doc(db, "workforce_profile_history", "forged"), { workerId: "w2", competencies: { Poda: "injected" }, previousCompetencies: {}, revision: 1, actor: "manager", reason: "Prueba", createdAt: store.serverTimestamp() });
  await assertFails(forged.commit());
  const concurrent = await Promise.allSettled([
    api.saveCompetencies(manager, "w1", { Poda: "autonomous" }, 2, "race-one", "Revisión concurrente"),
    api.saveCompetencies(manager, "w1", { Riego: "supervised" }, 2, "race-two", "Revisión concurrente"),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
  const supervisor = { id: "supervisor", role: "SUPERVISOR" };
  select(supervisor);
  await api.saveCompetencies(supervisor, "w2", { Siembra: "autonomous" }, 0, "supervisor-create", "Habilidad confirmada");
  select(worker);
  assert.equal((await api.readCompetencyProfile("w1")).revision, 3);
  await assertFails(store.getDoc(store.doc(db, "workforce_profiles", "w2")));
  await assertFails(store.getDocs(store.collection(db, "workforce_profiles")));
  await assertFails(store.setDoc(store.doc(db, "workforce_profiles", "w1"), {}));
  select(admin);
  assert.deepEqual((await store.getDoc(store.doc(db, "workers", "w1"))).data(), { firstName: "Persona", status: "active", profile: "Original" });
  assert.throws(() => api.validateCompetencies({ Poda: "autonomous", poda: "supervised" }), /repitas/);
  assert.throws(() => api.validateCompetencies({ X: "unverified" }), /inválido/);
  console.log("PASS competencies: manager writes, stale revisions, idempotency, immutable audit, worker isolation and original worker preservation.");
} finally { await env.cleanup(); }
