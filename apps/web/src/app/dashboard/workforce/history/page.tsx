import type { Metadata } from "next";
import { WorkforceView } from "@/components/workforce/workforce-view";
export const metadata: Metadata = { title: "Historial por trabajador" };
export default function Page() {
  return <WorkforceView mode="history" />;
}
