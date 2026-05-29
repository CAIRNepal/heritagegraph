"""Submit 100 diverse contributions across CIDOC classes + cross-entity edges,
then audit the relational DB, Oxigraph store, and graph connectivity.

Hits the same post_save signal path that DRF ViewSets fire for form POSTs,
without needing the HTTP backend running.

Run:
    cd heritage_graph && .venv-ox/bin/python scripts/test_100_contributions.py
"""

from __future__ import annotations

import os
import sys
from collections import Counter
from pathlib import Path

# Make 'apps.*' imports work when run from heritage_graph/
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings.development")

import django  # noqa: E402
django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.contenttypes.models import ContentType  # noqa: E402
from apps.cidoc_data import models as M  # noqa: E402
from apps.cidoc_data.rdf_signals import _resource_uri, rdf_sync_enabled  # noqa: E402

# ---------------------------------------------------------------------------
# Plan: which classes get which sample data.
# ---------------------------------------------------------------------------
PLAN = [
    # (model, count, list of names)
    (M.Person, 10, [
        "Pratap Malla", "Anandadev", "Bhupatindra Malla", "Jayasthiti Malla",
        "Tribhuvan Shah", "Prithvi Narayan Shah", "Amshuvarman", "Manadeva",
        "Janga Bahadur Rana", "Bhimsen Thapa",
    ]),
    (M.Location, 10, [
        "Kathmandu Durbar Square", "Patan Durbar Square", "Bhaktapur Durbar Square",
        "Pashupatinath", "Boudhanath", "Swayambhunath", "Changu Narayan",
        "Hanuman Dhoka", "Taleju Temple Precinct", "Basantapur Tower",
    ]),
    (M.Event, 8, [
        "Indra Jatra 2023", "Bisket Jatra 2023", "Gai Jatra 2023",
        "Dashain 2023 Royal Tika", "Yenya Punhi", "Rato Machindranath Jatra 2024",
        "Tihar 2023 Laxmi Puja", "Buddha Jayanti 2024",
    ]),
    (M.HistoricalPeriod, 5, [
        "Licchavi Period", "Malla Period", "Shah Period",
        "Rana Period", "Lichhavi-Thakuri Transition",
    ]),
    (M.Tradition, 6, [
        "Newar Wedding Rites", "Bratabandha", "Ihi (Bel Bibaha)",
        "Gufa Rakhne", "Pasni (Rice Feeding)", "Newari Sutra Recitation",
    ]),
    (M.Source, 6, [
        "Gopalraj Vamshavali", "Bhasa Vamshavali", "Hodgson Papers (Vol 1)",
        "Wright's History of Nepal", "Levi 1905 vol 1", "Slusser Nepal Mandala",
    ]),
    (M.Deity, 8, [
        "Pashupatinath", "Taleju Bhawani", "Kumari", "Bhairava",
        "Ganesh (Surya Vinayak)", "Saraswati", "Machindranath", "Annapurna",
    ]),
    (M.Guthi, 6, [
        "Pashupati Guthi", "Taleju Guthi", "Kumari Guthi",
        "Machhindranath Guthi", "Bhairav Naach Guthi", "Lakhe Guthi",
    ]),
    (M.ArchitecturalStructure, 8, [
        "Taleju Temple", "Krishna Mandir Patan", "55-Window Palace",
        "Nyatapola Temple", "Kasthamandap (rebuilt)", "Maju Deval Plinth",
        "Patan Mul Chowk", "Hanuman Dhoka Nasal Chowk",
    ]),
    (M.RitualEvent, 6, [
        "Kumari Selection Ritual 2017", "Dashain Phulpati Procession 2023",
        "Indra Jatra Kumari Rath Procession", "Bisket Jatra Lingo Erection",
        "Machindranath Bath Ritual", "Pashupati Bagmati Aarati",
    ]),
    (M.Festival, 6, [
        "Indra Jatra", "Bisket Jatra", "Yenya Punhi",
        "Rato Machindranath Jatra", "Gai Jatra", "Holi (Phagu Purnima)",
    ]),
    (M.IconographicObject, 6, [
        "Garuda Statue Changu Narayan", "Bhairava Mask Hanuman Dhoka",
        "Kumari Throne", "Trident of Pashupati Sanctum",
        "Naga Stone Patan", "Vishnu Vikranta Lalitpur",
    ]),
    (M.Monument, 5, [
        "Bhimsen Tower (Dharahara)", "Singha Durbar Facade",
        "Boudhanath Stupa", "Swayambhu Stupa", "Krishna Mandir Patan",
    ]),
    (M.KumariTenure, 5, [
        "Matina Shakya Tenure", "Trishna Shakya Tenure",
        "Chanira Bajracharya Tenure", "Preeti Shakya Tenure",
        "Yunika Bajracharya Tenure",
    ]),
    (M.CasteGroup, 5, [
        "Shakya", "Bajracharya", "Maharjan", "Pradhan", "Tuladhar",
    ]),
]

# Cross-entity edges. Designed so EVERY submitted entity participates in ≥1 edge.
EDGES_PLAN = [
    # Person -> Guthi
    ("Person:0", "relationship.member_of", "Guthi:0"),
    ("Person:1", "relationship.member_of", "Guthi:1"),
    ("Person:2", "relationship.member_of", "Guthi:0"),
    ("Person:3", "relationship.member_of", "Guthi:2"),
    ("Person:4", "relationship.member_of", "Guthi:3"),
    ("Person:5", "relationship.member_of", "Guthi:4"),
    ("Person:6", "relationship.member_of", "Guthi:5"),
    ("Person:7", "relationship.member_of", "Guthi:0"),
    ("Person:8", "relationship.member_of", "Guthi:1"),
    ("Person:9", "relationship.member_of", "Guthi:2"),
    # Person -> CasteGroup
    ("Person:0", "relationship.belongs_to_caste", "CasteGroup:0"),
    ("Person:1", "relationship.belongs_to_caste", "CasteGroup:1"),
    ("Person:2", "relationship.belongs_to_caste", "CasteGroup:2"),
    ("Person:3", "relationship.belongs_to_caste", "CasteGroup:3"),
    ("Person:4", "relationship.belongs_to_caste", "CasteGroup:4"),
    # Person -> HistoricalPeriod
    ("Person:0", "relationship.active_during", "HistoricalPeriod:1"),
    ("Person:1", "relationship.active_during", "HistoricalPeriod:1"),
    ("Person:2", "relationship.active_during", "HistoricalPeriod:1"),
    ("Person:3", "relationship.active_during", "HistoricalPeriod:1"),
    ("Person:4", "relationship.active_during", "HistoricalPeriod:2"),
    ("Person:5", "relationship.active_during", "HistoricalPeriod:2"),
    ("Person:6", "relationship.active_during", "HistoricalPeriod:0"),
    ("Person:7", "relationship.active_during", "HistoricalPeriod:0"),
    ("Person:8", "relationship.active_during", "HistoricalPeriod:3"),
    ("Person:9", "relationship.active_during", "HistoricalPeriod:3"),
    ("Person:4", "relationship.active_during", "HistoricalPeriod:4"),
    # ArchitecturalStructure -> Location (located_at)
    ("ArchitecturalStructure:0", "relationship.located_at", "Location:0"),
    ("ArchitecturalStructure:1", "relationship.located_at", "Location:1"),
    ("ArchitecturalStructure:2", "relationship.located_at", "Location:2"),
    ("ArchitecturalStructure:3", "relationship.located_at", "Location:2"),
    ("ArchitecturalStructure:4", "relationship.located_at", "Location:0"),
    ("ArchitecturalStructure:5", "relationship.located_at", "Location:0"),
    ("ArchitecturalStructure:6", "relationship.located_at", "Location:1"),
    ("ArchitecturalStructure:7", "relationship.located_at", "Location:7"),
    # Monument -> Location
    ("Monument:0", "relationship.located_at", "Location:9"),
    ("Monument:1", "relationship.located_at", "Location:0"),
    ("Monument:2", "relationship.located_at", "Location:4"),
    ("Monument:3", "relationship.located_at", "Location:5"),
    ("Monument:4", "relationship.located_at", "Location:1"),
    # RitualEvent -> ArchitecturalStructure
    ("RitualEvent:0", "relationship.held_at", "ArchitecturalStructure:0"),
    ("RitualEvent:1", "relationship.held_at", "ArchitecturalStructure:0"),
    ("RitualEvent:2", "relationship.held_at", "ArchitecturalStructure:5"),
    ("RitualEvent:3", "relationship.held_at", "ArchitecturalStructure:2"),
    ("RitualEvent:4", "relationship.held_at", "ArchitecturalStructure:6"),
    ("RitualEvent:5", "relationship.held_at", "ArchitecturalStructure:7"),
    # Festival -> Deity (honors)
    ("Festival:0", "relationship.honors", "Deity:3"),
    ("Festival:1", "relationship.honors", "Deity:3"),
    ("Festival:2", "relationship.honors", "Deity:2"),
    ("Festival:3", "relationship.honors", "Deity:6"),
    ("Festival:4", "relationship.honors", "Deity:0"),
    ("Festival:5", "relationship.honors", "Deity:1"),
    # IconographicObject -> ArchitecturalStructure
    ("IconographicObject:0", "relationship.housed_in", "ArchitecturalStructure:0"),
    ("IconographicObject:1", "relationship.housed_in", "ArchitecturalStructure:7"),
    ("IconographicObject:2", "relationship.housed_in", "ArchitecturalStructure:2"),
    ("IconographicObject:3", "relationship.housed_in", "ArchitecturalStructure:4"),
    ("IconographicObject:4", "relationship.housed_in", "ArchitecturalStructure:1"),
    ("IconographicObject:5", "relationship.housed_in", "ArchitecturalStructure:6"),
    # KumariTenure -> Deity
    ("KumariTenure:0", "relationship.embodies", "Deity:2"),
    ("KumariTenure:1", "relationship.embodies", "Deity:2"),
    ("KumariTenure:2", "relationship.embodies", "Deity:2"),
    ("KumariTenure:3", "relationship.embodies", "Deity:2"),
    ("KumariTenure:4", "relationship.embodies", "Deity:2"),
    # Tradition -> CasteGroup
    ("Tradition:0", "relationship.observed_by", "CasteGroup:0"),
    ("Tradition:1", "relationship.observed_by", "CasteGroup:0"),
    ("Tradition:2", "relationship.observed_by", "CasteGroup:0"),
    ("Tradition:3", "relationship.observed_by", "CasteGroup:1"),
    ("Tradition:4", "relationship.observed_by", "CasteGroup:1"),
    ("Tradition:5", "relationship.observed_by", "CasteGroup:2"),
    # Event -> Festival (instance_of)
    ("Event:0", "relationship.instance_of", "Festival:0"),
    ("Event:1", "relationship.instance_of", "Festival:1"),
    ("Event:2", "relationship.instance_of", "Festival:4"),
    ("Event:3", "relationship.instance_of", "Festival:0"),
    ("Event:4", "relationship.instance_of", "Festival:0"),
    ("Event:5", "relationship.instance_of", "Festival:3"),
    ("Event:6", "relationship.instance_of", "Festival:0"),
    ("Event:7", "relationship.instance_of", "Festival:0"),
    # Source -> any (cites): use Source as evidence pointer toward landmarks/persons
    ("Source:0", "relationship.cites", "Person:0"),
    ("Source:1", "relationship.cites", "Person:3"),
    ("Source:2", "relationship.cites", "ArchitecturalStructure:0"),
    ("Source:3", "relationship.cites", "Festival:0"),
    ("Source:4", "relationship.cites", "Location:0"),
    ("Source:5", "relationship.cites", "HistoricalPeriod:0"),
]


def reset() -> None:
    """Drop any pre-existing CIDOC rows + assertion edges so the run is repeatable."""
    M.HeritageAssertion.objects.all().delete()
    for model, _count, _names in PLAN:
        model.objects.all().delete()


def _label_field(model) -> str:
    """Pick whichever of `name`/`title` the model actually defines."""
    field_names = {f.name for f in model._meta.get_fields() if hasattr(f, "attname")}
    for candidate in ("name", "title"):
        if candidate in field_names:
            return candidate
    raise SystemExit(f"{model.__name__} has neither `name` nor `title`")


def submit_entities() -> dict[str, list]:
    """Create entities through the same .save() path that DRF ViewSet uses."""
    submitted: dict[str, list] = {}
    for model, count, names in PLAN:
        if len(names) < count:
            raise SystemExit(
                f"Plan error: {model.__name__} requested {count} but only {len(names)} names listed"
            )
        label_attr = _label_field(model)
        bucket = []
        for i in range(count):
            obj = model(**{label_attr: names[i]})
            # Mirror to the other label-like field so _label_for() picks it up too.
            for extra_attr in ("title", "name", "description"):
                if (
                    extra_attr != label_attr
                    and hasattr(obj, extra_attr)
                    and not getattr(obj, extra_attr, None)
                ):
                    try:
                        setattr(obj, extra_attr, names[i])
                    except (AttributeError, TypeError):
                        pass
            obj.save()
            bucket.append(obj)
        submitted[model.__name__] = bucket
    return submitted


def submit_edges(submitted: dict[str, list]) -> int:
    """Create HeritageAssertion edges between submitted entities (accepted = projected)."""
    n_ok = 0
    for subj_key, prop, obj_key in EDGES_PLAN:
        s_cls, s_idx = subj_key.split(":")
        o_cls, o_idx = obj_key.split(":")
        s_obj = submitted[s_cls][int(s_idx)]
        o_obj = submitted[o_cls][int(o_idx)]
        s_ct = ContentType.objects.get_for_model(s_obj.__class__)
        o_ct = ContentType.objects.get_for_model(o_obj.__class__)
        M.HeritageAssertion.objects.create(
            content_type=s_ct,
            object_id=s_obj.pk,
            object_content_type=o_ct,
            object_object_id=o_obj.pk,
            asserted_property=prop,
            asserted_value=f"{getattr(s_obj, 'name', None) or getattr(s_obj, 'title', '')} -> {getattr(o_obj, 'name', None) or getattr(o_obj, 'title', '')}",
            reconciliation_status="accepted",
            confidence="medium",
        )
        n_ok += 1
    return n_ok


def audit(submitted: dict[str, list]) -> None:
    from pyoxigraph import NamedNode, Store

    store_path = settings.OXIGRAPH_STORE_PATH
    store = Store(store_path)

    print("\n" + "=" * 72)
    print("AUDIT")
    print("=" * 72)
    print(f"Store path: {store_path}")
    print(f"RDF_SYNC_ENABLED: {rdf_sync_enabled()}")

    # Per-class parity: SQL rows vs Oxigraph subject quads.
    print(f"\n{'Class':<28}{'SQL rows':>10}{'in Oxigraph':>14}{'quads/row':>11}")
    print("-" * 64)
    total_sql, total_subjects, total_quads = 0, 0, 0
    for cls_name, rows in submitted.items():
        n_sql = len(rows)
        n_found = 0
        cls_quads = 0
        for obj in rows:
            uri = _resource_uri(obj)
            quads = list(store.quads_for_pattern(NamedNode(uri), None, None, None))
            if quads:
                n_found += 1
                cls_quads += len(quads)
        ratio = f"{cls_quads / n_sql:.1f}" if n_sql else "-"
        print(f"{cls_name:<28}{n_sql:>10}{n_found:>14}{ratio:>11}")
        total_sql += n_sql
        total_subjects += n_found
        total_quads += cls_quads
    print("-" * 64)
    print(f"{'TOTAL':<28}{total_sql:>10}{total_subjects:>14}{'':>11}")

    # Whole-store stats.
    # pyoxigraph stringifies NamedNode as "<URI>" — use .value for bare URIs.
    all_subjects = set()
    pred_counter: Counter = Counter()
    type_counter: Counter = Counter()
    rdf_type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
    rdfs_label = "http://www.w3.org/2000/01/rdf-schema#label"
    owl_same_as = "http://www.w3.org/2002/07/owl#sameAs"
    for q in store.quads_for_pattern(None, None, None, None):
        all_subjects.add(q.subject.value)
        pred_uri = q.predicate.value
        pred_counter[pred_uri] += 1
        if pred_uri == rdf_type and hasattr(q.object, "value"):
            type_counter[q.object.value] += 1

    print(f"\nWhole store: {sum(pred_counter.values())} quads, "
          f"{len(all_subjects)} distinct subjects, {len(pred_counter)} distinct predicates")

    # Edge predicates only: anything outside rdf:type / rdfs:label / owl:sameAs.
    edge_preds = {
        p: n for p, n in pred_counter.items()
        if p not in (rdf_type, rdfs_label, owl_same_as)
    }
    edge_total = sum(edge_preds.values())
    n_type = pred_counter.get(rdf_type, 0)
    n_label = pred_counter.get(rdfs_label, 0)
    print(f"  rdf:type triples:  {n_type}")
    print(f"  rdfs:label triples: {n_label}")
    print(f"Edge triples (non-type, non-label, non-sameAs): {edge_total} across "
          f"{len(edge_preds)} predicates")

    # rdf:type breakdown — which CIDOC classes appear.
    instance_types = {t: c for t, c in type_counter.items() if not t.endswith("Class")}
    if instance_types:
        print("\nrdf:type distribution (instance level):")
        for t, c in sorted(instance_types.items(), key=lambda x: -x[1])[:20]:
            print(f"  {c:>4}  {t}")

    # Connectivity: how many submitted subjects are reachable via at least one edge.
    # An "edge" = predicate that isn't rdf:type, rdfs:label, or owl:sameAs.
    def _is_edge(quad) -> bool:
        p = quad.predicate.value
        return p not in (rdf_type, rdfs_label, owl_same_as)

    connected = 0
    isolated_examples = []
    for cls_name, rows in submitted.items():
        for obj in rows:
            uri = _resource_uri(obj)
            sn = NamedNode(uri)
            has_edge = any(_is_edge(q) for q in store.quads_for_pattern(sn, None, None, None))
            if not has_edge:
                has_edge = any(_is_edge(q) for q in store.quads_for_pattern(None, None, sn, None))
            if has_edge:
                connected += 1
            elif len(isolated_examples) < 5:
                isolated_examples.append(f"{cls_name} <{uri}>")
    print(f"\nGraph connectivity: {connected}/{total_sql} submitted subjects "
          f"({100 * connected / total_sql:.0f}%) participate in ≥1 edge")
    if isolated_examples:
        print("Examples of isolated subjects:")
        for ex in isolated_examples:
            print(f"  - {ex}")

    # Sample one connected subject's full triple set.
    if submitted.get("ArchitecturalStructure"):
        sample = submitted["ArchitecturalStructure"][0]
        uri = _resource_uri(sample)
        print(f"\nSample subject <{uri}> ({sample.name}):")
        out = list(store.quads_for_pattern(NamedNode(uri), None, None, None))
        for q in out:
            print(f"  {q.predicate} -> {q.object}")
        inc = list(store.quads_for_pattern(None, None, NamedNode(uri), None))
        if inc:
            print(f"  + {len(inc)} incoming edges:")
            for q in inc[:5]:
                print(f"     {q.subject} -[{q.predicate}]->")


def main() -> None:
    print(f"RDF_SYNC_ENABLED = {rdf_sync_enabled()}")
    if not rdf_sync_enabled():
        raise SystemExit(
            "RDF_SYNC_ENABLED is OFF; aborting (would write to DB but skip projection)."
        )

    print("Resetting CIDOC tables + assertion edges…")
    reset()

    print("Submitting entities…")
    submitted = submit_entities()
    total = sum(len(v) for v in submitted.values())
    print(f"  Created {total} entities across {len(submitted)} classes.")

    print("Submitting cross-entity edges…")
    n_edges = submit_edges(submitted)
    print(f"  Created {n_edges} HeritageAssertion edges (reconciliation_status=accepted).")

    audit(submitted)


if __name__ == "__main__":
    main()
