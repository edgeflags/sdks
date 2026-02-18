from __future__ import annotations

from collections.abc import Callable
from typing import Any, overload

from .cache import Cache
from .emitter import Emitter
from .fetcher import AsyncFetcher, SyncFetcher
from .logger import Logger
from .poller import AsyncPoller, SyncPoller
from .types import (
    Bootstrap,
    EdgeFlagsEvent,
    EvaluationContext,
    FlagValue,
)

_DEFAULT_POLL_INTERVAL = 60.0


class EdgeFlags:
    """Async EdgeFlags client. Call ``await init()`` after construction."""

    def __init__(
        self,
        token: str,
        base_url: str,
        *,
        context: EvaluationContext | None = None,
        polling_interval: float = _DEFAULT_POLL_INTERVAL,
        transport: str = "polling",
        bootstrap: Bootstrap | None = None,
        debug: bool = False,
        _mock: dict[str, Any] | None = None,
    ) -> None:
        self._cache = Cache()
        self._emitter = Emitter()
        self._logger = Logger(debug)
        self._context: EvaluationContext = context or {}
        self._polling_interval = polling_interval
        self._transport = transport
        self._ready = False
        self._mock = _mock
        self._fetcher: AsyncFetcher | None = None
        self._poller: AsyncPoller | None = None

        if _mock is not None:
            self._cache.seed(_mock.get("flags", {}), _mock.get("configs", {}))
            self._ready = True
            self._logger.debug("Mock client created")
        else:
            self._fetcher = AsyncFetcher(base_url, token)
            if bootstrap:
                self._cache.seed(bootstrap.get("flags", {}), bootstrap.get("configs", {}))
                self._logger.debug("Bootstrap data loaded")

    async def init(self) -> None:
        if self._mock is not None:
            self._emitter.emit("ready")
            return

        assert self._fetcher is not None
        try:
            data = await self._fetcher.fetch_all(self._context)
            self._cache.seed(data["flags"], data["configs"])
            self._ready = True
            self._logger.debug("Initialized")
            self._emitter.emit("ready")

            self._poller = AsyncPoller(
                self._polling_interval,
                self.refresh,
                self._on_poll_error,
            )
            self._poller.start()
            self._logger.debug(f"Polling started ({self._polling_interval}s)")
        except Exception as exc:
            error = exc if isinstance(exc, Exception) else Exception(str(exc))
            self._logger.error("Init failed", error)
            self._emitter.emit("error", error)

            if self._cache.all_flags():
                self._ready = True
                self._logger.warn("Using bootstrap data after init failure")
                self._emitter.emit("ready")
            else:
                raise

    def _on_poll_error(self, exc: Exception) -> None:
        self._logger.error("Polling error", exc)
        self._emitter.emit("error", exc)

    @overload
    def flag(self, key: str) -> FlagValue | None: ...
    @overload
    def flag(self, key: str, default: FlagValue) -> FlagValue: ...

    def flag(self, key: str, default: FlagValue | None = None) -> FlagValue | None:
        value = self._cache.get_flag(key)
        return default if value is None else value

    @overload
    def config(self, key: str) -> Any | None: ...
    @overload
    def config(self, key: str, default: Any) -> Any: ...

    def config(self, key: str, default: Any = None) -> Any:
        value = self._cache.get_config(key)
        return default if value is None else value

    def all_flags(self) -> dict[str, FlagValue]:
        return self._cache.all_flags()

    def all_configs(self) -> dict[str, Any]:
        return self._cache.all_configs()

    async def identify(self, context: EvaluationContext) -> None:
        self._context = context
        self._logger.debug("Context updated")
        if self._ready and self._fetcher:
            await self.refresh()

    async def refresh(self) -> None:
        if not self._fetcher:
            return
        self._logger.debug("Fetching evaluations")
        data = await self._fetcher.fetch_all(self._context)
        changes = self._cache.update(data["flags"], data["configs"])
        if changes:
            self._logger.debug("Changes detected")
            self._emitter.emit("change", changes)

    def on(self, event: EdgeFlagsEvent, fn: Callable[..., Any]) -> Callable[[], None]:
        return self._emitter.on(event, fn)

    @property
    def is_ready(self) -> bool:
        return self._ready

    def destroy(self) -> None:
        if self._poller:
            self._poller.stop()
            self._poller = None
        self._cache.clear()
        self._emitter.remove_all()
        self._ready = False
        self._logger.debug("Destroyed")

    async def aclose(self) -> None:
        self.destroy()
        if self._fetcher:
            await self._fetcher.close()
            self._fetcher = None


class EdgeFlagsSync:
    """Synchronous EdgeFlags client. Call ``init()`` after construction."""

    def __init__(
        self,
        token: str,
        base_url: str,
        *,
        context: EvaluationContext | None = None,
        polling_interval: float = _DEFAULT_POLL_INTERVAL,
        transport: str = "polling",
        bootstrap: Bootstrap | None = None,
        debug: bool = False,
        _mock: dict[str, Any] | None = None,
    ) -> None:
        self._cache = Cache()
        self._emitter = Emitter()
        self._logger = Logger(debug)
        self._context: EvaluationContext = context or {}
        self._polling_interval = polling_interval
        self._transport = transport
        self._ready = False
        self._mock = _mock
        self._fetcher: SyncFetcher | None = None
        self._poller: SyncPoller | None = None

        if _mock is not None:
            self._cache.seed(_mock.get("flags", {}), _mock.get("configs", {}))
            self._ready = True
            self._logger.debug("Mock client created")
        else:
            self._fetcher = SyncFetcher(base_url, token)
            if bootstrap:
                self._cache.seed(bootstrap.get("flags", {}), bootstrap.get("configs", {}))
                self._logger.debug("Bootstrap data loaded")

    def init(self) -> None:
        if self._mock is not None:
            self._emitter.emit("ready")
            return

        assert self._fetcher is not None
        try:
            data = self._fetcher.fetch_all(self._context)
            self._cache.seed(data["flags"], data["configs"])
            self._ready = True
            self._logger.debug("Initialized")
            self._emitter.emit("ready")

            self._poller = SyncPoller(
                self._polling_interval,
                self.refresh,
                self._on_poll_error,
            )
            self._poller.start()
            self._logger.debug(f"Polling started ({self._polling_interval}s)")
        except Exception as exc:
            error = exc if isinstance(exc, Exception) else Exception(str(exc))
            self._logger.error("Init failed", error)
            self._emitter.emit("error", error)

            if self._cache.all_flags():
                self._ready = True
                self._logger.warn("Using bootstrap data after init failure")
                self._emitter.emit("ready")
            else:
                raise

    def _on_poll_error(self, exc: Exception) -> None:
        self._logger.error("Polling error", exc)
        self._emitter.emit("error", exc)

    @overload
    def flag(self, key: str) -> FlagValue | None: ...
    @overload
    def flag(self, key: str, default: FlagValue) -> FlagValue: ...

    def flag(self, key: str, default: FlagValue | None = None) -> FlagValue | None:
        value = self._cache.get_flag(key)
        return default if value is None else value

    @overload
    def config(self, key: str) -> Any | None: ...
    @overload
    def config(self, key: str, default: Any) -> Any: ...

    def config(self, key: str, default: Any = None) -> Any:
        value = self._cache.get_config(key)
        return default if value is None else value

    def all_flags(self) -> dict[str, FlagValue]:
        return self._cache.all_flags()

    def all_configs(self) -> dict[str, Any]:
        return self._cache.all_configs()

    def identify(self, context: EvaluationContext) -> None:
        self._context = context
        self._logger.debug("Context updated")
        if self._ready and self._fetcher:
            self.refresh()

    def refresh(self) -> None:
        if not self._fetcher:
            return
        self._logger.debug("Fetching evaluations")
        data = self._fetcher.fetch_all(self._context)
        changes = self._cache.update(data["flags"], data["configs"])
        if changes:
            self._logger.debug("Changes detected")
            self._emitter.emit("change", changes)

    def on(self, event: EdgeFlagsEvent, fn: Callable[..., Any]) -> Callable[[], None]:
        return self._emitter.on(event, fn)

    @property
    def is_ready(self) -> bool:
        return self._ready

    def destroy(self) -> None:
        if self._poller:
            self._poller.stop()
            self._poller = None
        if self._fetcher:
            self._fetcher.close()
            self._fetcher = None
        self._cache.clear()
        self._emitter.remove_all()
        self._ready = False
        self._logger.debug("Destroyed")
