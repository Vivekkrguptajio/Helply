import asyncio
import json
import logging

import websockets

from app.config import DEEPGRAM_API_KEY, DEEPGRAM_URL, LOG_TRANSCRIPTS
from app.services import answering
from app.sio import sio
from app.state import active_sessions, add_history

logger = logging.getLogger(__name__)

# role -> session key holding that connection
WS_KEY = {"interviewer": "ws", "candidate": "ws_user"}


async def _listen(sid: str, ws, role: str):
    """Reads transcripts from Deepgram and forwards them to the browser."""
    try:
        async for message in ws:
            data = json.loads(message)
            if data.get("type") != "Results":
                continue

            alts = data.get("channel", {}).get("alternatives", [])
            sentence = alts[0].get("transcript", "") if alts else ""
            if not sentence:
                continue

            session = active_sessions.get(sid)
            if not session:
                continue
            is_final = data.get("is_final", False)

            if role == "candidate":
                # The candidate's own speech: shown and kept as context, never answered.
                if is_final:
                    logger.info(f"[{sid}] Candidate: {sentence if LOG_TRANSCRIPTS else f'({len(sentence)} chars)'}")
                    add_history(session, "candidate", sentence)
                    await sio.emit("candidate_transcription", {"text": sentence}, to=sid)
                continue

            # Interviewer speech: any new audio restarts the auto-answer countdown.
            answering.cancel_auto(session)
            if is_final:
                logger.info(f"[{sid}] Interviewer: {sentence if LOG_TRANSCRIPTS else f'({len(sentence)} chars)'}")
                session["buffer"] = (session["buffer"] + " " + sentence).strip()
                await sio.emit("interviewer_transcription", {"text": session["buffer"]}, to=sid)
                answering.schedule_auto(sid)
            else:
                interim = (session["buffer"] + " " + sentence).strip()
                await sio.emit("interviewer_interim", {"text": interim}, to=sid)
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"[{sid}] Deepgram ({role}) connection closed")
        session = active_sessions.get(sid)
        if session:  # still active => Deepgram dropped us (idle timeout, network blip): reconnect
            session[WS_KEY[role]] = None
            await _reconnect(sid, role)
    except Exception as e:
        logger.error(f"[{sid}] Error reading from Deepgram ({role}): {e}")


async def _reconnect(sid: str, role: str, attempts: int = 3):
    for attempt in range(1, attempts + 1):
        await asyncio.sleep(attempt)  # 1s, 2s, 3s
        session = active_sessions.get(sid)
        if not session:
            return  # the browser left in the meantime
        logger.info(f"[{sid}] Reconnecting Deepgram ({role}), attempt {attempt}/{attempts}")
        ws = await connect(sid, role)
        if ws:
            session[WS_KEY[role]] = ws
            return
    if sid in active_sessions:
        await sio.emit("error", {"message": "Transcription connection lost. Please stop and start the session again."}, to=sid)


async def connect(sid: str, role: str = "interviewer"):
    """Opens a live Deepgram websocket for one speaker. Returns the ws or None."""
    try:
        if not DEEPGRAM_API_KEY:
            logger.error(f"[{sid}] DEEPGRAM_API_KEY is not set!")
            return None

        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}
        logger.info(f"[{sid}] Connecting to Deepgram ({role})... (websockets version: {websockets.__version__})")

        # websockets v14+ uses 'additional_headers', older uses 'extra_headers'
        try:
            ws = await asyncio.wait_for(websockets.connect(DEEPGRAM_URL, additional_headers=headers), timeout=15.0)
        except TypeError:
            ws = await asyncio.wait_for(websockets.connect(DEEPGRAM_URL, extra_headers=headers), timeout=15.0)

        logger.info(f"[{sid}] Deepgram ({role}) connected successfully.")
        asyncio.create_task(_listen(sid, ws, role))
        return ws

    except asyncio.TimeoutError:
        logger.error(f"[{sid}] Deepgram ({role}) connection timed out after 15 seconds")
    except Exception as e:
        logger.error(f"[{sid}] Exception setting up Deepgram ({role}): {type(e).__name__}: {e}")
    return None


async def send_keepalive(ws):
    await ws.send(json.dumps({"type": "KeepAlive"}))


async def close(sid: str, ws):
    try:
        await asyncio.wait_for(ws.close(), timeout=2.0)
        logger.info(f"[{sid}] Deepgram connection closed")
    except Exception as e:
        logger.error(f"[{sid}] Error or timeout closing Deepgram connection: {e}")
