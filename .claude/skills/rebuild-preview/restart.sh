#!/usr/bin/env bash
# Stops this repo's running `pnpm preview`, builds, and starts preview detached so it outlives the
# session. Only kills process groups whose leader is `pnpm preview` started in this repo.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
log=/tmp/job-hunt-ui-preview.log
cd "$repo"

for pid in $(pgrep -f '^pnpm preview$' || true); do
  if [ "$(readlink "/proc/$pid/cwd")" = "$repo" ]; then
    echo "Stopping preview (process group $pid)"
    kill -- "-$(ps -o pgid= -p "$pid" | tr -d ' ')" || true
  fi
done

pnpm build > /tmp/job-hunt-ui-build.log 2>&1 || {
  echo "Build failed (preview not restarted). Last lines:"
  tail -30 /tmp/job-hunt-ui-build.log
  exit 1
}

setsid nohup pnpm preview > "$log" 2>&1 < /dev/null &
for _ in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/; then
    echo "Preview running on http://localhost:3000 (log: $log)"
    exit 0
  fi
  sleep 1
done
echo "Preview did not answer on :3000 within 30s. Log:"
tail -20 "$log"
exit 1
