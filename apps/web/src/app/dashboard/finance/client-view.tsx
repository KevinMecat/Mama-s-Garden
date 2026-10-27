"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { TransactionList } from "@/components/finance/transaction-list";
import {
  getFinancialTransactions,
  getProjects,
  requireUser,
} from "@/lib/page-api";
import type { FinanceFilters, TransactionStatus, TransactionType } from "@/types/finance";
interface FinancePageProps {
  searchParams: Promise<{
    project?: string;
    status?: string;
    type?: string;
    created?: string;
  }>;
}
const allowedStatuses = new Set<TransactionStatus>(["DRAFT", "POSTED", "VOID"]);
const allowedTypes = new Set<TransactionType>(["INCOME", "EXPENSE", "INVESTMENT"]);

async function loadPage({ searchParams }: FinancePageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: FinanceFilters = {};
  if (params.project && /^\d+$/.test(params.project)) filters.project = params.project;
  if (allowedStatuses.has(params.status as TransactionStatus)) filters.status = params.status as TransactionStatus;
  if (allowedTypes.has(params.type as TransactionType)) filters.type = params.type as TransactionType;

  const [transactions, projects] = await Promise.all([
    getFinancialTransactions(filters),
    getProjects(),
  ]);

  const draftCount = transactions.filter((item) => item.status === "DRAFT").length;
  const postedCount = transactions.filter((item) => item.status === "POSTED").length;
  const receiptCount = transactions.filter((item) => item.attachments.length > 0).length;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Control financiero</p>
          <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight text-brand-ink sm:text-4xl">Finanzas</h1>
          <p className="mt-4 text-lg leading-8 text-brand-muted">Consulta gastos e inversiones sin perder la relación con su centro de costos.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {user.role === "ADMIN" ? <Link href="/dashboard/finance/categories" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-ink transition hover:bg-brand-cream">Categorías</Link> : null}
          <Link href="/dashboard/finance/new" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(72,73,39,0.16)] transition hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-fit">
            Registrar movimiento
          </Link>
        </div>
      </header>

      {params.created === "1" ? (
        <p role="status" className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Movimiento registrado correctamente.</p>
      ) : null}

      <section aria-label="Resumen de movimientos visibles" className="mt-8 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          ["Borradores", draftCount],
          ["Contabilizados", postedCount],
          ["Con factura", receiptCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5">
            <p className="text-xs font-semibold text-brand-muted sm:text-sm">{label}</p>
            <p className="mt-2 font-sans text-3xl font-semibold text-brand-ink">{value}</p>
          </div>
        ))}
      </section>

      <form method="get" className="mt-8 grid gap-4 rounded-xl border border-brand-border bg-brand-surface p-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="filter-project" className="text-sm font-semibold text-brand-ink">Proyecto</label>
          <select id="filter-project" name="project" defaultValue={filters.project ?? ""} className="mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25">
            <option value="">Todos los proyectos</option>
            {projects.map((project) => <option key={project.code} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="filter-status" className="text-sm font-semibold text-brand-ink">Estado</label>
          <select id="filter-status" name="status" defaultValue={filters.status ?? ""} className="mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25">
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="POSTED">Contabilizado</option>
            <option value="VOID">Anulado</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-type" className="text-sm font-semibold text-brand-ink">Tipo</label>
          <select id="filter-type" name="type" defaultValue={filters.type ?? ""} className="mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25">
            <option value="">Todos</option>
            <option value="EXPENSE">Gasto operativo</option>
            <option value="INVESTMENT">Inversión</option>
            <option value="INCOME">Ingreso</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">Filtrar</button>
          <Link href="/dashboard/finance" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-ink transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">Limpiar</Link>
        </div>
      </form>

      <section className="mt-8" aria-labelledby="transactions-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="transactions-title" className="font-sans text-2xl font-semibold text-brand-ink">Movimientos recientes</h2>
          <p className="text-sm font-semibold text-brand-muted">{transactions.length} resultados</p>
        </div>
        <TransactionList transactions={transactions} />
      </section>
    </div>
  );
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
