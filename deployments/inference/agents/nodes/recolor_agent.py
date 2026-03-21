"""Recolor Agent — runs the recolorization model and returns the result."""

import base64
import io
import sys
import os

import logging

import torch
from PIL import Image
from langchain_core.messages import AIMessage
from langsmith import traceable

logger = logging.getLogger("recolor_agent")
sys.path.append("../")
from tools.palette_utils import palette_to_hex

# Add inference directory to path so we can import infer.py
_INFERENCE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, _INFERENCE_DIR)

# Singleton model
_model = None
_device = None


def _get_model():
    global _model, _device
    if _model is None:
        from infer import load_model

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        model_path = os.path.join(_INFERENCE_DIR, "checkpoint", "checkpoint_epoch_90.pt")
        _model = load_model(model_path, _device)
    return _model, _device

@traceable(run_type="chain", name="recolor_agent")
def recolor_agent(state: dict) -> dict:
    image_b64 = state.get("image_b64")
    palette = state.get("palette")
    logger.info("recolor_agent | starting | has_image=%s has_palette=%s", bool(image_b64), bool(palette and len(palette) == 6))
    if not image_b64:
        return {
            "next_node": "respond",
            "error": "No image available",
            "messages": [AIMessage(content="I need an image to recolor. Please upload one.")],
        }

    if not palette or len(palette) != 6:
        return {
            "next_node": "palette_agent",
            "error": "Palette incomplete",
            "messages": [AIMessage(content=(
                "The palette needs exactly 6 colors. Let me help you build one."
            ))],
        }

    try:
        from infer import recolor_image

        model, device = _get_model()
        logger.info("recolor_agent | model ready on %s", device)

        # Decode image
        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        logger.info("recolor_agent | running inference on %dx%d image", image.width, image.height)

        # Run inference
        output_image = recolor_image(
            model=model,
            image=image,
            palette_rgb=palette,
            device=device,
        )

        # Encode result
        buf = io.BytesIO()
        output_image.save(buf, format="PNG")
        result_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        recolor_count = state.get("recolor_count", 0) + 1
        palette_hex = palette_to_hex(palette)
        logger.info("recolor_agent | complete | attempt #%d | palette %s", recolor_count, palette_hex)

        msg = (
            f"Recolorization complete (attempt #{recolor_count}).\n\n"
            f"Palette used: {palette_hex}\n\n"
            "How does it look? You can:\n"
            "- Say 'warmer' / 'cooler' / 'more vibrant' to adjust the palette\n"
            "- Pick a completely new palette and recolor again\n"
            "- Say 'download' to save the result"
        )

        return {
            "result_b64": result_b64,
            "recolor_count": recolor_count,
            "next_node": "respond",
            "error": None,
            "messages": [AIMessage(content=msg)],
        }

    except Exception as e:
        logger.error("recolor_agent | inference failed: %s", e)
        return {
            "next_node": "respond",
            "error": f"Recolorization failed: {str(e)}",
            "messages": [AIMessage(content=(
                f"Something went wrong during recolorization: {str(e)}. "
                "Let me know if you'd like to try again."
            ))],
        }
