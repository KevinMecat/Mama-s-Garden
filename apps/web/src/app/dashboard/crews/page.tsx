"use client";
import Link from "next/link";
import { Users, ArrowUpRight } from "lucide-react";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import { requireUser } from "@/lib/page-api";
import { workforce, type TaskPage } from "@/lib/workforce-api";
async function loadPage({ searchParams }: ClientPageProps) {
  await requireUser();
  const query = await searchParams;
  const page = /^[1-9][0-9]*$/.test(query.page || "") ? Number(query.page) : 1;
  const data = await workforce<TaskPage>(`?page=${page}`);
  const tasks = data.results.filter((task) => task.crew);
  return (
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-8">
      <p className="eyebrow">Operaciones / Equipos</p>
      <h1 className="page-title mt-2">Cuadrillas</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Equipos asignados a tareas compartidas. Los resultados pertenecen a toda
        la cuadrilla.
      </p>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <article key={task.id} className="surface-card p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Users size={20} />
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                {task.assignees.length} integrantes
              </span>
            </div>
            <h2 className="mt-4 text-base font-semibold">{task.title}</h2>
            <p className="mt-1 text-xs text-neutral-500">{task.project_name}</p>
            <ul className="my-4 space-y-2">
              {task.assignees.map((person) => (
                <li key={person.id} className="flex items-center gap-2 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">
                    {person.name.slice(0, 1)}
                  </span>
                  {person.name}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/workforce"
              className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"
            >
              Gestionar en el tablero
              <ArrowUpRight size={14} />
            </Link>
          </article>
        ))}
      </div>
      {!tasks.length && (
        <p className="surface-card mt-6 p-8 text-sm text-neutral-500">
          No hay tareas de cuadrilla en esta página. Revisa otras páginas o
          asigna varios integrantes a una tarea.
        </p>
      )}
      <nav
        aria-label="Páginas de tareas compartidas"
        className="mt-6 flex items-center gap-4 text-sm"
      >
        {data.previous && (
          <Link
            className="text-emerald-700 underline"
            href={`?page=${page - 1}`}
          >
            Anterior
          </Link>
        )}
        <span className="text-neutral-500">Página {page}</span>
        {data.next && (
          <Link
            className="text-emerald-700 underline"
            href={`?page=${page + 1}`}
          >
            Siguiente
          </Link>
        )}
      </nav>
    </section>
  );
}
export default function Page() {
  return <ClientPage load={loadPage} />;
}
