from datetime import datetime
from html import escape
from pathlib import Path

import markdown
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from .db import engine, init_db
from .models import Document, Share, User
from .seed import seed

app = FastAPI(title="Papertrail", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
MAX_UPLOAD_BYTES = 1_000_000


@app.on_event("startup")
def on_startup():
    init_db()
    seed()


async def get_current_user(x_user: str | None = Header(default=None)) -> User:
    """Deliberately lightweight demo auth using one of the seeded usernames."""
    if not x_user or not x_user.strip():
        raise HTTPException(status_code=401, detail="Choose a user before continuing")
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == x_user.strip())).first()
        if not user:
            raise HTTPException(status_code=401, detail="Unknown user")
        session.expunge(user)
        return user


def clean_title(title: str) -> str:
    title = title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    if len(title) > 120:
        raise HTTPException(status_code=422, detail="Title must be 120 characters or fewer")
    return title


def document_json(session: Session, doc: Document, viewer: User) -> dict:
    owner = session.get(User, doc.owner_id)
    return {"id": doc.id, "title": doc.title, "content": doc.content,
            "owner_id": doc.owner_id, "owner_username": owner.username if owner else "unknown",
            "access_role": "owner" if doc.owner_id == viewer.id else "viewer",
            "created_at": doc.created_at, "updated_at": doc.updated_at}


def accessible_document(session: Session, doc_id: int, user: User) -> Document:
    doc = session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.owner_id != user.id:
        share = session.exec(select(Share).where(Share.doc_id == doc_id,
                                                  Share.user_id == user.id)).first()
        if not share:
            raise HTTPException(status_code=403, detail="This document has not been shared with you")
    return doc


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/users")
async def list_users(request_user: User = Depends(get_current_user)):
    with Session(engine) as session:
        return [{"username": user.username} for user in session.exec(select(User).order_by(User.username)).all()]


@app.get("/api/docs")
async def list_docs(request_user: User = Depends(get_current_user)):
    with Session(engine) as session:
        owned = session.exec(select(Document).where(Document.owner_id == request_user.id)
                             .order_by(Document.updated_at.desc())).all()
        shared = session.exec(select(Document).join(Share, Share.doc_id == Document.id)
                              .where(Share.user_id == request_user.id)
                              .order_by(Document.updated_at.desc())).all()
        return {"owned": [document_json(session, doc, request_user) for doc in owned],
                "shared": [document_json(session, doc, request_user) for doc in shared]}


@app.post("/api/docs", status_code=201)
async def create_doc(title: str = Form(...), content: str = Form("<p><br></p>"),
               request_user: User = Depends(get_current_user)):
    with Session(engine) as session:
        doc = Document(title=clean_title(title), content=content, owner_id=request_user.id)
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return document_json(session, doc, request_user)


@app.get("/api/docs/{doc_id}")
async def get_doc(doc_id: int, request_user: User = Depends(get_current_user)):
    with Session(engine) as session:
        return document_json(session, accessible_document(session, doc_id, request_user), request_user)


@app.put("/api/docs/{doc_id}")
async def update_doc(doc_id: int, title: str = Form(...), content: str = Form(...),
               request_user: User = Depends(get_current_user)):
    with Session(engine) as session:
        doc = accessible_document(session, doc_id, request_user)
        if doc.owner_id != request_user.id:
            raise HTTPException(status_code=403, detail="Shared documents are view-only")
        doc.title = clean_title(title)
        doc.content = content
        doc.updated_at = datetime.utcnow()
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return document_json(session, doc, request_user)


@app.post("/api/docs/{doc_id}/share")
async def share_doc(doc_id: int, username: str = Form(...),
              request_user: User = Depends(get_current_user)):
    with Session(engine) as session:
        doc = accessible_document(session, doc_id, request_user)
        if doc.owner_id != request_user.id:
            raise HTTPException(status_code=403, detail="Only the owner can share this document")
        user = session.exec(select(User).where(User.username == username.strip())).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.id == request_user.id:
            raise HTTPException(status_code=400, detail="You already own this document")
        existing = session.exec(select(Share).where(Share.doc_id == doc_id,
                                                     Share.user_id == user.id)).first()
        if not existing:
            session.add(Share(doc_id=doc_id, user_id=user.id))
            session.commit()
        return {"shared_with": user.username, "already_shared": bool(existing)}


@app.post("/api/upload", status_code=201)
async def upload_file(file: UploadFile = File(...), title: str | None = Form(None),
                      request_user: User = Depends(get_current_user)):
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in {".md", ".txt"}:
        raise HTTPException(status_code=400, detail="Only .md and .txt files are supported")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 1 MB or smaller")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="The file must use UTF-8 encoding")
    content = markdown.markdown(text) if suffix == ".md" else f"<pre>{escape(text)}</pre>"
    doc_title = clean_title(title or Path(filename).stem or "Imported document")
    with Session(engine) as session:
        doc = Document(title=doc_title, content=content, owner_id=request_user.id)
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return document_json(session, doc, request_user)


@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
