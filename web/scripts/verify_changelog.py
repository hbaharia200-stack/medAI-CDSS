#!/usr/bin/env python3
"""Verify device i18n changelog coverage: every devices.* key exists in both en and sw."""
import json
import sys
from pathlib import Path

WEB = Path("/home/salva-kil/MedAI/web")


def flat(d: dict, prefix: str = "") -> dict:
    out: dict = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flat(v, key))
        else:
            out[key] = v
    return out


def main() -> int:
    en = json.loads((WEB / "src/i18n/en.json").read_text())
    sw = json.loads((WEB / "src/i18n/sw.json").read_text())
    en_flat, sw_flat = flat(en), flat(sw)

    device_keys = sorted(k for k in en_flat if k.startswith("devices.") or k == "nav.devices")
    missing_sw = [k for k in device_keys if k not in sw_flat]
    empty = [k for k in device_keys if not str(en_flat.get(k, "")).strip()]
    missing_nav_en = "nav.devices" not in en_flat

    print(f"Device i18n keys in en: {len(device_keys)}")
    for k in device_keys:
        status = "MISSING-SW" if k in missing_sw else "ok"
        print(f"  [{status}] {k} = {en_flat[k]!r}  |  sw={sw_flat.get(k, '<absent>')!r}")
    if missing_nav_en:
        print("FAIL  nav.devices missing in en.json")
    if missing_sw:
        print(f"FAIL  {len(missing_sw)} keys missing in sw.json")
    if empty:
        print(f"FAIL  {len(empty)} keys empty in en.json")

    ok = not missing_nav_en and not missing_sw and not empty
    print(f"\n{'PASS' if ok else 'FAIL'}: changelog/i18n coverage")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
