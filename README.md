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
