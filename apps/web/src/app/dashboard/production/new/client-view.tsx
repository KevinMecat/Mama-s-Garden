"use client";
import { ClientPage } from "@/components/client-page";
import { ProductionRecordForm } from "@/components/production/production-record-form";
import { getProducts, getProjects, requireUser } from "@/lib/page-api";

async function loadPage() {
  await requireUser(); const [projects, products] = await Promise.all([getProjects("active"), getProducts(true)]);
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-sans text-3xl font-semibold text-brand-ink">Registrar producción</h1><ProductionRecordForm projects={projects} products={products} today={new Date().toISOString().slice(0, 10)} /></div></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
