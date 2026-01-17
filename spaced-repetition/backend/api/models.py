from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime

# Create your models here.

class UserProfile(models.Model):
    """Extended user profile with profile picture"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

    def get_profile_picture_url(self):
        """Get profile picture URL or None"""
        if self.profile_picture:
            return self.profile_picture.url
        return None


class Topic(models.Model):
    SOURCE_TYPE_CHOICES = [
        ('manual', 'Manual Entry'),
        ('link', 'Web Link'),
        ('image', 'Image Upload'),
        ('document', 'Document Upload'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    content = models.TextField(default="")
    resource_url = models.URLField(max_length=500, blank=True, null=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default='manual')
    source_file = models.FileField(upload_to='topic_sources/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class RevisionSchedule(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='revisions')
    scheduled_date = models.DateField()
    completed = models.BooleanField(default=False)
    postponed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date']

    def __str__(self):
        return f"{self.topic.title} - {self.scheduled_date}"

    def postpone(self):
        """Postpone the revision by one day"""
        self.scheduled_date = self.scheduled_date + timezone.timedelta(days=1)
        self.postponed = True
        self.save()

    def complete(self):
        """Mark the revision as completed"""
        self.completed = True
        self.save()

    @staticmethod
    def create_schedule(topic, base_date=None):
        """Create a complete revision schedule for a new topic

        Args:
            topic: The Topic model instance
            base_date: The date from which to calculate revision dates (defaults to today)
        """
        # Spaced repetition intervals in days
        intervals = [1, 4, 9, 16, 25, 39, 60]

        # Use provided base_date or default to today
        if base_date is None:
            base_date = timezone.now().date()

        print(f"Creating revision schedule starting from: {base_date}")

        for interval in intervals:
            scheduled_date = base_date + timezone.timedelta(days=interval)
            RevisionSchedule.objects.create(
                topic=topic,
                scheduled_date=scheduled_date
            )


class FlashCard(models.Model):
    """Individual flashcard generated from a topic"""
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='flashcards')
    title = models.CharField(max_length=300)
    content = models.TextField()
    order = models.IntegerField(default=0)  # Order within the topic
    # Analytics fields for passive tracking
    times_reviewed = models.IntegerField(default=0)  # Count of completed reviews
    times_postponed = models.IntegerField(default=0)  # Count of postponements
    total_time_spent_seconds = models.IntegerField(default=0)  # Cumulative study time
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['topic', 'order']

    def __str__(self):
        return f"{self.topic.title} - Card {self.order}"

    def get_average_time_seconds(self):
        """Get average time spent per review for this card"""
        if self.times_reviewed > 0:
            return self.total_time_spent_seconds / self.times_reviewed
        return 0


class FlashCardRevisionSchedule(models.Model):
    """Revision schedule for individual flashcards"""
    flashcard = models.ForeignKey(FlashCard, on_delete=models.CASCADE, related_name='revisions')
    scheduled_date = models.DateField()
    completed = models.BooleanField(default=False)
    postponed = models.BooleanField(default=False)
    # Timing fields for passive tracking
    completed_at = models.DateTimeField(null=True, blank=True)  # When actually completed
    time_spent_seconds = models.IntegerField(null=True, blank=True)  # Auto-tracked per card
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date']

    def __str__(self):
        return f"{self.flashcard.title} - {self.scheduled_date}"

    def postpone(self):
        """Postpone the revision by one day and update flashcard analytics"""
        self.scheduled_date = self.scheduled_date + timezone.timedelta(days=1)
        self.postponed = True
        self.save()
        # Update flashcard analytics
        self.flashcard.times_postponed += 1
        self.flashcard.save()

    def complete(self, time_spent_seconds=None):
        """Mark the revision as completed and update flashcard analytics"""
        self.completed = True
        self.completed_at = timezone.now()
        if time_spent_seconds is not None:
            self.time_spent_seconds = time_spent_seconds
        self.save()
        # Update flashcard analytics
        self.flashcard.times_reviewed += 1
        if time_spent_seconds:
            self.flashcard.total_time_spent_seconds += time_spent_seconds
        self.flashcard.save()

    @staticmethod
    def create_schedule(flashcard, base_date=None):
        """Create a complete revision schedule for a flashcard

        Args:
            flashcard: The FlashCard model instance
            base_date: The date from which to calculate revision dates (defaults to today)
        """
        # Spaced repetition intervals in days
        intervals = [1, 4, 9, 16, 25, 39, 60]

        # Use provided base_date or default to today
        if base_date is None:
            base_date = timezone.now().date()

        for interval in intervals:
            scheduled_date = base_date + timezone.timedelta(days=interval)
            FlashCardRevisionSchedule.objects.create(
                flashcard=flashcard,
                scheduled_date=scheduled_date
            )


# ==========================================
# Gamification Models
# ==========================================

class UserStreak(models.Model):
    """Track user's study streak"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='streak')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    total_study_days = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.current_streak} days"

    def update_streak(self):
        """Update streak based on activity today"""
        today = timezone.now().date()

        if self.last_activity_date is None:
            # First activity ever
            self.current_streak = 1
            self.longest_streak = 1
            self.total_study_days = 1
            self.last_activity_date = today
        elif self.last_activity_date == today:
            # Already studied today, no change
            return
        elif self.last_activity_date == today - datetime.timedelta(days=1):
            # Consecutive day
            self.current_streak += 1
            self.total_study_days += 1
            self.last_activity_date = today
            if self.current_streak > self.longest_streak:
                self.longest_streak = self.current_streak
        else:
            # Streak broken
            self.current_streak = 1
            self.total_study_days += 1
            self.last_activity_date = today

        self.save()


class Achievement(models.Model):
    """Definition of achievements users can unlock"""
    CATEGORY_CHOICES = [
        ('milestone', 'Milestone'),
        ('streak', 'Streak'),
        ('consistency', 'Consistency'),
        ('efficiency', 'Efficiency'),
    ]

    TIER_CHOICES = [
        ('bronze', 'Bronze'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
        ('platinum', 'Platinum'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    icon = models.CharField(max_length=50)  # Bootstrap icon name (e.g., 'trophy', 'fire')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='bronze')
    requirement_type = models.CharField(max_length=50)  # 'topic_count', 'revision_count', 'streak_days'
    requirement_value = models.IntegerField()
    xp_reward = models.IntegerField(default=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'requirement_value']

    def __str__(self):
        return f"{self.name} ({self.tier})"


class UserAchievement(models.Model):
    """Track which achievements users have unlocked"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)
    notified = models.BooleanField(default=False)  # Whether user has been notified

    class Meta:
        unique_together = ('user', 'achievement')
        ordering = ['-unlocked_at']

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}"


class UserLevel(models.Model):
    """Track user's level and XP"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='level')
    current_level = models.IntegerField(default=1)
    total_xp = models.IntegerField(default=0)
    xp_to_next_level = models.IntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Level {self.current_level}"

    def award_xp(self, amount):
        """Award XP and check for level up"""
        self.total_xp += amount

        # Check for level up
        while self.total_xp >= self.xp_to_next_level:
            self.current_level += 1
            # Increase XP requirement for next level (progressive scaling)
            self.xp_to_next_level = int(self.xp_to_next_level * 1.5)

        self.save()
        return self.current_level

    def get_progress_to_next_level(self):
        """Get XP progress within current level"""
        # Calculate XP for current level
        previous_level_xp = self.xp_to_next_level / 1.5 if self.current_level > 1 else 0
        current_level_xp = self.total_xp - previous_level_xp
        xp_needed = self.xp_to_next_level - previous_level_xp

        return {
            'current_xp': int(current_level_xp),
            'xp_needed': int(xp_needed),
            'percentage': int((current_level_xp / xp_needed) * 100) if xp_needed > 0 else 0
        }


class DailyGoal(models.Model):
    """Track daily goals for users"""
    GOAL_TYPE_CHOICES = [
        ('complete_revisions', 'Complete Revisions'),
        ('create_topics', 'Create Topics'),
        ('maintain_streak', 'Maintain Streak'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_goals')
    date = models.DateField()
    goal_type = models.CharField(max_length=30, choices=GOAL_TYPE_CHOICES)
    target_value = models.IntegerField()
    current_value = models.IntegerField(default=0)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'date', 'goal_type')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.goal_type}"

    def update_progress(self, value=1):
        """Update goal progress"""
        self.current_value += value
        if self.current_value >= self.target_value:
            self.completed = True
        self.save()


# ==============================
# CREDIT SYSTEM MODELS
# ==============================

class UserCredit(models.Model):
    """Track user's AI generation credits"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='credits')
    available_credits = models.IntegerField(default=10)
    total_credits_earned = models.IntegerField(default=10)
    total_credits_used = models.IntegerField(default=0)
    unlimited_access = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.unlimited_access:
            return f"{self.user.username} - Unlimited"
        return f"{self.user.username} - {self.available_credits} credits"

    def has_credits(self):
        """Check if user has credits available"""
        return self.unlimited_access or self.available_credits > 0

    def deduct_credit(self):
        """Deduct 1 credit (thread-safe via atomic transaction in view)"""
        if self.unlimited_access:
            return True

        if self.available_credits > 0:
            self.available_credits -= 1
            self.total_credits_used += 1
            self.save()
            return True
        return False

    def add_credits(self, amount):
        """Add credits to user account"""
        self.available_credits += amount
        self.total_credits_earned += amount
        self.save()


class PromoCode(models.Model):
    """Promo codes for credit redemption"""
    TIER_CHOICES = [
        ('tier1', '+25 Credits'),
        ('tier2', '+50 Credits'),
        ('tier3', '+100 Credits'),
        ('unlimited', 'Unlimited Credits'),
    ]

    code = models.CharField(max_length=50, unique=True, db_index=True)
    code_hash = models.CharField(max_length=128, unique=True)  # SHA256 hash
    tier = models.CharField(max_length=20, choices=TIER_CHOICES)
    credits_granted = models.IntegerField()  # 25, 50, 100, or 0 (unlimited)
    grants_unlimited = models.BooleanField(default=False)
    max_redemptions = models.IntegerField(default=1)  # How many users can use this code
    times_redeemed = models.IntegerField(default=0)
    active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} ({self.get_tier_display()})"

    def is_valid(self):
        """Check if promo code is still valid"""
        if not self.active:
            return False, "This promo code has been deactivated"
        if self.times_redeemed >= self.max_redemptions:
            return False, "This promo code has reached its redemption limit"
        if self.expires_at and timezone.now() > self.expires_at:
            return False, "This promo code has expired"
        return True, ""


class PromoCodeRedemption(models.Model):
    """Track promo code redemptions (audit trail)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='promo_redemptions')
    promo_code = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name='redemptions')
    credits_granted = models.IntegerField()
    unlimited_granted = models.BooleanField(default=False)
    redeemed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'promo_code')  # One code per user
        ordering = ['-redeemed_at']

    def __str__(self):
        return f"{self.user.username} redeemed {self.promo_code.code}"


class CreditUsageLog(models.Model):
    """Audit log for all credit changes"""
    ACTION_CHOICES = [
        ('initial', 'Initial Credits'),
        ('promo', 'Promo Code Redemption'),
        ('deduct', 'AI Generation Used'),
        ('admin_add', 'Admin Added Credits'),
        ('admin_remove', 'Admin Removed Credits'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    credits_changed = models.IntegerField()  # Positive for add, negative for deduct
    credits_after = models.IntegerField()
    unlimited_before = models.BooleanField(default=False)
    unlimited_after = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    topic_id = models.IntegerField(null=True, blank=True)  # If related to topic creation
    promo_code_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.get_action_display()} ({self.credits_changed:+d})"


# ==============================
# STUDY SESSION TRACKING
# ==============================

class StudySession(models.Model):
    """Track complete study sessions automatically for analytics"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_sessions')
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    cards_reviewed = models.IntegerField(default=0)  # Cards marked as "Got it"
    cards_postponed = models.IntegerField(default=0)  # Cards marked as "Review Later"
    total_time_seconds = models.IntegerField(default=0)  # Total session duration
    is_active = models.BooleanField(default=True)  # Whether session is still in progress

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.username} - {self.started_at.strftime('%Y-%m-%d %H:%M')}"

    def end_session(self):
        """End the study session and calculate total time"""
        self.ended_at = timezone.now()
        self.is_active = False
        if self.started_at:
            duration = self.ended_at - self.started_at
            self.total_time_seconds = int(duration.total_seconds())
        self.save()

    def add_reviewed_card(self, time_spent_seconds=0):
        """Increment reviewed card count"""
        self.cards_reviewed += 1
        self.total_time_seconds += time_spent_seconds
        self.save()

    def add_postponed_card(self, time_spent_seconds=0):
        """Increment postponed card count"""
        self.cards_postponed += 1
        self.total_time_seconds += time_spent_seconds
        self.save()

    @property
    def completion_rate(self):
        """Calculate completion rate (reviewed / total)"""
        total = self.cards_reviewed + self.cards_postponed
        if total > 0:
            return round((self.cards_reviewed / total) * 100, 1)
        return 0

    @classmethod
    def get_or_create_active_session(cls, user):
        """Get active session or create new one"""
        # Check for recent active session (within last 30 minutes)
        thirty_minutes_ago = timezone.now() - datetime.timedelta(minutes=30)
        active_session = cls.objects.filter(
            user=user,
            is_active=True,
            started_at__gte=thirty_minutes_ago
        ).first()

        if active_session:
            return active_session, False

        # End any stale active sessions
        cls.objects.filter(user=user, is_active=True).update(
            is_active=False,
            ended_at=timezone.now()
        )

        # Create new session
        return cls.objects.create(user=user), True


# ==============================
# SIGNALS
# ==============================

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create UserProfile when a new User is created"""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Ensure UserProfile exists and save it"""
    if not hasattr(instance, 'profile'):
        UserProfile.objects.create(user=instance)
    else:
        instance.profile.save()

