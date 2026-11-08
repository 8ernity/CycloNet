"""Bounded user input; no client field can certify an observation."""
from typing import Literal, Annotated
from pydantic import BaseModel, ConfigDict, Field, model_validator

class StrictInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)

class HistoryMessage(StrictInput):
    role: Literal['user', 'assistant', 'model']
    content: str = Field(max_length=2000)

class DisplayContext(StrictInput):
    page: str = Field(default='', max_length=80)
    selected_system_id: str | None = Field(default=None, max_length=120)

class ChatMessageRequest(StrictInput):
    message: str = Field(min_length=1, max_length=3000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=8)
    ui_context: DisplayContext | None = None

class StormScenario(StrictInput):
    name: str = Field(default='Unnamed scenario', max_length=120)
    category: str | None = Field(default=None, max_length=80)
    basin: str | None = Field(default=None, max_length=80)
    intensity_knots: float | None = Field(default=None, ge=0, le=350)
    wind_kmh: float | None = Field(default=None, ge=0, le=648.2)
    surge_m: float | None = Field(default=None, ge=-5, le=25)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)

class BriefingRequest(StrictInput):
    mode: Literal['SCENARIO', 'OBSERVATION']
    system_id: str | None = Field(default=None, max_length=120)
    storm_data: StormScenario | None = None
    language: Literal['en', 'hi', 'bn', 'te', 'ta', 'or', 'gu'] = 'en'

    @model_validator(mode='after')
    def validate_mode(self):
        if self.mode == 'OBSERVATION' and (not self.system_id or self.storm_data is not None):
            raise ValueError('Observation mode requires system_id and forbids supplied weather values')
        if self.mode == 'SCENARIO' and (self.storm_data is None or self.system_id is not None):
            raise ValueError('Scenario mode requires storm_data only')
        return self

class BriefingResponse(StrictInput):
    executive_summary: str = Field(max_length=4000)
    surge_inundation_threat: str = Field(max_length=1500)
    grid_substation_vulnerabilities: str = Field(max_length=1500)
    evacuation_corridors: str = Field(max_length=1500)
    shelter_readiness: str = Field(max_length=1500)
    parametric_payout_recommendation: str = Field(max_length=1500)
    action_checklist: list[Annotated[str, Field(max_length=500)]] = Field(max_length=8)
