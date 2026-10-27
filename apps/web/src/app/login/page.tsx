import type { Metadata } from "next";
import ClientView from "./client-view";
export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso seguro al sistema de gestión de Finca Mama's Garden.",
};

export default function Page(){return <ClientView/>;}
