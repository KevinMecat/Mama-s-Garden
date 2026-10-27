"use client";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import Link from "next/link";
import { ProjectDeleteButton } from "@/components/projects/project-delete-button";
import { getProject, getProjectMetrics, requireUser } from "@/lib/page-api";
const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

async function loadPage({ params }: ClientPageProps) {
  const user = await requireUser(); const { id } = await params; const [project, metrics] = await Promise.all([getProject(id), getProjectMetrics(id)]);
  const cards = [
    ["ROI operativo", `${metrics.operating_roi}%`, "Ventas confirmadas menos gastos operativos"],
    ["Costo unitario", money.format(Number(metrics.unit_cost)), "Gasto operativo dividido entre producción"],
    ["Rendimiento", `${metrics.total_produced}`, "Cantidad total producida"],
    ["Resultado operativo", money.format(Number(metrics.operating_result)), "Ventas confirmadas menos gasto operativo"],
  ];
  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><Link href="/dashboard/projects" className="text-sm font-bold text-brand-secondary hover:underline">Volver a proyectos</Link><header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">{project.type_label}</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary sm:text-5xl">{project.name}</h1><p className="mt-3 max-w-3xl text-brand-muted">{project.description || "Sin descripción registrada."}</p></div>{user.role === "ADMIN" ? <div className="flex flex-col gap-3 sm:flex-row"><Link href={`/dashboard/projects/edit?id=${project.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-bold text-white">Editar</Link><ProjectDeleteButton id={project.id} /></div> : null}</header><section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, note]) => <article key={label} className="rounded-2xl border border-brand-border bg-white p-5"><p className="text-sm font-semibold text-brand-muted">{label}</p><p className="mt-3 font-display text-3xl font-semibold text-brand-primary">{value}</p><p className="mt-2 text-xs leading-5 text-brand-muted">{note}</p></article>)}</section>{Number(metrics.total_produced) === 0 && Number(metrics.operating_expense) === 0 ? <p className="mt-6 rounded-xl border border-brand-border bg-brand-cream/50 px-4 py-3 text-sm text-brand-muted">Aún no hay actividad. Las métricas permanecerán neutrales hasta que registres datos reales.</p> : null}</div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
