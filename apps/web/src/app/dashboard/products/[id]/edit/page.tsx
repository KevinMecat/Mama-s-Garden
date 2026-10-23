import { ProductForm } from "@/components/production/product-form";
import { getServerProduct, requireAdministrator } from "@/lib/server-api";

export const metadata = { title: "Editar producto" };
export default async function EditProductPage({ params }: PageProps<"/dashboard/products/[id]/edit">) {
  await requireAdministrator(); const { id } = await params; const product = await getServerProduct(id);
  return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Catálogo</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary">Editar producto</h1><ProductForm product={product} /></div></div>;
}
