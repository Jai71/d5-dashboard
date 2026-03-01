import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataPoint, Settings, Notification as NotifType } from '../types';
import {
  NOTIFICATION_DISMISS_MS,
  NOTIFICATION_DEBOUNCE_MS,
  MAX_VISIBLE_NOTIFICATIONS,
} from '../constants';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface Props {
  currentPoint: DataPoint | undefined;
  settings: Settings;
  isLive: boolean;
}

const TRIGGER_STYLES: Record<NotifType['type'], { border: string; Icon: typeof AlertTriangle }> = {
  warning: { border: 'border-l-warning', Icon: AlertTriangle },
  error: { border: 'border-l-error', Icon: AlertCircle },
  info: { border: 'border-l-accent', Icon: Info },
};

export default function Notifications({ currentPoint, settings, isLive }: Props) {
  const [notifications, setNotifications] = useState<NotifType[]>([]);
  const debounceRef = useRef<Record<number, number>>({});

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) =>
      setTimeout(() => dismiss(n.id), NOTIFICATION_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, dismiss]);

  // Check triggers
  useEffect(() => {
    if (!isLive || !currentPoint) return;

    const d = currentPoint;
    const now = Date.now();
    const newNotifs: NotifType[] = [];

    const tryFire = (triggerId: number, type: NotifType['type'], message: string) => {
      const lastFired = debounceRef.current[triggerId] || 0;
      if (now - lastFired < NOTIFICATION_DEBOUNCE_MS) return;
      debounceRef.current[triggerId] = now;
      newNotifs.push({
        id: `${triggerId}-${now}`,
        triggerId,
        type,
        message,
        timestamp: now,
      });
    };

    // Trigger 1: Load calling but not switched
    if (d.cl1 && !d.ls1) tryFire(1, 'warning', 'Load 1 calling — not yet switched on');
    if (d.cl2 && !d.ls2) tryFire(1, 'warning', 'Load 2 calling — not yet switched on');
    if (d.cl3 && !d.ls3) tryFire(1, 'warning', 'Load 3 calling — not yet switched on');

    // Trigger 2: Battery below 1 Ah
    if (d.soc < 1 && d.soc > 0) tryFire(2, 'error', 'Battery below 1 Ah');

    // Trigger 3: High PV but mains still drawing
    const mainsCurrent = (d.mainsRequest / 10) * settings.maxMains;
    if (d.pv > 1.5 && mainsCurrent > 0.5)
      tryFire(3, 'info', 'High PV available but mains still drawing');

    // Trigger 4: Battery fully discharged
    if (d.soc <= 0 && d.bdis === 1) tryFire(4, 'error', 'Battery fully discharged');

    // Trigger 5: Simultaneous charge and discharge
    if (d.bchg === 1 && d.bdis === 1)
      tryFire(5, 'error', 'ERROR: Simultaneous charge and discharge');

    // Trigger 6: Mains at max
    if (d.mainsRequest >= 9.5) tryFire(6, 'warning', 'Mains request at maximum (4A)');

    if (newNotifs.length > 0) {
      setNotifications((prev) => [...newNotifs, ...prev].slice(0, MAX_VISIBLE_NOTIFICATIONS));
    }
  }, [currentPoint, isLive, settings]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[320px]">
      {notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS).map((n) => {
        const { border, Icon } = TRIGGER_STYLES[n.type];
        return (
          <div
            key={n.id}
            className={`flex items-start gap-2 px-3 py-2.5 bg-bg-surface1 border border-border-default ${border} border-l-4 rounded-lg`}
            style={{
              animation: 'slideIn 300ms ease-out',
            }}
          >
            <Icon size={14} className="mt-0.5 shrink-0" />
            <span className="text-[12px] text-text-secondary flex-1">{n.message}</span>
            <button onClick={() => dismiss(n.id)} className="text-text-tertiary hover:text-text-primary">
              <X size={12} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(16px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
