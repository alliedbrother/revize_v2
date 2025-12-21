from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomObtainAuthToken,
    TopicViewSet,
    RevisionScheduleViewSet,
    FlashCardRevisionScheduleViewSet,
    StatisticsViewSet,
    RegisterUser,
    UserProfileView,
    ProfilePictureUploadView,
    # TopicListCreate,  # REMOVED - redundant with TopicViewSet
    # TopicDetail,       # REMOVED - redundant with TopicViewSet
    TodayRevisions,
    CompletedTodayRevisions,
    MissedRevisions,
    TodayTopics,
    ServerTime,
    GoogleLoginView,
    ChangePasswordView,
    DocumentUploadView,
    ImageUploadView,
    LinkUploadView,
    GamificationStatsView,
    UserStreakView,
    AchievementViewSet,
    UserLevelView,
    DailyGoalViewSet,
    UserCreditView,
    PromoCodeRedeemView,
    CreditUsageLogViewSet
)

router = DefaultRouter()
router.register(r'topics', TopicViewSet, basename='topic')
router.register(r'statistics', StatisticsViewSet, basename='statistics')
router.register(r'gamification/achievements', AchievementViewSet, basename='achievement')
router.register(r'gamification/goals', DailyGoalViewSet, basename='daily-goal')

urlpatterns = [
    # Authentication endpoints
    path('login/', CustomObtainAuthToken.as_view(), name='api_token_auth'),
    path('register/', RegisterUser.as_view(), name='register'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('profile/upload-picture/', ProfilePictureUploadView.as_view(), name='profile-picture-upload'),
    path('auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    
    # Server time endpoint for timezone synchronization
    path('server-time/', ServerTime.as_view(), name='server-time'),

    # Topic endpoints
    # REMOVED: path('topics/', TopicListCreate.as_view(), ...) - Now handled by TopicViewSet router
    path('topics/today/', TodayTopics.as_view(), name='topics-today'),
    # REMOVED: path('topics/<int:pk>/', TopicDetail.as_view(), ...) - Now handled by TopicViewSet router
    path('topics/upload-document/', DocumentUploadView.as_view(), name='document-upload'),
    path('topics/upload-images/', ImageUploadView.as_view(), name='image-upload'),
    path('topics/upload-link/', LinkUploadView.as_view(), name='link-upload'),

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

    # Gamification endpoints
    path('gamification/stats/', GamificationStatsView.as_view(), name='gamification-stats'),
    path('gamification/streak/', UserStreakView.as_view(), name='user-streak'),
    path('gamification/level/', UserLevelView.as_view(), name='user-level'),

    # Credit system endpoints
    path('credits/', UserCreditView.as_view(), name='user-credits'),
    path('credits/redeem/', PromoCodeRedeemView.as_view(), name='redeem-promo'),
    path('credits/history/', CreditUsageLogViewSet.as_view({'get': 'list'}), name='credit-history'),

    # Include routers last to avoid conflicts
    path('', include(router.urls)),
] 