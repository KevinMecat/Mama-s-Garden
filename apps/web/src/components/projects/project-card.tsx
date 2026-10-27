import Link from "next/link";
import type { DragEvent } from "react";

import type { Project, ProjectStatus } from "@/types/project";

const typeAccent: Record<Project["type"], string> = {
  produccion_avicola: "bg-amber-500",
  cultivo_citricos: "bg-emerald-500",
  infraestructura: "bg-stone-500",
  administracion: "bg-brand-secondary",
};

function formatDate(value: string | null) {
  if (!value) return "Sin definir";
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ProjectCard({
  project,
  onMove,
  onDragStart,
  busy = false,
}: {
  project: Project;
  onMove?: (status: ProjectStatus) => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  busy?: boolean;
}) {
  return (
    <article
      draggable={Boolean(onMove) && !busy}
      onDragStart={onDragStart}
      className="relative overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${typeAccent[project.type]}`}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-secondary">
            {project.type_label}
          </p>
          <h2 className="mt-2 font-sans text-lg font-semibold leading-tight text-brand-ink">
            {project.name}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
          {project.status_label}
        </span>
      </div>

      <p className="mt-4 min-h-14 line-clamp-2 leading-7 text-brand-muted">
        {project.description || "Sin descripción registrada."}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-brand-border/70 pt-5 text-sm">
        <div>
          <dt className="text-brand-muted">Inicio</dt>
          <dd className="mt-1 font-semibold text-brand-ink">
            {formatDate(project.start_date)}
          </dd>
        </div>
        <div>
          <dt className="text-brand-muted">Equipo asignado</dt>
          <dd className="mt-1 font-semibold text-brand-ink">
            {project.member_count} personas
          </dd>
        </div>
      </dl>
      <Link
        href={`/dashboard/projects/detail?id=${project.id}`}
        className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-brand-secondary underline-offset-4 hover:underline"
      >
        Ver métricas y gestionar
      </Link>
      {onMove && (
        <label className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
          <span className="sr-only">Estado de {project.name}</span>
          <span aria-hidden="true">Mover a</span>
          <select
            aria-label={`Estado de ${project.name}`}
            value={project.status}
            disabled={busy}
            onChange={(event) => onMove(event.target.value as ProjectStatus)}
            className="min-h-9 max-w-[65%] rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-700"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="completed">Finalizado</option>
          </select>
        </label>
      )}
    </article>
  );
}
