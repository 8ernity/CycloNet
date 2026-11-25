"""CycloNet AI assistant, multimodal vision (gated), and scenario briefing endpoints."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.routers.cyclones import MAX_IMAGE_SIZE_BYTES
from app.api.schemas import ChatMessageResponse
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.inference_budget import run_inference
from app.core.rate_limit import enforce_rate_limit
from app.models.ai_requests import BriefingRequest, ChatMessageRequest
from app.services.chat_service import chat_service
from app.services.image_validation import validate_image_payload

router = APIRouter()


@router.post("/chat", response_model=ChatMessageResponse)
async def chat_with_cyclonet(
    request: ChatMessageRequest,
    req: Request,
    response: Response,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI chatbot endpoint for answering questions on tropical cyclones, Dvorak analysis, and platform data."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    enforce_rate_limit(req, endpoint_type="chat", user=current_user, response=response)
    return await run_inference(
        req,
        current_user,
        chat_service.ask,
        request.message,
        history=[m.model_dump() for m in request.history],
        db=db,
        ui_context=request.ui_context.model_dump() if request.ui_context else None,
    )


@router.post("/ai/analyze-multimodal")
async def analyze_multimodal_satellite(
    req: Request,
    response: Response,
    file: UploadFile = File(...),
    prompt: Optional[str] = Query(None, max_length=500),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    """Return disabled meteorological vision capability pending scientific validation."""
    enforce_rate_limit(req, endpoint_type="multimodal", user=current_user, response=response)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a satellite/radar image")

    image_bytes = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File size exceeds maximum allowable limit (15 MB).")

    try:
        validate_image_payload(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analysis = await run_inference(
        req,
        current_user,
        chat_service.analyze_satellite_image,
        image_bytes=image_bytes,
        mime_type=file.content_type,
        prompt=prompt,
    )
    return {"status": "success", "filename": file.filename, "analysis": analysis}


@router.post("/ai/pre-landfall-briefing")
async def generate_pre_landfall_briefing(
    req_body: BriefingRequest,
    req: Request,
    response: Response,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    """Summarize an explicit scenario or backend-resolved observation."""
    if req_body.mode == "OBSERVATION":
        from app.services.observation_context import basin_snapshot

        snapshot = basin_snapshot()
        storm = next((s for s in snapshot["systems"] if s["id"] == req_body.system_id), None)
        if storm is None:
            raise HTTPException(503, "Verified current observation unavailable")
    else:
        if req_body.storm_data is None:
            raise HTTPException(422, "Scenario storm data required")
        storm = req_body.storm_data.model_dump()

    enforce_rate_limit(req, endpoint_type="briefing", user=current_user, response=response)
    briefing = await run_inference(
        req,
        current_user,
        chat_service.generate_pre_landfall_briefing,
        storm_data=storm,
        infrastructure_data={},
        language=req_body.language,
        mode=req_body.mode,
    )
    return {"status": "success", "briefing": briefing}
