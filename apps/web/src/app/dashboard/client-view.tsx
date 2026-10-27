"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Wallet,
  CalendarDays,
  Plus,
  FolderKanban,
  ListTodo,
  CircleDot,
  TrendingUp,
} from "lucide-react";
import {
  CashFlowChart,
  CostDistributionChart,
} from "@/components/reports/dashboard-charts";
import { getDashboardReport, requireUser } from "@/lib/page-api";
const money = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "USD",
});
const monthName = new Intl.DateTimeFormat("es-NI", {
  month: "long",
  year: "numeric",
});
function formatMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return monthName.format(new Date(year, number - 1, 1));
}
async function loadPage() {
  const [user, report] = await Promise.all([
    requireUser(),
    getDashboardReport(),
  ]);
  const pending = report.kpis.pending_payroll;
  const income = Number(report.kpis.month_income),
    expenses = Number(report.kpis.month_expenses),
    balance = income - expenses;
  const metrics = [
    {
      title: "Ingresos del mes",
      value: money.format(income),
      detail: "Movimientos contabilizados",
      tag: "Ingresos",
      icon: ArrowDownLeft,
      color: "text-emerald-700 bg-emerald-50",
      line: "bg-emerald-500",
    },
    {
      title: "Gastos del mes",
      value: money.format(expenses),
      detail: "Incluye nómina pagada",
      tag: "Egresos",
      icon: ArrowUpRight,
      color: "text-orange-700 bg-orange-50",
      line: "bg-orange-400",
    },
    {
      title: "Balance del mes",
      value: money.format(balance),
      detail: "Ingresos menos gastos",
      tag: balance < 0 ? "Saldo negativo" : "Resultado positivo",
      icon: TrendingUp,
      color:
        balance < 0 ? "text-red-700 bg-red-50" : "text-teal-700 bg-teal-50",
      line: balance < 0 ? "bg-red-400" : "bg-teal-500",
    },
    {
      title: "Nómina pendiente",
      value: pending ? money.format(Number(pending.amount)) : "Restringido",
      detail: pending?.missing_rate_entries
        ? `${pending.missing_rate_entries} tarifas por revisar`
        : "Asistencia y planillas pendientes",
      tag: "Por pagar",
      icon: Wallet,
      color: "text-violet-700 bg-violet-50",
      line: "bg-violet-400",
    },
  ];
  return (
    <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-7 lg:px-8">
      <div className="mb-6 flex items-center gap-2 text-xs text-neutral-500">
        <span>Finca principal</span>
        <span>/</span>
        <span className="font-medium text-neutral-800">Resumen</span>
      </div>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Resumen de la finca</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Hola, {user.first_name.trim() || "equipo"}. Así va tu espacio de
            trabajo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium capitalize text-neutral-600">
            <CalendarDays size={15} />
            {formatMonth(report.period.current_month)}
          </span>
          {user.role === "ADMIN" && (
            <Link
              href="/dashboard/finance/new"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              <Plus size={16} />
              Registrar movimiento
            </Link>
          )}
        </div>
      </header>
      <nav
        aria-label="Vista del resumen"
        className="mt-7 flex gap-6 border-b border-neutral-200 text-sm"
      >
        <span
          className="border-b-2 border-emerald-600 pb-3 font-semibold text-emerald-800"
          aria-current="page"
        >
          Vista general
        </span>
        <Link
          href="/dashboard/workforce"
          className="pb-3 text-neutral-500 hover:text-emerald-700"
        >
          Trabajo de hoy
        </Link>
        <Link
          href="/dashboard/projects"
          className="pb-3 text-neutral-500 hover:text-emerald-700"
        >
          Proyectos
        </Link>
      </nav>
      <section
        aria-label="Indicadores del mes"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(
          ({ title, value, detail, tag, icon: Icon, color, line }) => (
            <article key={title} className="kpi-card">
              <div className={`absolute inset-x-0 top-0 h-0.5 ${line}`} />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-neutral-500">{title}</p>
                <span
                  className={`grid size-8 place-items-center rounded-lg ${color}`}
                >
                  <Icon size={17} />
                </span>
              </div>
              <p className="mt-4 font-sans text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                {value}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold ${color}`}
                >
                  {tag}
                </span>
                <span className="text-[11px] text-neutral-500">{detail}</span>
              </div>
            </article>
          ),
        )}
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <article className="surface-card min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                Flujo de caja
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Ingresos y gastos operativos contabilizados
              </p>
            </div>
            <span className="rounded-md bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-500">
              {report.period.cash_flow_months === 1
                ? "Este mes"
                : `Últimos ${report.period.cash_flow_months} meses`}
            </span>
          </div>
          <div className="mt-6">
            <CashFlowChart data={report.cash_flow} />
          </div>
        </article>
        <article className="surface-card min-w-0 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-neutral-900">
            Distribución de costos
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Gastos agrupados por categoría
          </p>
          <div className="mt-6">
            <CostDistributionChart data={report.cost_distribution} />
          </div>
        </article>
      </section>
      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Proyectos en marcha
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Ventas y costos de tus proyectos activos
            </p>
          </div>
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Ver proyectos
            <ArrowRight size={14} />
          </Link>
        </div>
        {!report.active_profitability.length ? (
          <div className="surface-card p-8 text-center text-sm text-neutral-500">
            No hay proyectos activos para comparar.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.active_profitability.map((project) => (
              <Link
                key={project.project}
                href={`/dashboard/projects/detail?id=${project.project}`}
                className="surface-card group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    <CircleDot size={10} />
                    En marcha
                  </span>
                  <ArrowUpRight
                    size={16}
                    className="text-neutral-400 group-hover:text-emerald-700"
                  />
                </div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <FolderKanban
                    size={17}
                    className="shrink-0 text-emerald-700"
                  />
                  {project.project_name}
                </h3>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-neutral-500">Ventas</dt>
                    <dd className="mt-1 font-sans text-base font-semibold tracking-tight tabular-nums">
                      {money.format(Number(project.confirmed_sales))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Costos</dt>
                    <dd className="mt-1 font-sans text-base font-semibold tracking-tight tabular-nums">
                      {money.format(Number(project.operating_cost))}
                    </dd>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border-t border-neutral-100 pt-3">
                    <dt className="text-neutral-500">Resultado operativo</dt>
                    <dd
                      className={`font-sans text-base font-semibold tracking-tight tabular-nums ${Number(project.operating_result) < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {money.format(Number(project.operating_result))}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>
      <Link
        href="/dashboard/workforce"
        className="mt-6 flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 transition hover:bg-emerald-50"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
          <ListTodo size={20} />
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-950">
            Del plan al trabajo de hoy
          </p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Organiza tareas, revisa avances y acompaña a tu equipo.
          </p>
        </div>
        <ArrowRight size={18} className="ml-auto shrink-0 text-emerald-700" />
      </Link>
    </div>
  );
}
export default function ClientView() {
  return <ClientPage load={loadPage} />;
}
