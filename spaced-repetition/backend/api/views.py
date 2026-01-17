from django.shortcuts import render
from rest_framework import generics, permissions, status, viewsets, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from .models import (
    Topic, RevisionSchedule, FlashCard, FlashCardRevisionSchedule,
    UserStreak, Achievement, UserAchievement, UserLevel, DailyGoal,
    UserCredit, PromoCode, PromoCodeRedemption, CreditUsageLog,
    StudySession
)
from .serializers import (
    TopicSerializer, TopicCreateSerializer, UserSerializer,
    RevisionScheduleSerializer, DocumentUploadSerializer,
    TopicWithFlashcardsSerializer, FlashCardSerializer,
    FlashCardRevisionScheduleSerializer, ImageUploadSerializer,
    LinkUploadSerializer, UserStreakSerializer, AchievementSerializer,
    UserAchievementSerializer, UserLevelSerializer, DailyGoalSerializer,
    GamificationStatsSerializer, UserCreditSerializer, PromoCodeRedeemSerializer,
    CreditUsageLogSerializer, StudySessionSerializer, StudyStatsSerializer
)
from django.utils import timezone
import datetime
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes, action
from datetime import timedelta
from django.db import transaction
from django.urls import path
import requests
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
from .flashcard_generator import generate_flashcards_from_document
from .image_flashcard_generator import generate_flashcards_from_images
from .link_flashcard_generator import generate_flashcards_from_link
from .decorators import require_credits

# Create your views here.

# REMOVED: TopicListCreate and TopicDetail views (redundant with TopicViewSet)
# These views were blocking AI flashcard generation for manual topics
# All topic CRUD operations are now handled by TopicViewSet (lines 402-501)

class TodayRevisions(APIView):
    """
    API endpoint that returns revisions scheduled for today.
    This includes both topic revisions and flashcard revisions (grouped by topic).
    Supports timezone-aware date calculation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get user's timezone from query parameter or header
        # Frontend should send timezone name like 'America/New_York' or 'Asia/Kolkata'
        user_timezone_name = request.GET.get('timezone') or request.headers.get('X-Timezone')

        if user_timezone_name:
            try:
                import pytz
                user_tz = pytz.timezone(user_timezone_name)
                # Get current time in user's timezone
                user_now = timezone.now().astimezone(user_tz)
                today = user_now.date()
                print(f"Using user timezone: {user_timezone_name}, Today: {today}")
            except Exception as e:
                print(f"Invalid timezone {user_timezone_name}: {e}, using server time")
                today = timezone.now().date()
        else:
            # Fallback to server timezone
            today = timezone.now().date()

        # Get topic revisions for today
        topic_revisions = RevisionSchedule.objects.filter(
            topic__user=request.user,
            scheduled_date=today,
            completed=False
        )

        # Get flashcard revisions for today
        flashcard_revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard__topic__user=request.user,
            scheduled_date=today,
            completed=False
        ).select_related('flashcard__topic')

        # Group flashcard revisions by topic
        from collections import defaultdict
        flashcards_by_topic = defaultdict(list)

        for fc_rev in flashcard_revisions:
            topic = fc_rev.flashcard.topic
            flashcards_by_topic[topic.id].append({
                'id': fc_rev.id,
                'flashcard': {
                    'id': fc_rev.flashcard.id,
                    'title': fc_rev.flashcard.title,
                    'content': fc_rev.flashcard.content,
                    'order': fc_rev.flashcard.order,
                    'topic': {
                        'id': topic.id,
                        'title': topic.title
                    }
                },
                'scheduled_date': fc_rev.scheduled_date,
                'day_number': self._get_day_number(fc_rev)
            })

        # Create grouped flashcard topic data
        flashcard_topics = []
        for topic_id, flashcard_list in flashcards_by_topic.items():
            topic = Topic.objects.get(id=topic_id)
            flashcard_topics.append({
                'topic': TopicSerializer(topic).data,
                'flashcard_count': len(flashcard_list),
                'flashcards': flashcard_list,
                'revision_type': 'flashcard_group'
            })

        # Exclude ALL topics that have ANY flashcards (not just today's flashcards)
        # This ensures topics with flashcards are ONLY reviewed through flashcards
        topics_with_any_flashcards = set(
            FlashCard.objects.filter(topic__user=request.user).values_list('topic_id', flat=True)
        )
        topic_revisions = topic_revisions.exclude(topic_id__in=topics_with_any_flashcards)

        # Serialize topic revisions
        from .serializers import RevisionScheduleSerializer
        topic_data = RevisionScheduleSerializer(topic_revisions, many=True).data

        # Combine and return
        return Response({
            'topic_revisions': topic_data,
            'flashcard_topics': flashcard_topics,
            'total_count': len(topic_data) + len(flashcard_topics)
        })

    def _get_day_number(self, fc_revision):
        """Get the day number for a flashcard revision"""
        revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard=fc_revision.flashcard
        ).order_by('scheduled_date')
        for i, rev in enumerate(revisions):
            if rev.id == fc_revision.id:
                return i + 1
        return None

class CompletedTodayRevisions(APIView):
    """
    API endpoint that returns flashcards completed today for practice mode.
    This allows users to review completed flashcards without affecting their completion status.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get user's timezone from query parameter or header
        user_timezone_name = request.GET.get('timezone') or request.headers.get('X-Timezone')

        if user_timezone_name:
            try:
                import pytz
                user_tz = pytz.timezone(user_timezone_name)
                user_now = timezone.now().astimezone(user_tz)
                today = user_now.date()
            except Exception as e:
                print(f"Invalid timezone {user_timezone_name}: {e}, using server time")
                today = timezone.now().date()
        else:
            today = timezone.now().date()

        # Get flashcard revisions completed today
        flashcard_revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard__topic__user=request.user,
            scheduled_date=today,
            completed=True
        ).select_related('flashcard__topic')

        # Group flashcard revisions by topic
        from collections import defaultdict
        flashcards_by_topic = defaultdict(list)

        for fc_rev in flashcard_revisions:
            topic = fc_rev.flashcard.topic
            flashcards_by_topic[topic.id].append({
                'id': fc_rev.id,
                'flashcard': {
                    'id': fc_rev.flashcard.id,
                    'title': fc_rev.flashcard.title,
                    'content': fc_rev.flashcard.content,
                    'order': fc_rev.flashcard.order,
                    'topic': {
                        'id': topic.id,
                        'title': topic.title
                    }
                },
                'scheduled_date': fc_rev.scheduled_date,
                'completed': fc_rev.completed
            })

        # Create grouped flashcard topic data
        flashcard_topics = []
        for topic_id, flashcard_list in flashcards_by_topic.items():
            topic = Topic.objects.get(id=topic_id)
            flashcard_topics.append({
                'topic': TopicSerializer(topic).data,
                'flashcard_count': len(flashcard_list),
                'flashcards': flashcard_list,
                'revision_type': 'flashcard_group'
            })

        return Response({
            'flashcard_topics': flashcard_topics,
            'total_count': len(flashcard_topics)
        })

class ServerTime(APIView):
    """
    API endpoint that returns the server's current time information.
    This helps clients synchronize with the server's timezone.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        now = timezone.now()
        return Response({
            'datetime': now.isoformat(),
            'date': now.date().isoformat(),
            'timezone': str(timezone.get_current_timezone()),
            'timezone_name': timezone.get_current_timezone_name()
        })

class MissedRevisions(APIView):
    """
    API endpoint that returns revisions scheduled for before today that haven't been completed.
    This includes both topic revisions and flashcard revisions (grouped by topic).
    Supports timezone-aware date calculation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get user's timezone from query parameter or header
        user_timezone_name = request.GET.get('timezone') or request.headers.get('X-Timezone')

        if user_timezone_name:
            try:
                import pytz
                user_tz = pytz.timezone(user_timezone_name)
                # Get current time in user's timezone
                user_now = timezone.now().astimezone(user_tz)
                today = user_now.date()
                print(f"Using user timezone: {user_timezone_name}, Today: {today}")
            except Exception as e:
                print(f"Invalid timezone {user_timezone_name}: {e}, using server time")
                today = timezone.now().date()
        else:
            # Fallback to server timezone
            today = timezone.now().date()

        # Get missed topic revisions
        topic_revisions = RevisionSchedule.objects.filter(
            topic__user=request.user,
            scheduled_date__lt=today,
            completed=False
        )

        # Get missed flashcard revisions
        flashcard_revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard__topic__user=request.user,
            scheduled_date__lt=today,
            completed=False
        ).select_related('flashcard__topic')

        # Group flashcard revisions by topic
        from collections import defaultdict
        flashcards_by_topic = defaultdict(list)

        for fc_rev in flashcard_revisions:
            topic = fc_rev.flashcard.topic
            flashcards_by_topic[topic.id].append({
                'id': fc_rev.id,
                'flashcard': {
                    'id': fc_rev.flashcard.id,
                    'title': fc_rev.flashcard.title,
                    'content': fc_rev.flashcard.content,
                    'order': fc_rev.flashcard.order,
                    'topic': {
                        'id': topic.id,
                        'title': topic.title
                    }
                },
                'scheduled_date': fc_rev.scheduled_date,
                'day_number': self._get_day_number(fc_rev)
            })

        # Create grouped flashcard topic data
        flashcard_topics = []
        for topic_id, flashcard_list in flashcards_by_topic.items():
            topic = Topic.objects.get(id=topic_id)
            flashcard_topics.append({
                'topic': TopicSerializer(topic).data,
                'flashcard_count': len(flashcard_list),
                'flashcards': flashcard_list,
                'revision_type': 'flashcard_group'
            })

        # Exclude ALL topics that have ANY flashcards (not just overdue flashcards)
        # This ensures topics with flashcards are ONLY reviewed through flashcards
        topics_with_any_flashcards = set(
            FlashCard.objects.filter(topic__user=request.user).values_list('topic_id', flat=True)
        )
        topic_revisions = topic_revisions.exclude(topic_id__in=topics_with_any_flashcards)

        # Serialize topic revisions
        topic_data = RevisionScheduleSerializer(topic_revisions, many=True).data

        # Combine and return
        return Response({
            'topic_revisions': topic_data,
            'flashcard_topics': flashcard_topics,
            'total_count': len(topic_data) + len(flashcard_topics)
        })

    def _get_day_number(self, fc_revision):
        """Get the day number for a flashcard revision"""
        revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard=fc_revision.flashcard
        ).order_by('scheduled_date')
        for i, rev in enumerate(revisions):
            if rev.id == fc_revision.id:
                return i + 1
        return None

class TodayTopics(APIView):
    """
    API endpoint that returns topics created today.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        today = timezone.now().date()
        topics = Topic.objects.filter(
            user=request.user,
            created_at__date=today
        )
        serializer = TopicSerializer(topics, many=True)
        return Response({'data': serializer.data})

class RegisterUser(generics.CreateAPIView):
    """
    API endpoint for registering a new user.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)

            # Get profile picture URL if exists
            profile_picture_url = None
            if hasattr(user, 'profile') and user.profile.profile_picture:
                profile_picture_url = request.build_absolute_uri(user.profile.profile_picture.url)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user_id': user.pk,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'profile_picture': profile_picture_url
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CustomObtainAuthToken(ObtainAuthToken):
    """
    API endpoint for user login.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        # Get profile picture URL if exists
        profile_picture_url = None
        if hasattr(user, 'profile') and user.profile.profile_picture:
            profile_picture_url = request.build_absolute_uri(user.profile.profile_picture.url)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user_id': user.pk,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'profile_picture': profile_picture_url
        })

class TopicViewSet(viewsets.ModelViewSet):
    serializer_class = TopicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Topic.objects.filter(user=self.request.user)
        
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TopicCreateSerializer
        return TopicSerializer

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to include flashcards in response"""
        instance = self.get_object()
        serializer = TopicWithFlashcardsSerializer(instance, context={'request': request})
        return Response(serializer.data)

    @require_credits(credits=1)
    def create(self, request, *args, **kwargs):
        """Override create to include llm_provider in response for manual topics"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        # Build response with topic data
        response_serializer = TopicWithFlashcardsSerializer(
            serializer.instance,
            context={'request': request}
        )
        response_data = {
            'message': 'Topic created successfully',
            'topic': response_serializer.data
        }

        # Add llm_provider if available (set by perform_create for manual topics)
        if hasattr(self, 'llm_provider'):
            response_data['llm_provider'] = self.llm_provider
            # Also include flashcard count for consistency with other upload endpoints
            flashcard_count = FlashCard.objects.filter(topic=serializer.instance).count()
            response_data['flashcards_count'] = flashcard_count

        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        # Get initial_revision_date from serializer if provided
        initial_revision_date = None
        if 'initial_revision_date' in serializer.validated_data:
            initial_revision_date = serializer.validated_data.pop('initial_revision_date')

        # Create the topic
        topic = serializer.save(user=self.request.user)

        # For manual topics, use AI to generate exactly 5 flashcards
        if topic.source_type == 'manual':
            from .text_flashcard_generator import generate_flashcards_from_text

            print(f'[DEBUG] Generating AI flashcards for manual topic: {topic.title}')

            # Call AI to generate flashcards
            result = generate_flashcards_from_text(
                title=topic.title,
                content=topic.content,
                user_id=str(self.request.user.id)
            )

            # If AI generation fails, rollback topic creation and raise error
            if not result['success']:
                topic.delete()
                raise serializers.ValidationError({
                    'error': 'Error generating flashcards at this time, please try later'
                })

            # Use AI-generated title if available (AI may improve the title)
            if result.get('topic_title') and result['topic_title'] != topic.title:
                topic.title = result['topic_title']
                topic.save()
                print(f'[DEBUG] Updated topic title to AI-generated: {topic.title}')

            # Create flashcards from AI result (should be exactly 5)
            flashcards_created = []
            for idx, flashcard_data in enumerate(result['flashcards']):
                flashcard = FlashCard.objects.create(
                    topic=topic,
                    title=flashcard_data['title'],
                    content=flashcard_data['content'],
                    order=idx + 1
                )
                flashcards_created.append(flashcard)

                # Create flashcard revision schedule
                FlashCardRevisionSchedule.create_schedule(
                    flashcard,
                    base_date=initial_revision_date
                )

            print(f'[DEBUG] Created {len(flashcards_created)} AI-generated flashcards')

            # Store llm_provider for response in create() method
            self.llm_provider = result.get('llm_provider')
            self.llm_metadata = result.get('llm_metadata', {})
        else:
            # Only create topic revision schedule for topics WITHOUT flashcards
            # (link, image, or any other non-manual topics that don't auto-generate flashcards)
            RevisionSchedule.create_schedule(topic, base_date=initial_revision_date)

class RevisionScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = RevisionScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RevisionSchedule.objects.filter(topic__user=self.request.user)

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.now().date()
        revisions = RevisionSchedule.objects.filter(
            topic__user=request.user,
            scheduled_date=today,
            completed=False
        )
        serializer = self.get_serializer(revisions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def schedule(self, request):
        revisions = RevisionSchedule.objects.filter(
            topic__user=request.user
        ).order_by('scheduled_date')
        serializer = self.get_serializer(revisions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a topic revision as completed and trigger gamification updates"""
        revision = self.get_object()
        revision.complete()

        # Trigger gamification updates
        from .gamification_service import process_revision_completion
        gamification_results = process_revision_completion(
            user=request.user,
            is_flashcard=False  # This is a topic revision
        )

        serializer = self.get_serializer(revision)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def postpone(self, request, pk=None):
        revision = self.get_object()
        revision.postpone()
        serializer = self.get_serializer(revision)
        return Response(serializer.data)

class FlashCardRevisionScheduleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing flashcard revision schedules.
    Provides complete and postpone actions for flashcard revisions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FlashCardRevisionSchedule.objects.filter(
            flashcard__topic__user=self.request.user
        )

    def get_serializer_class(self):
        from .serializers import FlashCardRevisionScheduleSerializer
        return FlashCardRevisionScheduleSerializer

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a flashcard revision as completed and trigger gamification updates

        Accepts optional JSON body:
        {
            "time_spent_seconds": 15,  // Time spent on this card (auto-tracked by frontend)
            "session_id": 123          // Optional session ID to update
        }
        """
        revision = self.get_object()

        # Get time spent from request body (auto-tracked by frontend)
        time_spent_seconds = request.data.get('time_spent_seconds')
        if time_spent_seconds is not None:
            try:
                time_spent_seconds = int(time_spent_seconds)
            except (ValueError, TypeError):
                time_spent_seconds = None

        # Complete the revision with timing data
        revision.complete(time_spent_seconds=time_spent_seconds)

        # Update study session if provided
        session_id = request.data.get('session_id')
        if session_id:
            try:
                session = StudySession.objects.get(id=session_id, user=request.user, is_active=True)
                session.add_reviewed_card(time_spent_seconds or 0)
            except StudySession.DoesNotExist:
                pass  # Session not found or not active, ignore

        # Trigger gamification updates
        from .gamification_service import process_revision_completion
        gamification_results = process_revision_completion(
            user=request.user,
            is_flashcard=True
        )

        serializer = self.get_serializer(revision)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def postpone(self, request, pk=None):
        """Postpone a flashcard revision

        Accepts optional JSON body:
        {
            "time_spent_seconds": 5,   // Time spent before postponing (auto-tracked)
            "session_id": 123          // Optional session ID to update
        }
        """
        revision = self.get_object()
        revision.postpone()

        # Update study session if provided
        session_id = request.data.get('session_id')
        time_spent_seconds = request.data.get('time_spent_seconds', 0)
        if session_id:
            try:
                time_spent = int(time_spent_seconds) if time_spent_seconds else 0
                session = StudySession.objects.get(id=session_id, user=request.user, is_active=True)
                session.add_postponed_card(time_spent)
            except (StudySession.DoesNotExist, ValueError, TypeError):
                pass  # Session not found or invalid data, ignore

        serializer = self.get_serializer(revision)
        return Response(serializer.data)

class StatisticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)

        # Get all topics and revisions for the user
        topics = Topic.objects.filter(user=request.user)
        revisions = RevisionSchedule.objects.filter(topic__user=request.user)

        # Calculate statistics
        stats = {
            'total_topics': topics.count(),
            'total_revisions': revisions.count(),
            'completed_revisions': revisions.filter(completed=True).count(),
            'pending_revisions': revisions.filter(completed=False).count(),
            'topics_this_week': topics.filter(created_at__gte=week_ago).count(),
            'revisions_today': revisions.filter(
                scheduled_date=today,
                completed=True
            ).count(),
            'avg_daily_topics': topics.count() / max(1, (today - topics.first().created_at.date()).days)
        }

        return Response(stats)

class UserProfileView(APIView):
    """
    API endpoint for getting and updating the user profile.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get the user profile"""
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def put(self, request):
        """Update the user profile"""
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfilePictureUploadView(APIView):
    """
    API endpoint for uploading profile pictures.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Upload profile picture"""
        from .serializers import ProfilePictureUploadSerializer
        from .models import UserProfile
        from PIL import Image
        import io

        serializer = ProfilePictureUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        profile_picture = serializer.validated_data['profile_picture']

        try:
            # Resize image if needed (max 800x800)
            img = Image.open(profile_picture)

            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background

            # Resize if too large
            max_size = (800, 800)
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)

            # Save to bytes
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)
            output.seek(0)

            # Get or create user profile
            user_profile, created = UserProfile.objects.get_or_create(user=request.user)

            # Delete old profile picture if exists
            if user_profile.profile_picture:
                user_profile.profile_picture.delete(save=False)

            # Save new profile picture
            from django.core.files.uploadedfile import InMemoryUploadedFile
            user_profile.profile_picture = InMemoryUploadedFile(
                output,
                'ImageField',
                f"{request.user.username}_profile.jpg",
                'image/jpeg',
                output.getbuffer().nbytes,
                None
            )
            user_profile.save()

            # Return updated user data with profile picture URL
            profile_picture_url = request.build_absolute_uri(user_profile.profile_picture.url)

            return Response({
                'message': 'Profile picture uploaded successfully',
                'profile_picture': profile_picture_url,
                'user': UserSerializer(request.user, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'Failed to process image: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class GoogleLoginView(APIView):
    """
    API endpoint for Google OAuth login.
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """Handle Google OAuth login"""
        try:
            # Get the Google JWT credential from the request
            credential = request.data.get('access_token')
            email = request.data.get('email')
            name = request.data.get('name', '')
            google_id = request.data.get('google_id')
            
            if not credential or not email:
                return Response({
                    'error': 'Google credential and email are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify the JWT token with Google (optional, for extra security)
            # For now, we'll trust the frontend verification
            
            # Check if user exists
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                # Create new user
                # Generate a unique username from email
                username = email.split('@')[0]
                counter = 1
                original_username = username
                while User.objects.filter(username=username).exists():
                    username = f"{original_username}{counter}"
                    counter += 1
                
                # Split name into first and last name
                name_parts = name.split(' ', 1) if name else ['', '']
                first_name = name_parts[0] if len(name_parts) > 0 else ''
                last_name = name_parts[1] if len(name_parts) > 1 else ''
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name
                )
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)

            # Get profile picture URL if exists
            profile_picture_url = None
            if hasattr(user, 'profile') and user.profile.profile_picture:
                profile_picture_url = request.build_absolute_uri(user.profile.profile_picture.url)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user_id': user.pk,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'profile_picture': profile_picture_url
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': f'Google login failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangePasswordView(APIView):
    """
    API endpoint for changing user password.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Change user password"""
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response({
                'error': 'Both current and new password are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify current password
        if not request.user.check_password(current_password):
            return Response({
                'error': 'Current password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Set new password
        request.user.set_password(new_password)
        request.user.save()

        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)


class DocumentUploadView(APIView):
    """
    API endpoint for uploading documents and generating flashcards using Gemini AI
    """
    permission_classes = [permissions.IsAuthenticated]

    @require_credits(credits=1)
    def post(self, request):
        """Handle document upload and flashcard generation"""
        serializer = DocumentUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get validated data
            document = serializer.validated_data['document']
            title = serializer.validated_data.get('title', '')
            initial_revision_date = serializer.validated_data.get('initial_revision_date')

            # Determine document type
            file_extension = document.name.split('.')[-1].lower()
            if file_extension == 'pdf':
                doc_type = 'pdf'
            elif file_extension in ['doc', 'docx']:
                doc_type = 'docx'
            else:
                return Response({
                    'error': 'Unsupported file type'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Save the uploaded file temporarily
            file_path = default_storage.save(
                f'temp_uploads/{document.name}',
                ContentFile(document.read())
            )
            full_file_path = os.path.join(default_storage.location, file_path)

            # Generate flashcards using LangGraph workflow with user tracing
            result = generate_flashcards_from_document(
                full_file_path,
                doc_type,
                user_id=str(request.user.id)
            )

            # Delete temporary file
            default_storage.delete(file_path)

            if not result['success']:
                # Generic error message for frontend, detailed error already logged in backend
                return Response({
                    'error': 'Error generating flashcards at this time, please try later'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Use Gemini-generated title if not provided by user
            if not title:
                title = result.get('topic_title', '') or f"Document: {document.name.rsplit('.', 1)[0]}"

            # Create the Topic
            topic = Topic.objects.create(
                user=request.user,
                title=title,
                content=f"Generated from document: {document.name}\n\nExtracted {result['extracted_text_length']} characters",
                source_type='document',
                source_file=document
            )

            # Note: We don't create TopicRevisionSchedule here because this topic will have flashcards
            # Topics with flashcards are reviewed only through their flashcards, not as topics

            # Create FlashCards from the generated flashcards
            flashcards_created = []
            for idx, flashcard_data in enumerate(result['flashcards']):
                flashcard = FlashCard.objects.create(
                    topic=topic,
                    title=flashcard_data['title'],
                    content=flashcard_data['content'],
                    order=idx + 1
                )
                flashcards_created.append(flashcard)

                # Create revision schedule for each flashcard
                FlashCardRevisionSchedule.create_schedule(
                    flashcard,
                    base_date=initial_revision_date
                )

            # Return the created topic with flashcards
            response_serializer = TopicWithFlashcardsSerializer(topic)
            return Response({
                'message': f'Successfully created {len(flashcards_created)} flashcards',
                'topic': response_serializer.data,
                'flashcards_count': len(flashcards_created),
                'llm_provider': result.get('llm_provider')  # Show which LLM was used
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Generic error message for frontend, actual error is logged
            return Response({
                'error': 'Error generating flashcards at this time, please try later'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ImageUploadView(APIView):
    """
    API endpoint for uploading images and generating flashcards using Gemini Vision AI
    """
    permission_classes = [permissions.IsAuthenticated]

    @require_credits(credits=1)
    def post(self, request):
        """Handle image upload and flashcard generation"""
        serializer = ImageUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get validated data
            images = serializer.validated_data['images']
            title = serializer.validated_data.get('title', '')
            initial_revision_date = serializer.validated_data.get('initial_revision_date')

            # Save uploaded images temporarily
            image_paths = []
            saved_files = []

            for idx, image in enumerate(images):
                # Save to temporary location
                file_path = default_storage.save(
                    f'temp_uploads/image_{idx}_{image.name}',
                    ContentFile(image.read())
                )
                full_file_path = os.path.join(default_storage.location, file_path)
                image_paths.append(full_file_path)
                saved_files.append(file_path)

            # Generate flashcards using LangGraph workflow with user tracing
            result = generate_flashcards_from_images(
                image_paths,
                user_id=str(request.user.id)
            )

            # Delete temporary files
            for file_path in saved_files:
                try:
                    default_storage.delete(file_path)
                except:
                    pass

            if not result['success']:
                # Generic error message for frontend, detailed error already logged in backend
                return Response({
                    'error': 'Error generating flashcards at this time, please try later'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Use Gemini-generated title if not provided by user
            if not title:
                title = result.get('topic_title', '') or f"Images: {len(images)} image(s)"

            # Create the Topic
            topic = Topic.objects.create(
                user=request.user,
                title=title,
                content=f"Generated from {len(images)} image(s)\n\nExtracted {result['extracted_content_length']} characters",
                source_type='image'
            )

            # Note: We don't create TopicRevisionSchedule here because this topic will have flashcards
            # Topics with flashcards are reviewed only through their flashcards, not as topics

            # Create FlashCards from the generated flashcards
            flashcards_created = []
            for idx, flashcard_data in enumerate(result['flashcards']):
                flashcard = FlashCard.objects.create(
                    topic=topic,
                    title=flashcard_data['title'],
                    content=flashcard_data['content'],
                    order=idx + 1
                )
                flashcards_created.append(flashcard)

                # Create revision schedule for each flashcard
                FlashCardRevisionSchedule.create_schedule(
                    flashcard,
                    base_date=initial_revision_date
                )

            # Return the created topic with flashcards
            response_serializer = TopicWithFlashcardsSerializer(topic)
            return Response({
                'message': f'Successfully created {len(flashcards_created)} flashcards from {len(images)} image(s)',
                'topic': response_serializer.data,
                'flashcards_count': len(flashcards_created),
                'images_processed': len(images),
                'llm_provider': result.get('llm_provider')  # Show which LLM was used
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Clean up temporary files in case of error
            for file_path in saved_files:
                try:
                    default_storage.delete(file_path)
                except:
                    pass

            # Generic error message for frontend, actual error is logged
            return Response({
                'error': 'Error generating flashcards at this time, please try later'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LinkUploadView(APIView):
    """
    API endpoint for uploading web links and generating flashcards using Gemini AI
    Supports YouTube, Wikipedia, articles, and generic webpages
    """
    permission_classes = [permissions.IsAuthenticated]

    @require_credits(credits=1)
    def post(self, request):
        """Handle web link upload and flashcard generation"""
        serializer = LinkUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get validated data
            url = serializer.validated_data['url']
            title = serializer.validated_data.get('title', '')
            initial_revision_date = serializer.validated_data.get('initial_revision_date')

            # Generate flashcards using LangGraph workflow with user tracing
            result = generate_flashcards_from_link(
                url,
                user_id=str(request.user.id)
            )

            if not result['success']:
                # Return user-friendly error messages
                error_type = result.get('error_type', 'unknown')
                error_message = result.get('error', 'Failed to process the link')

                # Map error types to HTTP status codes
                status_code_map = {
                    'invalid_url': status.HTTP_400_BAD_REQUEST,
                    'blacklisted': status.HTTP_400_BAD_REQUEST,
                    'robots': status.HTTP_403_FORBIDDEN,
                    'http_404': status.HTTP_404_NOT_FOUND,
                    'http_403': status.HTTP_403_FORBIDDEN,
                    'http_401': status.HTTP_401_UNAUTHORIZED,
                    'paywall': status.HTTP_402_PAYMENT_REQUIRED,
                    'auth_wall': status.HTTP_401_UNAUTHORIZED,
                    'geo_restricted': status.HTTP_451_UNAVAILABLE_FOR_LEGAL_REASONS,
                    'timeout': status.HTTP_504_GATEWAY_TIMEOUT,
                    'http_500': status.HTTP_502_BAD_GATEWAY,
                    'connection_error': status.HTTP_503_SERVICE_UNAVAILABLE,
                    'youtube_transcript_disabled': status.HTTP_400_BAD_REQUEST,
                    'youtube_no_transcript': status.HTTP_404_NOT_FOUND,
                    'youtube_unavailable': status.HTTP_404_NOT_FOUND,
                    'wikipedia_not_found': status.HTTP_404_NOT_FOUND,
                    'extraction_failed': status.HTTP_500_INTERNAL_SERVER_ERROR,
                }

                http_status = status_code_map.get(error_type, status.HTTP_500_INTERNAL_SERVER_ERROR)

                return Response({
                    'error': error_message,
                    'error_type': error_type,
                    'url': url,
                    'accessible': False
                }, status=http_status)

            # Use Gemini-generated title if not provided by user
            if not title:
                title = result.get('topic_title', '') or f"Link: {url[:50]}..."

            # Determine source type from link type
            link_type = result.get('link_type', 'link')
            source_type_map = {
                'youtube': 'link',
                'wikipedia': 'link',
                'article': 'link',
                'generic': 'link'
            }
            source_type = source_type_map.get(link_type, 'link')

            # Create the Topic
            topic = Topic.objects.create(
                user=request.user,
                title=title,
                content=f"Generated from web link: {url}\n\nLink type: {link_type}\n\nExtracted {result['extracted_content_length']} characters",
                resource_url=url,
                source_type=source_type
            )

            # Note: We don't create TopicRevisionSchedule here because this topic will have flashcards
            # Topics with flashcards are reviewed only through their flashcards, not as topics

            # Create FlashCards from the generated flashcards
            flashcards_created = []
            for idx, flashcard_data in enumerate(result['flashcards']):
                flashcard = FlashCard.objects.create(
                    topic=topic,
                    title=flashcard_data['title'],
                    content=flashcard_data['content'],
                    order=idx + 1
                )
                flashcards_created.append(flashcard)

                # Create revision schedule for each flashcard
                FlashCardRevisionSchedule.create_schedule(
                    flashcard,
                    base_date=initial_revision_date
                )

            # Return the created topic with flashcards
            response_serializer = TopicWithFlashcardsSerializer(topic)
            return Response({
                'message': f'Successfully created {len(flashcards_created)} flashcards from {link_type} link',
                'topic': response_serializer.data,
                'flashcards_count': len(flashcards_created),
                'link_type': link_type,
                'url': url,
                'accessible': True,
                'llm_provider': result.get('llm_provider')  # Show which LLM was used
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Generic error message for frontend, actual error is logged
            return Response({
                'error': 'Error generating flashcards at this time, please try later',
                'error_type': 'server_error',
                'accessible': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================
# Gamification Views
# ==========================================

class GamificationStatsView(APIView):
    """
    API endpoint that returns comprehensive gamification statistics
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        # Get or create user streak
        user_streak, created = UserStreak.objects.get_or_create(user=user)

        # Get or create user level
        user_level, created = UserLevel.objects.get_or_create(user=user)

        # Get recent achievements (last 5)
        recent_achievements = UserAchievement.objects.filter(
            user=user
        ).order_by('-unlocked_at')[:5]

        # Get achievement counts
        total_achievements = UserAchievement.objects.filter(user=user).count()
        available_achievements = Achievement.objects.count()

        # Get today's daily goals
        daily_goals = DailyGoal.objects.filter(user=user, date=today)
        goals_completed_today = daily_goals.filter(completed=True).count()

        # Calculate XP earned today (placeholder - will be implemented with XP utility)
        xp_earned_today = 0

        # Prepare data for serializer
        stats_data = {
            'streak': user_streak,
            'level': user_level,
            'recent_achievements': recent_achievements,
            'total_achievements': total_achievements,
            'available_achievements': available_achievements,
            'daily_goals': daily_goals,
            'goals_completed_today': goals_completed_today,
            'xp_earned_today': xp_earned_today
        }

        serializer = GamificationStatsSerializer(stats_data)
        return Response(serializer.data)


class UserStreakView(APIView):
    """
    API endpoint for managing user streaks
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get current user streak"""
        user_streak, created = UserStreak.objects.get_or_create(user=request.user)
        serializer = UserStreakSerializer(user_streak)
        return Response(serializer.data)

    def post(self, request):
        """Update user streak (called after completing a revision)"""
        user_streak, created = UserStreak.objects.get_or_create(user=request.user)
        user_streak.update_streak()
        serializer = UserStreakSerializer(user_streak)
        return Response(serializer.data)


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing available achievements
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AchievementSerializer
    queryset = Achievement.objects.all()

    @action(detail=False, methods=['get'])
    def my_achievements(self, request):
        """Get user's unlocked achievements"""
        user_achievements = UserAchievement.objects.filter(
            user=request.user
        ).order_by('-unlocked_at')
        serializer = UserAchievementSerializer(user_achievements, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def progress(self, request):
        """Get achievement progress"""
        user = request.user

        # Get all achievements
        all_achievements = Achievement.objects.all()

        # Get user's unlocked achievements
        unlocked_ids = set(
            UserAchievement.objects.filter(user=user).values_list('achievement_id', flat=True)
        )

        # Calculate progress for each achievement
        progress_data = []
        for achievement in all_achievements:
            current_value = self._get_achievement_progress(user, achievement)
            is_unlocked = achievement.id in unlocked_ids

            progress_data.append({
                'achievement': AchievementSerializer(achievement).data,
                'unlocked': is_unlocked,
                'current_value': current_value,
                'target_value': achievement.requirement_value,
                'progress_percentage': min(
                    int((current_value / achievement.requirement_value) * 100), 100
                ) if achievement.requirement_value > 0 else 0
            })

        return Response(progress_data)

    def _get_achievement_progress(self, user, achievement):
        """Calculate current progress for an achievement"""
        req_type = achievement.requirement_type

        if req_type == 'topic_count':
            return Topic.objects.filter(user=user).count()
        elif req_type == 'revision_count':
            flashcard_revisions = FlashCardRevisionSchedule.objects.filter(
                flashcard__topic__user=user,
                completed=True
            ).count()
            topic_revisions = RevisionSchedule.objects.filter(
                topic__user=user,
                completed=True
            ).count()
            return flashcard_revisions + topic_revisions
        elif req_type == 'streak_days':
            streak, _ = UserStreak.objects.get_or_create(user=user)
            return streak.current_streak
        elif req_type == 'total_study_days':
            streak, _ = UserStreak.objects.get_or_create(user=user)
            return streak.total_study_days
        elif req_type == 'longest_streak':
            streak, _ = UserStreak.objects.get_or_create(user=user)
            return streak.longest_streak

        return 0


class UserLevelView(APIView):
    """
    API endpoint for managing user level and XP
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get current user level and XP"""
        user_level, created = UserLevel.objects.get_or_create(user=request.user)
        serializer = UserLevelSerializer(user_level)
        return Response(serializer.data)

    def post(self, request):
        """Award XP to user"""
        amount = request.data.get('xp_amount', 0)

        if amount <= 0:
            return Response({
                'error': 'XP amount must be positive'
            }, status=status.HTTP_400_BAD_REQUEST)

        user_level, created = UserLevel.objects.get_or_create(user=request.user)
        new_level = user_level.award_xp(amount)

        serializer = UserLevelSerializer(user_level)
        return Response({
            'level_up': new_level > (new_level - 1),  # Check if leveled up
            'new_level': new_level,
            **serializer.data
        })


class DailyGoalViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing daily goals
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyGoalSerializer

    def get_queryset(self):
        return DailyGoal.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's daily goals"""
        today = timezone.now().date()
        goals = DailyGoal.objects.filter(user=request.user, date=today)

        # Create default goals if none exist for today
        if not goals.exists():
            default_goals = [
                {'goal_type': 'complete_revisions', 'target_value': 5},
                {'goal_type': 'create_topics', 'target_value': 1},
                {'goal_type': 'maintain_streak', 'target_value': 1}
            ]

            for goal_data in default_goals:
                DailyGoal.objects.create(
                    user=request.user,
                    date=today,
                    **goal_data
                )

            goals = DailyGoal.objects.filter(user=request.user, date=today)

        serializer = self.get_serializer(goals, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        """Update progress on a daily goal"""
        goal = self.get_object()
        value = request.data.get('value', 1)

        goal.update_progress(value)

        serializer = self.get_serializer(goal)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get daily goals history"""
        days = int(request.GET.get('days', 7))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)

        goals = DailyGoal.objects.filter(
            user=request.user,
            date__gte=start_date,
            date__lte=end_date
        ).order_by('-date')

        serializer = self.get_serializer(goals, many=True)
        return Response(serializer.data)


# ==============================
# STUDY ANALYTICS VIEWS
# ==============================

class StudySessionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing study sessions.
    Sessions are automatically created when users start reviewing flashcards.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudySessionSerializer

    def get_queryset(self):
        return StudySession.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start a new study session or get existing active session"""
        session, created = StudySession.get_or_create_active_session(request.user)
        serializer = self.get_serializer(session)
        return Response({
            'session': serializer.data,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """End a study session"""
        session = self.get_object()
        if session.is_active:
            session.end_session()
        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent study sessions (last 7 days)"""
        week_ago = timezone.now() - timedelta(days=7)
        sessions = StudySession.objects.filter(
            user=request.user,
            started_at__gte=week_ago
        ).order_by('-started_at')[:10]
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)


class StudyStatsView(APIView):
    """
    API endpoint that returns comprehensive study statistics.
    All data is passively tracked - no additional user input required.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)

        # Helper function to format time
        def format_time(seconds):
            if seconds < 60:
                return f"{int(seconds)}s"
            elif seconds < 3600:
                minutes = seconds // 60
                return f"{int(minutes)}m"
            else:
                hours = seconds // 3600
                minutes = (seconds % 3600) // 60
                return f"{int(hours)}h {int(minutes)}m"

        # Get flashcard revision data
        all_revisions = FlashCardRevisionSchedule.objects.filter(
            flashcard__topic__user=user
        )

        # Today's stats
        today_revisions = all_revisions.filter(completed_at__date=today)
        today_completed = today_revisions.filter(completed=True)
        today_postponed = all_revisions.filter(
            postponed=True,
            updated_at__date=today
        )

        study_time_today = sum(
            r.time_spent_seconds or 0 for r in today_completed
        )
        cards_reviewed_today = today_completed.count()
        cards_postponed_today = today_postponed.count()

        # Week's stats
        week_completed = all_revisions.filter(
            completed=True,
            completed_at__date__gte=week_ago
        )
        week_postponed = all_revisions.filter(
            postponed=True,
            updated_at__date__gte=week_ago
        )

        study_time_week = sum(
            r.time_spent_seconds or 0 for r in week_completed
        )
        cards_reviewed_week = week_completed.count()
        cards_postponed_week = week_postponed.count()

        # All-time stats
        total_completed = all_revisions.filter(completed=True)
        total_postponed = all_revisions.filter(postponed=True)
        total_cards_reviewed = total_completed.count()
        total_cards_postponed = total_postponed.count()
        total_study_time = sum(
            r.time_spent_seconds or 0 for r in total_completed
        )

        # Average time per card
        avg_time_per_card = (
            total_study_time / total_cards_reviewed
            if total_cards_reviewed > 0 else 0
        )

        # Session stats
        week_sessions = StudySession.objects.filter(
            user=user,
            started_at__date__gte=week_ago,
            is_active=False
        )
        total_session_time = sum(s.total_time_seconds for s in week_sessions)
        session_count = week_sessions.count()
        avg_session_length = (
            total_session_time // session_count if session_count > 0 else 0
        )

        # Completion rates
        def calc_completion_rate(completed, postponed):
            total = completed + postponed
            return round((completed / total) * 100, 1) if total > 0 else 0

        completion_rate_today = calc_completion_rate(
            cards_reviewed_today, cards_postponed_today
        )
        completion_rate_week = calc_completion_rate(
            cards_reviewed_week, cards_postponed_week
        )
        completion_rate_all_time = calc_completion_rate(
            total_cards_reviewed, total_cards_postponed
        )

        # Weekly activity (last 7 days heatmap data)
        weekly_activity = []
        for i in range(7):
            day = today - timedelta(days=6-i)
            day_completed = all_revisions.filter(
                completed=True,
                completed_at__date=day
            ).count()
            day_time = sum(
                r.time_spent_seconds or 0
                for r in all_revisions.filter(
                    completed=True,
                    completed_at__date=day
                )
            )
            weekly_activity.append({
                'date': day.isoformat(),
                'day_name': day.strftime('%a'),
                'cards_reviewed': day_completed,
                'time_spent_seconds': day_time,
                'time_spent_formatted': format_time(day_time)
            })

        # Cards needing attention (frequently postponed)
        needs_attention = FlashCard.objects.filter(
            topic__user=user,
            times_postponed__gt=0
        ).order_by('-times_postponed')[:5]

        needs_attention_cards = []
        for card in needs_attention:
            total_actions = card.times_reviewed + card.times_postponed
            postpone_rate = (
                round((card.times_postponed / total_actions) * 100, 1)
                if total_actions > 0 else 0
            )
            if postpone_rate >= 30:  # Only show cards with 30%+ postpone rate
                needs_attention_cards.append({
                    'id': card.id,
                    'title': card.title,
                    'topic_title': card.topic.title,
                    'times_postponed': card.times_postponed,
                    'times_reviewed': card.times_reviewed,
                    'postpone_rate': postpone_rate
                })

        # Recent sessions
        recent_sessions = StudySession.objects.filter(
            user=user,
            is_active=False
        ).order_by('-started_at')[:5]

        stats_data = {
            # Time-based stats
            'study_time_today_seconds': study_time_today,
            'study_time_today_formatted': format_time(study_time_today),
            'study_time_week_seconds': study_time_week,
            'study_time_week_formatted': format_time(study_time_week),
            'avg_session_length_seconds': avg_session_length,
            'avg_session_length_formatted': format_time(avg_session_length),
            'avg_time_per_card_seconds': round(avg_time_per_card, 1),

            # Card-based stats
            'cards_reviewed_today': cards_reviewed_today,
            'cards_postponed_today': cards_postponed_today,
            'cards_reviewed_week': cards_reviewed_week,
            'cards_postponed_week': cards_postponed_week,
            'total_cards_reviewed': total_cards_reviewed,
            'total_cards_postponed': total_cards_postponed,

            # Completion rates
            'completion_rate_today': completion_rate_today,
            'completion_rate_week': completion_rate_week,
            'completion_rate_all_time': completion_rate_all_time,

            # Activity data
            'weekly_activity': weekly_activity,
            'needs_attention_cards': needs_attention_cards,

            # Sessions
            'recent_sessions': StudySessionSerializer(recent_sessions, many=True).data
        }

        return Response(stats_data)


# ==============================
# CREDIT SYSTEM VIEWS
# ==============================

class UserCreditView(APIView):
    """
    API endpoint to get user's current credit balance.

    GET /api/credits/
    Returns:
        - available_credits: Number of credits remaining
        - total_credits_earned: Total credits earned (including initial + promo codes)
        - total_credits_used: Total credits consumed by AI generations
        - unlimited_access: Boolean indicating unlimited credit access
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get or create user credit record (lazy initialization)
        user_credit, created = UserCredit.objects.get_or_create(
            user=request.user,
            defaults={'available_credits': 10}
        )

        # If this is a new user, log initial credits
        if created:
            CreditUsageLog.objects.create(
                user=request.user,
                action='initial',
                credits_changed=10,
                credits_after=10,
                unlimited_before=False,
                unlimited_after=False,
                description='Initial 10 credits granted'
            )

        serializer = UserCreditSerializer(user_credit)
        return Response(serializer.data)


class PromoCodeRedeemView(APIView):
    """
    API endpoint for redeeming promo codes.

    POST /api/credits/redeem/
    Body: { "promo_code": "CODE123" }

    Security Features:
    - Rate limiting (5 attempts per hour per user)
    - Promo code hashing (SHA256)
    - Single-use per user (database constraint)
    - Atomic transactions
    - Complete audit trail

    Returns:
        Success (200):
            - message: Success message
            - credits_granted: Number of credits added
            - unlimited_granted: Boolean if unlimited was granted
            - available_credits: New credit balance
            - unlimited_access: Current unlimited status
            - tier: Promo code tier name

        Errors:
            - 400: Invalid promo code or validation error
            - 429: Too many redemption attempts
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PromoCodeRedeemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        code = serializer.validated_data['promo_code']

        # Rate limiting check (prevent brute force attacks)
        from django.core.cache import cache
        rate_limit_key = f'promo_attempt_{request.user.id}'
        attempts = cache.get(rate_limit_key, 0)

        if attempts >= 5:  # Max 5 attempts per hour
            return Response({
                'error': 'Too many redemption attempts. Please try again in 1 hour.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        cache.set(rate_limit_key, attempts + 1, 3600)  # 1 hour timeout

        with transaction.atomic():
            # Find promo code by hash
            import hashlib
            code_hash = hashlib.sha256(code.encode()).hexdigest()

            try:
                promo_code = PromoCode.objects.select_for_update().get(code_hash=code_hash)
            except PromoCode.DoesNotExist:
                return Response({
                    'error': 'Invalid promo code'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check if already redeemed by this user
            if PromoCodeRedemption.objects.filter(user=request.user, promo_code=promo_code).exists():
                return Response({
                    'error': 'You have already redeemed this promo code'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate promo code
            is_valid, error_msg = promo_code.is_valid()
            if not is_valid:
                return Response({
                    'error': error_msg
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get or create user credit record
            user_credit, created = UserCredit.objects.select_for_update().get_or_create(
                user=request.user,
                defaults={'available_credits': 10}
            )

            # Log initial credits if new user
            if created:
                CreditUsageLog.objects.create(
                    user=request.user,
                    action='initial',
                    credits_changed=10,
                    credits_after=10,
                    unlimited_before=False,
                    unlimited_after=False,
                    description='Initial 10 credits granted'
                )

            # Apply promo code
            credits_before = user_credit.available_credits
            unlimited_before = user_credit.unlimited_access

            if promo_code.grants_unlimited:
                user_credit.unlimited_access = True
                credits_granted = 0
                unlimited_granted = True
            else:
                user_credit.add_credits(promo_code.credits_granted)
                credits_granted = promo_code.credits_granted
                unlimited_granted = False

            user_credit.save()

            # Create redemption record
            PromoCodeRedemption.objects.create(
                user=request.user,
                promo_code=promo_code,
                credits_granted=credits_granted,
                unlimited_granted=unlimited_granted,
                ip_address=request.META.get('REMOTE_ADDR')
            )

            # Update promo code usage
            promo_code.times_redeemed += 1
            promo_code.save()

            # Log credit change
            CreditUsageLog.objects.create(
                user=request.user,
                action='promo',
                credits_changed=credits_granted,
                credits_after=user_credit.available_credits,
                unlimited_before=unlimited_before,
                unlimited_after=user_credit.unlimited_access,
                description=f"Promo code redeemed: {promo_code.get_tier_display()}",
                promo_code_id=promo_code.id
            )

            # Clear rate limit on successful redemption
            cache.delete(rate_limit_key)

            return Response({
                'message': 'Promo code redeemed successfully!',
                'credits_granted': credits_granted,
                'unlimited_granted': unlimited_granted,
                'available_credits': user_credit.available_credits,
                'unlimited_access': user_credit.unlimited_access,
                'tier': promo_code.get_tier_display()
            }, status=status.HTTP_200_OK)


class CreditUsageLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint to view credit usage history.

    GET /api/credits/history/
    Returns paginated list of credit changes with action type, amount, and description.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CreditUsageLogSerializer

    def get_queryset(self):
        return CreditUsageLog.objects.filter(user=self.request.user)
