from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable


class AsyncPoller:
    def __init__(
        self,
        interval_seconds: float,
        task: Callable[[], object],
        on_error: Callable[[Exception], None],
    ) -> None:
        self._interval = interval_seconds
        self._task = task
        self._on_error = on_error
        self._async_task: asyncio.Task[None] | None = None

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(self._interval)
            try:
                result = self._task()
                if asyncio.iscoroutine(result):
                    await result
            except Exception as exc:
                self._on_error(exc)

    def start(self) -> None:
        if self._async_task is not None:
            return
        self._async_task = asyncio.get_event_loop().create_task(self._loop())

    def stop(self) -> None:
        if self._async_task is not None:
            self._async_task.cancel()
            self._async_task = None

    @property
    def running(self) -> bool:
        return self._async_task is not None and not self._async_task.done()


class SyncPoller:
    def __init__(
        self,
        interval_seconds: float,
        task: Callable[[], object],
        on_error: Callable[[Exception], None],
    ) -> None:
        self._interval = interval_seconds
        self._task = task
        self._on_error = on_error
        self._timer: threading.Timer | None = None
        self._running = False

    def _tick(self) -> None:
        if not self._running:
            return
        try:
            self._task()
        except Exception as exc:
            self._on_error(exc)
        if self._running:
            self._timer = threading.Timer(self._interval, self._tick)
            self._timer.daemon = True
            self._timer.start()

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._timer = threading.Timer(self._interval, self._tick)
        self._timer.daemon = True
        self._timer.start()

    def stop(self) -> None:
        self._running = False
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    @property
    def running(self) -> bool:
        return self._running
