"""Image Agent — validates and processes uploaded images."""

import base64
import io
import logging

from PIL import Image
from langchain_core.messages import AIMessage
from langsmith import traceable

logger = logging.getLogger("image_agent")

MAX_IMAGE_SIZE_MB = 10
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "TIFF", 'AVIF', 'GIF'}


@traceable(run_type="chain", name="image_agent")
def image_agent(state: dict) -> dict:
    """
    Validates the image in state. Images arrive as base64 set by the
    API/WebSocket handler that received the file upload.
    """
    image_b64 = state.get("image_b64")

    if not image_b64:
        logger.info("image_agent | no image in state")
        return {
            "messages": [AIMessage(content=(
                "I don't see an image yet. Please upload one by dragging and "
                "dropping into the chat or clicking the upload button."
            ))],
        }

    try:
        image_bytes = base64.b64decode(image_b64)

        # Size check
        size_mb = len(image_bytes) / (1024 * 1024)
        if size_mb > MAX_IMAGE_SIZE_MB:
            logger.warning("image_agent | image too large: %.1f MB", size_mb)
            return {
                "image_b64": None,
                "error": f"Image too large ({size_mb:.1f}MB)",
                "messages": [AIMessage(content=(
                    f"That image is {size_mb:.1f}MB, which exceeds the "
                    f"{MAX_IMAGE_SIZE_MB}MB limit. Could you upload a smaller version?"
                ))],
            }

        image = Image.open(io.BytesIO(image_bytes))

        # Format check
        if image.format and image.format not in SUPPORTED_FORMATS:
            logger.warning("image_agent | unsupported format: %s", image.format)
            return {
                "image_b64": None,
                "error": f"Unsupported format: {image.format}",
                "messages": [AIMessage(content=(
                    f"I can't process {image.format} images. "
                    "Please use PNG, JPEG, or WEBP."
                ))],
            }

        image = image.convert("RGB")
        width, height = image.size
        logger.info("image_agent | validated %dx%d (%s, %.2f MB)", width, height, image.format or "RGB", size_mb)

        # Routing is handled by join_slots; just produce an informational message
        has_palette = (
            state.get("palette") is not None
            and len(state.get("palette", [])) == 6
        )

        if has_palette:
            msg = (
                f"Image received ({width}x{height}). You already have a "
                "palette ready — running recolorization now."
            )
        else:
            msg = (
                f"Image received ({width}x{height}). Now let's build a palette!\n\n"
                "You can:\n"
                "- Describe a mood or theme (e.g., 'warm autumn colors')\n"
                "- Provide specific hex codes (e.g., #FF6B6B #4ECDC4 ...)\n"
                "- Ask me to extract colors from this image\n"
                "- Say 'suggest' and I'll generate some options"
            )

        return {
            "image_size": (width, height),
            "error": None,
            "messages": [AIMessage(content=msg)],
        }

    except Exception as e:
        logger.error("image_agent | failed to process image: %s", e)
        return {
            "image_b64": None,
            "error": f"Invalid image: {str(e)}",
            "messages": [AIMessage(content=(
                "I couldn't process that image. Please make sure it's a "
                "valid PNG, JPEG, or WEBP file."
            ))],
        }
