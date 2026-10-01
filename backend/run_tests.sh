#!/usr/bin/env bash
# Run the backend test suite (in-memory SQLite; no external services needed).
set -euo pipefail
cd "$(dirname "$0")"
export FLASK_ENV=testing
python3 -m pytest "$@"
