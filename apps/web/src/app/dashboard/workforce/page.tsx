import type { Metadata } from "next";
import { WorkforceView } from "@/components/workforce/workforce-view";
export const metadata: Metadata = { title: "Trabajo de hoy" };
export default function Page() {
  return <WorkforceView mode="board" />;
}
