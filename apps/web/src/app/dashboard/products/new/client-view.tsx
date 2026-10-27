"use client";
import { ClientPage } from "@/components/client-page";
import { ProductForm } from "@/components/production/product-form";
import { requireAdministrator } from "@/lib/page-api";

async function loadPage() {
  await requireAdministrator();
  return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Catálogo</p><h1 className="mt-3 font-sans text-3xl font-semibold text-brand-ink">Nuevo producto</h1><ProductForm /></div></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
