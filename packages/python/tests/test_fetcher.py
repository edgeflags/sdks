import pytest
from pytest_httpx import HTTPXMock

from edgeflags.errors import EdgeFlagsError
from edgeflags.fetcher import AsyncFetcher, SyncFetcher


class TestAsyncFetcher:
    async def test_fetch_all(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            json={"flags": {"dark_mode": True}, "configs": {"theme": "blue"}},
        )
        fetcher = AsyncFetcher("http://localhost", "test_token")
        try:
            result = await fetcher.fetch_all({"custom": {}})
            assert result["flags"] == {"dark_mode": True}
            assert result["configs"] == {"theme": "blue"}
        finally:
            await fetcher.close()

    async def test_auth_header(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            json={"flags": {}, "configs": {}},
        )
        fetcher = AsyncFetcher("http://localhost", "my_secret")
        try:
            await fetcher.fetch_all({})
            request = httpx_mock.get_request()
            assert request is not None
            assert request.headers["authorization"] == "Bearer my_secret"
        finally:
            await fetcher.close()

    async def test_trailing_slash_stripped(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            json={"flags": {}, "configs": {}},
        )
        fetcher = AsyncFetcher("http://localhost/", "tok")
        try:
            await fetcher.fetch_all({})
            request = httpx_mock.get_request()
            assert request is not None
            assert str(request.url) == "http://localhost/api/v1/evaluate"
        finally:
            await fetcher.close()

    async def test_error_response(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            status_code=401,
        )
        fetcher = AsyncFetcher("http://localhost", "bad_token")
        try:
            with pytest.raises(EdgeFlagsError, match="401"):
                await fetcher.fetch_all({})
        finally:
            await fetcher.close()

    async def test_error_has_status_code(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            status_code=500,
        )
        fetcher = AsyncFetcher("http://localhost", "tok")
        try:
            with pytest.raises(EdgeFlagsError) as exc_info:
                await fetcher.fetch_all({})
            assert exc_info.value.status_code == 500
        finally:
            await fetcher.close()


class TestSyncFetcher:
    def test_fetch_all(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            json={"flags": {"beta": False}, "configs": {"max": 100}},
        )
        fetcher = SyncFetcher("http://localhost", "test_token")
        try:
            result = fetcher.fetch_all({"custom": {}})
            assert result["flags"] == {"beta": False}
            assert result["configs"] == {"max": 100}
        finally:
            fetcher.close()

    def test_auth_header(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            json={"flags": {}, "configs": {}},
        )
        fetcher = SyncFetcher("http://localhost", "my_secret")
        try:
            fetcher.fetch_all({})
            request = httpx_mock.get_request()
            assert request is not None
            assert request.headers["authorization"] == "Bearer my_secret"
        finally:
            fetcher.close()

    def test_error_response(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url="http://localhost/api/v1/evaluate",
            status_code=403,
        )
        fetcher = SyncFetcher("http://localhost", "tok")
        try:
            with pytest.raises(EdgeFlagsError, match="403"):
                fetcher.fetch_all({})
        finally:
            fetcher.close()
