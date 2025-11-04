from django.shortcuts import render
from rest_framework import generics, permissions, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth.models import User
from .models import Topic, RevisionSchedule, FlashCard, FlashCardRevisionSchedule
from .serializers import (
    TopicSerializer, TopicCreateSerializer, UserSerializer,
    RevisionScheduleSerializer, DocumentUploadSerializer,
    TopicWithFlashcardsSerializer, FlashCardSerializer,
    FlashCardRevisionScheduleSerializer, ImageUploadSerializer
)
from django.utils import timezone
import datetime
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes, action
from datetime import timedelta
from django.urls import path
import requests
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
from .flashcard_generator import generate_flashcards_from_document
from .image_flashcard_generator import generate_flashcards_from_images

# Create your views here.

class TopicListCreate(generics.ListCreateAPIView):
    """
    API endpoint that allows topics to be viewed or created.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TopicCreateSerializer

    def get_queryset(self):
        return Topic.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.request.method == 'GET':
            return TopicSerializer
        return TopicCreateSerializer

class TopicDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    API endpoint that allows a topic to be viewed, updated, or deleted.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TopicSerializer

    def get_queryset(self):
        return Topic.objects.filter(user=self.request.user)

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
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'username': user.username,
                'email': user.email
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
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username
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

    def perform_create(self, serializer):
        # Get initial_revision_date from serializer if provided
        initial_revision_date = None
        if 'initial_revision_date' in serializer.validated_data:
            initial_revision_date = serializer.validated_data.pop('initial_revision_date')

        # Create the topic
        topic = serializer.save(user=self.request.user)

        # Auto-create a flashcard for manually created topics
        # This ensures manual topics appear in the flashcard review session
        if topic.source_type == 'manual':
            print(f'[DEBUG] Auto-creating flashcard for manual topic: {topic.title}')
            flashcard = FlashCard.objects.create(
                topic=topic,
                title=topic.title,
                content=topic.content,
                order=1
            )
            print(f'[DEBUG] Flashcard created with ID: {flashcard.id}')

            # Create flashcard revision schedule
            FlashCardRevisionSchedule.create_schedule(
                flashcard,
                base_date=initial_revision_date
            )
            print(f'[DEBUG] Flashcard revision schedule created')
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
        revision = self.get_object()
        revision.complete()
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
        """Mark a flashcard revision as completed"""
        revision = self.get_object()
        revision.complete()
        serializer = self.get_serializer(revision)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def postpone(self, request, pk=None):
        """Postpone a flashcard revision"""
        revision = self.get_object()
        revision.postpone()
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
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def put(self, request):
        """Update the user profile"""
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
            
            # Create or get auth token
            token, created = Token.objects.get_or_create(user=user)
            
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name
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

            # Generate flashcards using LangGraph workflow
            result = generate_flashcards_from_document(full_file_path, doc_type)

            # Delete temporary file
            default_storage.delete(file_path)

            if not result['success']:
                return Response({
                    'error': result['error']
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
                'flashcards_count': len(flashcards_created)
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': f'An error occurred: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ImageUploadView(APIView):
    """
    API endpoint for uploading images and generating flashcards using Gemini Vision AI
    """
    permission_classes = [permissions.IsAuthenticated]

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

            # Generate flashcards using LangGraph workflow
            result = generate_flashcards_from_images(image_paths)

            # Delete temporary files
            for file_path in saved_files:
                try:
                    default_storage.delete(file_path)
                except:
                    pass

            if not result['success']:
                return Response({
                    'error': result['error']
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
                'images_processed': len(images)
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Clean up temporary files in case of error
            for file_path in saved_files:
                try:
                    default_storage.delete(file_path)
                except:
                    pass

            return Response({
                'error': f'An error occurred: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
