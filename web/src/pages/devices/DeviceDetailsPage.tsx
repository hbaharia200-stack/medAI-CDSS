import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { DeviceInspectionForm } from '../../components/devices/DeviceInspectionForm';
import { DeviceDetailsPanel } from '../../components/devices/DeviceDetailsPanel';
import { DeviceStatusBadge } from '../../components/devices/DeviceStatusBadge';
import { deviceService } from '../../services/deviceService';
import type { Device, InspectionData } from '../../types/device';

export default function DeviceDetailsPage() {
  const { t } = useTranslation();
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showInspection, setShowInspection] = useState(false);

  const device: Device | undefined = useMemo(
    () => (deviceId ? deviceService.getDeviceById(deviceId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deviceId, refreshKey],
  );


  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [deviceId]);

  if (!device) {
    return (
      <div className="space-y-6">
        <div>
          <div className="overflow-hidden pb-1 pt-1">
            <h1 className="text-2xl font-extrabold text-heading">{t('nav.devices')}</h1>
          </div>
          <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface p-12 text-center shadow-card">
          <p className="text-lg font-bold text-ink">{t('devices.deviceNotFound')}</p>
          <button
            type="button"
            onClick={() => navigate('/app/devices')}
            className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {t('devices.backToDevices')}
          </button>
        </div>
      </div>
    );
  }

  const handleInspection = (data: InspectionData) => {
    const result = deviceService.inspectDevice(device.id, data);
    if (result) {
      setRefreshKey((k) => k + 1);
    }
    setShowInspection(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/app/devices')}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {t('devices.backToDevices')}
          </button>
          <div className="overflow-hidden pb-1 pt-1">
            <h1 className="text-2xl font-extrabold text-heading">{device.name}</h1>
          </div>
          <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInspection(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
        >
          {t('devices.inspectDevice')}
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full shrink-0 lg:w-[380px]"
        >
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
              <img
                src={device.image}
                alt={device.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">{device.deviceNumber}</p>
                <DeviceStatusBadge status={device.status} />
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {device.type} · {device.department}
              </p>
            </div>
          </div>
        </motion.div>

        <DeviceDetailsPanel device={device} />
      </div>

      {showInspection && (
        <DeviceInspectionForm
          deviceId={device.id}
          deviceName={device.name}
          onSubmit={handleInspection}
          onCancel={() => setShowInspection(false)}
        />
      )}
    </div>
  );
}
