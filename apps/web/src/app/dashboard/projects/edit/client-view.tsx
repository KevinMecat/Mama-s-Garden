"use client";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import { ProjectForm } from "@/components/projects/project-form";
import { getProject, requireAdministrator } from "@/lib/page-api";

async function loadPage({ params }: ClientPageProps) { await requireAdministrator(); const { id } = await params; const project = await getProject(id); return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-sans text-3xl font-semibold text-brand-ink">Editar proyecto</h1><ProjectForm project={project} /></div></div>; }
export default function ClientView(){return <ClientPage load={loadPage}/>;}
