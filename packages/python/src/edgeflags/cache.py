from __future__ import annotations

import threading
from typing import Any

from .types import ChangeEvent, ConfigChange, FlagChange, FlagValue


def _deep_equal(a: object, b: object) -> bool:
    if a is b:
        return True
    if a is None or b is None:
        return a is b
    if type(a) is not type(b):
        return False
    if isinstance(a, dict) and isinstance(b, dict):
        if len(a) != len(b):
            return False
        return all(key in b and _deep_equal(a[key], b[key]) for key in a)
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(_deep_equal(x, y) for x, y in zip(a, b, strict=True))
    return a == b


class Cache:
    def __init__(self) -> None:
        self._flags: dict[str, FlagValue] = {}
        self._configs: dict[str, Any] = {}
        self._lock = threading.Lock()

    def get_flag(self, key: str) -> FlagValue | None:
        with self._lock:
            return self._flags.get(key)

    def get_config(self, key: str) -> Any | None:
        with self._lock:
            return self._configs.get(key)

    def all_flags(self) -> dict[str, FlagValue]:
        with self._lock:
            return dict(self._flags)

    def all_configs(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._configs)

    def update(
        self,
        flags: dict[str, FlagValue],
        configs: dict[str, Any],
    ) -> ChangeEvent | None:
        with self._lock:
            flag_changes: list[FlagChange] = []
            config_changes: list[ConfigChange] = []

            for key, current in flags.items():
                previous = self._flags.get(key)
                if not _deep_equal(previous, current):
                    flag_changes.append(FlagChange(key=key, previous=previous, current=current))
                self._flags[key] = current

            for key, current in configs.items():
                previous = self._configs.get(key)
                if not _deep_equal(previous, current):
                    config_changes.append(
                        ConfigChange(key=key, previous=previous, current=current)
                    )
                self._configs[key] = current

            if not flag_changes and not config_changes:
                return None
            return ChangeEvent(flags=flag_changes, configs=config_changes)

    def seed(
        self,
        flags: dict[str, FlagValue],
        configs: dict[str, Any],
    ) -> None:
        with self._lock:
            self._flags.update(flags)
            self._configs.update(configs)

    def clear(self) -> None:
        with self._lock:
            self._flags.clear()
            self._configs.clear()
