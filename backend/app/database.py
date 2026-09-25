"""SQLite engine + session setup (SQLAlchemy 2.x style)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


# SQLite-specific arg: allow multi-threaded access (FastAPI runs async workers)
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

# autocommit=False → we control commits explicitly in storage.py
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for all ORM models — models.py will inherit from this."""
    pass


def get_db():
    """FastAPI dependency: yields a DB session and guarantees cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (idempotent — safe to call on every app startup)."""
    from . import models  # noqa: F401  (import so models register on Base.metadata)
    Base.metadata.create_all(bind=engine)