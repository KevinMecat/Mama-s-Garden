import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import * as store from "firebase/firestore";
import * as storage from "firebase/storage";
store.setLogLevel("silent");
const projectId = "demo-workforce-security";
const env = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: "127.0.0.1",
    port: 8381,
    rules: fs.readFileSync("../../firebase/firestore.rules", "utf8"),
  },
  storage: {
    host: "127.0.0.1",
    port: 9398,
    rules: fs.readFileSync("../../firebase/storage.rules", "utf8"),
  },
});
let db;
const domainContext = { exports: {}, require: () => ({}) };
new Function(
  "exports",
  "require",
  ts.transpileModule(
    fs.readFileSync("src/lib/firebase-workforce-domain.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)(domainContext.exports, domainContext.require);
const domain = domainContext.exports;
const context = {
  exports: {},
  crypto: crypto.webcrypto,
  Date,
  TextEncoder,
  require: (name) =>
    name === "firebase/firestore"
      ? store
      : name === "firebase/storage"
        ? storage
        : name.endsWith("firebase-client")
          ? { firebaseClient: async () => ({ db }) }
          : domain,
};
new Function(
  "exports",
  "require",
  ts.transpileModule(fs.readFileSync("src/lib/firebase-workforce.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(context.exports, context.require);
const api = context.exports,
  admin = { id: "admin", role: "ADMIN" },
  manager = { id: "manager", role: "MANAGER" },
  worker = { id: "worker", role: "WORKER" };
const selectUser = (user) => {
  db = env.authenticatedContext(user.id).firestore();
};
const get = async (id) => {
  const s = await store.getDoc(store.doc(db, "workforce_tasks", id));
  return { ...s.data(), id: s.id };
};
const plan = {
  title: "Labor sintética aislada",
  activity: "Mantenimiento",
  project: "unit-test",
  location: "Sector de prueba",
  assignees: ["w1"],
  assigneeNames: { w1: "Persona sintética" },
  dueDate: "2026-10-27",
  priority: "normal",
  instructions: "Solo emulador",
  acceptanceCriteria: "Verificar reparación",
  targetQuantity: 10,
  unit: "metros",
  estimatedHours: 2,
};
const op = () => crypto.randomUUID();
const command = async (id, value, user = admin) => {
  selectUser(user);
  const t = await get(id);
  try {
    await api.commandWorkTask(
      user,
      t,
      value,
      op(),
      user.role === "WORKER" ? "w1" : null,
    );
  } catch (e) {
    console.log("Command rejected:", value.action, user.role);
    throw e;
  }
  return get(id);
};
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    for (const [id, role] of [
      ["admin", "admin"],
      ["manager", "manager"],
      ["supervisor", "supervisor"],
      ["worker", "worker"],
      ["other", "worker"],
      ["disabled", "admin"],
    ])
      await store.setDoc(store.doc(d, "users", id), {
        role,
        active: id !== "disabled",
      });
    for (let i = 1; i <= 7; i++)
      await store.setDoc(store.doc(d, "workers", "w" + i), {
        firstName: "Persona",
        lastName: "Sintética",
        status: i === 7 ? "inactive" : "active",
        age: 25,
        area: "Prueba",
      });
    await store.setDoc(store.doc(d, "microbusinesses", "unit-test"), {
      name: "Unidad sintética",
      status: "active",
    });
    await store.setDoc(store.doc(d, "salaries", "s1"), {
      workerId: "w1",
      history: [
        {
          from: "2026-01-01",
          type: "weekly",
          currency: "USD",
          amountCents: 10000,
        },
      ],
    });
    await store.setDoc(store.doc(d, "attendance", "a1"), {
      workerId: "w1",
      date: "2026-10-27",
      status: "absent",
    });
    await store.setDoc(store.doc(d, "payrolls", "p1"), {
      approved: true,
      total: 10000,
    });
    await store.setDoc(store.doc(d, "transactions", "f1"), {
      currency: "USD",
      amountCents: 1000,
    });
    await store.setDoc(store.doc(d, "workforce_accounts", "worker"), {
      workerId: "w1",
    });
    await store.setDoc(store.doc(d, "workforce_accounts", "other"), {
      workerId: "w2",
    });
  });
  selectUser(admin);
  const before = await Promise.all(
    [
      "salaries/s1",
      "attendance/a1",
      "payrolls/p1",
      "transactions/f1",
      "workers/w1",
    ].map((p) => store.getDoc(store.doc(db, p)).then((s) => s.data())),
  );
  const id = op(),
    createOp = op();
  await api.createWorkTask(admin, plan, id, createOp);
  await api.createWorkTask(admin, plan, id, createOp);
  assert.equal(
    (await get(id)).revision,
    1,
    "Idempotent retry must not duplicate task/event",
  );
  await assertFails(
    store.updateDoc(store.doc(db, "workforce_tasks", id), {
      status: "done",
      revision: 2,
    }),
  );
  selectUser(worker);
  await assert.rejects(() => api.createWorkTask(worker, plan, op(), op()));
  await command(id, { action: "start" }, worker);
  await command(id, { action: "block", reason: "Falta herramienta" }, worker);
  await assert.rejects(() =>
    command(id, { action: "submit", log: {} }, worker),
  );
  await command(
    id,
    { action: "unblock", reason: "Herramienta disponible" },
    manager,
  );
  const log = {
    result: "Resultado sintético",
    criterionMet: true,
    quantity: 10,
    minutes: { w1: 120 },
    incidents: "",
    evidence: [],
    workDate: new Date("2026-10-27T06:00:00Z"),
  };
  await command(id, { action: "submit", log }, worker);
  await assert.rejects(() =>
    command(
      id,
      { action: "accept", observations: "", acceptedQuantity: 10 },
      manager,
    ),
  );
  selectUser(manager);
  const rejected = await get(id);
  const badReview = op();
  const batch = store.writeBatch(db);
  batch.set(store.doc(db, "workforce_reviews", badReview), {
    taskId: id,
    assignees: rejected.assignees,
    logId: rejected.latestLogId,
    accepted: true,
    acceptedQuantity: 10,
    observations: "",
    createdBy: "manager",
    createdAt: store.serverTimestamp(),
  });
  batch.update(store.doc(db, "workforce_tasks", id), {
    status: "done",
    latestReviewId: badReview,
    lastOperationId: badReview,
    revision: rejected.revision + 1,
    updatedBy: "manager",
    updatedAt: store.serverTimestamp(),
  });
  batch.set(store.doc(db, "workforce_history", badReview), {
    taskId: id,
    assignees: rejected.assignees,
    action: "accept",
    fromStatus: "review",
    toStatus: "done",
    reason: "",
    revision: rejected.revision + 1,
    actor: "manager",
    actorLabel: "Cuenta autorizada",
    fingerprint: "0".repeat(64),
    createdAt: store.serverTimestamp(),
  });
  await assertFails(batch.commit());
  await command(id, {
    action: "return",
    observations: "Corregir evidencia",
    acceptedQuantity: null,
  });
  await command(id, { action: "submit", log: { ...log, quantity: 8 } }, worker);
  const done = await command(id, {
    action: "accept",
    observations: "Verificado",
    acceptedQuantity: 8,
  });
  assert.equal(done.status, "done");
  await assert.rejects(() => command(id, { action: "start" }));
  selectUser(admin);
  await assertFails(store.deleteDoc(store.doc(db, "workforce_tasks", id)));
  await assertFails(
    store.updateDoc(store.doc(db, "workforce_logs", done.latestLogId), {
      quantity: 999,
    }),
  );
  await assertFails(
    store.deleteDoc(store.doc(db, "workforce_history", done.lastOperationId)),
  );
  const original = await api.readWorkforce(admin),
    history = original.events.filter((e) => e.taskId === id);
  assert.equal(history.length, 8);
  const logDone = original.logs.find((l) => l.id === done.latestLogId),
    reviewDone = original.reviews.find((r) => r.id === done.latestReviewId);
  assert.equal(domain.productivity(done, logDone, reviewDone).value, 4);
  const copy = domain.duplicatePlan(done, "2026-10-28");
  assert.ok(
    !("logCount" in copy) && !("status" in copy) && !("minutes" in copy),
  );
  const crewPlan = {
    ...plan,
    assignees: ["w1", "w2", "w3", "w4", "w5", "w6"],
    assigneeNames: Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((n) => ["w" + n, "Persona " + n]),
    ),
  };
  const crewId = op();
  await api.createWorkTask(admin, crewPlan, crewId, op());
  await command(crewId, { action: "start" }, manager);
  const crewLog = {
    ...log,
    minutes: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => ["w" + n, 60])),
  };
  await assert.rejects(() =>
    command(crewId, { action: "submit", log: crewLog }, worker),
  );
  await command(crewId, { action: "submit", log: crewLog }, manager);
  const crewDone = await command(crewId, {
    action: "accept",
    observations: "Conjunto verificado",
    acceptedQuantity: 10,
  });
  const crewData = await api.readWorkforce(admin);
  assert.match(
    domain.productivity(
      crewDone,
      crewData.logs.find((l) => l.id === crewDone.latestLogId),
      crewData.reviews.find((r) => r.id === crewDone.latestReviewId),
    ).label,
    /cuadrilla/,
  );
  const staleId = op();
  await api.createWorkTask(admin, plan, staleId, op());
  const stale = await get(staleId);
  await command(staleId, { action: "start" });
  await assert.rejects(
    () => api.commandWorkTask(admin, stale, { action: "start" }, op(), null),
    /actualizó/,
  );
  selectUser(admin);
  await assertFails(
    api.createWorkTask(
      admin,
      { ...plan, assignees: ["w7"], assigneeNames: { w7: "Inactiva" } },
      op(),
      op(),
    ),
  );
  await api.adjustWorker(
    admin,
    "w2",
    {
      firstName: "Persona",
      lastName: "Sintética",
      age: 25,
      area: "Prueba",
      profile: "Perfil de prueba",
      status: "inactive",
    },
    0,
    op(),
    "Prueba aislada",
  );
  await assertFails(
    api.createWorkTask(
      admin,
      { ...plan, assignees: ["w2"], assigneeNames: { w2: "Inactiva" } },
      op(),
      op(),
    ),
  );
  selectUser(worker);
  const own = await api.readWorkforce(worker);
  assert.ok(own.tasks.every((t) => t.assignees.includes("w1")));
  const other = env.authenticatedContext("other").firestore();
  await assertFails(store.getDoc(store.doc(other, "workforce_tasks", id)));
  for (const role of ["manager", "supervisor", "worker"])
    for (const p of ["salaries/s1", "payrolls/p1", "transactions/f1"])
      await assertFails(
        store.getDoc(store.doc(env.authenticatedContext(role).firestore(), p)),
      );
  await assertFails(
    store.getDoc(
      store.doc(
        env.unauthenticatedContext().firestore(),
        "workforce_tasks",
        id,
      ),
    ),
  );
  await assertFails(
    store.getDoc(
      store.doc(
        env.authenticatedContext("disabled").firestore(),
        "workforce_tasks",
        id,
      ),
    ),
  );
  selectUser(admin);
  const after = await Promise.all(
    [
      "salaries/s1",
      "attendance/a1",
      "payrolls/p1",
      "transactions/f1",
      "workers/w1",
    ].map((p) => store.getDoc(store.doc(db, p)).then((s) => s.data())),
  );
  assert.deepEqual(after, before);
  const completion = { ...done, targetQuantity: null };
  assert.equal(
    domain.productivity(done, logDone, reviewDone, original.logs).value,
    2,
    "Returned work still contributes to total dedicated time",
  );
  const evidenceTask = op();
  await api.createWorkTask(admin, plan, evidenceTask, op());
  await command(evidenceTask, { action: "start" });
  const bucket = env.authenticatedContext("admin").storage();
  const file = storage.ref(
    bucket,
    `workforce-evidence/${evidenceTask}/admin/${op()}`,
  );
  await storage.uploadBytes(file, new Uint8Array([1, 2, 3]), {
    contentType: "image/png",
  });
  await assertFails(
    storage.uploadBytes(file, new Uint8Array([4]), {
      contentType: "image/png",
    }),
  );
  await assertFails(storage.deleteObject(file));
  const foreign = storage.ref(
    env.authenticatedContext("other").storage(),
    `workforce-evidence/${evidenceTask}/other/${op()}`,
  );
  await assertFails(
    storage.uploadBytes(foreign, new Uint8Array([1]), {
      contentType: "image/png",
    }),
  );
  assert.equal(
    domain.productivity(completion, logDone, reviewDone).value,
    null,
  );
  assert.equal(
    domain.productivity(done, { ...logDone, minutes: { w1: 0 } }, reviewDone)
      .value,
    null,
  );
  assert.equal(
    domain.productivity(done, logDone, { ...reviewDone, acceptedQuantity: 0 })
      .value,
    0,
  );
  console.log(
    "PASS: full workday, returns, six-person crew, explicit time, idempotency, stale writes, inactive staff, role isolation, immutable history, productivity and unchanged legacy payroll/personnel/attendance.",
  );
} finally {
  await env.cleanup();
}
