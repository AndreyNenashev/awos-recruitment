"""Pydantic models for validating HOOK.md front-matter metadata."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# The lifecycle events Claude Code exposes to hooks, per
# https://code.claude.com/docs/en/hooks (last synced 2026-07-20). Keep this
# list, cli/src/lib/types.ts HOOK_EVENTS, and registry/hooks/README.md in
# sync when the reference page changes.
HookEvent = Literal[
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PostToolBatch",
    "PermissionRequest",
    "PermissionDenied",
    "UserPromptSubmit",
    "UserPromptExpansion",
    "Notification",
    "MessageDisplay",
    "Stop",
    "StopFailure",
    "SubagentStart",
    "SubagentStop",
    "TaskCreated",
    "TaskCompleted",
    "TeammateIdle",
    "InstructionsLoaded",
    "ConfigChange",
    "CwdChanged",
    "FileChanged",
    "WorktreeCreate",
    "WorktreeRemove",
    "PreCompact",
    "PostCompact",
    "SessionStart",
    "SessionEnd",
    "Setup",
    "Elicitation",
    "ElicitationResult",
]


class HookEntry(BaseModel):
    """A single event binding within a hook's ``hooks`` list.

    Attributes:
        event: The Claude Code lifecycle event this entry fires on. Must be
            one of the documented Claude Code hook events.
        matcher: Optional tool-name matcher. Claude Code treats a value made
            only of letters, digits, ``_``, ``-``, spaces, ``,`` and ``|`` as
            an exact name or ``|``/``,``-separated list (``"Edit|Write"``);
            any other character makes it an UNANCHORED JavaScript regex.
            Omitted for events that do not use matchers (Claude Code silently
            ignores a matcher on such events).
        timeout: Optional per-command timeout in seconds; must be positive.
    """

    model_config = ConfigDict(extra="forbid")

    event: HookEvent
    matcher: str | None = Field(None)
    timeout: int | None = Field(None, gt=0)


class HookMetadata(BaseModel):
    """Validated representation of the YAML front matter in a HOOK.md file.

    Attributes:
        name: Kebab-case identifier for the hook (1-64 chars, lowercase
              alphanumeric and hyphens only).
        description: Human-readable description of what the hook does and when
            it fires.
        hooks: Non-empty list of event bindings for this hook.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., pattern=r"^[a-z0-9-]{1,64}$")
    description: str = Field(..., min_length=1)
    hooks: list[HookEntry] = Field(..., min_length=1)
