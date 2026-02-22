#!/usr/bin/env python3
"""Parse Heritage.ttl and extract all classes + object properties for the graph viz."""

import re
from pathlib import Path

TTL = Path("/Users/nirajkarki/cair/CAIR/heritagegraph/ontology/Heritage.ttl").read_text()

HG = "https://w3id.org/heritagegraph/"
CRM = "http://www.cidoc-crm.org/cidoc-crm/"
AAT = "http://vocab.getty.edu/aat/"

# ── 1. Extract ALL classes ──────────────────────────────────────
class_pattern = re.compile(r'^<([^>]+)>\s+rdf:type\s+owl:Class\s*;', re.MULTILINE)
classes_raw = class_pattern.findall(TTL)
# Also find inline class declarations
classes_raw2 = re.findall(r'<([^>]+)>\s+rdf:type\s+owl:Class\s*[;.]', TTL)
all_class_uris = sorted(set(classes_raw + classes_raw2))

print(f"Total class URIs found: {len(all_class_uris)}")

hg_classes = [c for c in all_class_uris if c.startswith(HG)]
aat_classes = [c for c in all_class_uris if c.startswith(AAT)]
crm_classes = [c for c in all_class_uris if c.startswith(CRM)]

print(f"  HeritageGraph ns: {len(hg_classes)}")
print(f"  AAT ns: {len(aat_classes)}")
print(f"  CRM ns: {len(crm_classes)}")
print()

# ── 2. Extract rdfs:subClassOf (named class only) ──────────────
# Pattern: something rdfs:subClassOf <namedClass>
subclass_pattern = re.compile(
    r'<(' + re.escape(HG) + r'[^>]+)>[^.]*?rdfs:subClassOf\s+<(' + re.escape(HG) + r'[^>]+)>',
    re.DOTALL
)
subclass_rels = subclass_pattern.findall(TTL)
print(f"SubClassOf relationships (HG→HG): {len(subclass_rels)}")
for child, parent in sorted(subclass_rels):
    c = child.replace(HG, "")
    p = parent.replace(HG, "")
    print(f"  {c} → {p}")

# ── 3. Extract rdfs:label and skos:definition for each class ───
def get_label(uri):
    m = re.search(r'<' + re.escape(uri) + r'>.*?rdfs:label\s+"([^"]+)"', TTL, re.DOTALL)
    return m.group(1) if m else uri.split('/')[-1].split('#')[-1]

def get_definition(uri):
    m = re.search(r'<' + re.escape(uri) + r'>.*?skos:definition>\s+"([^"]+)"', TTL, re.DOTALL)
    return m.group(1) if m else ""

def get_exact_match(uri):
    block_match = re.search(r'<' + re.escape(uri) + r'>(.*?)(?:\n\n|\n###)', TTL, re.DOTALL)
    if not block_match:
        return ""
    block = block_match.group(1)
    matches = re.findall(r'skos:exactMatch>\s+<([^>]+)>', block)
    crm = [m for m in matches if "cidoc-crm" in m]
    return crm[0] if crm else (matches[0] if matches else "")

# ── 4. Extract ALL object properties with domain/range ─────────
# Find each ObjectProperty block
op_blocks = re.findall(
    r'###[^\n]*\n<(' + re.escape(HG) + r'[^>]+)>\s+rdf:type\s+owl:ObjectProperty\s*;(.*?)(?=\n###|\n#####|\Z)',
    TTL, re.DOTALL
)
print(f"\nObject properties found: {len(op_blocks)}")

obj_props = []
for uri, block in op_blocks:
    name = uri.replace(HG, "")
    label_m = re.search(r'rdfs:label\s+"([^"]+)"', block)
    label = label_m.group(1) if label_m else name
    
    domain_m = re.search(r'rdfs:domain\s+<([^>]+)>', block)
    range_m = re.search(r'rdfs:range\s+<([^>]+)>', block)
    
    domain = domain_m.group(1).replace(HG, "") if domain_m else None
    range_ = range_m.group(1).replace(HG, "").replace(CRM, "crm:").replace(AAT, "aat:") if range_m else None
    
    obj_props.append({
        "name": name,
        "label": label,
        "domain": domain,
        "range": range_,
    })

# Print properties that have BOTH domain and range (these are direct edges)
print("\nProperties with domain AND range:")
for p in obj_props:
    if p["domain"] and p["range"]:
        print(f"  {p['domain']} --[{p['name']}]--> {p['range']}")

# ── 5. Extract owl:Restriction based properties ────────────────
# These appear as: rdfs:subClassOf [ owl:onProperty <prop> ; owl:allValuesFrom <class> ]
restriction_pattern = re.compile(
    r'<(' + re.escape(HG) + r'[^>]+)>[^.]*?rdfs:subClassOf.*?owl:onProperty\s+<(' + re.escape(HG) + r'[^>]+)>\s*;\s*owl:allValuesFrom\s+<([^>]+)>',
    re.DOTALL
)

# Better: find each class block and extract restrictions from it
print("\n\nRestriction-based properties (class → property → range):")
class_blocks = re.split(r'\n###\s+', TTL)
restriction_edges = []
for block in class_blocks:
    class_m = re.match(r'[^\n]*\n<([^>]+)>\s+rdf:type\s+owl:Class', block)
    if not class_m:
        continue
    class_uri = class_m.group(1)
    if not class_uri.startswith(HG):
        continue
    class_name = class_uri.replace(HG, "")
    
    # Find all owl:onProperty + owl:allValuesFrom pairs in this block
    restrictions = re.findall(
        r'owl:onProperty\s+<(' + re.escape(HG) + r'[^>]+)>\s*;\s*owl:allValuesFrom\s+<([^>]+)>',
        block
    )
    for prop_uri, range_uri in restrictions:
        prop_name = prop_uri.replace(HG, "")
        range_name = range_uri.replace(HG, "").replace(CRM, "crm:").replace(AAT, "aat:")
        restriction_edges.append((class_name, prop_name, range_name))
        print(f"  {class_name} --[{prop_name}]--> {range_name}")

print(f"\nTotal restriction edges: {len(restriction_edges)}")

# ── 6. Enumerate all unique nodes needed ────────────────────────
all_nodes = set()
for c in hg_classes:
    all_nodes.add(c.replace(HG, ""))
for c in aat_classes:
    all_nodes.add("aat:" + c.replace(AAT, ""))
for c in crm_classes:
    all_nodes.add("crm:" + c.replace(CRM, ""))

# Also add range targets from restriction edges
for _, _, r in restriction_edges:
    all_nodes.add(r)

print(f"\nTotal unique nodes for graph: {len(all_nodes)}")
hg_only = [n for n in all_nodes if not n.startswith("aat:") and not n.startswith("crm:")]
print(f"  HG namespace nodes: {len(hg_only)}")
print(f"  External nodes: {len(all_nodes) - len(hg_only)}")
