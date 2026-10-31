import { useState } from 'react';
import { Brain, LineChart, FlaskConical, Code2, Boxes, Package } from 'lucide-react';
import { hashUnit } from './format.js';

const TAG_ICON = { ai_ml: Brain, quant: LineChart, finance: LineChart, chemical: FlaskConical, full_stack: Code2, sde: Boxes, product: Package };

/**
 * Project thumbnail: the project's own image when it has one, otherwise a
 * generated gradient tile (deterministic per project) with a topic glyph.
 * GitHub's generic social cards are skipped; they all look the same.
 */
export default function ProjectThumb({ project, className = '', large = false }) {
  const [failed, setFailed] = useState(false);
  const src = project.thumbnail && !project.thumbnail.includes('opengraph.githubassets.com') ? project.thumbnail : project.images[0];
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
  }
  const h = Math.round(hashUnit(project.id) * 360);
  const Icon = TAG_ICON[project.tags[0]] ?? Code2;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden text-white ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 50) % 360} 65% 35%))` }}
      aria-hidden="true"
    >
      <span className="absolute -right-6 -bottom-8 h-28 w-28 rounded-full bg-white/10" />
      <span className="absolute -left-4 -top-6 h-16 w-16 rounded-full bg-white/10" />
      <Icon size={large ? 56 : 32} strokeWidth={1.6} className="relative drop-shadow" />
      {large && <span className="absolute bottom-3 left-4 right-4 truncate text-sm font-semibold drop-shadow">{project.title}</span>}
    </div>
  );
}
