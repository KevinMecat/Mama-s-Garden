"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { CategoryApiError, createCategory, deleteCategory, updateCategory } from "@/lib/category-api";
import type { FinancialCategory } from "@/types/finance";

export function CategoryForm({ category }: { category?: FinancialCategory }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const input = { name: String(form.get("name") ?? "").trim(), description: String(form.get("description") ?? "").trim(), is_active: form.get("is_active") === "on" };
      if (category) await updateCategory(category.id, input); else await createCategory(input);
      router.replace("/dashboard/finance/categories"); router.refresh();
    } catch (reason) { setError(reason instanceof CategoryApiError ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!category || !window.confirm("¿Eliminar esta categoría?")) return; setBusy(true); setError("");
    try { await deleteCategory(category.id); router.replace("/dashboard/finance/categories"); router.refresh(); }
    catch (reason) { setError(reason instanceof CategoryApiError ? reason.message : "No se pudo eliminar."); setBusy(false); }
  }
  const input = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-brand-ink outline-none focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  return <form onSubmit={submit} className="mt-8 space-y-6"><div><label htmlFor="name" className="text-sm font-semibold text-brand-ink">Nombre</label><input id="name" name="name" required maxLength={100} defaultValue={category?.name} className={input} /></div><div><label htmlFor="description" className="text-sm font-semibold text-brand-ink">Descripción</label><textarea id="description" name="description" rows={3} defaultValue={category?.description} className={`${input} py-3`} /></div><label className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-border bg-brand-cream/40 px-4 text-sm font-semibold text-brand-ink"><input name="is_active" type="checkbox" defaultChecked={category?.is_active ?? true} className="size-5 accent-brand-primary" />Categoría activa</label>{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}<div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-between"><div>{category ? <button type="button" onClick={remove} disabled={busy} className="min-h-12 rounded-xl border border-red-200 px-5 text-sm font-semibold text-red-700">Eliminar</button> : null}</div><div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href="/dashboard/finance/categories" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-ink">Cancelar</Link><button disabled={busy} className="min-h-12 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar categoría"}</button></div></div></form>;
}
