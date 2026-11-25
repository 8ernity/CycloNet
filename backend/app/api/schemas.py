"""Shared Pydantic request/response contracts and provenance enums for API routes."""

import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


class Provenance(str, Enum):
    LIVE_OBSERVATION = "LIVE_OBSERVATION"
    OFFICIAL_FORECAST = "OFFICIAL_FORECAST"
    HISTORICAL_ARCHIVE = "HISTORICAL_ARCHIVE"
    EXPERIMENTAL_FORECAST = "EXPERIMENTAL_FORECAST"
    DEMO_SIMULATION = "DEMO_SIMULATION"
    UNKNOWN = "UNKNOWN"


class TrackPoint(BaseModel):
    provenance: Provenance = Provenance.UNKNOWN
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    time_offset_hours: int
    category: str
    intensity_knots: Optional[int] = Field(None, ge=0, le=350)
    is_forecast: bool = False
    is_landfall: bool = False
    is_observed: Optional[bool] = None
    origin_type: Optional[str] = None
    label: Optional[str] = None
    method: Optional[str] = None
    source: Optional[str] = None
    issue_time_utc: Optional[datetime.datetime] = None


class SystemResponse(BaseModel):
    provenance: Provenance = Provenance.UNKNOWN
    id: str
    name: str
    basin: str
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    intensity_knots: Optional[int] = Field(None, ge=0, le=350)
    central_pressure_hpa: Optional[float] = Field(None, ge=800, le=1100, allow_inf_nan=False)
    wind_convention: Optional[str] = None
    movement_speed_raw: Optional[float] = None
    movement_speed_source_unit: Optional[str] = None
    movement_speed_kmph: Optional[float] = Field(None, ge=0, le=200, allow_inf_nan=False)
    movement_direction: Optional[str] = None
    observation_time_utc: Optional[datetime.datetime] = None
    retrieved_at: Optional[datetime.datetime] = None
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    data_state: Optional[str] = None
    reconciliation_status: Optional[str] = None
    is_stale: bool = False
    is_simulation: bool = False
    is_live_telemetry: bool = False
    is_measured_observation: Optional[bool] = None
    source_type: Optional[str] = None
    origin_type: Optional[str] = None
    data_quality_status: Optional[str] = None
    category: str
    dvorak_t: Optional[str] = None
    dvorak_derivation_method: Optional[str] = None
    dvorak_is_empirical_estimate: Optional[bool] = None
    track_generation_method: Optional[str] = None
    telemetry_attribution: Optional[Dict[str, Any]] = None
    telemetry_badge: Optional[str] = None
    telemetry_type: Optional[str] = None
    source: Optional[str] = None
    track_forecast: List[TrackPoint] = Field(default_factory=list)
    landfall_info: Optional[Dict[str, Any]] = None
    is_landfall_completed: Optional[bool] = None

    @model_validator(mode="after")
    def explicit_provenance(self) -> "SystemResponse":
        if self.is_simulation:
            self.provenance = Provenance.DEMO_SIMULATION
        elif self.telemetry_type == "HISTORICAL_BEST_TRACK":
            self.provenance = Provenance.HISTORICAL_ARCHIVE
        elif self.is_live_telemetry:
            self.provenance = Provenance.LIVE_OBSERVATION

        for point in self.track_forecast:
            if self.is_simulation:
                point.provenance = Provenance.DEMO_SIMULATION
                point.is_observed = False
            elif self.provenance == Provenance.HISTORICAL_ARCHIVE:
                point.provenance = Provenance.HISTORICAL_ARCHIVE
            elif point.is_forecast:
                # No independently verified official forecast adapter is connected.
                point.provenance = Provenance.EXPERIMENTAL_FORECAST
                point.is_observed = False
            elif self.provenance == Provenance.LIVE_OBSERVATION:
                point.provenance = Provenance.LIVE_OBSERVATION
        return self


class IngestStatusResponse(BaseModel):
    status: str
    last_sync: Optional[str]
    is_syncing: bool
    active_systems_count: int
    sources_status: Dict[str, str]
    last_error: Optional[str] = None
    basin_status: str = "STATUS_UNCERTAIN"


class ChatMessageResponse(BaseModel):
    response: str
    category: str
    sources: List[str]
    timestamp: str


class BroadcastRequest(BaseModel):
    system_id: Optional[str] = None
    alert_type: str = "EVACUATION_WARNING"
    channels: List[str] = ["sms", "siren", "vhf", "sachet"]


class AlertDispatchRequest(BaseModel):
    region: str = Field("Sundarbans Coastal Belt", max_length=120)
    risk_level: str = Field("CRITICAL", max_length=30)
    surge: float = Field(3.4, ge=-5.0, le=25.0)
    wind: float = Field(125.0, ge=0.0, le=400.0)
    channels: List[str] = ["CAP", "SMS", "SACHET", "SIREN", "VHF"]
    cyclone_name: Optional[str] = Field("Active Cyclone", max_length=100)
