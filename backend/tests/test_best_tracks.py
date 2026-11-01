import pytest
from app.services.best_tracks import REAL_CYCLONE_TRACKS, get_cyclone_trajectory

def test_best_tracks_count_and_completeness():
    """Verify that all historical cyclones exist in the best-tracks dataset."""
    assert len(REAL_CYCLONE_TRACKS) >= 20
    
    # Key historical cyclones that must exist
    sample_cyclones = [
        "BOB03-2020", # Amphan
        "ARB01-2023", # Biparjoy
        "BOB02-2019", # Fani
        "ARB01-2021", # Tauktae
        "BOB01-2024", # Remal
        "BOB06-1999", # Odisha 1999
        "BOB02-2023", # Mocha
        "BOB04-2013", # Phailin
    ]
    for cid in sample_cyclones:
        assert cid in REAL_CYCLONE_TRACKS, f"Missing expected cyclone: {cid}"

def test_best_tracks_data_validity():
    """Verify that every storm has authentic coordinates, intensities, and valid metadata."""
    for cid, storm in REAL_CYCLONE_TRACKS.items():
        assert "name" in storm
        assert "basin" in storm
        assert "category" in storm
        assert "points" in storm
        assert len(storm["points"]) > 0, f"Storm {cid} has empty points"
        
        # Check all point fixes
        for pt in storm["points"]:
            assert 0 <= pt["lat"] <= 40.0, f"Latitude out of bounds in {cid}: {pt['lat']}"
            assert 40.0 <= pt["lon"] <= 110.0, f"Longitude out of bounds in {cid}: {pt['lon']}"
            assert pt["intensity_knots"] > 0, f"Invalid intensity in {cid}: {pt['intensity_knots']}"
            assert "category" in pt

        # Check landfall info if present
        if "landfall_info" in storm:
            lf = storm["landfall_info"]
            assert "landfall_location" in lf
            assert "landfall_intensity_knots" in lf
            assert lf["landfall_intensity_knots"] > 0

def test_get_cyclone_trajectory_function():
    """Verify get_cyclone_trajectory generates complete system response."""
    traj = get_cyclone_trajectory("BOB03-2020", "Amphan", "Bay of Bengal", "Super Cyclonic Storm")
    assert "Amphan" in traj["name"]
    assert traj["basin"] == "Bay of Bengal"
    assert len(traj["track_forecast"]) > 0
    assert traj["intensity_knots"] > 0
    assert "landfall_info" in traj
