import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeviceSummaryCards } from '../../components/devices/DeviceSummaryCards';
import { DeviceGrid } from '../../components/devices/DeviceGrid';
import { DamagedDevicesSection } from '../../components/devices/DamagedDevicesSection';
import { DeviceRegistrationForm } from '../../components/devices/DeviceRegistrationForm';
import { DeviceAnalyticsCharts } from '../../components/devices/DeviceAnalyticsCharts';
import { deviceService } from '../../services/deviceService';
import type { Device } from '../../types/device';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

export default function DevicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrollRoot = useAppScrollRoot();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showRegister, setShowRegister] = useState(false);

  // Initial load
  useEffect(() => {
    const all = deviceService.getDevices();
    setDevices(all);
  }, []);

  const handleRegister = (data: any) => {
    const newDevice = deviceService.createDevice({
      deviceNumber: data.deviceNumber,
      name: data.deviceName,
      type: data.deviceType,
      category: data.category,
      department: data.department,
      location: data.location,
      manufacturer: data.manufacturer || undefined,
      model: data.model || undefined,
      serialNumber: data.serialNumber || undefined,
      firmwareVersion: data.firmwareVersion || undefined,
      installationDate: data.installationDate || undefined,
      warrantyExpiry: data.warrantyExpiry || undefined,
      maintenanceInterval: data.maintenanceInterval || undefined,
      image: data.image || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=400&fit=crop&q=80',
      status: 'OPERATIONAL',
      maintenanceHistory: [],
    });
    setDevices(deviceService.getDevices());
    navigate(`/app/devices/${newDevice.id}`);
  };

  const stats = deviceService.getDeviceStatistics();

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-heading">{t('nav.devices')}</h1>
            <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark shadow-card"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('devices.registerDevice')}
          </button>
        </div>

        {/* Summary cards */}
        <DeviceSummaryCards
          total={stats.total}
          operational={stats.operational}
          damaged={stats.damaged}
          underMaintenance={stats.underMaintenance}
        />

        {/* Device analytics (Recharts, theme-token styled) */}
        <Reveal root={scrollRoot} delayMs={90}>
          <DeviceAnalyticsCharts stats={stats} />
        </Reveal>

        {/* Device grid */}
        <DeviceGrid devices={devices} />

        {/* Damaged devices section */}
        <DamagedDevicesSection damagedDevices={deviceService.getDamagedDevices()} />
      </div>

      {/* Registration modal */}
      {showRegister && (
        <DeviceRegistrationForm
          onClose={() => setShowRegister(false)}
          onRegister={handleRegister}
        />
      )}
    </>
  );
}
