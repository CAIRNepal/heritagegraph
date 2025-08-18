from datetime import datetime, timedelta

from django.db.models import Count, Q  # ✅ Correct import
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Submission, UserProfile, UserStats


@receiver(post_save, sender=Submission)
def update_user_stats(sender, instance, **kwargs):
    user = instance.contributor
    today = datetime.today()
    first_day_this_month = today.replace(day=1)
    last_month_end = first_day_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    submissions = Submission.objects.filter(contributor=user)

    total_submissions = submissions.count()
    submissions_this_month = submissions.filter(
        created_at__gte=first_day_this_month
    ).count()
    submissions_last_month = submissions.filter(
        created_at__gte=last_month_start, created_at__lte=last_month_end
    ).count()

    # Growth
    if submissions_last_month == 0:
        submissions_growth = 100.0 if submissions_this_month > 0 else 0.0
    else:
        submissions_growth = (
            (submissions_this_month - submissions_last_month) / submissions_last_month
        ) * 100

    # Approval
    reviewed_counts = submissions.filter(status__in=["accepted", "rejected"]).aggregate(
        total_reviewed=Count("id"),
        accepted_count=Count("id", filter=Q(status="accepted")),
    )
    total_reviewed = reviewed_counts["total_reviewed"]
    accepted_count = reviewed_counts["accepted_count"]
    approval_rate = (accepted_count / total_reviewed * 100) if total_reviewed else 0.0

    # Last month approval
    last_month_counts = submissions.filter(
        status__in=["accepted", "rejected"],
        created_at__gte=last_month_start,
        created_at__lte=last_month_end,
    ).aggregate(
        total_reviewed=Count("id"),
        accepted_count=Count("id", filter=Q(status="accepted")),
    )
    last_month_reviewed = last_month_counts["total_reviewed"]
    last_month_accepted = last_month_counts["accepted_count"]
    last_month_approval_rate = (
        (last_month_accepted / last_month_reviewed * 100)
        if last_month_reviewed
        else 0.0
    )
    approval_rate_change = approval_rate - last_month_approval_rate

    # Contributor rank
    profiles = UserProfile.objects.order_by("-score").values_list("user_id", flat=True)
    try:
        contributor_rank = list(profiles).index(user.id) + 1
    except ValueError:
        contributor_rank = 0

    rank_change = 2  # placeholder
    user_profile = UserProfile.objects.filter(user=user).first()
    community_impact_score = round(user_profile.score / 20, 2) if user_profile else 0.0
    impact_score_change = 0.3  # placeholder

    # Create or update UserStats
    stats, _ = UserStats.objects.update_or_create(
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
