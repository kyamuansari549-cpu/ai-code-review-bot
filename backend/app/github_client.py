"""Fetches PR diff and changed-file list from the GitHub REST API."""

import re

import httpx

from .config import settings


# ---- Custom exceptions: routers will catch these and map to HTTP status codes ----

class InvalidPRUrlError(Exception):
    """Raised when the PR URL does not match github.com/owner/repo/pull/N."""


class GitHubApiError(Exception):
    """Raised when the GitHub API call fails (network, 404, rate limit, etc.)."""


# Matches: https://github.com/owner/repo/pull/123  (optional trailing slash / /files etc.)
_PR_URL_RE = re.compile(
    r"^https?://github\.com/(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+)/pull/(?P<number>\d+)/?$"
)

API_BASE = "https://api.github.com"


def parse_pr_url(pr_url: str) -> tuple[str, str, int]:
    """Extract (owner, repo, pr_number) from a GitHub PR URL."""
    match = _PR_URL_RE.match(pr_url.strip())
    if not match:
        raise InvalidPRUrlError(
            f"Invalid PR URL: {pr_url!r}. Expected format: https://github.com/<owner>/<repo>/pull/<number>"
        )
    return match.group("owner"), match.group("repo"), int(match.group("number"))


def _headers() -> dict[str, str]:
    """Auth headers — token is optional, but raises the 60/hour rate limit to 5000/hour."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return headers


def fetch_pr_diff(owner: str, repo: str, pr_number: int) -> str:
    """Return the unified diff of the PR as plain text."""
    url = f"{API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}"
    try:
        # "Accept: diff" makes GitHub return the raw .diff instead of JSON
        resp = httpx.get(
            url,
            headers={**_headers(), "Accept": "application/vnd.github.v3.diff"},
            timeout=30.0,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        raise GitHubApiError(f"Could not reach GitHub: {exc}") from exc

    if resp.status_code == 404:
        raise GitHubApiError(f"PR not found (or private repo without a valid token): {url}")
    if resp.status_code == 403:
        raise GitHubApiError("GitHub rate limit exceeded — set GITHUB_TOKEN in your .env file.")
    if resp.status_code != 200:
        raise GitHubApiError(f"GitHub API returned status {resp.status_code}: {resp.text[:200]}")

    return resp.text


def fetch_changed_files(owner: str, repo: str, pr_number: int) -> list[dict]:
    """Return list of changed files: [{filename, status, additions, deletions, patch}]."""
    url = f"{API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}/files"
    try:
        resp = httpx.get(url, headers=_headers(), timeout=30.0, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise GitHubApiError(f"Could not reach GitHub: {exc}") from exc

    if resp.status_code == 404:
        raise GitHubApiError(f"PR not found: {url}")
    if resp.status_code == 403:
        raise GitHubApiError("GitHub rate limit exceeded — set GITHUB_TOKEN in your .env file.")
    if resp.status_code != 200:
        raise GitHubApiError(f"GitHub API returned status {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    # Keep only the fields we need — API response has extra noise (blob URLs, sha, etc.)
    return [
        {
            "filename": f["filename"],
            "status": f["status"],              # added / modified / removed
            "additions": f["additions"],
            "deletions": f["deletions"],
            "patch": f.get("patch", ""),        # diff hunk for this file (may be missing for binaries)
        }
        for f in data
    ]


def fetch_pr_data(pr_url: str) -> dict:
    """One-call helper for routers: parse URL, then fetch diff + changed files."""
    owner, repo, pr_number = parse_pr_url(pr_url)
    return {
        "owner": owner,
        "repo": repo,
        "pr_number": pr_number,
        "diff": fetch_pr_diff(owner, repo, pr_number),
        "files": fetch_changed_files(owner, repo, pr_number),
    }