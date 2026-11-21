"""Report where the ontology registry and the Django models disagree.

The contribute forms are projected from the LinkML registry, but persistence
and RDF projection go through Django models. Where the two vocabularies differ
the mismatch is silent:

* a registry slot with no serializer field is accepted by the API and then
  dropped, so the contributor's input disappears with no error;
* a *required* slot with no serializer field makes the whole form
  unsubmittable, because the serializer drops it and the JSON Schema gate then
  rejects the payload for omitting it;
* a model column with no registry slot can never be filled in through a form
  and never reaches RDF, because projection iterates registry slots.

This command writes a committed report so the divergence is visible in review
rather than discovered from a support ticket. ``--check`` fails when the report
is stale, which is a staleness gate, not a divergence gate: it will not break
CI just because the numbers are bad, only when someone changes the schema
without regenerating.
"""

from __future__ import annotations

import json
from pathlib import Path

from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model
from apps.cidoc_data.urls import router
from django.core.management.base import BaseCommand

REPO_ROOT = Path(__file__).resolve().parents[5]
REGISTRY_JSON = (
    REPO_ROOT
    / "heritage_graph_ui"
    / "src"
    / "lib"
    / "ontology"
    / "registry.generated.json"
)
REPORT_PATH = REPO_ROOT / "documentation" / "ontology" / "REGISTRY_MODEL_ALIGNMENT.md"

# Workflow/audit columns that are deliberately not contributor-facing.
NON_CONTENT_COLUMNS = frozenset(
    {
        "id",
        "status",
        "contributor",
        "created_at",
        "updated_at",
        "access_tier",
        "care_labels",
        "cultural_entity_id",
    }
)

# Slots that do persist, but under a different name on the serializer. Scoped by
# domain so a genuine mismatch elsewhere is not excused by an alias defined for
# one model.
SLOT_FIELD_ALIASES: dict[tuple[str, str], tuple[str, ...]] = {
    # `Source` is the registry's InformationObject, whose label slot is `name`;
    # the column is `title`, and SourceSerializer accepts both.
    ("source", "name"): ("title",),
}

# Coordinates are posted as a `latitude`/`longitude` pair, which the serializers
# fold into the `point` column, so a geo_point slot persists without the slot
# key ever appearing on the serializer.
GEO_POINT_ALIAS = ("latitude", "longitude")


def _persists(domain: str, field: dict, ser_fields: set[str]) -> bool:
    key = field["key"]
    if key in ser_fields:
        return True
    if field.get("type") == "geo_point":
        return all(alias in ser_fields for alias in GEO_POINT_ALIAS)
    aliases = SLOT_FIELD_ALIASES.get((domain, key), ())
    return any(alias in ser_fields for alias in aliases)


def _domains():
    """(registry_key, model, serializer_field_names) per registered CIDOC viewset."""
    seen: set[type] = set()
    out = []
    for _prefix, viewset, _base in router.registry:
        model = getattr(getattr(viewset, "queryset", None), "model", None)
        if model is None or model in seen:
            continue
        seen.add(model)
        key = registry_class_key_for_model(model)
        if not key:
            continue
        try:
            fields = set(viewset.serializer_class().fields)
        except Exception:
            fields = set()
        out.append((key, model, fields))
    return sorted(out, key=lambda row: row[0])


def build_report() -> str:
    payload = json.loads(REGISTRY_JSON.read_text())
    classes = payload.get("classes") or {}

    rows = []
    tot_persisted = tot_dropped = tot_unexposed = 0
    blocking: list[tuple[str, list[str]]] = []

    for key, model, ser_fields in _domains():
        entry = classes.get(key)
        if not entry:
            continue
        columns = {
            f.name for f in model._meta.concrete_fields
        } - NON_CONTENT_COLUMNS
        slots = entry.get("fields") or []

        persisted = sorted(f["key"] for f in slots if _persists(key, f, ser_fields))
        dropped = sorted(
            f["key"] for f in slots if not _persists(key, f, ser_fields)
        )
        exposed_columns = {f["key"] for f in slots}
        if any(f.get("type") == "geo_point" for f in slots):
            exposed_columns |= {"point", *GEO_POINT_ALIAS}
        for (dom, slot), aliases in SLOT_FIELD_ALIASES.items():
            if dom == key:
                exposed_columns |= set(aliases)
        unexposed = sorted(columns - exposed_columns)
        blocked_by = sorted(
            f["key"]
            for f in slots
            if f.get("required") and not _persists(key, f, ser_fields)
        )

        tot_persisted += len(persisted)
        tot_dropped += len(dropped)
        tot_unexposed += len(unexposed)
        if blocked_by:
            blocking.append((key, blocked_by))

        rows.append((key, persisted, dropped, unexposed))

    total_slots = tot_persisted + tot_dropped
    pct = (tot_persisted / total_slots * 100) if total_slots else 0.0

    out: list[str] = []
    out.append("# Registry / model alignment")
    out.append("")
    out.append(
        "Generated by `python manage.py report_registry_alignment` "
        "(`make registry-alignment`). Do not edit by hand."
    )
    out.append("")
    out.append("## Summary")
    out.append("")
    out.append(
        f"- Form fields that persist: "
        f"**{tot_persisted} / {total_slots}** ({pct:.0f}%)"
    )
    out.append(f"- Form fields silently discarded on submit: **{tot_dropped}**")
    out.append(
        f"- Model columns reachable by no form and no RDF projection: "
        f"**{tot_unexposed}**"
    )
    out.append(f"- Domains that cannot be submitted at all: **{len(blocking)}**")
    out.append("")

    if blocking:
        out.append("## Blocked domains")
        out.append("")
        out.append(
            "A required slot with no serializer field is dropped before "
            "validation, so the JSON Schema gate rejects every submission for "
            "omitting it. These forms always return HTTP 400."
        )
        out.append("")
        out.append("| Domain | Required slot with no backing field |")
        out.append("| --- | --- |")
        for key, slots in blocking:
            out.append(f"| `{key}` | {', '.join(f'`{s}`' for s in slots)} |")
        out.append("")

    out.append("## Per-domain detail")
    out.append("")
    out.append("| Domain | Persists | Discarded | Columns with no form field |")
    out.append("| --- | ---: | ---: | ---: |")
    for key, persisted, dropped, unexposed in rows:
        out.append(
            f"| `{key}` | {len(persisted)} | {len(dropped)} | {len(unexposed)} |"
        )
    out.append("")

    for key, persisted, dropped, unexposed in rows:
        out.append(f"### `{key}`")
        out.append("")
        out.append(f"- Persists: {', '.join(f'`{s}`' for s in persisted) or '_none_'}")
        out.append(f"- Discarded: {', '.join(f'`{s}`' for s in dropped) or '_none_'}")
        out.append(
            f"- Columns with no form field: "
            f"{', '.join(f'`{s}`' for s in unexposed) or '_none_'}"
        )
        out.append("")

    return "\n".join(out)


class Command(BaseCommand):
    help = "Report registry slots and Django model fields that do not line up."

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Exit non-zero if the committed report is out of date.",
        )

    def handle(self, *args, **options):
        report = build_report()

        if options["check"]:
            current = REPORT_PATH.read_text() if REPORT_PATH.exists() else ""
            if current != report:
                self.stderr.write(
                    f"{REPORT_PATH.relative_to(REPO_ROOT)} is out of date — "
                    "run `make registry-alignment` and commit the result."
                )
                raise SystemExit(1)
            self.stdout.write("registry/model alignment report is up to date")
            return

        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(report)
        self.stdout.write(f"wrote {REPORT_PATH.relative_to(REPO_ROOT)}")
