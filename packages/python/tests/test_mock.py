from edgeflags.mock import create_mock_client, create_mock_client_sync


class TestMockClient:
    async def test_ready_without_network(self) -> None:
        client = create_mock_client(flags={"feat": True})
        assert client.is_ready

    async def test_init_emits_ready(self) -> None:
        ready_called: list[bool] = []
        client = create_mock_client()
        client.on("ready", lambda: ready_called.append(True))
        await client.init()
        assert len(ready_called) == 1

    async def test_seeded_values(self) -> None:
        client = create_mock_client(
            flags={"dark_mode": True, "beta": False},
            configs={"theme": "blue", "max": 100},
        )
        assert client.flag("dark_mode") is True
        assert client.flag("beta") is False
        assert client.config("theme") == "blue"
        assert client.config("max") == 100

    async def test_default_for_missing(self) -> None:
        client = create_mock_client()
        assert client.flag("missing") is None
        assert client.flag("missing", False) is False
        assert client.config("missing", "fallback") == "fallback"

    async def test_all_flags_configs(self) -> None:
        client = create_mock_client(flags={"a": True}, configs={"x": 1})
        assert client.all_flags() == {"a": True}
        assert client.all_configs() == {"x": 1}

    async def test_empty_mock(self) -> None:
        client = create_mock_client()
        assert client.all_flags() == {}
        assert client.all_configs() == {}


class TestMockClientSync:
    def test_ready_without_network(self) -> None:
        client = create_mock_client_sync(flags={"feat": True})
        assert client.is_ready

    def test_init_emits_ready(self) -> None:
        ready_called: list[bool] = []
        client = create_mock_client_sync()
        client.on("ready", lambda: ready_called.append(True))
        client.init()
        assert len(ready_called) == 1

    def test_seeded_values(self) -> None:
        client = create_mock_client_sync(
            flags={"dark_mode": True},
            configs={"theme": "blue"},
        )
        assert client.flag("dark_mode") is True
        assert client.config("theme") == "blue"

    def test_default_for_missing(self) -> None:
        client = create_mock_client_sync()
        assert client.flag("missing") is None
        assert client.flag("missing", "default") == "default"
