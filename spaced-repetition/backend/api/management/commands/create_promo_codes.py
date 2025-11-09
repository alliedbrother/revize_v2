"""
Django management command to create initial promo codes
Usage: python manage.py create_promo_codes
"""
from django.core.management.base import BaseCommand
from api.models import PromoCode
import hashlib


class Command(BaseCommand):
    help = 'Creates initial promo codes for the credit system'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('\nCreating promo codes...\n'))

        promo_codes_data = [
            {
                'code': 'WELCOME25',
                'tier': 'tier1',
                'credits_granted': 25,
                'grants_unlimited': False,
                'max_redemptions': 100,  # Can be used by 100 users
                'description': '+25 Credits - Welcome bonus'
            },
            {
                'code': 'image.png',
                'tier': 'tier2',
                'credits_granted': 50,
                'grants_unlimited': False,
                'max_redemptions': 50,  # Can be used by 50 users
                'description': '+50 Credits - Power user bonus'
            },
            {
                'code': 'PREMIUM100',
                'tier': 'tier3',
                'credits_granted': 100,
                'grants_unlimited': False,
                'max_redemptions': 20,  # Can be used by 20 users
                'description': '+100 Credits - Premium access'
            },
            {
                'code': 'UNLIMITED2024',
                'tier': 'unlimited',
                'credits_granted': 0,  # Unused when unlimited is granted
                'grants_unlimited': True,
                'max_redemptions': 10,  # Can be used by 10 users
                'description': 'Unlimited Credits - VIP access'
            },
        ]

        created_count = 0
        skipped_count = 0

        for code_data in promo_codes_data:
            code = code_data['code']
            code_hash = hashlib.sha256(code.encode()).hexdigest()

            # Check if promo code already exists
            exists = PromoCode.objects.filter(code=code).exists()

            if exists:
                self.stdout.write(
                    f"   ⏭️  Skipped: {code} ({code_data['description']})"
                )
                skipped_count += 1
            else:
                PromoCode.objects.create(
                    code=code,
                    code_hash=code_hash,
                    tier=code_data['tier'],
                    credits_granted=code_data['credits_granted'],
                    grants_unlimited=code_data['grants_unlimited'],
                    max_redemptions=code_data['max_redemptions'],
                    active=True
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"   ✅ Created: {code} ({code_data['description']})"
                    )
                )
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(f'\n✨ Promo code creation complete!')
        )
        self.stdout.write(f'   • {created_count} promo codes created')
        self.stdout.write(f'   • {skipped_count} promo codes skipped')
        self.stdout.write(f'   • {PromoCode.objects.count()} total promo codes\n')

        # Display the promo codes for reference
        if created_count > 0:
            self.stdout.write(self.style.SUCCESS('\n📋 Active Promo Codes:'))
            for promo in PromoCode.objects.filter(active=True).order_by('tier'):
                if promo.grants_unlimited:
                    benefit = 'UNLIMITED CREDITS'
                else:
                    benefit = f'+{promo.credits_granted} credits'

                usage = f'{promo.times_redeemed}/{promo.max_redemptions}'
                self.stdout.write(
                    f'   • {promo.code:15} | {benefit:20} | Used: {usage}'
                )
            self.stdout.write('')
