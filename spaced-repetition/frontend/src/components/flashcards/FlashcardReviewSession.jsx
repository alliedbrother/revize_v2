import { useState, useEffect, useRef } from 'react';
import { Modal } from 'react-bootstrap';
import { completeFlashcardRevision, postponeFlashcardRevision } from '../../services/api';
import './FlashcardReviewSession.css';

const FlashcardReviewSession = ({ revisions, show, onHide, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCards, setCompletedCards] = useState([]);
  const [reviewLaterCards, setReviewLaterCards] = useState([]);
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
      setCompletedCards([]);
      setReviewLaterCards([]);
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
          handleGotIt();
          break;
        case 'ArrowDown':
          handleReviewLater();
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
  }, [show, currentIndex, sessionEnded, processing]);

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
      // Swipe left = Next/Got it
      handleGotIt();
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

      setCompletedCards([...completedCards, currentCard.id]);

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

      setReviewLaterCards([...reviewLaterCards, currentCard.id]);

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
    if (window.confirm('Are you sure you want to exit? Your progress will be saved.')) {
      endSession();
    }
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

  if (!show || revisions.length === 0) return null;

  const currentCard = revisions[currentIndex];
  const progress = ((currentIndex + 1) / revisions.length) * 100;
  const remaining = revisions.length - currentIndex - 1;

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
                    <span className="badge bg-success me-2">
                      <i className="bi bi-arrow-repeat me-1"></i>
                      Practice Mode
                    </span>
                  )}
                  Card {currentIndex + 1} of {revisions.length}
                </span>
                <div className="progress-right">
                  <span className="remaining-text">
                    {remaining} remaining
                  </span>
                  <button className="btn-exit" onClick={handleExit}>
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
                  <h3 className="flashcard-topic">
                    {currentCard.flashcard ? currentCard.flashcard.title : (currentCard.topic?.title || 'Untitled')}
                  </h3>
                  <span className="flashcard-number">#{currentIndex + 1}</span>
                </div>

                <div className="flashcard-content">
                  <p>{currentCard.flashcard ? currentCard.flashcard.content : (currentCard.topic?.content || 'No content available')}</p>

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
                    {currentCard.flashcard ? currentCard.flashcard.topic?.title : (currentCard.topic?.title || 'Untitled')}
                  </span>
                  <span className="meta-divider">•</span>
                  <span className="meta-item">
                    <i className="bi bi-calendar3"></i>
                    {currentCard.scheduled_date ? new Date(currentCard.scheduled_date).toLocaleDateString() : 'Invalid Date'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flashcard-actions">
              <button
                className="action-btn btn-previous"
                onClick={handlePrevious}
                disabled={currentIndex === 0 || processing}
              >
                <i className="bi bi-chevron-left"></i>
                <span className="btn-text">Previous</span>
              </button>

              <button
                className="action-btn btn-review-later"
                onClick={handleReviewLater}
                disabled={processing}
              >
                <i className="bi bi-clock-history"></i>
                <span className="btn-text">Review Later</span>
              </button>

              <button
                className="action-btn btn-got-it"
                onClick={handleGotIt}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="spinner-small"></div>
                    <span className="btn-text">Processing...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    <span className="btn-text">Got it!</span>
                  </>
                )}
              </button>

              <button
                className="action-btn btn-next"
                onClick={handleNext}
                disabled={processing}
              >
                <span className="btn-text">Next</span>
                <i className="bi bi-chevron-right"></i>
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
                <div className="stat-number">{completedCards.length}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{reviewLaterCards.length}</div>
                <div className="stat-label">Review Later</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{revisions.length}</div>
                <div className="stat-label">Total Cards</div>
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
