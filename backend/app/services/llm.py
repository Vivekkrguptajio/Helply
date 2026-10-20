import logging

from groq import AsyncGroq

from app.config import GROQ_API_KEY, GROQ_MODEL, LOG_TRANSCRIPTS
from app.services.claims import check_claims
from app.sio import sio

logger = logging.getLogger(__name__)

# AsyncGroq raises at construction if the key is empty, so only build it when set.
groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

BASE_PROMPT = (
    "You are an expert Software Engineer Interview Copilot. "
    "You are secretly listening to a live interview. "
    "The input is the transcribed speech of the INTERVIEWER asking a question. "
    "1. CONTEXT: The input might be broken, incomplete, or a continuation of a previous thought. It is a running transcript, so it may also "
    "contain earlier small talk or intros: answer the MOST RECENT question asked and ignore older filler. "
    "2. YOUR JOB: Write the exact words the candidate can SAY OUT LOUD to the interviewer: first person, natural, confident, conversational spoken English, "
    "as flowing paragraph(s). NO bullet points, NO numbered lists, NO headings, NO bold or other markdown (a short code block is fine only if code is truly needed). "
    "Normally 4-7 sentences (about 80-130 words): open with a direct answer in the first sentence, then explain the reasoning in plain words, "
    "then finish with a concrete example or a closing line that shows impact. Sound like a thoughtful person talking, not a textbook; avoid buzzword stuffing. "
    "3. BE DIRECT: No preambles such as 'Sure', 'Here is' or 'Based on your question'. Start straight with the answer. "
    "4. PATIENCE: If the input is just conversational filler ('And what have you done...', 'So as we discussed...'), or if the question is clearly cut off, reply with one short sentence only. Give a full answer only when a complete question is identifiable. "
    "5. LANGUAGE: Answer in English. Only if the interviewer is clearly speaking Hindi or Hinglish, answer in simple natural Hinglish written in Roman (English) letters. "
    "6. CODING: If asked to write, fix or trace code, give a one or two sentence approach, then ONE fenced code block (```language ... ```) in the language the interviewer names "
    "(default Java for a Java-focused resume, otherwise Python), then time and space complexity in one sentence. This is the only case where a code block and non-paragraph layout is allowed. "
    "7. CONVERSATION: Earlier lines of the conversation may be provided for context only. 'Candidate' lines are what the user (the candidate) "
    "has already said aloud: never repeat them; if the candidate already answered the same thing, only add what was missing. "
    "Only answer the INTERVIEWER'S NEW MESSAGE. "
    "Focus on technical accuracy, clarity, and helping the candidate sound credible and confident."
)

RESUME_PROMPT = (
    "\n\nCANDIDATE RESUME (use it to personalise answers):\n"
    "- ALWAYS answer whatever the interviewer asks, whether or not it is in the resume. Never refuse and never say the resume doesn't cover it.\n"
    "- INTRODUCTION QUESTIONS ('tell me about yourself', 'introduce yourself', 'walk me through your background'): "
    "start with the candidate's full name exactly as it appears at the top of the resume, e.g. \"Hi, I'm <Name>.\", then give education "
    "(degree, college, years), current training/experience, 2 key projects by name, key skills, and one line on the role they are targeting. "
    "Speak it as a natural 30-45 second spoken introduction in first person, as one flowing paragraph of about 100-140 words, not a list of keywords.\n"
    "- PROJECT QUESTIONS (e.g. 'explain your project', 'tell me about a project you worked on', 'walk me through your project', "
    "'what did you build'): answer ONLY from the resume's Projects/Experience section. If the interviewer names a project, explain that one; "
    "otherwise pick the most significant project on the resume and name it. Use the project's real name, tech stack, features and the candidate's "
    "role exactly as written. Cover, in this order and as flowing speech (no bullets): what it is and why it was built, the tech stack, the candidate's role and key features, "
    "and the result or benefit. "
    "Every sentence must be traceable to a line of the resume. Do NOT include a 'challenge' or 'problem I solved' part UNLESS the resume explicitly describes one; "
    "if it doesn't, end instead with one sentence on what the project demonstrates (e.g. the layered architecture or exception handling that the resume lists). "
    "NEVER invent an incident, bug, concurrency problem, scaling issue or technique (e.g. locking, caching, optimistic locking) that the resume does not state. "
    "Do NOT describe a generic or made-up project. Do NOT add any tool, library, infrastructure (Docker, Redis, etc.), metric or number "
    "(latency, users, percentages) that is not written in the resume. "
    "This is the one case where the answer may run a little longer (up to ~160 words, in two short paragraphs).\n"
    "- Questions about the candidate's background, projects, experience, skills, strengths/weaknesses or 'tell me about yourself': "
    "answer in first person using the real employers, projects, skills and dates from the resume.\n"
    "- Technical, coding, system design, HR, behavioural or any other question outside the resume: answer fully from your own expertise, "
    "and where it fits naturally, connect it to a project or skill from the resume as the candidate's example.\n"
    "- Behavioural/experience questions the resume doesn't detail: give a strong first-person answer consistent with the resume's role, "
    "skills and seniority, but do not invent new employers, job titles, degrees or hard numbers that contradict or go beyond the resume.\n\n"
    "--- RESUME START ---\n{resume}\n--- RESUME END ---"
)


LENGTH_GUIDE = {
    "short": "Keep the spoken answer SHORT: 2-3 sentences (about 40-60 words), only the essential point.",
    "normal": "",
    "detailed": "Give a DETAILED spoken answer: 8-12 sentences (about 160-230 words) with a concrete example, a trade-off or edge case, and a closing line. Still plain paragraphs, no bullets.",
}

CONTEXT_PROMPT = (
    "\n\nTARGET ROLE / JOB DESCRIPTION (the interview is for this; tailor answers to its skills and expectations, "
    "but never claim experience the resume doesn't support):\n{context}"
)

# Rewrite instructions for Redo / Shorter / Simpler
REGENERATE_HINTS = {
    "again": "Give a fresh, different take on the same question (new wording and a different example).",
    "shorter": "Answer the same question again but much shorter: 2-3 sentences.",
    "simpler": "Answer the same question again in simpler words, as if explaining to a non-expert, keeping it natural and spoken.",
}


def build_system_prompt(resume: str = "", length: str = "normal", context: str = "") -> str:
    # Concatenate/replace instead of str.format so braces in user text are safe.
    prompt = BASE_PROMPT
    if resume:
        prompt += RESUME_PROMPT.replace("{resume}", resume)
    if context:
        prompt += CONTEXT_PROMPT.replace("{context}", context)
    guide = LENGTH_GUIDE.get(length, "")
    if guide:
        prompt += "\n\nLENGTH (overrides any length stated above): " + guide
    return prompt


def build_user_message(question: str, history: list | None) -> str:
    if not history:
        return question
    speaker = {"interviewer": "Interviewer", "candidate": "Candidate (the user)"}
    lines = "\n".join(f"{speaker[h['role']]}: {h['text']}" for h in history)
    return (
        "CONVERSATION SO FAR (context only, do not answer these):\n"
        f"{lines}\n\n"
        "INTERVIEWER'S NEW MESSAGE (answer this):\n"
        f"{question}"
    )


async def _stream_once(sid: str, question: str, resume: str, effort: str, history: list | None, length: str, context: str, extra: str):
    """Runs one Groq streaming call. Returns (chars_emitted, finish_reason, full_text)."""
    stream = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": build_system_prompt(resume, length, context)},
            {"role": "user", "content": build_user_message(question, history) + (f"\n\nINSTRUCTION: {extra}" if extra else "")},
        ],
        temperature=0.3,
        max_completion_tokens=1500,  # reasoning tokens count too, so leave headroom for the visible answer
        stream=True,
        **({"reasoning_effort": effort} if "gpt-oss" in GROQ_MODEL else {}),
    )

    emitted = 0
    finish_reason = None
    parts: list[str] = []
    async for chunk in stream:
        if not chunk.choices:
            continue
        choice = chunk.choices[0]
        if choice.delta.content:
            emitted += len(choice.delta.content)
            parts.append(choice.delta.content)
            await sio.emit("ai_answer_chunk", {"text": choice.delta.content}, to=sid)
        finish_reason = choice.finish_reason or finish_reason
    return emitted, finish_reason, "".join(parts)


async def stream_answer(sid: str, question: str, resume: str = "", history: list | None = None,
                        length: str = "normal", context: str = "", extra: str = ""):
    """Streams an answer from Groq, emitting each chunk via socket as it arrives."""
    try:
        if groq_client is None:
            logger.error(f"[{sid}] GROQ_API_KEY is not set!")
            await sio.emit("ai_answer", {"text": "⚠️ AI service unavailable: GROQ_API_KEY is not configured on the server."}, to=sid)
            return

        logger.info(f"[{sid}] Streaming AI answer ({len(question)} chars{': ' + question if LOG_TRANSCRIPTS else ''}; resume: {bool(resume)})")

        # The model occasionally returns an empty reply; retry once with more reasoning before giving up.
        emitted = 0
        answer = ""
        for attempt, effort in enumerate(("low", "medium"), start=1):
            emitted, finish_reason, answer = await _stream_once(sid, question, resume, effort, history, length, context, extra)
            logger.info(f"[{sid}] Attempt {attempt}: {emitted} chars, finish_reason={finish_reason}")
            if emitted > 0:
                break

        if emitted == 0:
            await sio.emit("ai_answer", {"text": "⚠️ The AI returned an empty answer. Please tap Get AI Answer again."}, to=sid)

        await sio.emit("ai_answer_done", {}, to=sid)
        logger.info(f"[{sid}] Streaming complete.")

        # Flag first-person specifics that the resume doesn't back up, so the candidate can double-check them
        flags = check_claims(answer, resume)
        if flags:
            await sio.emit("ai_answer_flags", {"items": flags}, to=sid)

    except Exception as e:
        logger.error(f"[{sid}] Error streaming answer from Groq: {e}")
        await sio.emit("ai_answer", {"text": "⚠️ Couldn't get an answer from the AI service. Please try again."}, to=sid)
        await sio.emit("ai_answer_done", {}, to=sid)  # Always signal done even on error
