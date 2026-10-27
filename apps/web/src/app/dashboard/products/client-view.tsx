"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { getProducts, requireUser } from "@/lib/page-api";

async function loadPage() {
  const [user, products] = await Promise.all([requireUser(), getProducts()]);
  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Catálogo dinámico</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary sm:text-5xl">Productos</h1><p className="mt-4 text-lg text-brand-muted">Define tus propios productos y unidades de medida.</p></div>{user.role === "ADMIN" ? <Link href="/dashboard/products/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-bold text-white">Nuevo producto</Link> : null}</header>
    {products.length ? <div className="mt-9 overflow-hidden rounded-2xl border border-brand-border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left"><thead className="bg-brand-cream/60 text-xs uppercase tracking-wide text-brand-muted"><tr><th className="px-5 py-4">Producto</th><th className="px-5 py-4">Unidad</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acción</th></tr></thead><tbody>{products.map(product => <tr key={product.id} className="border-t border-brand-border"><td className="px-5 py-4 font-semibold text-brand-primary">{product.name}</td><td className="px-5 py-4 text-brand-muted">{product.unit_of_measure}</td><td className="px-5 py-4"><span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-bold text-brand-primary">{product.is_active ? "Activo" : "Inactivo"}</span></td><td className="px-5 py-4 text-right">{user.role === "ADMIN" ? <Link href={`/dashboard/products/edit?id=${product.id}`} className="font-bold text-brand-secondary hover:underline">Editar</Link> : null}</td></tr>)}</tbody></table></div></div> : <div className="mt-10 rounded-[1.5rem] border border-dashed border-brand-border bg-white px-6 py-14 text-center"><h2 className="font-display text-2xl font-semibold text-brand-primary">No hay productos registrados aún.</h2><p className="mt-2 text-brand-muted">Presiona “Nuevo producto” para crear el primero.</p></div>}
  </div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
