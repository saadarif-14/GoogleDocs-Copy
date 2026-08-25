# Papertrail

Papertrail is a small full-stack document editor built with FastAPI, SQLite, Quill, and plain JavaScript. It supports creating, renaming, rich-text editing, autosaving and reopening documents; importing files; and owner-controlled, view-only sharing.

## Run locally

### Docker (recommended)

```bash
docker compose up --build
```

Open <http://127.0.0.1:8001>. SQLite data is persisted in `backend/data/app.db` through the Compose volume.

### Python

Python 3.10 or newer is required.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Open <http://127.0.0.1:8000>. The app creates and seeds the database automatically.

## Demo workflow

1. Use the user switcher to act as seeded user `alice`.
2. Create a document and format it with headings, bold, italic, underline, or lists. Changes autosave after a short delay.
3. Select **Share**, enter `bob`, then switch users. The document appears under **Shared with me** and is visibly view-only.
4. Select **Import** to turn a UTF-8 `.txt` or `.md` file into a document. Imports are limited to 1 MB; other file types are rejected.

Authentication is intentionally mocked with an `x-user` request header and the two seeded accounts, `alice` and `bob`. It demonstrates authorization boundaries but is not production authentication.

## Test

```bash
pytest -q
```

The API tests cover rich-text persistence, rename/reopen behavior, sharing visibility, recipient write protection, duplicate sharing, Markdown import, validation, authentication, and frontend serving.

## Deployment

The Docker image is deployment-ready for a single persistent instance:

```bash
docker build -t papertrail .
docker run -p 8000:8000 -v papertrail-data:/app/backend/data papertrail
```

Deploy that image to Render, Railway, Fly.io, or another container host and attach a persistent volume at `/app/backend/data`. Then use the platform's public HTTPS URL. A live reviewer URL cannot be created from this repository alone because it requires access to a hosting account; the exact container command above is the supported deployment path.

For multi-instance production deployment, replace SQLite with Postgres, restrict CORS, pin dependencies, serve Quill locally or with an integrity-pinned asset, and replace mock auth with session or token authentication.

## Project map

- `backend/app/main.py` — API, access checks, validation, upload conversion, static serving
- `backend/app/models.py` — users, documents, and unique shares
- `backend/app/db.py` — SQLite engine and schema creation
- `frontend/` — Quill editor and application UI
- `tests/test_docs.py` — end-to-end API tests
- `ARCHITECTURE.md` — priorities, tradeoffs, and extension path
