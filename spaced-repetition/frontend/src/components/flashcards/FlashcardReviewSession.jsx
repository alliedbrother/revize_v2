import { useState, useEffect, useRef } from 'react';
import { Modal } from 'react-bootstrap';
import { completeFlashcardRevision, postponeFlashcardRevision } from '../../services/api';
import MarkdownRenderer from './MarkdownRenderer';
import './FlashcardReviewSession.css';

const FlashcardReviewSession = ({ revisions, show, onHide, onComplete, viewMode = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const cardRef = useRef(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  useEffect(() => {
    if (show) {
      // Reset state when modal opens
      setCurrentIndex(0);
      setSessionEnded(false);
    }
  }, [show]);

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
      endSession();
    }
  };

  const handleGotIt = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const currentCard = revisions[currentIndex];

      // Only call API if not in practice mode
      if (!currentCard.isPracticeMode) {
        await completeFlashcardRevision(currentCard.id);
      }

      // Move to next card
      if (currentIndex < revisions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        endSession();
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

      // Only call API if not in practice mode
      if (!currentCard.isPracticeMode) {
        await postponeFlashcardRevision(currentCard.id);
      }

      // Move to next card
      if (currentIndex < revisions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        endSession();
      }
    } catch (error) {
      console.error('Error postponing revision:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleExit = () => {
    endSession();
  };

  const endSession = () => {
    setSessionEnded(true);
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
              <div className="flashcard-progress-info">
                <span className="progress-text">
                  {currentCard.isPracticeMode && (
                    <span className="badge-practice">
                      <i className="bi bi-arrow-repeat"></i>
                      Practice
                    </span>
                  )}
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

                <div className="flashcard-meta">
                  <span className="meta-item">
                    <i className="bi bi-folder2"></i>
                    {topicTitle}
                  </span>
                  <span className="meta-divider">•</span>
                  <span className="meta-item">
                    <i className="bi bi-calendar3"></i>
                    {currentCard.scheduled_date
                      ? new Date(currentCard.scheduled_date).toLocaleDateString()
                      : 'N/A'}
                  </span>
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
                onClick={currentIndex === revisions.length - 1 ? endSession : handleNext}
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
                <div className="stat-label">Total Cards Reviewed</div>
              </div>
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
