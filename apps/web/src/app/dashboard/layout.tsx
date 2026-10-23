import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { requireUser } from "@/lib/server-api";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();

  return (
    <div className="min-h-svh bg-[#f3f0e6] md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <DashboardNavigation user={user} />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
