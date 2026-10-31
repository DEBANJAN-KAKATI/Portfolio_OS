import { siGithub } from 'simple-icons';
import { Link as LinkIcon } from 'lucide-react';
import { getApp } from '../apps/registry.js';

/** Fluent-ish app tile: rounded square, soft gradient, white glyph. */
export function Tile({ colors, size = 40, children, className = '' }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.35), 0 1px 3px rgb(0 0 0 / 0.25)',
      }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export function GithubGlyph({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={siGithub.path} />
    </svg>
  );
}

const SHORTCUT_STYLES = {
  github: { colors: ['#3b3b3b', '#0d0d0d'], glyph: (s) => <GithubGlyph size={s} /> },
  // LinkedIn's logo isn't in an open icon set, so use a typographic mark.
  linkedin: { colors: ['#2f8fe0', '#0a58a8'], glyph: (s) => <span style={{ fontWeight: 800, fontSize: s * 0.95, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>in</span> },
  link: { colors: ['#9aa4b2', '#5b6573'], glyph: (s) => <LinkIcon size={s} strokeWidth={2.2} /> },
};

/** Icon for an app id, or for a desktop shortcut ({ icon: 'github' | 'linkedin' | 'link' }). */
export default function AppIcon({ appId, shortcut, size = 40, className }) {
  const glyphSize = Math.round(size * 0.55);
  if (shortcut) {
    const s = SHORTCUT_STYLES[shortcut.icon] ?? SHORTCUT_STYLES.link;
    return (
      <Tile colors={s.colors} size={size} className={className}>
        {s.glyph(glyphSize)}
      </Tile>
    );
  }
  const app = getApp(appId);
  if (!app) return null;
  // Fluent color icon, shown bare like Windows app icons (no tile).
  if (app.iconUrl) {
    return (
      <img
        src={app.iconUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`inline-block shrink-0 ${className ?? ''}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const Glyph = app.icon;
  return (
    <Tile colors={app.colors} size={size} className={className}>
      <Glyph size={glyphSize} strokeWidth={2} />
    </Tile>
  );
}
