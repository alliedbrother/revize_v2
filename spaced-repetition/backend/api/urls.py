from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomObtainAuthToken,
    TopicViewSet,
    RevisionScheduleViewSet,
    FlashCardRevisionScheduleViewSet,
    StatisticsViewSet,
    RegisterUser,
    UserProfileView,
    TopicListCreate,
    TopicDetail,
    TodayRevisions,
    CompletedTodayRevisions,
    MissedRevisions,
    TodayTopics,
    ServerTime,
    GoogleLoginView,
    ChangePasswordView,
    DocumentUploadView,
    ImageUploadView
)

router = DefaultRouter()
router.register(r'topics', TopicViewSet, basename='topic')
router.register(r'statistics', StatisticsViewSet, basename='statistics')

urlpatterns = [
    # Authentication endpoints
    path('login/', CustomObtainAuthToken.as_view(), name='api_token_auth'),
    path('register/', RegisterUser.as_view(), name='register'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    
    # Server time endpoint for timezone synchronization
    path('server-time/', ServerTime.as_view(), name='server-time'),
    
    # Topic endpoints
    path('topics/', TopicListCreate.as_view(), name='topic-list-create'),
    path('topics/today/', TodayTopics.as_view(), name='topics-today'),
    path('topics/<int:pk>/', TopicDetail.as_view(), name='topic-detail'),
    path('topics/upload-document/', DocumentUploadView.as_view(), name='document-upload'),
    path('topics/upload-images/', ImageUploadView.as_view(), name='image-upload'),

    # Revision endpoints
    path('revisions/today/', TodayRevisions.as_view(), name='revision-today'),
    path('revisions/missed/', MissedRevisions.as_view(), name='revision-missed'),
    path('revisions/completed-today/', CompletedTodayRevisions.as_view(), name='completed-today-revisions'),
    path('revisions/schedule/', RevisionScheduleViewSet.as_view({'get': 'schedule'}), name='revision-schedule'),
    path('revisions/<int:pk>/complete/', RevisionScheduleViewSet.as_view({'post': 'complete'}), name='revision-complete'),
    path('revisions/<int:pk>/postpone/', RevisionScheduleViewSet.as_view({'post': 'postpone'}), name='revision-postpone'),

    # Flashcard revision endpoints
    path('flashcard-revisions/<int:pk>/complete/', FlashCardRevisionScheduleViewSet.as_view({'post': 'complete'}), name='flashcard-revision-complete'),
    path('flashcard-revisions/<int:pk>/postpone/', FlashCardRevisionScheduleViewSet.as_view({'post': 'postpone'}), name='flashcard-revision-postpone'),

    # Include routers last to avoid conflicts
    path('', include(router.urls)),
] 