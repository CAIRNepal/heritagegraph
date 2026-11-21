from __future__ import annotations

import os
from enum import Enum


class ModelTier(str, Enum):
    """Cost/capability band for the assistant; maps to env OPENROUTER_MODEL_* ."""

    FAST = "fast"
    STANDARD = "standard"
    PREMIUM = "premium"


def _int_env(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _user_message_count(messages: list[dict[str, str]]) -> int:
    return sum(
        1
        for m in messages
        if m.get("role") == "user" and (m.get("content") or "").strip()
    )


def _turn_count(messages: list[dict[str, str]]) -> int:
    """Number of user+assistant non-empty messages (rough thread depth)."""
    return sum(
        1
        for m in messages
        if m.get("role") in ("user", "assistant") and (m.get("content") or "").strip()
    )


def select_tier(
    *,
    last_user_len: int,
    messages: list[dict[str, str]],
    source_count: int,
) -> ModelTier:
    """
    Server-only routing: no client hints. Bias to STANDARD when ambiguous.

    Env overrides (optional):
    - ASSISTANT_TIER_PREMIUM_MIN_USER_CHARS (default 600)
    - ASSISTANT_TIER_PREMIUM_MIN_TURNS (default 9) — count of user+assistant messages
    - ASSISTANT_TIER_PREMIUM_MIN_SOURCES (default 5)
    - ASSISTANT_TIER_FAST_MAX_USER_CHARS (default 100) — last user message length
    - ASSISTANT_TIER_FAST_MAX_USER_MESSAGES (default 2) — how many user turns in thread
    - ASSISTANT_TIER_FAST_MAX_SOURCES (default 1) — max graph sources for FAST
    """
    prem_min_chars = _int_env("ASSISTANT_TIER_PREMIUM_MIN_USER_CHARS", 600)
    prem_min_turns = _int_env("ASSISTANT_TIER_PREMIUM_MIN_TURNS", 9)
    prem_min_sources = _int_env("ASSISTANT_TIER_PREMIUM_MIN_SOURCES", 5)

    fast_max_chars = _int_env("ASSISTANT_TIER_FAST_MAX_USER_CHARS", 100)
    fast_max_user_msgs = _int_env("ASSISTANT_TIER_FAST_MAX_USER_MESSAGES", 2)
    fast_max_sources = _int_env("ASSISTANT_TIER_FAST_MAX_SOURCES", 1)

    user_msgs = _user_message_count(messages)
    turns = _turn_count(messages)

    if last_user_len >= prem_min_chars:
        return ModelTier.PREMIUM
    if source_count >= prem_min_sources:
        return ModelTier.PREMIUM
    if turns >= prem_min_turns:
        return ModelTier.PREMIUM

    # FAST: very small thread, short last message, light or no retrieval.
    if (
        last_user_len < fast_max_chars
        and user_msgs <= fast_max_user_msgs
        and source_count <= fast_max_sources
    ):
        return ModelTier.FAST

    return ModelTier.STANDARD


def model_id_for_tier(tier: ModelTier) -> str:
    """
    Resolve OpenRouter model slug.

    Empty FAST/PREMIUM fall back to STANDARD. STANDARD is required.
    """
    fast = (os.environ.get("OPENROUTER_MODEL_FAST") or "").strip()
    standard = (os.environ.get("OPENROUTER_MODEL_STANDARD") or "").strip()
    premium = (os.environ.get("OPENROUTER_MODEL_PREMIUM") or "").strip()

    if not standard:
        from django.core.exceptions import ImproperlyConfigured

        msg = "OPENROUTER_MODEL_STANDARD is not configured."
        raise ImproperlyConfigured(msg)

    if tier is ModelTier.FAST:
        return fast or standard
    if tier is ModelTier.PREMIUM:
        return premium or standard
    return standard
