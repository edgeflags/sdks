from __future__ import annotations

from typing import Any, Literal, TypedDict

FlagValue = bool | str | int | float | dict[str, Any]


class EvaluationContext(TypedDict, total=False):
    user_id: str
    email: str
    phone: str
    plan: str
    segments: list[str]
    environment: str
    custom: dict[str, Any]


class EvaluationResponse(TypedDict):
    flags: dict[str, FlagValue]
    configs: dict[str, Any]


class FlagChange(TypedDict):
    key: str
    previous: FlagValue | None
    current: FlagValue


class ConfigChange(TypedDict):
    key: str
    previous: Any
    current: Any


class ChangeEvent(TypedDict):
    flags: list[FlagChange]
    configs: list[ConfigChange]


class Bootstrap(TypedDict, total=False):
    flags: dict[str, FlagValue]
    configs: dict[str, Any]


EdgeFlagsEvent = Literal["ready", "change", "error"]
