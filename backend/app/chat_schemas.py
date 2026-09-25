"""Request/response shapes for the chat endpoints (Pydantic validates them)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Keeps one message inside the free-tier token limits (~8k tokens)
MAX_CONTENT_CHARS = 30_000
# A screenshot arrives as a base64 data URL; the frontend shrinks it below this
MAX_IMAGE_CHARS = 4_000_000
IMAGE_PREFIXES = (
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
)


class MessageCreate(BaseModel):
    content: str = Field(default="", max_length=MAX_CONTENT_CHARS)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_CHARS)  # optional screenshot
    model: str | None = Field(default=None, max_length=100)  # optional model override

    @model_validator(mode="after")
    def check_text_or_image(self):
        if not self.content.strip() and not self.image:
            raise ValueError("Send some code, a question or a screenshot.")
        if self.image and not self.image.startswith(IMAGE_PREFIXES):
            raise ValueError("Image must be a PNG, JPEG or WebP data URL.")
        return self


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime


class ChatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    messages: list[MessageOut]


class ChatListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
