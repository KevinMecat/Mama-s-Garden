export function FarmLoader({ message = "Preparando tu finca…", fullPage = false }: { message?: string; fullPage?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`farm-loader ${fullPage ? "farm-loader--full" : ""}`}>
      <div className="farm-loader__scene" aria-hidden="true">
        <span className="farm-loader__sun" />
        <svg viewBox="0 0 100 100" className="farm-loader__plant">
          <path className="farm-loader__stem" d="M50 79 C50 61 50 48 50 32" />
          <path className="farm-loader__leaf farm-loader__leaf--left" d="M50 62 C31 62 27 53 27 45 C39 45 48 50 50 62Z" />
          <path className="farm-loader__leaf farm-loader__leaf--right" d="M50 52 C51 39 59 32 72 32 C72 43 66 51 50 52Z" />
          <path className="farm-loader__soil" d="M25 80 Q50 70 75 80" />
        </svg>
      </div>
      <span className="farm-loader__title">Finca Mama&apos;s Garden</span>
      <span className="farm-loader__message">{message}</span>
      <span className="farm-loader__dots" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}

export function BusyIndicator() {
  return <span aria-hidden="true" className="farm-busy-indicator" />;
}
