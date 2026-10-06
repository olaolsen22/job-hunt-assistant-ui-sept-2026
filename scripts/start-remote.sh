#!/usr/bin/env bash
# Build the UI, (re)start the production preview server and expose it to the phone via Tailscale.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm build

# Kill after the build so the old server keeps serving while it runs.
# Fixed port: it must stay free for `tailscale serve 3000`.
pkill -f 'nuxt dev' || true
pkill -f 'nuxt preview' || true
sleep 1

nohup pnpm preview --port 3000 > /tmp/job-hunt-ui.log 2>&1 &

# systemd starts tailscaled with WSL, but it can still be starting when a boot hook runs this.
for _ in $(seq 30); do tailscale status > /dev/null 2>&1 && break; sleep 1; done
tailscale up
tailscale serve --bg 3000
