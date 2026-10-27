"use client";
import { ClientPage } from "@/components/client-page";
import { CategoryForm } from "@/components/finance/category-form";
import { requireAdministrator } from "@/lib/page-api";

async function loadPage() { await requireAdministrator(); return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><h1 className="font-sans text-3xl font-semibold text-brand-ink">Nueva categoría</h1><CategoryForm /></div></div>; }
export default function ClientView(){return <ClientPage load={loadPage}/>;}
