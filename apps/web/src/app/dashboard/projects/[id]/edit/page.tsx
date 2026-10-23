import { ProjectForm } from "@/components/projects/project-form";
import { getServerProject, requireAdministrator } from "@/lib/server-api";

export const metadata = { title: "Editar proyecto" };
export default async function EditProjectPage({ params }: PageProps<"/dashboard/projects/[id]/edit">) { await requireAdministrator(); const { id } = await params; const project = await getServerProject(id); return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Editar proyecto</h1><ProjectForm project={project} /></div></div>; }
