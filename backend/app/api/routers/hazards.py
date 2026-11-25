"""Google Earth Engine catalog and hydrodynamic storm surge scenario endpoints."""

from fastapi import APIRouter, Query, Request, Response

from app.core.rate_limit import enforce_rate_limit
from app.services.gee_service import gee_service
from app.services.surge_service import surge_service

router = APIRouter()


@router.get("/gee/layers")
async def get_gee_layers():
    """Return catalog of Google Earth Engine (GEE) multispectral observation layers."""
    return {
        "status": "success",
        "gee_project": gee_service.gee_project_id,
        "is_cloud_initialized": gee_service.is_initialized,
        "layers": gee_service.get_available_layers(),
    }


@router.get("/gee/flood-inundation")
async def get_gee_flood_inundation(
    req: Request,
    response: Response,
    lat: float = Query(18.2, ge=-90.0, le=90.0),
    lon: float = Query(84.8, ge=-180.0, le=180.0),
    knots: int = Query(85, ge=0, le=350),
):
    """Return experimental ellipse flood scenarios; no satellite observations."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return gee_service.get_flood_inundation_zones(lat, lon, knots)


@router.get("/gee/rainfall-pathways")
async def get_gee_rainfall_pathways(
    req: Request,
    response: Response,
    lat: float = Query(18.2, ge=-90.0, le=90.0),
    lon: float = Query(84.8, ge=-180.0, le=180.0),
    rain_mm: float = Query(280.0, ge=0.0, le=2500.0),
):
    """Generate assumed-terrain catchment runoff pathway simulation and drainage choke points."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return {
        "status": "success",
        "mode": "ASSUMED_TERRAIN_RUNOFF_SIMULATION",
        "method": "Assumed-terrain catchment runoff pathway simulation",
        "center": [lat, lon],
        "rain_accumulation_mm": rain_mm,
        "pathways": gee_service.get_catchment_rainfall_pathways(lat, lon, rain_mm),
    }


@router.get("/surge/calculate")
async def calculate_storm_surge(
    req: Request,
    response: Response,
    knots: float = Query(85.0, ge=0.0, le=350.0),
    pressure_hpa: float = Query(965.0, ge=800.0, le=1050.0),
    forward_speed: float = Query(18.0, ge=0.0, le=150.0),
    angle_deg: float = Query(75.0, ge=0.0, le=360.0),
    tide_m: float = Query(1.2, ge=-5.0, le=15.0),
    basin: str = Query("Bay of Bengal", max_length=50),
):
    """Calculate peak hydrodynamic storm surge and inland inundation using the Jelesnianski formulation."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return surge_service.calculate_surge(
        intensity_knots=knots,
        central_pressure_hpa=pressure_hpa,
        forward_speed_kmh=forward_speed,
        approach_angle_deg=angle_deg,
        astronomical_tide_m=tide_m,
        basin=basin,
    )


@router.get("/surge/profile")
async def get_coastal_surge_profile(
    req: Request,
    response: Response,
    name: str = Query("Cyclone", max_length=100),
    lat: float = Query(18.2, ge=-90.0, le=90.0),
    lon: float = Query(84.8, ge=-180.0, le=180.0),
    knots: int = Query(85, ge=0, le=350),
):
    """Return illustrative coastal surge profile; not observed water levels or asset conditions."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return {
        "status": "success",
        "cyclone_name": name,
        "sectors": surge_service.generate_coastal_surge_profile(name, lat, lon, knots),
    }
