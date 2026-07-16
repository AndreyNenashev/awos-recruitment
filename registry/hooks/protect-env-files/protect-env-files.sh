#!/bin/sh
# protect-env-files.sh — Claude Code PreToolUse hook entrypoint.
#
# Blocks Edit/Write tool calls that target environment secret files
# (.env, .env.local, .env.production, ...) while allowing .env.example.
#
# Claude Code passes the tool-call payload as JSON on stdin. This script
# extracts tool_input.file_path, and if its basename matches the protected
# .env patterns it exits with code 2 (block) and prints a reason to stderr.
# Any other path exits 0 (allow).
#
# python3 is used for dependency-light, portable JSON parsing.

set -eu

input=$(cat)

file_path=$(printf '%s' "$input" | python3 -c '
import json
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    sys.exit(0)

tool_input = data.get("tool_input") or {}
print(tool_input.get("file_path") or "")
')

# No target path — nothing to guard.
if [ -z "$file_path" ]; then
    exit 0
fi

base=$(basename "$file_path")

case "$base" in
    .env.example)
        # Template file is safe to edit.
        exit 0
        ;;
    .env | .env.*)
        echo "protect-env-files: blocked editing environment secret file '$file_path'." >&2
        echo "Environment secret files are protected by the protect-env-files hook. Edit them manually if truly required." >&2
        exit 2
        ;;
esac

exit 0
