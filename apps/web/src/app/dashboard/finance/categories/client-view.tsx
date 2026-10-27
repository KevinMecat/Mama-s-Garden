"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { getFinancialCategories, requireAdministrator } from "@/lib/page-api";

async function loadPage() {
  await requireAdministrator(); const categories = await getFinancialCategories();
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Finanzas</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary">Categorías</h1><p className="mt-3 text-brand-muted">Crea únicamente las clasificaciones que utiliza la finca.</p></div><Link href="/dashboard/finance/categories/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-bold text-white">Nueva categoría</Link></header>{categories.length ? <div className="mt-8 grid gap-4">{categories.map(category => <article key={category.id} className="flex items-center justify-between rounded-2xl border border-brand-border bg-white p-5"><div><h2 className="font-semibold text-brand-primary">{category.name}</h2><p className="mt-1 text-sm text-brand-muted">{category.description || "Sin descripción"} · {category.is_active ? "Activa" : "Inactiva"}</p></div><Link href={`/dashboard/finance/categories/edit?id=${category.id}`} className="font-bold text-brand-secondary hover:underline">Editar</Link></article>)}</div> : <div className="mt-10 rounded-2xl border border-dashed border-brand-border bg-white p-12 text-center"><h2 className="font-display text-2xl font-semibold text-brand-primary">No hay categorías registradas aún.</h2><p className="mt-2 text-brand-muted">Crea una antes de registrar movimientos o ventas.</p></div>}</div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
