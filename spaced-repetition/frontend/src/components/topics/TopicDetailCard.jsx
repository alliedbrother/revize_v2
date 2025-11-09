import { useState, useEffect } from 'react';
import { Modal, Card, Badge, Spinner, Alert, Button, Row, Col, Collapse } from 'react-bootstrap';
import { getTopic } from '../../services/api';
import { formatDateTime, formatDateFromTimestamp } from '../../utils/dateUtils';
import FlashcardReviewSession from '../flashcards/FlashcardReviewSession';
import './TopicDetailCard.css';

const TopicDetailCard = ({ show, onHide, topicId }) => {
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFlashcardReview, setShowFlashcardReview] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  useEffect(() => {
    if (show && topicId) {
      fetchTopicDetails();
    }
  }, [show, topicId]);

  const fetchTopicDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getTopic(topicId);
      setTopic(data);
    } catch (err) {
      setError('Failed to load topic details');
      console.error('Error fetching topic details:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRevisionStats = () => {
    if (!topic || !topic.revisions) {
      return { completed: 0, pending: 0, total: 0 };
    }

    // Group revisions by date
    const groupedByDate = topic.revisions.reduce((acc, rev) => {
      const dateKey = rev.scheduled_date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(rev);
      return acc;
    }, {});

    // Count dates where ALL flashcards are completed
    const completed = Object.values(groupedByDate).filter(revs =>
      revs.every(r => r.completed)
    ).length;

    // Count dates where at least one flashcard is pending
    const pending = Object.values(groupedByDate).filter(revs =>
      revs.some(r => !r.completed)
    ).length;

    // Total number of unique revision dates
    const total = Object.keys(groupedByDate).length;

    return { completed, pending, total };
  };

  const getNextRevisionDate = () => {
    if (!topic || !topic.revisions) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingRevisions = topic.revisions
      .filter(rev => !rev.completed && new Date(rev.scheduled_date) >= today)
      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
    
    return upcomingRevisions.length > 0 ? upcomingRevisions[0].scheduled_date : null;
  };

  const getMissedRevisionCount = () => {
    if (!topic || !topic.revisions) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group revisions by date
    const groupedByDate = topic.revisions.reduce((acc, rev) => {
      const dateKey = rev.scheduled_date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(rev);
      return acc;
    }, {});

    // Count dates that are before today and have at least one incomplete flashcard
    return Object.entries(groupedByDate).filter(([date, revs]) => {
      const revisionDate = new Date(date);
      revisionDate.setHours(0, 0, 0, 0);
      return revisionDate < today && revs.some(r => !r.completed);
    }).length;
  };

  const handleClose = () => {
    setTopic(null);
    setError('');
    setShowFlashcardReview(false);
    onHide();
  };

  const handleFlashcardReviewClose = () => {
    setShowFlashcardReview(false);
  };

  const prepareFlashcardsForReview = () => {
    if (!topic || !topic.flashcards) return [];

    // Format flashcards to match the structure expected by FlashcardReviewSession
    return topic.flashcards.map((flashcard) => ({
      id: null, // No revision ID since this is just viewing
      flashcard: {
        id: flashcard.id,
        title: flashcard.title,
        content: flashcard.content,
        topic: {
          id: topic.id,
          title: topic.title
        }
      },
      scheduled_date: null,
      completed: false,
      isPracticeMode: true // This prevents API calls for completion
    }));
  };

  const stats = calculateRevisionStats();
  const nextRevisionDate = getNextRevisionDate();
  const missedCount = getMissedRevisionCount();

  return (
    <>
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="topic-detail-header">
        <Modal.Title>
          <i className="bi bi-info-circle me-2"></i>
          Topic Details
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="topic-detail-body">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Loading topic details...</p>
          </div>
        ) : error ? (
          <Alert variant="danger" className="text-center">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        ) : topic ? (
          <>
            {/* Topic Header - Compact Inline */}
            <div className="topic-header">
              <h3 className="topic-title">{topic.title}</h3>
              <div className="topic-meta">
                <Badge>
                  <i className="bi bi-calendar-plus me-1"></i>
                  {formatDateFromTimestamp(topic.created_at)}
                </Badge>
              </div>
            </div>

            {/* Revision Statistics */}
            <Row className="mb-3">
              <Col md={3}>
                <Card className="stat-card text-center">
                  <Card.Body>
                    <div className="stat-icon completed">
                      <i className="bi bi-check-circle-fill"></i>
                    </div>
                    <h4 className="stat-number">{stats.completed}</h4>
                    <p className="stat-label">Completed</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="stat-card text-center">
                  <Card.Body>
                    <div className="stat-icon pending">
                      <i className="bi bi-clock-fill"></i>
                    </div>
                    <h4 className="stat-number">{stats.pending}</h4>
                    <p className="stat-label">Pending</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="stat-card text-center">
                  <Card.Body>
                    <div className="stat-icon total">
                      <i className="bi bi-list-ul"></i>
                    </div>
                    <h4 className="stat-number">{stats.total}</h4>
                    <p className="stat-label">Total</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="stat-card text-center">
                  <Card.Body>
                    <div className="stat-icon missed">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <h4 className="stat-number">{missedCount}</h4>
                    <p className="stat-label">Missed</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Topic Description */}
            <Card className="mb-3">
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-file-text me-2"></i>
                  Description
                </h5>
              </Card.Header>
              <Card.Body>
                <p className="description-text">{topic.content}</p>
              </Card.Body>
            </Card>

            {/* Flashcards Section */}
            {topic.flashcards && topic.flashcards.length > 0 && (
              <Card className="mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="bi bi-card-heading me-2"></i>
                    Flashcards
                    <Badge bg="primary" className="ms-2">{topic.flashcards.length}</Badge>
                  </h5>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowFlashcardReview(true)}
                  >
                    <i className="bi bi-eye me-1"></i>
                    View Flashcards
                  </Button>
                </Card.Header>
              </Card>
            )}

            {/* Revision History - Collapsible */}
            <Card>
              <Card.Header>
                <button
                  className={`timeline-toggle ${timelineExpanded ? '' : 'collapsed'}`}
                  onClick={() => setTimelineExpanded(!timelineExpanded)}
                  aria-expanded={timelineExpanded}
                >
                  <span>
                    <i className="bi bi-clock-history me-2"></i>
                    Revision Schedule
                  </span>
                  <i className={`bi bi-chevron-down`}></i>
                </button>
              </Card.Header>
              <Collapse in={timelineExpanded}>
                <Card.Body className="timeline-content">
                {topic.revisions && topic.revisions.length > 0 ? (
                  <div className="revision-timeline">
                    {(() => {
                      // Group revisions by date
                      const groupedByDate = topic.revisions.reduce((acc, revision) => {
                        const dateKey = revision.scheduled_date;
                        if (!acc[dateKey]) {
                          acc[dateKey] = [];
                        }
                        acc[dateKey].push(revision);
                        return acc;
                      }, {});

                      // Sort dates and render
                      return Object.entries(groupedByDate)
                        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
                        .map(([date, revisions], index) => {
                          const completedCount = revisions.filter(r => r.completed).length;
                          const totalCount = revisions.length;
                          const allCompleted = completedCount === totalCount;

                          return (
                            <div key={date} className="revision-item">
                              <div className={`revision-marker ${allCompleted ? 'completed' : 'pending'}`}>
                                {allCompleted ? (
                                  <i className="bi bi-check-circle-fill"></i>
                                ) : (
                                  <i className="bi bi-circle"></i>
                                )}
                              </div>
                              <div className="revision-content">
                                <div className="revision-date">
                                  {formatDateFromTimestamp(date)}
                                </div>
                                <div className="revision-status">
                                  <Badge
                                    bg={allCompleted ? 'success' : 'warning'}
                                    className="me-2"
                                  >
                                    {allCompleted ? 'Completed' : 'Pending'}
                                  </Badge>
                                  <span className="revision-number">
                                    {totalCount > 1
                                      ? `${totalCount} flashcards ${allCompleted ? 'completed' : 'due'}`
                                      : `Revision ${index + 1}`
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                ) : (
                  <p className="timeline-empty">
                    No revisions scheduled
                  </p>
                )}
                </Card.Body>
              </Collapse>
            </Card>
          </>
        ) : (
          <Alert variant="info" className="text-center">
            <i className="bi bi-info-circle me-2"></i>
            Topic not found
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          <i className="bi bi-x-lg me-1"></i>
          Close
        </Button>
      </Modal.Footer>
    </Modal>

    {/* Flashcard Review Session Modal */}
    <FlashcardReviewSession
      revisions={prepareFlashcardsForReview()}
      show={showFlashcardReview}
      onHide={handleFlashcardReviewClose}
      onComplete={handleFlashcardReviewClose}
      viewMode={true}
    />
    </>
  );
};

export default TopicDetailCard; 