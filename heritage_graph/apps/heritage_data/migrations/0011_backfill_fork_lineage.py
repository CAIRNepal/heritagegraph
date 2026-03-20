"""
Data migration: backfill lineage fields on CulturalEntity and fork metadata on Fork
for all existing Fork records.
"""
from django.db import migrations


def backfill_fork_lineage(apps, schema_editor):
    Fork = apps.get_model('heritage_data', 'Fork')
    CulturalEntity = apps.get_model('heritage_data', 'CulturalEntity')
    Revision = apps.get_model('heritage_data', 'Revision')

    for fork in Fork.objects.select_related(
        'original_entity', 'forked_entity', 'forked_from_revision'
    ).all():
        original = fork.original_entity
        forked = fork.forked_entity

        # Determine root: if original already has a root, use that; otherwise original IS root
        root = original.root_entity if original.root_entity_id else original

        forked.root_entity = root
        forked.parent_entity = original
        forked.fork_depth = original.fork_depth + 1
        forked.save(update_fields=['root_entity', 'parent_entity', 'fork_depth'])

        # Compute diff_summary from parent revision vs forked first revision
        parent_rev = fork.forked_from_revision
        forked_rev = Revision.objects.filter(entity=forked).order_by('revision_number').first()

        diff_summary = {}
        if parent_rev and forked_rev and parent_rev.data and forked_rev.data:
            parent_data = parent_rev.data if isinstance(parent_rev.data, dict) else {}
            forked_data = forked_rev.data if isinstance(forked_rev.data, dict) else {}
            all_keys = set(parent_data.keys()) | set(forked_data.keys())
            for key in all_keys:
                old_val = parent_data.get(key)
                new_val = forked_data.get(key)
                if old_val != new_val:
                    diff_summary[key] = {'old': old_val, 'new': new_val}

        fork.fork_reason_tag = 'other'
        fork.fork_status = 'active'
        fork.diff_summary = diff_summary
        fork.save(update_fields=['fork_reason_tag', 'fork_status', 'diff_summary'])


def reverse_backfill(apps, schema_editor):
    CulturalEntity = apps.get_model('heritage_data', 'CulturalEntity')
    CulturalEntity.objects.filter(fork_depth__gt=0).update(
        root_entity=None, parent_entity=None, fork_depth=0
    )
    Fork = apps.get_model('heritage_data', 'Fork')
    Fork.objects.all().update(fork_reason_tag='other', fork_status='active', diff_summary={})


class Migration(migrations.Migration):

    dependencies = [
        ('heritage_data', '0010_fork_lineage_and_enhanced_fork_model'),
    ]

    operations = [
        migrations.RunPython(backfill_fork_lineage, reverse_backfill),
    ]
