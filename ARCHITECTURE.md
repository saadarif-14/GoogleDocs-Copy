# Architecture

## Shape

Papertrail is deliberately a two-tier application. FastAPI serves both a small static Quill client and a REST API. SQLModel stores users, HTML document content, and document-to-user shares in SQLite. Keeping one deployable service makes the reviewer workflow reliable while still placing persistence and authorization on the server.

The browser sends the selected seeded username in `x-user`. Every document endpoint resolves that user and checks ownership or an explicit share. Owners can edit and share; recipients have view-only access. The API returns `access_role` and `owner_username`, allowing the client to communicate the same boundary without treating UI controls as security.

## Priorities

1. **A complete editing loop.** Quill provides accessible rich-text controls, HTML is persisted without flattening structure, and a 700 ms debounce autosaves edits. A per-user last-document key supports reopen after refresh.
2. **Visible, enforced sharing.** Owned and shared documents occupy separate sidebar sections. The UI disables editing for a recipient, while the backend independently rejects recipient updates.
3. **Product-relevant import.** UTF-8 Markdown is converted to HTML and plain text is HTML-escaped. The 1 MB limit bounds memory use; unsupported types and encodings produce clear errors.
4. **Small operational surface.** One container and one persistent SQLite volume are sufficient for this scope. API tests exercise the permissions and persistence contract rather than only isolated helpers.

## Data model

- `User`: unique seeded username.
- `Document`: title, rich-text HTML, owner, and timestamps.
- `Share`: unique `(doc_id, user_id)` grant. A grant means view access.

## Intentional tradeoffs

Mock authentication is suitable only for demonstrating user boundaries; headers can be forged. Stored editor HTML is trusted in this demo and should be sanitized before displaying content from untrusted users. SQLite suits one application instance but not horizontal scaling. Real-time co-editing and revision history are outside the requested scope.

A production evolution would add real identity, CSRF protection, HTML sanitization, Postgres migrations, object storage for attachments, dependency pinning, observability, and revision/version records.
