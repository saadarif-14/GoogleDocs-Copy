import os
import sys
from uuid import uuid4

from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from backend.app.main import app

client = TestClient(app)
ALICE = {"x-user": "alice"}
BOB = {"x-user": "bob"}


def create_doc(title=None, content="<p><strong>Hello</strong></p>"):
    response = client.post("/api/docs", data={"title": title or f"Test {uuid4()}", "content": content}, headers=ALICE)
    assert response.status_code == 201
    return response.json()


def test_create_save_reopen_preserves_rich_text():
    doc = create_doc()
    updated_html = "<h1>Plan</h1><ol><li><em>First</em></li></ol>"
    saved = client.put(f"/api/docs/{doc['id']}", data={"title": "Renamed plan", "content": updated_html}, headers=ALICE)
    assert saved.status_code == 200
    reopened = client.get(f"/api/docs/{doc['id']}", headers=ALICE)
    assert reopened.status_code == 200
    assert reopened.json()["title"] == "Renamed plan"
    assert reopened.json()["content"] == updated_html
    assert reopened.json()["access_role"] == "owner"


def test_share_is_visible_and_view_only_for_recipient():
    doc = create_doc()
    first = client.post(f"/api/docs/{doc['id']}/share", data={"username": "bob"}, headers=ALICE)
    assert first.status_code == 200
    duplicate = client.post(f"/api/docs/{doc['id']}/share", data={"username": "bob"}, headers=ALICE)
    assert duplicate.status_code == 200
    assert duplicate.json()["already_shared"] is True
    listing = client.get("/api/docs", headers=BOB).json()
    shared = next(item for item in listing["shared"] if item["id"] == doc["id"])
    assert shared["owner_username"] == "alice"
    assert shared["access_role"] == "viewer"
    forbidden = client.put(f"/api/docs/{doc['id']}", data={"title": "Hijacked", "content": "changed"}, headers=BOB)
    assert forbidden.status_code == 403


def test_markdown_import_and_upload_validation():
    imported = client.post("/api/upload", files={"file": ("notes.md", b"# Notes\n\n- one", "text/markdown")}, headers=ALICE)
    assert imported.status_code == 201
    assert imported.json()["title"] == "notes"
    assert "<h1>Notes</h1>" in imported.json()["content"]
    rejected = client.post("/api/upload", files={"file": ("image.png", b"not an image", "image/png")}, headers=ALICE)
    assert rejected.status_code == 400


def test_auth_title_validation_and_frontend_serving():
    assert client.get("/api/docs").status_code == 401
    assert client.post("/api/docs", data={"title": "   "}, headers=ALICE).status_code == 422
    page = client.get("/", follow_redirects=True)
    assert page.status_code == 200
    assert "Papertrail" in page.text
    assert client.get("/static/app.js").status_code == 200
