import { EmployeeForm } from "@/components/payroll/employee-form";
import { todayInGuatemala } from "@/lib/date";
import { getServerEmployee, getServerSalaryRates, requireAdministrator } from "@/lib/server-api";

export const metadata = { title: "Editar trabajador" };
export default async function EditEmployeePage({ params }: PageProps<"/dashboard/employees/[id]/edit">) {
  await requireAdministrator();
  const { id } = await params;
  const [employee, rates] = await Promise.all([getServerEmployee(id), getServerSalaryRates(id)]);
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12"><div className="rounded-[1.75rem] border border-brand-border bg-white p-6 sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">Personal</p><h1 className="mt-3 font-display text-4xl font-semibold text-brand-primary">Editar trabajador</h1><EmployeeForm employee={employee} rates={rates} today={todayInGuatemala()} /></div></div>;
}
