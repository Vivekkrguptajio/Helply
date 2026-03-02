import asyncio
import logging
from fastapi import FastAPI
import socketio
import json
import websockets
from deepgram import DeepgramClient, DeepgramClientOptions, LiveOptions, LiveTranscriptionEvents
from groq import AsyncGroq

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Settings (using pydantic-settings to read from environment or .env file)
class Settings(BaseSettings):
    DEEPGRAM_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore" # in case other vars exist

settings = Settings()

# Initialize FastAPI and Socket.io. Adding standard websocket transports array to solve closed before establishment error.
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    transports=['websocket', 'polling']
)
app = FastAPI(title="Interview Copilot Backend")
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Deepgram Options are no longer needed globally if we use raw websockets

# Initialize Groq
groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Track active Deepgram connections per Socket.io session
active_connections = {}

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
    Generates an answer using Groq LLaMA 3.3 70B and emits it via socket.
    """
    try:
        logger.info(f"[{sid}] Generating AI answer for: {transcribed_question}")
        
        system_prompt = (
            "You are a professional SDE interview assistant. "
            "The user is in a live interview and the input is transcribed speech which may be broken, incomplete, or grammatically incorrect. "
            "NEVER ask the user to clarify, repeat, or finish their sentence. Start your answer immediately. "
            "Infer their intent from the available words and provide the best possible concise 3-4 bullet-point answer. "
            "Focus on technical accuracy and speed."
        )
        
        # We use await to handle this concurrently without blocking other events
        response = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Upgraded to 70B model for much higher technical accuracy
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcribed_question}
            ],
            temperature=0.3, # Low temperature for more factual responses
            max_tokens=250
        )
        
        answer = response.choices[0].message.content
        logger.info(f"[{sid}] Successfully generated AI answer. Emitting to frontend.")
        
        # Send the answer back to the frontend
        await sio.emit("ai_answer", {"text": answer}, to=sid)
        
    except Exception as e:
        logger.error(f"[{sid}] Error generating answer from Groq: {e}")


async def create_deepgram_client_connection(sid: str):
    """
    Creates and starts a live Deepgram websocket connection for a given Socket.io session using standard websockets to avoid SDK lockups.
    """
    try:
        url = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&interim_results=true&endpointing=700&smart_format=true"
        headers = {"Authorization": f"Token {settings.DEEPGRAM_API_KEY}"}
        
        ws = await websockets.connect(url, extra_headers=headers)
        
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
                                logger.info(f"[{sid}] Deepgram Final Transcription: {sentence}")
                                await sio.emit("interviewer_transcription", {"text": sentence}, to=sid)
                                asyncio.create_task(get_groq_answer(sid, sentence))
                            else:
                                await sio.emit("interviewer_interim", {"text": sentence}, to=sid)
            except websockets.exceptions.ConnectionClosed:
                logger.info(f"[{sid}] Deepgram websocket connection closed")
            except Exception as e:
                logger.error(f"[{sid}] Error reading from Deepgram: {e}")
                
        # Start the listening task
        asyncio.create_task(listen_deepgram())
        return ws
        
    except Exception as e:
        logger.error(f"[{sid}] Exception setting up Deepgram: {e}")
        return None


@sio.on("connect")
async def handle_connect(sid, environ):
    logger.info(f"[{sid}] Socket client connected")
    dg_conn = await create_deepgram_client_connection(sid)
    
    if dg_conn:
        active_connections[sid] = dg_conn
        logger.info(f"[{sid}] Real-time audio processing initialized")
    else:
        logger.error(f"[{sid}] Dropping socket connection due to deepgram failure")
        await sio.disconnect(sid)

@sio.on("audio_data")
async def handle_audio_data(sid, data):
    """
    Receives raw audio chunks from frontend and sends them to Deepgram.
    """
    try:
        dg_conn = active_connections.get(sid)
        if not dg_conn:
            logger.warning(f"[{sid}] Received audio but no Deepgram connection active.")
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

@sio.on("disconnect")
async def handle_disconnect(sid):
    logger.info(f"[{sid}] Socket client disconnected")
    dg_conn = active_connections.pop(sid, None)
    
    # Gracefully close Deepgram connection in the background so it doesn't block the event loop
    if dg_conn:
        async def close_dg():
            try:
                await asyncio.wait_for(dg_conn.close(), timeout=2.0)
                logger.info(f"[{sid}] Deepgram connection closed")
            except Exception as e:
                logger.error(f"[{sid}] Error or timeout closing Deepgram connection: {e}")
        
        asyncio.create_task(close_dg())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:sio_app", host="127.0.0.1", port=8000, reload=True)
