# Collaborative Editor — Demo

This repository contains a lightweight collaborative document editor (FastAPI backend, Quill frontend). This README explains how to run locally and how to deploy.

Local quickstart (Docker Compose)

1. Build and start using Docker Compose:
```bash
docker compose build
docker compose up -d
```
2. Open the app in your browser:

- Local URL: http://127.0.0.1:8001/ (container maps host port 8001 → container 8000)

Notes:
- The SQLite database is persisted to `backend/data` via the compose volume mapping.
- If port 8001 is in use, adjust `docker-compose.yml` or stop the local server running on 8000.

Run without Docker (Python venv)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Frontend configuration

- To point the frontend at a remote backend, add a `frontend/config.js` file that sets `window.BACKEND_URL` before `app.js` is loaded. Example in the repository notes.

Deployment recommendations

- Recommended path: host the backend on Render / Railway / Fly.io (Postgres recommended for production) and deploy static frontend on Vercel.
- Alternatively, build and push the Docker image to Docker Hub and run on any container host (DigitalOcean, AWS ECS, etc.).

Deploying the frontend to Vercel (step-by-step)

1. In the Vercel dashboard click "New Project" and import your Git repository.
2. Set the **Project Root** to `frontend` (so Vercel deploys the static site in that folder).
3. (Optional) Edit `frontend/config.js` in your repo to set `window.BACKEND_URL = 'https://your-backend.example.com'` before pushing, or modify the file after deploy.
4. Deploy — Vercel will publish a live URL. If your backend is hosted elsewhere, set `BACKEND_URL` to point to it.

Notes about configuring `BACKEND_URL`

- Because Vercel environment variables are injected at build time, the simplest approach is to commit the production value into `frontend/config.js` or serve a small server-side rewrite. Alternatively, you can host a tiny `config.js` on the backend and fetch it at runtime.


Files of interest

- `backend/` — FastAPI app, models, DB helpers
- `frontend/` — static frontend (Quill editor, JS)
- `Dockerfile`, `docker-compose.yml` — container setup
# Collaborative Document Editor (Demo)

This is a lightweight demo of a collaborative document editor with:
- Create, rename, edit, save, and reopen documents
- Basic rich-text editing (Quill) with bold/italic/underline/headings/lists
- File upload/import for `.md` and `.txt`
- Simple sharing model (owner + shared users)
- Persistence with SQLite (local)

Quick start (backend):

```bash
# create venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
# seed DB
python -m backend.app.seed
# run server
uvicorn backend.app.main:app --reload --port 8000
```

Open the app in a browser (the backend serves the frontend at root):

```
http://127.0.0.1:8000/
```

The frontend is a minimal spreadsheet-like UI (Google Sheets style demo) implemented with a contenteditable grid. It supports editing cells, adding rows/columns, importing CSV, saving sheets as documents, and sharing with seeded users (`alice`, `bob`).

Seeded users: `alice`, `bob`.

Testing:

```bash
pip install -r backend/requirements.txt
pytest
```

Notes:
- File imports only support `.md` and `.txt`.
- Auth is mocked via the `x-user` header (UI sets this).

AI Usage Note:
- I used coding assistance to draft repetitive scaffolding and generate example API patterns; I reviewed and adjusted logic, fixed edge cases, and wrote the tests and README manually.
