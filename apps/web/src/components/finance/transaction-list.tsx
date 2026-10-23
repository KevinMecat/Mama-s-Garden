import type { FinancialTransaction } from "@/types/finance";

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-GT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const typeStyles: Record<FinancialTransaction["type"], string> = {
  INCOME: "text-emerald-700",
  EXPENSE: "text-amber-700",
  INVESTMENT: "text-sky-700",
};

const statusStyles: Record<FinancialTransaction["status"], string> = {
  DRAFT: "bg-amber-50 text-amber-800 ring-amber-200",
  POSTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  VOID: "bg-stone-100 text-stone-600 ring-stone-200",
};

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function ReceiptLink({ transaction }: { transaction: FinancialTransaction }) {
  const receipt = transaction.attachments[0];
  if (!receipt) return <span className="text-brand-muted/65">Sin archivo</span>;

  return (
    <a
      href={receipt.file_url}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-brand-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
    >
      Ver factura
    </a>
  );
}

export function TransactionList({ transactions }: { transactions: FinancialTransaction[] }) {
  if (!transactions.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-brand-border bg-brand-surface px-6 py-12 text-center">
        <p className="font-display text-2xl font-semibold text-brand-primary">No hay movimientos con estos filtros</p>
        <p className="mt-2 text-brand-muted">Cambia los filtros o registra el primer movimiento financiero.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:hidden">
        {transactions.map((transaction) => (
          <article key={transaction.id} className="rounded-[1.35rem] border border-brand-border bg-brand-surface p-5 shadow-[0_12px_32px_rgba(72,73,39,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.12em] ${typeStyles[transaction.type]}`}>{transaction.type_label}</p>
                <h3 className="mt-2 font-display text-xl font-semibold leading-tight text-brand-primary">
                  {transaction.description || transaction.category_name}
                </h3>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset ${statusStyles[transaction.status]}`}>{transaction.status_label}</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-brand-primary">{currencyFormatter.format(Number(transaction.amount))}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-brand-border/70 pt-4 text-sm">
              <div>
                <dt className="text-brand-muted">Proyecto</dt>
                <dd className="mt-1 font-semibold text-brand-primary">{transaction.project_name}</dd>
              </div>
              <div>
                <dt className="text-brand-muted">Fecha</dt>
                <dd className="mt-1 font-semibold text-brand-primary">{formatDate(transaction.transaction_date)}</dd>
              </div>
              <div>
                <dt className="text-brand-muted">Categoría</dt>
                <dd className="mt-1 font-semibold text-brand-primary">{transaction.category_name}</dd>
              </div>
              <div>
                <dt className="text-brand-muted">Comprobante</dt>
                <dd className="mt-1"><ReceiptLink transaction={transaction} /></dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[1.5rem] border border-brand-border bg-brand-surface shadow-[0_12px_32px_rgba(72,73,39,0.05)] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="bg-brand-cream/65 text-xs uppercase tracking-[0.1em] text-brand-muted">
              <tr>
                <th className="px-5 py-4 font-bold">Fecha y detalle</th>
                <th className="px-5 py-4 font-bold">Proyecto</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Monto</th>
                <th className="px-5 py-4 font-bold">Estado</th>
                <th className="px-5 py-4 font-bold">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/70">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="align-top transition hover:bg-brand-paper/70">
                  <td className="px-5 py-5">
                    <p className="font-semibold text-brand-primary">{transaction.description || transaction.category_name}</p>
                    <p className="mt-1 text-xs text-brand-muted">{formatDate(transaction.transaction_date)} · {transaction.category_name}</p>
                  </td>
                  <td className="px-5 py-5 font-semibold text-brand-primary">{transaction.project_name}</td>
                  <td className={`px-5 py-5 font-bold ${typeStyles[transaction.type]}`}>{transaction.type_label}</td>
                  <td className="px-5 py-5 text-base font-bold text-brand-primary">{currencyFormatter.format(Number(transaction.amount))}</td>
                  <td className="px-5 py-5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusStyles[transaction.status]}`}>{transaction.status_label}</span>
                  </td>
                  <td className="px-5 py-5"><ReceiptLink transaction={transaction} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
