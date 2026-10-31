import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Volume2, Moon, Sun, Sparkles, ChevronLeft, ChevronRight, X, BellOff, Settings } from 'lucide-react';
import { useSystem } from '../store/system.js';
import { useWindows } from '../store/windows.js';
import { useClock, useResolvedTheme } from '../lib/hooks.js';
import Flyout from '../ui/Flyout.jsx';
import AppIcon from '../ui/AppIcon.jsx';
import { useBattery, BatteryIcon } from './SystemTray.jsx';

const RIGHT = { right: 12, bottom: 'calc(var(--taskbar-h) + 12px)' };

function Toggle({ on, icon: Icon, label, onClick }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onClick}
        className="flex h-12 w-full items-center justify-center rounded-md border border-[var(--border)] transition-colors active:scale-[0.97]"
        style={on ? { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'transparent' } : { background: 'var(--surface-alt)' }}
      >
        <Icon size={18} />
      </button>
      <span className="text-[11px] text-[var(--text-dim)]">{label}</span>
    </div>
  );
}

export function QuickSettings() {
  const { wifi, setWifi, settings, updateSettings, notify } = useSystem();
  const theme = useResolvedTheme();
  const battery = useBattery();
  return (
    <Flyout name="quick" label="Quick settings" className="w-[360px]" style={RIGHT}>
      <div className="grid grid-cols-3 gap-3 p-4">
        <Toggle
          on={wifi}
          icon={wifi ? Wifi : WifiOff}
          label="Wi-Fi"
          onClick={() => {
            setWifi(!wifi);
            if (wifi) notify({ title: 'No internet', body: 'You are offline. Some say a dinosaur lives here…', sound: 'error' });
          }}
        />
        <Toggle on={settings.sound} icon={Volume2} label="Sounds" onClick={() => updateSettings({ sound: !settings.sound })} />
        <Toggle on={theme === 'dark'} icon={theme === 'dark' ? Moon : Sun} label="Dark mode" onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })} />
        <Toggle on={!settings.reducedMotion} icon={Sparkles} label="Animations" onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })} />
      </div>
      <div className="flex items-center gap-3 px-4 pb-4">
        <Volume2 size={16} className="shrink-0 text-[var(--text-dim)]" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          aria-label="Volume of site sounds"
          onChange={(e) => updateSettings({ volume: Number(e.target.value), sound: Number(e.target.value) > 0 })}
          className="h-1 w-full cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="w-8 text-right text-xs tabular-nums">{Math.round(settings.volume * 100)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2">
          <BatteryIcon level={battery.level} charging={battery.charging} />
          {battery.supported ? `${Math.round(battery.level * 100)}%${battery.charging ? ' · charging' : ''}` : 'Fully charged with coffee'}
        </span>
        <button aria-label="Open Settings" className="rounded p-1 hover:bg-[var(--surface-hover)]" onClick={() => useWindows.getState().open('settings')}>
          <Settings size={14} />
        </button>
      </div>
    </Flyout>
  );
}

function MonthGrid({ month, today }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const isToday = (d) => d && today.getDate() === d && today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs" role="grid">
      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
        <span key={d} className="py-1 text-[var(--text-dim)]">{d}</span>
      ))}
      {cells.map((d, i) => (
        <span
          key={i}
          role="gridcell"
          aria-current={isToday(d) ? 'date' : undefined}
          className="flex h-9 items-center justify-center rounded-full"
          style={isToday(d) ? { background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600 } : undefined}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function CalendarFlyout() {
  const today = useClock(60_000);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  return (
    <Flyout name="calendar" label="Calendar" className="w-[340px]" style={RIGHT}>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{today.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
          <span className="flex gap-1">
            <button aria-label="Previous month" className="rounded p-1 hover:bg-[var(--surface-hover)]" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
            <button aria-label="Next month" className="rounded p-1 hover:bg-[var(--surface-hover)]" onClick={() => shift(1)}><ChevronRight size={16} /></button>
          </span>
        </div>
        <MonthGrid month={month} today={today} />
      </div>
    </Flyout>
  );
}

const timeAgo = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export function NotificationCenter() {
  const { notifications, clearNotifications, markAllRead, panel } = useSystem();
  const open = panel === 'notifications';
  useEffect(() => {
    if (open) markAllRead();
  }, [open, markAllRead]);
  return (
    <Flyout name="notifications" label="Notifications" className="flex max-h-[70vh] w-[360px] flex-col" style={RIGHT}>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">Notifications</h2>
        {notifications.length > 0 && (
          <button className="rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover)]" onClick={clearNotifications}>Clear all</button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {notifications.length === 0 && (
          <p className="flex flex-col items-center gap-2 py-10 text-sm text-[var(--text-dim)]">
            <BellOff size={22} /> No new notifications
          </p>
        )}
        {notifications.map((n) => (
          <motion.div layout key={n.id} className="group mb-1.5 flex gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] p-3">
            {n.appId ? <AppIcon appId={n.appId} size={20} /> : <span className="mt-1 h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="selectable mt-0.5 text-xs text-[var(--text-dim)]">{n.body}</p>}
              <p className="mt-1 text-[11px] text-[var(--text-dim)]">{timeAgo(n.time)}</p>
            </div>
            <button
              aria-label="Dismiss"
              className="self-start rounded p-0.5 opacity-0 hover:bg-[var(--surface-hover)] group-hover:opacity-100"
              onClick={() => useSystem.setState((s) => ({ notifications: s.notifications.filter((x) => x.id !== n.id) }))}
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </div>
    </Flyout>
  );
}
