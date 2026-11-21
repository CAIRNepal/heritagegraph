# Ethics, community consent and contributor privacy

**Audience:** journal ethics screeners, reviewers, community partners, maintainers
**Status:** technical controls implemented; community consent process **not yet
established** (see §5)

This document states what the platform enforces in code and what it does not.
It deliberately does not claim consent that has not been obtained.

---

## 1. Why this document exists

HeritageGraph models living cultural practice, not only historic objects. The
CIDOC registry includes classes for ritual events, deities, Guthi
(community trust) structures, and — significantly — `KumariSelection`,
`KumariTenure` and `KumariRetirement`, which describe the selection and
retirement of a living child in an ongoing religious tradition.

Publishing that material as queryable Linked Open Data is not ethically
equivalent to publishing a monument's coordinates. Any venue with an ethics
screen will ask who authorised it. The honest current answer is in §5.

## 2. What the code enforces today

### 2.1 CARE access tiers

Every record inherits `access_tier` from `cidoc_data.models.MetaData`, with four
values: `public`, `restricted`, `community_only`, `sensitive_indigenous`. Records
also carry `care_labels`, a list of TK/CARE label URIs or community consent
markers.

Filtering happens at the query layer, not in the interface. `CARESparqlProxyView`
(`apps/graph/sparql_proxy.py`) injects `FILTER NOT EXISTS` clauses into every
forwarded SPARQL query:

| Requester | Tiers hidden |
|---|---|
| anonymous / signed-in public user | `sensitive_indigenous`, `community_only` |
| community member | `sensitive_indigenous` |
| curator / staff | none |

The response carries an `X-CARE-Filtered` header reporting how many filter
clauses were injected, so a client can tell the user that material was withheld
rather than silently absent.

**Limitation to state in any paper:** this is access control over the query
endpoint. It is not a claim that the tier assignments themselves are correct.
Assigning a record to a tier is a human editorial judgement, and there is
currently no community-authority sign-off step that a curator must pass before
setting a tier.

### 2.2 Provenance and source separation

Imported third-party RDF is loaded into frozen, separately named graphs (`L0`)
and is never written to `graph/public`. Curated claims (`L1`) carry a
`DataSource` and a confidence value. `manage.py kg_rigor_audit` enforces the
separation. This means a reader can always determine whether a statement is a
community contribution or an imported assertion from OpenStreetMap, Wikidata or
UNESCO.

### 2.3 Licensing

Software is MIT. Data terms vary per source and travel with the source
(`cidoc_data/danam_import/licenses.py`, `LICENSE-DATA`). Community contributions
are not silently relicensed under the software licence.

## 3. Contributor privacy

Contributions are attributed by username, and the leaderboard and contributor
directory rank named individuals publicly by score.

What is implemented:

- Attribution is by the account's chosen username, not by legal name or email.
- Profile fields (organisation, position, links) are contributor-supplied and
  optional.

What is **not** implemented, and should be before any public launch or paper:

- There is no consent screen explaining that contributions and ranking will be
  public and permanently attributed, and no record of that consent.
- There is no opt-out from the public leaderboard while remaining a contributor.
- There is no documented retention or erasure path for a contributor who
  withdraws. Because contributions are versioned and projected into RDF,
  erasure is a real engineering question, not a checkbox.

## 4. Human subjects

The platform does not run experiments on users. It does record and publish
information about living people — contributors, and the subjects of some
heritage records. The second category is the one that needs review.

## 5. Outstanding: community consent

**No community consent process has been established.** There is no
community-authority agreement, no documented consultation, and no institutional
ethics approval on file for publishing the culturally sensitive classes named in
§1.

Until that exists, the honest position is:

1. Culturally sensitive records must be created at
   `access_tier = "sensitive_indigenous"` and must not be published to
   `graph/public` or included in any Zenodo deposit.
2. No paper should claim community endorsement, participatory design, or CARE
   compliance. The correct claim is "CARE-aligned access controls are
   implemented"; the governance layer CARE actually requires — community
   authority over the data — is not yet in place.
3. Before the Kumari-related classes are populated with real data, a written
   agreement with the relevant community authority is required, and it should be
   cited in the paper's ethics statement.

### What a complete consent package needs

- Identification of the community authority with standing to consent for each
  sensitive class.
- A written, plain-language description of what will be published, where, under
  what licence, and for how long.
- An agreed mechanism for the community to request correction, restriction, or
  withdrawal after publication.
- A named point of contact and review cadence.
- Institutional ethics review, or a written determination that it is not
  required, from an appropriate body.

## 6. What to write in an ethics statement today

Accurate as of this document:

> HeritageGraph implements CARE-aligned access tiers enforced at the SPARQL
> query layer, with named-graph provenance separating imported sources from
> curated community contributions. Culturally sensitive classes are withheld
> from public query results and from published dumps. A formal community
> consent process and institutional ethics review have not yet been completed;
> no culturally sensitive material has been published pending that process.

Do not write anything stronger than this until §5 is resolved.
