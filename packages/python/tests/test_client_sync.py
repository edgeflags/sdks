import pytest
from pytest_httpx import HTTPXMock

from edgeflags.client import EdgeFlagsSync
from edgeflags.errors import EdgeFlagsError

EVAL_RESPONSE = {"flags": {"dark_mode": True, "beta": False}, "configs": {"theme": "blue"}}


class TestEdgeFlagsSyncInit:
    def test_init_fetches_and_emits_ready(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        ready_called: list[bool] = []
        client = EdgeFlagsSync("tok", "http://localhost")
        client.on("ready", lambda: ready_called.append(True))

        client.init()

        assert client.is_ready
        assert len(ready_called) == 1
        client.destroy()

    def test_init_failure_raises(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(status_code=500)
        client = EdgeFlagsSync("tok", "http://localhost")

        with pytest.raises(EdgeFlagsError):
            client.init()

        assert not client.is_ready
        client.destroy()

    def test_init_failure_uses_bootstrap(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(status_code=500)
        ready_called: list[bool] = []
        client = EdgeFlagsSync(
            "tok",
            "http://localhost",
            bootstrap={"flags": {"fallback": True}},
        )
        client.on("ready", lambda: ready_called.append(True))

        client.init()

        assert client.is_ready
        assert client.flag("fallback") is True
        assert len(ready_called) == 1
        client.destroy()


class TestEdgeFlagsSyncMethods:
    def test_flag_and_config(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        client = EdgeFlagsSync("tok", "http://localhost")
        client.init()

        assert client.flag("dark_mode") is True
        assert client.flag("beta") is False
        assert client.config("theme") == "blue"
        client.destroy()

    def test_flag_default(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        client = EdgeFlagsSync("tok", "http://localhost")
        client.init()

        assert client.flag("missing") is None
        assert client.flag("missing", False) is False
        assert client.config("missing") is None
        assert client.config("missing", "default") == "default"
        client.destroy()

    def test_all_flags_and_configs(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        client = EdgeFlagsSync("tok", "http://localhost")
        client.init()

        assert client.all_flags() == {"dark_mode": True, "beta": False}
        assert client.all_configs() == {"theme": "blue"}
        client.destroy()


class TestEdgeFlagsSyncChangeEvents:
    def test_refresh_emits_change(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        client = EdgeFlagsSync("tok", "http://localhost")
        client.init()

        changes_received: list[object] = []
        client.on("change", lambda c: changes_received.append(c))

        httpx_mock.add_response(
            json={"flags": {"dark_mode": False, "beta": False}, "configs": {"theme": "red"}}
        )
        client.refresh()

        assert len(changes_received) == 1
        change = changes_received[0]
        assert isinstance(change, dict)
        assert len(change["flags"]) == 1
        assert change["flags"][0]["key"] == "dark_mode"
        client.destroy()


class TestEdgeFlagsSyncIdentify:
    def test_identify_refreshes(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        client = EdgeFlagsSync("tok", "http://localhost")
        client.init()

        httpx_mock.add_response(
            json={"flags": {"dark_mode": True, "beta": True}, "configs": {"theme": "blue"}}
        )
        client.identify({"user_id": "u1", "custom": {}})

        assert client.flag("beta") is True
        client.destroy()


class TestEdgeFlagsSyncDestroy:
    def test_destroy_clears_state(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(json=EVAL_RESPONSE)
        client = EdgeFlagsSync("tok", "http://localhost")
        client.init()

        client.destroy()

        assert not client.is_ready
        assert client.all_flags() == {}
        assert client.all_configs() == {}
