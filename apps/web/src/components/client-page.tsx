"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientNavigation } from "@/lib/client-navigation";
import { DATA_CHANGED_EVENT } from "@/lib/api-client";
import { FarmLoader } from "@/components/farm-loader";

export interface ClientPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

type Loader = (props: ClientPageProps) => Promise<ReactNode>;

function ClientContent({ load }: { load: Loader }) {
  const query = useSearchParams().toString();
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ content?: ReactNode; error?: string }>({});

  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    window.addEventListener("finca:auth-changed", refresh);
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, refresh);
      window.removeEventListener("finca:auth-changed", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const search = Object.fromEntries(new URLSearchParams(query));
    if (search.id && !/^[1-9][0-9]*$/.test(search.id)) {
      router.replace("/dashboard");
      return;
    }
    void load({
      params: Promise.resolve({ id: search.id ?? "" }),
      searchParams: Promise.resolve(search),
    }).then(content => {
      if (active) setState({ content });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ClientNavigation) {
        setState({});
        router.replace(error.destination);
      } else {
        setState({ error: "No se pudo cargar la información. Comprueba la conexión con el servicio de datos." });
      }
    });
    return () => { active = false; };
  }, [load, query, router, version]);

  if (state.error) return <section role="alert" className="mx-auto max-w-xl p-8"><p>{state.error}</p><button className="mt-4 underline" onClick={() => { setState({}); setVersion(value => value + 1); }}>Reintentar</button></section>;
  if (!state.content) return <FarmLoader message="Cargando información…" />;
  return state.content;
}

export function ClientPage({ load }: { load: Loader }) {
  return <Suspense fallback={<FarmLoader />}><ClientContent load={load} /></Suspense>;
}
