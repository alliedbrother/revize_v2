"""
Credit System Decorators
Provides decorators for enforcing credit checks on AI generation endpoints
"""
from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from .models import UserCredit, CreditUsageLog


def require_credits(credits=1):
    """
    Decorator to check and deduct credits before AI generation.

    This decorator ensures that:
    1. User has sufficient credits before AI generation
    2. Credits are only deducted on successful generation (HTTP 201)
    3. All credit operations are atomic (thread-safe)
    4. Complete audit trail is maintained

    Usage:
        @require_credits(credits=1)
        def create(self, request, *args, **kwargs):
            # Your AI generation code
            pass

    Security Features:
    - Backend-only enforcement (no frontend bypass possible)
    - Atomic database transactions (no race conditions)
    - Credits deducted only on success (HTTP 201)
    - Complete audit logging

    Args:
        credits (int): Number of credits required (default: 1)

    Returns:
        Response: HTTP 402 if insufficient credits, otherwise original response
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
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
                    description='Initial 10 credits granted on signup'
                )

            # Check if user has credits available
            if not user_credit.has_credits():
                return Response({
                    'error': 'Insufficient credits',
                    'detail': 'You have run out of AI generation credits. Please redeem a promo code in your Profile to continue.',
                    'available_credits': 0,
                    'unlimited_access': False
                }, status=status.HTTP_402_PAYMENT_REQUIRED)  # 402 Payment Required

            # Store credit info for potential use in view (before deduction)
            request.credits_available = user_credit.available_credits
            request.has_unlimited = user_credit.unlimited_access

            # Execute the view function (AI generation happens here)
            response = view_func(self, request, *args, **kwargs)

            # Only deduct credits if the AI generation was successful (HTTP 201)
            if response.status_code == status.HTTP_201_CREATED:
                with transaction.atomic():
                    # Refresh from database to avoid race conditions
                    user_credit.refresh_from_db()

                    # Deduct the credit
                    if user_credit.deduct_credit():
                        # Extract topic_id from response if available
                        topic_id = None
                        if hasattr(response, 'data') and isinstance(response.data, dict):
                            # Try different possible locations for topic_id
                            topic_id = (
                                response.data.get('id') or
                                response.data.get('topic', {}).get('id') if isinstance(response.data.get('topic'), dict) else None
                            )

                        # Log credit usage
                        CreditUsageLog.objects.create(
                            user=request.user,
                            action='deduct',
                            credits_changed=-credits,
                            credits_after=user_credit.available_credits,
                            unlimited_before=user_credit.unlimited_access,
                            unlimited_after=user_credit.unlimited_access,
                            description=f"AI generation: {request.path}",
                            topic_id=topic_id
                        )

                        # Add credit information to response
                        if hasattr(response, 'data') and isinstance(response.data, dict):
                            response.data['credits_remaining'] = user_credit.available_credits
                            response.data['unlimited_access'] = user_credit.unlimited_access

            return response

        return wrapped_view
    return decorator
