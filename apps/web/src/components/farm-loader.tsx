export function FarmLoader({ message = "Preparando tu finca…", fullPage = false }: { message?: string; fullPage?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`farm-loader ${fullPage ? "farm-loader--full" : ""}`}>
      <div className="farm-loader__scene" aria-hidden="true">
        <svg viewBox="0 0 200 200" className="farm-loader__plant">
          <path className="farm-loader__stroke farm-loader__soil" d="M66 157 H134" />
          <path className="farm-loader__stroke farm-loader__stem" d="M100 157 C100 131 99 107 102 78" />
          <path className="farm-loader__stroke farm-loader__leaf farm-loader__leaf--left" d="M100 119 C88 119 69 113 64 101 C57 85 69 80 81 84 C94 88 100 100 100 119 Z" />
          <path className="farm-loader__stroke farm-loader__leaf farm-loader__leaf--right" d="M102 93 C102 75 109 60 122 58 C132 56 137 58 137 63 C136 79 123 92 102 93 Z" />
          <circle className="farm-loader__sparkle" cx="52" cy="66" r="3" />
          <circle className="farm-loader__sparkle farm-loader__sparkle--two" cx="151" cy="91" r="3" />
          <circle className="farm-loader__sparkle farm-loader__sparkle--three" cx="55" cy="137" r="2" />
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
