import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const base = process.argv[2];
if (!base) throw new Error("Pass the Hosting origin or static preview URL.");
const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {}) });
try {
  const page = await browser.newPage(); const errors = [], mutations = [], authRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /Content Security Policy|Refused to|Hydration|Minified React/.test(message.text())) errors.push(message.text()); });
  page.on("request", request => {
    if (/firestore.googleapis.com/.test(request.url()) && /Commit|Write|documents:commit/.test(request.url())) mutations.push(request.method());
    if (/identitytoolkit.googleapis.com.*signInWithPassword/.test(request.url())) authRequests.push(new URL(request.url()).hostname);
  });
  if (base.startsWith("http://127.0.0.1")) {
    const config = await (await fetch("https://surco-finca.web.app/__/firebase/init.json")).json();
    await page.route("**/__/firebase/init.json", route => route.fulfill({ json: config }));
  }
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo electrónico").waitFor();
  assert.equal(await page.getByRole("button", { name: "Ingresar", exact: true }).isEnabled(), true);
  assert.equal(await page.getByText("Modo Demostración / Offline", { exact: false }).count(), 0);
  await page.goto(`${base}/dashboard/employees`);
  await page.waitForURL("**/login");
  // These are deliberately public, obsolete mock credentials, never a real account password.
  await page.getByLabel("Correo electrónico").fill("demo@mamasgarden.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("demo1234");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "No fue posible acceder" }).waitFor();
  assert.ok(new URL(page.url()).pathname === "/login", "Demo credentials must never unlock real data");
  assert.equal(authRequests.length, 1, "Login must use real Firebase Authentication");
  assert.equal(await page.locator("header").count() > 0, true);
  assert.deepEqual(mutations, []);
  assert.deepEqual(errors, []);
  const config = await (await fetch(`${base.startsWith("https:") ? base : "https://surco-finca.web.app"}/__/firebase/init.json`)).json();
  assert.equal(config.projectId, "surco-finca");
  const denied = await fetch(`https://firestore.googleapis.com/v1/projects/surco-finca/databases/(default)/documents/workers?pageSize=1&key=${encodeURIComponent(config.apiKey)}`);
  assert.ok([401, 403].includes(denied.status), "Personnel data must remain private");
  console.log(`PASS ${base}: redesigned login, Firebase config, protected routes, genuine Auth requests, mock credentials rejected, anonymous Firestore denied, no writes/runtime/CSP errors.`);
} finally { await browser.close(); }
