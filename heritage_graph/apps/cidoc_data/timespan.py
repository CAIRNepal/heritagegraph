"""
Multi-calendar TimeSpan dataclass with EDTF encoding and RDF emission.

Supports Gregorian, Bikram Sambat (BS), and Nepal Sambat (NS) calendar systems
with configurable date precision (exact_year, circa, decade, century).

Calendar offsets (approximate — full accuracy requires a proper calendar library):
  Bikram Sambat  → Gregorian: bs_year - 57    (e.g. BS 2083 ≈ Gregorian 2026)
  Nepal Sambat   → Gregorian: ns_year + 880   (e.g. NS 1146 ≈ Gregorian 2026)
  Gregorian      → BS:        greg_year + 57
  Gregorian      → NS:        greg_year - 880
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CalendarSystem = Literal["gregorian", "bikram_sambat", "nepal_sambat"]
DatePrecision = Literal["exact_year", "circa", "decade", "century"]

# Approximate year offsets: offset added to the stored year to get Gregorian year.
# BS 2083 - 57 = 2026 Gregorian.
_TO_GREGORIAN: dict[str, int] = {
    "gregorian": 0,
    "bikram_sambat": -57,
    "nepal_sambat": 880,
}

# Labels used in RDF literals and UI previews.
_CALENDAR_LABELS: dict[str, str] = {
    "gregorian": "Gregorian",
    "bikram_sambat": "Bikram Sambat",
    "nepal_sambat": "Nepal Sambat",
}

# EDTF qualifiers for precision values.
_EDTF_SUFFIX: dict[str, str] = {
    "exact_year": "",
    "circa": "~",
    "decade": "",   # handled specially
    "century": "",  # handled specially
}

CRM = "http://www.cidoc-crm.org/cidoc-crm/"
XSD = "http://www.w3.org/2001/XMLSchema#"
HG_BASE = "https://w3id.org/heritagegraph/"


@dataclass
class TimeSpan:
    """
    A dated assertion with calendar system and precision metadata.

    Attributes:
        year: The year value in the given calendar system.
        calendar_system: One of 'gregorian', 'bikram_sambat', 'nepal_sambat'.
        date_precision: One of 'exact_year', 'circa', 'decade', 'century'.
        month: Optional month (1–12).
        day: Optional day (1–31).
    """

    year: int
    calendar_system: CalendarSystem = "gregorian"
    date_precision: DatePrecision = "exact_year"
    month: int | None = None
    day: int | None = None

    def to_gregorian_year(self) -> int:
        """Convert stored year to approximate Gregorian year."""
        return self.year + _TO_GREGORIAN.get(self.calendar_system, 0)

    def to_bs_year(self) -> int:
        """Return approximate Bikram Sambat year."""
        greg = self.to_gregorian_year()
        return greg + 57

    def to_ns_year(self) -> int:
        """Return approximate Nepal Sambat year."""
        greg = self.to_gregorian_year()
        return greg - 880

    def to_edtf(self) -> str:
        """Encode as Extended Date/Time Format (EDTF) string."""
        precision = self.date_precision
        if precision == "decade":
            decade = (self.year // 10) * 10
            return f"{decade}X"
        if precision == "century":
            century = (self.year // 100) * 100
            return f"{century // 100:02d}XX"

        parts = [f"{self.year:04d}"]
        if self.month is not None:
            parts.append(f"{self.month:02d}")
            if self.day is not None:
                parts.append(f"{self.day:02d}")
        edtf = "-".join(parts)
        return edtf + _EDTF_SUFFIX.get(precision, "")

    def calendar_equivalents_summary(self) -> str:
        """Human-readable summary of equivalent dates in the other two calendars."""
        prec_suffix = "~" if self.date_precision == "circa" else ""
        greg = self.to_gregorian_year()
        bs = self.to_bs_year()
        ns = self.to_ns_year()
        parts = []
        if self.calendar_system != "gregorian":
            parts.append(f"Gregorian {greg}{prec_suffix}")
        if self.calendar_system != "bikram_sambat":
            parts.append(f"BS {bs}{prec_suffix}")
        if self.calendar_system != "nepal_sambat":
            parts.append(f"NS {ns}{prec_suffix}")
        return " · ".join(parts)

    def to_rdf_triples(self, *, timespan_uri: str) -> list[tuple[str, str, str | None, tuple[str, str] | None]]:
        """
        Return RDF triples for a crm:E52_Time-Span resource.

        Each triple is (subject, predicate, object_uri_or_None, literal_or_None)
        where literal is (lexical_form, datatype_uri).

        Emits:
          <ts_uri> rdf:type crm:E52_Time-Span
          <ts_uri> crm:P82a_begin_of_the_begin  "<year>"^^xsd:gYear  (Gregorian)
          <ts_uri> hg:calendar_system  "<cs>"^^xsd:string
          <ts_uri> hg:date_precision   "<dp>"^^xsd:string
          <ts_uri> hg:edtf_value       "<edtf>"^^xsd:string
          <ts_uri> hg:calendar_year    "<year>"^^xsd:integer  (stored year)
        """
        rdf_type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        xsd_string = XSD + "string"
        xsd_integer = XSD + "integer"
        xsd_g_year = XSD + "gYear"

        crm_e52 = CRM + "E52_Time-Span"
        crm_p82a = CRM + "P82a_begin_of_the_begin"
        hg_calendar = HG_BASE + "calendar_system"
        hg_precision = HG_BASE + "date_precision"
        hg_edtf = HG_BASE + "edtf_value"
        hg_year = HG_BASE + "calendar_year"

        gregorian_year = self.to_gregorian_year()

        triples: list[tuple[str, str, str | None, tuple[str, str] | None]] = [
            (timespan_uri, rdf_type, crm_e52, None),
            (timespan_uri, crm_p82a, None, (str(gregorian_year), xsd_g_year)),
            (timespan_uri, hg_calendar, None, (self.calendar_system, xsd_string)),
            (timespan_uri, hg_precision, None, (self.date_precision, xsd_string)),
            (timespan_uri, hg_edtf, None, (self.to_edtf(), xsd_string)),
            (timespan_uri, hg_year, None, (str(self.year), xsd_integer)),
        ]
        return triples


def timespan_uri_for_assertion(assertion_id: object) -> str:
    """Mint a deterministic TimeSpan URI for a given assertion PK."""
    return f"{HG_BASE}timespan/assertion/{assertion_id}"


def timespan_from_assertion(assertion: object) -> TimeSpan | None:
    """
    Build a TimeSpan from a HeritageAssertion's calendar/date fields.

    Returns None if no year value can be derived (asserted_value is not numeric
    or calendar_system is missing).
    """
    calendar_system: str = getattr(assertion, "calendar_system", "") or "gregorian"
    date_precision: str = getattr(assertion, "date_precision", "") or "exact_year"
    raw_value: str = (getattr(assertion, "asserted_value", "") or "").strip()

    # Try to extract a numeric year from asserted_value (e.g. "1427", "circa 1427")
    import re
    m = re.search(r"\b(\d{3,4})\b", raw_value)
    if not m:
        return None
    year = int(m.group(1))
    return TimeSpan(
        year=year,
        calendar_system=calendar_system,  # type: ignore[arg-type]
        date_precision=date_precision,  # type: ignore[arg-type]
    )
