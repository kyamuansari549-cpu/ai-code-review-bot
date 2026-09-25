"""ORM models: a Review (one per PR URL) has many Comments (LLM-found issues)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    pr_url: Mapped[str] = mapped_column(String(500), nullable=False)
    owner: Mapped[str] = mapped_column(String(100), nullable=False)
    repo: Mapped[str] = mapped_column(String(100), nullable=False)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Model used for this review
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Meta about the run — useful for debugging ("why did the LLM miss file X?")
    diff_chars: Mapped[int] = mapped_column(Integer, default=0)        # size of diff sent
    files_changed: Mapped[int] = mapped_column(Integer, default=0)
    was_truncated: Mapped[bool] = mapped_column(default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)     # set if review failed

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    # One review → many comments; delete comments if the review is deleted
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="review", cascade="all, delete-orphan"
    )


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), index=True, nullable=False
    )

    file: Mapped[str] = mapped_column(String(500), default="")
    line: Mapped[int | None] = mapped_column(Integer, nullable=True)   # null = file-wide issue
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low/medium/high
    category: Mapped[str] = mapped_column(String(20), default="bug")     # bug/security/style
    description: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_fix: Mapped[str] = mapped_column(Text, default="")

    review: Mapped["Review"] = relationship(back_populates="comments")