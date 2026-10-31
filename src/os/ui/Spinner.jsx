/** The circular dots loader used at boot and while apps load. */
export default function Spinner({ size = 32, color = 'currentColor', label = 'Loading' }) {
  const dots = 5;
  return (
    <span role="progressbar" aria-label={label} className="relative inline-block" style={{ width: size, height: size }}>
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          className="absolute inset-0"
          style={{ animation: `os-orbit 2.2s cubic-bezier(.5,.15,.35,.9) ${i * 0.14}s infinite` }}
        >
          <span
            className="absolute left-1/2 top-0 rounded-full"
            style={{ width: size / 9, height: size / 9, marginLeft: -size / 18, background: color }}
          />
        </span>
      ))}
      <style>{`@keyframes os-orbit {
        0% { transform: rotate(0deg); opacity: 0 }
        8% { opacity: 1 }
        70% { transform: rotate(560deg); opacity: 1 }
        85%, 100% { transform: rotate(720deg); opacity: 0 }
      }`}</style>
    </span>
  );
}
