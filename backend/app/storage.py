"""DB read/write helpers — routers call these, never the ORM directly."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from . import models, schemas


def save_review(
    db: Session,
    pr_data: dict,               # from github_client.fetch_pr_data
    issues: list[dict],          # from llm_reviewer.review_diff
    was_truncated: bool,
    model: str | None = None,    # model used for review
) -> models.Review:
    """Persist a completed review with all its comments in one transaction."""
    review = models.Review(
        pr_url=pr_data["pr_url"],
        owner=pr_data["owner"],
        repo=pr_data["repo"],
        pr_number=pr_data["pr_number"],
        model=model,
        diff_chars=len(pr_data["diff"]),
        files_changed=len(pr_data["files"]),
        was_truncated=was_truncated,
    )
    review.comments = [
        models.Comment(
            file=i["file"], line=i["line"], severity=i["severity"],
            category=i["category"], description=i["description"],
            suggested_fix=i["suggested_fix"],
        )
        for i in issues
    ]
    db.add(review)
    db.commit()          # one commit → atomic save of review + comments
    db.refresh(review)   # populate auto-generated id / created_at
    return review


def save_failed_review(db: Session, pr_url: str, error: str) -> models.Review:
    """Save a failed run so it shows up in history instead of vanishing silently."""
    # Owner/repo/number may be unknown if the failure happened early (bad URL etc.)
    try:
        from .github_client import parse_pr_url
        owner, repo, pr_number = parse_pr_url(pr_url)
    except Exception:
        owner, repo, pr_number = "", "", 0

    review = models.Review(
        pr_url=pr_url, owner=owner, repo=repo, pr_number=pr_number, error=error
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def get_review(db: Session, review_id: int) -> models.Review | None:
    """Fetch one review with its comments (None if id doesn't exist)."""
    stmt = (
        select(models.Review)
        .options(selectinload(models.Review.comments))  # 1 query, no N+1
        .where(models.Review.id == review_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def list_reviews(db: Session, limit: int = 50, offset: int = 0) -> list[dict]:
    """Recent reviews with comment counts — for the history page."""
    count = func.count(models.Comment.id).label("comment_count")
    stmt = (
        select(
            models.Review.id, models.Review.pr_url, models.Review.repo,
            models.Review.pr_number, models.Review.files_changed,
            models.Review.created_at, count,
        )
        .outerjoin(models.Comment, models.Comment.review_id == models.Review.id)
        .group_by(models.Review.id)
        .order_by(models.Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [dict(row._mapping) for row in db.execute(stmt).all()]