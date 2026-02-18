from edgeflags.emitter import Emitter


class TestEmitter:
    def test_on_and_emit(self) -> None:
        emitter = Emitter()
        received: list[object] = []
        emitter.on("change", lambda payload: received.append(payload))
        emitter.emit("change", {"flags": [], "configs": []})

        assert len(received) == 1
        assert received[0] == {"flags": [], "configs": []}

    def test_emit_no_payload(self) -> None:
        emitter = Emitter()
        called = []
        emitter.on("ready", lambda: called.append(True))
        emitter.emit("ready")

        assert len(called) == 1

    def test_unsubscribe(self) -> None:
        emitter = Emitter()
        received: list[object] = []
        unsub = emitter.on("change", lambda payload: received.append(payload))
        emitter.emit("change", "first")
        unsub()
        emitter.emit("change", "second")

        assert len(received) == 1
        assert received[0] == "first"

    def test_multiple_listeners(self) -> None:
        emitter = Emitter()
        a: list[object] = []
        b: list[object] = []
        emitter.on("error", lambda e: a.append(e))
        emitter.on("error", lambda e: b.append(e))
        emitter.emit("error", Exception("test"))

        assert len(a) == 1
        assert len(b) == 1

    def test_remove_all(self) -> None:
        emitter = Emitter()
        received: list[object] = []
        emitter.on("change", lambda payload: received.append(payload))
        emitter.remove_all()
        emitter.emit("change", "data")

        assert len(received) == 0

    def test_emit_unknown_event(self) -> None:
        emitter = Emitter()
        emitter.emit("change", "data")  # should not raise

    def test_double_unsubscribe(self) -> None:
        emitter = Emitter()
        unsub = emitter.on("ready", lambda: None)
        unsub()
        unsub()  # should not raise
