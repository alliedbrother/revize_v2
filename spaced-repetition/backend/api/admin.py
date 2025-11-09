from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from .models import (
    Topic, RevisionSchedule, FlashCard, FlashCardRevisionSchedule,
    UserStreak, UserLevel, DailyGoal, Achievement, UserAchievement,
    UserCredit, PromoCode, PromoCodeRedemption, CreditUsageLog, UserProfile
)

class TokenInline(admin.TabularInline):
    model = Token
    readonly_fields = ['key', 'created']
    can_delete = False
    max_num = 1
    verbose_name_plural = 'Authentication Token'

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_active', 'date_joined', 'last_login')
    list_filter = ('is_active', 'is_staff', 'date_joined')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    inlines = [TokenInline]
    actions = ['reset_password']
    
    def reset_password(self, request, queryset):
        for user in queryset:
            user.set_password('resetpassword123')
            user.save()
        self.message_user(request, f"Reset password to 'resetpassword123' for {queryset.count()} users.")
    reset_password.short_description = "Reset password to 'resetpassword123'"

# Unregister the default UserAdmin
admin.site.unregister(User)
# Register the CustomUserAdmin
admin.site.register(User, CustomUserAdmin)

@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'source_type', 'created_at')
    list_filter = ('created_at', 'source_type')
    search_fields = ('title', 'content')
    readonly_fields = ('created_at',)

@admin.register(RevisionSchedule)
class RevisionScheduleAdmin(admin.ModelAdmin):
    list_display = ('topic', 'scheduled_date', 'completed', 'postponed')
    list_filter = ('scheduled_date', 'completed', 'postponed')
    search_fields = ('topic__title',)
    readonly_fields = ('created_at',)

@admin.register(FlashCard)
class FlashCardAdmin(admin.ModelAdmin):
    list_display = ('title', 'topic', 'order', 'created_at')
    list_filter = ('created_at', 'topic')
    search_fields = ('title', 'content', 'topic__title')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('topic', 'order')

@admin.register(FlashCardRevisionSchedule)
class FlashCardRevisionScheduleAdmin(admin.ModelAdmin):
    list_display = ('flashcard', 'scheduled_date', 'completed', 'postponed')
    list_filter = ('scheduled_date', 'completed', 'postponed')
    search_fields = ('flashcard__title', 'flashcard__topic__title')
    readonly_fields = ('created_at', 'updated_at')

# Gamification Models
@admin.register(UserStreak)
class UserStreakAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_streak', 'longest_streak', 'total_study_days', 'last_activity_date')
    list_filter = ('last_activity_date',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('last_activity_date', 'created_at', 'updated_at')

@admin.register(UserLevel)
class UserLevelAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_level', 'total_xp', 'xp_to_next_level')
    list_filter = ('current_level',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(DailyGoal)
class DailyGoalAdmin(admin.ModelAdmin):
    list_display = ('user', 'goal_type', 'date', 'target_value', 'current_value', 'completed')
    list_filter = ('date', 'goal_type', 'completed')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at',)

@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'tier', 'requirement_type', 'requirement_value', 'xp_reward')
    list_filter = ('category', 'tier', 'requirement_type')
    search_fields = ('name', 'description')

@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement', 'unlocked_at')
    list_filter = ('unlocked_at', 'achievement__category', 'achievement__tier')
    search_fields = ('user__username', 'user__email', 'achievement__name')
    readonly_fields = ('unlocked_at',)

# User Profile Model
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'profile_picture', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')

# Credit System Models
@admin.register(UserCredit)
class UserCreditAdmin(admin.ModelAdmin):
    list_display = ('user', 'available_credits', 'total_credits_earned', 'total_credits_used', 'unlimited_access')
    list_filter = ('unlimited_access', 'created_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')

    def get_readonly_fields(self, request, obj=None):
        # Make total_credits_earned and total_credits_used read-only
        if obj:
            return self.readonly_fields + ('total_credits_earned', 'total_credits_used')
        return self.readonly_fields

@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'tier', 'credits_granted', 'grants_unlimited', 'times_redeemed', 'max_redemptions', 'active')
    list_filter = ('tier', 'grants_unlimited', 'active', 'created_at')
    search_fields = ('code',)
    readonly_fields = ('code_hash', 'times_redeemed', 'created_at')

    def save_model(self, request, obj, form, change):
        # Generate code_hash when creating or updating
        if not obj.code_hash or 'code' in form.changed_data:
            import hashlib
            obj.code_hash = hashlib.sha256(obj.code.encode()).hexdigest()
        super().save_model(request, obj, form, change)

@admin.register(PromoCodeRedemption)
class PromoCodeRedemptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'promo_code', 'credits_granted', 'unlimited_granted', 'redeemed_at', 'ip_address')
    list_filter = ('unlimited_granted', 'redeemed_at')
    search_fields = ('user__username', 'user__email', 'promo_code__code')
    readonly_fields = ('redeemed_at', 'ip_address')

@admin.register(CreditUsageLog)
class CreditUsageLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'credits_changed', 'credits_after', 'unlimited_after', 'created_at')
    list_filter = ('action', 'unlimited_after', 'created_at')
    search_fields = ('user__username', 'user__email', 'description')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
