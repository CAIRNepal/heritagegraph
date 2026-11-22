# Proposed changes to the upstream ontology

`ontology/HeritageGraph.yaml` mirrors the upstream release
(`CAIRNepal/heritagegraphontology`), so it is not edited here. These are the
changes this platform needs upstream, each with the evidence for it.

## 1. `justification_note` should not use `crminf:J4_that`

In CRMinf, `J4_that` relates an I2 Belief to the I4 Proposition Set it holds to
be true — an object, not text. The platform's projection uses it that way: each
belief points by `J4_that` to the reified statement it believes. The slot
`justification_note`, a free-text reasoning summary, is declared with the same
property and a string range, so the generated SHACL shape demands a literal
where the data correctly has an IRI. Every relationship belief fails it.

```yaml
  justification_note:
-   slot_uri: crminf:J4_that
+   slot_uri: heritageGraph:justification_note
    range: string
    description: "CRMinf justification or reasoning summary for this belief"
```

If the note should stay aligned with CRMinf, `crminf:J5_holds_to_be` with a
proposition-set range, or a `P3_has_note` on the I5 Inference Making, would fit
better than J4.

## 2. `asserted_value` cannot be required on every assertion

An assertion either claims a value for a property (a slot assertion: "status is
Lost") or links two records (a relationship assertion: "this deity has religious
tradition Vaishnavism"). The second kind has no literal value; its value is the
object record. Requiring `asserted_value` on the Assertion class makes every
relationship belief fail `minCount 1`.

```yaml
    slot_usage:
      asserted_property:
        required: true
-     asserted_value:
-       required: true
```

and on the slot itself:

```yaml
  asserted_value:
    slot_uri: heritageGraph:asserted_value
    range: string
-   required: true
```

A LinkML rule can keep the requirement where it belongs — required unless the
assertion names an object — if upstream prefers to keep it enforced.

## Evidence

Validating the published graph (public, belief and provenance graphs; 9,477
triples) with `manage.py shacl_conformance`:

| Shapes | Result |
| --- | --- |
| Generated from the current ontology | does not conform — 718 violations, all from these two constraints (359 each) |
| The same shapes with these two changes applied | **conforms — 0 violations** across all 26 node shapes |

Once upstream accepts them: update `ontology/upstream/`, run `make ontology`
and `make shacl`, confirm `shacl_conformance --check` passes, then consider
turning on `RDF_SHACL_STRICT_ON_WRITE`.
