# Purpose

Hook definitions distributed via the AWOS registry — installed into user projects as `.claude/hooks/<name>/` plus a derived entry in `.claude/settings.json`.

# Non-Obvious Context

- The triple identity rule: front matter `name` == directory name == entrypoint filename `<name>.sh`. The injected command is always derived from the name — a `command` field in front matter is forbidden by design (settled decision; no sidecar yaml/json config either).
- Entrypoints must be pure POSIX sh (+ git/grep/sed at most). Never python or node — hooks install into arbitrary user projects and must add zero runtime dependencies.
- Exit-code contract: `2` blocks the tool call and feeds stderr back to the model — that stderr text is the *only* channel to steer the agent (hooks cannot invoke skills; write the message as imperative instructions). `0` allows. Fail open (`exit 0`) on anything unexpected — malformed stdin, missing git, wrong environment.
- The executable bit is part of the artifact: git tracks the file mode, and validation, bundling, and install all depend on it. A `Write`-created script needs `chmod +x` before committing.
- Hook names are load-bearing outside this directory: real-registry tests (`server/tests/test_search_tool.py`, `test_bundle.py`), `README.md`, and spec 008 reference hooks by name. Renaming a hook is a repo-wide change, not a directory rename.
- `description` is the semantic-search surface — keep the trigger phrases users would type ("block", "commit", "docs", event names) in it.
- Every hook script gets a behavior test suite at `server/tests/test_<name>_hook.py` executing the real script via subprocess; scenario setup (e.g. scratch git repos) lives there, not in the hook directory.
