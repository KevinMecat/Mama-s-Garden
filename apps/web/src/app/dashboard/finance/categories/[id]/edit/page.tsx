import { CategoryForm } from "@/components/finance/category-form";
import { getServerFinancialCategories, requireAdministrator } from "@/lib/server-api";

export const metadata = { title: "Editar categoría" };
export default async function EditCategoryPage({ params }: PageProps<"/dashboard/finance/categories/[id]/edit">) { await requireAdministrator(); const { id } = await params; const categories = await getServerFinancialCategories(); const category = categories.find(item => item.id === Number(id)); if (!category) throw new Error("Categoría no encontrada."); return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Editar categoría</h1><CategoryForm category={category} /></div></div>; }
