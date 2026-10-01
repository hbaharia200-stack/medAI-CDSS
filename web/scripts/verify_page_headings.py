#!/usr/bin/env python3
"""Verify every /app page heading follows the <h1> + subtitle-typewriter convention."""
import re
import sys
from pathlib import Path

WEB = Path("/home/salva-kil/MedAI/web")

EXPECTED = {
    "src/pages/doctor/BasicDashboard.tsx": "nav.basicDashboard",
    "src/pages/doctor/PatientsDashboard.tsx": "nav.patientsDashboard",
    "src/pages/doctor/DiagnosisDashboard.tsx": "nav.diagnosisDashboard",
    "src/pages/doctor/AppointmentDashboard.tsx": "appointments.title",
    "src/pages/devices/DevicesPage.tsx": "nav.devices",
    "src/pages/devices/DeviceDetailsPage.tsx": "device.name",
    "src/pages/StatisticsPage.tsx": "nav.statistics",
    "src/pages/SchedulePage.tsx": "nav.schedule",
    "src/pages/messages/MessagesPage.tsx": "nav.messages",
    "src/pages/BillingsPage.tsx": "nav.billings",
    "src/pages/SettingsPage.tsx": "nav.settings",
}

H1 = re.compile(r"<h1[^>]*>")
SUBTITLE = "subtitle-typewriter"


def main() -> int:
    failures: list[str] = []
    for rel, key in EXPECTED.items():
        path = WEB / rel
        if not path.exists():
            failures.append(f"MISSING FILE {rel}")
            print(f"FAIL  {rel}: file not found")
            continue
        text = path.read_text()
        has_h1 = bool(H1.search(text))
        has_sub = SUBTITLE in text
        ok = has_h1 and has_sub
        print(f"{'PASS' if ok else 'FAIL'}  {rel}  (h1={has_h1}, subtitle={has_sub}, key~{key})")
        if not ok:
            failures.append(rel)
    print(f"\n{len(EXPECTED) - len(failures)}/{len(EXPECTED)} page headings OK.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
