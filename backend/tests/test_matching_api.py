"""Exercise FastAPI's ASGI request handling without a live database or HTTP client dependency."""

import asyncio
import json
import os
import unittest
from unittest.mock import patch

from backend.app.cat_repository import CatDataUnavailable
from backend.app.main import app
from backend.tests.test_cat_repository import make_row
from backend.tests.test_matching import make_answers


async def request(method, path, body=None, headers=None):
    payload = json.dumps(body).encode() if body is not None else b""
    messages = []
    received = False

    async def receive():
        nonlocal received
        if received:
            await asyncio.Event().wait()
        received = True
        return {"type": "http.request", "body": payload, "more_body": False}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": b"", "root_path": "", "server": ("testserver", 80),
        "client": ("127.0.0.1", 1234),
        "headers": [(b"content-type", b"application/json"), *(headers or [])],
    }
    await asyncio.wait_for(app(scope, receive, send), timeout=3)
    start = next(message for message in messages if message["type"] == "http.response.start")
    content = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return start["status"], dict(start["headers"]), content


class MatchingApiTests(unittest.IsolatedAsyncioTestCase):
    # Checks an HTTP request runs through validation, database mapping, filtering, and ranking.
    async def test_matches_route_maps_and_filters_database_records(self):
        # Mock only the database transport, using synthetic rows including unsafe availability states.
        rows = [
            make_row(source_record_id="synthetic-low", Name="Test Lower", age_group="senior", companionship_style="spirit_cat"),
            make_row(source_record_id="synthetic-high", Name="Test Higher"),
            make_row(source_record_id="synthetic-null", availability_status=None),
            make_row(source_record_id="synthetic-archived", archived_at="2026-01-01"),
        ]
        settings = {"DATABASE_URL": "postgresql://example.invalid/postgres",
                    "MATCHING_AVAILABLE_STATUS": "confirmed_available"}
        with patch.dict(os.environ, settings), patch("backend.app.cat_repository.psycopg.connect") as connect:
            cursor = connect.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            cursor.fetchall.return_value = rows
            # Submit actual quiz JSON through FastAPI rather than calling the handler directly.
            status, _, body = await request("POST", "/matches", make_answers().model_dump())
        result = json.loads(body)
        # Only eligible cats survive, with correct ranking and no private source-row fields.
        self.assertEqual(status, 200)
        self.assertEqual(result["matches"], [])
        self.assertEqual([cat["source_record_id"] for cat in result["needs_confirmation"]],
                         ["synthetic-high", "synthetic-low"])
        self.assertEqual([cat["score"] for cat in result["needs_confirmation"]], [5, 0])
        self.assertIn("Needs confirmation: shelter placement requirements.",
                      result["needs_confirmation"][0]["considerations"])
        self.assertEqual(set(result["needs_confirmation"][0]),
                         {"source_record_id", "name", "score", "reasons", "considerations"})

    # Checks invalid quiz JSON is rejected before any database access occurs.
    async def test_rejects_invalid_answers_before_loading_cats(self):
        # Provide a missing quiz and an unsupported age choice as independent invalid requests.
        with patch("backend.app.main.load_cat_candidates") as load:
            for payload in [{}, make_answers().model_dump() | {"age": "banana"}]:
                # FastAPI must apply the Pydantic request model to incoming JSON.
                status, _, _ = await request("POST", "/matches", payload)
                self.assertEqual(status, 422)
            # Invalid inputs cannot consume database work or produce recommendations.
            load.assert_not_called()

    # Checks zero eligible records is a successful empty response rather than a server error.
    async def test_returns_empty_results(self):
        # A successful repository read finds no candidates.
        with patch("backend.app.main.load_cat_candidates", return_value=[]):
            status, _, body = await request("POST", "/matches", make_answers().model_dump())
        # The frontend receives the exact two-list contract for its empty state.
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"matches": [], "needs_confirmation": []})

    # Checks database/configuration errors produce a safe HTTP 503 response.
    async def test_database_error_returns_safe_service_failure(self):
        # Simulate an internal failure containing details guests must not receive.
        with patch("backend.app.main.load_cat_candidates", side_effect=CatDataUnavailable("private detail")):
            status, _, body = await request("POST", "/matches", make_answers().model_dump())
        # Verify both HTTP status and the absence of internal error text.
        self.assertEqual(status, 503)
        self.assertNotIn("private detail", body.decode())

    # Checks the configured frontend origin can perform the browser's POST preflight request.
    async def test_frontend_cors_preflight(self):
        # Use the same origin setting read by the application during startup.
        origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").encode()
        status, headers, _ = await request("OPTIONS", "/matches", headers=[
            (b"origin", origin), (b"access-control-request-method", b"POST"),
            (b"access-control-request-headers", b"content-type"),
        ])
        # A successful preflight allows browser requests from that configured origin.
        self.assertEqual(status, 200)
        self.assertEqual(headers[b"access-control-allow-origin"], origin)
