import io

from fastapi import HTTPException, UploadFile
from PIL import Image

MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024


async def read_validated_image_upload(
    file: UploadFile,
    *,
    content_type_error: str = "File must be an image",
) -> bytes:
    """Validate content type, enforce bounded upload read, and verify magic bytes/dimensions."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=content_type_error)

    image_bytes = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File size exceeds maximum allowable limit (15 MB).")

    try:
        validate_image_payload(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return image_bytes


def validate_image_payload(image_bytes: bytes) -> str:
    """
    SEC-08: Validates file signature (magic bytes) and dimensions.
    Rejects malformed images, unsupported formats, and decompression bombs.
    """
    if len(image_bytes) < 8:
        raise ValueError("Uploaded file is too small to be a valid image.")
    if image_bytes[:3] == b"\xff\xd8\xff":
        fmt = "JPEG"
    elif image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        fmt = "PNG"
    else:
        raise ValueError("Unsupported format: Only genuine JPEG and PNG image payloads are accepted.")

    Image.MAX_IMAGE_PIXELS = 16_000_000
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            w, h = img.size
            if w > 4096 or h > 4096:
                raise ValueError(f"Image dimensions ({w}x{h}) exceed maximum allowed dimensions (4096x4096).")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Corrupt or malformed image payload: {e}") from e
    return fmt
