import { SaleForm } from "@/components/production/sale-form";
import { getServerFinancialCategories, getServerProducts, getServerProjects, getServerSale, requireUser } from "@/lib/server-api";

export const metadata = { title: "Editar venta" };
export default async function EditSalePage({ params }: PageProps<"/dashboard/sales/[id]/edit">) {
  const user = await requireUser(); const { id } = await params; const [sale, projects, products, categories] = await Promise.all([getServerSale(id), getServerProjects(), getServerProducts(), getServerFinancialCategories()]);
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Editar venta</h1><SaleForm sale={sale} projects={projects} products={products} categories={categories} role={user.role} today={sale.sale_date} /></div></div>;
}
