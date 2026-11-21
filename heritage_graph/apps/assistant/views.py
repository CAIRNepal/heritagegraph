from __future__ import annotations

import logging

from apps.assistant.serializers import ChatCompletionRequestSerializer
from apps.assistant.services.chat_completion import run_assistant_turn
from django.core.exceptions import ImproperlyConfigured
from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    RateLimitError,
)
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([AllowAny])
def chat_completion(request: Request) -> Response:
    ser = ChatCompletionRequestSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    data = ser.validated_data
    messages = [{"role": m["role"], "content": m["content"]} for m in data["messages"]]
    try:
        r = run_assistant_turn(messages)
    except ImproperlyConfigured as e:
        return Response(
            {
                "detail": str(e),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except RateLimitError as e:
        logger.warning("Assistant rate limited: %s", e, exc_info=True)
        return Response(
            {
                "detail": "The assistant is busy. Please try again in a few moments.",
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    except (AuthenticationError, BadRequestError) as e:
        logger.warning("Assistant OpenRouter client/config error: %s", e, exc_info=True)
        return Response(
            {
                "detail": "Assistant API misconfiguration. Check OpenRouter keys.",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except (APIConnectionError, APITimeoutError, APIError) as e:
        logger.warning("Assistant OpenRouter API error: %s", e, exc_info=True)
        return Response(
            {
                "detail": "The assistant is temporarily unavailable. Please try again.",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except RuntimeError as e:
        logger.warning("Assistant model runtime error: %s", e, exc_info=True)
        return Response(
            {
                "detail": "The assistant is temporarily unavailable. Please try again.",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Assistant failure: %s", e)
        return Response(
            {
                "detail": "The assistant is temporarily unavailable. Please try again.",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    return Response(
        {
            "message": {"role": "assistant", "content": r.text},
            "nav": r.nav,
            "sources": r.sources,
        }
    )
