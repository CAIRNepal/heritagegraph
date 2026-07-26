#!/usr/bin/env python3
"""One-shot merge of the upstream HeritageGraph ontology draft into the deployed schema.

The upstream draft (``ontology/upstream/HeritageGraph-0.1.0-upstream.yaml``) rebuilds
the schema around PROV-O and adds deep Kumari-tradition modelling, but it drops the
platform-operational classes that ``tools/ui-classmap.yaml`` and the Django models
still depend on. Swapping it in verbatim would silently remove registry keys, which
in turn strips fields from contribute forms and from RDF projection.

This script rebases the deployed schema on the upstream draft while carrying over:

* the operational classes still referenced by the UI class map / viz map,
* the slots those classes need (plus slots backing live Django columns),
* the ``CulturalEntityCategory`` enum,
* the ``required: true`` slot usages upstream dropped, which the registry JSON Schema
  and the contribute forms both read,
* prefixes the upstream draft dropped but the CRM bridge still emits,
* ``meaning:`` annotations, which only ``emit_skos_vocabularies.py`` consumes and
  which the upstream draft largely discarded.

Splicing is textual so that upstream formatting, ordering and comments survive.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPSTREAM = ROOT / "ontology" / "upstream" / "HeritageGraph-0.1.0-upstream.yaml"
# Both inputs are pinned so the merge stays reproducible: the output overwrites the
# live schema, so reading the baseline from there would feed the merge its own result.
DEPLOYED = ROOT / "ontology" / "upstream" / "HeritageGraph-1.0.0-deployed.yaml"
OUT = ROOT / "ontology" / "HeritageGraph.yaml"

# Operational classes the upstream draft drops. Restored verbatim from the
# deployed schema, together with their transitive slot/enum dependencies.
RESTORE_CLASSES = [
    "AssertableEntity",
    "BuddhistMonument",
    "CulturalEntity",
    "Group",
    "HeritageAssertion",
    "HistoricalPeriod",
    "LivingGoddessRetirement",
    "LivingGoddessSelection",
    "LivingGoddessTenure",
    "Set",
]

RESTORE_SLOTS = [
    "archival_location",
    "asserted_property",
    "asserted_value",
    "assertion_author",
    "asserts_about_entity",
    "asserts_about_event",
    "category",
    "created_by_documentation",
    "crminf_conclusion",
    "description",
    "has_provenance_assertion",
    "has_retirement_event",
    "is_about_entity",
    "is_about_event",
    "justification_note",
    # inverse of created_by_documentation; restored to keep the pair resolvable
    "produced_information_object",
    "source_type",
    "was_attributed_to_agent",
    "was_derived_from_source",
]

RESTORE_ENUMS = {"CulturalEntityCategoryEnum": "CulturalEntityCategory"}

# The result is a superset of the deployed 1.0.0 schema, so it must not inherit the
# upstream draft's 0.1.0 (which would move the published version backwards).
MERGED_VERSION = "1.1.0"
MERGED_DESCRIPTION = (
    '"An event-centric LinkML schema for representing Nepal cultural heritage '
    "information, aligned with CIDOC-CRM and PROV-O through exact/broad mappings "
    "and subproperty bridges. Enables provenance tracking, ritual-spatial-temporal "
    "reasoning, and multi-calendar date representation. Merges the upstream "
    'HeritageGraph 0.1.0 ontology draft into the deployed platform schema."'
)

# Slots to re-attach to classes that survive the upgrade but lost them upstream.
# Only those backing a real Django column, so the registry keeps driving the form.
REATTACH_SLOTS = {
    "DataSource": ["source_type", "archival_location"],
    "InformationObject": ["source_type", "archival_location"],
}

# ``required: true`` markers the upstream draft dropped from ``slot_usage``. Without
# them the registry JSON Schema stops rejecting nameless records and the contribute
# forms stop marking the field mandatory, so they are carried over from the deployed
# schema for every class that survives the upgrade.
RESTORE_REQUIRED = {
    "ArchitecturalStructure": ["has_current_location"],
    "CasteGroup": ["name"],
    "ConditionAssessment": [
        "assessed_object",
        "assessed_condition_state",
        "has_timespan",
    ],
    "ConditionState": ["has_condition_type"],
    "Consecration": ["name", "consecrated_object", "has_timespan"],
    "DataCustodian": ["name"],
    "DataSource": ["name"],
    "Deity": ["name"],
    "DocumentationActivity": ["name", "has_timespan"],
    "Enshrinement": [
        "name",
        "enshrined_deity",
        "enshrined_in_structure",
        "has_timespan",
    ],
    "Guthi": ["name", "guthi_type"],
    "HistoricalEvent": ["name", "has_timespan"],
    "HumanMadeObject": ["name"],
    "IconographicObject": ["name"],
    "Person": ["name"],
    "Place": ["name"],
    "Production": ["name", "produced_object", "has_timespan"],
    "ReligiousTradition": ["name"],
    "RitualEvent": ["name", "has_timespan"],
    "SyncreticRelationship": ["assigned_to_deity", "assigned_equivalent"],
    "TimeSpan": ["date_earliest"],
    "TransferOfCustody": ["name", "transferred_object", "has_timespan"],
}

# Upstream renamed every enum to drop the ``Enum`` suffix; restored blocks must follow.
ENUM_RENAMES = {
    "ConditionTypeEnum": "ConditionType",
    "ArchitecturalStyleEnum": "ArchitecturalStyle",
    "RitualTypeEnum": "RitualType",
    "GuthiTypeEnum": "GuthiType",
    "SyncreticTypeEnum": "SyncreticType",
    "DatePrecisionEnum": "DatePrecision",
    "ExistenceStatusEnum": "ExistenceStatus",
    "CulturalEntityCategoryEnum": "CulturalEntityCategory",
}


def section_bounds(lines: list[str], name: str) -> tuple[int, int]:
    """Return [start, end) line indices of a top-level ``name:`` block's body."""
    start = None
    for i, line in enumerate(lines):
        if line.startswith(f"{name}:"):
            start = i + 1
            break
    if start is None:
        raise KeyError(f"section {name!r} not found")
    for j in range(start, len(lines)):
        if re.match(r"^[A-Za-z_]+:", lines[j]):
            return start, j
    return start, len(lines)


def extract_block(lines: list[str], bounds: tuple[int, int], key: str) -> list[str]:
    """Extract the ``  key:`` entry (and its indented body) from a section."""
    start, end = bounds
    begin = None
    for i in range(start, end):
        if re.match(rf"^  {re.escape(key)}:\s*$", lines[i]) or re.match(
            rf"^  {re.escape(key)}:\s+\S", lines[i]
        ):
            begin = i
            break
    if begin is None:
        raise KeyError(f"entry {key!r} not found")
    stop = end
    for j in range(begin + 1, end):
        if re.match(r"^  \S", lines[j]):
            stop = j
            break
    block = lines[begin:stop]
    while block and not block[-1].strip():
        block.pop()
    return block


def rename_enum_refs(block: list[str]) -> list[str]:
    out = []
    for line in block:
        for old, new in ENUM_RENAMES.items():
            line = re.sub(rf"\b{old}\b", new, line)
        out.append(line)
    return out


def meaning_map(lines: list[str]) -> dict[tuple[str, str], str]:
    """Map (enum, permissible_value) -> `meaning:` value from the deployed schema."""
    start, end = section_bounds(lines, "enums")
    out: dict[tuple[str, str], str] = {}
    enum = value = None
    for i in range(start, end):
        line = lines[i]
        if m := re.match(r"^  (\w+):\s*$", line):
            enum, value = m.group(1), None
        elif m := re.match(r"^      ([\w\-./]+):\s*$", line):
            value = m.group(1)
        elif m := re.match(r"^        meaning:\s*(\S+)", line):
            if enum and value:
                out[(ENUM_RENAMES.get(enum, enum), value)] = m.group(1)
    return out


def inject_meanings(
    lines: list[str], meanings: dict[tuple[str, str], str]
) -> list[str]:
    """Re-add `meaning:` to upstream enum values so SKOS/AAT alignment survives."""
    start, end = section_bounds(lines, "enums")
    out = list(lines[:start])
    enum = value = None
    added = 0
    i = start
    while i < end:
        line = lines[i]
        out.append(line)
        if m := re.match(r"^  (\w+):\s*$", line):
            enum, value = m.group(1), None
        elif m := re.match(r"^      ([\w\-./]+):\s*$", line):
            value = m.group(1)
        elif re.match(r"^        description:", line) and enum and value:
            key = (enum, value)
            already = i + 1 < end and re.match(r"^        meaning:", lines[i + 1])
            if key in meanings and not already:
                out.append(f"        meaning: {meanings[key]}")
                added += 1
        i += 1
    out.extend(lines[end:])
    print(f"  restored {added} `meaning:` annotations")
    return out


def set_header(lines: list[str]) -> list[str]:
    """Stamp the merged version and description over the upstream draft's."""
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("version:"):
            out.append(f"version: {MERGED_VERSION}")
        elif line.startswith("description:"):
            out.append(f"description: {MERGED_DESCRIPTION}")
            # skip the draft's continuation lines
            i += 1
            while i < len(lines) and not re.match(r"^[A-Za-z_]+:", lines[i]):
                i += 1
            continue
        else:
            out.append(line)
        i += 1
    print(f"  stamped version {MERGED_VERSION}")
    return out


def merge_prefixes(new: list[str], old: list[str]) -> list[str]:
    ns, ne = section_bounds(new, "prefixes")
    os_, oe = section_bounds(old, "prefixes")
    have = {
        m.group(1)
        for line in new[ns:ne]
        if (m := re.match(r'^  "?([\w]+)"?:', line))
    }
    missing: list[str] = []
    names: list[str] = []
    for line in old[os_:oe]:
        m = re.match(r'^  "?([\w]+)"?:', line)
        if m and m.group(1) not in have:
            missing.append(line)
            names.append(m.group(1))
    if not missing:
        return new
    tail = ne
    while tail > ns and not new[tail - 1].strip():
        tail -= 1
    print(f"  restored {len(missing)} prefixes: {names}")
    return new[:tail] + missing + new[tail:]


def reattach(lines: list[str]) -> list[str]:
    """Append lost slot names to the `slots:` list of surviving classes."""
    start, end = section_bounds(lines, "classes")
    out = list(lines)
    for cls, wanted in REATTACH_SLOTS.items():
        try:
            block = extract_block(out, section_bounds(out, "classes"), cls)
        except KeyError:
            continue
        cstart = out.index(block[0])
        # locate the class-level `slots:` list
        sidx = None
        for i in range(cstart, cstart + len(block)):
            if re.match(r"^    slots:\s*$", out[i]):
                sidx = i
                break
        if sidx is None:
            continue
        last = sidx
        present = set()
        for j in range(sidx + 1, cstart + len(block)):
            if m := re.match(r"^      - (\S+)", out[j]):
                present.add(m.group(1))
                last = j
            elif out[j].strip():
                break
        add = [f"      - {s}" for s in wanted if s not in present]
        if add:
            print(f"  re-attached {len(add)} slot(s) to {cls}: "
                  f"{[s for s in wanted if s not in present]}")
            out = out[: last + 1] + add + out[last + 1 :]
    return out


def restore_required(lines: list[str]) -> list[str]:
    """Re-add the `slot_usage: <slot>: required: true` markers upstream dropped."""
    out = list(lines)
    added = 0
    for cls, slots in RESTORE_REQUIRED.items():
        for slot in slots:
            try:
                block = extract_block(out, section_bounds(out, "classes"), cls)
            except KeyError:
                break
            cstart = out.index(block[0])
            cend = cstart + len(block)

            usage = next(
                (
                    i
                    for i in range(cstart, cend)
                    if re.match(r"^    slot_usage:\s*$", out[i])
                ),
                None,
            )
            if usage is None:
                out = (
                    out[:cend]
                    + ["    slot_usage:", f"      {slot}:", "        required: true"]
                    + out[cend:]
                )
                added += 1
                continue

            usage_end = cend
            for j in range(usage + 1, cend):
                if re.match(r"^    \S", out[j]):
                    usage_end = j
                    break

            entry = next(
                (
                    i
                    for i in range(usage + 1, usage_end)
                    if re.match(rf"^      {re.escape(slot)}:\s*$", out[i])
                ),
                None,
            )
            if entry is None:
                tail = usage_end
                while tail > usage and not out[tail - 1].strip():
                    tail -= 1
                out = (
                    out[:tail]
                    + [f"      {slot}:", "        required: true"]
                    + out[tail:]
                )
                added += 1
                continue

            entry_end = usage_end
            for j in range(entry + 1, usage_end):
                if re.match(r"^      \S", out[j]):
                    entry_end = j
                    break
            if any(
                re.match(r"^        required:", out[j])
                for j in range(entry + 1, entry_end)
            ):
                continue
            out = out[: entry + 1] + ["        required: true"] + out[entry + 1 :]
            added += 1
    print(f"  restored {added} `required: true` constraint(s)")
    return out


def main() -> int:
    for path in (UPSTREAM, DEPLOYED):
        if not path.exists():
            print(f"error: merge input not found: {path}", file=sys.stderr)
            return 1

    new = UPSTREAM.read_text().split("\n")
    old = DEPLOYED.read_text().split("\n")

    print("Merging upstream ontology draft into deployed schema")

    meanings = meaning_map(old)
    new = set_header(new)
    new = inject_meanings(new, meanings)
    new = merge_prefixes(new, old)

    # Restore the CulturalEntityCategory enum.
    ob = section_bounds(old, "enums")
    enum_blocks: list[str] = []
    for src, dst in RESTORE_ENUMS.items():
        block = rename_enum_refs(extract_block(old, ob, src))
        block[0] = f"  {dst}:"
        enum_blocks += ["", *block]
    if enum_blocks:
        s, e = section_bounds(new, "enums")
        tail = e
        while tail > s and not new[tail - 1].strip():
            tail -= 1
        new = new[:tail] + enum_blocks + new[tail:]
        names = list(RESTORE_ENUMS.values())
        print(f"  restored {len(RESTORE_ENUMS)} enum(s): {names}")

    # Restore operational classes.
    ob = section_bounds(old, "classes")
    blocks: list[str] = []
    for name in RESTORE_CLASSES:
        blocks += ["", *rename_enum_refs(extract_block(old, ob, name))]
    s, e = section_bounds(new, "classes")
    tail = e
    while tail > s and not new[tail - 1].strip():
        tail -= 1
    new = new[:tail] + blocks + new[tail:]
    print(f"  restored {len(RESTORE_CLASSES)} classes: {RESTORE_CLASSES}")

    # Restore slots.
    ob = section_bounds(old, "slots")
    blocks = []
    restored = []
    ns, ne = section_bounds(new, "slots")
    existing = {
        m.group(1) for line in new[ns:ne] if (m := re.match(r"^  (\w+):", line))
    }
    for name in RESTORE_SLOTS:
        if name in existing:
            continue
        blocks += ["", *rename_enum_refs(extract_block(old, ob, name))]
        restored.append(name)
    s, e = section_bounds(new, "slots")
    tail = e
    while tail > s and not new[tail - 1].strip():
        tail -= 1
    new = new[:tail] + blocks + new[tail:]
    print(f"  restored {len(restored)} slots: {restored}")

    new = reattach(new)
    new = restore_required(new)

    OUT.write_text("\n".join(new).rstrip("\n") + "\n")
    print(f"\nwrote {OUT} ({len(new)} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
