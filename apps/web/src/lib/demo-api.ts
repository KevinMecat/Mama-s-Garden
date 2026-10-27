import type { AuthUser } from "@/types/auth";

// Public demonstration credentials, never sent to Django or persisted as passwords.
const KEY = "finca.demo.v1";
type Row = { id: number; [key: string]: unknown };
interface DemoState {
  version: 1;
  user: AuthUser | null;
  accountEmployee: number;
  tables: Record<string, Row[]>;
  operations: Record<string, { fingerprint: string; result: unknown }>;
}
const day = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const stamp = () => new Date().toISOString();
const money = (value: unknown) => Number(value ?? 0).toFixed(2);
const list = (value: unknown) => (Array.isArray(value) ? value : []) as Row[];
const adminId = "00000000-0000-4000-8000-000000000001";
const workerId = "00000000-0000-4000-8000-000000000002";
function seed(): DemoState {
  const date = day(),
    now = stamp();
  const base = { created_at: now, updated_at: now };
  return {
    version: 1,
    user: null,
    accountEmployee: 1,
    operations: {},
    tables: {
      projects: [
        {
          ...base,
          id: 1,
          code: "demo-huerto",
          name: "Huerto de cítricos · Demo",
          description: "Proyecto ficticio para explorar la aplicación.",
          type: "cultivo_citricos",
          status: "active",
          start_date: date,
          end_date: null,
          member_count: 2,
        },
        {
          ...base,
          id: 2,
          code: "demo-riego",
          name: "Sistema de riego · Demo",
          description: "Mantenimiento simulado.",
          type: "infraestructura",
          status: "active",
          start_date: date,
          end_date: null,
          member_count: 2,
        },
      ],
      "payroll/employees": [
        {
          ...base,
          id: 1,
          first_name: "Ana",
          last_name: "Demo",
          full_name: "Ana Demo",
          phone: "",
          hire_date: date,
          is_active: true,
          current_daily_rate: "150.00",
        },
        {
          ...base,
          id: 2,
          first_name: "Luis",
          last_name: "Demo",
          full_name: "Luis Demo",
          phone: "",
          hire_date: date,
          is_active: true,
          current_daily_rate: "125.00",
        },
      ],
      "payroll/salary-rates": [
        {
          ...base,
          id: 1,
          employee: 1,
          daily_rate: "150.00",
          valid_from: date,
          valid_to: null,
        },
        {
          ...base,
          id: 2,
          employee: 2,
          daily_rate: "125.00",
          valid_from: date,
          valid_to: null,
        },
      ],
      "payroll/work-entries": [
        {
          ...base,
          id: 1,
          employee: 1,
          project: 1,
          work_date: date,
          status: "PRESENT",
          day_fraction: "1.0",
          created_by: adminId,
        },
        {
          ...base,
          id: 2,
          employee: 2,
          project: 1,
          work_date: date,
          status: "PRESENT",
          day_fraction: "1.0",
          created_by: adminId,
        },
      ],
      "payroll/periods": [
        {
          ...base,
          id: 1,
          start_date: date,
          end_date: date,
          status: "DRAFT",
          category: null,
          approved_by: null,
          approved_at: null,
          paid_at: null,
        },
      ],
      "finance/categories": [
        {
          ...base,
          id: 1,
          name: "Ventas · Demo",
          description: "Datos ficticios",
          is_active: true,
        },
        {
          ...base,
          id: 2,
          name: "Insumos · Demo",
          description: "Datos ficticios",
          is_active: true,
        },
      ],
      "finance/transactions": [
        {
          ...base,
          id: 1,
          project: 1,
          category: 1,
          type: "INCOME",
          status: "POSTED",
          amount: "400.00",
          transaction_date: date,
          description: "Venta simulada",
          supplier_or_customer: "Cliente Demo",
          created_by: adminId,
          attachments: [],
        },
        {
          ...base,
          id: 2,
          project: 1,
          category: 2,
          type: "EXPENSE",
          status: "POSTED",
          amount: "80.00",
          transaction_date: date,
          description: "Insumos simulados",
          supplier_or_customer: "Proveedor Demo",
          created_by: adminId,
          attachments: [],
        },
      ],
      "production/products": [
        {
          ...base,
          id: 1,
          name: "Limón · Demo",
          unit_of_measure: "kg",
          is_active: true,
        },
        {
          ...base,
          id: 2,
          name: "Compost · Demo",
          unit_of_measure: "saco",
          is_active: true,
        },
      ],
      "production/records": [
        {
          ...base,
          id: 1,
          project: 1,
          product: 1,
          production_date: date,
          quantity: "50.00",
          notes: "Cosecha ficticia",
          created_by: adminId,
        },
      ],
      "production/sales": [
        {
          ...base,
          id: 1,
          project: 1,
          product: 1,
          category: 1,
          category_id: 1,
          sale_date: date,
          quantity: "20.00",
          unit_price: "20.00",
          total_amount: "400.00",
          customer: "Cliente Demo",
          status: "POSTED",
          transaction: 1,
          created_by: adminId,
        },
      ],
      "workforce/tasks": [
        task(1, "Revisar riego del huerto", [1], "TODO", date, base),
        task(
          2,
          "Cosecha de cítricos en cuadrilla",
          [1, 2],
          "IN_PROGRESS",
          date,
          base,
        ),
      ],
    },
  };
}
function task(
  id: number,
  title: string,
  people: number[],
  state: string,
  date: string,
  base: object,
): Row {
  return {
    ...base,
    id,
    title,
    activity: "Trabajo de campo",
    project: 1,
    location: "Sector norte · Demo",
    scheduled_date: date,
    priority: "NORMAL",
    instructions:
      "Ejemplo ficticio. Registra resultados para explorar el flujo.",
    acceptance_criteria: "Área revisada y resultado documentado",
    target_quantity: null,
    unit: "",
    estimated_minutes: 60,
    assignees: people,
    state,
    blocked_reason: "",
    cancelled_reason: "",
    cancelled_at: null,
    revision: 1,
    work_logs: [],
    events: [],
    created_by: adminId,
  };
}
function load(): DemoState {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return seed();
  try {
    const value = JSON.parse(raw) as DemoState;
    if (
      value.version === 1 &&
      value.tables?.projects &&
      value.tables["workforce/tasks"] &&
      value.operations
    ) {
      value.accountEmployee ??= 1;
      return value;
    }
  } catch {
    /* A corrupt demo namespace must never affect another application's data. */
  }
  throw new Error(
    "La demostración guardada no es válida. Reinicia los datos demo.",
  );
}
function persist(state: DemoState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
}
export function resetDemo() {
  const state = seed();
  try {
    state.user = load().user;
  } catch {
    /* Reset only the demo namespace if its saved data is corrupt. */
  }
  persist(state);
  window.dispatchEvent(new Event("finca:data-changed"));
  window.location.reload();
}
const rows = (state: DemoState, name: string) => state.tables[name];
const find = (state: DemoState, name: string, id: unknown) =>
  rows(state, name).find((row) => row.id === Number(id));
const nextId = (items: Row[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;
const labels: Record<string, string> = {
  active: "Activo",
  completed: "Finalizado",
  draft: "Borrador",
  DRAFT: "Borrador",
  POSTED: "Contabilizado",
  VOID: "Anulado",
  APPROVED: "Aprobada",
  PAID: "Pagada",
  PRESENT: "Presente",
  ABSENT: "Ausente",
  HALF_DAY: "Medio día",
  INCOME: "Ingreso",
  EXPENSE: "Gasto operativo",
  INVESTMENT: "Inversión",
  cultivo_citricos: "Cultivo de cítricos",
  infraestructura: "Infraestructura",
  produccion_avicola: "Producción avícola",
  administracion: "Administración",
};
function summary(state: DemoState, period: Row) {
  const attendance = rows(state, "payroll/work-entries").filter(
    (row) =>
      String(row.work_date) >= String(period.start_date) &&
      String(row.work_date) <= String(period.end_date),
  );
  const employees = rows(state, "payroll/employees").map((person) => {
    const days = attendance
      .filter((row) => row.employee === person.id)
      .reduce((sum, row) => sum + Number(row.day_fraction), 0);
    return {
      employee: person.id,
      employee_name: person.full_name,
      worked_days: money(days),
      total_amount: money(days * Number(person.current_daily_rate)),
    };
  });
  const total = employees.reduce(
    (sum, row) => sum + Number(row.total_amount),
    0,
  );
  return {
    employees,
    projects: [
      {
        project: 1,
        project_name: find(state, "projects", 1)?.name,
        total_amount: money(total),
      },
    ],
    grand_total: money(total),
  };
}
function decorate(state: DemoState, resource: string, row: Row): Row {
  const person = find(state, "payroll/employees", row.employee),
    product = find(state, "production/products", row.product);
  const result: Row = {
    ...row,
    project_name: find(state, "projects", row.project)?.name ?? "",
    employee_name: person?.full_name ?? "",
    product_name: product?.name ?? "",
    category_name: find(state, "finance/categories", row.category)?.name ?? "",
    unit_of_measure: product?.unit_of_measure ?? row.unit_of_measure,
    status_label: labels[String(row.status)] ?? row.status,
    type_label: labels[String(row.type)] ?? row.type,
    created_by_name: "Administrador Demo",
    approved_by_name: "Administrador Demo",
    attachments: row.attachments ?? [],
  };
  if (resource === "payroll/employees")
    result.full_name = `${row.first_name} ${row.last_name}`;
  if (resource === "payroll/periods") result.summary = summary(state, row);
  if (resource === "workforce/tasks") {
    const ids = row.assignees as number[],
      logs = list(row.work_logs);
    const accepted = logs.find((log) => (log.review as Row | null)?.accepted)
      ?.review as Row | undefined;
    const minutes = logs
      .flatMap((log) => list(log.times))
      .reduce((sum, time) => sum + Number(time.minutes), 0);
    result.assignees = ids.map((id) => ({
      id,
      name: find(state, "payroll/employees", id)?.full_name,
    }));
    result.hours = money(minutes / 60);
    result.crew = ids.length > 1;
    result.accepted_quantity = accepted?.accepted_quantity ?? null;
    result.productivity =
      ids.length === 1 && accepted?.accepted_quantity != null && minutes > 0
        ? money(Number(accepted.accepted_quantity) / (minutes / 60))
        : null;
    result.warnings = [
      "Datos simulados locales: no representan asistencia, producción ni pagos reales.",
    ];
  }
  return result;
}
function metrics(state: DemoState, project: unknown) {
  const transactions = rows(state, "finance/transactions").filter(
    (row) => row.status === "POSTED" && row.project === Number(project),
  );
  const sum = (type: string) =>
    transactions
      .filter((row) => row.type === type)
      .reduce((n, row) => n + Number(row.amount), 0);
  const cost = sum("EXPENSE"),
    income = sum("INCOME");
  const quantity = rows(state, "production/records")
    .filter((row) => row.project === Number(project))
    .reduce((n, row) => n + Number(row.quantity), 0);
  return {
    project: Number(project),
    operating_expense: money(cost),
    total_produced: money(quantity),
    confirmed_sales: money(income),
    unit_cost: money(quantity ? cost / quantity : 0),
    operating_result: money(income - cost),
    operating_roi: money(cost ? ((income - cost) / cost) * 100 : 0),
  };
}
const response = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function command(
  state: DemoState,
  row: Row,
  input: Record<string, unknown>,
): Row {
  if (Number(input.revision) !== row.revision)
    fail("La tarea cambió. Recarga el tablero.", 409);
  const action = String(input.action),
    manager = state.user?.role === "ADMIN";
  if (!manager && ["accept", "return", "cancel", "duplicate"].includes(action))
    fail("Solo el administrador demo puede revisar y planificar.", 403);
  if (action === "duplicate") {
    const copy = structuredClone(row);
    copy.id = nextId(rows(state, "workforce/tasks"));
    copy.scheduled_date = input.scheduled_date || day();
    copy.state = "TODO";
    copy.revision = 1;
    copy.work_logs = [];
    copy.events = [];
    copy.blocked_reason = "";
    copy.cancelled_at = null;
    copy.cancelled_reason = "";
    copy.created_at = stamp();
    rows(state, "workforce/tasks").push(copy);
    return copy;
  }
  if (row.cancelled_at || row.state === "DONE")
    fail("La tarea ya está cerrada.", 409);
  if (action === "block" || action === "cancel") {
    if (!String(input.reason ?? "").trim()) fail("Indica un motivo.");
    if (action === "block") row.blocked_reason = input.reason;
    else {
      row.cancelled_at = stamp();
      row.cancelled_reason = input.reason;
    }
  } else if (action === "unblock") row.blocked_reason = "";
  else {
    if (row.blocked_reason) fail("Resuelve el bloqueo primero.", 409);
    const logs = list(row.work_logs),
      latest = logs.at(-1);
    if (action === "start" && row.state === "TODO") row.state = "IN_PROGRESS";
    else if (action === "submit" && row.state === "IN_PROGRESS") {
      const times = list(input.times),
        assignees = row.assignees as number[];
      if (
        !input.result ||
        typeof input.criterion_met !== "boolean" ||
        !times.length
      )
        fail("Indica resultado, cumplimiento y tiempos.");
      if (input.work_date && String(input.work_date) > day())
        fail("La fecha real no puede ser futura.");
      if (
        times.some(
          (time) =>
            !assignees.includes(Number(time.employee)) ||
            Number(time.minutes) <= 0 ||
            (!manager && Number(time.employee) !== state.accountEmployee),
        ) ||
        new Set(times.map((time) => time.employee)).size !== times.length
      )
        fail("Tiempos de responsables no válidos.");
      if (
        row.target_quantity != null &&
        (input.quantity == null || Number(input.quantity) < 0)
      )
        fail("Indica cantidad realizada.");
      if (row.target_quantity == null && input.quantity != null)
        fail("Esta tarea se evalúa por cumplimiento.");
      logs.push({
        id: nextId(logs),
        result: input.result,
        criterion_met: input.criterion_met,
        quantity: input.quantity ?? null,
        work_date: input.work_date || day(),
        incidents: input.incidents ?? "",
        times,
        created_at: stamp(),
        review: null,
      });
      row.work_logs = logs;
      row.state = "REVIEW";
    } else if (action === "time" && row.state === "REVIEW" && latest) {
      const times = list(input.times),
        previous = list(latest.times);
      if (
        !times.length ||
        times.some(
          (time) =>
            !(row.assignees as number[]).includes(Number(time.employee)) ||
            Number(time.minutes) <= 0 ||
            previous.some((old) => old.employee === time.employee) ||
            (!manager && Number(time.employee) !== state.accountEmployee),
        )
      )
        fail("Los tiempos ya existen o no corresponden al responsable.");
      latest.times = [...previous, ...times];
    } else if (
      (action === "accept" || action === "return") &&
      row.state === "REVIEW" &&
      latest
    ) {
      if (!String(input.observations ?? "").trim())
        fail("Registra observaciones.");
      if (action === "accept") {
        if (
          !latest.criterion_met ||
          (row.assignees as number[]).some(
            (id) =>
              !list(latest.times).some((time) => Number(time.employee) === id),
          )
        )
          fail("Falta cumplimiento o tiempo de integrantes.");
        if (
          row.target_quantity != null &&
          (input.accepted_quantity == null ||
            Number(input.accepted_quantity) < 0 ||
            Number(input.accepted_quantity) > Number(latest.quantity))
        )
          fail("Cantidad aceptada no válida.");
      }
      latest.review = {
        accepted: action === "accept",
        accepted_quantity:
          action === "accept" ? (input.accepted_quantity ?? null) : null,
        observations: input.observations,
        reviewed_by: state.user?.id,
        reviewed_by_name: state.user?.first_name,
        created_at: stamp(),
      };
      row.state = action === "accept" ? "DONE" : "IN_PROGRESS";
    } else fail("Movimiento no permitido.", 409);
  }
  row.revision = Number(row.revision) + 1;
  row.updated_at = stamp();
  row.events = [
    ...list(row.events),
    {
      id: nextId(list(row.events)),
      action,
      actor: state.user?.id,
      actor_name: state.user?.first_name,
      created_at: stamp(),
      detail: { reason: input.reason || "" },
    },
  ];
  return row;
}

export async function demoFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  try {
    const state = load(),
      url = new URL(path, "https://demo.invalid"),
      method = (options.method || "GET").toUpperCase();
    const input: Record<string, unknown> =
      typeof options.body === "string"
        ? JSON.parse(options.body)
        : options.body instanceof FormData
          ? Object.fromEntries(
              [...options.body.entries()].filter(
                ([, value]) => typeof value === "string",
              ),
            )
          : {};
    if (url.pathname === "/api/v1/auth/csrf/")
      return response({ csrfToken: "demo-local-only" });
    if (url.pathname === "/api/v1/auth/login/" && method === "POST") {
      const email = String(input.email).trim().toLowerCase();
      if (
        !["demo@mamasgarden.com", "trabajador@mamasgarden.com"].includes(
          email,
        ) ||
        input.password !== "demo1234"
      )
        return response(
          {
            detail:
              "Usa demo@mamasgarden.com y demo1234 para explorar la demostración.",
          },
          400,
        );
      const worker = email.startsWith("trabajador");
      state.user = {
        id: worker ? workerId : adminId,
        email,
        first_name: worker ? "Ana Demo" : "Administrador Demo",
        last_name: "",
        role: worker ? "WORKER" : "ADMIN",
        role_label: worker ? "Trabajador Demo" : "Administrador Demo",
      };
      persist(state);
      return response({ user: state.user });
    }
    if (url.pathname === "/api/v1/auth/logout/") {
      state.user = null;
      persist(state);
      return response({}, 204);
    }
    if (!state.user)
      return response({ detail: "Inicia sesión en la demostración." }, 401);
    if (url.pathname === "/api/v1/auth/me/")
      return response({ user: state.user });
    const manager = state.user.role === "ADMIN";
    const optionsPath =
      url.pathname === "/api/v1/workforce/tasks/options_data/";
    if (optionsPath)
      return response({
        administrator: manager,
        day_minutes: 480,
        projects: rows(state, "projects").map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
        })),
        employees: rows(state, "payroll/employees")
          .filter((row) => manager || row.id === state.accountEmployee)
          .map((row) => ({
            id: row.id,
            name: `${row.first_name} ${row.last_name}`,
            active: row.is_active,
          })),
        ...(manager
          ? {
              accounts: [{ id: workerId, name: "Ana Demo" }],
              links: [
                { employee_id: state.accountEmployee, user_id: workerId },
              ],
            }
          : {}),
      });
    if (url.pathname === "/api/v1/workforce/tasks/link_account/") {
      if (!manager) fail("Sin permiso.", 403);
      if (
        input.user !== workerId ||
        !find(state, "payroll/employees", input.employee)?.is_active
      )
        fail("Vinculación demo no válida.");
      state.accountEmployee = Number(input.employee);
      persist(state);
      return response({ employee: input.employee, user: input.user });
    }
    if (
      !manager &&
      (url.pathname.includes("/finance/") ||
        url.pathname.includes("/payroll/periods") ||
        url.pathname.includes("/salary-rates"))
    )
      fail("Esta vista requiere administrador demo.", 403);
    if (url.pathname === "/api/v1/reports/dashboard/") {
      const month = day().slice(0, 7),
        all = rows(state, "finance/transactions").filter(
          (row) =>
            row.status === "POSTED" &&
            String(row.transaction_date).startsWith(month),
        );
      const sum = (type: string) =>
        all
          .filter((row) => row.type === type)
          .reduce((n, row) => n + Number(row.amount), 0);
      const income = sum("INCOME"),
        expenses = sum("EXPENSE");
      return response({
        period: { current_month: month, cash_flow_months: 1 },
        permissions: { can_view_payroll: manager },
        kpis: {
          month_income: money(income),
          month_expenses: money(expenses),
          pending_payroll: manager
            ? {
                amount: money(
                  rows(state, "payroll/periods")
                    .filter((period) => period.status !== "PAID")
                    .reduce(
                      (total, period) =>
                        total + Number(summary(state, period).grand_total),
                      0,
                    ),
                ),
                missing_rate_entries: 0,
              }
            : null,
        },
        cash_flow: [
          {
            month,
            label: "Mes demo",
            income: money(income),
            expenses: money(expenses),
          },
        ],
        active_profitability: rows(state, "projects").map((project) => {
          const value = metrics(state, project.id);
          return {
            project: project.id,
            project_name: project.name,
            operating_cost: value.operating_expense,
            confirmed_sales: value.confirmed_sales,
            operating_result: value.operating_result,
          };
        }),
        cost_distribution: rows(state, "finance/categories").map((category) => {
          const amount = all
            .filter(
              (row) =>
                row.type === "EXPENSE" && Number(row.category) === category.id,
            )
            .reduce((n, row) => n + Number(row.amount), 0);
          return {
            category: category.id,
            category_name: category.name,
            amount: money(amount),
            percentage: money(expenses ? (amount / expenses) * 100 : 0),
          };
        }),
      });
    }
    const resource = Object.keys(state.tables)
      .sort((a, b) => b.length - a.length)
      .find((name) => url.pathname.startsWith(`/api/v1/${name}/`));
    if (!resource)
      return response({ detail: "Ruta no disponible en demostración." }, 404);
    const suffix = url.pathname
        .slice(`/api/v1/${resource}/`.length)
        .split("/")
        .filter(Boolean),
      table = rows(state, resource);
    let row =
      suffix[0] && /^\d+$/.test(suffix[0])
        ? table.find((item) => item.id === Number(suffix[0]))
        : undefined;
    if (suffix[0] && /^\d+$/.test(suffix[0]) && !row)
      return response({ detail: "Registro demo no encontrado." }, 404);
    if (
      resource === "workforce/tasks" &&
      row &&
      !manager &&
      !(row.assignees as number[]).includes(state.accountEmployee)
    )
      fail("Tarea no asignada.", 404);
    if (method === "GET") {
      if (suffix[1] === "metrics") return response(metrics(state, row?.id));
      if (row) return response(decorate(state, resource, row));
      let filtered = table.filter(
        (item) =>
          manager ||
          resource !== "workforce/tasks" ||
          (item.assignees as number[]).includes(state.accountEmployee),
      );
      for (const [key, value] of url.searchParams) {
        if (
          ["page", "from", "to", "work_date"].includes(key) &&
          resource === "workforce/tasks"
        )
          continue;
        if (key === "page") continue;
        filtered = filtered.filter((item) =>
          key === "date"
            ? item.scheduled_date === value
            : key === "employee" && resource === "workforce/tasks"
              ? (item.assignees as number[]).includes(Number(value))
              : String(item[key]) === value,
        );
      }
      if (resource === "workforce/tasks") {
        const date = url.searchParams.get("work_date");
        if (date)
          filtered = filtered.filter(
            (item) =>
              item.scheduled_date === date ||
              list(item.work_logs).some((log) => log.work_date === date),
          );
        return response({
          count: filtered.length,
          next: null,
          previous: null,
          results: filtered.map((item) => decorate(state, resource, item)),
        });
      }
      return response(filtered.map((item) => decorate(state, resource, item)));
    }
    if (!manager && resource !== "workforce/tasks")
      fail("Solo el administrador demo puede modificar este módulo.", 403);
    const operationKey = input.key ? `${state.user.id}:${input.key}` : null,
      fingerprint = JSON.stringify({ path, method, input });
    if (operationKey && state.operations[operationKey]) {
      const previous = state.operations[operationKey];
      if (previous.fingerprint !== fingerprint)
        fail("Clave de reintento utilizada para otra operación.", 409);
      return response(previous.result);
    }
    if (resource === "workforce/tasks" && suffix[1] === "command" && row)
      row = command(state, row, input);
    else if (resource === "payroll/work-entries" && suffix[0] === "bulk") {
      for (const entry of list(input.entries)) {
        const old = table.find(
          (item) =>
            item.employee === entry.employee &&
            item.work_date === input.work_date,
        );
        const value = {
          ...entry,
          id: old?.id || nextId(table),
          work_date: input.work_date,
          day_fraction:
            entry.status === "ABSENT"
              ? "0.0"
              : entry.status === "HALF_DAY"
                ? "0.5"
                : "1.0",
          created_at: stamp(),
          updated_at: stamp(),
        };
        if (old) Object.assign(old, value);
        else table.push(value);
      }
    } else if (
      resource === "payroll/periods" &&
      row &&
      ["pay", "approve"].includes(suffix[1])
    ) {
      if (row.status === "PAID") fail("La planilla demo ya está pagada.", 409);
      row.status = suffix[1] === "pay" ? "PAID" : "APPROVED";
      row.approved_at = stamp();
      row.approved_by = adminId;
      row.category = input.category ?? row.category;
      if (suffix[1] === "pay") {
        row.paid_at = stamp();
        const transactions = rows(state, "finance/transactions");
        transactions.push({
          id: nextId(transactions),
          project: 1,
          category: input.category,
          type: "EXPENSE",
          status: "POSTED",
          amount: summary(state, row).grand_total,
          transaction_date: day(),
          description: "Pago simulado de planilla · Demo",
          attachments: [],
          created_at: stamp(),
          updated_at: stamp(),
        });
      }
    } else if (method === "DELETE" && row) {
      if (resource === "workforce/tasks")
        fail("El historial se conserva.", 405);
      if (
        resource === "payroll/employees" &&
        (rows(state, "workforce/tasks").some((task) =>
          (task.assignees as number[]).includes(row!.id),
        ) ||
          rows(state, "payroll/work-entries").some(
            (entry) => entry.employee === row!.id,
          ))
      )
        fail(
          "El empleado tiene historial demo; desactívalo en lugar de eliminarlo.",
          409,
        );
      if (
        ["projects", "production/products", "finance/categories"].includes(
          resource,
        )
      ) {
        const field =
          resource === "projects"
            ? "project"
            : resource === "production/products"
              ? "product"
              : "category";
        if (
          Object.entries(state.tables).some(
            ([name, items]) =>
              name !== resource &&
              items.some((item) => item[field] === row!.id),
          )
        )
          fail("El registro tiene movimientos demo asociados.", 409);
      }
      if (resource === "production/sales") {
        const income = find(state, "finance/transactions", row.transaction);
        if (income) income.status = "VOID";
      }
      table.splice(table.indexOf(row), 1);
      persist(state);
      return response({}, 204);
    } else if (method === "POST" || method === "PATCH") {
      if (!manager) fail("Solo el administrador demo puede planificar.", 403);
      if (resource === "workforce/tasks") {
        if (
          row &&
          (Number(input.revision) !== row.revision ||
            list(row.work_logs).length ||
            row.cancelled_at ||
            ["REVIEW", "DONE"].includes(String(row.state)))
        )
          fail("La planificación cambió o ya tiene resultados.", 409);
        if (
          !input.title ||
          !Array.isArray(input.assignees) ||
          !input.assignees.length ||
          !input.acceptance_criteria
        )
          fail("Completa planificación y responsables.");
        if (
          input.assignees.some(
            (id) => !find(state, "payroll/employees", id)?.is_active,
          )
        )
          fail("Responsable no válido.");
      }
      if (!row) {
        row =
          resource === "workforce/tasks"
            ? task(
                nextId(table),
                String(input.title),
                input.assignees as number[],
                "TODO",
                String(input.scheduled_date),
                { created_at: stamp() },
              )
            : {
                id: nextId(table),
                created_at: stamp(),
                is_active: true,
                attachments: [],
                status: "DRAFT",
              };
        table.push(row);
      }
      const { key: _key, revision: _revision, ...fields } = input;
      void _key;
      void _revision;
      Object.assign(row, fields, { updated_at: stamp() });
      for (const name of ["project", "product", "category", "employee"])
        if (row[name] != null && row[name] !== "")
          row[name] = Number(row[name]);
      if (resource === "projects") {
        row.code ??= `demo-project-${row.id}`;
        row.member_count ??= 0;
        row.start_date ??= null;
        row.end_date ??= null;
      }
      if (resource === "payroll/employees") {
        row.full_name = `${row.first_name} ${row.last_name}`;
        row.current_daily_rate =
          input.new_daily_rate ?? row.current_daily_rate ?? null;
        if (input.new_daily_rate) {
          const rates = rows(state, "payroll/salary-rates");
          rates.push({
            id: nextId(rates),
            employee: row.id,
            daily_rate: input.new_daily_rate,
            valid_from: input.rate_valid_from || day(),
            valid_to: null,
            created_at: stamp(),
            updated_at: stamp(),
          });
        }
      }
      if (resource === "workforce/tasks")
        row.revision = Number(row.revision) + (method === "PATCH" ? 1 : 0);
      if (resource === "production/sales") {
        row.total_amount = money(Number(row.quantity) * Number(row.unit_price));
        row.category_id = row.category;
        const transactions = rows(state, "finance/transactions");
        let income = transactions.find((item) => item.id === row?.transaction);
        if (!income) {
          income = { id: nextId(transactions) };
          transactions.push(income);
          row.transaction = income.id;
        }
        Object.assign(income, {
          project: row.project,
          category: row.category,
          type: "INCOME",
          status: row.status,
          amount: row.total_amount,
          transaction_date: row.sale_date,
          description: "Venta simulada",
          attachments: [],
          created_at: row.created_at,
        });
      }
    } else fail("Operación demo no permitida.", 405);
    const result = row
      ? decorate(state, resource, row)
      : table.map((item) => decorate(state, resource, item));
    if (operationKey) state.operations[operationKey] = { fingerprint, result };
    persist(state);
    return response(result, method === "POST" && !suffix.length ? 201 : 200);
  } catch (error) {
    return response(
      {
        detail:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la demostración local.",
      },
      Number((error as { status?: number }).status) || 400,
    );
  }
}
