import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, worker = false) {
  await page.goto("/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(worker ? "qa-worker@isolated.example" : "qa-admin@isolated.example");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-workforce");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/dashboard/workforce");
  await page.getByLabel("Fecha", { exact: true }).fill("2026-10-27");
  await expect(
    page.getByText("Cargando tareas…", { exact: true }),
  ).toBeHidden();
}

test("complete day, review, mobile layout and connected history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.getByRole("button", { name: "Nueva tarea", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Jornada E2E aislada");
  await dialog.getByLabel("Actividad", { exact: true }).fill("Riego");
  await dialog.getByLabel("Ubicación o sector").fill("Sector QA");
  await dialog.getByLabel("Fecha prevista").fill("2026-10-27");
  await dialog.getByLabel("Persona QA", { exact: true }).check();
  await dialog.getByLabel("Criterio de aceptación").fill("Sin fugas");
  await dialog
    .getByRole("button", { name: "Guardar tarea", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Jornada E2E aislada",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Iniciar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await card
    .getByRole("button", { name: "Registrar resultado", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Fecha real de trabajo").fill("2026-10-27");
  await dialog
    .getByLabel("Resultado realizado")
    .fill("Sin fugas, inspeccionado");
  await dialog.getByLabel("Se cumplió el criterio de aceptación").check();
  await dialog.getByLabel("Persona QA", { exact: true }).fill("45");
  await dialog.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(dialog).toBeHidden();
  await card.getByRole("button", { name: "Aceptar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Observaciones de revisión")
    .fill("Funcionamiento correcto");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await card.getByRole("button", { name: "Ver historial" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Aceptado: Funcionamiento correcto/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Finalizado \(/ }).click();
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page
    .getByRole("link", { name: "Cierre de jornada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cierre de jornada", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Historial por trabajador", exact: true })
    .click();
  await page
    .getByLabel("Persona", { exact: true })
    .selectOption({ label: "Persona QA" });
  await expect(card).toBeVisible();
  expect(errors).toEqual([]);
});

test("server conflict keeps card state, drag, duplication, connection retry and empty state", async ({
  page,
}) => {
  await login(page);
  // APIRequestContext on page shares this browser session; never points at production.
  const api = page.context().request;
  const root = "http://127.0.0.1:8218/api/v1/";
  async function post(route: string, data: Record<string, unknown>) {
    const csrf = await (await api.get(root + "auth/csrf/")).json();
    const response = await api.post(root + "workforce/tasks/" + route, {
      data: { key: crypto.randomUUID(), ...data },
      headers: { "X-CSRFToken": csrf.csrfToken },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }
  const options = await (
    await api.get(root + "workforce/tasks/options_data/")
  ).json();
  const task = await post("", {
    title: "Conflicto E2E aislado",
    activity: "Riego",
    project: options.projects[0].id,
    location: "QA",
    scheduled_date: "2026-10-27",
    acceptance_criteria: "Sin fugas",
    assignees: [options.employees[0].id],
  });
  await page.reload();
  // Reload resets the date filter to today; restore the fixture date before
  // looking for the task so the test works on every calendar day.
  await page.getByLabel("Fecha", { exact: true }).fill("2026-10-27");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: task.title, exact: true }),
  });
  await expect(
    card.getByRole("button", { name: "Iniciar", exact: true }),
  ).toBeEnabled();
  await post(`${task.id}/command/`, {
    action: "block",
    revision: task.revision,
    reason: "Incidencia simultánea",
  });
  await card.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(
    page.getByText("La tarea cambió. Recarga antes de intentarlo de nuevo.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Por hacer", exact: true })
      .getByRole("heading", { name: task.title }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Recargar estado y reintentar" })
    .click();
  await expect(
    card.getByText("Bloqueada: Incidencia simultánea", { exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Quitar bloqueo" }).click();
  await expect(
    card.getByRole("button", { name: "Iniciar", exact: true }),
  ).toBeEnabled();
  await card.dragTo(
    page.getByRole("region", { name: "En curso", exact: true }),
  );
  await expect(
    card.getByRole("button", { name: "Registrar resultado", exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Duplicar", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Nueva fecha").fill("2026-10-28");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const copies = await (
    await api.get(root + "workforce/tasks/?date=2026-10-28")
  ).json();
  const copy = copies.results.find(
    (item: { title: string }) => item.title === task.title,
  );
  expect(copy.state).toBe("TODO");
  expect(copy.work_logs).toEqual([]);
  await page.route(
    (url) => url.pathname === "/api/v1/workforce/tasks/",
    (route) => route.abort("failed"),
  );
  await page.getByLabel("Fecha", { exact: true }).fill("2026-10-29");
  await expect(
    page.getByRole("button", { name: "Recargar estado y reintentar" }),
  ).toBeVisible();
  await page.unrouteAll();
  await page
    .getByRole("button", { name: "Recargar estado y reintentar" })
    .click();
  await expect(
    page.getByText(/No hay tareas para estos filtros/),
  ).toBeVisible();
});

test("worker sees own tasks and cannot plan or review", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, true);
  await expect(
    page.getByRole("button", { name: "Nueva tarea", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Aceptar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Vincular empleado con su cuenta", { exact: true }),
  ).toHaveCount(0);
});
