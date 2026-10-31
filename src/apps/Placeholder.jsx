// Stand-in for content apps until Phase 3 wires them to the data layer.
import AppIcon from '@/os/ui/AppIcon.jsx';

export default function Placeholder({ app }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AppIcon appId={app.id} size={64} />
      <h2 className="text-xl font-semibold">{app.title}</h2>
      <p className="max-w-sm text-sm text-[var(--text-dim)]">
        This app gets its content in Phase 3. Drag, resize, snap or minimize this window to try the window manager.
      </p>
    </div>
  );
}
