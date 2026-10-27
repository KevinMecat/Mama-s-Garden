"use client";
import { PrivatePhoto } from "./private-photo";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Users,
  Building2,
  RefreshCw,
  LockKeyhole,
  FileImage,
  CalendarCheck,
  Search,
  ShieldCheck,
} from "lucide-react";
import { FirebaseAttendanceBoard } from "./firebase-attendance-board";
import { readAttendanceRevisions, mergeAttendance } from "@/lib/firebase-attendance";
import type { AuthUser } from "@/types/auth";
import { FirebaseWorkforceBoard, WorkerActions, WorkforceAccounts } from "./firebase-workforce-board";
import { workerAdjustments, applyAdjustments } from "@/lib/firebase-workforce";
import {
  allowedCollections,
  readCollection,
  readStorageUrl,
  firebaseCurrentUser,
  type CloudRow,
  type CollectionName,
} from "@/lib/firebase-client";
import {
  text,
  fullName,
  currencyTotals,
  formatMoney,
  currentSalary,
  salaryHistory,
  salaryUnits,
} from "@/lib/firebase-models";

type Data = Partial<Record<CollectionName, CloudRow[]>>;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function Receipt({ source }: { source: unknown }) {
  const [url, setUrl] = useState<string>(),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  if (!source)
    return <span className="text-xs text-neutral-400">Sin comprobante</span>;
  if (error)
    return (
      <span role="status" className="text-xs text-red-700">
        Archivo no disponible con tus permisos
      </span>
    );
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="text-xs font-semibold text-emerald-700 underline"
    >
      Abrir comprobante
    </a>
  ) : (
    <button
      type="button"
      disabled={busy}
      className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-700"
      onClick={() => {
        setBusy(true);
        void readStorageUrl(source)
          .then(setUrl)
          .catch(() => setError(true))
          .finally(() => setBusy(false));
      }}
    >
      <FileImage size={14} />
      {busy ? "Consultando…" : "Ver comprobante"}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-card mt-5 p-8 text-center text-sm leading-6 text-neutral-500">
      {children}
    </div>
  );
}
const titles: Record<string, string> = {
  overview: "Resumen de la finca",
  employees: "Personal de la finca",
  attendance: "Asistencia",
  finance: "Finanzas",
  payroll: "Salarios y nómina",
  projects: "Unidades de negocio",
  crews: "Equipos por área",
  workforce: "Trabajo de hoy / Kanban",
  users: "Usuarios y permisos",
  "finance-summary": "Resumen financiero",
  units: "Unidades de negocio",
  settings: "Mi cuenta",
  products: "Productos",
  production: "Producción",
  sales: "Ingresos registrados",
};
function FirebaseWorkspaceContent({ user }: { user: AuthUser }) {
  const pathname = usePathname(),
    params = useSearchParams();
  const section = pathname.split("/")[2] || "overview";
  const [data, setData] = useState<Data>(),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState("");
  const [search, setSearch] = useState(""),
    [month, setMonth] = useState(""),
    [transactionType, setTransactionType] = useState(""),
    [unit, setUnit] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await firebaseCurrentUser();
      if (!current || current.id !== user.id)
        throw new Error("Sesión no disponible.");
      const names = allowedCollections(current.role);
      const [values, patches, attendanceUpdates] = await Promise.all([Promise.all(
        names.map(
          async (name) => [name, await readCollection(name, current)] as const,
        ),
      ), workerAdjustments(current), readAttendanceRevisions(current)]);
      const result = Object.fromEntries(values);
      if (result.attendance) result.attendance = mergeAttendance(result.attendance, attendanceUpdates);
      if (result.workers) result.workers = applyAdjustments(result.workers, patches);
      if (active) {
        setData(result);
        window.dispatchEvent(new CustomEvent("finca:worker-count", { detail: (result.workers ?? []).filter(row => row.status === "active").length }));
        setError(false);
        setLoading(false);
        setLoaded(
          new Date().toLocaleTimeString("es-NI", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    })().catch(() => {
      if (active) {
        setData(undefined);
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [user.id, revision]);
  const workers = data?.workers ?? [],
    salaries = data?.salaries ?? [],
    units = data?.microbusinesses ?? [],
    attendance = data?.attendance ?? [],
    transactions = data?.transactions ?? [];
  const findUnit = (id: unknown) => units.find((item) => item.id === id);
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const match = (value: string) =>
    normalized(value).includes(normalized(search));
  const input =
    "min-h-10 min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700";
  const rowsPerPage = 30;
  function pager(count: number) {
    return (
      <nav
        aria-label="Paginación de registros"
        className="mt-5 flex items-center gap-4 text-xs text-neutral-500"
      >
        <button
          type="button"
          className="min-h-10 rounded-lg border border-neutral-200 bg-white px-3 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>
        <span>
          {count} registros · página {page} de{" "}
          {Math.max(1, Math.ceil(count / rowsPerPage))}
        </span>
        <button
          type="button"
          className="min-h-10 rounded-lg border border-neutral-200 bg-white px-3 disabled:opacity-40"
          disabled={page * rowsPerPage >= count}
          onClick={() => setPage((value) => value + 1)}
        >
          Siguiente
        </button>
      </nav>
    );
  }
  function renderWorkers() {
    if (!data?.workers)
      return (
        <Empty>
          Tu perfil no tiene permiso para consultar información del personal.
        </Empty>
      );
    const selected =
      params.get("worker") ||
      (pathname.includes("/edit") ? params.get("id") : null);
    const filtered = workers.filter(
      (worker) =>
        (!selected || worker.id === selected) &&
        match(`${fullName(worker)} ${text(worker.area)}`),
    );
    return (
      <>
        <div className="mt-6 flex items-center gap-2">
          <Search size={16} className="text-neutral-400" />
          <input
            aria-label="Buscar personal"
            placeholder="Buscar por nombre o área..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className={`${input} w-full max-w-md`}
          />
          <span className="ml-auto text-xs text-neutral-500">
            {filtered.length} personas
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered
            .slice((page - 1) * rowsPerPage, page * rowsPerPage)
            .map((worker) => {
              const salary = currentSalary(
                salaries.find((item) => item.workerId === worker.id),
                today(),
              );
              return (
                <article key={worker.id} className="surface-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <PrivatePhoto
                      source={worker.photoUrl}
                      name={fullName(worker)}
                      large
                    />
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold ${worker.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}
                    >
                      {worker.status === "active" ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-neutral-900">
                    {fullName(worker)}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {text(worker.area) || "Área sin registrar"}
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 text-xs">
                    <div>
                      <dt className="text-neutral-500">Edad</dt>
                      <dd className="mt-1 font-medium">
                        {typeof worker.age === "number" ? `${worker.age} años` : "Sin registrar"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Salario semanal</dt>
                      <dd className="mt-1 font-semibold text-emerald-800">
                        {salary ? (
                          <>
                            {formatMoney(salary.amountCents, salary.currency)}
                            <span className="block text-[11px] font-normal text-neutral-500">
                              por {salaryUnits[salary.type] || salary.type} ·
                              desde {salary.from}
                            </span>
                          </>
                        ) : data?.salaries ? (
                          "Sin tarifa vigente"
                        ) : (
                          "Restringido"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs text-neutral-500">Perfil: {text(worker.profile) || text(worker.area) || "Sin registrar"}</p>
                  <WorkerActions user={user} worker={worker} changed={() => setRevision(value => value + 1)}/>
                  <details className="mt-4 border-t border-neutral-100 pt-3 text-xs">
                    <summary className="min-h-8 font-semibold text-emerald-700">
                      Ver historial salarial y períodos
                    </summary>
                    {salaryHistory(
                      salaries.find((item) => item.workerId === worker.id),
                    ).map((entry, index) => (
                      <p key={index} className="mt-2 text-neutral-600">
                        {entry.from}:{" "}
                        {formatMoney(entry.amountCents, entry.currency)} /{" "}
                        {salaryUnits[entry.type] || entry.type}
                      </p>
                    ))}
                    {Array.isArray(worker.periods) &&
                      worker.periods.map((entry, index) => {
                        const period = entry as { from?: string; to?: string };
                        return (
                          <p key={index} className="mt-2 text-neutral-500">
                            Período: {period.from || "Sin inicio"} —{" "}
                            {period.to || "Abierto"}
                          </p>
                        );
                      })}
                  </details>
                </article>
              );
            })}
        </div>
        {!filtered.length && (
          <Empty>No hay personal que coincida con este filtro.</Empty>
        )}
        {pager(filtered.length)}
      </>
    );
  }
  function renderFinance() {
    if (!data?.transactions)
      return <Empty>Tu perfil no tiene acceso a finanzas.</Empty>;
    const filtered = transactions
      .filter(
        (row) =>
          (!month || text(row.date).startsWith(month)) &&
          (!transactionType || row.type === transactionType) &&
          (!unit ||
            (unit === "general"
              ? !row.microbusiness_id
              : row.microbusiness_id === unit)) &&
          match(`${text(row.category)} ${text(row.description)}`) &&
          (section !== "sales" || row.type === "income"),
      )
      .sort((a, b) => text(b.date).localeCompare(text(a.date)));
    const totals = currencyTotals(filtered);
    return (
      <>
        <div className="mt-6 flex flex-wrap gap-3">
          <label className="text-xs text-neutral-500">
            Mes
            <input
              aria-label="Mes de finanzas"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(1);
              }}
              className={`${input} ml-2`}
            />
          </label>
          <select
            aria-label="Tipo de movimiento"
            value={transactionType}
            onChange={(event) => {
              setTransactionType(event.target.value);
              setPage(1);
            }}
            className={input}
          >
            <option value="">Todos los movimientos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
            <option value="investment">Inversiones</option>
          </select>
          <select
            aria-label="Unidad de negocio"
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              setPage(1);
            }}
            className={input}
          >
            <option value="">Todas las unidades</option>
            <option value="general">General · sin unidad</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                {text(item.name)}
              </option>
            ))}
          </select>
          <input
            aria-label="Buscar finanzas"
            placeholder="Categoría o descripción"
            className={input}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {Object.entries(totals).map(([currency, total]) => (
            <article key={currency} className="surface-card p-4">
              <p className="text-xs font-semibold text-neutral-500">
                {currency} · {total.count} movimientos
              </p>
              <div className="mt-3 flex flex-wrap gap-6 text-xs">
                <div>
                  <span className="text-neutral-500">Ingresos</span>
                  <p className="mt-1 font-semibold text-emerald-700">
                    {formatMoney(total.income, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-500">Gastos</span>
                  <p className="mt-1 font-semibold text-orange-700">
                    {formatMoney(total.expense, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-500">Inversiones</span>
                  <p className="mt-1 font-semibold text-violet-700">
                    {formatMoney(total.investment, currency)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="surface-card mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
              <tr>
                {[
                  "Fecha",
                  "Categoría / descripción",
                  "Unidad",
                  "Tipo",
                  "Importe original",
                  "Comprobante",
                ].map((title) => (
                  <th
                    key={title}
                    className="whitespace-nowrap px-4 py-3 font-medium"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered
                .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                .map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/60">
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-neutral-500">
                      {text(row.date)}
                    </td>
                    <td className="max-w-sm px-4 py-4">
                      <p className="font-medium">{text(row.category)}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {text(row.description)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs text-neutral-500">
                      {row.microbusiness_id
                        ? text(findUnit(row.microbusiness_id)?.name) ||
                          "Unidad no disponible"
                        : "General · sin unidad"}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {{
                        income: "Ingreso",
                        expense: "Gasto",
                        investment: "Inversión",
                      }[text(row.type)] || text(row.type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums">
                      {formatMoney(row.amountCents, row.currency)}
                    </td>
                    <td className="px-4 py-4">
                      <Receipt source={row.receiptPath || row.receiptUrl} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty>No hay movimientos para estos filtros.</Empty>
        )}
        {pager(filtered.length)}
      </>
    );
  }
  function renderUnits() {
    if (!data?.microbusinesses)
      return (
        <Empty>Tu perfil no tiene acceso a las unidades de negocio.</Empty>
      );
    const filtered = units.filter(
      (row) =>
        (!params.get("id") || row.id === params.get("id")) &&
        match(text(row.name)),
    );
    return (
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((row) => (
          <article key={row.id} className="surface-card p-5">
            <div className="flex items-start justify-between">
              <PrivatePhoto
                source={row.avatarPath || row.avatarUrl}
                name={text(row.name)}
                large
              />
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                {row.status === "active" ? "Activa" : "Inactiva"}
              </span>
            </div>
            <h2 className="mt-4 text-base font-semibold">{text(row.name)}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {text(row.description)}
            </p>
            <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
              {Object.entries(
                currencyTotals(
                  transactions.filter(
                    (item) => item.microbusiness_id === row.id,
                  ),
                ),
              ).map(([currency, total]) => (
                <p key={currency} className="text-xs text-neutral-600">
                  {currency}: ingresos{" "}
                  <strong>{formatMoney(total.income, currency)}</strong> ·
                  gastos <strong>{formatMoney(total.expense, currency)}</strong>{" "}
                  · inversión{" "}
                  <strong>{formatMoney(total.investment, currency)}</strong>
                </p>
              ))}
              <p className="text-xs text-neutral-400">
                Solo movimientos vinculados expresamente a esta unidad.
              </p>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <Empty>No hay unidades que coincidan con esta consulta.</Empty>
        )}
      </div>
    );
  }
  function renderOverview() {
    const totals = currencyTotals(transactions);
    return (
      <>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Personal registrado",
              value: data?.workers ? String(workers.length) : "Restringido",
              icon: Users,
            },
            {
              title: "Personal activo",
              value: data?.workers
                ? String(
                    workers.filter((row) => row.status === "active").length,
                  )
                : "Restringido",
              icon: Users,
            },
            {
              title: "Asistencias registradas",
              value: String(attendance.length),
              icon: CalendarCheck,
            },
            {
              title: "Unidades de negocio",
              value: data?.microbusinesses
                ? String(units.length)
                : "Restringido",
              icon: Building2,
            },
          ].map(({ title, value, icon: Icon }) => (
            <article key={title} className="kpi-card">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500">{title}</p>
                <Icon size={18} className="text-emerald-700" />
              </div>
              <p className="mt-4 font-sans text-3xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              <p className="mt-3 text-[11px] text-neutral-500">
                Colección real de Firestore
              </p>
            </article>
          ))}
        </div>
        {data?.transactions && (
          <section className="mt-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                Finanzas · todo el historial
              </h2>
              <Link
                href="/dashboard/finance"
                className="text-xs font-semibold text-emerald-700"
              >
                Consultar movimientos →
              </Link>
            </div>
            {Object.entries(totals).map(([currency, total]) => (
              <div
                key={currency}
                className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {[
                  {
                    title: `Ingresos · ${currency}`,
                    value: total.income,
                    icon: ArrowDownLeft,
                    color: "text-emerald-700",
                  },
                  {
                    title: `Gastos · ${currency}`,
                    value: total.expense,
                    icon: ArrowUpRight,
                    color: "text-orange-700",
                  },
                  {
                    title: `Inversiones · ${currency}`,
                    value: total.investment,
                    icon: Wallet,
                    color: "text-violet-700",
                  },
                  {
                    title: `Flujo neto · ${currency}`,
                    value: total.income - total.expense - total.investment,
                    icon: Wallet,
                    color: "text-neutral-900",
                  },
                ].map(({ title, value, icon: Icon, color }) => (
                  <article key={title} className="kpi-card">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-500">{title}</p>
                      <Icon size={17} className={color} />
                    </div>
                    <p
                      className={`mt-4 font-sans text-2xl font-semibold tracking-tight tabular-nums ${color}`}
                    >
                      {value < 0
                        ? `−${formatMoney(-value, currency)}`
                        : formatMoney(value, currency)}
                    </p>
                    <p className="mt-3 text-[11px] text-neutral-500">
                      Importes originales · sin conversión
                    </p>
                  </article>
                ))}
              </div>
            ))}
          </section>
        )}
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            {
              href: "/dashboard/employees",
              title: "Personal y fotos",
              body: "Perfiles, áreas y salarios con su periodicidad original.",
            },
            {
              href: "/dashboard/attendance",
              title: "Asistencia",
              body: "Consulta las fechas, llegadas y notas registradas.",
            },
            {
              href: "/dashboard/projects",
              title: "Unidades",
              body: "Unidades reales y sus movimientos vinculados.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="surface-card p-5 transition hover:shadow-md"
            >
              <h2 className="text-sm font-semibold text-emerald-800">
                {item.title}
              </h2>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                {item.body}
              </p>
            </Link>
          ))}
        </div>
      </>
    );
  }
  let content: React.ReactNode;
  if (section === "employees") content = renderWorkers();
  else if (section === "workforce") content = <FirebaseWorkforceBoard user={user} workers={workers} units={units} attendance={attendance} create={params.get("create") === "1"} historyWorker={params.get("worker") || ""}/>;
  else if (section === "users") content = <WorkforceAccounts user={user} workers={workers}/>;
  else if (section === "attendance")
    content = <FirebaseAttendanceBoard user={user} workers={workers} rows={attendance} payrolls={data?.payrolls ?? []} changed={async () => { const updates = await readAttendanceRevisions(user); setData(previous => ({ ...previous, attendance: mergeAttendance(previous?.attendance ?? [], updates) })); }}/>;
  else if (["finance", "sales", "finance-summary"].includes(section)) content = renderFinance();
  else if (["projects", "units"].includes(section)) content = renderUnits();
  else if (section === "payroll")
    content = (
      <>
        {renderWorkers()}
        <div className="surface-card mt-6 p-5">
          <h2 className="text-sm font-semibold">
            Planillas y pagos registrados
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            {data?.payrolls?.length ?? 0} planillas ·{" "}
            {data?.payments?.length ?? 0} pagos. Las tarifas semanales no se
            convierten a jornadas ni se presentan como una nómina aprobada.
          </p>
        </div>
      </>
    );
  else if (section === "crews")
    content = (
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...new Set(workers.map((row) => text(row.area) || "Sin área"))].map(
          (area) => (
            <article key={area} className="surface-card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Users size={18} className="text-emerald-700" />
                {area}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Agrupación por el área registrada
              </p>
              <ul className="mt-4 space-y-3">
                {workers
                  .filter((row) => (text(row.area) || "Sin área") === area)
                  .map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <PrivatePhoto
                        source={row.photoUrl}
                        name={fullName(row)}
                      />
                      <span>{fullName(row)}</span>
                    </li>
                  ))}
              </ul>
            </article>
          ),
        )}
      </div>
    );
  else if (section === "settings")
    content = (
      <article className="surface-card mt-6 max-w-2xl p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} className="text-emerald-700" />
          Firebase Authentication
        </h2>
        <p className="mt-4 text-sm">{user.first_name}</p>
        <p className="mt-1 text-sm text-neutral-500">
          {user.email} · {user.role_label}
        </p>
        <p className="mt-5 border-t border-neutral-100 pt-4 text-xs leading-6 text-neutral-500">
          Proyecto: surco-finca. El perfil y sus permisos se verifican en
          Firestore. Las tareas y revisiones operativas tienen historial propio.
          Las fichas originales, salarios y asistencia se conservan. No se persisten colecciones en localStorage.
        </p>
      </article>
    );
  else if (["products", "production"].includes(section))
    content = (
      <Empty>
        No hay una colección operativa de{" "}
        {section === "products" ? "productos" : "producción"} en el origen
        inspeccionado. No se muestran ejemplos ni se infieren inventarios a
        partir de los movimientos financieros.
      </Empty>
    );
  else content = renderOverview();
  return (
    <section className="mx-auto max-w-[100rem] px-4 py-6 sm:px-7 lg:px-8">
      <p className="eyebrow">Finca principal / Datos operativos</p>
      <header className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            {titles[section] || "Datos de la finca"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Troilo, León · Nicaragua
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">
            <LockKeyhole size={12} />
            Datos de la finca
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError(false);
              setData(undefined);
              setRevision((value) => value + 1);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw size={14} />
            {loading ? "Consultando…" : "Actualizar"}
          </button>
        </div>
      </header>
      {loaded && !error && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Última consulta al servidor: {loaded}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-8 text-sm text-neutral-500">
          Consultando tus colecciones autorizadas…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="surface-card mt-6 border-red-200 p-6 text-sm text-red-800"
        >
          No fue posible leer los datos con esta sesión. Verifica tu conexión y
          los permisos del perfil. Actualiza o vuelve a iniciar sesión.
        </div>
      ) : (
        content
      )}
    </section>
  );
}

export function FirebaseWorkspace({ user }: { user: AuthUser }) {
  const pathname = usePathname(), query = useSearchParams();
  return <FirebaseWorkspaceContent key={`${pathname}?${query.toString()}`} user={user}/>;
}
