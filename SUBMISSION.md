# Submission Contents

This folder contains the deliverables for submission.

Included items

- Source code (full repository):
  - `backend/` — FastAPI application, models, DB helpers, seed data
  - `frontend/` — static frontend UI and JavaScript
  - `Dockerfile` — container image to run the app
  - `docker-compose.yml` — compose file for local orchestration

- Documentation and notes:
  - `README.md` — local setup, run, and deployment instructions
  - `ARCHITECTURE.md` — short architecture note
  - `AI_WORKFLOW.md` — AI workflow note describing how the assistant helped
  - `SUBMISSION.md` — this file

- Tests:
  - `tests/test_docs.py` — integration test (passed locally)

Live product URL

- The app is currently available locally when run with Docker Compose at:
  - http://127.0.0.1:8001/  (container host port 8001)

To make a public live URL, deploy the backend to a hosted service (Render, Railway, Fly.io) and the frontend to Vercel (or serve both from the same host). See `README.md` for step-by-step deployment instructions.

Packaging for submission

- To create a zip of the repo (ready to upload to Google Drive):
```bash
git archive --format=zip --output=ai-native-submission.zip HEAD
```
