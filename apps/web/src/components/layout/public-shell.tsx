import { Navbar } from "@/components/layout/navbar";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
