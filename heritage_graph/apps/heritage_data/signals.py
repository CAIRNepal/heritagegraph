import logging
from datetime import datetime, timedelta

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import CulturalEntity, Submission, UserProfile, UserStats

logger = logging.getLogger(__name__)


def refresh_user_stats(user):
    """Recompute dashboard UserStats from legacy submissions and CulturalEntity rows."""
    today = datetime.today()
    first_day_this_month = today.replace(day=1)
    last_month_end = first_day_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    submissions = Submission.objects.filter(contributor=user)
    entities = CulturalEntity.objects.filter(contributor=user)

    total_submissions = submissions.count() + entities.count()

    submissions_this_month = (
        submissions.filter(created_at__gte=first_day_this_month).count()
        + entities.filter(created_at__gte=first_day_this_month).count()
    )
    submissions_last_month = (
        submissions.filter(
            created_at__gte=last_month_start,
            created_at__lte=last_month_end,
        ).count()
        + entities.filter(
            created_at__gte=last_month_start,
            created_at__lte=last_month_end,
        ).count()
    )

    if submissions_last_month == 0:
        submissions_growth = 100.0 if submissions_this_month > 0 else 0.0
    else:
        submissions_growth = (
            (submissions_this_month - submissions_last_month) / submissions_last_month
        ) * 100

    reviewed_submissions = submissions.filter(status__in=["accepted", "rejected"])
    reviewed_entities = entities.filter(status__in=["accepted", "rejected"])
    total_reviewed = reviewed_submissions.count() + reviewed_entities.count()
    accepted_count = (
        submissions.filter(status="accepted").count()
        + entities.filter(status="accepted").count()
    )
    approval_rate = (accepted_count / total_reviewed * 100) if total_reviewed else 0.0

    last_month_submissions = submissions.filter(
        status__in=["accepted", "rejected"],
        created_at__gte=last_month_start,
        created_at__lte=last_month_end,
    )
    last_month_entities = entities.filter(
        status__in=["accepted", "rejected"],
        created_at__gte=last_month_start,
        created_at__lte=last_month_end,
    )
    last_month_reviewed = last_month_submissions.count() + last_month_entities.count()
    last_month_accepted = (
        last_month_submissions.filter(status="accepted").count()
        + last_month_entities.filter(status="accepted").count()
    )
    last_month_approval_rate = (
        (last_month_accepted / last_month_reviewed * 100) if last_month_reviewed else 0.0
    )
    approval_rate_change = approval_rate - last_month_approval_rate

    profiles = UserProfile.objects.order_by("-score").values_list("user_id", flat=True)
    try:
        contributor_rank = list(profiles).index(user.id) + 1
    except ValueError:
        contributor_rank = 0

    rank_change = 2  # placeholder
    user_profile = UserProfile.objects.filter(user=user).first()
    community_impact_score = round(user_profile.score / 20, 2) if user_profile else 0.0
    impact_score_change = 0.3  # placeholder

    UserStats.objects.update_or_create(
        user=user,
        defaults={
            "total_submissions": total_submissions,
            "submissions_this_month": submissions_this_month,
            "submissions_last_month": submissions_last_month,
            "submissions_growth": submissions_growth,
            "total_reviewed": total_reviewed,
            "accepted_count": accepted_count,
            "approval_rate": approval_rate,
            "approval_rate_change": approval_rate_change,
            "contributor_rank": contributor_rank,
            "rank_change": rank_change,
            "community_impact_score": community_impact_score,
            "impact_score_change": impact_score_change,
        },
    )


@receiver(post_save, sender=Submission)
def update_user_stats_from_submission(sender, instance, **kwargs):
    refresh_user_stats(instance.contributor)


@receiver(post_save, sender=CulturalEntity)
def update_user_stats_from_cultural_entity(sender, instance, **kwargs):
    refresh_user_stats(instance.contributor)


@receiver(post_save, sender=CulturalEntity)
def sync_cultural_entity_to_public_graph(sender, instance, **kwargs):
    """Mirror a curated standalone CulturalEntity into the public RDF graph so it
    appears in the live Heritage Museum, and remove it again if it is rejected or
    superseded. Standalone contributions never go through the project-merge flow
    (`_project_rdf_merge`), so without this they would save to Postgres but never
    reach the live KG. Runs in transaction.on_commit so the rows are visible
    before we touch the triplestore; failures here never propagate to the request.
    """
    from django.conf import settings
    from django.db import transaction

    if not getattr(settings, "RDF_SYNC_ENABLED", False):
        return

    status = instance.status
    entity_pk = instance.pk

    def _sync():
        try:
            from .models import CulturalEntity

            entity = CulturalEntity.objects.filter(pk=entity_pk).first()
            if entity is None:
                return
            if status in ("accepted", "merged"):
                from apps.cidoc_data.rdf_publish import (
                    persist_cultural_entity_projection,
                )

                persist_cultural_entity_projection(entity)
            elif status in ("rejected", "superseded"):
                from apps.graph.kg_engine.uris import cultural_entity_uri
                from apps.graph.rdf_publish import delete_subject_from_store

                delete_subject_from_store(uri=cultural_entity_uri(entity.entity_id))
        except Exception:
            logger.exception("RDF sync failed for cultural entity %s", entity_pk)

    transaction.on_commit(_sync)


# =====================================================================
# PROJECT SIGNALS
# =====================================================================


@receiver(post_save, sender="heritage_data.Project")
def mint_project_pid(sender, instance, created, **kwargs):
    """Mint a w3id.org PID for a newly created Project and write PROV-O triples
    to the RDF outbox so Oxigraph records the creation provenance activity.
    Skips if pid is already set (idempotent re-save guard).
    """
    if not created or instance.pid:
        return

    from django.conf import settings
    from django.db import transaction

    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    if not base:
        return

    project_id = str(instance.pk)
    pid = f"{base}/project/{project_id}"
    prov_activity_uri = f"{base}/project/{project_id}/activity/creation"

    # Write directly to avoid triggering post_save again
    type(instance).objects.filter(pk=instance.pk).update(
        pid=pid, prov_activity_uri=prov_activity_uri
    )
    # Keep in-memory instance in sync for any downstream code in this request
    instance.pid = pid
    instance.prov_activity_uri = prov_activity_uri

    owner_id = instance.owner_id

    def _write_prov_triples():
        try:
            from apps.graph.kg_engine.outbox import enqueue_insert_nt
            from apps.graph.kg_engine.partitions import GraphPartition
            from apps.graph.kg_engine.uris import resource_base

            base_uri = resource_base()
            prov = "http://www.w3.org/ns/prov#"
            rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
            xsd = "http://www.w3.org/2001/XMLSchema#"
            hg = f"{base_uri}/"
            owner_uri = f"{base_uri}/user/{owner_id}"

            from django.utils.timezone import now
            started_at = now().strftime("%Y-%m-%dT%H:%M:%SZ")

            ntriples = (
                f"<{pid}> <{rdf}type> <{prov}Activity> .\n"
                f"<{pid}> <{rdf}type> <{hg}ProjectCreationActivity> .\n"
                f"<{pid}> <{prov}wasAssociatedWith> <{owner_uri}> .\n"
                f"<{pid}> <{prov}startedAtTime> "
                f'"{started_at}"^^<{xsd}dateTime> .\n'
            )

            graph_uri = GraphPartition.PROJECT.uri(suffix=project_id)
            enqueue_insert_nt(graph_uri=graph_uri, ntriples=ntriples, error="")
        except Exception:
            logger.exception(
                "PID minting RDF write failed for project %s", project_id
            )

    transaction.on_commit(_write_prov_triples)

def _notify_project_members(project, actor, notification_type, message, link=""):
    """Create Notification rows for all active project members except the actor."""
    from .models import Notification

    recipients = set()
    recipients.add(project.owner_id)
    for uid in project.memberships.values_list("user_id", flat=True):
        recipients.add(uid)

    actor_id = actor.id if actor and actor.is_authenticated else None
    for user_id in recipients:
        if user_id == actor_id:
            continue
        Notification.objects.create(
            user_id=user_id,
            actor=actor if actor and actor.is_authenticated else None,
            notification_type=notification_type,
            project=project,
            message=message,
            link=link,
        )


def _notify_reviewers_about_project_submission(project, actor):
    """Ping users in the ``Reviewers`` group when a project enters review."""
    from django.contrib.auth import get_user_model

    from .models import Notification

    recipients = (
        get_user_model()
        .objects.filter(groups__name="Reviewers")
        .values_list("id", flat=True)
        .distinct()
    )
    actor_id = actor.id if actor and actor.is_authenticated else None
    for user_id in recipients:
        if user_id == actor_id:
            continue
        Notification.objects.create(
            user_id=user_id,
            actor=actor if actor and actor.is_authenticated else None,
            notification_type="project_review_queue",
            project=project,
            message=(
                f'Project "{project.title}" was submitted for review '
                f"(slug: {project.slug})."
            ),
            link="/curation/projects-review",
        )


@receiver(post_save, sender="heritage_data.ProjectActivity")
def on_project_activity(sender, instance, created, **kwargs):
    """Fire notifications when a project changes state."""
    if not created:
        return
    from .models import Project

    if instance.action != "state_changed":
        return

    project = instance.project
    new_state = instance.payload.get("to", instance.payload.get("to_state"))
    if new_state is None:
        new_state = project.state
    human = {
        Project.STATE_IN_REVIEW: "submitted for review",
        Project.STATE_APPROVED: "approved",
        Project.STATE_NEEDS_REVISION: "returned for revision",
        Project.STATE_MERGED: "merged into the public graph",
        Project.STATE_WITHDRAWN: "withdrawn",
    }.get(new_state)
    if not human:
        return

    if new_state == Project.STATE_IN_REVIEW:
        _notify_reviewers_about_project_submission(project, instance.actor)

    _notify_project_members(
        project=project,
        actor=instance.actor,
        notification_type="project_state_changed",
        message=f'Project "{project.title}" has been {human}.',
        link=f"/contribute/projects/{project.slug}",
    )

    # When merged, trigger RDF projection for all project entities.
    if new_state == Project.STATE_MERGED:
        _project_rdf_merge(project)


@receiver(post_save, sender="heritage_data.Comments")
def on_project_comment(sender, instance, created, **kwargs):
    """Notify project members when a new comment is posted on a project."""
    if not created or instance.project_id is None:
        return

    project = instance.project
    actor = instance.user
    _notify_project_members(
        project=project,
        actor=actor,
        notification_type="project_comment",
        message=f'{actor.username} commented on project "{project.title}".',
        link=f"/contribute/projects/{project.slug}",
    )


def _project_rdf_merge(project):
    """
    Project has been merged: promote each linked CulturalEntity into the public
    RDF named graph.  Runs inside transaction.on_commit so the Postgres rows are
    visible before we touch the triplestore.
    """
    from django.conf import settings
    from django.db import transaction

    if not getattr(settings, "RDF_SYNC_ENABLED", False):
        return

    entity_ids = list(
        project.entities.values_list("entity_id", flat=True)
    )
    if not entity_ids:
        return

    def _do_projection():
        try:
            from apps.cidoc_data.rdf_publish import persist_cultural_entity_projection

            from .models import CulturalEntity

            # Promote status so the contributor UI ("My contributions") and the
            # public graph agree: a merged project's entities ARE published.
            # Without this they'd appear in the public KG but still read "draft".
            CulturalEntity.objects.filter(id__in=entity_ids).exclude(
                status__in=["accepted", "merged", "published"]
            ).update(status="merged")

            for entity in CulturalEntity.objects.filter(id__in=entity_ids):
                try:
                    persist_cultural_entity_projection(entity)
                except Exception:
                    logger.exception(
                        "RDF projection failed for cultural entity %s",
                        entity.entity_id,
                    )
        except ImportError:
            pass

    transaction.on_commit(_do_projection)


@receiver(post_save, sender="document_processing.UploadedDocument")
def queue_entity_suggestions_for_project_assets(sender, instance, **kwargs):
    """After OCR succeeds, enqueue placeholder entity-link hints for matching assets."""
    if instance.status != "completed":
        return

    try:
        from .models import ProjectAsset
        from .tasks import suggest_entities_from_project_asset
    except Exception:
        return

    for pk in ProjectAsset.objects.filter(media_id=instance.media_id).values_list(
        "pk", flat=True
    ):
        suggest_entities_from_project_asset.delay(str(pk))
