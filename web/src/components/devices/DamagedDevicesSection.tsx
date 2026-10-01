import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceCard } from './DeviceCard';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../marketing/Reveal';
import type { Device } from '../../types/device';

interface DamagedDevicesSectionProps {
  damagedDevices: Device[];
}

export function DamagedDevicesSection({ damagedDevices }: DamagedDevicesSectionProps) {
  const [open, setOpen] = useState(false);
  const scrollRoot = useAppScrollRoot();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-8 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-canvas"
      >
        {open ? 'Hide Damaged Devices' : 'View Damaged Devices'}
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="damaged-content"
            ref={contentRef}
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-3xl border border-line bg-surface p-6 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" aria-hidden>
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="text-base font-bold text-danger">Damaged Devices</h3>
              </div>

              {damagedDevices.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-8 text-center"
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-conf-high)" strokeWidth="1.5" aria-hidden className="mb-2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
                    <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-lg font-bold text-ink">No damaged devices</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    All registered hospital devices are currently operational.
                  </p>
                </motion.div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {damagedDevices.map((device, i) => (
                    <Reveal key={device.id} root={scrollRoot} delayMs={i * 90}>
                      <DeviceCard device={device} />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DamagedDevicesSection;
