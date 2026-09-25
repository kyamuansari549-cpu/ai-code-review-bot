"""Database reads/writes for chats — no HTTP and no LLM logic in here."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .chat_models import Conversation, Message


def create_conversation(db: Session, first_message: str, model: str | None = None) -> Conversation:
    # Title = first ~60 characters of the first message, whitespace collapsed
    title = " ".join(first_message.split())[:60] or "New chat"
    convo = Conversation(title=title, model=model)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


def add_message(db: Session, conversation_id: int, role: str, content: str) -> Message:
    msg = Message(conversation_id=conversation_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_conversation(db: Session, conversation_id: int) -> Conversation | None:
    return db.get(Conversation, conversation_id)


def list_conversations(db: Session, limit: int = 50, offset: int = 0) -> list[Conversation]:
    stmt = select(Conversation).order_by(Conversation.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def delete_conversation(db: Session, conversation: Conversation) -> None:
    db.delete(conversation)
    db.commit()
