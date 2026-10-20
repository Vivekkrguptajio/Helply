import asyncio
import logging
import re

from app.config import LOG_TRANSCRIPTS
from app.sio import sio
from app.services.llm import REGENERATE_HINTS, stream_answer
from app.state import active_sessions, add_history

logger = logging.getLogger(__name__)

AUTO_DELAY = 2.0  # default seconds of interviewer silence before an automatic answer fires
MIN_WORDS = 4

# Words a sentence rarely ends on: the interviewer is probably still mid-thought
_TRAILING = {"and", "so", "um", "uh", "like", "the", "a", "an", "to", "of", "in", "on", "for", "with", "but", "or", "because", "that", "is", "are", "your", "you"}


def delay_for(text: str) -> float:
    """How long to wait for more speech: short after a clear question, longer if the sentence looks unfinished."""
    stripped = text.strip()
    if not stripped:
        return AUTO_DELAY
    if stripped.endswith("?"):
        return 1.2
    last_word = re.sub(r"[^\w']", "", stripped.split()[-1]).lower()
    if not stripped.endswith((".", "!")) or last_word in _TRAILING:
        return 3.5
    return AUTO_DELAY

_QUESTION_WORDS = re.compile(
    r"\b(what|why|how|when|where|which|who|can you|could you|would you|do you|did you|have you|are you|is there|"
    r"tell me|explain|describe|walk me|talk about|difference|define|give me|share|elaborate|introduce)\b",
    re.IGNORECASE,
)


def looks_like_question(text: str) -> bool:
    """Heuristic so small talk ('okay, great') doesn't trigger an answer."""
    if len(text.split()) < MIN_WORDS:
        return False
    return "?" in text or bool(_QUESTION_WORDS.search(text))


def cancel_auto(session: dict):
    task = session.get("auto_task")
    if task and not task.done():
        task.cancel()
    session["auto_task"] = None


def schedule_auto(sid: str):
    """(Re)starts the countdown; any new interviewer speech cancels and restarts it."""
    session = active_sessions.get(sid)
    if not session or not session["auto"]:
        return
    cancel_auto(session)
    session["auto_task"] = asyncio.create_task(_auto_run(sid))


async def _auto_run(sid: str):
    try:
        session = active_sessions.get(sid)
        await asyncio.sleep(delay_for(session["buffer"]) if session else AUTO_DELAY)
    except asyncio.CancelledError:
        return
    session = active_sessions.get(sid)
    if not session or not session["auto"]:
        return
    if not looks_like_question(session["buffer"]):
        logger.info(f"[{sid}] Auto-answer skipped (not a question){': ' + repr(session['buffer']) if LOG_TRANSCRIPTS else ''}")
        return
    await answer_now(sid)


async def answer_now(sid: str):
    """Answers the interviewer's pending text using resume + conversation history."""
    session = active_sessions.get(sid)
    if not session or session["answering"] or not session["buffer"]:
        return

    session["answering"] = True
    question = session["buffer"]
    session["buffer"] = ""
    session["last_question"] = question
    try:
        await stream_answer(
            sid, question, session["resume"], list(session["history"]),
            session["length"], session["context"],
        )
        add_history(session, "interviewer", question)
    finally:
        session["answering"] = False


async def regenerate_now(sid: str, mode: str):
    """Re-answers the last question (Redo / Shorter / Simpler)."""
    session = active_sessions.get(sid)
    if not session or session["answering"]:
        return
    question = session["last_question"]
    if not question:
        await sio.emit("ai_answer", {"text": "⚠️ Nothing to redo yet. Wait for a question first."}, to=sid)
        return

    session["answering"] = True
    try:
        # History already contains this question, so only the earlier turns are passed as context.
        history = [h for h in session["history"]]
        if history and history[-1]["role"] == "interviewer" and history[-1]["text"].endswith(question):
            history[-1] = {**history[-1], "text": history[-1]["text"][: -len(question)].strip()}
            if not history[-1]["text"]:
                history.pop()
        await stream_answer(
            sid, question, session["resume"], history,
            "short" if mode == "shorter" else session["length"], session["context"],
            REGENERATE_HINTS.get(mode, REGENERATE_HINTS["again"]),
        )
    finally:
        session["answering"] = False
