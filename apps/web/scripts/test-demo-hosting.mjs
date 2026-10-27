import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Run against a static preview or the explicitly authorized public demo deployment.
const base = process.argv[2];
if (!base)
  throw new Error(
    "Usage: node scripts/test-demo-hosting.mjs https://hosting-origin",
  );
const browser = await chromium.launch({
  headless: true,
  ...(process.env.QA_BROWSER_CHANNEL
    ? { channel: process.env.QA_BROWSER_CHANNEL }
    : {}),
});
try {
  const page = await browser.newPage();
  const errors = [],
    apiCalls = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to|Hydration|Minified React/.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  const initial = await page.goto(`${base}/dashboard`);
  if (base.startsWith("https://")) {
    const headers = initial.headers();
    assert.equal(headers["x-frame-options"], "DENY");
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.ok(headers["strict-transport-security"].includes("max-age=31536000"));
    assert.ok(headers["content-security-policy"].includes("sha256-"));
    assert.ok(!headers["content-security-policy"].includes("unsafe-eval"));
  }
  await page.waitForURL("**/login");
  await page.getByLabel("Correo electrónico").fill("demo@mamasgarden.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("demo1234");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL("**/dashboard");
  const routes = [
    "",
    "/projects",
    "/projects/new",
    "/projects/detail?id=1",
    "/projects/edit?id=1",
    "/finance",
    "/finance/new",
    "/finance/categories",
    "/finance/categories/new",
    "/finance/categories/edit?id=1",
    "/products",
    "/products/new",
    "/products/edit?id=1",
    "/production",
    "/production/new",
    "/production/edit?id=1",
    "/sales",
    "/sales/new",
    "/sales/edit?id=1",
    "/employees",
    "/employees/new",
    "/employees/edit?id=1",
    "/attendance",
    "/payroll",
    "/workforce",
    "/workforce/close",
    "/workforce/history",
  ];
  for (const route of routes) {
    const response = await page.goto(`${base}/dashboard${route}`, {
      waitUntil: "networkidle",
    });
    assert.equal(response.status(), 200, route);
    await page
      .getByText("Modo Demostración / Offline", { exact: true })
      .waitFor();
    await page.locator("main h1").waitFor();
    assert.deepEqual(
      (await page.getByRole("alert").allTextContents()).filter((text) =>
        text.trim(),
      ),
      [],
      `Unexpected alert at ${route}`,
    );
    assert.ok(
      !(await page
        .getByText("No se pudo cargar la información.", { exact: false })
        .count()),
      route,
    );
  }
  await page.goto(`${base}/dashboard/projects/new`);
  await page
    .getByLabel("Nombre del proyecto")
    .fill("Proyecto de prueba del navegador");
  await page
    .getByRole("button", { name: "Crear proyecto", exact: true })
    .click();
  await page.waitForURL("**/dashboard/projects");
  await page
    .getByRole("heading", {
      name: "Proyecto de prueba del navegador",
      exact: true,
    })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", {
      name: "Proyecto de prueba del navegador",
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => localStorage.setItem("qa-unrelated", "preserved"));
  await page
    .getByRole("button", { name: "Restablecer demo", exact: true })
    .click();
  await page
    .getByText("Huerto de cítricos · Demo", { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByText("Proyecto de prueba del navegador", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("qa-unrelated")),
    "preserved",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/dashboard/workforce`);
  await page.getByText("Revisar riego del huerto", { exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile horizontal overflow",
  );
  await page
    .getByRole("button", { name: "Salir", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.goto(`${base}/dashboard`);
  await page.waitForURL("**/login");
  assert.deepEqual(apiCalls, [], "Demo must never contact an API");
  assert.deepEqual(errors, [], "Runtime / CSP errors");
  console.log(
    `PASS ${base}: login, ${routes.length} protected routes, local CRUD, reload, isolated reset, mobile, logout; zero API calls or runtime/CSP errors.`,
  );
} finally {
  await browser.close();
}
