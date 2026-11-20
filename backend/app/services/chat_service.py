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
        timestamp = datetime.utcnow().strftime("%H:%M UTC")

        # Operational emergency/all-clear queries must return the verified source status
        operational_query = any(phrase in clean_msg.lower() for phrase in (
            'current storm status', 'current status', 'live status', 'basin status',
            'can i return home', 'return home', 'all clear', 'is it safe to sail',
            'is the harbour clear', 'evacuation order', 'mandatory evacuation'
        ))
        if operational_query:
            return {"response": source_status_text(basin_snapshot()), "category": "source_status",
                    "sources": [], "timestamp": datetime.utcnow().isoformat() + "Z"}

        # 1. Check for specific historical or active storm queries in local database (from query or UI context)
        db_context = self._get_database_context(clean_msg, db, ui_context=ui_context) if db else None

        # 2. Try Gemini API first with rich meteorological system instructions and active UI telemetry
        if self.gemini_api_key and self.gemini_api_key.startswith("AIzaSy"):
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
                "sources": ["CycloNet historical catalog; not current observations"],
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
        """Queries the catalog for storms mentioned by name or actively selected in the interface."""
        try:
            from app.models.domain import CycloneArchive
            q_lower = text.lower()
            words = re.findall(r'\b[A-Za-z0-9\-]+\b', text)
            stop_words = {
                "what", "when", "tell", "cyclone", "storm", "info", "about", "show",
                "give", "how", "why", "this", "that", "the", "please", "explain", "describe",
                "details", "data", "view", "system", "active"
            }

            # 1. Check user query first for explicitly mentioned storm name or code
            for word in words:
                if len(word) >= 3 and word.lower() not in stop_words:
                    record = db.query(CycloneArchive).filter(
                        (CycloneArchive.name.ilike(f"%{word}%")) | (CycloneArchive.id.ilike(f"%{word}%"))
                    ).first()
                    if record:
                        return self._format_storm_record(record)

            # 2. If query asks generally about "the cyclone", "this storm", "selected cyclone", check UI context
            refers_to_active = any(w in q_lower for w in (
                "the cyclone", "this cyclone", "the storm", "this storm", "selected",
                "active system", "active storm", "about the cyclone", "tell me about",
                "cyclone", "storm"
            ))
            if refers_to_active and ui_context:
                target_name = (ui_context.get("selectedCycloneName") or
                               ui_context.get("selected_system_name") or
                               ui_context.get("activeCycloneName") or
                               (ui_context.get("activeSystem") or {}).get("name") or "").strip()
                target_id = (ui_context.get("selectedCycloneId") or
                             ui_context.get("selected_system_id") or
                             ui_context.get("activeCycloneId") or
                             (ui_context.get("activeSystem") or {}).get("id") or "").strip()

                if target_id or target_name:
                    record = None
                    if target_id:
                        record = db.query(CycloneArchive).filter(CycloneArchive.id == target_id).first()
                    if not record and target_name:
                        cleaned_name = re.sub(r'(?i)\bcyclone\b', '', target_name).strip()
                        if cleaned_name:
                            record = db.query(CycloneArchive).filter(CycloneArchive.name.ilike(f"%{cleaned_name}%")).first()
                    if record:
                        return self._format_storm_record(record, is_contextual=True)

        except Exception:
            return None
        return None

    def _format_storm_record(self, record, is_contextual: bool = False) -> str:
        is_simulation = bool(
            record.id.startswith("LIVE-GDACS") or
            "murasu" in record.name.lower() or
            "arnab" in record.name.lower() or
            "synthetic" in (record.max_category or "").lower()
        )
        context_prefix = "Selected system on dashboard" if is_contextual else "Historical catalog entry"
        mode_label = "Demonstration exercise drill scenario (synthetic telemetry)" if is_simulation else "Verified historical catalog record"
        return (
            f"### 🌀 {record.name} ({record.year or '2026'})\n\n"
            f"- **Source Reference**: {context_prefix} (`{record.id}`)\n"
            f"- **System Type**: {mode_label}\n"
            f"- **Ocean Basin**: {record.basin or 'North Indian Ocean / Bay of Bengal'}\n"
            f"- **Intensity Category**: {record.max_category or 'Severe Cyclonic Storm'}\n"
            f"- **Telemetry & Mapping**: Track coordinates, wind radii, and hydrodynamic surge modeling for this system are active on the **Live Monitoring** and **Surge Simulation** dashboards.\n\n"
            f"*(Note: For real-time active storm safety and civil advisories, always consult official bulletins from the India Meteorological Department (IMD) or RSMC).* "
        )

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

            with httpx.Client(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
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
        """Fixed educational text; scientifically grounded meteorological intelligence."""
        q = query.lower()
        if any(p in q for p in ('current storm status', 'current status', 'live status', 'can i return home', 'all clear', 'is it safe to sail', 'evacuation order')):
            return source_status_text(basin_snapshot()), 'source_status', []

        lessons = (
            (('hello', 'hi', 'hey', 'help', 'who are you', 'what can you do', 'what is cyclonet'), 'general_assistance',
             'Welcome to CycloNet Meteorological Intelligence. I can answer questions about tropical cyclogenesis, '
             'the Dvorak satellite intensity estimation technique, cyclone classification scales (IMD and Saffir-Simpson), '
             'coastal storm surge physics, disaster preparedness, and historical storm records from our catalog.\n\n'
             'You can ask me questions like:\n'
             '- "What is the Dvorak technique?"\n'
             '- "How do tropical cyclones form?"\n'
             '- "Explain IMD vs Saffir-Simpson intensity scales."\n'
             '- "What causes coastal storm surge?"\n'
             '- "How to prepare for a cyclone?"\n'
             '- Or mention a specific storm name (e.g., Amphan, Fani, Biporjoy) for catalog records.'),

            (('prepare', 'precaution', 'safety', 'how to prepare', 'what precautions', 'protect', 'what to do', 'emergency kit', 'shelter'), 'disaster_preparedness',
             '### 🛡️ Tropical Cyclone Preparedness & Safety Protocol (Educational Guidelines)\n\n'
             '#### ⚠️ 1. Pre-Landfall Phase (48–24 Hours Prior):\n'
             '- **Track Official Bulletins**: Rely exclusively on verified meteorological forecasts issued by official authorities (IMD / NDMA).\n'
             '- **Secure Structures**: Reinforce windows, secure loose outdoor objects, corrugated tin sheets, and untethered outdoor equipment.\n'
             '- **Emergency Go-Bag**: Prepare non-perishable food, clean bottled drinking water (3 liters/person/day for 3 days), battery-powered torch, extra batteries, power banks, and essential medications in waterproof containers.\n'
             '- **Evacuation**: Comply promptly with mandatory evacuation directives from district disaster management authorities if in low-lying coastal flood zones.\n\n'
             '#### 🌀 2. During Landfall:\n'
             '- **Stay Indoors**: Remain in the most interior, windowless room on ground level.\n'
             '- **Beware the Eye**: If winds suddenly subside and skies brighten, **do NOT venture outside**; violent cyclonic winds will resume abruptly from the reverse direction.\n'
             '- **Utilities**: Disconnect main electrical breakers and shut off gas cylinders.\n\n'
             '#### 🌊 3. Post-Landfall Phase:\n'
             '- Avoid fallen power lines, compromised masonry, and flooded roadways.\n'
             '- Boil or purify all drinking water until civil authorities certify municipal supplies.'),

            (('how do cyclones form', 'cyclogenesis', 'formation', 'causes', 'what causes a cyclone', 'how is a cyclone formed', 'genesis'), 'meteorological_physics',
             '### 🌊 Tropical Cyclogenesis & Formation Conditions\n\n'
             'Tropical cyclogenesis is the thermodynamic and dynamical process where a pre-existing atmospheric disturbance intensifies into a cyclone. '
             'Six primary environmental conditions (Gray’s Parameters) must be simultaneously met:\n\n'
             '1. **Thermal Ocean Energy**: Sea surface temperatures (SST) must equal or exceed **26.5°C** through an ocean mixed layer of at least 50 meters depth.\n'
             '2. **Atmospheric Instability**: Abundant moisture in the middle troposphere (700 hPa) to sustain deep convective updrafts.\n'
             '3. **Low Vertical Wind Shear**: Weak difference between surface and upper-tropospheric winds (<10 m/s or <20 kts) to prevent the convective vortex from tilting and breaking apart.\n'
             '4. **Coriolis Force**: Sufficient planetary vorticity (typically at least 5° latitude north or south of the equator) to initiate rotational spin.\n'
             '5. **Pre-existing Disturbance**: A low-level convective seed or tropical wave with cyclonic spin and inflow convergence.\n'
             '6. **Upper-level Divergence**: Anticyclonic outflow aloft to exhaust rising air and sustain core low surface pressure.'),

            (('coastal', 'coast', 'shore', 'beach', 'landfall', 'inundation', 'surge', 'storm surge', 'tide', 'bathymetry'), 'coastal_hazards',
             '### 🌊 Hydrodynamic Storm Surge & Coastal Inundation\n\n'
             'Storm surge represents the abnormal rise in sea level above astronomical tide, driven by cyclonic forces:\n\n'
             '- **Wind-Driven Piling**: Strong, persistent onshore winds drag water across the sea surface, physically mounding water against the coastline.\n'
             '- **Inverted Barometer Effect**: Extremely low central atmospheric pressure inside the cyclone eye allows the ocean surface to dome upward (~1 cm rise for each 1 hPa pressure drop).\n'
             '- **Shelf Bathymetry**: Shallow, funneling continental shelves (such as the northern Bay of Bengal) amplify surge heights dramatically.\n'
             '- **Compound Flooding**: The destructive peak occurs when maximum storm surge coincides with astronomical spring high tide and heavy inland river runoff.'),

            (('dvorak', 't-number', 't number', 't-scale', 'pattern t'), 'dvorak_technique',
             '### 🛰️ The Dvorak Satellite Intensity Estimation Technique\n\n'
             'Developed by Vernon Dvorak, this subjective pattern-recognition technique estimates tropical cyclone intensity '
             'from geostationary satellite visible and enhanced infrared (EIR) imagery:\n\n'
             '- **T-Numbers (T1.0 to T8.0)**: Relate cloud pattern characteristics to maximum sustained wind speed and central pressure.\n'
             '- **Pattern Types**: Curved band patterns, shear patterns, central dense overcast (CDO), and embedded eye patterns.\n'
             '- **Eyewall Temperature Contrast**: Evaluates the temperature delta between the warm eye center and the coldest surrounding cloud-top ring.\n'
             '- *Note*: Automated neural network classifiers provide experimental assistance; official intensity determinations remain calibrated by trained meteorologists at regional warning centers.'),

            (('imd', 'scale', 'saffir', 'category', 'categories', 'classification', 'wind speed', 'knots'), 'intensity_scales',
             '### 📊 Cyclone Intensity Scales: IMD vs. Saffir-Simpson\n\n'
             'Different meteorological basins use different wind-averaging standards:\n'
             '- **IMD (North Indian Ocean)**: Based on **3-minute sustained wind speeds**.\n'
             '- **Saffir-Simpson (NHC / Atlantic & East Pacific)**: Based on **1-minute sustained wind speeds** (~12% higher due to shorter averaging window).\n\n'
             '| IMD Classification | Sustained Wind (kt) | Sustained Wind (km/h) | Saffir-Simpson Equivalent |\n'
             '|---|---|---|---|\n'
             '| **Depression (D)** | 17–27 kt | 31–49 km/h | Tropical Depression |\n'
             '| **Deep Depression (DD)** | 28–33 kt | 50–61 km/h | Tropical Depression |\n'
             '| **Cyclonic Storm (CS)** | 34–47 kt | 62–88 km/h | Tropical Storm |\n'
             '| **Severe Cyclonic Storm (SCS)** | 48–63 kt | 89–117 km/h | Severe Tropical Storm |\n'
             '| **Very Severe Cyclonic Storm (VSCS)** | 64–89 kt | 118–166 km/h | Category 1–2 Hurricane |\n'
             '| **Extremely Severe Cyclonic Storm (ESCS)** | 90–119 kt | 167–221 km/h | Category 3–4 Major Hurricane |\n'
             '| **Super Cyclonic Storm (SuCS)** | ≥120 kt | ≥222 km/h | Category 5 Hurricane |'),

            (('tell me about the cyclone', 'tell me about cyclones', 'what is a cyclone', 'what is a tropical cyclone',
              'cyclone', 'cyclones', 'tropical cyclone', 'tropical storm', 'typhoon', 'hurricane', 'meteorology'), 'cyclone_fundamentals',
             '### 🌀 What is a Tropical Cyclone?\n\n'
             'A tropical cyclone is an organized, rotating low-pressure atmospheric weather system characterized by a warm central core, '
             'closed low-level atmospheric circulation, high-velocity winds, and a spiral arrangement of thunderstorms producing torrential precipitation:\n\n'
             '- **Structural Anatomy**:\n'
             '  - **The Eye**: A roughly circular, relatively calm center (typically 20–50 km across) characterized by light winds and descending air.\n'
             '  - **The Eyewall**: The dense ring of deep convective clouds immediately surrounding the eye, harboring the system’s maximum sustained winds and heaviest rainfall.\n'
             '  - **Spiral Rainbands**: Outer bands of cloud and precipitation that spiral inwards toward the eyewall, causing intermittent squalls.\n\n'
             '- **Key Hazards**:\n'
             '  1. **Destructive Winds**: Sustained surface winds exceeding 62 km/h (Cyclonic Storm) up to >220 km/h (Super Cyclonic Storm).\n'
             '  2. **Hydrodynamic Storm Surge**: Extreme sea-level rise driven by onshore wind stress and low central pressure, causing coastal inundation.\n'
             '  3. **Torrential Rainfall**: Severe precipitation leading to rapid flash flooding and river overflow.\n\n'
             '- **Monitoring & Tracking**: CycloNet tracks storms using geostationary satellite infrared cloud patterns (Dvorak technique), '
             'coastal Doppler Weather Radar sweeps, and hydrodynamic surge modeling.\n\n'
             '*(For real-time operational safety warnings, always refer to the India Meteorological Department (IMD) or RSMC).*'),
        )

        for keywords, category, text in lessons:
            if any(word in q for word in keywords):
                return text, category, ['CycloNet Meteorological Knowledge Base']

        # Informative educational fallback instead of raw error codes
        fallback_text = (
            '### 🌪️ CycloNet Meteorological Intelligence\n\n'
            'I can provide scientific explanations and telemetry analysis across these key areas:\n\n'
            '- **Tropical Cyclones**: Ask "What is a cyclone?" or "How do tropical cyclones form?"\n'
            '- **Intensity & Scales**: Ask "Explain IMD vs Saffir-Simpson scales" or "What is a Severe Cyclonic Storm?"\n'
            '- **Satellite Analysis**: Ask "How does the Dvorak technique work?"\n'
            '- **Coastal Hazards**: Ask "What causes hydrodynamic storm surge?"\n'
            '- **Preparedness**: Ask "How to prepare for a cyclone?"\n'
            '- **Historical Catalog**: Type any storm name (e.g., Amphan, Fani, Biparjoy, Murasu) for catalog details.\n\n'
            '*(For official live operational advisories and civil defense directives, consult the India Meteorological Department).*'
        )
        return fallback_text, 'general_assistance', ['CycloNet Meteorological Knowledge Base']

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
