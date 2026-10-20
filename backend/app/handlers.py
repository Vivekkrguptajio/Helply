import asyncio
import logging

from app.config import LOG_TRANSCRIPTS, MAX_CONTEXT_CHARS, MAX_RESUME_CHARS
from app.services import answering, deepgram
from app.sio import sio
from app.state import active_sessions, new_session

logger = logging.getLogger(__name__)


def should_ignore_voice(audio_chunk: bytes) -> bool:
    """
    Placeholder for Voice Neglect Logic: could use a saved voice embedding to
    filter out the candidate's own voice. For now every chunk is processed.
    """
    return False


@sio.on("connect")
async def handle_connect(sid, environ):
    logger.info(f"[{sid}] Socket client connected")
    session = new_session()
    active_sessions[sid] = session
    session["ws"] = await deepgram.connect(sid, "interviewer")

    if session["ws"]:
        logger.info(f"[{sid}] Real-time audio processing initialized")
    else:
        logger.error(f"[{sid}] Deepgram connection failed — session will run without transcription")
        await sio.emit("error", {"message": "Transcription service unavailable. Check API keys."}, to=sid)


@sio.on("set_options")
async def handle_set_options(sid, data=None):
    """
    {"auto": bool, "candidate": bool}
    auto      -> answer automatically when the interviewer finishes a question
    candidate -> also transcribe the candidate's mic (context only, never answered)
    """
    session = active_sessions.get(sid)
    if not session or not isinstance(data, dict):
        return

    session["auto"] = bool(data.get("auto", session["auto"]))
    if data.get("length") in ("short", "normal", "detailed"):
        session["length"] = data["length"]
    if "context" in data:
        session["context"] = str(data.get("context") or "")[:MAX_CONTEXT_CHARS].strip()
    if not session["auto"]:
        answering.cancel_auto(session)

    if data.get("candidate") and session["ws_user"] is None:
        session["ws_user"] = await deepgram.connect(sid, "candidate")
    logger.info(f"[{sid}] Options: auto={session['auto']} candidate_stream={session['ws_user'] is not None}")


@sio.on("set_resume")
async def handle_set_resume(sid, data=None):
    """Stores the candidate's resume text for this session so answers can use it."""
    session = active_sessions.get(sid)
    if not session:
        return
    text = data.get("text", "") if isinstance(data, dict) else ""
    session["resume"] = str(text)[:MAX_RESUME_CHARS].strip()
    logger.info(f"[{sid}] Resume {'set' if session['resume'] else 'cleared'} ({len(session['resume'])} chars)")


async def _forward_audio(sid, data, key):
    try:
        session = active_sessions.get(sid)
        if not session:
            logger.warning(f"[{sid}] Received audio but no session active.")
            return

        ws = session[key]
        if ws is None:
            return

        if isinstance(data, str) and data == "KeepAlive":
            await deepgram.send_keepalive(ws)
            return

        if not isinstance(data, (bytes, bytearray)) or should_ignore_voice(data):
            return

        await ws.send(data)
    except Exception as e:
        logger.error(f"[{sid}] Exception sending audio to deepgram ({key}): {e}")


@sio.on("audio_data")
async def handle_audio_data(sid, data):
    """Interviewer audio (system audio, or the mic in single-source mode)."""
    await _forward_audio(sid, data, "ws")


@sio.on("mic_audio")
async def handle_mic_audio(sid, data):
    """The candidate's own microphone (only used in 'both' mode)."""
    await _forward_audio(sid, data, "ws_user")


@sio.on("clear_buffer")
async def handle_clear_buffer(sid, data=None):
    session = active_sessions.get(sid)
    if session:
        answering.cancel_auto(session)
        session["buffer"] = ""
        session["history"] = []
        logger.info(f"[{sid}] Buffer and history cleared by user")


@sio.on("get_answer")
async def handle_get_answer(sid, data=None):
    """Manually triggered: answers the pending interviewer text (plus resume and history)."""
    session = active_sessions.get(sid)
    if not session or not session["buffer"]:
        logger.warning(f"[{sid}] get_answer called but buffer is empty.")
        await sio.emit("ai_answer", {"text": "⚠️ No question detected yet. Please wait for the interviewer to speak."}, to=sid)
        return

    answering.cancel_auto(session)
    logger.info(f"[{sid}] Manual get_answer triggered ({len(session['buffer'])} chars)")
    await answering.answer_now(sid)


@sio.on("regenerate")
async def handle_regenerate(sid, data=None):
    """Redo / Shorter / Simpler: re-answers the last question."""
    mode = data.get("mode", "again") if isinstance(data, dict) else "again"
    await answering.regenerate_now(sid, mode)


@sio.on("disconnect")
async def handle_disconnect(sid):
    logger.info(f"[{sid}] Socket client disconnected")
    session = active_sessions.pop(sid, None)
    if not session:
        return
    answering.cancel_auto(session)
    for key in ("ws", "ws_user"):
        if session[key] is not None:
            asyncio.create_task(deepgram.close(sid, session[key]))
