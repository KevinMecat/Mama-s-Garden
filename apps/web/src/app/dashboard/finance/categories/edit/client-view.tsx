"use client";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import { CategoryForm } from "@/components/finance/category-form";
import { getFinancialCategories, requireAdministrator } from "@/lib/page-api";

async function loadPage({ params }: ClientPageProps) { await requireAdministrator(); const { id } = await params; const categories = await getFinancialCategories(); const category = categories.find(item => item.id === Number(id)); if (!category) throw new Error("Categoría no encontrada."); return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-sans text-3xl font-semibold text-brand-ink">Editar categoría</h1><CategoryForm category={category} /></div></div>; }
export default function ClientView(){return <ClientPage load={loadPage}/>;}
