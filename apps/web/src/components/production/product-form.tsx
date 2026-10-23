"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  createProduct,
  deleteProduct,
  ProductionApiError,
  updateProduct,
} from "@/lib/production-api";
import type { Product } from "@/types/production";

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const input = {
        name: String(form.get("name") ?? "").trim(),
        unit_of_measure: String(form.get("unit_of_measure") ?? "").trim(),
        is_active: form.get("is_active") === "on",
      };
      if (product) await updateProduct(product.id, input);
      else await createProduct(input);
      router.replace("/dashboard/products");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof ProductionApiError ? reason.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!product || !window.confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteProduct(product.id);
      router.replace("/dashboard/products");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof ProductionApiError ? reason.message : "No se pudo eliminar.");
      setBusy(false);
    }
  }

  const input = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-primary outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  return <form onSubmit={submit} className="mt-8 space-y-6">
    <div><label htmlFor="name" className="text-sm font-semibold text-brand-primary">Nombre</label><input id="name" name="name" required maxLength={120} defaultValue={product?.name} placeholder="Ej. Huevos, pollo en pie, limón" className={input} /></div>
    <div><label htmlFor="unit_of_measure" className="text-sm font-semibold text-brand-primary">Unidad de medida</label><input id="unit_of_measure" name="unit_of_measure" required maxLength={50} defaultValue={product?.unit_of_measure} placeholder="Ej. libras, unidades, quintales" className={input} /></div>
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-border bg-brand-cream/40 px-4 text-sm font-semibold text-brand-primary"><input name="is_active" type="checkbox" defaultChecked={product?.is_active ?? true} className="size-5 accent-brand-primary" />Producto activo y disponible para operaciones</label>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-between">
      <div>{product ? <button type="button" onClick={remove} disabled={busy} className="min-h-12 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button> : null}</div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href="/dashboard/products" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-bold text-brand-primary">Cancelar</Link><button disabled={busy} className="min-h-12 rounded-xl bg-brand-primary px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}</button></div>
    </div>
  </form>;
}
