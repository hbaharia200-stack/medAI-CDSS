import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Device } from '../../types/device';
import { DeviceStatusBadge } from './DeviceStatusBadge';

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const navigate = useNavigate();
  const isDamaged = device.status === 'DAMAGED';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => navigate(`/app/devices/${device.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/app/devices/${device.id}`);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${device.name} - ${device.status}`}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card card-polished cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-shadow duration-200 hover:shadow-card-hover"
    >
      {isDamaged && (
        <motion.span
          animate={{ opacity: [1, 0.35, 1], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shadow-md"
          aria-label="Damaged device"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </motion.span>
      )}
      <div className="aspect-[4/3] overflow-hidden bg-canvas">
        <img
          src={device.image}
          alt={device.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23F8FAFC'/%3E%3Ctext x='200' y='150' text-anchor='middle' font-family='system-ui' font-size='14' fill='%235C6670' dy='.3em'%3EImage unavailable%3C/text%3E%3C/svg%3E";
          }}
        />
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-ink">{device.name}</p>
        <p className="text-xs text-ink-muted">Device No: {device.deviceNumber}</p>
        <p className="mt-1 text-xs font-semibold text-ink">{device.department}</p>
        <div className="mt-3">
          <DeviceStatusBadge status={device.status} />
        </div>
      </div>
    </motion.article>
  );
}

export default DeviceCard;
