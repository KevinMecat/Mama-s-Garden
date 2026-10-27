"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createProject, ProjectApiError, updateProject } from "@/lib/project-api";
import type { Project, ProjectStatus, ProjectType } from "@/types/project";

export function ProjectForm({ project }: { project?: Project }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState(project?.start_date ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const input = {
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        type: String(form.get("type")) as ProjectType,
        status: String(form.get("status")) as ProjectStatus,
        start_date: startDate || null,
        end_date: String(form.get("end_date") ?? "") || null,
      };
      if (project) await updateProject(project.id, input);
      else await createProject(input);
      router.replace(project ? `/dashboard/projects/detail?id=${project.id}` : "/dashboard/projects");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof ProjectApiError
          ? requestError.message
          : "No se pudo conectar con el servidor. Intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-primary outline-none transition placeholder:text-brand-muted/60 focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/25";
  const labelClass = "text-sm font-semibold text-brand-primary";

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div>
        <label htmlFor="name" className={labelClass}>Nombre del proyecto</label>
        <input id="name" name="name" required minLength={3} maxLength={160} defaultValue={project?.name} placeholder="Ej. Lote Avícola - 1,000 aves" className={inputClass} />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Descripción</label>
        <textarea id="description" name="description" rows={4} defaultValue={project?.description} placeholder="Objetivo y alcance de esta iniciativa" className={`${inputClass} py-3`} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className={labelClass}>Tipo</label>
          <select id="type" name="type" defaultValue={project?.type ?? "produccion_avicola"} required className={inputClass}>
            <option value="produccion_avicola">Producción avícola</option>
            <option value="cultivo_citricos">Cultivo de cítricos</option>
            <option value="infraestructura">Infraestructura</option>
            <option value="administracion">Administración</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Estado inicial</label>
          <select id="status" name="status" defaultValue={project?.status ?? "active"} required className={inputClass}>
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="completed">Finalizado</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="start_date" className={labelClass}>Fecha de inicio</label>
          <input id="start_date" name="start_date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="end_date" className={labelClass}>Fecha de finalización</label>
          <input id="end_date" name="end_date" type="date" min={startDate || undefined} defaultValue={project?.end_date ?? ""} className={inputClass} />
        </div>
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-6 sm:flex-row sm:justify-end">
        <Link href={project ? `/dashboard/projects/detail?id=${project.id}` : "/dashboard/projects"} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-bold text-brand-primary transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
          Cancelar
        </Link>
        <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary px-6 text-sm font-bold text-white transition hover:bg-brand-secondary disabled:cursor-wait disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
          {isSubmitting ? "Guardando…" : project ? "Guardar cambios" : "Crear proyecto"}
        </button>
      </div>
    </form>
  );
}
