"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import {
  CashFlowChart,
  CostDistributionChart,
} from "@/components/reports/dashboard-charts";
import { getDashboardReport, requireUser } from "@/lib/page-api";
const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
const monthName = new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" });
function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthName.format(new Date(year, monthNumber - 1, 1));
}

async function loadPage() {
  const [user, report] = await Promise.all([requireUser(), getDashboardReport()]);
  const displayName = user.first_name.trim() || "equipo";
  const pendingPayroll = report.kpis.pending_payroll;

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">
            Salud financiera · {formatMonth(report.period.current_month)}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-brand-primary sm:text-5xl">
            Buenos días, {displayName}.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
            Una lectura clara de los ingresos, costos y compromisos de Mama&apos;s Garden.
          </p>
        </div>
        <Link
          href="/dashboard/finance/new"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-bold text-white transition hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          Registrar movimiento
        </Link>
      </header>

      <section aria-label="Indicadores del mes" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-[1.5rem] border border-brand-border bg-brand-surface p-6 shadow-[0_12px_35px_rgba(72,73,39,0.06)]">
          <p className="text-sm font-semibold text-brand-muted">Ingresos del mes</p>
          <p className="mt-3 font-display text-3xl font-semibold text-brand-primary sm:text-4xl">
            {money.format(Number(report.kpis.month_income))}
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.13em] text-brand-secondary">
            Solo movimientos contabilizados
          </p>
        </article>

        <article className="rounded-[1.5rem] border border-brand-border bg-brand-surface p-6 shadow-[0_12px_35px_rgba(72,73,39,0.06)]">
          <p className="text-sm font-semibold text-brand-muted">Gastos del mes</p>
          <p className="mt-3 font-display text-3xl font-semibold text-[#8b5b32] sm:text-4xl">
            {money.format(Number(report.kpis.month_expenses))}
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.13em] text-brand-secondary">
            Incluye nómina ya pagada
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-brand-primary p-6 text-white shadow-[0_18px_45px_rgba(72,73,39,0.16)] sm:col-span-2 xl:col-span-1">
          <p className="text-sm font-semibold text-white/68">Nómina pendiente de pago</p>
          <p className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            {pendingPayroll ? money.format(Number(pendingPayroll.amount)) : "Acceso restringido"}
          </p>
          {pendingPayroll && pendingPayroll.missing_rate_entries > 0 ? (
            <p className="mt-3 text-sm leading-6 text-[#f0d6aa]">
              {pendingPayroll.missing_rate_entries} empleado(s) con asistencia necesitan una tarifa vigente.
            </p>
          ) : (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.13em] text-white/55">
              {pendingPayroll ? "Asistencia pendiente + planillas aprobadas" : "Visible para administradores"}
            </p>
          )}
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
        <article className="min-w-0 rounded-[1.5rem] border border-brand-border bg-brand-surface p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-secondary">
            Últimos {report.period.cash_flow_months} meses
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-brand-primary">Flujo de caja</h2>
          <p className="mt-2 text-sm leading-6 text-brand-muted">Ingresos frente a gastos operativos contabilizados.</p>
          <div className="mt-6"><CashFlowChart data={report.cash_flow} /></div>
        </article>

        <article className="min-w-0 rounded-[1.5rem] border border-brand-border bg-brand-surface p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-secondary">Acumulado</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-brand-primary">Distribución de costos</h2>
          <p className="mt-2 text-sm leading-6 text-brand-muted">Gastos operativos agrupados por categoría.</p>
          <div className="mt-6"><CostDistributionChart data={report.cost_distribution} /></div>
        </article>
      </section>

      <section className="mt-6 rounded-[1.5rem] border border-brand-border bg-brand-surface p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-secondary">Proyectos activos</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-brand-primary">Rentabilidad activa</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">Ventas confirmadas comparadas con costos operativos.</p>
          </div>
          <Link href="/dashboard/projects" className="text-sm font-bold text-brand-primary underline decoration-brand-sage underline-offset-4">
            Ver proyectos
          </Link>
        </div>

        {report.active_profitability.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-border bg-brand-cream/35 px-6 py-12 text-center">
            <p className="font-display text-xl font-semibold text-brand-primary">No hay proyectos activos para comparar</p>
            <p className="mt-2 text-sm text-brand-muted">Activa un proyecto cuando esté listo para operar.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {report.active_profitability.map((project) => {
              const result = Number(project.operating_result);
              return (
                <Link
                  key={project.project}
                  href={`/dashboard/projects/detail?id=${project.project}`}
                  className="rounded-2xl border border-brand-border bg-brand-paper p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(72,73,39,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                >
                  <h3 className="font-display text-xl font-semibold text-brand-primary">{project.project_name}</h3>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-brand-muted">Ventas</dt><dd className="mt-1 font-bold text-brand-primary">{money.format(Number(project.confirmed_sales))}</dd></div>
                    <div><dt className="text-brand-muted">Costos</dt><dd className="mt-1 font-bold text-brand-primary">{money.format(Number(project.operating_cost))}</dd></div>
                    <div className="col-span-2 border-t border-brand-border pt-4">
                      <dt className="text-brand-muted">Resultado operativo</dt>
                      <dd className={`mt-1 text-lg font-bold ${result < 0 ? "text-[#9a493b]" : "text-brand-primary"}`}>
                        {money.format(result)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
