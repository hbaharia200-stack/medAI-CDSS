export type DeviceStatus =
  | 'OPERATIONAL'
  | 'DAMAGED'
  | 'UNDER_MAINTENANCE'
  | 'OFFLINE'
  | 'RETIRED';

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: string;
  status: 'Completed' | 'Scheduled' | 'Cancelled';
  technician: string;
  notes?: string;
}

export interface Device {
  id: string;
  deviceNumber: string;
  name: string;
  type: string;
  category: string;
  department: string;
  location: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  image: string;
  status: DeviceStatus;
  installationDate?: string;
  warrantyExpiry?: string;
  expectedServiceLife?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  maintenanceInterval?: string;
  maintenanceProvider?: string;
  errorCode?: string;
  notes?: string;
  detectedIssue?: string;
  priority?: 'Low' | 'Medium' | 'High';
  recommendedActions?: string[];
  maintenanceHistory?: MaintenanceRecord[];
}

export interface InspectionData {
  physicalCondition: 'Good' | 'Fair' | 'Damaged';
  operationalTest: 'Passed' | 'Failed';
  safetyCheck: 'Passed' | 'Failed';
  errorCode?: string;
  notes?: string;
}

export interface DeviceStatistics {
  total: number;
  operational: number;
  damaged: number;
  underMaintenance: number;
  offline: number;
  retired: number;
  byDepartment: Array<{ department: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  maintenanceTrend: Array<{ month: string; maintenanceCount: number }>;
}
