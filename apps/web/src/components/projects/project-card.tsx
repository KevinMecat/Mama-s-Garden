import Link from "next/link";

import type { Project } from "@/types/project";

const typeAccent: Record<Project["type"], string> = {
  produccion_avicola: "bg-amber-500",
  cultivo_citricos: "bg-lime-600",
  infraestructura: "bg-stone-500",
  administracion: "bg-brand-secondary",
};

function formatDate(value: string | null) {
  if (!value) return "Sin definir";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="relative overflow-hidden rounded-[1.5rem] border border-brand-border bg-brand-surface p-6 shadow-[0_15px_40px_rgba(72,73,39,0.07)]">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${typeAccent[project.type]}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-secondary">{project.type_label}</p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-brand-primary">{project.name}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-brand-cream px-3 py-1 text-xs font-bold text-brand-primary">
          {project.status_label}
        </span>
      </div>

      <p className="mt-4 min-h-14 line-clamp-2 leading-7 text-brand-muted">
        {project.description || "Sin descripción registrada."}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-brand-border/70 pt-5 text-sm">
        <div>
          <dt className="text-brand-muted">Inicio</dt>
          <dd className="mt-1 font-semibold text-brand-primary">{formatDate(project.start_date)}</dd>
        </div>
        <div>
          <dt className="text-brand-muted">Equipo asignado</dt>
          <dd className="mt-1 font-semibold text-brand-primary">{project.member_count} personas</dd>
        </div>
      </dl>
      <Link href={`/dashboard/projects/detail?id=${project.id}`} className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-brand-secondary underline-offset-4 hover:underline">
        Ver métricas y gestionar
      </Link>
    </article>
  );
}
