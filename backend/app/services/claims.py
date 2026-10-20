import re

# Capitalised words / numbers that commonly start sentences or are too generic to flag
_IGNORE = {
    "i", "my", "the", "and", "in", "on", "at", "for", "with", "to", "of", "a", "an", "it", "this", "that", "so", "but",
    "as", "we", "our", "when", "while", "since", "then", "also", "after", "before", "because", "during", "using",
    "one", "two", "first", "second", "overall", "additionally", "however", "thank", "thanks", "hi", "hello",
}
_CLAIM_SENTENCE = re.compile(r"\b(I|I'm|I've|I'd|my|we|our)\b")
_TOKEN = re.compile(r"[A-Z][A-Za-z0-9+#.\-]{2,}|\d[\d,.]*%?\+?")


def check_claims(answer: str, resume: str, limit: int = 6) -> list[str]:
    """
    Flags specifics (tools, names, numbers) that the answer claims in first person
    but that don't appear anywhere in the resume, so the candidate can double-check them.
    """
    if not answer or not resume:
        return []
    resume_l = resume.lower()
    flagged: list[str] = []

    for sentence in re.split(r"(?<=[.!?])\s+", answer):
        if not _CLAIM_SENTENCE.search(sentence):
            continue
        for i, match in enumerate(_TOKEN.finditer(sentence)):
            token = match.group(0).rstrip(".,-")
            low = token.lower()
            if not token or low in _IGNORE or (i == 0 and match.start() == 0):
                continue
            if low in resume_l or token in flagged:
                continue
            flagged.append(token)
            if len(flagged) >= limit:
                return flagged
    return flagged
