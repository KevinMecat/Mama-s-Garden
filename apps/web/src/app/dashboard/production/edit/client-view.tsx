"use client";
import { ClientPage, type ClientPageProps } from "@/components/client-page";
import { ProductionRecordForm } from "@/components/production/production-record-form";
import { getProductionRecord, getProducts, getProjects, requireUser } from "@/lib/page-api";

async function loadPage({ params }: ClientPageProps) {
  await requireUser(); const { id } = await params; const [record, projects, products] = await Promise.all([getProductionRecord(id), getProjects(), getProducts()]);
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-display text-4xl font-semibold text-brand-primary">Editar producción</h1><ProductionRecordForm record={record} projects={projects} products={products} today={record.production_date} /></div></div>;
}
export default function ClientView(){return <ClientPage load={loadPage}/>;}
