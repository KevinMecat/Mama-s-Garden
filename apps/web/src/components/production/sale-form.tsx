"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { createSale, deleteSale, ProductionApiError, updateSale } from "@/lib/production-api";
import type { UserRole } from "@/types/auth";
import type { FinancialCategory } from "@/types/finance";
import type { Product, Sale } from "@/types/production";
import type { Project } from "@/types/project";

export function SaleForm({ projects, products, categories, sale, role, today }: { projects: Project[]; products: Product[]; categories: FinancialCategory[]; sale?: Sale; role: UserRole; today: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(sale?.quantity ?? "");
  const [price, setPrice] = useState(sale?.unit_price ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => {
    const value = Number(quantity) * Number(price);
    return Number.isFinite(value) ? new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value) : "Q0.00";
  }, [quantity, price]);
  const ready = projects.length > 0 && products.length > 0 && categories.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const input = { project: Number(form.get("project")), product: Number(form.get("product")), category: Number(form.get("category")), sale_date: String(form.get("sale_date")), quantity, unit_price: price, customer: String(form.get("customer") ?? "").trim(), status: String(form.get("status")) as Sale["status"] };
      if (sale) await updateSale(sale.id, input); else await createSale(input);
      router.replace("/dashboard/sales"); router.refresh();
    } catch (reason) { setError(reason instanceof ProductionApiError ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!sale || !window.confirm("¿Eliminar la venta y su ingreso financiero vinculado?")) return;
    setBusy(true); setError("");
    try { await deleteSale(sale.id); router.replace("/dashboard/sales"); router.refresh(); }
    catch (reason) { setError(reason instanceof ProductionApiError ? reason.message : "No se pudo eliminar."); setBusy(false); }
  }

  const input = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-primary outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  return <form onSubmit={submit} className="mt-8 space-y-6">
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="project" className="text-sm font-semibold text-brand-primary">Proyecto activo</label><select id="project" name="project" required defaultValue={sale?.project ?? ""} className={input}><option value="">Selecciona</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="product" className="text-sm font-semibold text-brand-primary">Producto activo</label><select id="product" name="product" required defaultValue={sale?.product ?? ""} className={input}><option value="">Selecciona</option>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
    <div className="grid gap-5 sm:grid-cols-3"><div><label htmlFor="quantity" className="text-sm font-semibold text-brand-primary">Cantidad</label><input id="quantity" name="quantity" type="number" min="0.001" step="0.001" required value={quantity} onChange={event => setQuantity(event.target.value)} className={input} /></div><div><label htmlFor="unit_price" className="text-sm font-semibold text-brand-primary">Precio unitario (GTQ)</label><input id="unit_price" name="unit_price" type="number" min="0.01" step="0.01" required value={price} onChange={event => setPrice(event.target.value)} className={input} /></div><div className="rounded-xl bg-brand-cream/60 px-4 py-3"><p className="text-xs font-semibold text-brand-muted">Total calculado</p><output className="mt-1 block font-display text-2xl font-semibold text-brand-primary">{total}</output></div></div>
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="category" className="text-sm font-semibold text-brand-primary">Categoría del ingreso</label><select id="category" name="category" required defaultValue={sale?.category_id ?? ""} className={input}><option value="">Selecciona</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="sale_date" className="text-sm font-semibold text-brand-primary">Fecha</label><input id="sale_date" name="sale_date" type="date" required defaultValue={sale?.sale_date ?? today} className={input} /></div></div>
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="customer" className="text-sm font-semibold text-brand-primary">Cliente (opcional)</label><input id="customer" name="customer" maxLength={160} defaultValue={sale?.customer} className={input} /></div><div><label htmlFor="status" className="text-sm font-semibold text-brand-primary">Estado</label>{role === "ADMIN" ? <select id="status" name="status" defaultValue={sale?.status ?? "DRAFT"} className={input}><option value="DRAFT">Borrador</option><option value="POSTED">Confirmada / contabilizada</option><option value="VOID">Anulada</option></select> : <><input type="hidden" name="status" value="DRAFT" /><p className="mt-2 rounded-xl bg-brand-cream/60 px-4 py-3 text-sm text-brand-muted">Se guardará como borrador.</p></>}</div></div>
    {!ready ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Crea primero un proyecto, un producto y una categoría financiera activos.</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-between"><div>{sale ? <button type="button" onClick={remove} disabled={busy} className="min-h-12 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700">Eliminar venta</button> : null}</div><div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href="/dashboard/sales" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-bold text-brand-primary">Cancelar</Link><button disabled={busy || !ready} className="min-h-12 rounded-xl bg-brand-primary px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : sale ? "Guardar cambios" : "Registrar venta"}</button></div></div>
  </form>;
}
