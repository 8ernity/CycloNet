import io
from PIL import Image

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
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Corrupt or malformed image payload: {e}")
    return fmt

