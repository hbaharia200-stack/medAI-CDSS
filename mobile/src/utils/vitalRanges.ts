// Rule-based vital "normal range" checks — MOBILE (nurse console).
// NOT AI logic — hard-coded clinical guardrails (DEFAULT MOCK reference ranges)
// used only to visually flag out-of-range values and suggest the urgent flag.
// Replace with facility reference ranges from the backend team when available.
import type { VitalSigns } from '../types';

export type VitalStatus = 'low' | 'high' | 'normal' | 'unknown';

export interface VitalCheck {
  status: VitalStatus;
  urgent: boolean; // severe range — flag-worthy
}

function range(
  v: number | undefined,
  low: number,
  high: number,
  severeLow?: number,
  severeHigh?: number,
): VitalCheck {
  if (v === undefined || Number.isNaN(v)) return { status: 'unknown', urgent: false };
  if (severeHigh !== undefined && v >= severeHigh) return { status: 'high', urgent: true };
  if (severeLow !== undefined && v <= severeLow) return { status: 'low', urgent: true };
  if (v < low) return { status: 'low', urgent: false };
  if (v > high) return { status: 'high', urgent: false };
  return { status: 'normal', urgent: false };
}

export function checkTemperature(v?: number): VitalCheck {
  return range(v, 36.0, 38.0, 35.0, 39.0);
}

export function checkHeartRate(v?: number): VitalCheck {
  return range(v, 50, 100, 45, 120);
}

export function checkRespiratoryRate(v?: number): VitalCheck {
  return range(v, 12, 20, 10, 24);
}

export function checkBloodPressure(
  systolic?: number,
  diastolic?: number,
): VitalCheck {
  if (systolic === undefined && diastolic === undefined) {
    return { status: 'unknown', urgent: false };
  }
  const sys = range(systolic, 90, 139, undefined, 160);
  const dia = range(diastolic, 60, 89, undefined, 100);
  if (sys.urgent || dia.urgent) return { status: 'high', urgent: true };
  if (sys.status === 'low' || dia.status === 'low') return { status: 'low', urgent: false };
  if (sys.status === 'high' || dia.status === 'high') return { status: 'high', urgent: false };
  return { status: 'normal', urgent: false };
}

/** True when any recorded vital is in a severe/flag-worthy range. */
export function hasUrgentVitals(v?: VitalSigns): boolean {
  if (!v) return false;
  return [
    checkTemperature(v.temperatureC),
    checkHeartRate(v.heartRate),
    checkRespiratoryRate(v.respiratoryRate),
    checkBloodPressure(v.bloodPressureSystolic, v.bloodPressureDiastolic),
  ].some((c) => c.urgent);
}