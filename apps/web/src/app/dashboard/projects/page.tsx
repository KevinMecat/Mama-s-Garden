import Link from "next/link";

import { ProjectCard } from "@/components/projects/project-card";
import { getServerProjects, requireUser } from "@/lib/server-api";

export const metadata = {
  title: "Proyectos",
};

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await getServerProjects();
  const activeProjects = projects.filter((project) => project.status === "active");
  const inactiveProjects = projects.filter((project) => project.status !== "active");

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Centros de costos</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-brand-primary sm:text-5xl">Proyectos</h1>
          <p className="mt-4 text-lg leading-8 text-brand-muted">
            Cada iniciativa mantiene sus recursos, responsables y resultados separados del resto de la finca.
          </p>
        </div>
        {user.role === "ADMIN" ? (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(72,73,39,0.16)] transition hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-fit"
          >
            Nuevo proyecto
          </Link>
        ) : null}
      </header>

      <section className="mt-10" aria-labelledby="active-projects-title">
        <div className="flex items-center justify-between gap-4">
          <h2 id="active-projects-title" className="font-display text-2xl font-semibold text-brand-primary">Proyectos activos</h2>
          <p className="text-sm font-semibold text-brand-muted">{activeProjects.length} en operación</p>
        </div>

        {activeProjects.length ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {activeProjects.map((project) => <ProjectCard key={project.code} project={project} />)}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-brand-border bg-brand-surface px-6 py-12 text-center">
            <p className="font-display text-2xl font-semibold text-brand-primary">Aún no hay proyectos activos</p>
            <p className="mt-2 text-brand-muted">Activa o crea un proyecto para comenzar a separar sus costos.</p>
          </div>
        )}
      </section>

      {inactiveProjects.length ? (
        <section className="mt-12" aria-labelledby="other-projects-title">
          <h2 id="other-projects-title" className="font-display text-2xl font-semibold text-brand-primary">Borradores y finalizados</h2>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {inactiveProjects.map((project) => <ProjectCard key={project.code} project={project} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
