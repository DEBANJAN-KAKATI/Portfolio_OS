/** Small Fluent-style building blocks shared by every app. */
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { safeHtml } from '@/data/safeHtml.js';
import { tagLabel } from './format.js';

export function Button({ variant = 'secondary', icon: Icon, children, className = '', ...props }) {
  const styles =
    variant === 'primary'
      ? { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'transparent' }
      : variant === 'ghost'
        ? { background: 'transparent', borderColor: 'transparent' }
        : { background: 'var(--surface-solid)' };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-[13px] font-medium transition-[filter,background-color] hover:brightness-110 hover:bg-[var(--surface-hover)] disabled:pointer-events-none disabled:opacity-50 ${className}`}
      style={styles}
      {...props}
    >
      {Icon && <Icon size={15} />}
      {children}
    </motion.button>
  );
}

export function LinkButton({ href, variant, icon, children, ...props }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" tabIndex={-1} {...props}>
      <Button variant={variant} icon={icon}>
        {children}
      </Button>
    </a>
  );
}

export function Chip({ children, active, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${onClick ? 'hover:bg-[var(--surface-hover)]' : ''} ${className}`}
      style={active ? { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'transparent' } : { borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
    >
      {children}
    </Tag>
  );
}

export const TagChip = ({ tag, ...props }) => <Chip {...props}>{tagLabel(tag)}</Chip>;

export function Badge({ children, tone = 'accent' }) {
  const tones = {
    accent: { background: 'var(--accent)', color: 'var(--accent-text)' },
    green: { background: '#16a34a', color: '#fff' },
    amber: { background: '#d97706', color: '#fff' },
    muted: { background: 'var(--surface-hover)', color: 'var(--text-dim)' },
  };
  return <span className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide" style={tones[tone]}>{children}</span>;
}

/** Fluent "pivot" tabs. */
export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`flex gap-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className="relative flex h-9 items-center gap-2 rounded-md px-3 text-[13px] hover:bg-[var(--surface-hover)]"
        >
          {t.icon && <t.icon size={15} />}
          {t.label}
          {value === t.id && <motion.span layoutId={`tab-${tabs.map((x) => x.id).join()}`} className="absolute inset-x-3 bottom-0 h-[3px] rounded-full" style={{ background: 'var(--accent)' }} />}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <label className={`flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 focus-within:border-b-[var(--accent)] ${className}`}>
      <Search size={14} className="shrink-0 text-[var(--text-dim)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]"
      />
    </label>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 p-8 text-center text-[var(--text-dim)]">
      {Icon && <Icon size={36} strokeWidth={1.5} />}
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {children && <div className="max-w-sm text-xs">{children}</div>}
    </div>
  );
}

/** Vault bullets (only <b> survives sanitizing). */
export function Bullets({ items, className = '' }) {
  return (
    <ul className={`selectable list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed marker:text-[var(--accent)] [&_b]:font-semibold ${className}`}>
      {items.map((b, i) => (
        <li key={i} dangerouslySetInnerHTML={safeHtml(b)} />
      ))}
    </ul>
  );
}

export function Section({ title, children, className = '', action }) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] ${className}`} {...props}>
      {children}
    </div>
  );
}
