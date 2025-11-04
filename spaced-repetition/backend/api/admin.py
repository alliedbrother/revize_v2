from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from .models import Topic, RevisionSchedule, FlashCard, FlashCardRevisionSchedule

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
