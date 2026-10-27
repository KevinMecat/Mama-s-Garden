"use client";
import { ClientPage } from "@/components/client-page";
import { SaleForm } from "@/components/production/sale-form";
import { getFinancialCategories, getProducts, getProjects, requireUser } from "@/lib/page-api";

async function loadPage() {
  const user = await requireUser(); const [projects, products, categories] = await Promise.all([getProjects("active"), getProducts(true), getFinancialCategories(true)]);
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-sans text-3xl font-semibold text-brand-ink">Registrar venta</h1><p className="mt-3 text-brand-muted">El total y el ingreso financiero se calculan y guardan juntos.</p><SaleForm projects={projects} products={products} categories={categories} role={user.role} today={new Date().toISOString().slice(0, 10)} /></div></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
