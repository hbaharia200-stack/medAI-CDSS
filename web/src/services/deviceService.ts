// Device service layer -- frontend abstraction for backend integration.
// Mock/demo data is clearly isolated here so the real backend can replace it later.

import type { Device, DeviceStatus, InspectionData, DeviceStatistics, MaintenanceRecord } from '../types/device';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(8, 30, 0, 0);
  return d.toISOString().split('T')[0];
}

const DEMO_DEVICES: Device[] = [
  {
    id: 'dev-mri-001',
    deviceNumber: 'MRI-001',
    name: 'MRI Machine',
    type: 'MRI Scanner',
    category: 'Imaging',
    department: 'Radiology',
    location: 'Building A, Wing 2, Room 204',
    manufacturer: 'Siemens Healthineers',
    model: 'MAGNETOM Sola 1.5T',
    serialNumber: 'S-N2019-88421',
    firmwareVersion: 'VB20A.00',
    image: 'https://images.unsplash.com/photo-1534667962782-063440a452f7?w=600&h=400&fit=crop&q=80',
    status: 'OPERATIONAL',
    installationDate: '2020-03-15',
    warrantyExpiry: '2027-03-15',
    expectedServiceLife: '10 years',
    lastMaintenance: daysAgo(60),
    nextMaintenance: daysAgo(30),
    maintenanceInterval: 'Quarterly',
    maintenanceProvider: 'Siemens Care Services',
    maintenanceHistory: [
      { id: 'mh-1', date: daysAgo(60), type: 'Preventive Maintenance', status: 'Completed', technician: 'John M.', notes: 'All systems nominal' },
      { id: 'mh-2', date: daysAgo(150), type: 'Calibration', status: 'Completed', technician: 'A. Hassan', notes: 'Image quality verified' },
      { id: 'mh-3', date: daysAgo(365), type: 'Inspection', status: 'Completed', technician: 'J. Mushi', notes: 'Annual safety inspection' },
    ],
  },
  {
    id: 'dev-xr-004',
    deviceNumber: 'XR-004',
    name: 'X-Ray Machine',
    type: 'Digital Radiography',
    category: 'Imaging',
    department: 'Radiology',
    location: 'Building A, Wing 1, Room 102',
    manufacturer: 'Philips Healthcare',
    model: 'DigitalDiagnost C90',
    serialNumber: 'PX-2021-55892',
    firmwareVersion: '3.2.1',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=400&fit=crop&q=80',
    status: 'DAMAGED',
    installationDate: '2021-06-20',
    warrantyExpiry: '2026-06-20',
    expectedServiceLife: '8 years',
    lastMaintenance: daysAgo(180),
    nextMaintenance: daysAgo(20),
    maintenanceInterval: 'Semi-Annual',
    maintenanceProvider: 'Philips Medical Support',
    errorCode: 'ERR-CAL-0042',
    detectedIssue: 'Calibration Error',
    priority: 'High',
    recommendedActions: [
      'Inspect calibration module',
      'Check detector connection',
      'Run diagnostic test',
      'Contact Philips support with error code ERR-CAL-0042',
    ],
    maintenanceHistory: [
      { id: 'mh-4', date: daysAgo(180), type: 'Routine Check', status: 'Completed', technician: 'J. Mushi', notes: 'Within normal parameters' },
      { id: 'mh-5', date: daysAgo(340), type: 'Calibration', status: 'Completed', technician: 'A. Hassan', notes: 'Image quality verified' },
    ],
  },
  {
    id: 'dev-ecg-012',
    deviceNumber: 'ECG-012',
    name: 'ECG Monitor',
    type: 'Electrocardiograph',
    category: 'Monitoring',
    department: 'Cardiology',
    location: 'Building B, Wing 1, Room 108',
    manufacturer: 'GE Healthcare',
    model: 'MAC 2000',
    serialNumber: 'GE-2022-11234',
    firmwareVersion: 'FW v4.5.2',
    image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&h=400&fit=crop&q=80',
    status: 'OPERATIONAL',
    installationDate: '2022-09-01',
    warrantyExpiry: '2027-09-01',
    expectedServiceLife: '7 years',
    lastMaintenance: daysAgo(45),
    nextMaintenance: daysAgo(45),
    maintenanceInterval: 'Quarterly',
    maintenanceProvider: 'GE Healthcare Solutions',
    maintenanceHistory: [
      { id: 'mh-6', date: daysAgo(45), type: 'Preventive Maintenance', status: 'Completed', technician: 'John M.', notes: 'Leads and electrodes checked' },
      { id: 'mh-7', date: daysAgo(200), type: 'Calibration', status: 'Completed', technician: 'A. Hassan', notes: 'Signal quality verified' },
    ],
  },
  {
    id: 'dev-us-007',
    deviceNumber: 'US-007',
    name: 'Ultrasound Scanner',
    type: 'Diagnostic Ultrasound',
    category: 'Imaging',
    department: 'Radiology',
    location: 'Building A, Wing 3, Room 306',
    manufacturer: 'Samsung Medison',
    model: 'RS85 Prestige',
    serialNumber: 'SM-2021-77893',
    firmwareVersion: 'V2.40',
    image: 'https://images.unsplash.com/photo-1579027989536-b7b71b861c5a?w=600&h=400&fit=crop&q=80',
    status: 'OPERATIONAL',
    installationDate: '2021-11-10',
    warrantyExpiry: '2026-11-10',
    expectedServiceLife: '7 years',
    lastMaintenance: daysAgo(90),
    nextMaintenance: daysAgo(95),
    maintenanceInterval: 'Semi-Annual',
    maintenanceProvider: 'Samsung Medison Support',
    maintenanceHistory: [
      { id: 'mh-8', date: daysAgo(90), type: 'Preventive Maintenance', status: 'Completed', technician: 'J. Mushi', notes: 'Probe array checked' },
      { id: 'mh-9', date: daysAgo(250), type: 'Calibration', status: 'Completed', technician: 'A. Hassan', notes: 'Image optimization' },
    ],
  },
  {
    id: 'dev-vent-003',
    deviceNumber: 'VENT-003',
    name: 'Patient Ventilator',
    type: 'Mechanical Ventilator',
    category: 'Life Support',
    department: 'ICU',
    location: 'Building B, ICU Block, Bed 07',
    manufacturer: 'Dräger',
    model: 'Evita Infinity V500',
    serialNumber: 'DR-2020-33981',
    firmwareVersion: 'v7.2.0',
    image: 'https://images.unsplash.com/photo-1585829365295-ab7d2eeca46e?w=600&h=400&fit=crop&q=80',
    status: 'UNDER_MAINTENANCE',
    installationDate: '2020-08-14',
    warrantyExpiry: '2025-08-14',
    expectedServiceLife: '8 years',
    lastMaintenance: daysAgo(10),
    nextMaintenance: daysAgo(80),
    maintenanceInterval: 'Monthly',
    maintenanceProvider: 'Dräger Service Team',
    notes: 'Scheduled preventive maintenance in progress.',
    maintenanceHistory: [
      { id: 'mh-10', date: daysAgo(10), type: 'Preventive Maintenance', status: 'Scheduled', technician: 'T. Kamau', notes: 'Routine service visit' },
      { id: 'mh-11', date: daysAgo(120), type: 'Inspection', status: 'Completed', technician: 'J. Mushi', notes: 'Alarm testing completed' },
    ],
  },
  {
    id: 'dev-mon-019',
    deviceNumber: 'MON-019',
    name: 'Patient Monitor',
    type: 'Multi-Parameter Monitor',
    category: 'Monitoring',
    department: 'Emergency',
    location: 'Building A, Emergency Dept, Bay 3',
    manufacturer: 'Mindray',
    model: 'iMRSidia 12',
    serialNumber: 'MR-2023-44210',
    firmwareVersion: 'V5.1.0',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=400&fit=crop&q=80',
    status: 'OPERATIONAL',
    installationDate: '2023-02-28',
    warrantyExpiry: '2028-02-28',
    expectedServiceLife: '6 years',
    lastMaintenance: daysAgo(30),
    nextMaintenance: daysAgo(60),
    maintenanceInterval: 'Quarterly',
    maintenanceProvider: 'Mindray Healthcare Ltd',
    maintenanceHistory: [
      { id: 'mh-12', date: daysAgo(30), type: 'Preventive Maintenance', status: 'Completed', technician: 'John M.', notes: 'All sensors functional' },
    ],
  },
  {
    id: 'dev-lab-005',
    deviceNumber: 'LAB-005',
    name: 'Laboratory Analyzer',
    type: 'Clinical Chemistry Analyzer',
    category: 'Laboratory',
    department: 'Laboratory',
    location: 'Building C, Laboratory Wing, Station 5',
    manufacturer: 'Roche Diagnostics',
    model: 'cobas c 503',
    serialNumber: 'RO-2021-66782',
    firmwareVersion: 'v4.0.3',
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=400&fit=crop&q=80',
    status: 'OPERATIONAL',
    installationDate: '2021-04-05',
    warrantyExpiry: '2026-04-05',
    expectedServiceLife: '8 years',
    lastMaintenance: daysAgo(75),
    nextMaintenance: daysAgo(15),
    maintenanceInterval: 'Quarterly',
    maintenanceProvider: 'Roche Diagnostics Services',
    maintenanceHistory: [
      { id: 'mh-13', date: daysAgo(75), type: 'Preventive Maintenance', status: 'Completed', technician: 'A. Hassan', notes: 'Reagent lines flushed' },
      { id: 'mh-14', date: daysAgo(200), type: 'Calibration', status: 'Completed', technician: 'J. Mushi', notes: 'Quality control verified' },
    ],
  },
  {
    id: 'dev-inf-008',
    deviceNumber: 'INF-008',
    name: 'Infusion Pump',
    type: 'Volumetric Infusion Pump',
    category: 'Life Support',
    department: 'Theatre',
    location: 'Building A, Surgical Suite, Pump Station 2',
    manufacturer: 'Baxter Healthcare',
    model: 'Sigma Spectrum',
    serialNumber: 'BX-2022-22891',
    firmwareVersion: 'v5.0.1',
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=400&fit=crop&q=80',
    status: 'DAMAGED',
    installationDate: '2022-05-12',
    warrantyExpiry: '2027-05-12',
    expectedServiceLife: '7 years',
    lastMaintenance: daysAgo(200),
    nextMaintenance: daysAgo(10),
    maintenanceInterval: 'Semi-Annual',
    maintenanceProvider: 'Baxter Medical Support',
    errorCode: 'ERR-FLOW-0018',
    detectedIssue: 'Flow Sensor Malfunction',
    priority: 'Medium',
    recommendedActions: [
      'Replace flow sensor module',
      'Run self-test after replacement',
      'Verify infusion accuracy',
      'Contact Baxter support with error code ERR-FLOW-0018',
    ],
    maintenanceHistory: [
      { id: 'mh-15', date: daysAgo(200), type: 'Routine Check', status: 'Completed', technician: 'J. Mushi', notes: 'Flow rates within tolerance' },
    ],
  },
  {
    id: 'dev-ecg-014',
    deviceNumber: 'ECG-014',
    name: 'Portable ECG',
    type: 'Portable Electrocardiograph',
    category: 'Monitoring',
    department: 'Emergency',
    location: 'Building A, Emergency Dept, Mobile Cart 4',
    manufacturer: 'Schiller AG',
    model: 'CARDIOVIT AT-102',
    serialNumber: 'SC-2023-11902',
    firmwareVersion: 'FW 3.2',
    image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&h=400&fit=crop&q=80',
    status: 'DAMAGED',
    installationDate: '2023-07-22',
    warrantyExpiry: '2028-07-22',
    expectedServiceLife: '6 years',
    lastMaintenance: daysAgo(150),
    nextMaintenance: daysAgo(30),
    maintenanceInterval: 'Annual',
    maintenanceProvider: 'Schiller Medical Services',
    errorCode: 'ERR-ELEC-0009',
    detectedIssue: 'Electrical Fault - Lead Pickup',
    priority: 'High',
    recommendedActions: [
      'Inspect lead wiring and connections',
      'Test electrical isolation',
      'Replace faulty lead set if needed',
      'Run self-diagnostic after repair',
    ],
    maintenanceHistory: [
      { id: 'mh-16', date: daysAgo(150), type: 'Inspection', status: 'Completed', technician: 'A. Hassan', notes: 'Within normal parameters' },
    ],
  },
  {
    id: 'dev-mri-002',
    deviceNumber: 'MRI-002',
    name: 'MRI Machine',
    type: 'MRI Scanner',
    category: 'Imaging',
    department: 'Radiology',
    location: 'Building A, Wing 2, Room 206',
    manufacturer: 'GE Healthcare',
    model: 'SIGNA Explorer 1.5T',
    serialNumber: 'GE-2022-55123',
    firmwareVersion: 'VB21A.03',
    image: 'https://images.unsplash.com/photo-1534667962782-063440a452f7?w=600&h=400&fit=crop&q=80',
    status: 'OFFLINE',
    installationDate: '2022-01-10',
    warrantyExpiry: '2027-01-10',
    expectedServiceLife: '10 years',
    lastMaintenance: daysAgo(180),
    nextMaintenance: daysAgo(60),
    maintenanceInterval: 'Semi-Annual',
    maintenanceProvider: 'GE Healthcare Solutions',
    notes: 'Taken offline for scheduled upgrade. Expected return to service: 2 weeks.',
    maintenanceHistory: [
      { id: 'mh-17', date: daysAgo(180), type: 'Calibration', status: 'Completed', technician: 'T. Kamau', notes: 'Software update applied' },
    ],
  },
];

// In-memory store for demo mode. Replace with real API calls when backend is ready.
let deviceStore: Device[] = [...DEMO_DEVICES];

export const deviceService = {
  getDevices(): Device[] { return [...deviceStore]; },
  getDeviceById(id: string): Device | undefined { return deviceStore.find((d) => d.id === id); },
  createDevice(data: Omit<Device, 'id'>): Device {
    const newDevice: Device = { ...data, id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    deviceStore = [...deviceStore, newDevice];
    return newDevice;
  },
  updateDevice(id: string, data: Partial<Device>): Device | undefined {
    const idx = deviceStore.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    deviceStore = deviceStore.map((d, i) => (i === idx ? { ...d, ...data } : d));
    return deviceStore[idx];
  },
  inspectDevice(id: string, inspection: InspectionData): { device: Device; statusChanged: boolean } | undefined {
    const device = deviceStore.find((d) => d.id === id);
    if (!device) return undefined;
    const statusChanged = inspection.physicalCondition === 'Damaged' || inspection.operationalTest === 'Failed' || inspection.safetyCheck === 'Failed';
    const updated: Device = {
      ...device,
      errorCode: inspection.errorCode ?? device.errorCode,
      notes: inspection.notes ?? device.notes,
      ...(statusChanged ? { status: 'DAMAGED' as DeviceStatus, detectedIssue: 'Inspection detected fault condition' } : {}),
    };
    deviceStore = deviceStore.map((d) => (d.id === id ? updated : d));
    return { device: updated, statusChanged };
  },
  getDamagedDevices(): Device[] { return deviceStore.filter((d) => d.status === 'DAMAGED'); },
  getMaintenanceHistory(deviceId: string): MaintenanceRecord[] { return deviceStore.find((d) => d.id === deviceId)?.maintenanceHistory ?? []; },
  addMaintenanceRecord(deviceId: string, record: MaintenanceRecord): Device | undefined {
    const device = deviceStore.find((d) => d.id === deviceId);
    if (!device) return undefined;
    const updated = { ...device, maintenanceHistory: [...(device.maintenanceHistory ?? []), record] };
    deviceStore = deviceStore.map((d) => (d.id === deviceId ? updated : d));
    return updated;
  },
  getDeviceStatistics(): DeviceStatistics {
    const devices = deviceStore;
    const total = devices.length;
    const operational = devices.filter((d) => d.status === 'OPERATIONAL').length;
    const damaged = devices.filter((d) => d.status === 'DAMAGED').length;
    const underMaintenance = devices.filter((d) => d.status === 'UNDER_MAINTENANCE').length;
    const offline = devices.filter((d) => d.status === 'OFFLINE').length;
    const retired = devices.filter((d) => d.status === 'RETIRED').length;
    const deptMap: Record<string, number> = {};
    devices.forEach((d) => { deptMap[d.department] = (deptMap[d.department] ?? 0) + 1; });
    const byDepartment = Object.entries(deptMap).map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count);
    const catMap: Record<string, number> = {};
    devices.forEach((d) => { catMap[d.category] = (catMap[d.category] ?? 0) + 1; });
    const byCategory = Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const baseMonth = new Date().getMonth();
    const maintenanceTrend = months.map((month, i) => {
      const monthIdx = (baseMonth - i + 12) % 12;
      const seasonal = [12, 10, 14, 11, 13, 15, 12, 14, 13, 11, 12, 14][monthIdx];
      return { month, maintenanceCount: Math.max(1, Math.round((total / 10) * seasonal / 4)) };
    });
    return { total, operational, damaged, underMaintenance, offline, retired, byDepartment, byCategory, maintenanceTrend };
  },
  _resetForDemo(): void { deviceStore = [...DEMO_DEVICES]; },
};
