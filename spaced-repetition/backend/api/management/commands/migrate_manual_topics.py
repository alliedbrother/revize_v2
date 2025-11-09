"""
Django management command to migrate manual topics to have flashcards.

This command finds all manual topics that don't have flashcards and creates:
1. A FlashCard for each topic (using the topic's title and content)
2. FlashCardRevisionSchedule entries for each flashcard

Usage:
    python manage.py migrate_manual_topics
    python manage.py migrate_manual_topics --dry-run  # See what would be migrated without making changes
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Topic, FlashCard, FlashCardRevisionSchedule, RevisionSchedule


class Command(BaseCommand):
    help = 'Migrates manual topics without flashcards to have flashcards'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Find all manual topics that don't have flashcards
        manual_topics_without_flashcards = Topic.objects.filter(
            source_type='manual'
        ).exclude(
            id__in=FlashCard.objects.values_list('topic_id', flat=True)
        )

        total_topics = manual_topics_without_flashcards.count()

        if total_topics == 0:
            self.stdout.write(
                self.style.SUCCESS('\n✅ No manual topics need migration. All manual topics already have flashcards!')
            )
            return

        # Display summary
        self.stdout.write(
            self.style.WARNING(f'\n📋 Found {total_topics} manual topics without flashcards:\n')
        )

        for topic in manual_topics_without_flashcards:
            self.stdout.write(
                f'   • Topic ID {topic.id}: "{topic.title}" (created: {topic.created_at.strftime("%Y-%m-%d")})'
            )

        if dry_run:
            self.stdout.write(
                self.style.WARNING('\n🔍 DRY RUN MODE - No changes will be made\n')
            )
            self.stdout.write(
                'Each topic will get:\n'
                '   • 1 flashcard (using topic title and content)\n'
                '   • 7 revision schedule entries (days: 1, 4, 9, 16, 25, 39, 60)\n'
            )
            return

        # Confirm before proceeding
        self.stdout.write(
            self.style.WARNING('\n⚠️  This will create flashcards and revision schedules for these topics.')
        )
        confirm = input('Do you want to continue? (yes/no): ')

        if confirm.lower() != 'yes':
            self.stdout.write(self.style.ERROR('\n❌ Migration cancelled.\n'))
            return

        # Perform migration
        self.stdout.write(
            self.style.SUCCESS('\n🔄 Starting migration...\n')
        )

        flashcards_created = 0
        schedules_created = 0
        topics_with_old_schedules = []

        for topic in manual_topics_without_flashcards:
            # Create flashcard for the topic
            flashcard = FlashCard.objects.create(
                topic=topic,
                title=topic.title,
                content=topic.content,
                order=1
            )
            flashcards_created += 1

            # Create flashcard revision schedule
            FlashCardRevisionSchedule.create_schedule(flashcard)
            schedules_created += 7  # create_schedule creates 7 revisions

            # Check if topic has old RevisionSchedule entries
            old_schedules = RevisionSchedule.objects.filter(topic=topic)
            if old_schedules.exists():
                topics_with_old_schedules.append({
                    'topic': topic,
                    'old_schedule_count': old_schedules.count()
                })

            self.stdout.write(
                f'   ✅ Created flashcard for Topic ID {topic.id}: "{topic.title}"'
            )

        # Summary
        self.stdout.write(
            self.style.SUCCESS(f'\n✨ Migration complete!\n')
        )
        self.stdout.write(f'   • {flashcards_created} flashcards created')
        self.stdout.write(f'   • {schedules_created} revision schedules created')

        # Handle old topic revision schedules
        if topics_with_old_schedules:
            self.stdout.write(
                self.style.WARNING(f'\n⚠️  {len(topics_with_old_schedules)} topics have old TopicRevisionSchedule entries:')
            )
            for item in topics_with_old_schedules:
                self.stdout.write(
                    f'   • Topic ID {item["topic"].id}: {item["old_schedule_count"]} old schedule(s)'
                )

            self.stdout.write(
                '\n📝 Note: These old TopicRevisionSchedule entries are now redundant because the topics\n'
                '   have flashcards. They will be ignored by the system (topics with flashcards are\n'
                '   reviewed through flashcards only).\n'
            )

            delete_old = input('Do you want to delete these old TopicRevisionSchedule entries? (yes/no): ')

            if delete_old.lower() == 'yes':
                total_deleted = 0
                for item in topics_with_old_schedules:
                    deleted_count = RevisionSchedule.objects.filter(topic=item['topic']).delete()[0]
                    total_deleted += deleted_count

                self.stdout.write(
                    self.style.SUCCESS(f'\n🗑️  Deleted {total_deleted} old TopicRevisionSchedule entries\n')
                )
            else:
                self.stdout.write(
                    self.style.WARNING('\n⏭️  Keeping old TopicRevisionSchedule entries (they will be ignored)\n')
                )

        self.stdout.write(
            self.style.SUCCESS('🎉 All manual topics now have flashcards and will appear on the homepage!\n')
        )
