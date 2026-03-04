import asyncio
import logging
import os
from fastapi import FastAPI
import socketio
import json
import websockets
from dotenv import load_dotenv
from groq import AsyncGroq

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()  # loads .env locally; on Render, env vars are already set

# Read API keys directly from environment
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

logger.info(f"[Startup] DEEPGRAM_API_KEY set: {bool(DEEPGRAM_API_KEY)} (length: {len(DEEPGRAM_API_KEY)})")
logger.info(f"[Startup] GROQ_API_KEY set: {bool(GROQ_API_KEY)} (length: {len(GROQ_API_KEY)})")

# Initialize FastAPI and Socket.io. Adding standard websocket transports array to solve closed before establishment error.
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    transports=['websocket', 'polling']
)
app = FastAPI(title="Interview Copilot Backend")
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Health check route for Render / uptime monitors
@app.get("/")
async def root():
    return {"status": "ok", "service": "Interview Copilot Backend"}

# Debug endpoint — shows if API keys are loaded (does NOT expose key values)
@app.get("/debug-env")
async def debug_env():
    return {
        "deepgram_key_set": bool(DEEPGRAM_API_KEY),
        "deepgram_key_length": len(DEEPGRAM_API_KEY),
        "groq_key_set": bool(GROQ_API_KEY),
        "groq_key_length": len(GROQ_API_KEY),
    }

# Deepgram Options are no longer needed globally if we use raw websockets

# Initialize Groq
groq_client = AsyncGroq(api_key=GROQ_API_KEY)

# Track active session states: {sid: {"ws": ws_conn, "buffer": "", "timer_task": Task}}
active_sessions = {}

def should_ignore_voice(audio_chunk: bytes) -> bool:
    """
    Placeholder function for Voice Neglect Logic.
    In the future, this could use a pre-saved voice embedding to filter out
    the user's voice and only process the interviewer's voice.
    """
    # Simply return False for now, meaning we process all audio.
    return False

async def get_groq_answer(sid: str, transcribed_question: str):
    """
    Streams an answer using Groq LLaMA 3.3 70B, emitting each chunk via socket as it arrives.
    """
    try:
        logger.info(f"[{sid}] Streaming AI answer for: {transcribed_question}")
        
        system_prompt = (
            "You are an expert Software Engineer Interview Copilot. "
            "You are secretly listening to a live interview. "
            "The input is the transcribed speech of the INTERVIEWER asking a question. "
            "1. CONTEXT: The input might be broken, incomplete, or a continuation of a previous thought. "
            "2. YOUR JOB: Provide a concise, highly technical, and impressive answer (3-4 bullet points) that the candidate can use to respond. "
            "3. BE DIRECT: Do NOT say 'Here are some potential areas' or 'Based on your question'. Just give the exact answer points. "
            "4. PATIENCE: If the input is just conversational filler ('And what have you done...', 'So as we discussed...'), or if the question is clearly cut off, provide a very brief, low-key response or just one bullet point. Only give a full technical answer when a complete question is identifiable. "
            "Focus strictly on technical accuracy, brevity, and helping the candidate pass the interview."
        )

        # Use streaming mode
        stream = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcribed_question}
            ],
            temperature=0.3,
            max_tokens=250,
            stream=True,  # <-- STREAMING ENABLED
        )

        # Emit each chunk as it arrives
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                await sio.emit("ai_answer_chunk", {"text": delta}, to=sid)

        # Signal frontend that streaming is done
        await sio.emit("ai_answer_done", {}, to=sid)
        logger.info(f"[{sid}] Streaming complete.")

    except Exception as e:
        logger.error(f"[{sid}] Error streaming answer from Groq: {e}")
        await sio.emit("ai_answer_done", {}, to=sid)  # Always signal done even on error



async def create_deepgram_client_connection(sid: str):
    """
    Creates and starts a live Deepgram websocket connection for a given Socket.io session using standard websockets to avoid SDK lockups.
    """
    try:
        if not DEEPGRAM_API_KEY:
            logger.error(f"[{sid}] DEEPGRAM_API_KEY is not set!")
            return None

        # Increased endpointing to 5000ms (5 seconds) for initial Deepgram break
        # Added smart_format=true for better readability
        url = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&interim_results=true&endpointing=5000&smart_format=true"
        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}
        
        logger.info(f"[{sid}] Connecting to Deepgram... (websockets version: {websockets.__version__})")
        
        # websockets v14+ uses 'additional_headers', older uses 'extra_headers'
        try:
            ws = await asyncio.wait_for(
                websockets.connect(url, additional_headers=headers),
                timeout=15.0
            )
        except TypeError:
            # Fallback for older websockets versions
            ws = await asyncio.wait_for(
                websockets.connect(url, extra_headers=headers),
                timeout=15.0
            )
        logger.info(f"[{sid}] Deepgram connected successfully.")
        
        # Background task to read messages from Deepgram
        async def listen_deepgram():
            try:
                async for message in ws:
                    data = json.loads(message)
                    
                    if data.get("type") == "Results":
                        channel = data.get("channel", {})
                        alts = channel.get("alternatives", [])
                        if alts:
                            sentence = alts[0].get("transcript", "")
                            if not sentence:
                                continue
                                
                            is_final = data.get("is_final", False)
                            if is_final:
                                logger.info(f"[{sid}] Deepgram Final Fragment: {sentence}")
                                
                                # Access session data
                                session = active_sessions.get(sid)
                                if not session:
                                    continue
                                
                                # Update buffer (no auto-timer — user will manually request answer)
                                session["buffer"] = (session["buffer"] + " " + sentence).strip()
                                
                                # Emit accumulated transcript to frontend
                                await sio.emit("interviewer_transcription", {"text": session["buffer"]}, to=sid)
                                
                            else:
                                session = active_sessions.get(sid)
                                current_buffer = session["buffer"] if session else ""
                                interim_display = (current_buffer + " " + sentence).strip()
                                await sio.emit("interviewer_interim", {"text": interim_display}, to=sid)
            except websockets.exceptions.ConnectionClosed:
                logger.info(f"[{sid}] Deepgram websocket connection closed")
            except Exception as e:
                logger.error(f"[{sid}] Error reading from Deepgram: {e}")
                
        # Start the listening task
        asyncio.create_task(listen_deepgram())
        return ws
        
    except asyncio.TimeoutError:
        logger.error(f"[{sid}] Deepgram connection timed out after 15 seconds")
        return None
    except Exception as e:
        logger.error(f"[{sid}] Exception setting up Deepgram: {type(e).__name__}: {e}")
        return None


@sio.on("connect")
async def handle_connect(sid, environ):
    logger.info(f"[{sid}] Socket client connected")
    dg_conn = await create_deepgram_client_connection(sid)
    
    if dg_conn:
        active_sessions[sid] = {
            "ws": dg_conn,
            "buffer": "",
        }
        logger.info(f"[{sid}] Real-time audio processing initialized")
    else:
        logger.error(f"[{sid}] Deepgram connection failed — session will run without transcription")
        active_sessions[sid] = {
            "ws": None,
            "buffer": "",
        }
        await sio.emit("error", {"message": "Transcription service unavailable. Check API keys."}, to=sid)

@sio.on("audio_data")
async def handle_audio_data(sid, data):
    """
    Receives raw audio chunks from frontend and sends them to Deepgram.
    """
    try:
        session = active_sessions.get(sid)
        if not session:
            logger.warning(f"[{sid}] Received audio but no session active.")
            return

        dg_conn = session["ws"]

        # If Deepgram connection is not available, skip silently
        if dg_conn is None:
            return

        # Check if the frontend sent a KeepAlive message (e.g. string "KeepAlive" instead of bytes)
        if isinstance(data, str) and data == "KeepAlive":
            # Deepgram accepts an empty KeepAlive message (JSON string) for raw websockets
            try:
                await dg_conn.send(json.dumps({"type": "KeepAlive"}))
            except Exception as e:
                logger.error(f"[{sid}] KeepAlive internal error: {e}")
            return
            
        if not isinstance(data, (bytes, bytearray)):
            return
            
        if should_ignore_voice(data):
            # Voice neglect logic
            return
            
        # Deepgram SDK accepts basic byte arrays
        await dg_conn.send(data)
    except Exception as e:
        logger.error(f"[{sid}] Exception sending audio to deepgram: {e}")

@sio.on("clear_buffer")
async def handle_clear_buffer(sid, data=None):
    """Clears the transcription buffer for this session."""
    session = active_sessions.get(sid)
    if session:
        session["buffer"] = ""
        logger.info(f"[{sid}] Buffer cleared by user")

@sio.on("get_answer")
async def handle_get_answer(sid, data=None):
    """
    Manually triggered by the frontend button.
    Takes the current buffer and sends it to Groq for an AI answer.
    """
    session = active_sessions.get(sid)
    if not session or not session["buffer"]:
        logger.warning(f"[{sid}] get_answer called but buffer is empty.")
        await sio.emit("ai_answer", {"text": "⚠️ No question detected yet. Please wait for the interviewer to speak."}, to=sid)
        return

    full_text = session["buffer"]
    session["buffer"] = ""  # Clear buffer after triggering
    logger.info(f"[{sid}] Manual get_answer triggered for: {full_text}")
    await get_groq_answer(sid, full_text)

@sio.on("disconnect")
async def handle_disconnect(sid):
    logger.info(f"[{sid}] Socket client disconnected")
    session = active_sessions.pop(sid, None)
    
    if session:
        dg_conn = session["ws"]
        if dg_conn is not None:
            async def close_dg():
                try:
                    await asyncio.wait_for(dg_conn.close(), timeout=2.0)
                    logger.info(f"[{sid}] Deepgram connection closed")
                except Exception as e:
                    logger.error(f"[{sid}] Error or timeout closing Deepgram connection: {e}")
            
            asyncio.create_task(close_dg())

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:sio_app", host="0.0.0.0", port=port)

