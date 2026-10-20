import logging

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import handlers  # noqa: F401  (registers socket event handlers)
from app.config import DEEPGRAM_API_KEY, GROQ_API_KEY
from app.routes import router
from app.sio import sio

logger = logging.getLogger(__name__)
logger.info(f"[Startup] DEEPGRAM_API_KEY set: {bool(DEEPGRAM_API_KEY)} (length: {len(DEEPGRAM_API_KEY)})")
logger.info(f"[Startup] GROQ_API_KEY set: {bool(GROQ_API_KEY)} (length: {len(GROQ_API_KEY)})")

app = FastAPI(title="Interview Copilot Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

sio_app = socketio.ASGIApp(sio, other_asgi_app=app)
