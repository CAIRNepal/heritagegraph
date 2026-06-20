"""
Celery tasks for the LOD publication pipeline.

Dispatched by merge.execute_merge() after a MergeRequest is approved:
  - export_nanopubs_for_merge  → one TriG nanopub file per accepted HeritageAssertion
  - regen_void_dcat            → rewrite ontology/lod/void-dataset.ttl with live counts
  - mint_doi                   → POST to DataCite REST API and persist DOI on ProjectSnapshot
"""

from __future__ import annotations

import logging
from pathlib import Path

from celery import shared_task

logger = logging.getLogger(__name__)


# ── Re-reconciliation beat task ────────────────────────────────────────────────

@shared_task(bind=True, max_retries=1, default_retry_delay=300)
def rereconcile_all_entities(self) -> dict:
    """
    Celery beat task (Sunday 02:00 UTC): verify all active skos:exactMatch links
    against their authority sources. Marks stale links and creates CuratorAlerts.

    Schedule in settings: CELERY_BEAT_SCHEDULE = {
        "rereconcile": {
            "task": "apps.graph.tasks.rereconcile_all_entities",
            "schedule": crontab(hour=2, minute=0, day_of_week=0),
        }
    }
    """
    try:
        import requests as _requests
        from django.utils import timezone

        from apps.heritage_data.models import CuratorAlert, ReconciledLink

        links = ReconciledLink.objects.filter(is_stale=False)
        stale_count = 0
        drift_count = 0
        checked = 0

        for link in links.iterator():
            checked += 1
            try:
                resp = _requests.get(link.target_uri, timeout=10, allow_redirects=True)
                if resp.status_code == 404:
                    link.is_stale = True
                    link.last_verified = timezone.now()
                    link.save(update_fields=["is_stale", "last_verified"])
                    CuratorAlert.objects.get_or_create(
                        reconciled_link=link,
                        issue_type=CuratorAlert.ISSUE_STALE,
                        status=CuratorAlert.STATUS_OPEN,
                        defaults={"detail": f"Target returned HTTP 404: {link.target_uri}"},
                    )
                    stale_count += 1
                elif resp.status_code in (301, 302, 308):
                    new_location = resp.headers.get("Location", "")
                    link.is_stale = True
                    link.last_verified = timezone.now()
                    link.save(update_fields=["is_stale", "last_verified"])
                    CuratorAlert.objects.get_or_create(
                        reconciled_link=link,
                        issue_type=CuratorAlert.ISSUE_STALE,
                        status=CuratorAlert.STATUS_OPEN,
                        defaults={
                            "detail": f"Target redirected to {new_location}",
                            "suggested_replacement_uri": new_location,
                        },
                    )
                    stale_count += 1
                else:
                    link.last_verified = timezone.now()
                    link.save(update_fields=["last_verified"])
            except Exception as exc:
                logger.warning("rereconcile: could not check %s: %s", link.target_uri, exc)

        logger.info(
            "rereconcile_all_entities: checked=%d stale=%d drift=%d",
            checked,
            stale_count,
            drift_count,
        )
        return {
            "status": "ok",
            "checked": checked,
            "stale": stale_count,
            "drift": drift_count,
        }
    except Exception as exc:
        logger.exception("rereconcile_all_entities failed")
        raise self.retry(exc=exc)


# ── Nanopublication export ─────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def export_nanopubs_for_merge(self, merge_request_id: str) -> dict:
    """
    Export one nanopublication TriG bundle per accepted HeritageAssertion in the
    merged project and write each to MEDIA_ROOT/nanopubs/<project_id>/.

    Future enhancement: SPARQL INSERT DATA each nanopub into its own Oxigraph
    named graph when a TriG-aware HTTP endpoint is available.
    """
    try:
        from django.conf import settings

        from apps.cidoc_data.models import HeritageAssertion
        from apps.graph.kg_engine.nanopub_export import nanopub_trig_for_assertion
        from apps.heritage_data.models import MergeRequest

        mr = MergeRequest.objects.select_related("project").get(pk=merge_request_id)
        project_id = str(mr.project_id)

        np_dir = Path(settings.MEDIA_ROOT) / "nanopubs" / project_id
        np_dir.mkdir(parents=True, exist_ok=True)

        assertions = HeritageAssertion.objects.filter(
            project_id=project_id,
            reconciliation_status="accepted",
        )

        count = 0
        for assertion in assertions.iterator():
            try:
                trig = nanopub_trig_for_assertion(assertion)
                (np_dir / f"nanopub-{assertion.pk}.trig").write_text(trig, encoding="utf-8")
                count += 1
            except Exception as inner_exc:
                logger.warning(
                    "export_nanopubs_for_merge: assertion %s failed: %s",
                    assertion.pk,
                    inner_exc,
                )

        logger.info(
            "export_nanopubs_for_merge: %d nanopubs written for project %s → %s",
            count,
            project_id,
            np_dir,
        )
        return {"status": "ok", "count": count, "project_id": project_id}
    except Exception as exc:
        logger.exception("export_nanopubs_for_merge failed for %s", merge_request_id)
        raise self.retry(exc=exc)


# ── VoID / DCAT regeneration ───────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def regen_void_dcat(self) -> dict:
    """
    Regenerate ontology/lod/void-dataset.ttl with live triple counts from Oxigraph.
    Called after every merge so void:triples stays current.
    """
    try:
        from django.conf import settings

        from apps.graph.kg_engine.void_generator import generate_void_dcat

        ttl = generate_void_dcat()

        output_path = (
            Path(settings.BASE_DIR).parent / "ontology" / "lod" / "void-dataset.ttl"
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(ttl, encoding="utf-8")

        triple_count = 0
        for line in ttl.splitlines():
            if "void:triples" in line:
                try:
                    triple_count = int(line.split()[-1].rstrip(";.,"))
                except ValueError:
                    pass

        logger.info(
            "regen_void_dcat: %d triples recorded → %s", triple_count, output_path
        )
        return {"status": "ok", "triple_count": triple_count, "path": str(output_path)}
    except Exception as exc:
        logger.exception("regen_void_dcat failed")
        raise self.retry(exc=exc)


# ── DataCite DOI minting ───────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def mint_doi(self, project_snapshot_id: str) -> dict:
    """
    Mint a DataCite DOI for a ProjectSnapshot and persist it in snapshot['doi'].

    Requires env vars: DATACITE_USERNAME, DATACITE_PASSWORD, DATACITE_PREFIX.
    Skips gracefully in development when credentials are absent.
    """
    try:
        import requests as _requests
        from django.conf import settings

        from apps.heritage_data.models import ProjectSnapshot

        snapshot = ProjectSnapshot.objects.select_related(
            "project", "merged_by"
        ).get(pk=project_snapshot_id)

        username = str(getattr(settings, "DATACITE_USERNAME", "") or "").strip()
        password = str(getattr(settings, "DATACITE_PASSWORD", "") or "").strip()
        prefix = str(getattr(settings, "DATACITE_PREFIX", "") or "").strip()

        if not username or not prefix:
            logger.warning(
                "mint_doi: DATACITE_USERNAME / DATACITE_PREFIX not set — skipping for %s",
                project_snapshot_id,
            )
            return {"status": "skipped", "reason": "no_credentials"}

        pub_year = snapshot.created_at.year

        creators = []
        if snapshot.merged_by:
            full = snapshot.merged_by.get_full_name() or snapshot.merged_by.username
            creators.append({"name": full})
        if not creators:
            creators.append({"name": "CAIR-Nepal"})

        payload = {
            "data": {
                "type": "dois",
                "attributes": {
                    "prefix": prefix,
                    "titles": [{"title": snapshot.project.title}],
                    "creators": creators,
                    "publisher": "HeritageGraph / CAIR-Nepal",
                    "publicationYear": pub_year,
                    "types": {"resourceTypeGeneral": "Dataset"},
                    "url": (
                        f"https://w3id.org/heritagegraph/project/{snapshot.project_id}"
                    ),
                    "event": "publish",
                },
            }
        }

        resp = _requests.post(
            "https://api.datacite.org/dois",
            auth=(username, password),
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        doi = resp.json()["data"]["id"]

        # Persist DOI in snapshot JSON blob (no migration required)
        data = dict(snapshot.snapshot or {})
        data["doi"] = doi
        ProjectSnapshot.objects.filter(pk=project_snapshot_id).update(snapshot=data)

        logger.info("mint_doi: minted %s for snapshot %s", doi, project_snapshot_id)
        return {"status": "ok", "doi": doi}
    except Exception as exc:
        logger.exception("mint_doi failed for snapshot %s", project_snapshot_id)
        raise self.retry(exc=exc)
