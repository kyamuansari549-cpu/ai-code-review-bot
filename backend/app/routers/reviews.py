"""API endpoints — the only layer that knows about HTTP (status codes, responses)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import storage
from ..github_client import InvalidPRUrlError, GitHubApiError, fetch_pr_data
from ..llm_reviewer import LLMError, review_diff
from ..schemas import ReviewListItem, ReviewRequest, ReviewResponse

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewResponse, status_code=201)
def create_review(payload: ReviewRequest, db: Session = Depends(get_db)):
    """Full pipeline: fetch PR → LLM review → save → return result."""
    pr_url = str(payload.pr_url).rstrip("/")

    try:
        pr_data = fetch_pr_data(pr_url)
        pr_data["pr_url"] = pr_url  # storage expects it in the same dict
        issues, was_truncated = review_diff(pr_data["diff"])
        review = storage.save_review(db, pr_data, issues, was_truncated)
    except InvalidPRUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except GitHubApiError as exc:
        # Record the failure so it still shows in history, then tell the caller
        storage.save_failed_review(db, pr_url, error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc))
    except LLMError as exc:
        storage.save_failed_review(db, pr_url, error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc))

    return review  # Pydantic converts ORM object → ReviewResponse automatically


@router.get("", response_model=list[ReviewListItem])
def get_reviews(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Recent reviews (newest first) — powers the History page."""
    return storage.list_reviews(db, limit=limit, offset=offset)


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    """One review with all its comments."""
    review = storage.get_review(db, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")
    return review