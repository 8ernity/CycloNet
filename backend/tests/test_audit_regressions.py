"""Regression tests for audit remediations: tracks, intensity scale, readiness, parsers, and LLM fallback."""

from contextlib import contextmanager
from datetime import date
import email.message
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

import httpx
import pytest

from app.core.archive_dates import archive_start_date
from app.core.origins import configured_origins, normalize_origin

from app.services.best_tracks import _lookup_track, get_cyclone_trajectory
from app.services.chat_service import MeteorologicalChatService
from app.services.cyclone_classification import classify_imd_category_from_knots, derive_empirical_dvorak_t
from app.services.ingestion.parsers import (
    extract_bulletin_movement,
    extract_coordinates_from_bulletin,
    parse_ist_centered_timestamp,
)


def test_best_tracks_lookup_rejects_empty_and_short_ambiguous_names():
    cid, hit = _lookup_track("UNKNOWN-01", "")
    assert cid == "UNKNOWN-01"
    assert hit is None

    cid_short, hit_short = _lookup_track("UNKNOWN-02", "a")
    assert cid_short == "UNKNOWN-02"
    assert hit_short is None

    cid_exact, hit_exact = _lookup_track("UNKNOWN-03", "  Cyclone Amphan ")
    assert cid_exact == "BOB03-2020"
    assert hit_exact is not None
    assert hit_exact["name"] == "Amphan"


def test_simulation_track_points_retain_simulation_origin_type():
    traj = get_cyclone_trajectory("BOB05-2026", "Deep Depression (BOB-05)", "Bay of Bengal", "Deep Depression")
    assert traj["is_simulation"] is True
    assert all(pt["origin_type"] == "SIMULATION_WAYPOINT" for pt in traj["track_forecast"])


@pytest.mark.parametrize(
    ("knots", "expected"),
    [
        (None, "Cyclonic Disturbance (Unclassified Wind)"),
        (10, "Low Pressure Area"),
        (20, "Depression"),
        (30, "Deep Depression"),
        (40, "Cyclonic Storm"),
        (55, "Severe Cyclonic Storm"),
        (64, "Very Severe Cyclonic Storm"),
        (90, "Extremely Severe Cyclonic Storm"),
        (125, "Super Cyclonic Storm"),
    ],
)
def test_imd_classification_boundaries(knots, expected):
    assert classify_imd_category_from_knots(knots) == expected


def test_empirical_dvorak_handles_missing_and_intense_winds():
    assert derive_empirical_dvorak_t(None) == ("T-Pending", "Unavailable (Missing Wind Telemetry)", False)
    assert derive_empirical_dvorak_t(120)[0] == "T6.0+"


def test_ingestion_parsers_extract_valid_fields_only():
    coords = extract_coordinates_from_bulletin("Centered near latitude 17.5° N and longitude 86.2° E")
    assert coords == (17.5, 86.2)
    assert extract_coordinates_from_bulletin("Out of basin 55.0N 140.0E") is None

    speed_raw, unit, kmph, direction = extract_bulletin_movement("MOVING AT 10 KT DIRECTION NW")
    assert (speed_raw, unit, direction) == (10.0, "KT", "NW")
    assert kmph == pytest.approx(18.52)

    dt = parse_ist_centered_timestamp("centered at 0830 hours IST of today, the 20th May, 2024")
    assert dt is not None and dt.hour == 3 and dt.minute == 0


def test_chat_service_retries_candidate_models_on_transient_errors(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaSyTestDummyKeyForUnitTestOnly")
    svc = MeteorologicalChatService()
    called_urls = []

    @contextmanager
    def fake_stream(method, url, **kwargs):
        called_urls.append(url)
        resp = MagicMock()
        if len(called_urls) == 1:
            err_resp = httpx.Response(503, request=httpx.Request(method, url))
            resp.raise_for_status.side_effect = httpx.HTTPStatusError("unavailable", request=err_resp.request, response=err_resp)
        else:
            payload = json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps({"topic": "cyclogenesis"})}]}}]}).encode("utf-8")
            resp.raise_for_status.return_value = None
            resp.iter_bytes.return_value = [payload]
        yield resp

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.stream.side_effect = fake_stream

    with patch("app.services.chat_service.httpx.Client", return_value=mock_client):
        reply = svc._call_gemini("Explain cyclogenesis")

    assert reply is not None
    assert "cyclogenesis" in reply.lower()
    assert len(called_urls) == 2


def test_readiness_script_classifies_suspended_and_retries_transient_errors():
    scripts_dir = Path(__file__).resolve().parents[2] / "scripts"
    sys.path.insert(0, str(scripts_dir))
    try:
        import check_readiness  # type: ignore

        headers = email.message.Message()
        headers["x-render-routing"] = "suspend"
        suspended_exc = HTTPError("https://example.invalid/health", 503, "Suspended", headers, None)

        with patch.object(check_readiness, "urlopen", side_effect=suspended_exc) as mock_open:
            with pytest.raises(check_readiness.ReadinessProbeError) as exc_info:
                check_readiness.check("https://example.invalid/health", retries=3)
            assert exc_info.value.reason == "service_suspended"
            assert exc_info.value.status_code == 503
            assert mock_open.call_count == 1

        ready_payload = json.dumps({
            "status": "ready",
            "database": "connected",
            "schema_current": True,
            "authentication_configured": True,
            "redis": "connected",
        }).encode("utf-8")
        ok_response = MagicMock()
        ok_response.__enter__.return_value = ok_response
        ok_response.status = 200
        ok_response.read.return_value = ready_payload
        transient_exc = HTTPError("https://example.invalid/health/ready", 502, "Bad Gateway", email.message.Message(), None)

        with (
            patch.object(check_readiness, "urlopen", side_effect=[transient_exc, ok_response]) as mock_open2,
            patch.object(check_readiness.time, "sleep"),
        ):
            ok, latency = check_readiness.check("https://example.invalid/health/ready", ready=True, retries=2)
            assert ok is True
            assert latency >= 0
            assert mock_open2.call_count == 2
    finally:
        if str(scripts_dir) in sys.path:
            sys.path.remove(str(scripts_dir))


def test_origin_normalization_and_production_filtering(monkeypatch):
    assert normalize_origin("https://CycloNet.example:443") == "https://cyclonet.example"
    assert normalize_origin("http://[::1]:3000") == "http://[::1]:3000"
    assert normalize_origin("javascript:alert(1)") is None
    assert normalize_origin("https://user:pass@example.com") is None
    assert normalize_origin("https://example.com /bad", configuration=True) is None
    assert normalize_origin("https://example.com/path", configuration=False) is None

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOWED_ORIGINS", "*, http://localhost:3000, https://cyclonet.example/")
    origins = configured_origins()
    assert origins == ["https://cyclonet.example"]

    monkeypatch.setenv("ENVIRONMENT", "development")
    dev_origins = configured_origins()
    assert "*" in dev_origins
    assert "http://localhost:3000" in dev_origins


def test_archive_start_date_parses_iso_ranges_and_bounds():
    assert archive_start_date(2023, "2023-06-15") == date(2023, 6, 15)
    assert archive_start_date(2023, "Feb 30 - Mar 02") == date(2023, 2, 1)
    assert archive_start_date(2020, "May 16-21") == date(2020, 5, 16)
    assert archive_start_date(0, "May 16") == date.min

