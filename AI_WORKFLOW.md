# AI Workflow Note

This file documents how I used AI assistance while building this project.

Summary

- I used an AI coding assistant to scaffold the FastAPI backend and the static Quill-based frontend, iterate on UI layout, and implement features like document CRUD, sharing, file upload conversion, autosave, and a recent-docs list.
- The assistant was directed to produce small, focused patches via `apply_patch` and to run local commands to build and test the app (install dependencies, run tests, run Docker Compose).

Key AI-driven steps

1. Generate initial FastAPI endpoints, models, and seed data.
2. Implement frontend UI with Quill and wire API calls to the backend via `fetch` and `x-user` mock auth.
3. Add autosave and last-open persistence using `localStorage` and `setInterval`/debounce patterns.
4. Containerize the app by adding a `Dockerfile` and `docker-compose.yml` and boot it locally to verify.
5. Create documentation files and deployment instructions.

Safety and verification

- I ran unit/integration tests (`pytest`) and started the app locally and in Docker to verify features. I validated the REST endpoints with `curl`.
- Security notes: The project uses `x-user` header mock auth; real production must use proper auth, CORS restrictions, and input sanitization.
