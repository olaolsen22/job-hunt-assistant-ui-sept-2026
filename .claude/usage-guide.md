# Claude usage guide

Read on demand when tuning Claude or investigating unexpected usage, not at session startup.

This personal project demonstrates effective AI-assisted development through idiomatic Nuxt
code, useful tests, usable features, and reviewable decisions. More agents or generated process
are not evidence of better AI use. Keep quality checks; remove duplicated exploration and work.

## Project defaults

- `.claude/settings.json` selects Sonnet and medium effort for routine coding. Choose a more
  capable model or higher effort for a specific difficult problem when warranted. Set these before
  starting when possible; repeated model switches can lose prompt-cache benefits.
- Advisors run inline unless explicitly delegated. All three custom agents use Sonnet and a
  ten-turn cap. A cap bounds a run, not total tokens; report partial findings instead of restarting
  automatically. Agent requests consume the same allowance as the main session.
- Run required checks once per coherent implementation batch. Preserve the explicit
  authorization requirement for E2E/live UI checks.

## When usage seems unusually high

1. In a fresh Claude session, use `/context` to inspect loaded instructions, tools, and skills.
   Use `/usage` for subscription allowance and `/model` to confirm the active model/effort.
   Project defaults can be overridden by local settings, flags, or managed settings;
   `/status` identifies the loaded settings sources.
2. Check for parallel sessions, active agents, repeated wide searches, noisy command output,
   repeated full-suite/build runs, and repeated compaction followed by re-exploration. These
   are possible contributors, not a diagnosis of the earlier limit without session evidence.
3. Use `/clear` between unrelated tasks after recording pending work. Continue related work
   with a focused summary; do not clear an active task automatically or discard authorization.
4. Keep `CLAUDE.md` concise. Load only relevant workflow instructions and file ranges; do not
   import this guide or the whole inventory into always-loaded context. Disable unused MCP
   servers only after checking whether they are needed.

A five-hour window is a resetting usage allowance, not five hours of guaranteed active coding.
These changes reduce avoidable work; they cannot guarantee how long the allowance will last.
Formatting/configuration checks do not prove future agent behavior or measured usage savings.

## Sources

- [Anthropic: Claude Code best practices](https://code.claude.com/docs/en/best-practices)
  — concise instructions, scoped exploration, and useful verification.
- [Anthropic: manage costs](https://code.claude.com/docs/en/costs)
  — context size, model choice, agent overhead, and clearing unrelated sessions.
- [Anthropic: custom subagents](https://code.claude.com/docs/en/sub-agents)
  — explicit model selection, restricted tools, and `maxTurns`.
- [Anthropic: settings precedence](https://code.claude.com/docs/en/settings)
  — project defaults, overrides, and inspecting loaded sources.
- [Nuxt: data fetching](https://nuxt.com/docs/4.x/getting-started/data-fetching)
  — SSR-aware fetching, hydration, and avoiding duplicate requests.
