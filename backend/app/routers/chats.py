"""Chat endpoints: paste code or a screenshot, get a review, ask follow-ups, get the full fixed code."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import chat_storage
from ..chat_schemas import ChatListItem, ChatOut, MessageCreate
from ..chat_service import VisionNotConfiguredError, build_user_content, chat_completion
from ..config import settings
from ..database import get_db
from ..llm_reviewer import LLMError

router = APIRouter(prefix="/chats", tags=["chats"])


def _prepare(payload: MessageCreate) -> str:
    """Turn the request into the user's message text (reads the screenshot if there is one)."""
    try:
        return build_user_content(payload.content, payload.image)
    except VisionNotConfiguredError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


def _ask(history: list[dict], model: str | None = None) -> str:
    """Call the LLM and turn our LLMError into a 502 for the client."""
    try:
        return chat_completion(history, model=model)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("", response_model=ChatOut, status_code=201)
def create_chat(payload: MessageCreate, db: Session = Depends(get_db)):
    """Start a new chat with code, a question or a screenshot in the first message."""
    user_text = _prepare(payload)
    model = payload.model or settings.LLM_MODEL
    # Ask the LLM first; only save if it succeeds, so failures leave no half-made chat
    reply = _ask([{"role": "user", "content": user_text}], model=model)

    convo = chat_storage.create_conversation(db, user_text, model=model)
    chat_storage.add_message(db, convo.id, "user", user_text)
    chat_storage.add_message(db, convo.id, "assistant", reply)
    db.refresh(convo)
    return convo


@router.post("/{chat_id}/messages", response_model=ChatOut)
def send_message(chat_id: int, payload: MessageCreate, db: Session = Depends(get_db)):
    """Follow-up in an existing chat (a question, 'give me the full fixed code', or a new screenshot)."""
    convo = chat_storage.get_conversation(db, chat_id)
    if convo is None:
        raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")

    user_text = _prepare(payload)
    model = payload.model or convo.model or settings.LLM_MODEL

    # The LLM has no memory: resend the whole history plus the new message
    history = [{"role": m.role, "content": m.content} for m in convo.messages]
    history.append({"role": "user", "content": user_text})
    reply = _ask(history, model=model)

    chat_storage.add_message(db, convo.id, "user", user_text)
    chat_storage.add_message(db, convo.id, "assistant", reply)
    db.refresh(convo)
    return convo


@router.get("", response_model=list[ChatListItem])
def list_chats(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Recent chats, newest first."""
    return chat_storage.list_conversations(db, limit=limit, offset=offset)


@router.get("/{chat_id}", response_model=ChatOut)
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    """One chat with all its messages."""
    convo = chat_storage.get_conversation(db, chat_id)
    if convo is None:
        raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
    return convo


@router.delete("/{chat_id}", status_code=204)
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    convo = chat_storage.get_conversation(db, chat_id)
    if convo is None:
        raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
    chat_storage.delete_conversation(db, convo)
    return Response(status_code=204)
