import { useState, useEffect, useRef } from 'react';
import { Modal } from 'react-bootstrap';
import { completeFlashcardRevision, postponeFlashcardRevision, startStudySession, endStudySession } from '../../services/api';
import MarkdownRenderer from './MarkdownRenderer';
import './FlashcardReviewSession.css';

const FlashcardReviewSession = ({ revisions, show, onHide, onComplete, viewMode = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Time tracking state
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const [sessionId, setSessionId] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    totalTimeSeconds: 0,
    cardsReviewed: 0,
    cardsPostponed: 0
  });

  const cardRef = useRef(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  useEffect(() => {
    if (show) {
      // Reset state when modal opens
      setCurrentIndex(0);
      setSessionEnded(false);
      setCardStartTime(Date.now());
      setSessionStats({
        totalTimeSeconds: 0,
        cardsReviewed: 0,
        cardsPostponed: 0
      });

      // Start a new study session (only if not in view mode)
      if (!viewMode) {
        startStudySession()
          .then(response => {
            setSessionId(response.session?.id || null);
          })
          .catch(err => {
            console.warn('Could not start study session:', err);
          });
      }
    }
  }, [show, viewMode]);

  // Reset card start time when navigating to a new card
  useEffect(() => {
    setCardStartTime(Date.now());
  }, [currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!show || sessionEnded) return;

    const handleKeyPress = (e) => {
      if (processing) return;

      switch(e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          handleNext();
          break;
        case 'Escape':
          handleExit();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [show, currentIndex, sessionEnded, processing, revisions]);

  // Touch handlers for mobile swipe
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left = Next
      handleNext();
    }
    if (isRightSwipe) {
      // Swipe right = Previous
      handlePrevious();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < revisions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleEndSession();
    }
  };

  const handleGotIt = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const currentCard = revisions[currentIndex];

      // Calculate time spent on this card (auto-tracked)
      const timeSpentSeconds = Math.round((Date.now() - cardStartTime) / 1000);

      // Only call API if not in practice mode
      if (!currentCard.isPracticeMode) {
        await completeFlashcardRevision(currentCard.id, {
          time_spent_seconds: timeSpentSeconds,
          session_id: sessionId
        });
      }

      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        totalTimeSeconds: prev.totalTimeSeconds + timeSpentSeconds,
        cardsReviewed: prev.cardsReviewed + 1
      }));

      // Move to next card
      if (currentIndex < revisions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        handleEndSession();
      }
    } catch (error) {
      console.error('Error completing revision:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewLater = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const currentCard = revisions[currentIndex];

      // Calculate time spent on this card before postponing (auto-tracked)
      const timeSpentSeconds = Math.round((Date.now() - cardStartTime) / 1000);

      // Only call API if not in practice mode
      if (!currentCard.isPracticeMode) {
        await postponeFlashcardRevision(currentCard.id, {
          time_spent_seconds: timeSpentSeconds,
          session_id: sessionId
        });
      }

      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        totalTimeSeconds: prev.totalTimeSeconds + timeSpentSeconds,
        cardsPostponed: prev.cardsPostponed + 1
      }));

      // Move to next card
      if (currentIndex < revisions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        handleEndSession();
      }
    } catch (error) {
      console.error('Error postponing revision:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleExit = () => {
    handleEndSession();
  };

  const handleEndSession = async () => {
    // End the study session on the backend
    if (sessionId && !viewMode) {
      try {
        await endStudySession(sessionId);
      } catch (error) {
        console.warn('Could not end study session:', error);
      }
    }
    setSessionEnded(true);
  };

  // Helper to format time for display
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  };

  const handleCloseSession = () => {
    onHide();
    if (onComplete) {
      onComplete();
    }
  };

  // Helper function to safely extract content from different data structures
  const getCardContent = (card) => {
    if (!card) return null;

    // Try different possible content locations
    return card.flashcard?.content
      || card.topic?.content
      || card.content
      || null;
  };

  const getCardTitle = (card) => {
    if (!card) return 'Untitled';

    return card.flashcard?.title
      || card.topic?.title
      || card.title
      || 'Untitled';
  };

  const getTopicTitle = (card) => {
    if (!card) return 'Untitled';

    return card.flashcard?.topic?.title
      || card.topic?.title
      || 'Untitled';
  };

  // Early return if modal is not shown
  if (!show) return null;

  // Handle empty or invalid revisions
  if (!revisions || revisions.length === 0) {
    return (
      <Modal
        show={show}
        onHide={onHide}
        fullscreen
        className="flashcard-review-modal"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Body className="flashcard-empty-state">
          <div className="empty-icon">📚</div>
          <h2>No Flashcards Available</h2>
          <p>There are no flashcards to review at this time.</p>
          <button className="btn-close-empty" onClick={onHide}>
            Close
          </button>
        </Modal.Body>
      </Modal>
    );
  }

  const currentCard = revisions[currentIndex];
  const progress = ((currentIndex + 1) / revisions.length) * 100;
  const remaining = revisions.length - currentIndex - 1;
  const cardContent = getCardContent(currentCard);
  const cardTitle = getCardTitle(currentCard);
  const topicTitle = getTopicTitle(currentCard);

  return (
    <Modal
      show={show}
      onHide={handleExit}
      fullscreen
      className="flashcard-review-modal"
      backdrop="static"
      keyboard={false}
    >
      <Modal.Body className="flashcard-review-body">
        {!sessionEnded ? (
          <>
            {/* Progress Bar */}
            <div className="flashcard-progress-container">
              {/* Practice Mode Banner - Always visible at top */}
              {currentCard.isPracticeMode && (
                <div className="practice-mode-banner">
                  <i className="bi bi-arrow-repeat"></i>
                  <span>Practice Mode</span>
                </div>
              )}
              <div className="flashcard-progress-info">
                <span className="progress-text">
                  Card {currentIndex + 1} of {revisions.length}
                </span>
                <div className="progress-right">
                  <span className="remaining-text">
                    {remaining} remaining
                  </span>
                  <button className="btn-exit" onClick={handleExit} title="Exit (Esc)">
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
              <div className="flashcard-progress-bar">
                <div
                  className="flashcard-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Flashcard Display */}
            <div className="flashcard-container">
              <div
                ref={cardRef}
                className="flashcard"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="flashcard-header">
                  <h3 className="flashcard-title">{cardTitle}</h3>
                  <span className="flashcard-topic-badge">
                    <i className="bi bi-folder2"></i>
                    {topicTitle}
                  </span>
                </div>

                <div className="flashcard-content-wrapper">
                  <MarkdownRenderer content={cardContent} />

                  {!currentCard.flashcard && currentCard.topic?.resource_url && (
                    <div className="flashcard-resource">
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
            </div>

            {/* Navigation Buttons */}
            <div className={`flashcard-actions ${viewMode ? 'view-mode' : ''}`}>
              <button
                className="action-btn btn-previous"
                onClick={handlePrevious}
                disabled={currentIndex === 0 || processing}
                title="Previous (←)"
              >
                <i className="bi bi-chevron-left"></i>
                <span className="btn-text">Previous</span>
              </button>

              <button
                className="action-btn btn-next"
                onClick={currentIndex === revisions.length - 1 ? handleEndSession : handleNext}
                disabled={processing}
                title={currentIndex === revisions.length - 1 ? "Close" : "Next (→)"}
              >
                <span className="btn-text">{currentIndex === revisions.length - 1 ? "Close" : "Next"}</span>
                <i className={`bi ${currentIndex === revisions.length - 1 ? 'bi-x-lg' : 'bi-chevron-right'}`}></i>
              </button>
            </div>
          </>
        ) : (
          /* Session Complete Screen */
          <div className="session-complete">
            <div className="complete-icon">
              <i className="bi bi-trophy-fill"></i>
            </div>
            <h2>Session Complete!</h2>
            <p className="complete-message">Great job! You've reviewed all the flashcards.</p>

            <div className="session-stats">
              <div className="stat-item">
                <div className="stat-number">{revisions.length}</div>
                <div className="stat-label">Total Cards</div>
              </div>
              {sessionStats.totalTimeSeconds > 0 && (
                <div className="stat-item">
                  <div className="stat-number">{formatTime(sessionStats.totalTimeSeconds)}</div>
                  <div className="stat-label">Study Time</div>
                </div>
              )}
              {sessionStats.cardsReviewed > 0 && (
                <div className="stat-item">
                  <div className="stat-number">{sessionStats.cardsReviewed}</div>
                  <div className="stat-label">Mastered</div>
                </div>
              )}
              {sessionStats.cardsPostponed > 0 && (
                <div className="stat-item">
                  <div className="stat-number">{sessionStats.cardsPostponed}</div>
                  <div className="stat-label">To Review</div>
                </div>
              )}
            </div>

            <button className="btn-close-session" onClick={handleCloseSession}>
              <i className="bi bi-check-circle"></i>
              Close
            </button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default FlashcardReviewSession;
