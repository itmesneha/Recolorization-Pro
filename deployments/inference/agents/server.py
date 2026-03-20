"""Start the agent FastAPI server."""

import asyncio
import logging
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agent_api import agent_router
from session import cleanup_old_sessions


async def _session_cleanup_loop():
    while True:
        await asyncio.sleep(300)  # every 5 minutes
        removed = cleanup_old_sessions()
        if removed:
            print(f"[Session] Cleaned up {removed} expired session(s)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_session_cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Recolorization Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
