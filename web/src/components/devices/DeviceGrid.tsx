import { DeviceCard } from './DeviceCard';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../marketing/Reveal';
import type { Device } from '../../types/device';

interface DeviceGridProps {
  devices: Device[];
}

export function DeviceGrid({ devices }: DeviceGridProps) {
  const scrollRoot = useAppScrollRoot();

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-12 text-center shadow-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-muted)" strokeWidth="1.5" aria-hidden className="mb-3">
          <rect x="2" y="2" width="20" height="20" rx="3"/>
          <path d="M7 12h10M7 8h10M7 16h7"/>
        </svg>
        <p className="text-lg font-bold text-ink">No devices registered</p>
        <p className="mt-1 text-sm text-ink-muted">Add your first medical device to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {devices.map((device, i) => (
        <Reveal key={device.id} root={scrollRoot} delayMs={i * 90}>
          <DeviceCard device={device} />
        </Reveal>
      ))}
    </div>
  );
}

export default DeviceGrid;
