"""
Django management command to seed initial achievements
Usage: python manage.py seed_achievements
"""
from django.core.management.base import BaseCommand
from api.models import Achievement


class Command(BaseCommand):
    help = 'Seeds initial achievements into the database'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('\nSeeding achievements...\n'))

        achievements_data = [
            # Topic Achievements
            {
                'name': 'First Steps',
                'description': 'Create your first learning topic',
                'icon': '🌱',
                'category': 'topics',
                'tier': 'bronze',
                'requirement_type': 'topic_count',
                'requirement_value': 1,
                'xp_reward': 50
            },
            {
                'name': 'Knowledge Seeker',
                'description': 'Create 10 learning topics',
                'icon': '📚',
                'category': 'topics',
                'tier': 'silver',
                'requirement_type': 'topic_count',
                'requirement_value': 10,
                'xp_reward': 150
            },
            {
                'name': 'Learning Master',
                'description': 'Create 50 learning topics',
                'icon': '🎓',
                'category': 'topics',
                'tier': 'gold',
                'requirement_type': 'topic_count',
                'requirement_value': 50,
                'xp_reward': 500
            },
            # Revision Achievements
            {
                'name': 'First Review',
                'description': 'Complete your first revision',
                'icon': '✅',
                'category': 'revisions',
                'tier': 'bronze',
                'requirement_type': 'revision_count',
                'requirement_value': 1,
                'xp_reward': 50
            },
            {
                'name': 'Review Warrior',
                'description': 'Complete 10 revisions',
                'icon': '⚔️',
                'category': 'revisions',
                'tier': 'silver',
                'requirement_type': 'revision_count',
                'requirement_value': 10,
                'xp_reward': 150
            },
            {
                'name': 'Revision Legend',
                'description': 'Complete 100 revisions',
                'icon': '👑',
                'category': 'revisions',
                'tier': 'gold',
                'requirement_type': 'revision_count',
                'requirement_value': 100,
                'xp_reward': 500
            },
            # Streak Achievements
            {
                'name': 'Week Warrior',
                'description': 'Maintain a 7-day study streak',
                'icon': '🔥',
                'category': 'streak',
                'tier': 'bronze',
                'requirement_type': 'streak_days',
                'requirement_value': 7,
                'xp_reward': 100
            },
            {
                'name': 'Month Master',
                'description': 'Maintain a 30-day study streak',
                'icon': '🌟',
                'category': 'streak',
                'tier': 'silver',
                'requirement_type': 'streak_days',
                'requirement_value': 30,
                'xp_reward': 300
            },
            {
                'name': 'Streak Legend',
                'description': 'Maintain a 100-day study streak',
                'icon': '💎',
                'category': 'streak',
                'tier': 'gold',
                'requirement_type': 'streak_days',
                'requirement_value': 100,
                'xp_reward': 1000
            },
        ]

        created_count = 0
        skipped_count = 0

        for achievement_data in achievements_data:
            exists = Achievement.objects.filter(
                name=achievement_data['name']
            ).exists()

            if exists:
                self.stdout.write(
                    f"   ⏭️  Skipped: {achievement_data['icon']} {achievement_data['name']}"
                )
                skipped_count += 1
            else:
                Achievement.objects.create(**achievement_data)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"   ✅ Created: {achievement_data['icon']} {achievement_data['name']}"
                    )
                )
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(f'\n✨ Seeding complete!')
        )
        self.stdout.write(f'   • {created_count} achievements created')
        self.stdout.write(f'   • {skipped_count} achievements skipped')
        self.stdout.write(f'   • {Achievement.objects.count()} total achievements\n')
