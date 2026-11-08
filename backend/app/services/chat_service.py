import os
import re
import json
import httpx
from datetime import datetime
from typing import Dict, List, Literal, Optional, Tuple
from pydantic import BaseModel, ConfigDict, ValidationError
from app.services.observation_context import basin_snapshot, source_status_text


class EducationalTopic(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    topic: Literal['cyclogenesis', 'dvorak', 'intensity_scales', 'coastal_hazards', 'source_status']


class MeteorologicalChatService:
    """
    Intelligent meteorological reasoning engine specialized in tropical cyclones,
    Dvorak intensity analysis, IMD/JTWC scales, disaster preparedness, and general atmospheric science.
    Optional configured language-model provider with historical archive context and deterministic source-status responses.
    """

    def __init__(self):
        self._load_local_env()
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.candidate_models = ["gemini-2.5-flash", "gemini-1.5-flash"]

    @staticmethod
    def _load_local_env():
        """Lightweight loader to read .env without hardcoded secrets in repository."""
        search_paths = [
            ".env",
            os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
            os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
        ]
        for env_path in search_paths:
            if os.path.exists(env_path):
                try:
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith("#") and "=" in line:
                                k, v = line.split("=", 1)
                                k = k.strip()
                                v = v.strip().strip("'\"")
                                if k and k not in os.environ:
                                    os.environ[k] = v
                except Exception:
                    pass

    def ask(self, message: str, history: Optional[List[Dict[str, str]]] = None, db=None, ui_context: Optional[Dict] = None) -> Dict:
        """
        Process a user question and return a structured expert answer with full UI screen context.
        """
        clean_msg = message.strip()
        if any(word in clean_msg.lower() for word in ('current', 'active', 'this storm', 'this cyclone', 'evacuat', 'safe', 'all clear', 'calm', 'status', 'warning', 'emergency', 'what to do', 'prepare', 'precaution', 'protect')):
            return {"response":source_status_text(basin_snapshot()), "category":"source_status",
                    "sources":[], "timestamp":datetime.utcnow().isoformat() + "Z"}
        timestamp = datetime.utcnow().strftime("%H:%M UTC")

        # 1. Check for specific historical storm queries in local database (from query or UI context)
        db_context = self._get_database_context(clean_msg, db, ui_context=ui_context) if db else None

        # 2. Try Gemini API first with rich meteorological system instructions and active UI telemetry
        if self.gemini_api_key:
            gemini_reply = self._call_gemini(clean_msg, history=history, db_context=db_context, ui_context=ui_context)
            if gemini_reply:
                return {
                    "response": gemini_reply,
                    "category": "educational_topic",
                    "sources": ["CycloNet fixed educational text; automated topic selection"],
                    "timestamp": timestamp
                }

        # 3. Direct DB match fallback if Gemini was offline
        if db_context:
            return {
                "response": db_context,
                "category": "database_telemetry",
                "sources": ["CycloNet Historical Archive (SQLite)"],
                "timestamp": timestamp
            }

        # 4. Built-in expert rule engine fallback
        response_text, category, sources = self._expert_reasoning(clean_msg, ui_context=ui_context)
        return {
            "response": response_text,
            "category": category,
            "sources": sources,
            "timestamp": timestamp
        }

    def _get_database_context(self, text: str, db, ui_context: Optional[Dict] = None) -> Optional[str]:
        """Queries local SQLite archive for specific storms mentioned by name or currently active on UI."""
        try:
            from app.models.domain import CycloneArchive
            words = re.findall(r'\b[A-Za-z]+\b', text)
            
            # Check user query first
            for word in words:
                if len(word) >= 3 and word.lower() not in {"what", "when", "tell", "cyclone", "storm", "info", "about", "show", "give", "how", "why", "this", "that"}:
                    record = db.query(CycloneArchive).filter(CycloneArchive.name.ilike(f"%{word}%")).first()
                    if record:
                        return (
                            f"Historical catalog entry (not current conditions) for Cyclone {record.name} ({record.year}):\n"
                            f"- Storm Code: {record.id}\n"
                            f"- Basin: {record.basin}\n"
                            f"- Peak Intensity Category: {record.max_category}\n"
                            f"- Historical data available in CycloNet SQLite database (/archive route)."
                        )
            
        except Exception:
            return None
        return None

    def _clean_response(self, text: str) -> str:
        """Removes any unintentional meta-review, self-evaluation, or planning artifacts."""
        if not text:
            return ""
        patterns = [
            r"(?i)\n*(\*\*|###)?\s*Review against Persona.*$",
            r"(?i)\n*(\*\*|###)?\s*Self-Review.*$",
            r"(?i)\n*(\*\*|###)?\s*Persona & Formatting Verification.*$",
            r"(?i)\n*(\*\*|###)?\s*Checklist against.*$"
        ]
        cleaned = text
        for p in patterns:
            cleaned = re.sub(p, "", cleaned)
        return cleaned.strip()

    def _call_gemini(self, query: str, history: Optional[List[Dict[str, str]]] = None, db_context: Optional[str] = None, ui_context: Optional[Dict] = None) -> Optional[str]:
        """Select a bounded topic; never display provider-generated prose."""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.gemini_api_key}"
            
            system_prompt = (
                "Classify the question into one educational topic. Return ONLY a JSON object with "
                "one field: topic. Allowed values: cyclogenesis, dvorak, intensity_scales, "
                "coastal_hazards, source_status. Select source_status for any current conditions, "
                "personal safety, operational decisions, ambiguous requests, or requests outside "
                "the educational topics. Do not answer the question or add other fields."
            )

            contents = []
            if history:
                for item in history[-6:]:
                    role = "user" if item.get("role") == "user" else "model"
                    contents.append({
                        "role": role,
                        "parts": [{"text": item.get("content", "")}]
                    })

            contents.append({
                "role": "user",
                "parts": [{"text": query}]
            })

            payload = {
                "system_instruction": {
                    "parts": [{"text": system_prompt}]
                },
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 64,
                    "responseMimeType": "application/json"
                }
            }

            with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
                with client.stream("POST", url, json=payload, headers={"Content-Type":"application/json"}) as response:
                    response.raise_for_status()
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > 65536:
                            raise ValueError("AI response exceeded limit")
                    result = json.loads(body)
                    candidates = result.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0]["content"]["parts"][0]["text"]
                        if not isinstance(raw_text, str) or len(raw_text) > 256:
                            raise ValueError("AI output exceeded limit")
                        try:
                            selected = EducationalTopic.model_validate_json(raw_text)
                        except ValidationError:
                            return source_status_text(basin_snapshot())
                        topics = {'cyclogenesis':'cyclogenesis', 'dvorak':'dvorak',
                                  'intensity_scales':'classification', 'coastal_hazards':'coastal'}
                        if selected.topic == 'source_status':
                            return source_status_text(basin_snapshot())
                        return self._expert_reasoning(topics[selected.topic])[0]
        except Exception as e:
            print(f"[Gemini API Exception] {type(e).__name__}")
            pass
        return None

    def _expert_reasoning(self, query: str, ui_context: Optional[Dict] = None) -> Tuple[str, str, List[str]]:
        """Fixed educational text; no generated prose or echoed user instructions."""
        q = query.lower()
        if any(word in q for word in ('current', 'active', 'this storm', 'this cyclone', 'status',
                'evacuat', 'safe', 'calm', 'warning', 'emergency', 'prepare', 'precaution', 'protect', 'what to do')):
            return source_status_text(basin_snapshot()), 'source_status', []
        lessons = (
            (('coastal', 'coast', 'shore', 'beach', 'landfall', 'inundation'), 'coastal_hazards',
             'Coastal hazards: cyclone winds can drive storm surge, while waves, rainfall and river flooding can compound impacts. '
             'Water levels depend on the storm, tides and local coastal geometry. This explanation does not estimate a location’s flood depth or establish road, harbour or shelter conditions.'),
            (('dvorak', 't-number', 't number', 't-scale', 'pattern t'), 'dvorak_technique',
             'The Dvorak technique estimates tropical cyclone intensity from satellite cloud patterns. '
             'Applying it requires appropriate imagery, procedures and trained interpretation. '
             'CycloNet’s experimental visual classifier is not a calibrated wind measurement or an official Dvorak analysis.'),
            (('how do cyclones form', 'cyclogenesis', 'formation', 'causes', 'what causes a cyclone', 'how is a cyclone formed'), 'meteorological_physics',
             'Cyclogenesis is the development of a tropical cyclone. Ocean heat and moisture can support deep convection; '
             'rotation, an existing disturbance and the surrounding wind environment also influence development. '
             'These factors alone do not establish that a cyclone is present or will form.'),
            (('imd', 'scale', 'saffir', 'category', 'categories', 'classification'), 'intensity_scales',
             'Cyclone intensity classifications depend on the issuing agency and its wind-averaging convention. '
             'Keep the source, units and averaging interval with each measurement; categories from different scales are not automatically equivalent. '
             'CycloNet does not convert an unvalidated image classification into an official intensity category.'),
        )
        for keywords, category, text in lessons:
            if any(word in q for word in keywords):
                return 'General educational information — not a current assessment.\n\n' + text, category, ['CycloNet fixed educational text']
        return source_status_text(basin_snapshot()), 'source_status', []

    def analyze_satellite_image(self, image_bytes: bytes, mime_type: str = "image/jpeg", prompt: Optional[str] = None) -> Dict:
        """Withhold meteorological vision claims until independently validated.

        A general vision-language model is not a calibrated Dvorak instrument.
        The separate experimental classifier exposes its validation status.
        """
        return {
            "status":"ANALYSIS_UNAVAILABLE", "category":"Not independently validated",
            "dvorak_t_number":None, "intensity_knots":None, "estimated_wind_kmh":None,
            "central_pressure_hpa":None, "eye_characterization":"Not verified",
            "convective_signature":"Not verified", "shear_and_structure":"Not verified",
            "coastal_impact_level":"UNKNOWN", "recommended_actions":["Consult official meteorological advisories."],
            "timestamp":datetime.utcnow().isoformat()+"Z", "model_used":"DISABLED_PENDING_VALIDATION",
            "scientifically_validated":False, "is_fallback":True,
            "source":"User image; no verified acquisition metadata", "mode":"UNAVAILABLE"
        }

    def generate_pre_landfall_briefing(self, storm_data: Dict, infrastructure_data: Dict, language: str = "en", *, mode: str = "SCENARIO") -> Dict:
        # Safety-critical summaries are deterministic: language-model output cannot
        # introduce measured hazards or operational instructions into a briefing.
        from app.models.ai_requests import StormScenario, BriefingResponse
        fields = StormScenario.model_fields
        values = StormScenario.model_validate({k:v for k,v in storm_data.items() if k in fields}).model_dump()
        knots = values['intensity_knots']
        wind_kmh = values['wind_kmh']
        if wind_kmh is None and knots is not None:
            wind_kmh = round(knots * 1.852, 2)
        scenario = mode != 'OBSERVATION'
        source = 'USER_SCENARIO' if scenario else storm_data.get('source')
        summary = BriefingResponse(
            executive_summary=f"{'Experimental scenario' if scenario else 'Source observation summary'}: {values['name']}. Wind: {wind_kmh if wind_kmh is not None else 'Unavailable'} km/h. No operational assessment has been performed.",
            surge_inundation_threat='Not independently validated. No observed inundation is established.',
            grid_substation_vulnerabilities='Operational grid conditions unavailable.',
            evacuation_corridors='Road conditions unavailable; no routing recommendation is supported.',
            shelter_readiness='Operational shelter status not verified.',
            parametric_payout_recommendation='Not applicable: no contractual or funded policy has been verified.',
            action_checklist=['Consult current official advisories and authorized local responders.', 'Check observation timestamps and missing measurements.', 'Obtain authorized field verification before any operational decision.']
        ).model_dump()
        return {**summary, 'mode':'SCENARIO' if scenario else 'OBSERVATION', 'is_simulation':scenario,
                'scientifically_validated':False, 'source':source, 'intensity_knots':knots,
                'observation_time_utc':None if scenario else storm_data.get('observation_time_utc'),
                'model_method':'DETERMINISTIC_SOURCE_SUMMARY', 'uncertainty':'Not independently validated',
                'timestamp':datetime.utcnow().isoformat() + 'Z', 'model':'No generative operational assessment',
                'language':'en', 'requested_language':language}

chat_service = MeteorologicalChatService()
