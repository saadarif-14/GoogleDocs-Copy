from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from .db import engine, init_db, get_session
from .models import User, Document, Share
from .seed import seed
import markdown
from typing import List

app = FastAPI()

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount frontend static files
app.mount("/static", StaticFiles(directory="./frontend"), name="static")

@app.on_event("startup")
def on_startup():
    init_db()
    seed()

# Simple mock auth using header 'x-user'
def get_current_user(x_user: str = Depends(lambda: None)):
    from fastapi import Request
    def _inner(request: Request):
        uname = request.headers.get("x-user")
        if not uname:
            raise HTTPException(status_code=401, detail="Missing x-user header for auth")
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == uname)).first()
            if not user:
                raise HTTPException(status_code=401, detail="Unknown user")
            return user
    return _inner

@app.post("/api/auth/login")
def login(username: str = Form(...)):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"username": user.username}

@app.get("/api/docs")
def list_docs(request_user: User = Depends(get_current_user())):
    with Session(engine) as session:
        # owned docs
        owned = session.exec(select(Document).where(Document.owner_id == request_user.id)).all()
        # shared docs
        q = select(Document).join(Share, Share.doc_id == Document.id).where(Share.user_id == request_user.id)
        shared = session.exec(q).all()
        return {"owned": owned, "shared": shared}

@app.post("/api/docs")
def create_doc(title: str = Form(...), content: str = Form(...), request_user: User = Depends(get_current_user())):
    with Session(engine) as session:
        doc = Document(title=title, content=content, owner_id=request_user.id)
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return doc

@app.get("/api/docs/{doc_id}")
def get_doc(doc_id: int, request_user: User = Depends(get_current_user())):
    with Session(engine) as session:
        doc = session.get(Document, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        # check access
        if doc.owner_id != request_user.id:
            shared = session.exec(select(Share).where(Share.doc_id == doc_id, Share.user_id == request_user.id)).first()
            if not shared:
                raise HTTPException(status_code=403, detail="Not shared with you")
        return doc

@app.put("/api/docs/{doc_id}")
def update_doc(doc_id: int, title: str = Form(...), content: str = Form(...), request_user: User = Depends(get_current_user())):
    with Session(engine) as session:
        doc = session.get(Document, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.owner_id != request_user.id:
            raise HTTPException(status_code=403, detail="Only owner can edit")
        doc.title = title
        doc.content = content
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return doc

@app.post("/api/docs/{doc_id}/share")
def share_doc(doc_id: int, username: str = Form(...), request_user: User = Depends(get_current_user())):
    with Session(engine) as session:
        doc = session.get(Document, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.owner_id != request_user.id:
            raise HTTPException(status_code=403, detail="Only owner can share")
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # create share
        s = Share(doc_id=doc_id, user_id=user.id)
        session.add(s)
        session.commit()
        session.refresh(s)
        return {"shared_with": user.username}

@app.post("/api/upload")
def upload_file(file: UploadFile = File(...), title: str = Form(None), request_user: User = Depends(get_current_user())):
    fname = file.filename
    if not fname.lower().endswith((".md", ".txt")):
        raise HTTPException(status_code=400, detail="Only .md and .txt files supported")
    data = file.file.read().decode(errors="ignore")
    # convert markdown to HTML
    html = markdown.markdown(data) if fname.lower().endswith(".md") else "<pre>" + data.replace("<","&lt;").replace(">","&gt;") + "</pre>"
    doc_title = title or fname
    with Session(engine) as session:
        doc = Document(title=doc_title, content=html, owner_id=request_user.id)
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return doc

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")
