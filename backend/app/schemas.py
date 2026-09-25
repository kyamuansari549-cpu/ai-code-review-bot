"""Pydantic schemas — the API contract between frontend and backend."""

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl, field_validator

from .github_client import parse_pr_url


class ReviewRequest(BaseModel):
    """POST /reviews body — just the PR URL, validated strictly."""

    pr_url: HttpUrl  # pydantic rejects any non-URL string for free

    @field_validator("pr_url", mode="after")
    @classmethod
    def _must_be_github_pr(cls, v: HttpUrl) -> HttpUrl:
        """Reject valid URLs that aren't GitHub PR URLs (e.g. google.com)."""
        parse_pr_url(str(v))  # raises InvalidPRUrlError → FastAPI returns 422
        return v


class CommentResponse(BaseModel):
    """One LLM-found issue, as returned to the frontend."""

    id: int
    file: str
    line: int | None
    severity: str
    category: str
    description: str
    suggested_fix: str

    model_config = {"from_attributes": True}  # build from SQLAlchemy ORM objects


class ReviewResponse(BaseModel):
    """Full review result — metadata + nested comments."""

    id: int
    pr_url: str
    owner: str
    repo: str
    pr_number: int
    was_truncated: bool
    error: str | None
    created_at: datetime
    comments: list[CommentResponse] = []

    model_config = {"from_attributes": True}


class ReviewListItem(BaseModel):
    """Lightweight row for GET /reviews (history page) — no nested comments."""

    id: int
    pr_url: str
    repo: str
    pr_number: int
    files_changed: int
    comment_count: int = Field(description="How many issues the LLM found")
    created_at: datetime

    model_config = {"from_attributes": True}