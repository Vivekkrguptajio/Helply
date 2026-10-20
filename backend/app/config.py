import logging
import os

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

load_dotenv()  # loads .env locally; on Render, env vars are already set

DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
PORT = int(os.environ.get("PORT", 8000))

# nova-3 + language=multi understands English, Hindi and mixed Hinglish. Override via env if needed
# (e.g. DEEPGRAM_MODEL=nova-2 DEEPGRAM_LANGUAGE=en-US for English-only).
DEEPGRAM_MODEL = os.environ.get("DEEPGRAM_MODEL", "nova-3")
DEEPGRAM_LANGUAGE = os.environ.get("DEEPGRAM_LANGUAGE", "multi")
DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    f"?model={DEEPGRAM_MODEL}&language={DEEPGRAM_LANGUAGE}&interim_results=true&endpointing=1500&smart_format=true"
)

# Interview speech is private: transcripts are only written to the logs when explicitly enabled.
LOG_TRANSCRIPTS = os.environ.get("LOG_TRANSCRIPTS", "0") == "1"
# llama-3.3-70b-versatile is no longer served by Groq; override with GROQ_MODEL if needed.
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# Resume upload limits
MAX_RESUME_BYTES = 5 * 1024 * 1024
MAX_RESUME_CHARS = 12000
MAX_CONTEXT_CHARS = 3000
