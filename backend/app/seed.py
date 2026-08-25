from sqlmodel import Session, select
from .db import engine, init_db
from .models import User, Document


def seed():
    init_db()
    with Session(engine) as session:
        # check if users exist
        u = session.exec(select(User).where(User.username == "alice")).first()
        if u:
            return
        alice = User(username="alice")
        bob = User(username="bob")
        session.add(alice)
        session.add(bob)
        session.commit()
        session.refresh(alice)
        # sample document
        doc = Document(title="Welcome", content="<p>Welcome to the collaborative editor.</p>", owner_id=alice.id)
        session.add(doc)
        session.commit()


if __name__ == "__main__":
    seed()
