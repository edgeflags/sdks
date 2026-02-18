from edgeflags.cache import Cache, _deep_equal


class TestDeepEqual:
    def test_primitives(self) -> None:
        assert _deep_equal(1, 1)
        assert _deep_equal("a", "a")
        assert _deep_equal(True, True)
        assert not _deep_equal(1, 2)
        assert not _deep_equal("a", "b")
        assert not _deep_equal(True, False)

    def test_none(self) -> None:
        assert _deep_equal(None, None)
        assert not _deep_equal(None, 1)
        assert not _deep_equal(1, None)

    def test_type_mismatch(self) -> None:
        assert not _deep_equal(1, "1")
        assert not _deep_equal(True, 1)

    def test_dicts(self) -> None:
        assert _deep_equal({"a": 1}, {"a": 1})
        assert not _deep_equal({"a": 1}, {"a": 2})
        assert not _deep_equal({"a": 1}, {"b": 1})
        assert not _deep_equal({"a": 1}, {"a": 1, "b": 2})

    def test_nested_dicts(self) -> None:
        assert _deep_equal({"a": {"b": 1}}, {"a": {"b": 1}})
        assert not _deep_equal({"a": {"b": 1}}, {"a": {"b": 2}})

    def test_lists(self) -> None:
        assert _deep_equal([1, 2, 3], [1, 2, 3])
        assert not _deep_equal([1, 2], [1, 2, 3])
        assert not _deep_equal([1, 2, 3], [1, 3, 2])

    def test_identity(self) -> None:
        obj = {"x": [1, 2]}
        assert _deep_equal(obj, obj)


class TestCache:
    def test_seed_and_get(self) -> None:
        cache = Cache()
        cache.seed({"dark_mode": True, "limit": 10}, {"theme": "blue"})

        assert cache.get_flag("dark_mode") is True
        assert cache.get_flag("limit") == 10
        assert cache.get_config("theme") == "blue"

    def test_get_missing_returns_none(self) -> None:
        cache = Cache()
        assert cache.get_flag("missing") is None
        assert cache.get_config("missing") is None

    def test_all_flags_and_configs(self) -> None:
        cache = Cache()
        cache.seed({"a": True, "b": False}, {"x": 1})

        assert cache.all_flags() == {"a": True, "b": False}
        assert cache.all_configs() == {"x": 1}

    def test_all_flags_returns_copy(self) -> None:
        cache = Cache()
        cache.seed({"a": True}, {})
        flags = cache.all_flags()
        flags["b"] = False
        assert cache.get_flag("b") is None

    def test_update_detects_changes(self) -> None:
        cache = Cache()
        cache.seed({"dark_mode": True}, {"theme": "blue"})

        changes = cache.update({"dark_mode": False}, {"theme": "red"})

        assert changes is not None
        assert len(changes["flags"]) == 1
        assert changes["flags"][0]["key"] == "dark_mode"
        assert changes["flags"][0]["previous"] is True
        assert changes["flags"][0]["current"] is False
        assert len(changes["configs"]) == 1
        assert changes["configs"][0]["key"] == "theme"

    def test_update_no_changes(self) -> None:
        cache = Cache()
        cache.seed({"dark_mode": True}, {"theme": "blue"})

        changes = cache.update({"dark_mode": True}, {"theme": "blue"})
        assert changes is None

    def test_update_new_key(self) -> None:
        cache = Cache()
        changes = cache.update({"new_flag": True}, {})

        assert changes is not None
        assert len(changes["flags"]) == 1
        assert changes["flags"][0]["previous"] is None
        assert changes["flags"][0]["current"] is True

    def test_update_deep_equality(self) -> None:
        cache = Cache()
        cache.seed({}, {"nested": {"a": 1, "b": [1, 2]}})

        changes = cache.update({}, {"nested": {"a": 1, "b": [1, 2]}})
        assert changes is None

        changes = cache.update({}, {"nested": {"a": 1, "b": [1, 3]}})
        assert changes is not None

    def test_clear(self) -> None:
        cache = Cache()
        cache.seed({"a": True}, {"x": 1})
        cache.clear()

        assert cache.all_flags() == {}
        assert cache.all_configs() == {}
