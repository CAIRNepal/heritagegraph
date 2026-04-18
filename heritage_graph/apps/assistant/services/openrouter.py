from __future__ import annotations

import logging
import os

from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = (
    os.environ.get("OPENROUTER_BASE_URL") or ""
).strip() or "https://openrouter.ai/api/v1"


def _read_openrouter_key() -> str:
    k = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not k:
        msg = "OPENROUTER_API_KEY is not configured for the in-app assistant."
        raise ImproperlyConfigured(msg)
    return k


def _get_client():
    from openai import OpenAI

    default_headers: dict[str, str] = {}
    referer = (os.environ.get("OPENROUTER_HTTP_REFERER") or "").strip()
    title = (os.environ.get("OPENROUTER_X_TITLE") or "HeritageGraph Assistant").strip()
    if referer:
        default_headers["HTTP-Referer"] = referer
    default_headers["X-Title"] = title
    return OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=_read_openrouter_key(),
        default_headers=default_headers or None,
    )


def openrouter_chat_completion(
    *,
    model: str,
    system: str,
    user_assistant_messages: list[dict[str, str]],
    max_tokens: int = 1_200,
    temperature: float = 0.25,
) -> str:
    """
    Call OpenRouter (OpenAI-compatible) chat.completions. Returns assistant text only.
    """
    if not model or not model.strip():
        msg = "OpenRouter model id is empty (check tier env vars)."
        raise ImproperlyConfigured(msg)
    client = _get_client()
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        *user_assistant_messages,
    ]
    out = client.chat.completions.create(
        model=model.strip(),
        max_tokens=max_tokens,
        temperature=temperature,
        messages=messages,
    )
    choice = out.choices[0] if out.choices else None
    text = (choice.message.content or "").strip() if choice and choice.message else ""
    if not text:
        msg = "The model returned an empty response."
        raise RuntimeError(msg)
    return text
