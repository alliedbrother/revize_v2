"""
Database cleanup script for revision schedules.
Run with: python3 manage.py shell < cleanup_revision_schedules.py
"""

from api.models import Topic, FlashCard, RevisionSchedule

# Find all topics that have flashcards
topics_with_flashcards = set(
    FlashCard.objects.values_list('topic_id', flat=True).distinct()
)

print(f"Found {len(topics_with_flashcards)} topics with flashcards")

# Delete TopicRevisionSchedules for topics that have flashcards
deleted_count = RevisionSchedule.objects.filter(
    topic_id__in=topics_with_flashcards
).delete()[0]

print(f"Deleted {deleted_count} orphaned TopicRevisionSchedules")
print("Cleanup complete!")
