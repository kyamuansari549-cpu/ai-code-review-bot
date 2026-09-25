"""FastAPI entry point — app creation, CORS, startup init, route registration."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
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

# Frontend runs on Vite dev server (localhost:5173) — allow it to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All review endpoints live under /reviews
app.include_router(reviews.router)
# Code chat endpoints live under /chats
app.include_router(chats.router)


@app.get("/health")
def health():
    return {"status": "ok"}