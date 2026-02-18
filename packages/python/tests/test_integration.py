from pytest_httpx import HTTPXMock

from edgeflags.client import EdgeFlags, EdgeFlagsSync

INITIAL = {"flags": {"dark_mode": True}, "configs": {"theme": "blue"}}
UPDATED = {"flags": {"dark_mode": False}, "configs": {"theme": "red"}}
IDENTIFIED = {"flags": {"dark_mode": True}, "configs": {"theme": "green"}}


class TestAsyncLifecycle:
    async def test_full_lifecycle(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=INITIAL)

        events: list[str] = []
        client = EdgeFlags("tok", "http://localhost", polling_interval=60)
        client.on("ready", lambda: events.append("ready"))
        client.on("change", lambda _: events.append("change"))

        await client.init()
        assert events == ["ready"]
        assert client.flag("dark_mode") is True
        assert client.config("theme") == "blue"

        httpx_mock.add_response(json=UPDATED)
        await client.refresh()
        assert events == ["ready", "change"]
        assert client.flag("dark_mode") is False
        assert client.config("theme") == "red"

        httpx_mock.add_response(json=IDENTIFIED)
        await client.identify({"user_id": "user-1"})
        assert client.config("theme") == "green"

        client.destroy()
        assert not client.is_ready
        assert client.all_flags() == {}


class TestSyncLifecycle:
    def test_full_lifecycle(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=INITIAL)

        events: list[str] = []
        client = EdgeFlagsSync("tok", "http://localhost", polling_interval=60)
        client.on("ready", lambda: events.append("ready"))
        client.on("change", lambda _: events.append("change"))

        client.init()
        assert events == ["ready"]
        assert client.flag("dark_mode") is True

        httpx_mock.add_response(json=UPDATED)
        client.refresh()
        assert events == ["ready", "change"]
        assert client.flag("dark_mode") is False

        httpx_mock.add_response(json=IDENTIFIED)
        client.identify({"user_id": "user-1"})
        assert client.config("theme") == "green"

        client.destroy()
        assert not client.is_ready
