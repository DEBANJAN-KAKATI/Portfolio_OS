import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Volume2, VolumeX, Volume1, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Bell, BellDot } from 'lucide-react';
import { useSystem } from '../store/system.js';
import { useClock } from '../lib/hooks.js';

export function useBattery() {
  const [battery, setBattery] = useState({ level: 1, charging: true, supported: false });
  useEffect(() => {
    let b;
    const update = () => setBattery({ level: b.level, charging: b.charging, supported: true });
    navigator.getBattery?.().then((bat) => {
      b = bat;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    });
    return () => {
      b?.removeEventListener('levelchange', update);
      b?.removeEventListener('chargingchange', update);
    };
  }, []);
  return battery;
}

export function BatteryIcon({ level, charging, size = 16 }) {
  if (charging) return <BatteryCharging size={size} />;
  if (level > 0.6) return <BatteryFull size={size} />;
  if (level > 0.25) return <BatteryMedium size={size} />;
  return <BatteryLow size={size} />;
}

export default function SystemTray() {
  const now = useClock(15_000);
  const { wifi, settings, panel, togglePanel } = useSystem();
  const unread = useSystem((s) => s.notifications.some((n) => !n.read));
  const battery = useBattery();
  const VolumeIcon = !settings.sound || settings.volume === 0 ? VolumeX : settings.volume < 0.5 ? Volume1 : Volume2;

  const btn = (name) =>
    `flex h-10 items-center gap-2 rounded-md px-2 transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface-press)] ${panel === name ? 'bg-[var(--surface-hover)]' : ''}`;

  return (
    <div className="mr-1 flex items-center gap-0.5">
      <button data-toggle="quick" aria-label="Quick settings: network, volume, battery" className={btn('quick')} onClick={() => togglePanel('quick')}>
        {wifi ? <Wifi size={16} /> : <WifiOff size={16} />}
        <VolumeIcon size={16} />
        <BatteryIcon level={battery.level} charging={battery.charging} />
      </button>
      <button
        data-toggle="calendar"
        aria-label={`Clock and calendar: ${now.toLocaleString()}`}
        className={`${btn('calendar')} flex-col !gap-0 text-right text-xs leading-tight`}
        onClick={() => togglePanel('calendar')}
      >
        <span>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        <span>{now.toLocaleDateString([], { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
      </button>
      <button data-toggle="notifications" aria-label={`Notifications${unread ? ' (unread)' : ''}`} className={btn('notifications')} onClick={() => togglePanel('notifications')}>
        {unread ? <BellDot size={16} className="text-[var(--accent)]" /> : <Bell size={16} />}
      </button>
    </div>
  );
}
