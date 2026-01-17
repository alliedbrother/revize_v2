"""
Django management command to create initial promo codes
Usage: python manage.py create_promo_codes

Promo codes are read from environment variables in .env file.
Format: PROMO_CODE_N="CODE:TIER:CREDITS:UNLIMITED:MAX_REDEMPTIONS:DESCRIPTION"
"""
from django.core.management.base import BaseCommand
from api.models import PromoCode
import hashlib
import os


class Command(BaseCommand):
    help = 'Creates initial promo codes for the credit system (reads from .env)'

    def parse_promo_code_env(self, env_value):
        """
        Parse promo code from environment variable.
        Format: CODE:TIER:CREDITS:UNLIMITED:MAX_REDEMPTIONS:DESCRIPTION
        """
        try:
            parts = env_value.split(':')
            if len(parts) >= 6:
                return {
                    'code': parts[0],
                    'tier': parts[1],
                    'credits_granted': int(parts[2]),
                    'grants_unlimited': parts[3].lower() == 'true',
                    'max_redemptions': int(parts[4]),
                    'description': ':'.join(parts[5:])  # Description may contain colons
                }
        except (ValueError, IndexError) as e:
            self.stdout.write(self.style.ERROR(f"   ❌ Error parsing promo code: {env_value} - {e}"))
        return None

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('\nCreating promo codes from environment variables...\n'))

        # Read promo codes from environment variables
        promo_codes_data = []
        i = 1
        while True:
            env_key = f'PROMO_CODE_{i}'
            env_value = os.environ.get(env_key)
            if not env_value:
                break

            promo_data = self.parse_promo_code_env(env_value)
            if promo_data:
                promo_codes_data.append(promo_data)
                self.stdout.write(f"   📋 Loaded: {promo_data['code']} from {env_key}")
            i += 1

        if not promo_codes_data:
            self.stdout.write(self.style.WARNING(
                '\n⚠️  No promo codes found in environment variables.\n'
                '   Add PROMO_CODE_1, PROMO_CODE_2, etc. to your .env file.\n'
                '   Format: CODE:TIER:CREDITS:UNLIMITED:MAX_REDEMPTIONS:DESCRIPTION\n'
            ))
            return

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
