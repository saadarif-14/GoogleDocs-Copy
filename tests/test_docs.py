import os
import pytest
import sys
import os
from fastapi.testclient import TestClient

# ensure workspace root is on path for imports
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from backend.app.main import app
from backend.app.seed import seed

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup():
    # ensure DB seeded
    seed()
    yield

def test_create_and_share():
    # create doc as alice
    headers = {"x-user": "alice"}
    resp = client.post('/api/docs', data={'title': 'Testdoc', 'content': '<p>hi</p>'}, headers=headers)
    assert resp.status_code == 200
    doc = resp.json()
    doc_id = doc['id']
    # share with bob
    resp2 = client.post(f'/api/docs/{doc_id}/share', data={'username': 'bob'}, headers=headers)
    assert resp2.status_code == 200
    # bob should see it in shared
    headers_bob = {"x-user": "bob"}
    resp3 = client.get('/api/docs', headers=headers_bob)
    assert resp3.status_code == 200
    data = resp3.json()
    shared_titles = [d['title'] for d in data['shared']]
    assert 'Testdoc' in shared_titles
