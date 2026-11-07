from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class FeedStatus(str, Enum):
    HEALTHY = "HEALTHY"
    NO_ACTIVE_STORMS = "NO_ACTIVE_STORMS"
    STALE = "STALE"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"
    UNAVAILABLE = "UNAVAILABLE"

class FeedResult(BaseModel):
    source: str = Field(..., description="Meteorological agency or service identifier (e.g. IMD_RSMC, GDACS, JTWC)")
    status: FeedStatus = Field(..., description="Operational status of the source feed")
    systems: List[Dict[str, Any]] = Field(default_factory=list, description="Verified active cyclone telemetry dictionaries")
    observed_at: Optional[datetime] = Field(default=None, description="Actual physical observation timestamp reported in bulletin")
    retrieved_at: datetime = Field(default_factory=datetime.utcnow, description="System retrieval timestamp")
    error: Optional[str] = Field(default=None, description="Error message if feed failed or degraded")
    document_id: Optional[str] = Field(default=None, description="Bulletin or message reference number")
    source_url: Optional[str] = Field(default=None, description="Source endpoint URL queried")
    coverage: List[str] = Field(default_factory=list)
    complete_coverage: bool = False
    calm_evidence: bool = False
