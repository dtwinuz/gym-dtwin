#!/usr/bin/env bash
# Copies the API to the VPS and builds the image. Starts it only with --start.
# Usage: deploy/api/install.sh [ssh-host] [--start]
set -euo pipefail
HOST="${1:-dtwin}"
START="${2:-}"
REMOTE=/opt/gym-dtwin/api
cd "$(dirname "$0")/../.."

ssh "$HOST" "mkdir -p $REMOTE/server $REMOTE/data $REMOTE/backups"
tar -cf - server/package.json server/Dockerfile server/src | ssh "$HOST" "rm -rf $REMOTE/server/src && tar -xf - -C $REMOTE"
scp -q deploy/api/docker-compose.example.yml "$HOST:$REMOTE/docker-compose.yml"
scp -q deploy/api/backup.sh "$HOST:$REMOTE/backup.sh"

ssh "$HOST" REMOTE="$REMOTE" START="$START" 'bash -s' <<'REMOTE_EOF'
set -euo pipefail
cd "$REMOTE"
chmod +x backup.sh
chown -R 1000:1000 data backups
chmod 700 data backups
if [ ! -f .env ]; then echo "missing $REMOTE/.env" >&2; exit 1; fi
chmod 600 .env
SERVER_DIR=./server docker compose build -q
if [ "$START" = "--start" ]; then SERVER_DIR=./server docker compose up -d; fi
docker compose ps -a
REMOTE_EOF
