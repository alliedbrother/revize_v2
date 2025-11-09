"""
Gamification Service - Handles all gamification logic
Awards XP, updates streaks, manages daily goals, and unlocks achievements
"""
from django.utils import timezone
from datetime import date
from .models import (
    UserStreak, UserLevel, DailyGoal, Achievement, UserAchievement,
    FlashCard, Topic, FlashCardRevisionSchedule, RevisionSchedule
)


# XP Rewards Configuration
XP_REWARDS = {
    'flashcard_revision': 10,
    'topic_revision': 15,
    'create_topic': 5,
    'daily_goal_complete': 20,
}


def award_xp_for_revision(user, is_flashcard=True):
    """
    Award XP to user for completing a revision

    Args:
        user: User object
        is_flashcard: True if flashcard revision, False if topic revision

    Returns:
        dict: {
            'xp_awarded': int,
            'new_total_xp': int,
            'leveled_up': bool,
            'new_level': int or None
        }
    """
    # Get or create user level
    user_level, created = UserLevel.objects.get_or_create(user=user)

    # Determine XP amount
    xp_amount = XP_REWARDS['flashcard_revision'] if is_flashcard else XP_REWARDS['topic_revision']

    # Track previous level to detect level-up
    previous_level = user_level.current_level

    # Award XP
    new_level = user_level.award_xp(xp_amount)
    leveled_up = new_level > previous_level

    return {
        'xp_awarded': xp_amount,
        'new_total_xp': user_level.total_xp,
        'leveled_up': leveled_up,
        'new_level': new_level if leveled_up else None
    }


def update_streak(user):
    """
    Update user's study streak

    Args:
        user: User object

    Returns:
        dict: {
            'current_streak': int,
            'longest_streak': int,
            'total_study_days': int
        }
    """
    # Get or create user streak
    user_streak, created = UserStreak.objects.get_or_create(user=user)

    # Update streak
    user_streak.update_streak()

    return {
        'current_streak': user_streak.current_streak,
        'longest_streak': user_streak.longest_streak,
        'total_study_days': user_streak.total_study_days
    }


def update_daily_goals(user, goal_type, value=1):
    """
    Update progress on user's daily goals

    Args:
        user: User object
        goal_type: Type of goal ('complete_revisions', 'study_time', 'new_topics')
        value: Amount to increment (default: 1)

    Returns:
        dict: {
            'goals_updated': int,
            'goals_completed': int,
            'xp_awarded': int
        }
    """
    today = timezone.now().date()

    # Get today's goals of this type
    goals = DailyGoal.objects.filter(
        user=user,
        date=today,
        goal_type=goal_type,
        completed=False
    )

    goals_updated = 0
    goals_completed = 0
    total_xp = 0

    for goal in goals:
        # Update progress
        goal.update_progress(value)
        goals_updated += 1

        # If goal was just completed, award bonus XP
        if goal.completed:
            goals_completed += 1
            user_level, _ = UserLevel.objects.get_or_create(user=user)
            user_level.award_xp(XP_REWARDS['daily_goal_complete'])
            total_xp += XP_REWARDS['daily_goal_complete']

    return {
        'goals_updated': goals_updated,
        'goals_completed': goals_completed,
        'xp_awarded': total_xp
    }


def check_and_unlock_achievements(user):
    """
    Check all achievement requirements and unlock earned achievements

    Args:
        user: User object

    Returns:
        dict: {
            'achievements_unlocked': list of Achievement objects,
            'total_unlocked': int
        }
    """
    # Get user's current stats
    user_streak, _ = UserStreak.objects.get_or_create(user=user)

    # Count user's topics and revisions
    topic_count = Topic.objects.filter(user=user).count()

    flashcard_revision_count = FlashCardRevisionSchedule.objects.filter(
        flashcard__topic__user=user,
        completed=True
    ).count()

    topic_revision_count = RevisionSchedule.objects.filter(
        topic__user=user,
        completed=True
    ).count()

    total_revision_count = flashcard_revision_count + topic_revision_count

    # Get all achievements user hasn't unlocked yet
    unlocked_achievement_ids = UserAchievement.objects.filter(
        user=user
    ).values_list('achievement_id', flat=True)

    available_achievements = Achievement.objects.exclude(
        id__in=unlocked_achievement_ids
    )

    newly_unlocked = []

    for achievement in available_achievements:
        unlocked = False

        # Check requirement based on type
        if achievement.requirement_type == 'topic_count':
            if topic_count >= achievement.requirement_value:
                unlocked = True

        elif achievement.requirement_type == 'revision_count':
            if total_revision_count >= achievement.requirement_value:
                unlocked = True

        elif achievement.requirement_type == 'streak_days':
            if user_streak.current_streak >= achievement.requirement_value:
                unlocked = True

        elif achievement.requirement_type == 'total_study_days':
            if user_streak.total_study_days >= achievement.requirement_value:
                unlocked = True

        elif achievement.requirement_type == 'longest_streak':
            if user_streak.longest_streak >= achievement.requirement_value:
                unlocked = True

        # Unlock achievement if requirement met
        if unlocked:
            UserAchievement.objects.create(
                user=user,
                achievement=achievement
            )

            # Award XP for achievement
            user_level, _ = UserLevel.objects.get_or_create(user=user)
            user_level.award_xp(achievement.xp_reward)

            newly_unlocked.append(achievement)

    return {
        'achievements_unlocked': newly_unlocked,
        'total_unlocked': len(newly_unlocked)
    }


def process_revision_completion(user, is_flashcard=True):
    """
    Process all gamification updates when a revision is completed
    Convenience function that calls all update functions

    Args:
        user: User object
        is_flashcard: True if flashcard revision, False if topic revision

    Returns:
        dict: Combined results from all gamification updates
    """
    # Award XP
    xp_result = award_xp_for_revision(user, is_flashcard)

    # Update streak
    streak_result = update_streak(user)

    # Update daily goals
    goals_result = update_daily_goals(user, 'complete_revisions', value=1)

    # Check achievements
    achievements_result = check_and_unlock_achievements(user)

    return {
        'xp': xp_result,
        'streak': streak_result,
        'daily_goals': goals_result,
        'achievements': achievements_result
    }
