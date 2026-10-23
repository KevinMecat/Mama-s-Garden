"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createProductionRecord, deleteProductionRecord, ProductionApiError, updateProductionRecord } from "@/lib/production-api";
import type { Product, ProductionRecord } from "@/types/production";
import type { Project } from "@/types/project";

export function ProductionRecordForm({ projects, products, record, today }: { projects: Project[]; products: Product[]; record?: ProductionRecord; today: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = projects.length > 0 && products.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const input = { project: Number(form.get("project")), product: Number(form.get("product")), production_date: String(form.get("production_date")), quantity: String(form.get("quantity")), notes: String(form.get("notes") ?? "").trim() };
      if (record) await updateProductionRecord(record.id, input); else await createProductionRecord(input);
      router.replace("/dashboard/production"); router.refresh();
    } catch (reason) { setError(reason instanceof ProductionApiError ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!record || !window.confirm("¿Eliminar este registro de producción?")) return;
    setBusy(true); setError("");
    try { await deleteProductionRecord(record.id); router.replace("/dashboard/production"); router.refresh(); }
    catch (reason) { setError(reason instanceof ProductionApiError ? reason.message : "No se pudo eliminar."); setBusy(false); }
  }

  const input = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-primary outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  return <form onSubmit={submit} className="mt-8 space-y-6">
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="project" className="text-sm font-semibold text-brand-primary">Proyecto activo</label><select id="project" name="project" required defaultValue={record?.project ?? ""} className={input}><option value="">Selecciona</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="product" className="text-sm font-semibold text-brand-primary">Producto activo</label><select id="product" name="product" required defaultValue={record?.product ?? ""} className={input}><option value="">Selecciona</option>{products.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit_of_measure})</option>)}</select></div></div>
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="production_date" className="text-sm font-semibold text-brand-primary">Fecha</label><input id="production_date" name="production_date" type="date" required defaultValue={record?.production_date ?? today} className={input} /></div><div><label htmlFor="quantity" className="text-sm font-semibold text-brand-primary">Cantidad</label><input id="quantity" name="quantity" type="number" inputMode="decimal" min="0.001" step="0.001" required defaultValue={record?.quantity} placeholder="0.000" className={input} /></div></div>
    <div><label htmlFor="notes" className="text-sm font-semibold text-brand-primary">Notas</label><textarea id="notes" name="notes" rows={4} defaultValue={record?.notes} className={`${input} py-3`} /></div>
    {!ready ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Crea primero un proyecto activo y un producto activo.</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-between"><div>{record ? <button type="button" onClick={remove} disabled={busy} className="min-h-12 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700">Eliminar</button> : null}</div><div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href="/dashboard/production" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-bold text-brand-primary">Cancelar</Link><button disabled={busy || !ready} className="min-h-12 rounded-xl bg-brand-primary px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : record ? "Guardar cambios" : "Registrar producción"}</button></div></div>
  </form>;
}
