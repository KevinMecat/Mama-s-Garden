"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { getSales, requireUser } from "@/lib/page-api";
const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

async function loadPage() {
  await requireUser(); const sales = await getSales();
  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Ingresos vinculados</p><h1 className="mt-3 font-sans text-3xl font-semibold text-brand-ink sm:text-4xl">Ventas</h1><p className="mt-4 text-lg text-brand-muted">Cada venta mantiene sincronizado su ingreso financiero.</p></div><Link href="/dashboard/sales/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white">Registrar venta</Link></header>
  {sales.length ? <div className="mt-9 grid gap-4">{sales.map(sale => <article key={sale.id} className="rounded-2xl border border-brand-border bg-white p-5 sm:flex sm:items-center sm:justify-between"><div><p className="font-sans text-xl font-semibold text-brand-ink">{sale.product_name}</p><p className="mt-1 text-sm text-brand-muted">{sale.project_name} · {sale.customer || "Sin cliente"} · {sale.status_label}</p></div><div className="mt-4 flex items-center justify-between gap-5 sm:mt-0"><p className="font-semibold text-brand-ink">{money.format(Number(sale.total_amount))}</p><Link href={`/dashboard/sales/edit?id=${sale.id}`} className="font-semibold text-brand-secondary hover:underline">Editar</Link></div></article>)}</div> : <div className="mt-10 rounded-xl border border-dashed border-brand-border bg-white px-6 py-14 text-center"><h2 className="font-sans text-2xl font-semibold text-brand-ink">No hay ventas registradas aún.</h2><p className="mt-2 text-brand-muted">Registra la primera venta cuando exista una operación real.</p></div>}</div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
