from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from apps.assistant.nav_allowlist import sanitize_nav_path
from apps.assistant.services.openrouter import openrouter_chat_completion
from apps.assistant.services.retrieval import build_graph_context
from apps.assistant.services.routing import model_id_for_tier, select_tier

logger = logging.getLogger(__name__)


def _grounding_path() -> Path:
    return Path(__file__).resolve().parent.parent / "grounding" / "site.md"


def _read_grounding_copy() -> str:
    p = _grounding_path()
    if not p.is_file():
        return "# (Grounding file missing. Ask an administrator.)\n"
    return p.read_text(encoding="utf-8", errors="replace")[:20_000]


@dataclass(frozen=True, slots=True)
class AssistantTurnResult:
    text: str
    nav: str | None
    sources: list[dict[str, str]]


def _last_user_text(messages: list[dict[str, str]]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user" and m.get("content", "").strip():
            return m["content"].strip()
    return ""


def _user_assistant_messages(
    messages: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Map API messages to OpenAI: only user/assistant, non-empty content."""
    out: list[dict[str, str]] = []
    for m in messages:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            out.append({"role": str(role), "content": content})
    return out


def _parse_nav_trailer(text: str) -> tuple[str, str | None]:
    lines = (text or "").rstrip().splitlines()
    if not lines:
        return "", None
    last = lines[-1].strip()
    if not last.upper().startswith("NAV:"):
        return (text or "").strip(), None
    raw = last.split(":", 1)[1].strip()
    lines = lines[:-1]
    if raw.lower() in ("none", "null", "-", ""):
        return "\n".join(lines).strip(), None
    return "\n".join(lines).strip(), raw if raw else None


def _system_instructions_with_context(site: str, graph_text: str) -> str:
    return (
        "You are the HeritageGraph in-product assistant. You MUST only use the "
        "Context for factual claims about the product, navigation, and heritage "
        "records. If the Context does not support an answer, say you do not have that "
        "information in the available sources, and suggest browsing Knowledge areas or "
        "the About experience in the app—do not invent people, dates, or policies. "
        "For uncertain or speculative questions, be explicit that you are not sure and "
        "do not state guesses as fact. Use plain language, concise paragraphs. "
        "Use `[[Name]]` only when echoing a clear term from the Context. "
        "On the very last line of your reply, output exactly one line: "
        "`NAV: <path>` for a suggested in-app next step, or `NAV: none`. "
        "Paths must be internal and start with /. Prefer `NAV: none` if unsure."
        "\n\n# Context (this request; site copy and search excerpts)\n"
        f"{site}\n"
        f"\n## Graph excerpts (from latest user question)\n{graph_text}\n"
    )


def _max_output_tokens() -> int:
    return _int_from_env("ASSISTANT_MAX_OUTPUT_TOKENS", 1_200)


def _temperature() -> float:
    return _float_from_env("ASSISTANT_TEMPERATURE", 0.25)


def _int_from_env(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _float_from_env(name: str, default: float) -> float:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def run_assistant_turn(
    messages: list[dict[str, str]],
) -> AssistantTurnResult:
    if not messages:
        return AssistantTurnResult("Please send a message first.", None, [])

    last_q = _last_user_text(messages)
    site = _read_grounding_copy()
    graph_text, graph_sources = build_graph_context(last_q)
    if not last_q:
        return AssistantTurnResult(
            "Please type a message so I can search the graph.", None, []
        )

    system = _system_instructions_with_context(site, graph_text)
    ua = _user_assistant_messages(messages)
    if not ua:
        return AssistantTurnResult(
            "I could not read the conversation. Try again.", None, []
        )

    source_n = len(graph_sources)
    tier = select_tier(
        last_user_len=len(last_q),
        messages=ua,
        source_count=source_n,
    )
    model = model_id_for_tier(tier)
    logger.info(
        "assistant tier=%s openrouter_model=%s sources=%s",
        tier.value,
        model,
        source_n,
    )
    raw_text = openrouter_chat_completion(
        model=model,
        system=system,
        user_assistant_messages=ua,
        max_tokens=_max_output_tokens(),
        temperature=_temperature(),
    )

    text, nav_raw = _parse_nav_trailer(raw_text)
    safe_nav = sanitize_nav_path(nav_raw) if nav_raw else None
    if nav_raw and not safe_nav and "none" not in (nav_raw or "").lower():
        if text:
            text = (
                f"{text}\n\n(An internal navigation path was not applied because the "
                "suggested path is not allow-listed. Use menus to browse the app.)"
            )

    return AssistantTurnResult(
        text=text.strip() or "I could not form a response.",
        nav=safe_nav,
        sources=graph_sources,
    )
