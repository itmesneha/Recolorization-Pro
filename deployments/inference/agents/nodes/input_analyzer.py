"""Input Analyzer — LLM-based execution planner.

Uses a small LLM to understand the user's intent and decide which
worker agents to dispatch, replacing the hardcoded PALETTE_INTENTS set.

Possible next_nodes values:
- ["chat_agent"]                      no actionable intent → loop back
- ["slot_checker"]                    recolor requested, both slots already filled
- ["image_agent"]                     need image processing
- ["palette_agent"]                   need palette generation
- ["image_agent", "palette_agent"]    parallel dispatch
"""

import logging

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

logger = logging.getLogger("input_analyzer")

DISPATCH_PROMPT = """You are routing a recolorization pipeline. Decide which agents need to run.

State:
- Image uploaded: {has_image}
- Palette ready: {has_palette} ({palette_size}/6 colors)
- Classified intents: {intents}
- User message: "{user_message}"

Agents you can dispatch:
- image_agent   → user is uploading or referencing an image
- palette_agent → user wants to set, describe, extract, adjust, or vary colors/palette only if user has talked about palette
- slot_checker  → user wants to recolor AND image is already uploaded AND palette is already ready
- none          → general chat, no action needed

Reply with ONLY agent names separated by commas, or "none". No explanation.

Examples:
"here's my photo" → image_agent
"use warm sunset colors" → palette_agent
"recolor it" (image=True, palette=True) → slot_checker
"recolor it" (image=False, palette=False) → image_agent,palette_agent
"upload image and use ocean blues" → image_agent,palette_agent
"what can you do?" → none

Agents:"""


def _last_human_message(state: dict) -> str:
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            return msg.content
    return ""


def input_analyzer(state: dict) -> dict:
    intents = state.get("user_intents", [])
    has_image = state.get("image_b64") is not None
    has_palette = (
        state.get("palette") is not None
        and len(state.get("palette", [])) == 6
    )
    palette_size = len(state.get("palette") or [])
    user_message = _last_human_message(state)

    logger.info(
        "input_analyzer | intents=%s, has_image=%s, has_palette=%s",
        intents, has_image, has_palette,
    )

    llm = ChatOllama(model="llama3.1:8b", temperature=0.0, num_predict=32)

    response = llm.invoke([
        HumanMessage(content=DISPATCH_PROMPT.format(
            has_image=has_image,
            has_palette=has_palette,
            palette_size=palette_size,
            intents=", ".join(intents) if intents else "none",
            user_message=user_message,
        ))
    ])

    # Take only the first line in case the model adds explanation
    raw = response.content.strip().lower().split("\n")[0]
    logger.info("LLM dispatch response: %r", raw)

    VALID_AGENTS = {"image_agent", "palette_agent", "slot_checker"}

    if raw == "none" or not raw:
        logger.info("No actionable intent → routing back to chat_agent")
        return {"next_nodes": ["chat_agent"]}

    parsed = [a.strip() for a in raw.split(",")]
    execution_plan = [a for a in parsed if a in VALID_AGENTS]

    if not execution_plan:
        logger.warning("Unrecognized LLM output (%r) → falling back to chat_agent", raw)
        return {"next_nodes": ["chat_agent"]}

    # slot_checker is only valid when both slots are actually filled —
    # enforce this in code regardless of what the LLM said
    if "slot_checker" in execution_plan:
        if has_image and has_palette:
            logger.info("Recolor shortcut: both slots filled → slot_checker")
            return {"next_nodes": ["slot_checker"]}
        # Slots not ready — swap slot_checker for the missing prerequisites
        execution_plan = [a for a in execution_plan if a != "slot_checker"]
        if not has_image and "image_agent" not in execution_plan:
            execution_plan.append("image_agent")
        if not has_palette and "palette_agent" not in execution_plan:
            execution_plan.append("palette_agent")

    if not execution_plan:
        logger.info("No executable agents after guard → routing back to chat_agent")
        return {"next_nodes": ["chat_agent"]}

    logger.info("Execution plan: %s", execution_plan)
    return {"next_nodes": execution_plan}
