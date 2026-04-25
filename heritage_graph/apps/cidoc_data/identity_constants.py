"""Constants for claim-first identity (EntityCluster + same-referent membership)."""

from __future__ import annotations

# asserted_property for cluster membership rows (005-identity-layer).
IDENTITY_SAME_REFERENT_PROPERTY = "identity.same_referent"

# Lower index = higher trust when ordering competing identity evidence (FR-017 v1).
# Aligns with DataSource.source_type choices in models.py SOURCE_CATEGORY_CHOICES.
SOURCE_TYPE_CONFLICT_ORDER: tuple[str, ...] = (
    "inscription",
    "archival",
    "published",
    "field_survey",
    "oral_history",
    "web",
)

CLUSTER_AUDIT_ACTION_MERGE = "merge"
CLUSTER_AUDIT_ACTION_SPLIT = "split"
CLUSTER_AUDIT_ACTION_LOCK = "lock"
CLUSTER_AUDIT_ACTION_UNLOCK = "unlock"
CLUSTER_AUDIT_ACTION_LOCK_OVERRIDE_MERGE = "lock_override_merge"

CLUSTER_AUDIT_ACTION_CHOICES: tuple[tuple[str, str], ...] = (
    (CLUSTER_AUDIT_ACTION_MERGE, "Merge clusters"),
    (CLUSTER_AUDIT_ACTION_SPLIT, "Split cluster"),
    (CLUSTER_AUDIT_ACTION_LOCK, "Lock cluster"),
    (CLUSTER_AUDIT_ACTION_UNLOCK, "Unlock cluster"),
    (CLUSTER_AUDIT_ACTION_LOCK_OVERRIDE_MERGE, "Merge with lock override"),
)
