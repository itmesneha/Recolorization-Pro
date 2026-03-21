"""FastAPI router for the agent chat system — REST + WebSocket endpoints."""

import asyncio
import json
import logging
import threading
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.types import Command

from graph import app_graph
from session import get_or_create_session, get_session

# ── Log streaming helpers ──────────────────────────────────────────────────────

_LOG_TARGETS = [
    "chat_agent", "input_analyzer", "image_agent",
    "palette_agent", "slot_checker", "recolor_agent", "routing",
]


class _StreamHandler(logging.Handler):
    """Captures INFO+ log records into a plain list (thread-safe via GIL)."""

    def __init__(self) -> None:
        super().__init__(level=logging.INFO)
        self.records: list[dict] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append({
            "logger": record.name,
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
        })

agent_router = APIRouter(prefix="/agent", tags=["agent"])


# --- Helpers ---
def _run_graph(
    session_id: str,
    state: dict,
    user_message: str,
    image_b64: Optional[str] = None,
    image_filename: Optional[str] = None,
) -> dict:
    """Run the LangGraph graph with a new user message.

    If the graph is paused at an interrupt() from a previous turn, resume it
    with Command(resume=...).  Otherwise invoke fresh with the full state.
    """
    config = {"configurable": {"thread_id": session_id}}

    if state.get("is_interrupted"):
        # Graph is paused at chat_agent's interrupt() — resume with new input
        resume_payload: dict = {"message": user_message}
        if image_b64:
            resume_payload["image_b64"] = image_b64
            resume_payload["image_filename"] = image_filename
            state["image_b64"] = image_b64
            state["image_filename"] = image_filename

        result = app_graph.invoke(Command(resume=resume_payload), config=config)
    else:
        # First message or graph already reached END — start a fresh run
        state["messages"].append(HumanMessage(content=user_message))
        if image_b64:
            state["image_b64"] = image_b64
            state["image_filename"] = image_filename

        result = app_graph.invoke(state, config=config)

    state.update(result)

    # Track whether the graph is now paused waiting for the next user message
    graph_state =  app_graph.get_state(config)
    state["is_interrupted"] = bool(graph_state.next)

    return state


def _extract_response(state: dict) -> str:
    """Get the latest AI message content."""
    ai_messages = [m for m in state["messages"] if isinstance(m, AIMessage)]
    return ai_messages[-1].content if ai_messages else ""


def _state_payload(state: dict) -> dict:
    """Build the state payload to send to the client."""
    return {
        "has_image": state.get("image_b64") is not None,
        "has_palette": (
            state.get("palette") is not None
            and len(state.get("palette", [])) == 6
        ),
        "palette": state.get("palette"),
        "palette_candidates": state.get("palette_candidates"),
        "result_base64": state.get("result_b64"),
        "recolor_count": state.get("recolor_count", 0),
        "error": state.get("error"),
    }


# --- REST endpoints ---

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    image_base64: Optional[str] = None
    image_filename: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    response: str
    has_image: bool
    has_palette: bool
    palette: Optional[list[list[int]]] = None
    palette_candidates: Optional[list[dict]] = None
    result_base64: Optional[str] = None
    recolor_count: int
    error: Optional[str] = None


@agent_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """REST endpoint for chat interaction (polling-based fallback)."""
    session_id, state = get_or_create_session(req.session_id)

    state =  _run_graph(
        session_id=session_id,
        state=state,
        user_message=req.message,
        image_b64=req.image_base64,
        image_filename=req.image_filename,
    )

    return ChatResponse(
        session_id=session_id,
        response=_extract_response(state),
        has_image=state.get("image_b64") is not None,
        has_palette=(
            state.get("palette") is not None
            and len(state.get("palette", [])) == 6
        ),
        palette=state.get("palette"),
        palette_candidates=state.get("palette_candidates"),
        result_base64=state.get("result_b64"),
        recolor_count=state.get("recolor_count", 0),
        error=state.get("error"),
    )


@agent_router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """SSE endpoint: streams backend log events in real-time, then the final response.

    Events are newline-delimited JSON in the SSE `data:` format:
      data: {"type": "log",  "logger": "...", "level": "info", "msg": "..."}
      data: {"type": "done", "session_id": "...", "response": "...", ...}
      data: {"type": "error","content": "..."}
    """
    session_id, state = get_or_create_session(req.session_id)

    handler = _StreamHandler()
    loggers = [logging.getLogger(n) for n in _LOG_TARGETS]
    for lg in loggers:
        lg.addHandler(handler)

    done_event = threading.Event()
    result_holder: dict = {}

    def _run() -> None:
        try:
            result_holder["state"] = _run_graph(
                session_id=session_id,
                state=state,
                user_message=req.message,
                image_b64=req.image_base64,
                image_filename=req.image_filename,
            )
        except Exception as exc:
            result_holder["error"] = str(exc)
        finally:
            done_event.set()
            for lg in loggers:
                lg.removeHandler(handler)

    threading.Thread(target=_run, daemon=True).start()

    async def _generate():
        sent = 0
        while not done_event.is_set():
            while sent < len(handler.records):
                yield f"data: {json.dumps({'type': 'log', **handler.records[sent]})}\n\n"
                sent += 1
            await asyncio.sleep(0.04)

        # Drain any records added between the last poll and done_event
        while sent < len(handler.records):
            yield f"data: {json.dumps({'type': 'log', **handler.records[sent]})}\n\n"
            sent += 1

        if "error" in result_holder:
            yield f"data: {json.dumps({'type': 'error', 'content': result_holder['error']})}\n\n"
        else:
            s = result_holder["state"]
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'response': _extract_response(s), **_state_payload(s)})}\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@agent_router.post("/chat/{session_id}/select-palette/{index}")
async def select_palette(session_id: str, index: int):
    """Select a specific palette from candidates."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(404, "Session not found")

    candidates = state.get("palette_candidates", [])
    if index < 0 or index >= len(candidates):
        raise HTTPException(
            400,
            f"Invalid palette index. Available: 0-{len(candidates)-1}",
        )

    selected = candidates[index]
    state["palette"] = selected["colors"]
    state["palette_source"] = selected["source"]

    return {
        "palette": selected["colors"],
        "source": selected["source"],
        "description": selected["description"],
    }


# --- WebSocket endpoint ---

@agent_router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time chat.

    Client sends:
      { "type": "text", "content": "make it warmer" }
      { "type": "image", "content": "<base64>", "filename": "photo.jpg" }
      { "type": "select_palette", "index": 2 }

    Server sends:
      { "type": "status", "content": "Thinking..." }
      { "type": "message", "content": "...", "state": {...} }
      { "type": "result", "content": "...", "state": {...} }
      { "type": "error", "content": "..." }
    """
    await websocket.accept()
    _, state = get_or_create_session(session_id)

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            try:
                if msg["type"] == "text":
                    await websocket.send_json({
                        "type": "status",
                        "content": "Thinking...",
                    })
                    state = _run_graph(
                        session_id=session_id,
                        state=state,
                        user_message=msg["content"],
                    )

                elif msg["type"] == "image":
                    await websocket.send_json({
                        "type": "status",
                        "content": "Processing image...",
                    })
                    state = _run_graph(
                        session_id=session_id,
                        state=state,
                        user_message="I've uploaded an image.",
                        image_b64=msg["content"],
                        image_filename=msg.get("filename"),
                    )

                elif msg["type"] == "select_palette":
                    idx = msg["index"]
                    candidates = state.get("palette_candidates", [])
                    if 0 <= idx < len(candidates):
                        state["palette"] = candidates[idx]["colors"]
                        state["palette_source"] = candidates[idx]["source"]

                # Build response
                response_type = (
                    "result" if state.get("result_b64") else "message"
                )
                await websocket.send_json({
                    "type": response_type,
                    "content": _extract_response(state),
                    "state": _state_payload(state),
                })

            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "content": str(e),
                })

    except WebSocketDisconnect:
        pass
