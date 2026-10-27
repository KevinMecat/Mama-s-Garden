"use client";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import { SaleForm } from "@/components/production/sale-form";
import { getFinancialCategories, getProducts, getProjects, getSale, requireUser } from "@/lib/page-api";

async function loadPage({ params }: ClientPageProps) {
  const user = await requireUser(); const { id } = await params; const [sale, projects, products, categories] = await Promise.all([getSale(id), getProjects(), getProducts(), getFinancialCategories()]);
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-sans text-3xl font-semibold text-brand-ink">Editar venta</h1><SaleForm sale={sale} projects={projects} products={products} categories={categories} role={user.role} today={sale.sale_date} /></div></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
