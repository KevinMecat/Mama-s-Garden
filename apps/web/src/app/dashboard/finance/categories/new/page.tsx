import { CategoryForm } from "@/components/finance/category-form";
import { requireAdministrator } from "@/lib/server-api";

export const metadata = { title: "Nueva categoría" };
export default async function NewCategoryPage() { await requireAdministrator(); return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Nueva categoría</h1><CategoryForm /></div></div>; }
