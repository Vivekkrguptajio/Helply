import asyncio

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import DEEPGRAM_API_KEY, GROQ_API_KEY, MAX_RESUME_BYTES
from app.services.resume import ResumeError, extract_resume_text

router = APIRouter()


@router.get("/")
async def root():
    """Health check route for Render / uptime monitors."""
    return {"status": "ok", "service": "Interview Copilot Backend"}


@router.get("/debug-env")
async def debug_env():
    """Shows if API keys are loaded (does NOT expose key values)."""
    return {
        "deepgram_key_set": bool(DEEPGRAM_API_KEY),
        "deepgram_key_length": len(DEEPGRAM_API_KEY),
        "groq_key_set": bool(GROQ_API_KEY),
        "groq_key_length": len(GROQ_API_KEY),
    }


@router.post("/resume/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Extracts plain text from an uploaded resume (PDF / DOCX / TXT)."""
    data = await file.read(MAX_RESUME_BYTES + 1)
    if len(data) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail="Resume is too large (max 5 MB).")
    try:
        text = await asyncio.to_thread(extract_resume_text, file.filename or "", data)
    except ResumeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"filename": file.filename, "text": text, "chars": len(text)}
