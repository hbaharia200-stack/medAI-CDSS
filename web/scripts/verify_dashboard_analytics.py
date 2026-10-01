#!/usr/bin/env python3
"""Verify device dashboard analytics wiring (Recharts + theme tokens + i18n + service layer)."""
import json
import re
import sys
from pathlib import Path

WEB = Path("/home/salva-kil/MedAI/web")

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, ok, detail))


def main() -> int:
    en = json.loads((WEB / "src/i18n/en.json").read_text())
    sw = json.loads((WEB / "src/i18n/sw.json").read_text())

    # 1. i18n keys
    for key in ["devices", "analyticsTitle", "statusDistribution", "departmentDistribution",
                "maintenanceTrendTitle", "maintenanceCount", "deviceCount",
                "statusOperational", "statusDamaged", "statusUnderMaintenance",
                "statusOffline", "statusRetired", "registerDevice", "inspectDevice"]:
        present = key == "devices" or key in en.get("devices", {})
        check(f"i18n en devices.{key}" if key != "devices" else "i18n en devices section",
              key == "devices" and "devices" in en or key in en.get("devices", {}), "")
    check("i18n en nav.devices", en.get("nav", {}).get("devices") == "Devices", "")
    check("i18n sw nav.devices", sw.get("nav", {}).get("devices") == "Vifaa", "")
    check("i18n sw devices section", "devices" in sw, "")

    # 2. Analytics component uses Recharts + theme tokens + Card + i18n
    charts = (WEB / "src/components/devices/DeviceAnalyticsCharts.tsx").read_text()
    for token in ["BarChart", "LineChart", "PieChart", "ResponsiveContainer", "Tooltip", "Legend",
                  "CHART_COLORS", "chartAxisTick", "ChartTooltip", "var(--color-primary)",
                  "var(--color-line)", "var(--color-ink-muted)", "t('devices.analyticsTitle')",
                  "t('devices.statusDistribution')", "t('devices.departmentDistribution')",
                  "t('devices.maintenanceTrendTitle')", "DeviceStatistics"]:
        check(f"DeviceAnalyticsCharts contains {token}", token in charts, "")

    # 3. Service layer statistics shape
    svc = (WEB / "src/services/deviceService.ts").read_text()
    for token in ["getDeviceStatistics", "byDepartment", "byCategory", "maintenanceTrend",
                  "operational", "damaged", "underMaintenance", "offline", "retired"]:
        check(f"deviceService contains {token}", token in svc, "")

    # 4. DevicesPage renders analytics + summary + grid + damaged section + register modal
    page = (WEB / "src/pages/devices/DevicesPage.tsx").read_text()
    for token in ["DeviceAnalyticsCharts", "DeviceSummaryCards", "DeviceGrid",
                  "DamagedDevicesSection", "DeviceRegistrationForm", "getDeviceStatistics"]:
        check(f"DevicesPage renders {token}", token in page, "")

    # 5. Router + sidebar nav
    router = (WEB / "src/router.tsx").read_text()
    check("router /app/devices route", 'path="devices"' in router, "")
    check("router /app/devices/:deviceId route", 'devices/:deviceId' in router, "")
    layout = (WEB / "src/components/layout/AppLayout.tsx").read_text()
    check("sidebar nav devices entry", "nav.devices" in layout and "/app/devices" in layout, "")

    failed = [c for c in CHECKS if not c[1]]
    for name, ok, detail in CHECKS:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} checks passed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
