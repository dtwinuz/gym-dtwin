#!/usr/bin/env bash
# Builds the app and publishes it to the dtwin VPS (https://gym.dtwin.uz).
# Usage: deploy/deploy.sh [ssh-host]
set -euo pipefail

HOST="${1:-dtwin}"
REMOTE=/opt/gym-dtwin
cd "$(dirname "$0")/.."

npm run build
REVISION="$(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo -dirty)"
echo "$REVISION" > dist/REVISION

ssh "$HOST" "mkdir -p $REMOTE/dist && rm -rf $REMOTE/dist.new && mkdir -p $REMOTE/dist.new"
OLD_CADDY="$(ssh "$HOST" "sha256sum $REMOTE/Caddyfile 2>/dev/null | cut -d' ' -f1" || true)"
scp -q deploy/docker-compose.yml deploy/Caddyfile "$HOST:$REMOTE/"
tar -C dist -cf - . | ssh "$HOST" "tar -xf - -C $REMOTE/dist.new"

# swap contents in place (the bind mount keeps the directory inode)
ssh "$HOST" REMOTE="$REMOTE" OLD_CADDY="$OLD_CADDY" 'bash -s' <<'EOF'
set -euo pipefail
cd "$REMOTE"
rm -rf dist.prev && cp -a dist dist.prev
rsync -a --delete dist.new/ dist/ && rm -rf dist.new
chmod -R a+rX dist
docker compose up -d --remove-orphans
# Caddy does not watch its config; restart when the Caddyfile changed so new headers and routes apply
if [ "$(sha256sum Caddyfile | cut -d' ' -f1)" != "$OLD_CADDY" ]; then
  echo "Caddyfile changed, restarting gym-dtwin"
  docker compose restart gym-dtwin
fi
docker compose ps
EOF
echo "deployed $REVISION"
