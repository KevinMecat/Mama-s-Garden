"use client";
import { useRef, useState } from "react";
import { ProjectCard } from "@/components/projects/project-card";
import { updateProject } from "@/lib/project-api";
import type { Project, ProjectStatus } from "@/types/project";
const columns: { status: ProjectStatus; title: string; dot: string }[] = [
  { status: "draft", title: "Por planificar", dot: "bg-slate-400" },
  { status: "active", title: "En marcha", dot: "bg-emerald-500" },
  { status: "completed", title: "Finalizados", dot: "bg-violet-400" },
];
export function ProjectBoard({
  projects,
  administrator,
}: {
  projects: Project[];
  administrator: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const [target, setTarget] = useState<ProjectStatus>();
  async function move(id: number, status: ProjectStatus) {
    if (
      !administrator ||
      lock.current ||
      projects.find((project) => project.id === id)?.status === status
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateProject(id, { status });
      setNotice("Estado del proyecto actualizado.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo mover el proyecto. Intenta nuevamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      setTarget(undefined);
    }
  }
  return (
    <>
      <p className="mt-6 text-xs text-neutral-500">
        {administrator
          ? "Arrastra un proyecto entre columnas o usa su selector de estado."
          : "Consulta el estado y los recursos de cada proyecto."}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
        {columns.map(({ status, title, dot }) => {
          const items = projects.filter((project) => project.status === status);
          return (
            <section
              key={status}
              aria-label={title}
              onDragOver={(event) => {
                if (administrator && !busy) {
                  event.preventDefault();
                  setTarget(status);
                }
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setTarget(undefined);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const value = event.dataTransfer.getData(
                  "application/x-finca-project",
                );
                if (/^[1-9][0-9]*$/.test(value))
                  void move(Number(value), status);
              }}
              className={`min-h-64 min-w-0 rounded-xl border p-3 transition ${target === status ? "border-emerald-300 bg-emerald-50" : "border-neutral-200/70 bg-neutral-100/80"}`}
            >
              <h2 className="mb-4 flex items-center gap-2 px-1 text-xs font-semibold text-neutral-600">
                <span className={`size-2 rounded-full ${dot}`} />
                {title}
                <span className="ml-auto rounded-md bg-white px-2 py-0.5 text-xs text-neutral-500">
                  {items.length}
                </span>
              </h2>
              <div className="space-y-3">
                {items.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    busy={busy}
                    onMove={
                      administrator
                        ? (next) => void move(project.id, next)
                        : undefined
                    }
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/x-finca-project",
                        String(project.id),
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  />
                ))}
              </div>
              {!items.length && (
                <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-xs text-neutral-400">
                  Sin proyectos en esta columna
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
