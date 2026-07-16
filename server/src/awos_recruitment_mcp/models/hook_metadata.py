"""Pydantic models for validating HOOK.md front-matter metadata."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# The nine lifecycle events Claude Code exposes to hooks.
HookEvent = Literal[
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "Notification",
    "Stop",
    "SubagentStop",
    "PreCompact",
    "SessionStart",
    "SessionEnd",
]


class HookEntry(BaseModel):
    """A single event binding within a hook's ``hooks`` list.

    Attributes:
        event: The Claude Code lifecycle event this entry fires on. Must be
            one of the nine supported events.
        matcher: Optional tool-name matcher string (e.g. ``"Edit|Write"``).
            Omitted for events that do not use matchers.
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
