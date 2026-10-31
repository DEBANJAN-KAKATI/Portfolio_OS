/** Original "DK" logo used for the Start button and boot screens (not a Windows logo). */
export default function Monogram({ size = 24, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dk-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fb2ff" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#dk-g)" />
      <text x="32" y="42" textAnchor="middle" fontFamily="Segoe UI Variable Display, Segoe UI, Inter, Arial, sans-serif" fontSize="26" fontWeight="700" fill="#fff">
        DK
      </text>
    </svg>
  );
}
