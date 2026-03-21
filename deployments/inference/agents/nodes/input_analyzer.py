"""Input Analyzer — LLM-based execution planner.

Uses a small LLM to understand the user's intent and decide which
worker agents to dispatch, replacing the hardcoded PALETTE_INTENTS set.

Possible next_nodes values:
- ["chat_agent"]                      no actionable intent → loop back
- ["slot_checker"]                    recolor requested, both slots already filled
- ["image_agent"]                     need image processing
- ["palette_agent"]                   need palette generation
- ["image_agent", "palette_agent"]    parallel dispatch

When the user explicitly provides a complete palette, input_analyzer
sets it directly in state and removes palette_agent from the plan so
the sub-graph is never invoked.
"""

import json
import logging

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("input_analyzer")


# ── Dispatch prompt ───────────────────────────────────────────────────────────

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


# ── Explicit palette extraction ───────────────────────────────────────────────

_EXPLICIT_PALETTE_SYSTEM = """You are a color extraction assistant. Decide whether the user explicitly provided a complete, ready-to-use palette, and if so extract the colors.

A palette is "explicit" when the user clearly supplies specific color values (hex codes, RGB values) intending them to be used directly — not generated or interpreted from a description.

EXPLICIT examples:
- "Please use this palette: #FF0000, #00FF00, #0000FF, #FFFF00, #FF00FF, #00FFFF"
- "[Custom palette: #e63946, #457b9d, #2a9d8f, #e9c46a, #f4a261, #264653]"
- "use these colors: #aabbcc, #112233, #334455, #556677, #778899, #99aabb"
- "recolor with rgb(255,0,0), rgb(0,255,0), rgb(0,0,255), rgb(255,255,0), rgb(255,0,255), rgb(0,255,255)"

NOT explicit (user wants generation):
- "use warm sunset colors"
- "make it ocean vibes"
- "something neon and bright"
- "recolor with forest tones"

Respond with ONLY valid JSON — no explanation, no markdown:
- Explicit palette found: {"explicit": true, "colors": [[R,G,B], [R,G,B], [R,G,B], [R,G,B], [R,G,B], [R,G,B]]}
- Not explicit:           {"explicit": false}

The colors array must have exactly 6 [R, G, B] triplets (0-255)."""


def _extract_explicit_palette(message: str) -> list[list[int]] | None:
    """Use an LLM to check whether the message contains an explicit palette.

    Returns 6 RGB triplets if the user clearly provided colors to use as-is,
    or None if the palette should be generated / interpreted by palette_agent.
    """
    llm = ChatOllama(model="llama3.1:8b", temperature=0, num_predict=128)
    response = llm.invoke([
        SystemMessage(content=_EXPLICIT_PALETTE_SYSTEM),
        HumanMessage(content=message),
    ])
    raw = response.content.strip()
    logger.debug("Explicit palette LLM response: %s", raw[:200])

    try:
        # Strip markdown code fences if the model wraps in ```json ... ```
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        parsed = json.loads(raw)
        if not parsed.get("explicit"):
            return None

        colors = parsed.get("colors", [])
        if len(colors) == 6 and all(len(c) == 3 for c in colors):
            rgb = [[max(0, min(255, int(v))) for v in c] for c in colors]
            logger.info("Explicit palette extracted: %s", rgb)
            return rgb

        logger.warning("LLM returned explicit=true but colors malformed: %s", colors)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Could not parse explicit-palette response: %s | raw: %s", exc, raw[:100])

    return None


# ── Main node ─────────────────────────────────────────────────────────────────

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

    # ── Slot-override detection ─────────────────────────────────────────────
    # When both slots are already filled, check if the user wants to replace
    # one of them. Override the booleans so the dispatch LLM routes to the
    # correct agent instead of shortcutting to slot_checker with stale data.
    if has_image and has_palette:
        _IMAGE_CHANGE_INTENTS = {"upload_image"}
        _PALETTE_CHANGE_INTENTS = {
            "set_palette", "describe_palette", "adjust_palette",
            "variation", "extract_palette",
        }
        if any(i in intents for i in _IMAGE_CHANGE_INTENTS):
            logger.info(
                "Both slots filled but upload_image intent detected — "
                "treating has_image=False for dispatch"
            )
            has_image = False
        if any(i in intents for i in _PALETTE_CHANGE_INTENTS):
            logger.info(
                "Both slots filled but palette-change intent detected — "
                "treating has_palette=False for dispatch"
            )
            has_palette = False

    # ── Dispatch LLM ─────────────────────────────────────────────────────────
    dispatch_llm = ChatOllama(model="llama3.1:8b", temperature=0.0, num_predict=32)
    response = dispatch_llm.invoke([
        HumanMessage(content=DISPATCH_PROMPT.format(
            has_image=has_image,
            has_palette=has_palette,
            palette_size=palette_size,
            intents=", ".join(intents) if intents else "none",
            user_message=user_message,
        ))
    ])

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
        execution_plan = [a for a in execution_plan if a != "slot_checker"]
        if not has_image and "image_agent" not in execution_plan:
            execution_plan.append("image_agent")
        if not has_palette and "palette_agent" not in execution_plan:
            execution_plan.append("palette_agent")

    if not execution_plan:
        logger.info("No executable agents after guard → routing back to chat_agent")
        return {"next_nodes": ["chat_agent"]}

    # ── Explicit palette fast-path ────────────────────────────────────────────
    # Only check when the dispatch LLM thinks palette_agent is needed.
    # If the user supplied specific colors directly, set them in state now
    # and bypass palette_agent entirely.
    if "palette_agent" in execution_plan:
        explicit = _extract_explicit_palette(user_message)
        if explicit:
            logger.info(
                "Explicit palette set in state — removing palette_agent from plan"
            )
            execution_plan = [n for n in execution_plan if n != "palette_agent"]

            # If nothing else is left to run, let slot_checker assess the situation
            # (it will either trigger recolor or tell the user what is still missing)
            next_nodes = execution_plan if execution_plan else ["slot_checker"]

            return {
                "palette": explicit,
                "palette_source": "user_explicit",
                "next_nodes": next_nodes,
            }

    logger.info("Execution plan: %s", execution_plan)
    return {"next_nodes": execution_plan}
