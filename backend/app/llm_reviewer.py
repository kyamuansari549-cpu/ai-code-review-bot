"""Sends the PR diff to an OpenAI-compatible LLM and returns structured review comments."""

import json

import httpx

from .config import settings


class LLMError(Exception):
    """Raised when the LLM call fails or returns unparseable output."""


# Don't blow up the context window — keep roughly the first ~100KB of diff
MAX_DIFF_CHARS = 100_000

SYSTEM_PROMPT = """You are a senior code reviewer. Review the pull request diff below.
Respond with ONLY a JSON array (no markdown fences, no explanation). Each element:
{"file": str, "line": int|null, "severity": "low"|"medium"|"high",
 "category": "bug"|"security"|"style", "description": str, "suggested_fix": str}
Rules: report only real, actionable issues; reference the correct file and line number
from the diff (use null if the issue is file-wide); keep descriptions under 3 sentences.
If the diff has no issues, return an empty array []."""


def _truncate_diff(diff: str) -> tuple[str, bool]:
    """Cut oversized diffs, flagging when truncation happened so we can warn the user."""
    if len(diff) <= MAX_DIFF_CHARS:
        return diff, False
    # Cut at a line boundary so we don't split a hunk mid-line
    cut = diff[:MAX_DIFF_CHARS]
    last_newline = cut.rfind("\n")
    return cut[:last_newline], True


def _extract_json_array(text: str) -> list[dict]:
    """Pull a JSON array out of the model response, tolerating stray prose/fences."""
    text = text.strip()
    # Try direct parse first (cheapest path)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Model often wraps JSON in ```json fences — strip and retry
        start, end = text.find("["), text.rfind("]")
        if start == -1 or end == -1:
            raise LLMError(f"LLM did not return a JSON array. Raw output: {text[:300]!r}")
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LLMError(f"Could not parse LLM JSON output: {exc}") from exc

    if not isinstance(data, list):
        raise LLMError("LLM output was valid JSON but not an array.")

    # Normalize/validate each issue — drop malformed entries instead of crashing
    valid_severities = {"low", "medium", "high"}
    valid_categories = {"bug", "security", "style"}
    issues = []
    for item in data:
        if not isinstance(item, dict) or "description" not in item:
            continue
        issues.append({
            "file": item.get("file", ""),
            "line": item.get("line"),          # may be null
            "severity": item.get("severity") if item.get("severity") in valid_severities else "medium",
            "category": item.get("category") if item.get("category") in valid_categories else "bug",
            "description": str(item.get("description", "")),
            "suggested_fix": str(item.get("suggested_fix", "")),
        })
    return issues


def review_diff(diff: str) -> tuple[list[dict], bool]:
    """Review a PR diff. Returns (issues, was_truncated)."""
    trimmed, was_truncated = _truncate_diff(diff)
    user_msg = f"PR diff ({'TRUNCATED — ' if was_truncated else ''}{len(trimmed)} chars):\n{trimmed}"

    try:
        resp = httpx.post(
            f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
            json={
                "model": settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.2,      # low temp = consistent, factual reviews
                "response_format": {"type": "json_object"}  # forces valid JSON (OpenAI-style)
                    if "api.openai.com" in settings.LLM_BASE_URL else None,
            },
            timeout=120.0,
        )
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach LLM API: {exc}") from exc

    if resp.status_code == 401:
        raise LLMError("LLM API rejected the key — check LLM_API_KEY in .env.")
    if resp.status_code != 200:
        raise LLMError(f"LLM API returned status {resp.status_code}: {resp.text[:200]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMError(f"Unexpected LLM response shape: {exc}") from exc

    return _extract_json_array(content), was_truncated