import { ProductionRecordForm } from "@/components/production/production-record-form";
import { getServerProductionRecord, getServerProducts, getServerProjects, requireUser } from "@/lib/server-api";

export const metadata = { title: "Editar producción" };
export default async function EditProductionPage({ params }: PageProps<"/dashboard/production/[id]/edit">) {
  await requireUser(); const { id } = await params; const [record, projects, products] = await Promise.all([getServerProductionRecord(id), getServerProjects(), getServerProducts()]);
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Editar producción</h1><ProductionRecordForm record={record} projects={projects} products={products} today={record.production_date} /></div></div>;
}
