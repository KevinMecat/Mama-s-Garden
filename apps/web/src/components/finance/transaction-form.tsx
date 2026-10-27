"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createFinancialTransaction, FinanceApiError } from "@/lib/finance-api";
import type { UserRole } from "@/types/auth";
import type { FinancialCategory } from "@/types/finance";
import type { Project } from "@/types/project";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface TransactionFormProps {
  projects: Project[];
  categories: FinancialCategory[];
  role: UserRole;
  today: string;
}

export function TransactionForm({ projects, categories, role, today }: TransactionFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const receipt = formData.get("receipt");
    if (receipt instanceof File) {
      if (receipt.size === 0) {
        formData.delete("receipt");
      } else if (receipt.size > MAX_FILE_SIZE) {
        setError("La fotografía no puede superar 10 MB.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createFinancialTransaction(formData);
      router.replace("/dashboard/finance?created=1");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof FinanceApiError
          ? requestError.message
          : "No se pudo conectar con el servidor. Intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-ink outline-none transition placeholder:text-brand-muted/60 focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  const labelClass = "text-sm font-semibold text-brand-ink";
  const canSubmit = projects.length > 0 && categories.length > 0;

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="project" className={labelClass}>Proyecto activo</label>
          <select id="project" name="project" required disabled={!projects.length} className={inputClass}>
            <option value="">Selecciona un proyecto</option>
            {projects.map((project) => <option key={project.code} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="type" className={labelClass}>Tipo de movimiento</label>
          <select id="type" name="type" defaultValue="EXPENSE" required className={inputClass}>
            <option value="EXPENSE">Gasto operativo</option>
            <option value="INVESTMENT">Inversión</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className={labelClass}>Monto (USD)</label>
          <input id="amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="transaction_date" className={labelClass}>Fecha</label>
          <input id="transaction_date" name="transaction_date" type="date" defaultValue={today} required className={inputClass} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>Categoría</label>
          <select id="category" name="category" required disabled={!categories.length} className={inputClass}>
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        {role === "ADMIN" ? (
          <div>
            <label htmlFor="status" className={labelClass}>Estado</label>
            <select id="status" name="status" defaultValue="DRAFT" required className={inputClass}>
              <option value="DRAFT">Borrador</option>
              <option value="POSTED">Contabilizado</option>
            </select>
          </div>
        ) : (
          <div className="rounded-xl border border-brand-border bg-brand-cream/45 px-4 py-3 text-sm leading-6 text-brand-muted sm:self-end">
            El movimiento se guardará como <strong className="text-brand-ink">Borrador</strong> hasta que un administrador lo contabilice.
            <input type="hidden" name="status" value="DRAFT" />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Descripción</label>
        <textarea id="description" name="description" rows={3} placeholder="Ej. Compra de concentrado para lote de 1,000 aves" className={`${inputClass} py-3`} />
      </div>

      <div>
        <label htmlFor="supplier_or_customer" className={labelClass}>Proveedor</label>
        <input id="supplier_or_customer" name="supplier_or_customer" maxLength={160} placeholder="Nombre del proveedor (opcional)" className={inputClass} />
      </div>

      <div className="rounded-[1.25rem] border border-dashed border-brand-border bg-brand-paper p-5">
        <label htmlFor="receipt" className={labelClass}>Foto del comprobante <span className="font-normal text-brand-muted">(opcional)</span></label>
        <p className="mt-1 text-sm leading-6 text-brand-muted">Toma una foto o selecciona una imagen JPEG, PNG o WebP de hasta 10 MB.</p>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          className="mt-4 block w-full text-sm text-brand-muted file:mr-4 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-primary file:px-4 file:font-semibold file:text-white hover:file:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        />
        {fileName ? <p className="mt-3 text-sm font-semibold text-brand-ink">Archivo seleccionado: {fileName}</p> : null}
      </div>

      {!canSubmit ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Necesitas al menos un proyecto activo asignado y una categoría activa antes de registrar movimientos.
        </p>
      ) : null}

      {error ? <p role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-end">
        <Link href="/dashboard/finance" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-ink transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">Cancelar</Link>
        <button type="submit" disabled={isSubmitting || !canSubmit} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
          {isSubmitting ? "Guardando…" : "Registrar movimiento"}
        </button>
      </div>
    </form>
  );
}
