# edgeflags

Python SDK for [EdgeFlags](https://edgeflags.net) — a high-performance feature flag and configuration service.

Supports both **async** and **sync** interfaces.

## Installation

```bash
pip install edgeflags
```

Requires Python 3.10+.

## Quick Start

### Async

```python
import asyncio
from edgeflags import EdgeFlags

async def main():
    ef = EdgeFlags(
        token="ff_production_abc123",
        base_url="https://edgeflags.net",
        context={"user_id": "user-42", "plan": "pro"},
    )
    await ef.init()

    if ef.flag("dark_mode", False):
        print("Dark mode enabled")

    theme = ef.config("theme", "default")
    print(f"Theme: {theme}")

    ef.destroy()

asyncio.run(main())
```

### Sync

```python
from edgeflags import EdgeFlagsSync

ef = EdgeFlagsSync(
    token="ff_production_abc123",
    base_url="https://edgeflags.net",
    context={"user_id": "user-42", "plan": "pro"},
)
ef.init()

if ef.flag("dark_mode", False):
    print("Dark mode enabled")

ef.destroy()
```

## API Reference

### `EdgeFlags` / `EdgeFlagsSync`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `token` | `str` | required | API token (`ff_env_...`) |
| `base_url` | `str` | required | EdgeFlags service URL |
| `context` | `EvaluationContext` | `{}` | Initial evaluation context |
| `polling_interval` | `float` | `60.0` | Polling interval in seconds |
| `bootstrap` | `Bootstrap` | `None` | Fallback data if init fails |
| `debug` | `bool` | `False` | Enable debug logging |

### Methods

| Method | Async | Sync | Description |
|---|---|---|---|
| `init()` | `await ef.init()` | `ef.init()` | Fetch initial data and start polling |
| `flag(key, default?)` | sync | sync | Get flag value from cache |
| `config(key, default?)` | sync | sync | Get config value from cache |
| `all_flags()` | sync | sync | Get all flags |
| `all_configs()` | sync | sync | Get all configs |
| `identify(context)` | `await ef.identify(ctx)` | `ef.identify(ctx)` | Update context and refresh |
| `refresh()` | `await ef.refresh()` | `ef.refresh()` | Manually refresh from server |
| `on(event, fn)` | sync | sync | Subscribe to events (returns unsubscribe fn) |
| `destroy()` | sync | sync | Stop polling and clear state |
| `is_ready` | property | property | Whether client is initialized |

### Events

```python
ef.on("ready", lambda: print("Ready"))
ef.on("change", lambda event: print(f"Changed: {event}"))
ef.on("error", lambda err: print(f"Error: {err}"))
```

The `change` event payload is a `ChangeEvent` dict with `flags` and `configs` lists, each containing `key`, `previous`, and `current` values.

### Bootstrap

Provide fallback data in case the initial fetch fails:

```python
ef = EdgeFlags(
    token="...",
    base_url="...",
    bootstrap={
        "flags": {"dark_mode": False, "beta": False},
        "configs": {"theme": "default"},
    },
)
```

## Testing

Use `create_mock_client` / `create_mock_client_sync` for tests — no network required:

```python
from edgeflags import create_mock_client_sync

def test_feature():
    ef = create_mock_client_sync(
        flags={"new_checkout": True},
        configs={"max_items": 50},
    )
    assert ef.is_ready
    assert ef.flag("new_checkout") is True
    assert ef.config("max_items") == 50
    assert ef.flag("missing", False) is False
```

## Types

All types are exported and support type checking (PEP 561):

```python
from edgeflags import (
    FlagValue,           # bool | str | int | float | dict[str, Any]
    EvaluationContext,   # TypedDict with user_id, email, plan, etc.
    EvaluationResponse,  # TypedDict with flags + configs
    ChangeEvent,         # TypedDict with flag/config change lists
    Bootstrap,           # TypedDict with optional flags + configs
    EdgeFlagsEvent,      # Literal["ready", "change", "error"]
    EdgeFlagsError,      # Exception with optional status_code
)
```

## License

MIT
