import { ProductionRecordForm } from "@/components/production/production-record-form";
import { getServerProducts, getServerProjects, requireUser } from "@/lib/server-api";

export const metadata = { title: "Registrar producción" };
export default async function NewProductionPage() {
  await requireUser(); const [projects, products] = await Promise.all([getServerProjects("active"), getServerProducts(true)]);
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Registrar producción</h1><ProductionRecordForm projects={projects} products={products} today={new Date().toISOString().slice(0, 10)} /></div></div>;
}
