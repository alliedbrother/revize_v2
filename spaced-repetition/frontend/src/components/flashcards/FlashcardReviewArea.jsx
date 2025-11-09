import { useState, useEffect, useContext } from 'react';
import { Spinner } from 'react-bootstrap';
import { getTodaysRevisions, getMissedRevisions, completeFlashcardRevision, postponeFlashcardRevision } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { RefreshContext } from '../dashboard/ModernDashboard';
import MarkdownRenderer from './MarkdownRenderer';
import './FlashcardReviewArea.css';

const FlashcardReviewArea = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [todayFlashcards, setTodayFlashcards] = useState([]);
  const [missedFlashcards, setMissedFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const { user } = useAuth();
  const { refreshTrigger, triggerRefresh } = useContext(RefreshContext);

  // Get current flashcards based on active tab
  const currentFlashcards = activeTab === 'today' ? todayFlashcards : missedFlashcards;

  useEffect(() => {
    if (user) {
      fetchAllFlashcards();
    }
  }, [user, refreshTrigger]);

  const fetchAllFlashcards = async () => {
    try {
      setLoading(true);

      // Fetch both today's and missed revisions
      const [todayResponse, missedResponse] = await Promise.all([
        getTodaysRevisions(),
        getMissedRevisions()
      ]);

      // Extract flashcards from grouped response format
      const extractFlashcards = (response) => {
        if (!response) return [];

        if (response.flashcard_topics) {
          // New grouped format
          return response.flashcard_topics
            .flatMap(group => group.flashcards || []);
        } else if (response.flashcard_revisions) {
          // Old ungrouped format
          return response.flashcard_revisions;
        }
        return [];
      };

      const todayCards = extractFlashcards(todayResponse);
      const missedCards = extractFlashcards(missedResponse);

      setTodayFlashcards(todayCards);
      setMissedFlashcards(missedCards);
      setCurrentIndex(0);
      setCompletedCount(0);
      setSessionComplete(false);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentIndex(0);
    setCompletedCount(0);
    setSessionComplete(false);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < currentFlashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleGotIt = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const currentCard = currentFlashcards[currentIndex];

      // Complete the flashcard
      await completeFlashcardRevision(currentCard.id);
      setCompletedCount(prev => prev + 1);

      // Move to next card or end session
      if (currentIndex < currentFlashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setSessionComplete(true);
        triggerRefresh();
      }
    } catch (error) {
      console.error('Error completing flashcard:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRestart = () => {
    fetchAllFlashcards();
  };

  // Helper functions to extract content
  const getCardContent = (card) => {
    if (!card) return null;
    return card.flashcard?.content || card.topic?.content || card.content || null;
  };

  const getCardTitle = (card) => {
    if (!card) return 'Untitled';
    return card.flashcard?.title || card.topic?.title || card.title || 'Untitled';
  };

  const getTopicTitle = (card) => {
    if (!card) return 'Untitled';
    return card.flashcard?.topic?.title || card.topic?.title || 'Untitled';
  };

  // Loading state
  if (loading) {
    return (
      <div className="flashcard-review-area">
        <div className="review-loading">
          <Spinner animation="border" variant="primary" />
          <p>Loading flashcards...</p>
        </div>
      </div>
    );
  }

  // No flashcards state
  if (currentFlashcards.length === 0) {
    return (
      <div className="flashcard-review-area">
        {/* Tab Navigation */}
        <div className="flashcard-tabs">
          <button
            className={`flashcard-tab ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => handleTabChange('today')}
          >
            <i className="bi bi-calendar-day"></i>
            Today
            {todayFlashcards.length > 0 && <span className="tab-badge">{todayFlashcards.length}</span>}
          </button>
          <button
            className={`flashcard-tab ${activeTab === 'missed' ? 'active' : ''}`}
            onClick={() => handleTabChange('missed')}
          >
            <i className="bi bi-exclamation-triangle"></i>
            Missed
            {missedFlashcards.length > 0 && <span className="tab-badge">{missedFlashcards.length}</span>}
          </button>
        </div>

        <div className="review-empty-state">
          <div className="empty-icon">🎉</div>
          <h2>No Cards to Review {activeTab === 'today' ? 'Today' : 'in Missed'}!</h2>
          <p>You're all caught up! Check back later for more revisions.</p>
        </div>
      </div>
    );
  }

  // Session complete state
  if (sessionComplete) {
    return (
      <div className="flashcard-review-area">
        {/* Tab Navigation */}
        <div className="flashcard-tabs">
          <button
            className={`flashcard-tab ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => handleTabChange('today')}
          >
            <i className="bi bi-calendar-day"></i>
            Today
            {todayFlashcards.length > 0 && <span className="tab-badge">{todayFlashcards.length}</span>}
          </button>
          <button
            className={`flashcard-tab ${activeTab === 'missed' ? 'active' : ''}`}
            onClick={() => handleTabChange('missed')}
          >
            <i className="bi bi-exclamation-triangle"></i>
            Missed
            {missedFlashcards.length > 0 && <span className="tab-badge">{missedFlashcards.length}</span>}
          </button>
        </div>

        <div className="review-complete-state">
          <div className="complete-icon">
            <i className="bi bi-trophy-fill"></i>
          </div>
          <h2>Session Complete!</h2>
          <p>Great job! You've reviewed all {activeTab === 'today' ? "today's" : 'missed'} flashcards.</p>

          <div className="complete-stats">
            <div className="stat-card stat-easy">
              <div className="stat-number">{completedCount}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card stat-total">
              <div className="stat-number">{currentFlashcards.length}</div>
              <div className="stat-label">Total Cards</div>
            </div>
          </div>

          <button className="btn-restart" onClick={handleRestart}>
            <i className="bi bi-arrow-repeat"></i>
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // Active review state
  const currentCard = currentFlashcards[currentIndex];
  const progress = ((currentIndex + 1) / currentFlashcards.length) * 100;
  const cardContent = getCardContent(currentCard);
  const cardTitle = getCardTitle(currentCard);
  const topicTitle = getTopicTitle(currentCard);

  return (
    <div className="flashcard-review-area">
      {/* Tab Navigation */}
      <div className="flashcard-tabs">
        <button
          className={`flashcard-tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => handleTabChange('today')}
        >
          <i className="bi bi-calendar-day"></i>
          Today
          {todayFlashcards.length > 0 && <span className="tab-badge">{todayFlashcards.length}</span>}
        </button>
        <button
          className={`flashcard-tab ${activeTab === 'missed' ? 'active' : ''}`}
          onClick={() => handleTabChange('missed')}
        >
          <i className="bi bi-exclamation-triangle"></i>
          Missed
          {missedFlashcards.length > 0 && <span className="tab-badge">{missedFlashcards.length}</span>}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="review-progress">
        <div className="progress-info">
          <span className="progress-label">
            Card {currentIndex + 1} of {currentFlashcards.length}
          </span>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Flashcard Display */}
      <div className="review-card-container">
        <div className="review-card">
          <div className="card-header-section">
            <div className="card-header-content">
              <h2 className="card-title">{cardTitle}</h2>
              <span className="card-topic">
                <i className="bi bi-folder2"></i>
                {topicTitle}
              </span>
            </div>
          </div>

          <div className="card-content-section">
            <MarkdownRenderer content={cardContent} />
          </div>

          {currentCard.topic?.resource_url && (
            <div className="card-resource-link">
              <i className="bi bi-link-45deg"></i>
              <a
                href={currentCard.topic.resource_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Resource
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="review-actions">
        <button
          className="action-button btn-previous"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          title="Previous card"
        >
          <i className="bi bi-chevron-left"></i>
          Previous
        </button>

        <button
          className="action-button btn-got-it"
          onClick={handleGotIt}
          disabled={processing}
          title="Mark as completed and continue"
        >
          {processing ? (
            <>
              <i className="bi bi-hourglass-split"></i>
              Processing...
            </>
          ) : (
            <>
              <i className="bi bi-check-lg"></i>
              Got it!
            </>
          )}
        </button>

        <button
          className="action-button btn-next"
          onClick={handleNext}
          disabled={currentIndex === currentFlashcards.length - 1 || processing}
          title="Next card (without marking)"
        >
          Next
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default FlashcardReviewArea;
