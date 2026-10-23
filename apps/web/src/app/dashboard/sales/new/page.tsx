import { SaleForm } from "@/components/production/sale-form";
import { getServerFinancialCategories, getServerProducts, getServerProjects, requireUser } from "@/lib/server-api";

export const metadata = { title: "Registrar venta" };
export default async function NewSalePage() {
  const user = await requireUser(); const [projects, products, categories] = await Promise.all([getServerProjects("active"), getServerProducts(true), getServerFinancialCategories(true)]);
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Registrar venta</h1><p className="mt-3 text-brand-muted">El total y el ingreso financiero se calculan y guardan juntos.</p><SaleForm projects={projects} products={products} categories={categories} role={user.role} today={new Date().toISOString().slice(0, 10)} /></div></div>;
}
