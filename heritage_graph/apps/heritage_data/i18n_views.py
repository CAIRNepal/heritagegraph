"""
i18n API endpoints for HeritageGraph.

Provides locale info and Bikram Sambat date data to the frontend.
"""

from datetime import date

from django.utils.translation import activate, get_language
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.heritage_data.bikram_sambat import (
    ad_to_bs,
    format_bs_date,
    format_bs_iso,
    today_bs,
    BS_MONTHS_EN,
    BS_MONTHS_NE,
)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def locale_info(request):
    """
    GET /data/i18n/locale-info/

    Returns current locale, today's BS date, and available locales.
    Respects Accept-Language header.
    """
    lang = request.GET.get("lang", get_language() or "en")
    if lang not in ("en", "ne"):
        lang = "en"

    activate(lang)

    bs = today_bs()
    today = date.today()

    return Response(
        {
            "locale": lang,
            "available_locales": [
                {"code": "en", "name": "English", "native_name": "English"},
                {"code": "ne", "name": "Nepali", "native_name": "नेपाली"},
            ],
            "today": {
                "ad": today.isoformat(),
                "bs": format_bs_iso(today),
                "bs_display": {
                    "en": format_bs_date(today, locale="en"),
                    "ne": format_bs_date(today, locale="ne"),
                },
            },
            "bs_months": {
                "en": BS_MONTHS_EN,
                "ne": BS_MONTHS_NE,
            },
        }
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def convert_date(request):
    """
    GET /data/i18n/convert-date/?date=2026-03-03&direction=ad_to_bs

    Convert between AD and BS dates.

    Query params:
        date: Date string (YYYY-MM-DD for AD, or YYYY-MM-DD for BS)
        direction: 'ad_to_bs' (default) or 'bs_to_ad'
    """
    date_str = request.GET.get("date")
    direction = request.GET.get("direction", "ad_to_bs")

    if not date_str:
        return Response(
            {"error": "Missing 'date' parameter."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        parts = date_str.split("-")
        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    except (ValueError, IndexError):
        return Response(
            {"error": "Invalid date format. Use YYYY-MM-DD."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if direction == "ad_to_bs":
        try:
            ad_date = date(year, month, day)
            bs = ad_to_bs(ad_date)
            return Response(
                {
                    "input": {"ad": ad_date.isoformat()},
                    "output": {
                        "bs": format_bs_iso(ad_date),
                        "bs_display": {
                            "en": format_bs_date(ad_date, locale="en"),
                            "ne": format_bs_date(ad_date, locale="ne"),
                        },
                        "bs_raw": bs,
                    },
                }
            )
        except ValueError as e:
            return Response(
                {"error": f"Invalid AD date: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif direction == "bs_to_ad":
        try:
            from apps.heritage_data.bikram_sambat import bs_to_ad

            ad_date = bs_to_ad(year, month, day)
            return Response(
                {
                    "input": {"bs": date_str},
                    "output": {
                        "ad": ad_date.isoformat(),
                        "bs_display": {
                            "en": format_bs_date(ad_date, locale="en"),
                            "ne": format_bs_date(ad_date, locale="ne"),
                        },
                    },
                }
            )
        except (ValueError, OverflowError) as e:
            return Response(
                {"error": f"Invalid BS date: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        return Response(
            {"error": "Invalid direction. Use 'ad_to_bs' or 'bs_to_ad'."},
            status=status.HTTP_400_BAD_REQUEST,
        )
