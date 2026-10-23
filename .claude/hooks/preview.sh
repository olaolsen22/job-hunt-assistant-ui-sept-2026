#!/usr/bin/env bash
# Stop hook: rebuild and restart `nuxt preview` on :3000 (the `tailscale serve` target) when app
# sources changed since the last successful build. This replaces `nuxt dev`.
# Runs detached (setsid) so the server outlives Claude's shell.
set -u

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state="$root/.claude/state/preview"
port="${PREVIEW_PORT:-3000}"
mkdir -p "$state"
cd "$root" || exit 0

# Hooks inherit Claude's environment, which may not have run .bashrc (where nvm adds node/pnpm).
if ! command -v pnpm >/dev/null; then
  export NVM_DIR="$HOME/.nvm"
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
  export PATH="$HOME/.local/share/pnpm:$PATH"
fi

input="$(cat)"
# A failed build already blocked once this turn; don't loop on the same failure.
retrying=false
[[ "$input" == *'"stop_hook_active":true'* || "$input" == *'"stop_hook_active": true'* ]] && retrying=true

running() { [[ -f "$state/pid" ]] && kill -0 "$(cat "$state/pid")" 2>/dev/null; }

existing=()
for s in app public server shared nuxt.config.ts app.config.ts package.json; do
  [[ -e "$s" ]] && existing+=("$s")
done

changed=true
if [[ -f "$state/stamp" && -z "$(find "${existing[@]}" -newer "$state/stamp" -print -quit 2>/dev/null)" ]]; then
  changed=false
fi

if ! $changed && running; then exit 0; fi

if $changed; then
  touch "$state/build-start"
  if ! pnpm build >"$state/build.log" 2>&1; then
    if $retrying; then
      echo "Preview build still failing; see .claude/state/preview/build.log" >&2
      exit 0
    fi
    { echo "pnpm build failed (preview not restarted):"; tail -n 40 "$state/build.log"; } >&2
    exit 2
  fi
  mv "$state/build-start" "$state/stamp"
fi

# setsid gives the server its own process group, so the whole group can be stopped by PID.
if running; then
  kill -- "-$(cat "$state/pid")" 2>/dev/null
  sleep 1
fi
PORT="$port" setsid nohup pnpm preview >"$state/server.log" 2>&1 </dev/null &
echo $! >"$state/pid"

echo "Preview rebuilt and serving on http://localhost:$port" >&2
exit 0
