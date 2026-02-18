from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any


class Emitter:
    def __init__(self) -> None:
        self._listeners: dict[str, list[Callable[..., Any]]] = {}
        self._lock = threading.Lock()

    def on(self, event: str, fn: Callable[..., Any]) -> Callable[[], None]:
        with self._lock:
            if event not in self._listeners:
                self._listeners[event] = []
            self._listeners[event].append(fn)

        def unsubscribe() -> None:
            with self._lock:
                listeners = self._listeners.get(event)
                if listeners and fn in listeners:
                    listeners.remove(fn)

        return unsubscribe

    def emit(self, event: str, payload: Any = None) -> None:
        with self._lock:
            listeners = list(self._listeners.get(event, []))
        for fn in listeners:
            if payload is None:
                fn()
            else:
                fn(payload)

    def remove_all(self) -> None:
        with self._lock:
            self._listeners.clear()
