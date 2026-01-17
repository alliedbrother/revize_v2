from rest_framework import serializers
from .models import (
    Topic, RevisionSchedule, FlashCard, FlashCardRevisionSchedule,
    UserStreak, Achievement, UserAchievement, UserLevel, DailyGoal,
    UserCredit, PromoCode, PromoCodeRedemption, CreditUsageLog,
    StudySession
)
from django.contrib.auth.models import User
import datetime
import validators

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'profile_picture', 'password', 'password_confirm')
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
            'password': {'write_only': True, 'required': False},
            'password_confirm': {'write_only': True, 'required': False}
        }

    def get_profile_picture(self, obj):
        """Get profile picture URL from UserProfile"""
        if hasattr(obj, 'profile') and obj.profile.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile.profile_picture.url)
            return obj.profile.profile_picture.url
        return None

    def validate(self, attrs):
        # Only validate passwords if this is a creation operation
        if 'password' in attrs and 'password_confirm' in attrs:
            if attrs['password'] != attrs['password_confirm']:
                raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        # Remove password_confirm as it's not needed for user creation
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password', None)

        # Create the user without password first
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )

        # Set the password if provided
        if password:
            user.set_password(password)
            user.save()

        return user
        
    def update(self, instance, validated_data):
        # Remove password fields from update operation
        validated_data.pop('password', None)
        validated_data.pop('password_confirm', None)

        # Update other fields
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        return instance

class RevisionScheduleSimpleSerializer(serializers.ModelSerializer):
    day_number = serializers.SerializerMethodField()

    class Meta:
        model = RevisionSchedule
        fields = ['id', 'scheduled_date', 'completed', 'postponed', 'day_number']
        read_only_fields = ['completed', 'postponed']

    def get_day_number(self, obj):
        # Get all revisions for this topic, ordered by scheduled date
        revisions = RevisionSchedule.objects.filter(
            topic=obj.topic
        ).order_by('scheduled_date')
        # Find the position of the current revision in the ordered list
        for i, revision in enumerate(revisions):
            if revision.id == obj.id:
                return i + 1  # Add 1 to make it 1-indexed instead of 0-indexed
        return None

class TopicSerializer(serializers.ModelSerializer):
    revisions = serializers.SerializerMethodField()
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Topic
        fields = (
            'id', 'title', 'content', 'resource_url', 'user',
            'revisions', 'created_at', 'updated_at', 'source_type'
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_revisions(self, obj):
        """
        Return flashcard revisions if topic has flashcards,
        otherwise return topic revisions
        """
        from .models import FlashCard, FlashCardRevisionSchedule

        # Check if topic has flashcards
        flashcards = FlashCard.objects.filter(topic=obj)

        if flashcards.exists():
            # Return flashcard revision schedules
            flashcard_revisions = FlashCardRevisionSchedule.objects.filter(
                flashcard__topic=obj
            ).order_by('scheduled_date')
            return FlashCardRevisionScheduleSerializer(flashcard_revisions, many=True).data
        else:
            # Return topic revision schedules
            return RevisionScheduleSimpleSerializer(obj.revisions, many=True).data

class TopicCreateSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    initial_revision_date = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = Topic
        fields = ('id', 'title', 'content', 'resource_url', 'user', 'initial_revision_date')

    def validate(self, attrs):
        """Validate manual topics have sufficient content for AI generation"""
        # Check if this is a manual topic (source_type defaults to 'manual' if not specified)
        source_type = attrs.get('source_type', 'manual')

        if source_type == 'manual':
            title = attrs.get('title', '').strip()
            content = attrs.get('content', '').strip()

            # Both title and content are required for manual topics
            if not title:
                raise serializers.ValidationError({
                    'title': 'Title is required for manual topics'
                })

            if not content:
                raise serializers.ValidationError({
                    'content': 'Content/description is required for manual topics to generate flashcards'
                })

            # Minimum content length to ensure AI has enough context for detailed flashcards
            if len(content) < 8:
                raise serializers.ValidationError({
                    'content': 'Please provide more detailed content (at least 50 characters) to generate comprehensive, high-quality flashcards. Include key concepts, definitions, examples, and explanations.'
                })

        return attrs

    def create(self, validated_data):
        # Extract initial_revision_date but keep it in validated_data
        # so TopicViewSet.perform_create() can access it
        initial_revision_date = validated_data.get('initial_revision_date')
        if initial_revision_date:
            print(f"[TopicCreateSerializer] USING PROVIDED DATE: {initial_revision_date}")

        # Remove initial_revision_date before creating the topic
        if 'initial_revision_date' in validated_data:
            validated_data.pop('initial_revision_date')

        # Just create the topic - DON'T create any schedules here
        # TopicViewSet.perform_create() will handle schedule creation:
        # - For manual topics: creates FlashCard + FlashCardRevisionSchedule
        # - For other topics: creates TopicRevisionSchedule
        topic = Topic.objects.create(**validated_data)

        return topic

class RevisionScheduleSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)
    day_number = serializers.SerializerMethodField()

    class Meta:
        model = RevisionSchedule
        fields = ['id', 'topic', 'scheduled_date', 'completed', 'postponed', 'day_number']
        read_only_fields = ['completed', 'postponed']

    def get_day_number(self, obj):
        # Get all revisions for this topic, ordered by scheduled date
        revisions = RevisionSchedule.objects.filter(
            topic=obj.topic
        ).order_by('scheduled_date')
        # Find the position of the current revision in the ordered list
        for i, revision in enumerate(revisions):
            if revision.id == obj.id:
                return i + 1  # Add 1 to make it 1-indexed instead of 0-indexed
        return None


# FlashCard Serializers

class FlashCardRevisionScheduleSimpleSerializer(serializers.ModelSerializer):
    """Simple serializer for flashcard revision schedules (without nested data)"""
    day_number = serializers.SerializerMethodField()

    class Meta:
        model = FlashCardRevisionSchedule
        fields = ['id', 'scheduled_date', 'completed', 'postponed', 'day_number', 'completed_at', 'time_spent_seconds']
        read_only_fields = ['completed', 'postponed', 'completed_at', 'time_spent_seconds']

    def get_day_number(self, obj):
        # Get all revisions for this flashcard, ordered by scheduled date
        revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard=obj.flashcard
        ).order_by('scheduled_date')
        for i, revision in enumerate(revisions):
            if revision.id == obj.id:
                return i + 1
        return None


class FlashCardSerializer(serializers.ModelSerializer):
    """Serializer for FlashCard with nested revisions"""
    revisions = FlashCardRevisionScheduleSimpleSerializer(many=True, read_only=True)
    average_time_seconds = serializers.SerializerMethodField()

    class Meta:
        model = FlashCard
        fields = [
            'id', 'topic', 'title', 'content', 'order', 'revisions',
            'times_reviewed', 'times_postponed', 'total_time_spent_seconds',
            'average_time_seconds', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'times_reviewed', 'times_postponed', 'total_time_spent_seconds']

    def get_average_time_seconds(self, obj):
        """Get average time spent per review"""
        return obj.get_average_time_seconds()


class FlashCardRevisionScheduleSerializer(serializers.ModelSerializer):
    """Full serializer for flashcard revision schedules with nested flashcard"""
    flashcard = FlashCardSerializer(read_only=True)
    day_number = serializers.SerializerMethodField()

    class Meta:
        model = FlashCardRevisionSchedule
        fields = ['id', 'flashcard', 'scheduled_date', 'completed', 'postponed', 'day_number', 'completed_at', 'time_spent_seconds']
        read_only_fields = ['completed', 'postponed', 'completed_at', 'time_spent_seconds']

    def get_day_number(self, obj):
        revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard=obj.flashcard
        ).order_by('scheduled_date')
        for i, revision in enumerate(revisions):
            if revision.id == obj.id:
                return i + 1
        return None


class TopicWithFlashcardsSerializer(serializers.ModelSerializer):
    """Topic serializer that includes flashcards"""
    revisions = serializers.SerializerMethodField()
    flashcards = FlashCardSerializer(many=True, read_only=True)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Topic
        fields = (
            'id', 'title', 'content', 'resource_url', 'source_type',
            'source_file', 'user', 'revisions', 'flashcards',
            'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_revisions(self, obj):
        """
        Return flashcard revisions if topic has flashcards,
        otherwise return topic revisions
        """
        from .models import FlashCard, FlashCardRevisionSchedule

        # Check if topic has flashcards
        flashcards = FlashCard.objects.filter(topic=obj)

        if flashcards.exists():
            # Return flashcard revision schedules
            flashcard_revisions = FlashCardRevisionSchedule.objects.filter(
                flashcard__topic=obj
            ).order_by('scheduled_date')
            return FlashCardRevisionScheduleSerializer(flashcard_revisions, many=True).data
        else:
            # Return topic revision schedules
            return RevisionScheduleSimpleSerializer(obj.revisions, many=True).data


class DocumentUploadSerializer(serializers.Serializer):
    """Serializer for document upload and flashcard generation"""
    document = serializers.FileField(required=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    initial_revision_date = serializers.DateField(required=False)

    def validate_document(self, value):
        """Validate the uploaded document"""
        # Check file size (max 2MB)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Document size should not exceed 2MB")

        # Check file extension
        file_extension = value.name.split('.')[-1].lower()
        if file_extension not in ['pdf', 'doc', 'docx']:
            raise serializers.ValidationError("Only PDF and Word documents are supported")

        return value


class ImageUploadSerializer(serializers.Serializer):
    """Serializer for image upload and flashcard generation"""
    images = serializers.ListField(
        child=serializers.ImageField(),
        max_length=10,
        min_length=1,
        required=True
    )
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    initial_revision_date = serializers.DateField(required=False)

    def validate_images(self, value):
        """Validate the uploaded images"""
        if not value or len(value) == 0:
            raise serializers.ValidationError("At least one image is required")

        if len(value) > 10:
            raise serializers.ValidationError("Maximum 10 images allowed")

        for idx, img in enumerate(value):
            # Check file size (max 5MB per image)
            if img.size > 5 * 1024 * 1024:
                raise serializers.ValidationError(
                    f"Image {idx + 1} ({img.name}) exceeds 5MB limit"
                )

            # Check file format
            valid_content_types = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
            if img.content_type and img.content_type.lower() not in valid_content_types:
                raise serializers.ValidationError(
                    f"Image {idx + 1} ({img.name}) must be JPG, PNG, or WEBP format"
                )

        return value


class LinkUploadSerializer(serializers.Serializer):
    """Serializer for web link upload and flashcard generation"""
    url = serializers.CharField(required=True, max_length=2048)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    initial_revision_date = serializers.DateField(required=False)

    def validate_url(self, value):
        """Validate the URL"""
        if not value or not value.strip():
            raise serializers.ValidationError("URL is required")

        url = value.strip()

        # Basic URL validation using validators library
        if not validators.url(url):
            raise serializers.ValidationError(
                "Invalid URL format. Please provide a valid web address (e.g., https://example.com)"
            )

        # Check URL scheme (must be http or https)
        if not url.startswith(('http://', 'https://')):
            raise serializers.ValidationError(
                "URL must start with http:// or https://"
            )

        # Check URL length
        if len(url) > 2048:
            raise serializers.ValidationError(
                "URL is too long (maximum 2048 characters)"
            )

        # Blacklist certain domains (spam, malware, etc.)
        blacklisted_domains = [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            'file://',
        ]

        url_lower = url.lower()
        for domain in blacklisted_domains:
            if domain in url_lower:
                raise serializers.ValidationError(
                    f"URLs from '{domain}' are not allowed"
                )

        return url


# ==========================================
# Gamification Serializers
# ==========================================

class UserStreakSerializer(serializers.ModelSerializer):
    """Serializer for user streak tracking"""

    class Meta:
        model = UserStreak
        fields = [
            'id', 'current_streak', 'longest_streak',
            'last_activity_date', 'total_study_days',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'current_streak', 'longest_streak',
            'last_activity_date', 'total_study_days',
            'created_at', 'updated_at'
        ]


class AchievementSerializer(serializers.ModelSerializer):
    """Serializer for achievement definitions"""

    class Meta:
        model = Achievement
        fields = [
            'id', 'name', 'description', 'icon', 'category',
            'tier', 'requirement_type', 'requirement_value',
            'xp_reward', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserAchievementSerializer(serializers.ModelSerializer):
    """Serializer for user's unlocked achievements"""
    achievement = AchievementSerializer(read_only=True)

    class Meta:
        model = UserAchievement
        fields = [
            'id', 'achievement', 'unlocked_at', 'notified'
        ]
        read_only_fields = ['id', 'unlocked_at']


class UserLevelSerializer(serializers.ModelSerializer):
    """Serializer for user level and XP"""
    progress = serializers.SerializerMethodField()

    class Meta:
        model = UserLevel
        fields = [
            'id', 'current_level', 'total_xp', 'xp_to_next_level',
            'progress', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'current_level', 'total_xp', 'xp_to_next_level',
            'progress', 'created_at', 'updated_at'
        ]

    def get_progress(self, obj):
        """Get XP progress to next level"""
        return obj.get_progress_to_next_level()


class DailyGoalSerializer(serializers.ModelSerializer):
    """Serializer for daily goals"""
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = DailyGoal
        fields = [
            'id', 'date', 'goal_type', 'target_value',
            'current_value', 'completed', 'progress_percentage',
            'created_at'
        ]
        read_only_fields = ['id', 'completed', 'created_at']

    def get_progress_percentage(self, obj):
        """Calculate progress percentage"""
        if obj.target_value > 0:
            return min(int((obj.current_value / obj.target_value) * 100), 100)
        return 0


class GamificationStatsSerializer(serializers.Serializer):
    """Serializer for comprehensive gamification statistics"""
    streak = UserStreakSerializer()
    level = UserLevelSerializer()
    recent_achievements = UserAchievementSerializer(many=True)
    total_achievements = serializers.IntegerField()
    available_achievements = serializers.IntegerField()
    daily_goals = DailyGoalSerializer(many=True)
    goals_completed_today = serializers.IntegerField()
    xp_earned_today = serializers.IntegerField()


# ==============================
# CREDIT SYSTEM SERIALIZERS
# ==============================

class UserCreditSerializer(serializers.ModelSerializer):
    """Serializer for user credit balance"""
    class Meta:
        model = UserCredit
        fields = ['available_credits', 'total_credits_earned', 'total_credits_used', 'unlimited_access']
        read_only_fields = ['total_credits_earned', 'total_credits_used']


class PromoCodeRedeemSerializer(serializers.Serializer):
    """Serializer for promo code redemption input"""
    promo_code = serializers.CharField(
        max_length=50,
        required=True,
        help_text='Promo code to redeem'
    )

    def validate_promo_code(self, value):
        """Sanitize and validate promo code input"""
        # Strip whitespace and convert to uppercase
        code = value.strip().upper()

        # Validate format (alphanumeric and hyphens only)
        if not all(c.isalnum() or c == '-' for c in code):
            raise serializers.ValidationError("Promo code can only contain letters, numbers, and hyphens")

        # Length validation
        if len(code) < 3:
            raise serializers.ValidationError("Promo code is too short")
        if len(code) > 50:
            raise serializers.ValidationError("Promo code is too long")

        return code


class CreditUsageLogSerializer(serializers.ModelSerializer):
    """Serializer for credit usage history"""
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = CreditUsageLog
        fields = [
            'action',
            'action_display',
            'credits_changed',
            'credits_after',
            'unlimited_before',
            'unlimited_after',
            'description',
            'topic_id',
            'created_at'
        ]
        read_only_fields = fields


class PromoCodeRedemptionSerializer(serializers.ModelSerializer):
    """Serializer for promo code redemption history"""
    promo_code_text = serializers.CharField(source='promo_code.code', read_only=True)
    tier = serializers.CharField(source='promo_code.get_tier_display', read_only=True)

    class Meta:
        model = PromoCodeRedemption
        fields = [
            'promo_code_text',
            'tier',
            'credits_granted',
            'unlimited_granted',
            'redeemed_at'
        ]
        read_only_fields = fields


class ProfilePictureUploadSerializer(serializers.Serializer):
    """Serializer for profile picture upload"""
    profile_picture = serializers.ImageField(required=True)

    def validate_profile_picture(self, value):
        """Validate the uploaded profile picture"""
        # Check file size (max 2MB)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Profile picture must be less than 2MB")

        # Check file format
        valid_content_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        if value.content_type and value.content_type.lower() not in valid_content_types:
            raise serializers.ValidationError("Profile picture must be JPG, PNG, or WEBP format")

        return value


# ==============================
# STUDY ANALYTICS SERIALIZERS
# ==============================

class StudySessionSerializer(serializers.ModelSerializer):
    """Serializer for study sessions"""
    completion_rate = serializers.ReadOnlyField()
    duration_formatted = serializers.SerializerMethodField()

    class Meta:
        model = StudySession
        fields = [
            'id', 'started_at', 'ended_at', 'cards_reviewed', 'cards_postponed',
            'total_time_seconds', 'is_active', 'completion_rate', 'duration_formatted'
        ]
        read_only_fields = fields

    def get_duration_formatted(self, obj):
        """Format duration as human readable string"""
        seconds = obj.total_time_seconds
        if seconds < 60:
            return f"{seconds}s"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes}m"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}h {minutes}m"


class StudyStatsSerializer(serializers.Serializer):
    """Serializer for comprehensive study statistics"""
    # Time-based stats
    study_time_today_seconds = serializers.IntegerField()
    study_time_today_formatted = serializers.CharField()
    study_time_week_seconds = serializers.IntegerField()
    study_time_week_formatted = serializers.CharField()
    avg_session_length_seconds = serializers.IntegerField()
    avg_session_length_formatted = serializers.CharField()
    avg_time_per_card_seconds = serializers.FloatField()

    # Card-based stats
    cards_reviewed_today = serializers.IntegerField()
    cards_postponed_today = serializers.IntegerField()
    cards_reviewed_week = serializers.IntegerField()
    cards_postponed_week = serializers.IntegerField()
    total_cards_reviewed = serializers.IntegerField()
    total_cards_postponed = serializers.IntegerField()

    # Completion rate
    completion_rate_today = serializers.FloatField()
    completion_rate_week = serializers.FloatField()
    completion_rate_all_time = serializers.FloatField()

    # Weekly heatmap data (activity by day)
    weekly_activity = serializers.ListField()

    # Cards needing attention (frequently postponed)
    needs_attention_cards = serializers.ListField()

    # Recent sessions
    recent_sessions = StudySessionSerializer(many=True)


class NeedsAttentionCardSerializer(serializers.Serializer):
    """Serializer for cards that need attention"""
    id = serializers.IntegerField()
    title = serializers.CharField()
    topic_title = serializers.CharField()
    times_postponed = serializers.IntegerField()
    times_reviewed = serializers.IntegerField()
    postpone_rate = serializers.FloatField()
