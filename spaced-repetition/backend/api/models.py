from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import datetime

# Create your models here.

class Topic(models.Model):
    SOURCE_TYPE_CHOICES = [
        ('manual', 'Manual Entry'),
        ('link', 'Web Link'),
        ('image', 'Image Upload'),
        ('document', 'Document Upload'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    content = models.TextField(default="")
    resource_url = models.URLField(max_length=500, blank=True, null=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default='manual')
    source_file = models.FileField(upload_to='topic_sources/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class RevisionSchedule(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='revisions')
    scheduled_date = models.DateField()
    completed = models.BooleanField(default=False)
    postponed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date']

    def __str__(self):
        return f"{self.topic.title} - {self.scheduled_date}"

    def postpone(self):
        """Postpone the revision by one day"""
        self.scheduled_date = self.scheduled_date + timezone.timedelta(days=1)
        self.postponed = True
        self.save()

    def complete(self):
        """Mark the revision as completed"""
        self.completed = True
        self.save()

    @staticmethod
    def create_schedule(topic, base_date=None):
        """Create a complete revision schedule for a new topic

        Args:
            topic: The Topic model instance
            base_date: The date from which to calculate revision dates (defaults to today)
        """
        # Spaced repetition intervals in days
        intervals = [1, 4, 9, 16, 25, 39, 60]

        # Use provided base_date or default to today
        if base_date is None:
            base_date = timezone.now().date()

        print(f"Creating revision schedule starting from: {base_date}")

        for interval in intervals:
            scheduled_date = base_date + timezone.timedelta(days=interval)
            RevisionSchedule.objects.create(
                topic=topic,
                scheduled_date=scheduled_date
            )


class FlashCard(models.Model):
    """Individual flashcard generated from a topic"""
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='flashcards')
    title = models.CharField(max_length=300)
    content = models.TextField()
    order = models.IntegerField(default=0)  # Order within the topic
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['topic', 'order']

    def __str__(self):
        return f"{self.topic.title} - Card {self.order}"


class FlashCardRevisionSchedule(models.Model):
    """Revision schedule for individual flashcards"""
    flashcard = models.ForeignKey(FlashCard, on_delete=models.CASCADE, related_name='revisions')
    scheduled_date = models.DateField()
    completed = models.BooleanField(default=False)
    postponed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date']

    def __str__(self):
        return f"{self.flashcard.title} - {self.scheduled_date}"

    def postpone(self):
        """Postpone the revision by one day"""
        self.scheduled_date = self.scheduled_date + timezone.timedelta(days=1)
        self.postponed = True
        self.save()

    def complete(self):
        """Mark the revision as completed"""
        self.completed = True
        self.save()

    @staticmethod
    def create_schedule(flashcard, base_date=None):
        """Create a complete revision schedule for a flashcard

        Args:
            flashcard: The FlashCard model instance
            base_date: The date from which to calculate revision dates (defaults to today)
        """
        # Spaced repetition intervals in days
        intervals = [1, 4, 9, 16, 25, 39, 60]

        # Use provided base_date or default to today
        if base_date is None:
            base_date = timezone.now().date()

        for interval in intervals:
            scheduled_date = base_date + timezone.timedelta(days=interval)
            FlashCardRevisionSchedule.objects.create(
                flashcard=flashcard,
                scheduled_date=scheduled_date
            )

