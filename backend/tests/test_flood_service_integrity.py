import pytest
from app.services.gee_service import (
    SatelliteFloodDetectionService,
    ExperimentalFloodSimulationService,
    GoogleEarthEngineService,
    satellite_flood_service,
    flood_simulation_service,
    gee_service
)

def test_unauthenticated_satellite_flood_service_returns_unavailable_without_polygons():
    """
    FIX-007: When GEE credentials or satellite image overpasses are unavailable,
    SatelliteFloodDetectionService must return SATELLITE_DATA_UNAVAILABLE with an empty
    features list. It MUST NEVER fabricate synthetic buffer polygons under satellite observation labels.
    """
    svc = SatelliteFloodDetectionService()
    svc.is_live_gee = False

    res = svc.get_satellite_observed_flood(19.5, 85.0)

    assert res["status"] == "SATELLITE_DATA_UNAVAILABLE"
    assert res["is_satellite_measured"] is False
    assert len(res["features"]) == 0
    assert res['capability_status'] == 'DISABLED'
    assert 'validated SAR pipeline' in res['reason']

def test_flood_simulation_service_labels_simulated_extent_and_origin():
    """
    FIX-007: ExperimentalFloodSimulationService must explicitly label all outputs
    as EXPERIMENTAL_HYDROLOGICAL_SIMULATION and is_satellite_measured=False.
    """
    sim_svc = ExperimentalFloodSimulationService()
    res = sim_svc.generate_flood_inundation_simulation(18.5, 84.0, 95)

    assert res["mode"] == "SIMULATED_EXTENT"
    assert res["origin"] == "EXPERIMENTAL_HYDROLOGICAL_SIMULATION"
    assert res["is_satellite_measured"] is False
    assert res["sar_backscatter_db"] is None
    assert len(res["features"]) > 0

    for feat in res["features"]:
        props = feat["properties"]
        assert props["origin"] == "EXPERIMENTAL_HYDROLOGICAL_SIMULATION"
        assert props["is_satellite_measured"] is False
        assert props["is_raster_pixel_classification"] is False
        assert props["sar_backscatter_db"] is None
        assert "Simulation" in props["zone_name"]

def test_gee_service_facade_preserves_simulated_extent_honesty():
    """
    Backwards compatibility: gee_service.get_flood_inundation_zones returns
    mode=SIMULATED_EXTENT, is_satellite_measured=False, and sar_backscatter_db=None.
    """
    res = gee_service.get_flood_inundation_zones(20.0, 86.5, 80)
    assert res["mode"] == "SIMULATED_EXTENT"
    assert res["is_satellite_measured"] is False
    assert res["origin"] == "EXPERIMENTAL_HYDROLOGICAL_SIMULATION"
    assert res["sar_backscatter_db"] is None

def test_rainfall_pathways_labeled_with_experimental_simulation_origin():
    """
    FIX-007: Runoff pathways must carry simulation origin provenance.
    """
    pathways = flood_simulation_service.get_catchment_rainfall_pathways(21.5, 88.0, 320.0)
    assert len(pathways) > 0
    for p in pathways:
        assert p["origin"] == "EXPERIMENTAL_HYDROLOGICAL_SIMULATION"
        assert p["is_satellite_measured"] is False
        assert p["mode"] == "ASSUMED_TERRAIN_RUNOFF_SIMULATION"
        assert p["terrain_source"] == "ASSUMED_SCENARIO"
        assert p["scientifically_validated"] is False
