import pytest

from app.services.answering import delay_for, looks_like_question
from app.services.claims import check_claims
from app.services.llm import build_system_prompt, build_user_message
from app.services.resume import ResumeError, extract_resume_text
from app.state import MAX_HISTORY, add_history, new_session


def test_looks_like_question():
    assert looks_like_question("Tell me about yourself.")
    assert looks_like_question("So what is the difference between a process and a thread")
    assert not looks_like_question("Okay great.")
    assert not looks_like_question("Yeah sounds good to me")


def test_delay_waits_longer_for_unfinished_sentences():
    assert delay_for("What is dependency injection?") < delay_for("Tell me about yourself.")
    assert delay_for("Tell me about yourself and") > delay_for("Tell me about yourself.")
    assert delay_for("Can you explain the difference between") > delay_for("Can you explain polymorphism.")


def test_check_claims_flags_things_missing_from_resume():
    resume = "Built LibraTrack with Spring Boot and MySQL."
    answer = "I built LibraTrack using Spring Boot. I also used Redis and cut latency by 40%."
    flagged = check_claims(answer, resume)
    assert "Redis" in flagged
    assert "40%" in flagged
    assert "LibraTrack" not in flagged and "Spring" not in flagged


def test_check_claims_ignores_generic_explanations_and_missing_resume():
    assert check_claims("Redis is an in-memory store.", "Java developer") == []  # not a first-person claim
    assert check_claims("I used Redis.", "") == []


def test_resume_txt_and_errors():
    assert extract_resume_text("cv.txt", b"Rahul Sharma\n\n\n\nJava") == "Rahul Sharma\n\nJava"
    with pytest.raises(ResumeError):
        extract_resume_text("cv.exe", b"x")
    with pytest.raises(ResumeError):
        extract_resume_text("empty.txt", b"   ")
    with pytest.raises(ResumeError):
        extract_resume_text("broken.pdf", b"not a pdf")


def test_system_prompt_options():
    prompt = build_system_prompt("Name {braces}", "short", "Java role")
    assert "Name {braces}" in prompt  # braces in user text must survive
    assert "Java role" in prompt
    assert "SHORT" in prompt
    assert "LENGTH" not in build_system_prompt("", "normal", "")


def test_user_message_includes_history_only_when_present():
    assert build_user_message("Q?", []) == "Q?"
    history = [{"role": "interviewer", "text": "Hi"}, {"role": "candidate", "text": "Hello"}]
    msg = build_user_message("Q?", history)
    assert "Interviewer: Hi" in msg and "Candidate (the user): Hello" in msg and msg.endswith("Q?")


def test_history_merges_same_speaker_and_is_capped():
    s = new_session()
    add_history(s, "candidate", "one")
    add_history(s, "candidate", "two")
    assert s["history"] == [{"role": "candidate", "text": "one two"}]
    for i in range(MAX_HISTORY * 2):
        add_history(s, "interviewer" if i % 2 == 0 else "candidate", str(i))
    assert len(s["history"]) == MAX_HISTORY


def test_resume_cleanup_fixes_pdf_glyph_artifacts():
    from app.services.resume import clean_text

    raw = "Educa tion\n2022 \x15 2026\nagentic work\x1dows, Classi\x1ccation, Pro ject \x88 Docker"
    cleaned = clean_text(raw)
    assert "Education" in cleaned
    assert "2022 - 2026" in cleaned
    assert "workflows" in cleaned and "Classification" in cleaned
    assert "Project" in cleaned and "•" in cleaned
    assert not any(ord(c) < 32 and c not in "\n\t" for c in cleaned)
