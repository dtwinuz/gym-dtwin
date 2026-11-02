#!/usr/bin/env bash
# Runs on the VPS from /opt/gym-dtwin/api. Writes a verified VACUUM INTO copy to ./backups.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
docker compose run --rm --no-deps -T -v "$PWD/backups:/backups" gym-dtwin-api \
  node --disable-warning=ExperimentalWarning src/backup.js /backups
