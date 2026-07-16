---
name: protect-env-files
description: Blocks Claude Code from editing or overwriting .env files and other environment secret files. Fires on PreToolUse for Edit and Write tools.
hooks:
  - event: PreToolUse
    matcher: Edit|Write
    timeout: 10
---

# protect-env-files

## What this hook does

This is a Claude Code `PreToolUse` hook that guards your environment secret
files. Before Claude Code runs an `Edit` or `Write` tool call, the hook
inspects the target file path. If the path points at an environment secrets
file — `.env` or any `.env.<suffix>` variant such as `.env.local` or
`.env.production` — the hook **blocks the tool call** (exit code `2`) and
reports the reason to Claude Code on stderr.

The example template `.env.example` is intentionally **allowed**, since it is
meant to be committed and edited freely.

## Why a team would want it

`.env` files typically hold API keys, database credentials, and other secrets.
Letting an agent rewrite them risks leaking secrets into diffs, clobbering
locally-configured values, or committing sensitive data. Installing this hook
enforces a team-wide guardrail: the agent simply cannot touch these files,
regardless of the prompt.

## How it works

Claude Code passes the tool-call payload to the hook on stdin as JSON. The
entrypoint extracts `tool_input.file_path`, takes its basename, and blocks when
the basename matches the `.env` patterns (but not `.env.example`). A block is
signalled with exit code `2` and a human-readable reason on stderr; any other
path results in exit code `0` (allow).

The entrypoint is a POSIX shell script and uses `python3` (always available on
developer machines) for dependency-light JSON parsing.

## Manual injection instructions

The CLI installer normally merges this configuration into your project's
`.claude/settings.json` for you. To wire it up **manually**, add the following
fragment to `.claude/settings.json` (merging into any existing `hooks` block):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-env-files/protect-env-files.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

The `command` is always the derived entrypoint path
`$CLAUDE_PROJECT_DIR/.claude/hooks/<name>/<name>.sh` — `$CLAUDE_PROJECT_DIR` is
a literal string that Claude Code expands at runtime. Ensure the installed
`protect-env-files.sh` retains its executable bit.
