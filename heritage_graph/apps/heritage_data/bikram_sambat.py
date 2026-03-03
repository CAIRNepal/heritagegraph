"""
Bikram Sambat (BS) Calendar Utilities for Django Backend.

Provides conversion between Gregorian (AD) and Bikram Sambat (BS)
calendar systems, Nepali date formatting, and DRF serializer fields.

Usage:
    from apps.heritage_data.bikram_sambat import (
        ad_to_bs, bs_to_ad, today_bs, format_bs_date,
        BSDateField,
    )
"""

from datetime import date, datetime
from typing import Optional

import nepali_datetime
from rest_framework import serializers

# ── BS Month Names ───────────────────────────────────────────────────────────

BS_MONTHS_EN = [
    "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
]

BS_MONTHS_NE = [
    "वैशाख", "जेठ", "असार", "श्रावण", "भदौ", "असोज",
    "कार्तिक", "मंसिर", "पुष", "माघ", "फाल्गुन", "चैत्र",
]

NEPALI_DIGITS = "०१२३४५६७८९"


def to_nepali_digits(number) -> str:
    """Convert Arabic numerals to Devanagari."""
    return "".join(
        NEPALI_DIGITS[int(ch)] if ch.isdigit() else ch for ch in str(number)
    )


# ── Conversion Functions ─────────────────────────────────────────────────────


def ad_to_bs(ad_date: date) -> dict:
    """
    Convert Gregorian date to Bikram Sambat.

    Returns:
        dict with keys: year, month (1-indexed), day
    """
    nd = nepali_datetime.date.from_datetime_date(ad_date)
    return {
        "year": nd.year,
        "month": nd.month,  # nepali_datetime months are 1-indexed
        "day": nd.day,
    }


def bs_to_ad(year: int, month: int, day: int) -> date:
    """Convert Bikram Sambat date to Gregorian date."""
    nd = nepali_datetime.date(year, month, day)
    return nd.to_datetime_date()


def today_bs() -> dict:
    """Get today's date in Bikram Sambat."""
    return ad_to_bs(date.today())


# ── Formatting ───────────────────────────────────────────────────────────────


def format_bs_date(
    ad_date: date, locale: str = "en", include_ad: bool = False
) -> str:
    """
    Format a Gregorian date as a Bikram Sambat string.

    Args:
        ad_date: Gregorian date
        locale: 'en' or 'ne'
        include_ad: If True, include the AD date in parentheses

    Returns:
        Formatted BS date string
    """
    bs = ad_to_bs(ad_date)
    month_idx = bs["month"] - 1

    if locale == "ne":
        day_str = to_nepali_digits(bs["day"])
        month_str = BS_MONTHS_NE[month_idx]
        year_str = to_nepali_digits(bs["year"])
        result = f"{day_str} {month_str} {year_str}"
    else:
        result = f"{bs['day']} {BS_MONTHS_EN[month_idx]} {bs['year']}"

    if include_ad:
        ad_str = ad_date.strftime("%d %b %Y")
        result = f"{result} ({ad_str})"

    return result


def format_bs_iso(ad_date: date) -> str:
    """Format date as BS ISO string: '2083-01-15'."""
    bs = ad_to_bs(ad_date)
    return f"{bs['year']}-{bs['month']:02d}-{bs['day']:02d}"


# ── DRF Serializer Field ────────────────────────────────────────────────────


class BSDateField(serializers.Field):
    """
    A DRF serializer field that represents dates in both
    Gregorian (AD) and Bikram Sambat (BS) formats.

    Output format:
        {
            "ad": "2026-03-03",
            "bs": "2082-11-19",
            "bs_display": {
                "en": "19 Falgun 2082",
                "ne": "१९ फाल्गुन २०८२"
            }
        }
    """

    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, datetime):
            value = value.date()

        bs = ad_to_bs(value)
        return {
            "ad": value.isoformat(),
            "bs": format_bs_iso(value),
            "bs_display": {
                "en": format_bs_date(value, locale="en"),
                "ne": format_bs_date(value, locale="ne"),
            },
        }

    def to_internal_value(self, data):
        """Accept either an AD date string or a BS date dict."""
        if isinstance(data, str):
            # Parse as AD date
            try:
                return date.fromisoformat(data)
            except ValueError:
                raise serializers.ValidationError(
                    "Invalid date format. Use YYYY-MM-DD."
                )

        if isinstance(data, dict):
            # Parse as BS date
            try:
                year = int(data["year"])
                month = int(data["month"])
                day = int(data["day"])
                return bs_to_ad(year, month, day)
            except (KeyError, ValueError, TypeError):
                raise serializers.ValidationError(
                    "Invalid BS date. Provide {year, month, day}."
                )

        raise serializers.ValidationError(
            "Date must be a string (AD) or object (BS)."
        )


# ── Middleware for Accept-Language based BS formatting ────────────────────────


class BikramSambatMiddleware:
    """
    Optional middleware that adds `request.bs_today` with today's
    BS date info. Useful for templates or API responses that need
    the current BS date.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        bs = today_bs()
        request.bs_today = {
            "year": bs["year"],
            "month": bs["month"],
            "day": bs["day"],
            "display_en": format_bs_date(date.today(), locale="en"),
            "display_ne": format_bs_date(date.today(), locale="ne"),
        }
        return self.get_response(request)
