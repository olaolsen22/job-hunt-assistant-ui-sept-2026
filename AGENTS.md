# Codex instructions

Read `CLAUDE.md` for the shared project rules; do not duplicate them here.
Both tools use `.claude/state/` for local session notes.

Codex skills are in `.agents/skills/`. Use the UI advisor skills inline, with the
same selection criteria as the shared rules. Host permissions remain authoritative;
Claude settings are not automatically enforced by Codex.

| Claude command  | Codex skill                |
| --------------- | -------------------------- |
| `/opsx:explore` | `$openspec-explore`        |
| `/opsx:propose` | `$openspec-propose`        |
| `/opsx:update`  | `$openspec-update-change`  |
| `/opsx:apply`   | `$openspec-apply-change`   |
| `/opsx:sync`    | `$openspec-sync-specs`     |
| `/opsx:archive` | `$openspec-archive-change` |
| `/log-progress` | `$log-progress`            |

Natural-language `opsx <action> <change>` requests also select the matching skill.
Use the existing `openspec/` project. Load only the selected workflow and its needed
references; respect planning/implementation boundaries and existing authorization.
