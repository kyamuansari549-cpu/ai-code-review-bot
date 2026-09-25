"""FastAPI entry point — app creation, CORS, startup init, route registration."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .config import settings
from .routers import chats, reviews


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once on startup (before first request), then yields to the server
    init_db()
    yield
    # (no teardown needed — SQLite connections close per-request)


app = FastAPI(
    title="AI Code Review Bot",
    description="Reviews GitHub Pull Requests using an LLM",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS: support both specific list and wildcard.
# When allowing wildcard (*), allow_credentials must be False.
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
allow_all = "*" in origins or settings.ALLOWED_ORIGINS in ("*", "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_origin_regex=None if allow_all else r"https://.*\.vercel\.app",
    allow_credentials=False if allow_all else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All review endpoints live under /reviews
app.include_router(reviews.router)
# Code chat endpoints live under /chats
app.include_router(chats.router)


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the AI Code Review Bot API!",
        "health": "/health",
        "docs": "/docs",
        "models": "/models"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/models")
def list_models():
    """List the LLM models available for the frontend dropdown.

    Returns the default model first, then any additional models
    configured via the LLM_MODELS env var (comma-separated).
    """
    models = [settings.LLM_MODEL]
    if settings.LLM_MODELS:
        models += [m.strip() for m in settings.LLM_MODELS.split(",") if m.strip()]
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for m in models:
        if m not in seen:
            seen.add(m)
            unique.append(m)
    return {"default": settings.LLM_MODEL, "models": unique}