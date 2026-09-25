"""API tests with GitHub + LLM mocked — no network calls, no real tokens needed."""

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app


# Fresh DB per test run (file-based so it works with FastAPI's threadpool)
client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    """Point the app at an in-memory DB and rebuild tables before each test."""
    monkeypatch.setattr("app.database.engine", engine)  # keep same engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _mock_pipeline(monkeypatch, issues=None, github_exc=None, llm_exc=None):
    """Stub the two external services at the router's import site."""
    from app.routers import reviews as router_mod

    if github_exc:
        monkeypatch.setattr(router_mod, "fetch_pr_data", lambda url: (_ for _ in ()).throw(github_exc))
    else:
        monkeypatch.setattr(router_mod, "fetch_pr_data",
                            lambda url: {"pr_url": url, "owner": "o", "repo": "r",
                                         "pr_number": 1, "diff": "diff", "files": []})
    if llm_exc:
        monkeypatch.setattr(router_mod, "review_diff", lambda diff: (_ for _ in ()).throw(llm_exc))
    else:
        monkeypatch.setattr(router_mod, "review_diff", lambda diff: (issues or [], False))


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_create_review_success(monkeypatch):
    _mock_pipeline(monkeypatch, issues=[
        {"file": "a.py", "line": 5, "severity": "high", "category": "security",
         "description": "SQL injection", "suggested_fix": "use parameterized query"},
    ])
    resp = client.post("/reviews", json={"pr_url": "https://github.com/o/r/pull/1"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["pr_number"] == 1 and len(data["comments"]) == 1
    assert data["comments"][0]["severity"] == "high"


def test_invalid_url_rejected():
    resp = client.post("/reviews", json={"pr_url": "https://example.com/not-a-pr"})
    assert resp.status_code == 422  # fails at pydantic validation layer


def test_github_error_saved_as_failed_review(monkeypatch):
    from app.github_client import GitHubApiError
    _mock_pipeline(monkeypatch, github_exc=GitHubApiError("PR not found"))
    resp = client.post("/reviews", json={"pr_url": "https://github.com/o/r/pull/99"})
    assert resp.status_code == 502
    # Failure still visible in history
    history = client.get("/reviews").json()
    assert history[0]["pr_number"] == 99
    detail = client.get(f"/reviews/{history[0]['id']}").json()
    assert "PR not found" in detail["error"]


def test_llm_error_returns_502(monkeypatch):
    from app.llm_reviewer import LLMError
    _mock_pipeline(monkeypatch, llm_exc=LLMError("bad key"))
    resp = client.post("/reviews", json={"pr_url": "https://github.com/o/r/pull/2"})
    assert resp.status_code == 502


def test_get_missing_review_404():
    assert client.get("/reviews/9999").status_code == 404