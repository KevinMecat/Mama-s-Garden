import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(
  fs.readFileSync("src/lib/api-client.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const demoCode = ts.transpileModule(
  fs.readFileSync("src/lib/demo-api.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function client(origin, storage = new Map(), offline = false) {
  const calls = [];
  const events = [];
  const context = {
    exports: {},
    URL,
    Event,
    Response,
    FormData,
    structuredClone,
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_API_URL: origin } },
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      location: { reload() {} },
      dispatchEvent: (event) => events.push(event.type),
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (offline) throw new Error("API unavailable");
      return { ok: true };
    },
  };
  const demo = { ...context, exports: {} };
  vm.runInNewContext(demoCode, demo);
  context.require = (name) => {
    assert.equal(name, "@/lib/demo-api");
    return demo.exports;
  };
  vm.runInNewContext(code, context);
  return { api: context.exports, calls, events, storage, demo: demo.exports };
}
const absent = client("");
assert.equal((await absent.api.apiFetch("/api/v1/auth/me/")).status, 401);
const request = async (path, body, method = "POST", target = absent) => {
  const result = await target.api.apiFetch(`/api/v1/${path}`, {
    method: body ? method : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: result.status,
    data: result.status === 204 ? null : await result.json(),
  };
};
assert.equal(
  (
    await request("auth/login/", {
      email: "demo@mamasgarden.com",
      password: "wrong",
    })
  ).status,
  400,
);
assert.equal(
  (
    await request("auth/login/", {
      email: "demo@mamasgarden.com",
      password: "demo1234",
    })
  ).data.user.role,
  "ADMIN",
);
assert.ok(
  !absent.storage.get("finca.demo.v1").includes("demo1234"),
  "Do not persist passwords",
);
assert.equal(
  (await request("auth/me/", null, "GET", client("", absent.storage))).data.user
    .role,
  "ADMIN",
);
for (const resource of [
  "projects",
  "finance/categories",
  "finance/transactions",
  "production/products",
  "production/records",
  "production/sales",
  "payroll/employees",
  "payroll/salary-rates",
  "payroll/work-entries",
  "payroll/periods",
]) {
  const result = await request(`${resource}/`);
  assert.equal(result.status, 200, resource);
  assert.ok(result.data.length > 0, resource);
  assert.equal(
    (await request(`${resource}/1/`)).status,
    200,
    `${resource} detail`,
  );
}
const report = (await request("reports/dashboard/")).data;
assert.equal(report.kpis.month_income, "400.00");
assert.equal(report.kpis.month_expenses, "80.00");
assert.equal(report.kpis.pending_payroll.amount, "275.00");
const project = await request("projects/", {
  name: "Proyecto ficticio",
  type: "infraestructura",
  status: "active",
});
assert.equal(project.status, 201);
assert.equal(
  (await request(`projects/${project.data.id}/`)).data.name,
  "Proyecto ficticio",
);
let task = (await request("workforce/tasks/1/")).data;
const start = { action: "start", revision: task.revision, key: "start-1" };
task = (await request("workforce/tasks/1/command/", start)).data;
assert.equal(task.state, "IN_PROGRESS");
assert.equal(
  (await request("workforce/tasks/1/command/", start)).data.revision,
  task.revision,
  "Retry is idempotent",
);
assert.equal(
  (await request("workforce/tasks/1/command/", { ...start, key: "stale" }))
    .status,
  409,
);
task = (
  await request("workforce/tasks/1/command/", {
    action: "submit",
    revision: task.revision,
    result: "Riego revisado",
    criterion_met: true,
    times: [{ employee: 1, minutes: 60 }],
    key: "submit-1",
  })
).data;
assert.equal(task.state, "REVIEW");
task = (
  await request("workforce/tasks/1/command/", {
    action: "accept",
    revision: task.revision,
    observations: "Verificado en demo",
    key: "accept-1",
  })
).data;
assert.equal(task.state, "DONE");
assert.equal(task.hours, "1.00");
let crew = (await request("workforce/tasks/2/command/", {
  action: "submit", revision: 1, result: "Cosecha simulada", criterion_met: true,
  times: [{ employee: 1, minutes: 30 }], key: "crew-submit",
})).data;
assert.equal((await request("workforce/tasks/2/command/", {
  action: "accept", revision: crew.revision, observations: "Revisión demo", key: "crew-incomplete",
})).status, 400, "Crew acceptance requires every member's time");
crew = (await request("workforce/tasks/2/command/", {
  action: "time", revision: crew.revision, times: [{ employee: 2, minutes: 30 }], key: "crew-time",
})).data;
crew = (await request("workforce/tasks/2/command/", {
  action: "accept", revision: crew.revision, observations: "Revisión completa demo", key: "crew-accept",
})).data;
assert.equal(crew.state, "DONE");
assert.equal(crew.crew, true);
assert.equal(crew.productivity, null, "Never present crew productivity as individual performance");
const saleDate = (await request("production/sales/1/")).data.sale_date;
assert.equal((await request("production/sales/", {
  project: 1, product: 1, category: 1, sale_date: saleDate, quantity: "3.00", unit_price: "10.00", status: "POSTED",
})).status, 201);
assert.equal((await request("reports/dashboard/")).data.kpis.month_income, "430.00");
assert.equal((await request("payroll/periods/1/pay/", { category: 2 })).data.status, "PAID");
assert.equal((await request("reports/dashboard/")).data.kpis.pending_payroll.amount, "0.00");
assert.equal((await request("reports/dashboard/")).data.kpis.month_expenses, "355.00");
assert.equal((await request("payroll/periods/1/pay/", { category: 2 })).status, 409, "Never duplicate a simulated payment");
await request("auth/login/", {
  email: "trabajador@mamasgarden.com",
  password: "demo1234",
});
assert.equal((await request("finance/transactions/")).status, 403);
assert.equal(
  (await request("workforce/tasks/options_data/")).data.administrator,
  false,
);
await request("auth/logout/", {});
assert.equal((await request("auth/me/")).status, 401);
absent.storage.set("unrelated", "preserve");
absent.demo.resetDemo();
assert.equal(absent.storage.get("unrelated"), "preserve");
assert.equal(
  absent.calls.length,
  0,
  "No credentials may leave the browser without an API origin",
);
for (const origin of [
  "http://api.example.com",
  "https://user:pass@api.example.com",
  "https://api.example.com/path",
  "https://api.example.com?x=1",
  "https://api.example.com#x",
]) {
  assert.throws(() => client(origin).api.apiUrl("/api/v1/auth/me/"));
}
const configured = client("https://api.example.com/");
for (const route of [
  "https://attacker.example/api/",
  "//attacker.example/api/",
  "/api/\\attacker",
]) {
  assert.throws(() => configured.api.apiUrl(route));
}
await configured.api.apiFetch("/api/v1/auth/login/", {
  method: "POST",
  credentials: "omit",
  cache: "force-cache",
});
assert.equal(
  configured.calls[0].url,
  "https://api.example.com/api/v1/auth/login/",
);
assert.equal(configured.calls[0].options.credentials, "include");
assert.equal(configured.calls[0].options.cache, "no-store");
assert.equal(configured.events[0], "finca:data-changed");
const realOffline = client("https://api.example.com", absent.storage, true);
await assert.rejects(
  realOffline.api.apiFetch("/api/v1/auth/me/"),
  /API unavailable/,
);
assert.equal(
  realOffline.calls.length,
  1,
  "Configured API outages must never activate demo sessions",
);
assert.equal(realOffline.api.isDemoMode(), false);
console.log(
  "Demo authentication, persistence, resources, CRUD, workflow, roles, reset isolation and real API security checks passed.",
);
