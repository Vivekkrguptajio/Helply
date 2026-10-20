from typing import Any

MAX_HISTORY = 12


def new_session() -> dict[str, Any]:
    return {
        "ws": None,          # Deepgram connection for the interviewer (system audio / main stream)
        "ws_user": None,     # Deepgram connection for the candidate's own mic (optional)
        "buffer": "",        # interviewer text not answered yet
        "resume": "",
        "context": "",       # target role / job description / company (optional)
        "length": "normal",  # "short" | "normal" | "detailed"
        "last_question": "", # last question answered, for Redo / Shorter / Simpler
        "history": [],       # [{"role": "interviewer" | "candidate", "text": str}] — context only
        "auto": False,       # answer automatically when the interviewer finishes a question
        "answering": False,
        "auto_task": None,
    }


# Active session states: {sid: new_session()}
active_sessions: dict[str, dict] = {}


def add_history(session: dict, role: str, text: str):
    """Appends a line to the conversation history, merging consecutive lines from the same speaker."""
    text = text.strip()
    if not text:
        return
    history = session["history"]
    if history and history[-1]["role"] == role:
        history[-1]["text"] = (history[-1]["text"] + " " + text).strip()
    else:
        history.append({"role": role, "text": text})
    del history[:-MAX_HISTORY]
