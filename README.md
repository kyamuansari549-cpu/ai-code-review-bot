# AI Code Review Bot

Paste a GitHub Pull Request URL and get an LLM-generated review: bugs, security issues and suggested fixes, grouped by severity. Every review is saved, so past results can be opened from a History page.

The LLM is a pre-trained model called through an OpenAI-compatible API. No model training is involved. The work in this project is the integration: GitHub API, prompt and response handling, persistence, API design and the UI.

## Architecture

```
React (Vite)  --->  FastAPI  --->  github_client  --->  GitHub REST API
   UI                routers            |
                        |               +--->  llm_reviewer  --->  LLM API
                        +--->  storage (SQLAlchemy)  --->  SQLite
```

- `routers/reviews.py`: the only layer that knows about HTTP (status codes, response models)
- `github_client.py`: parses the PR URL, fetches the diff and metadata
- `llm_reviewer.py`: sends the diff to the LLM and parses the issues it returns
- `storage.py`, `models.py`, `database.py`: persistence
- `schemas.py`: request and response validation (Pydantic)
- `frontend/src`: `api/client.js` (all backend calls), pages and components

## Tech stack

FastAPI, SQLAlchemy, SQLite, Pydantic, React 18, Vite, Docker, nginx.

## Run locally

Backend (from `backend/`):
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Create `.env` with `GITHUB_TOKEN`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` and `DATABASE_URL`.

Frontend (from `frontend/`):
```
npm install
npm run dev
```
Open http://localhost:5173. API docs are at http://localhost:8000/docs.

## Run with Docker

```
docker compose up --build
```
App on http://localhost:3000, API on http://localhost:8000. The SQLite file lives on a named volume, so data survives restarts.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/reviews` | Review a PR (`{"pr_url": "..."}`), save and return the result |
| GET | `/reviews` | Recent reviews, newest first (`limit`, `offset`) |
| GET | `/reviews/{id}` | One review with all its comments |
| GET | `/health` | Liveness check |

Errors: `422` for an invalid PR URL, `502` when GitHub or the LLM fails, `404` for an unknown review.

## Design decisions

- **Layered backend.** Routes handle HTTP, other modules handle GitHub, LLM and storage. Each can be tested or replaced on its own.
- **Failures are recorded.** If GitHub or the LLM fails, the failed attempt is saved and shown in History with its error.
- **Large diffs are truncated.** The API reports `was_truncated` and the UI warns that only the first part was reviewed.
- **High severity first** in the results, since those are the most actionable.
- **Config from environment variables**, validated at startup, no secrets in code.
- **Same-origin API calls.** Vite proxies `/reviews` in dev and nginx does in Docker, so the frontend uses relative URLs.

## Limitations

- The review runs inside the HTTP request, so a slow LLM means a slow response.
- No authentication or per-user history.
- LLM output is not deterministic, so two runs on the same PR can differ.
- SQLite suits a single instance only.

## Future improvements

- Run reviews as background jobs and poll for status
- Post the comments back to the PR through the GitHub API
- Add login and per-user history
- Use Postgres and add a response cache
- Measure quality against PRs with known bugs
