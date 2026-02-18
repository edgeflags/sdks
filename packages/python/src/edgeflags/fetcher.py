from __future__ import annotations

from typing import Any

import httpx

from .errors import EdgeFlagsError
from .types import EvaluationContext, EvaluationResponse

_TIMEOUT = 30.0


class AsyncFetcher:
    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            timeout=_TIMEOUT,
        )

    async def fetch_all(self, context: EvaluationContext) -> EvaluationResponse:
        body: dict[str, Any] = {"context": dict(context)}
        response = await self._client.post("/api/v1/evaluate", json=body)
        if response.status_code != 200:
            raise EdgeFlagsError(
                f"Evaluation request failed: {response.status_code} {response.reason_phrase}",
                response.status_code,
            )
        data = response.json()
        return EvaluationResponse(flags=data["flags"], configs=data["configs"])

    async def close(self) -> None:
        await self._client.aclose()


class SyncFetcher:
    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            timeout=_TIMEOUT,
        )

    def fetch_all(self, context: EvaluationContext) -> EvaluationResponse:
        body: dict[str, Any] = {"context": dict(context)}
        response = self._client.post("/api/v1/evaluate", json=body)
        if response.status_code != 200:
            raise EdgeFlagsError(
                f"Evaluation request failed: {response.status_code} {response.reason_phrase}",
                response.status_code,
            )
        data = response.json()
        return EvaluationResponse(flags=data["flags"], configs=data["configs"])

    def close(self) -> None:
        self._client.close()
