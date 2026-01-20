import time
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings


class HealthCheckMiddleware:
    """
    Middleware to handle health check requests before ALLOWED_HOSTS validation.
    This is needed because ALB health checks use IP addresses as Host headers,
    which Django doesn't allow by default.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Handle health check endpoint before any other middleware
        if request.path == '/api/health/' or request.path == '/api/health':
            return JsonResponse({
                'status': 'healthy',
                'service': 'revize-backend'
            })

        return self.get_response(request)


class ConcurrentUserLimitMiddleware:
    """
    Middleware to limit the number of concurrent active users.
    This helps control costs by capping usage during high-traffic periods.

    Uses cache to track active user sessions with a sliding window.
    """

    ACTIVITY_WINDOW = 300  # 5 minutes - consider user active if seen within this window
    CACHE_KEY_PREFIX = 'active_user_'
    ACTIVE_USERS_COUNT_KEY = 'active_users_count'

    def __init__(self, get_response):
        self.get_response = get_response
        self.max_users = getattr(settings, 'MAX_CONCURRENT_USERS', 500)

    def __call__(self, request):
        # Skip for non-API requests and health checks
        if not request.path.startswith('/api/') or request.path in ['/api/health/', '/api/health']:
            return self.get_response(request)

        # Get user identifier (user ID if authenticated, IP otherwise)
        user_key = self._get_user_key(request)

        # Check if this is a new user or returning user
        is_existing_user = cache.get(f'{self.CACHE_KEY_PREFIX}{user_key}')

        if not is_existing_user:
            # Check if we're at capacity
            current_count = cache.get(self.ACTIVE_USERS_COUNT_KEY, 0)
            if current_count >= self.max_users:
                return JsonResponse({
                    'error': 'Service is at capacity. Please try again later.',
                    'code': 'CAPACITY_LIMIT',
                    'retry_after': 60
                }, status=503)

            # Increment active users count
            try:
                cache.incr(self.ACTIVE_USERS_COUNT_KEY)
            except ValueError:
                # Key doesn't exist, set it
                cache.set(self.ACTIVE_USERS_COUNT_KEY, 1, timeout=self.ACTIVITY_WINDOW)

        # Update user's last activity timestamp
        cache.set(
            f'{self.CACHE_KEY_PREFIX}{user_key}',
            time.time(),
            timeout=self.ACTIVITY_WINDOW
        )

        response = self.get_response(request)

        return response

    def _get_user_key(self, request):
        """Get a unique identifier for the user."""
        if hasattr(request, 'user') and request.user.is_authenticated:
            return f'user_{request.user.id}'

        # For anonymous users, use IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return f'anon_{ip}'
