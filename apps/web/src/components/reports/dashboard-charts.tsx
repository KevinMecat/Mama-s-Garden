"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardReport } from "@/types/reports";

const money = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 2,
});
const compactMoney = new Intl.NumberFormat("es-GT", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const COST_COLORS = ["#484927", "#797a49", "#a29b70", "#c0a46c", "#8b6f47", "#66715b"];

type CashFlowRow = DashboardReport["cash_flow"][number];
type CostRow = DashboardReport["cost_distribution"][number];

function EmptyChart() {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-brand-border bg-brand-cream/35 px-6 text-center">
      <div className="max-w-xs">
        <p className="font-display text-xl font-semibold text-brand-primary">
          Aún no hay datos suficientes para graficar
        </p>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          El gráfico aparecerá cuando existan movimientos contabilizados.
        </p>
      </div>
    </div>
  );
}

export function CashFlowChart({ data }: { data: CashFlowRow[] }) {
  const chartData = data.map((row) => ({
    label: row.label,
    Ingresos: Number(row.income),
    Gastos: Number(row.expenses),
  }));
  const hasValues = chartData.some((row) => row.Ingresos > 0 || row.Gastos > 0);

  if (!hasValues) return <EmptyChart />;

  return (
    <div className="h-80 w-full" role="img" aria-label="Ingresos y gastos contabilizados por mes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#ddd9c1" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#68684d", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={(value) => `Q${compactMoney.format(Number(value))}`}
            tick={{ fill: "#68684d", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => money.format(Number(value))}
            contentStyle={{ borderRadius: 16, borderColor: "#cbc6a8", background: "#fbfaf4" }}
          />
          <Legend wrapperStyle={{ paddingTop: 14 }} />
          <Bar dataKey="Ingresos" fill="#484927" radius={[7, 7, 0, 0]} />
          <Bar dataKey="Gastos" fill="#c0a46c" radius={[7, 7, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostDistributionChart({ data }: { data: CostRow[] }) {
  const chartData = data.map((row) => ({ name: row.category_name, value: Number(row.amount) }));
  const hasValues = chartData.some((row) => row.value > 0);

  if (!hasValues) return <EmptyChart />;

  return (
    <div className="h-80 w-full" role="img" aria-label="Distribución de gastos por categoría">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}>
            {chartData.map((row, index) => (
              <Cell key={row.name} fill={COST_COLORS[index % COST_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => money.format(Number(value))}
            contentStyle={{ borderRadius: 16, borderColor: "#cbc6a8", background: "#fbfaf4" }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
