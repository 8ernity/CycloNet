import pytest
from app.services.report_service import report_service

def test_alert_level_classification():
    """Verify IMD 4-stage color alert mapping based on wind intensity thresholds."""
    d_alert = report_service.get_alert_level(30)
    assert d_alert["level"] == "GREEN"
    
    yellow_alert = report_service.get_alert_level(38)
    assert yellow_alert["level"] == "YELLOW"

    scs_alert = report_service.get_alert_level(55)
    assert scs_alert["level"] == "ORANGE"
    
    sucs_alert = report_service.get_alert_level(130)
    assert sucs_alert["level"] == "RED"

def test_port_danger_signals():
    """Verify port danger signals for coastal ports in Bay of Bengal and Arabian Sea."""
    signals_bob = report_service.get_port_signals(120, is_bay_of_bengal=True)
    assert len(signals_bob) > 0
    assert any("Signal" in s["signal"] for s in signals_bob)

def test_official_bulletin_and_cap_xml_generation():
    """Verify that RSMC-standard weather bulletins and CAP-XML documents are well-formed."""
    sys_mock = {
        "name": "Amphan",
        "basin": "Bay of Bengal",
        "category": "Super Cyclonic Storm",
        "intensity_knots": 140,
        "lat": 18.5,
        "lon": 87.2,
        "landfall_info": {
            "landfall_location": "Sundarbans near Digha",
            "landfall_time_utc": "20 May 2020, 09:30 UTC",
            "storm_surge_m": "4.5 - 5.0m"
        }
    }
    
    bulletins = report_service.generate_official_bulletins(sys_mock)
    assert len(bulletins) >= 3
    assert any("ADVISORY" in b["title"].upper() or "BULLETIN" in b["title"].upper() for b in bulletins)
    
    cap_xml = report_service.generate_cap_xml(sys_mock)
    assert "<alert" in cap_xml
    assert "<identifier>" in cap_xml
    assert "<info>" in cap_xml
    assert "Amphan" in cap_xml
    assert "</alert>" in cap_xml
