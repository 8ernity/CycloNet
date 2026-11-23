"""Contract, configuration, parser security, and domain regression tests for refactored modules."""

from __future__ import annotations

import hashlib
import io
import os
import tarfile
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.core.config import _parse_env_value, load_local_env
from app.main import app
from app.services.feed_policy import fresh, parse_time
from app.services.hursat_review import review_archive
from app.services.image_validation import read_validated_image_upload
from app.services.ingestion.parsers import parse_safe_xml


def test_env_value_parsing_and_precedence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    assert _parse_env_value('  "hello world"  ') == "hello world"
    assert _parse_env_value("  'single # kept'  ") == "single # kept"
    assert _parse_env_value("value_one # trailing comment") == "value_one"
    assert _parse_env_value("unmatched'quote") == "unmatched'quote"

    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "# comment",
                "INVALID-KEY=ignored",
                "export CYCLONET_TEST_EXPORTED='from_export'",
                'CYCLONET_TEST_QUOTED="value with spaces"',
                "CYCLONET_TEST_INLINE=plain_val # inline note",
                "CYCLONET_TEST_PRESET=from_file",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("CYCLONET_TEST_PRESET", "from_process")
    for key in ("CYCLONET_TEST_EXPORTED", "CYCLONET_TEST_QUOTED", "CYCLONET_TEST_INLINE"):
        monkeypatch.delenv(key, raising=False)

    loaded = load_local_env()
    assert loaded == Path(".env")
    assert os.environ["CYCLONET_TEST_EXPORTED"] == "from_export"
    assert os.environ["CYCLONET_TEST_QUOTED"] == "value with spaces"
    assert os.environ["CYCLONET_TEST_INLINE"] == "plain_val"
    assert os.environ["CYCLONET_TEST_PRESET"] == "from_process"
    assert "INVALID-KEY" not in os.environ


def test_load_local_env_skips_production_and_handles_bad_utf8(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
):
    bad_env = tmp_path / ".env"
    bad_env.write_bytes(b"\xff\xfe\xfd=broken")
    monkeypatch.chdir(tmp_path)

    monkeypatch.setenv("ENVIRONMENT", "development")
    with caplog.at_level("WARNING"):
        loaded = load_local_env()
    assert loaded != Path(".env")
    assert "Unable to read environment file" in caplog.text

    monkeypatch.setenv("ENVIRONMENT", "production")
    (tmp_path / ".env").write_text("CYCLONET_PROD_IGNORED=1", encoding="utf-8")
    assert load_local_env() is None


def test_parse_safe_xml_rejects_xxe_dtd_and_oversized_payloads():
    valid = parse_safe_xml(b"\xef\xbb\xbf<rss><channel><title>JTWC</title></channel></rss>")
    assert valid.tag == "rss"

    with pytest.raises(ValueError, match="forbidden"):
        parse_safe_xml("<?xml version='1.0'?><!DOCTYPE foo [<!ENTITY xxe 'boom'>]><rss/>")

    with pytest.raises(ValueError, match="size"):
        parse_safe_xml("<rss>" + ("a" * (2 * 1024 * 1024 + 16)) + "</rss>")


@pytest.mark.asyncio
async def test_read_validated_image_upload_enforces_type_size_and_signature():
    bad_type = UploadFile(file=io.BytesIO(b"123"), filename="note.txt", headers=Headers({"content-type": "text/plain"}))
    with pytest.raises(HTTPException) as exc_type:
        await read_validated_image_upload(bad_type, content_type_error="Must be image")
    assert exc_type.value.status_code == 400
    assert exc_type.value.detail == "Must be image"

    bad_magic = UploadFile(
        file=io.BytesIO(b"NOT_AN_IMAGE_PAYLOAD"),
        filename="fake.png",
        headers=Headers({"content-type": "image/png"}),
    )
    with pytest.raises(HTTPException) as exc_magic:
        await read_validated_image_upload(bad_magic)
    assert exc_magic.value.status_code == 400

    class OversizedUpload:
        content_type = "image/jpeg"

        async def read(self, limit: int) -> bytes:
            return b"\xff\xd8\xff" + (b"0" * limit)

    with pytest.raises(HTTPException) as exc_size:
        await read_validated_image_upload(OversizedUpload())  # type: ignore[arg-type]
    assert exc_size.value.status_code == 413


def test_feed_policy_synoptic_time_formats():
    dt_full = parse_time("19NOV26 1800Z")
    assert dt_full == datetime(2026, 11, 19, 18, 0, tzinfo=timezone.utc)

    assert parse_time("INVALID_DATE") is None
    assert parse_time(None) is None
    assert fresh(datetime.now(timezone.utc)) is True
    assert fresh("2020-01-01T00:00:00Z") is False


def test_hursat_review_rejects_archive_checksum_and_missing_members(tmp_path: Path):
    archive = tmp_path / "sample.tar.gz"
    manifest = tmp_path / "manifest.csv"
    manifest.write_text("SID,ISO_TIME,USA_WIND\n", encoding="utf-8")

    with tarfile.open(archive, "w:gz") as tf:
        info = tarfile.TarInfo("frame_01.nc")
        payload = b"dummy"
        info.size = len(payload)
        tf.addfile(info, io.BytesIO(payload))

    integrity_bad_sha = {
        "archive_sha256": "0" * 64,
        "frames": [],
        "source_url": "https://example.invalid",
        "event_id": "2020135N10088",
    }
    with pytest.raises(ValueError, match="Archive checksum"):
        review_archive(archive, manifest, integrity_bad_sha)

    archive_sha = hashlib.sha256(archive.read_bytes()).hexdigest()
    integrity_missing_member = {
        "archive_sha256": archive_sha,
        "frames": [{"member": "different.nc", "bytes": 5, "sha256": hashlib.sha256(b"dummy").hexdigest()}],
        "source_url": "https://example.invalid",
        "event_id": "2020135N10088",
    }
    with pytest.raises(ValueError, match="Unexpected, duplicate, or excessive archive member"):
        review_archive(archive, manifest, integrity_missing_member)


def test_refactored_routers_preserve_all_api_contracts():
    schema_paths: dict[str, dict] = app.openapi().get("paths", {})

    expected_http = {
        "/health": {"get"},
        "/health/live": {"get"},
        "/health/ready": {"get"},
        "/health/ml": {"get"},
        "/api/ingest/status": {"get"},
        "/api/ingest/sync": {"post"},
        "/api/ingest/test-inject": {"post"},
        "/api/ingest/clear-test": {"post"},
        "/api/active-systems": {"get"},
        "/api/cyclones": {"get"},
        "/api/classify": {"post"},
        "/api/history/search": {"get"},
        "/api/history/classifications": {"get"},
        "/api/chat": {"post"},
        "/api/ai/analyze-multimodal": {"post"},
        "/api/ai/pre-landfall-briefing": {"post"},
        "/api/reports/bulletins": {"get"},
        "/api/alerts/dispatch": {"post"},
        "/api/alerts/broadcast-test": {"post"},
        "/api/gee/layers": {"get"},
        "/api/gee/flood-inundation": {"get"},
        "/api/gee/rainfall-pathways": {"get"},
        "/api/surge/calculate": {"get"},
        "/api/surge/profile": {"get"},
    }
    for path, expected in expected_http.items():
        actual_methods = {m.lower() for m in schema_paths.get(path, {})}
        assert expected.issubset(actual_methods), f"Missing route contract: {path} {expected}"

    from app.api.websocket import ws_router

    ws_paths = {getattr(r, "path", "") for r in ws_router.routes}
    assert "/ws/cyclone-stream" in ws_paths
    assert "/ws/operator-events" in ws_paths
