"use client";
import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { ProjectBoard } from "@/components/projects/project-board";
import { getProjects, requireUser } from "@/lib/page-api";
async function loadPage() {
  const user = await requireUser();
  const projects = await getProjects();
  return (
    <div className="mx-auto max-w-[100rem] px-4 py-7 sm:px-7 lg:px-8">
      <p className="eyebrow">Operaciones / Centros de costos</p>
      <header className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-500">
            Organiza las iniciativas, recursos y resultados de la finca en un
            solo tablero.
          </p>
        </div>
        {user.role === "ADMIN" && (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        )}
      </header>
      <div className="mt-6 flex items-center gap-2 border-b border-neutral-200 pb-3 text-sm font-semibold text-emerald-800">
        <FolderKanban size={17} />
        Tablero de proyectos
        <span className="ml-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs">
          {projects.length}
        </span>
      </div>
      <ProjectBoard projects={projects} administrator={user.role === "ADMIN"} />
    </div>
  );
}
export default function ClientView() {
  return <ClientPage load={loadPage} />;
}
