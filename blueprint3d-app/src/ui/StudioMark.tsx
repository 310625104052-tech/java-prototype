export function StudioMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`studio-brand${compact ? ' studio-brand--compact' : ''}`} aria-label="Blueprint3D">
      <svg
        className="studio-brand-emblem"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M14 2.5L25 8.8V20.2L14 25.5L3 20.2V8.8L14 2.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M3 8.8L14 15.1L25 8.8M14 15.1V25.5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="15.1" r="2.2" fill="var(--studio-vermilion)" />
      </svg>
      <span className="studio-wordmark" aria-hidden="true">
        blueprint<span className="studio-brand-suffix">3D</span>
      </span>
    </span>
  );
}
