from rest_framework import serializers
from .models import Topic, RevisionSchedule, FlashCard, FlashCardRevisionSchedule
from django.contrib.auth.models import User
import datetime

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'password_confirm')
        extra_kwargs = {
            'email': {'required': True},
            'password': {'write_only': True, 'required': False},
            'password_confirm': {'write_only': True, 'required': False}
        }

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
            email=validated_data.get('email', '')
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

    def create(self, validated_data):
        # Extract initial_revision_date from validated_data if provided
        initial_revision_date = None
        if 'initial_revision_date' in validated_data:
            initial_revision_date = validated_data.pop('initial_revision_date')
            print(f"USING PROVIDED DATE: {initial_revision_date}")
        
        # Create the topic
        topic = Topic.objects.create(**validated_data)
        
        # Create revision schedule for the new topic using the schedule utility
        RevisionSchedule.create_schedule(topic, base_date=initial_revision_date)
        
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
        fields = ['id', 'scheduled_date', 'completed', 'postponed', 'day_number']
        read_only_fields = ['completed', 'postponed']

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

    class Meta:
        model = FlashCard
        fields = ['id', 'topic', 'title', 'content', 'order', 'revisions', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class FlashCardRevisionScheduleSerializer(serializers.ModelSerializer):
    """Full serializer for flashcard revision schedules with nested flashcard"""
    flashcard = FlashCardSerializer(read_only=True)
    day_number = serializers.SerializerMethodField()

    class Meta:
        model = FlashCardRevisionSchedule
        fields = ['id', 'flashcard', 'scheduled_date', 'completed', 'postponed', 'day_number']
        read_only_fields = ['completed', 'postponed']

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
    revisions = RevisionScheduleSimpleSerializer(many=True, read_only=True)
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
