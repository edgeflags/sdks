import asyncio
import threading
import time

from edgeflags.poller import AsyncPoller, SyncPoller


class TestAsyncPoller:
    async def test_executes_task(self) -> None:
        count = 0

        async def task() -> None:
            nonlocal count
            count += 1

        poller = AsyncPoller(0.05, task, lambda e: None)
        poller.start()
        await asyncio.sleep(0.15)
        poller.stop()

        assert count >= 2

    async def test_calls_on_error(self) -> None:
        errors: list[Exception] = []

        async def failing_task() -> None:
            raise RuntimeError("boom")

        poller = AsyncPoller(0.05, failing_task, lambda e: errors.append(e))
        poller.start()
        await asyncio.sleep(0.15)
        poller.stop()

        assert len(errors) >= 1
        assert "boom" in str(errors[0])

    async def test_idempotent_start(self) -> None:
        count = 0

        async def task() -> None:
            nonlocal count
            count += 1

        poller = AsyncPoller(0.05, task, lambda e: None)
        poller.start()
        poller.start()  # second call should be no-op
        await asyncio.sleep(0.15)
        poller.stop()

        assert count >= 2

    async def test_idempotent_stop(self) -> None:
        poller = AsyncPoller(1.0, lambda: None, lambda e: None)
        poller.stop()  # should not raise
        poller.stop()

    async def test_running_property(self) -> None:
        poller = AsyncPoller(1.0, lambda: None, lambda e: None)
        assert not poller.running
        poller.start()
        assert poller.running
        poller.stop()


class TestSyncPoller:
    def test_executes_task(self) -> None:
        count = 0
        lock = threading.Lock()

        def task() -> None:
            nonlocal count
            with lock:
                count += 1

        poller = SyncPoller(0.05, task, lambda e: None)
        poller.start()
        time.sleep(0.2)
        poller.stop()

        with lock:
            assert count >= 2

    def test_calls_on_error(self) -> None:
        errors: list[Exception] = []
        lock = threading.Lock()

        def failing_task() -> None:
            raise RuntimeError("sync boom")

        def on_error(e: Exception) -> None:
            with lock:
                errors.append(e)

        poller = SyncPoller(0.05, failing_task, on_error)
        poller.start()
        time.sleep(0.2)
        poller.stop()

        with lock:
            assert len(errors) >= 1
            assert "sync boom" in str(errors[0])

    def test_idempotent_start_stop(self) -> None:
        poller = SyncPoller(1.0, lambda: None, lambda e: None)
        poller.start()
        poller.start()  # no-op
        poller.stop()
        poller.stop()  # no-op

    def test_running_property(self) -> None:
        poller = SyncPoller(1.0, lambda: None, lambda e: None)
        assert not poller.running
        poller.start()
        assert poller.running
        poller.stop()
        assert not poller.running
