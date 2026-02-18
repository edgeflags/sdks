from __future__ import annotations

import logging

_log = logging.getLogger("edgeflags")


class Logger:
    def __init__(self, enabled: bool) -> None:
        self._enabled = enabled

    def debug(self, message: str, *args: object) -> None:
        if self._enabled:
            _log.debug("[EdgeFlags] %s", message, *args)

    def warn(self, message: str, *args: object) -> None:
        if self._enabled:
            _log.warning("[EdgeFlags] %s", message, *args)

    def error(self, message: str, *args: object) -> None:
        if self._enabled:
            _log.error("[EdgeFlags] %s", message, *args)
