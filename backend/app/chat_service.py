"""Talks to the LLM for the code-chat feature.

The LLM has no memory, so every request carries the whole conversation so far.
A screenshot is read once by a vision model; the extracted code is stored as plain
text, so the rest of the chat needs no image and runs on the normal text model.
"""

import re

import httpx

from .config import settings
from .llm_reviewer import LLMError  # same error type as the PR reviewer

MAX_HISTORY_MESSAGES = 20   # how many past messages we resend each time
CHAT_MAX_TOKENS = 3000      # room for a full fixed file; lower it if your free tier complains
VISION_MAX_TOKENS = 3000

# The frontend looks for this prefix to show such a message as formatted code
SCREENSHOT_MARK = "📷 Extracted from screenshot:"


class VisionNotConfiguredError(LLMError):
    """LLM_VISION_MODEL is empty, so screenshots can't be read."""


CHAT_SYSTEM_PROMPT = """You are a senior software engineer who reviews code and helps fix it.
You work with any programming language: detect it from the code.

When the user shares code for the first time:
1. Name the language in one short line.
2. List the real issues (bugs, security, performance, style), most important first.
   For each: a short explanation and a small fix snippet.
3. Do NOT print the complete fixed code yet. End by offering it.

When the user asks for the full fixed code, return the complete corrected code in one
fenced code block with the language tag, then a short list of what you changed.

For follow-up questions, answer directly and concisely using the conversation so far.
If the code is incomplete or you are unsure, say so instead of guessing.

A message that starts with "📷 Extracted from screenshot:" holds code that was read from an
image, so it can contain small transcription mistakes (a missing character, wrong
indentation). Review it as normal code, but if something looks like a transcription slip
rather than a real bug, say so instead of reporting it as a bug.

Formatting: use short headings or a numbered list for the issues, bullet points for details,
and fenced code blocks with a language tag for all code.
Never use markdown tables and never use HTML tags such as <br>.
Skip long preambles.
Do not invent line numbers.
Language: reply in the language the user writes in. If the user writes Hinglish (Hindi in
Roman letters), reply in Hinglish in Roman letters, never in Devanagari script.
If the user asks for a specific language, use it for the rest of the chat.
Keep code, identifiers and error messages in English."""

VISION_PROMPT = """Transcribe the code in this screenshot exactly as written.
- Keep indentation, line breaks, comments and spelling. Do not fix or improve anything.
- Do not include line numbers from an editor gutter.
- If the screenshot also shows an error message or terminal output, put it in a second
  block after the code.
- Output only fenced code blocks with a language tag (use `text` for error output).
  No explanations.
- If the image contains no code, reply with exactly: NO_CODE"""


def _trim_history(history: list[dict]) -> list[dict]:
    """Keep the first message (it holds the original code) plus the most recent turns."""
    if len(history) <= MAX_HISTORY_MESSAGES:
        return history
    return [history[0]] + history[-(MAX_HISTORY_MESSAGES - 1):]


def _call_llm(model: str, messages: list[dict], temperature: float, max_tokens: int) -> str:
    """One call to the OpenAI-compatible chat API. Returns the reply text."""
    try:
        resp = httpx.post(
            f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=120.0,
        )
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach LLM API: {exc}") from exc

    if resp.status_code == 401:
        raise LLMError("LLM API rejected the key — check LLM_API_KEY in .env.")
    if resp.status_code == 413:
        raise LLMError("The request was too large for the LLM (try a smaller screenshot).")
    if resp.status_code == 429:
        raise LLMError("LLM rate limit reached — wait a minute and try again.")
    if resp.status_code != 200:
        raise LLMError(f"LLM API returned status {resp.status_code}: {resp.text[:200]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError(f"Unexpected LLM response shape: {exc}") from exc

    if not content or not content.strip():
        raise LLMError("LLM returned an empty reply.")
    return content.strip()


def chat_completion(history: list[dict], model: str | None = None) -> str:
    """Send the conversation so far to the LLM and return its reply text."""
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}, *_trim_history(history)]
    llm_model = model or settings.LLM_MODEL
    return _call_llm(llm_model, messages, temperature=0.3, max_tokens=CHAT_MAX_TOKENS)


def extract_code_from_image(data_url: str) -> str:
    """Ask the vision model to transcribe the code in a screenshot (base64 data URL)."""
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": VISION_PROMPT},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }]
    text = _call_llm(settings.LLM_VISION_MODEL, messages, temperature=0.0, max_tokens=VISION_MAX_TOKENS)

    # Some reasoning models put their thinking in <think> tags; drop it
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    if not text or (text.strip() == "NO_CODE"):
        raise LLMError("No code found in the screenshot. Try a clearer or larger screenshot.")
    return text


def build_user_content(content: str, image: str | None) -> str:
    """The text we store and send as the user's message. Reads the screenshot first if any."""
    if not image:
        return content
    if not settings.LLM_VISION_MODEL:
        raise VisionNotConfiguredError(
            "Screenshot support is off. Set LLM_VISION_MODEL in .env and restart the backend."
        )
    parts = [SCREENSHOT_MARK, extract_code_from_image(image)]
    if content.strip():
        parts.append(content.strip())
    return "\n\n".join(parts)
