import assert from "node:assert/strict";
import fs from "node:fs";
import { ref, uploadBytes } from "firebase/storage";
import { chromium } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";

// Synthetic fixtures are confined to a demo-* project on loopback emulators.
const projectId = "demo-workforce-browser";
const fixtureDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const env = await initializeTestEnvironment({
  projectId,
  storage: { host: "127.0.0.1", port: 9398, rules: fs.readFileSync("../../firebase/storage.rules", "utf8") },
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
  await uploadBytes(ref(c.storage("gs://demo-workforce-browser.appspot.com"), "trabajadores/w1/avatar.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6NE0AAAAASUVORK5CYII=", "base64"), { contentType: "image/png" });
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
      photoUrl: n === 1 ? "trabajadores/w1/avatar.png" : "",
      age: 25,
      area: "Mantenimiento",
      status: "active",
    });
  await setDoc(doc(db, "workforce_accounts", accounts.worker), {
    workerId: "w1",
  });
  await setDoc(doc(db, "workforce_profiles", "w1"), {
    workerId: "w1", competencies: { mantenimiento: "autonomous" }, revision: 1,
    lastOperationId: "fixture-profile", updatedBy: accounts.admin,
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
    date: fixtureDay,
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
  // Webpack can take longer on the first cold compilation on a local machine.
  page.setDefaultTimeout(60000);
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
  await dialog.getByLabel("Herramientas limitantes").fill("bomba");
  await dialog
    .getByRole("button", { name: "Crear tarea", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Proponer distribución", exact: true }).click();
  const planner = page.getByRole("dialog", { name: "Proponer distribución", exact: true });
  await planner.getByText(/Base: 2 h asignadas, 1\/1 tareas cubiertas, 0 h pendientes/).waitFor();
  await planner.getByText(/Escenario: 2 h asignadas, 1\/1 tareas cubiertas, 0 h pendientes/).waitFor();
  await planner.getByText("Simular cambios", { exact: true }).click();
  await planner.getByLabel("bomba · cantidad").fill("0");
  await planner.getByText(/Escenario: 0 h asignadas, 0\/1 tareas cubiertas, 2 h pendientes/).waitFor();
  await planner.getByText(/herramienta bomba no disponible/).waitFor();
  await planner.getByRole("button", { name: "Cerrar ventana" }).click();

  await page.getByRole("button", { name: "Ver tarea", exact: true }).click();
  const taskDetails = page.getByRole("dialog", { name: "Reparar riego sintético", exact: true });
  await taskDetails.getByRole("button", { name: "Bloquear", exact: true }).click();
  const blockDialog = page.getByRole("dialog", { name: "Bloquear tarea", exact: true });
  await blockDialog.getByLabel("Motivo obligatorio").fill("Equipo de prueba no disponible");
  await blockDialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await blockDialog.waitFor({ state: "hidden" });
  await taskDetails.getByRole("button", { name: "Cerrar ventana" }).click();
  const operationalAlerts = page.getByRole("region", { name: /Alertas operativas/ });
  await operationalAlerts.getByText("Tarea requiere atención · Reparar riego sintético", { exact: true }).waitFor();
  await operationalAlerts.getByText(/bloqueada: Equipo de prueba no disponible/).waitFor();
  await operationalAlerts.getByRole("button", { name: "Ver tarea", exact: true }).click();
  await taskDetails.getByRole("button", { name: "Resolver bloqueo", exact: true }).click();
  const unblockDialog = page.getByRole("dialog", { name: "Resolver bloqueo", exact: true });
  await unblockDialog.getByLabel("Motivo obligatorio").fill("Equipo de prueba disponible");
  await unblockDialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await unblockDialog.waitFor({ state: "hidden" });
  await taskDetails.getByRole("button", { name: "Cerrar ventana" }).click();
  await operationalAlerts.getByText("Tarea requiere atención · Reparar riego sintético", { exact: true }).waitFor({ state: "hidden" });
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
  await page.goto(`${base}/dashboard/attendance`);
  await page
    .getByRole("heading", { name: "Persona 1 Sintética", exact: true })
    .waitFor();
  const personCard = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Persona 1 Sintética",
        exact: true,
      }),
    });
  const photo = personCard.getByRole("img", {name: "Persona 1 Sintética", exact:true});
  await photo.waitFor();
  await page.waitForFunction(() => { const img = document.querySelector('img[alt="Persona 1 Sintética"]'); return img?.naturalWidth > 0; });
  const secondCard = page.locator("article").filter({has:page.getByRole("heading",{name:"Persona 2 Sintética",exact:true})});
  const day = fixtureDay;
  await page.clock.setFixedTime(new Date(`${day}T07:15:00-06:00`));
  await secondCard.getByRole("button",{name:"Registrar entrada ahora",exact:true}).click();
  await secondCard.getByRole("button",{name:"Entrada registrada",exact:true}).waitFor();
  let serverEntry;
  await env.withSecurityRulesDisabled(async (c) => { serverEntry = (await getDoc(doc(c.firestore(), "workforce_attendance", `w2_${day}`))).data(); });
  const serverTime = new Intl.DateTimeFormat("en-GB", {timeZone:"America/Managua", hour:"2-digit", minute:"2-digit", hour12:false}).format(serverEntry.checkInServerAt.toDate());
  await secondCard.getByText(serverTime,{exact:true}).first().waitFor();
  assert.ok(await secondCard.getByRole("button",{name:"Entrada registrada",exact:true}).isDisabled());
  await page.clock.setFixedTime(new Date(`${day}T16:45:00-06:00`));
  await secondCard.getByRole("button",{name:"Registrar salida ahora",exact:true}).click();
  await secondCard.getByRole("button",{name:"Salida registrada",exact:true}).waitFor();
  await page.getByRole("button",{name:"Manual",exact:true}).click();
  await secondCard.getByLabel("Entrada manual",{exact:true}).fill("08:00");
  await secondCard.getByLabel("Salida manual",{exact:true}).fill("17:00");
  await secondCard.getByRole("button",{name:"Guardar horas",exact:true}).click();
  await secondCard.getByText("9 h 0 min",{exact:false}).waitFor();
  const thirdCard = page.locator("article").filter({has:page.getByRole("heading",{name:"Persona 3 Sintética",exact:true})});
  await thirdCard.getByRole("button", {name:"Ausente",exact:true}).click();
  await thirdCard.getByText("Ausencia injustificada",{exact:true}).waitFor();
  await thirdCard.getByRole("button", {name:"Presente",exact:true}).click();
  await thirdCard.getByText("Presente",{exact:true}).waitFor();
  await personCard.locator("summary").filter({hasText:"Más opciones"}).click();
  await personCard
    .getByRole("button", { name: "Detalles y correcciones", exact: true })
    .click();
  const attendanceDialog = page.getByRole("dialog", {
    name: "Registrar asistencia",
    exact: true,
  });
  await attendanceDialog
    .getByLabel("Hora de entrada", { exact: true })
    .fill("07:00");
  await attendanceDialog
    .getByLabel("Hora de salida", { exact: true })
    .fill("16:00");
  await attendanceDialog
    .getByLabel("Minutos de descanso", { exact: true })
    .fill("60");
  await attendanceDialog
    .getByRole("button", { name: "Guardar asistencia", exact: true })
    .click();
  await attendanceDialog.waitFor({ state: "hidden" });
  await personCard.getByText("8 h 0 min", { exact: false }).waitFor();
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
  const download = await downloadWait;
  const csvStream = await download.createReadStream();let csv='';for await (const chunk of csvStream) csv+=chunk.toString();
  assert.match(csv,/"480"/);assert.match(csv,/"Salida"/);
  await personCard.getByRole("button", { name: "Ver revisiones" }).click();
  await page
    .getByRole("dialog", { name: "Revisiones de asistencia" })
    .getByText("Revisión 1", { exact: false })
    .waitFor();
  await page
    .getByRole("dialog", { name: "Revisiones de asistencia" })
    .getByRole("button", { name: "Cerrar ventana" })
    .click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole('heading',{name:'Asistencia',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({
    path: "../../audit-reports/attendance-mobile.png",
    fullPage: true,
  });
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
    assert.equal(history.size, 6);
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: real Firebase adapter on isolated emulators, create/assign/start/close/accept/history, USD, dark mode, mobile without horizontal overflow, worker role and no duplicate task.",
  );
} finally {
  await browser.close();
  await env.cleanup();
}
