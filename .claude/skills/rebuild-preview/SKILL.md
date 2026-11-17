---
name: rebuild-preview
description: Stop the running preview, run `pnpm build`, and restart `pnpm preview` detached on port 3000. Use after finishing any code change in this repo (AGENTS.md requires it), and before taking screenshots.
---

Run from the repo root:

```bash
bash .claude/skills/rebuild-preview/restart.sh
```

It only stops `pnpm preview` processes whose working directory is this repo (whole process group,
no `pkill`), builds, starts preview with `setsid nohup` so it survives the session, and waits until
port 3000 answers. Build output goes to `/tmp/job-hunt-ui-build.log`, preview output to
`/tmp/job-hunt-ui-preview.log`.

- Build fails → the old preview is already stopped; fix the error and rerun. Report the failure.
- Never run `pnpm preview` or `pnpm dev` as a foreground or Bash-background command: those are
  killed when the command or session ends.
- Changes that only touch docs, tests or `.claude/` don't need a rebuild.
