from typing import Optional
from sqlmodel import SQLModel, Field, UniqueConstraint
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str
    owner_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Share(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("doc_id", "user_id", name="uq_document_user_share"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    doc_id: int = Field(foreign_key="document.id")
    user_id: int = Field(foreign_key="user.id")
