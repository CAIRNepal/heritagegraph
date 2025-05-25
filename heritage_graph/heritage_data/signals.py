# from django.db.models.signals import post_save, post_delete
# from django.dispatch import receiver
# from django.contrib.auth.models import User
# from .models import Submission, Moderation, ActivityLog, UserProfile


# # Handle creating/updating the user profile
# @receiver(post_save, sender=User)
# def create_or_update_user_profile(sender, instance, created, **kwargs):
#     if created:
#         UserProfile.objects.create(user=instance)
#     else:
#         instance.profile.save()


# # Log when a new submission is created or updated
# @receiver(post_save, sender=Submission)
# def log_submission_create(sender, instance, created, **kwargs):
#     if created:
#         action_description = f"Created submission '{instance.title}'"
#         action_type = 'add'
#     else:
#         action_description = f"Updated submission '{instance.title}'"
#         action_type = 'edit'
    
#     ActivityLog.objects.create(
#         user=instance.contributor,
#         action=action_type,
#         description=action_description
#     )


# # Log when a submission is deleted
# @receiver(post_delete, sender=Submission)
# def log_submission_delete(sender, instance, **kwargs):
#     action_description = f"Deleted submission '{instance.title}'"
#     ActivityLog.objects.create(
#         user=instance.contributor,
#         action='delete',
#         description=action_description
#     )


# # Log when moderation is added/updated or a comment is made
# @receiver(post_save, sender=Moderation)
# def log_moderation_update_or_comment(sender, instance, created, **kwargs):
#     if created:
#         action_description = f"Moderation added for submission '{instance.submission.title}'"
#         action_type = 'review'
#     else:
#         action_description = f"Moderation updated for submission '{instance.submission.title}'"
#         action_type = 'edit'
        
#     ActivityLog.objects.create(
#         user=instance.moderator,
#         action=action_type,
#         description=action_description
#     )
    
#     # Log comment if any
#     if instance.comment:
#         comment_action_description = f"Commented on submission '{instance.submission.title}'"
#         ActivityLog.objects.create(
#             user=instance.moderator,
#             action='comment',
#             description=comment_action_description
#         )


# # Log when a user's profile is created or updated
# @receiver(post_save, sender=UserProfile)
# def log_profile_update(sender, instance, created, **kwargs):
#     if created:
#         action_description = f"User profile created for '{instance.user.username}'"
#         action_type = 'add'
#     else:
#         action_description = f"User profile updated for '{instance.user.username}'"
#         action_type = 'edit'
    
#     ActivityLog.objects.create(
#         user=instance.user,
#         action=action_type,
#         description=action_description
#     )
