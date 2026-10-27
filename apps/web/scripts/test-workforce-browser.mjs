import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";

// Synthetic fixtures are confined to a demo-* project on loopback emulators.
const projectId = "demo-workforce-browser";
const env = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: "127.0.0.1",
    port: 8381,
    rules: fs.readFileSync("../../firebase/firestore.rules", "utf8"),
  },
});
const password = "Isolated-fixture-2026!";
const accounts = {};
for (const role of ["admin", "manager", "worker"]) {
  const email = `${role}@example.invalid`;
  const response = await fetch(
    "http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-public-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const value = await response.json();
  if (!response.ok) {
    const login = await fetch(
      "http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-public-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    accounts[role] = (await login.json()).localId;
  } else accounts[role] = value.localId;
  assert.ok(accounts[role]);
}
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  for (const [role, uid] of Object.entries(accounts))
    await setDoc(doc(db, "users", uid), {
      role,
      active: true,
      displayName: `${role} de prueba`,
    });
  for (let n = 1; n <= 6; n++)
    await setDoc(doc(db, "workers", `w${n}`), {
      firstName: `Persona ${n}`,
      lastName: "Sintética",
      age: 25,
      area: "Mantenimiento",
      status: "active",
    });
  await setDoc(doc(db, "workforce_accounts", accounts.worker), {
    workerId: "w1",
  });
  await setDoc(doc(db, "microbusinesses", "u1"), {
    name: "Unidad sintética",
    status: "active",
  });
  await setDoc(doc(db, "salaries", "s1"), {
    workerId: "w1",
    history: [
      {
        from: "2026-01-01",
        type: "weekly",
        currency: "USD",
        amountCents: 12345,
      },
    ],
  });
  await setDoc(doc(db, "attendance", "a1"), {
    workerId: "w1",
    date: "2026-10-27",
    status: "present",
  });
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.QA_BROWSER_CHANNEL
    ? { channel: process.env.QA_BROWSER_CHANNEL }
    : {}),
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(20000);
  const base = "http://127.0.0.1:3004";
  async function login(role) {
    await page.goto(`${base}/login`);
    await page.getByLabel("Correo electrónico").fill(`${role}@example.invalid`);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page
      .getByText("Verificando sesión…", { exact: true })
      .waitFor({ state: "hidden" });
  }
  await login("admin");
  await page.goto(`${base}/dashboard/workforce`);
  await page
    .getByRole("button", { name: "Crear tarea", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Crear tarea", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Reparar riego sintético");
  await dialog.getByLabel("Tipo de labor").fill("Mantenimiento");
  await dialog.getByLabel("Sector / lote").fill("Sector de prueba");
  await dialog.getByLabel("Persona 1 Sintética").check();
  await dialog.getByLabel("Criterio de aceptación").fill("Sin fugas");
  await dialog.getByLabel("Meta numérica").fill("10");
  await dialog.getByLabel("Unidad de medida").fill("metros");
  await dialog.getByLabel("Horas previstas por persona").fill("2");
  await dialog
    .getByRole("button", { name: "Crear tarea", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page
    .getByRole("button", {
      name: "Iniciar Reparar riego sintético",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Ver tarea", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Registrar cierre", exact: true })
    .click();
  const close = page.getByRole("dialog", {
    name: "Cierre de jornada: Reparar riego sintético",
  });
  await close.getByLabel("Resultado observado").fill("Reparación completa");
  await close.getByLabel("Se cumplió el criterio").check();
  await close.getByLabel("Cantidad realizada").fill("8");
  await close.getByLabel("Persona 1 Sintética · minutos").fill("120");
  await close.getByRole("button", { name: "Enviar a revisión" }).click();
  await close.waitFor({ state: "hidden" });
  await page
    .getByRole("dialog", { name: "Reparar riego sintético", exact: true })
    .getByRole("button", { name: "Revisar cierre" })
    .click();
  const review = page.getByRole("dialog", {
    name: "Revisar: Reparar riego sintético",
  });
  await review.getByLabel("Observaciones").fill("Inspección correcta");
  await review.getByRole("button", { name: "Aceptar cierre" }).click();
  await review.waitFor({ state: "hidden" });
  await page
    .getByRole("dialog", { name: "Reparar riego sintético", exact: true })
    .getByText("Aceptada · Reparar riego sintético", { exact: true })
    .waitFor();
  await page
    .getByRole("dialog", { name: "Reparar riego sintético", exact: true })
    .getByRole("button", { name: "Cerrar ventana" })
    .click();
  await page
    .getByRole("button", { name: "Cambiar modo oscuro o claro" })
    .click();
  assert.equal(
    await page.locator("html").evaluate((e) => e.classList.contains("dark")),
    true,
  );
  await page.screenshot({
    path: "../../audit-reports/workforce-firebase-dark-desktop.png",
    fullPage: true,
  });
  await page.goto(`${base}/dashboard/employees`);
  await page.getByText("$123.45 USD", { exact: false }).first().waitFor();
  assert.equal(
    await page
      .getByText("Modo Demostración / Offline", { exact: false })
      .count(),
    0,
  );
  await page.screenshot({
    path: "../../audit-reports/workforce-firebase-workers.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/dashboard/workforce?worker=w1`);
  await page
    .getByRole("heading", { name: "Historial de Persona 1 Sintética" })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "../../audit-reports/workforce-firebase-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Menú de usuario", { exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.waitForURL("**/login");
  await login("worker");
  await page.goto(`${base}/dashboard/workforce`);
  await page
    .getByRole("navigation", { name: "Columnas del tablero" })
    .getByRole("button", { name: /Finalizado/ })
    .click();
  await page
    .getByRole("button", { name: "Reparar riego sintético", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Crear tarea", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByRole("link", { name: "Finanzas", exact: true }).count(),
    0,
  );
  await env.withSecurityRulesDisabled(async (c) => {
    const tasks = await getDocs(collection(c.firestore(), "workforce_tasks"));
    assert.equal(tasks.size, 1);
    assert.equal(tasks.docs[0].data().status, "done");
    const history = await getDocs(
      collection(c.firestore(), "workforce_history"),
    );
    assert.equal(history.size, 4);
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: real Firebase adapter on isolated emulators, create/assign/start/close/accept/history, USD, dark mode, mobile without horizontal overflow, worker role and no duplicate task.",
  );
} finally {
  await browser.close();
  await env.cleanup();
}
