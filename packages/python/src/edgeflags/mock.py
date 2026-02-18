from __future__ import annotations

from typing import Any

from .client import EdgeFlags, EdgeFlagsSync
from .types import FlagValue


def create_mock_client(
    flags: dict[str, FlagValue] | None = None,
    configs: dict[str, Any] | None = None,
) -> EdgeFlags:
    return EdgeFlags(
        token="mock_token",
        base_url="http://localhost",
        _mock={"flags": flags or {}, "configs": configs or {}},
    )


def create_mock_client_sync(
    flags: dict[str, FlagValue] | None = None,
    configs: dict[str, Any] | None = None,
) -> EdgeFlagsSync:
    return EdgeFlagsSync(
        token="mock_token",
        base_url="http://localhost",
        _mock={"flags": flags or {}, "configs": configs or {}},
    )
