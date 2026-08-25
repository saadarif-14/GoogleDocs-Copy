# Architecture Note

Overview

The system is a small two-tier web app:

- Frontend: Static site using Quill (rich-text editor) and plain JavaScript. Served from `/static` by the FastAPI backend in this repository. The frontend calls backend REST endpoints under `/api`.
- Backend: FastAPI application using SQLModel (SQLite by default) for persistence. Provides endpoints to list, create, read, update, share documents, and an upload endpoint that accepts `.md` and `.txt` files and converts them to HTML.

Key components

- `backend/app/main.py`: FastAPI app, CORS config, static mount, API endpoints.
- `backend/app/models.py`: SQLModel models for `User`, `Document`, and `Share`.
- `backend/app/db.py`: Engine configuration and `init_db()` that creates schema.
- `frontend/index.html`, `frontend/app.js`: UI and client logic.
- `Dockerfile` / `docker-compose.yml`: Containerization and local orchestration.

Design notes

- Authentication: Simple mock auth using `x-user` header (seeded users). Replace with real auth for production.
- Persistence: SQLite persists to `backend/data/app.db`. For multiple-instance or production, migrate to Postgres and set a `DATABASE_URL` env var.
- Static serving: Frontend is served by the backend at `/static`. For scalability, serve the frontend from a static CDN (Vercel, Netlify) and point it to the backend via `BACKEND_URL`.

Scaling and production

- Swap SQLite for Postgres and use a managed DB (AWS RDS, Render Postgres). Update `backend/app/db.py` to use `DATABASE_URL`.
- Add HTTPS, secrets management, and proper auth (OAuth/JWT).
- Use a process manager (gunicorn/uvicorn) behind an ingress (Traefik/nginx) or deploy to a managed platform.
