"""Graph app models — RDF sync outbox."""

from __future__ import annotations

import uuid

from django.db import models


class RDFSyncOutbox(models.Model):
    """Failed or deferred knowledge graph writes (retry via ``rdf_drain_outbox``)."""

    class Operation(models.TextChoices):
        REPLACE_SLOT = "replace_slot", "Replace managed slot projection"
        DELETE_SUBJECT = "delete_subject", "Delete subject from graph"
        INSERT_NT = "insert_nt", "Insert N-Triples block"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_uri = models.CharField(max_length=512, blank=True, db_index=True)
    operation = models.CharField(max_length=32, choices=Operation.choices)
    graph_uri = models.CharField(max_length=512, blank=True)
    payload = models.JSONField(default=dict)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "graph_rdf_sync_outbox"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["processed_at", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.operation} {self.subject_uri[:60]}"
