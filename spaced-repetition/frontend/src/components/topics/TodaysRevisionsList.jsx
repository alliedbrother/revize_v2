import { useState, useEffect, useContext } from 'react';
import { Card, ListGroup, Badge, Spinner, Alert, Button, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getTodaysRevisions, getMissedRevisions, getCompletedTodayRevisions, completeRevision, postponeRevision } from '../../services/api';
import { RefreshContext } from '../dashboard/ModernDashboard';
import { formatDate } from '../../utils/dateUtils';
import TopicDetailCard from './TopicDetailCard';
import FlashcardReviewSession from '../flashcards/FlashcardReviewSession';
import './TodaysRevisionsList.css';

const TodaysRevisionsList = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [revisions, setRevisions] = useState([]);
  const [missedRevisions, setMissedRevisions] = useState([]);
  const [completedRevisions, setCompletedRevisions] = useState([]);
  const [allTodaysRevisions, setAllTodaysRevisions] = useState([]); // Keep all for repeated review
  const [allMissedRevisions, setAllMissedRevisions] = useState([]); // Keep all for repeated review
  const [loading, setLoading] = useState(true);
  const [missedLoading, setMissedLoading] = useState(true);
  const [completedLoading, setCompletedLoading] = useState(true);
  const [error, setError] = useState('');
  const [missedError, setMissedError] = useState('');
  const [completedError, setCompletedError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [showTopicDetail, setShowTopicDetail] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [showReviewSession, setShowReviewSession] = useState(false);
  const [sessionRevisions, setSessionRevisions] = useState([]);
  const { user } = useAuth();
  const { refreshTrigger, triggerRefresh } = useContext(RefreshContext);

  useEffect(() => {
    if (user) {
      fetchTodaysRevisions();
      fetchMissedRevisions();
      fetchCompletedTodayRevisions();
    }
  }, [user, refreshTrigger]);

  const fetchTodaysRevisions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getTodaysRevisions();

      // Handle new grouped response format
      let combinedRevisions = [];
      if (response) {
        // Check if response has the grouped format
        if (response.topic_revisions !== undefined && response.flashcard_topics !== undefined) {
          // Mark topic revisions
          const topicRevs = (response.topic_revisions || []).map(rev => ({
            ...rev,
            revision_type: 'topic'
          }));

          // Mark flashcard topic groups
          const flashcardTopicGroups = (response.flashcard_topics || []).map(group => ({
            ...group,
            revision_type: 'flashcard_group'
          }));

          combinedRevisions = [...topicRevs, ...flashcardTopicGroups];
        } else if (response.topic_revisions && response.flashcard_revisions) {
          // Old ungrouped format - for backward compatibility
          const topicRevs = (response.topic_revisions || []).map(rev => ({
            ...rev,
            revision_type: 'topic'
          }));

          const flashcardRevs = (response.flashcard_revisions || []).map(rev => ({
            ...rev,
            revision_type: 'flashcard'
          }));

          combinedRevisions = [...topicRevs, ...flashcardRevs];
        } else {
          // Very old format - just an array
          combinedRevisions = response.map(rev => ({
            ...rev,
            revision_type: 'topic'
          }));
        }
      }

      setRevisions(combinedRevisions);
      // Keep all revisions for repeated review (only set on first load, don't overwrite after completion)
      if (combinedRevisions && combinedRevisions.length > 0 && allTodaysRevisions.length === 0) {
        setAllTodaysRevisions(combinedRevisions);
      }
    } catch (err) {
      setError('Failed to fetch today\'s revisions');
      console.error('Error fetching today\'s revisions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMissedRevisions = async () => {
    try {
      setMissedLoading(true);
      setMissedError('');
      const response = await getMissedRevisions();

      // Handle new grouped response format
      let combinedRevisions = [];
      if (response) {
        // Check if response has the grouped format
        if (response.topic_revisions !== undefined && response.flashcard_topics !== undefined) {
          // Mark topic revisions
          const topicRevs = (response.topic_revisions || []).map(rev => ({
            ...rev,
            revision_type: 'topic'
          }));

          // Mark flashcard topic groups
          const flashcardTopicGroups = (response.flashcard_topics || []).map(group => ({
            ...group,
            revision_type: 'flashcard_group'
          }));

          combinedRevisions = [...topicRevs, ...flashcardTopicGroups];
        } else if (response.topic_revisions && response.flashcard_revisions) {
          // Old ungrouped format - for backward compatibility
          const topicRevs = (response.topic_revisions || []).map(rev => ({
            ...rev,
            revision_type: 'topic'
          }));

          const flashcardRevs = (response.flashcard_revisions || []).map(rev => ({
            ...rev,
            revision_type: 'flashcard'
          }));

          combinedRevisions = [...topicRevs, ...flashcardRevs];
        } else {
          // Very old format - just an array
          combinedRevisions = response.map(rev => ({
            ...rev,
            revision_type: 'topic'
          }));
        }
      }

      setMissedRevisions(combinedRevisions);
      // Keep all missed revisions for repeated review (only set on first load, don't overwrite after completion)
      if (combinedRevisions && combinedRevisions.length > 0 && allMissedRevisions.length === 0) {
        setAllMissedRevisions(combinedRevisions);
      }
    } catch (err) {
      setMissedError('Failed to fetch missed revisions');
      console.error('Error fetching missed revisions:', err);
    } finally {
      setMissedLoading(false);
    }
  };

  const fetchCompletedTodayRevisions = async () => {
    try {
      setCompletedLoading(true);
      setCompletedError('');
      const response = await getCompletedTodayRevisions();

      // Handle grouped response format
      let combinedRevisions = [];
      if (response) {
        if (response.flashcard_topics !== undefined) {
          // Mark flashcard topic groups
          const flashcardTopicGroups = (response.flashcard_topics || []).map(group => ({
            ...group,
            revision_type: 'flashcard_group'
          }));
          combinedRevisions = flashcardTopicGroups;
        }
      }

      setCompletedRevisions(combinedRevisions);
    } catch (err) {
      setCompletedError('Failed to fetch completed revisions');
      console.error('Error fetching completed revisions:', err);
    } finally {
      setCompletedLoading(false);
    }
  };

  const handleComplete = async (id, isMissed = false) => {
    setProcessingId(id);
    try {
      await completeRevision(id);
      triggerRefresh();
    } catch (err) {
      if (isMissed) setMissedError('Failed to complete revision');
      else setError('Failed to complete revision');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePostpone = async (id, isMissed = false) => {
    setProcessingId(id);
    try {
      await postponeRevision(id);
      triggerRefresh();
    } catch (err) {
      if (isMissed) setMissedError('Failed to postpone revision');
      else setError('Failed to postpone revision');
    } finally {
      setProcessingId(null);
    }
  };

  const formatRevisionDate = (dateString) => {
    return formatDate(dateString);
  };

  const getSourceTypeDisplay = (sourceType) => {
    const sourceTypeMap = {
      'document': { label: 'Document', variant: 'primary', icon: 'bi-file-earmark-text' },
      'link': { label: 'Link', variant: 'info', icon: 'bi-link-45deg' },
      'image': { label: 'Images', variant: 'warning', icon: 'bi-image' },
      'manual': { label: 'Manual', variant: 'secondary', icon: 'bi-pencil-square' }
    };
    return sourceTypeMap[sourceType] || { label: 'Topic', variant: 'secondary', icon: 'bi-journal-text' };
  };

  const handleTopicClick = (topicId) => {
    setSelectedTopicId(topicId);
    setShowTopicDetail(true);
  };

  const handleCloseTopicDetail = () => {
    setShowTopicDetail(false);
    setSelectedTopicId(null);
  };

  const handleStartReviewSession = () => {
    // Use allTodaysRevisions so users can review multiple times
    if (allTodaysRevisions.length > 0) {
      // Extract individual flashcards from flashcard_group type revisions
      const flashcards = allTodaysRevisions
        .filter(rev => rev.revision_type === 'flashcard_group')
        .flatMap(group => group.flashcards || []);

      if (flashcards.length > 0) {
        setSessionRevisions(flashcards);
        setShowReviewSession(true);
      }
    }
  };

  const handleStartMissedReviewSession = () => {
    // Use allMissedRevisions so users can review multiple times
    if (allMissedRevisions.length > 0) {
      // Extract individual flashcards from flashcard_group type revisions
      const flashcards = allMissedRevisions
        .filter(rev => rev.revision_type === 'flashcard_group')
        .flatMap(group => group.flashcards || []);

      if (flashcards.length > 0) {
        setSessionRevisions(flashcards);
        setShowReviewSession(true);
      }
    }
  };

  const handleStartFlashcardGroupReview = (flashcardGroup) => {
    // Start review session with flashcards from this topic
    if (flashcardGroup && flashcardGroup.flashcards && flashcardGroup.flashcards.length > 0) {
      setSessionRevisions(flashcardGroup.flashcards);
      setShowReviewSession(true);
    }
  };

  const handleCloseReviewSession = () => {
    setShowReviewSession(false);
    // Refresh data after session
    fetchTodaysRevisions();
    fetchMissedRevisions();
    fetchCompletedTodayRevisions();
    triggerRefresh();
  };

  const handleStartPracticeMode = (flashcardGroup) => {
    // Start review session in practice mode (no completion tracking)
    if (flashcardGroup && flashcardGroup.flashcards && flashcardGroup.flashcards.length > 0) {
      setSessionRevisions(flashcardGroup.flashcards.map(fc => ({ ...fc, isPracticeMode: true })));
      setShowReviewSession(true);
    }
  };

  return (
    <div className="todays-revisions-list">
      <Card className="h-100">
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-calendar-check me-2"></i>
            Revisions
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="revision-tabs"
          >
            {/* Today's Revisions Tab */}
            <Tab
              eventKey="today"
              title={
                <span className="d-flex align-items-center gap-2">
                  <i className="bi bi-book"></i>
                  <span>Today</span>
                  {revisions.length > 0 && (
                    <Badge bg="primary">
                      {revisions.length}
                    </Badge>
                  )}
                </span>
              }
            >
              <div className="tab-content-wrapper">
          {error && (
            <Alert variant="danger" className="m-3 mb-0">
              {error}
            </Alert>
          )}
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-journal-plus display-4 text-muted mb-3"></i>
              <p className="text-muted mb-0">No revisions scheduled for today</p>
              <small className="text-muted">You're all caught up!</small>
            </div>
          ) : (
            <ListGroup variant="flush">
              {revisions.map((rev, index) => (
                <ListGroup.Item key={`${rev.revision_type}-${rev.topic?.id || rev.id}-${index}`} className="border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="flex-grow-1">
                      {rev.revision_type === 'flashcard_group' ? (
                        <>
                          <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                            <Badge bg={getSourceTypeDisplay(rev.topic?.source_type).variant} className="me-2">
                              <i className={getSourceTypeDisplay(rev.topic?.source_type).icon + " me-1"}></i>
                              {getSourceTypeDisplay(rev.topic?.source_type).label}
                            </Badge>
                            {rev.topic?.title || 'Untitled Topic'}
                          </h6>
                          <p className="mb-1 text-muted small">
                            {rev.flashcard_count} flashcard{rev.flashcard_count > 1 ? 's' : ''} due for review
                          </p>
                        </>
                      ) : rev.revision_type === 'flashcard' ? (
                        <>
                          <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.flashcard?.topic?.id)}>
                            <Badge bg={getSourceTypeDisplay(rev.flashcard?.topic?.source_type).variant} className="me-2">
                              <i className={getSourceTypeDisplay(rev.flashcard?.topic?.source_type).icon + " me-1"}></i>
                              {getSourceTypeDisplay(rev.flashcard?.topic?.source_type).label}
                            </Badge>
                            {rev.flashcard?.title || 'Untitled Flashcard'}
                          </h6>
                          <p className="mb-1 text-muted small">
                            Topic: {rev.flashcard?.topic?.title || 'Untitled Topic'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                            <Badge bg={getSourceTypeDisplay(rev.topic?.source_type).variant} className="me-2">
                              <i className={getSourceTypeDisplay(rev.topic?.source_type).icon + " me-1"}></i>
                              {getSourceTypeDisplay(rev.topic?.source_type).label}
                            </Badge>
                            {rev.topic?.title || 'Untitled Topic'}
                          </h6>
                          <p className="mb-1 text-muted small">
                            Revision scheduled: {formatRevisionDate(rev.scheduled_date)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      {rev.revision_type === 'flashcard_group' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleStartFlashcardGroupReview(rev)}
                        >
                          <i className="bi bi-play-fill"></i>
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            disabled={processingId === rev.id}
                            onClick={() => handleComplete(rev.id)}
                          >
                            {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-check-lg"></i>}
                          </Button>
                          <Button
                            variant="warning"
                            size="sm"
                            disabled={processingId === rev.id}
                            onClick={() => handlePostpone(rev.id)}
                          >
                            {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-clock"></i>}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
              </div>
            </Tab>

            {/* Missed Revisions Tab */}
            <Tab
              eventKey="missed"
              title={
                <span className="d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>Missed</span>
                  {missedRevisions.length > 0 && (
                    <Badge bg="danger">
                      {missedRevisions.length}
                    </Badge>
                  )}
                </span>
              }
            >
              <div className="tab-content-wrapper">
          {missedError && (
            <Alert variant="danger" className="m-3 mb-0">
              {missedError}
            </Alert>
          )}
          {missedLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="danger" />
            </div>
          ) : missedRevisions.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-journal-x display-4 text-muted mb-3"></i>
              <p className="text-muted mb-0">No missed revisions!</p>
              <small className="text-muted">Great job staying on track!</small>
            </div>
          ) : (
            <ListGroup variant="flush">
              {missedRevisions.map((rev, index) => (
                <ListGroup.Item key={`missed-${rev.revision_type}-${rev.topic?.id || rev.id}-${index}`} className="border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="flex-grow-1">
                      {rev.revision_type === 'flashcard_group' ? (
                        <>
                          <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                            <Badge bg={getSourceTypeDisplay(rev.topic?.source_type).variant} className="me-2">
                              <i className={getSourceTypeDisplay(rev.topic?.source_type).icon + " me-1"}></i>
                              {getSourceTypeDisplay(rev.topic?.source_type).label}
                            </Badge>
                            {rev.topic?.title || 'Untitled Topic'}
                          </h6>
                          <p className="mb-1 text-muted small">
                            {rev.flashcard_count} flashcard{rev.flashcard_count > 1 ? 's' : ''} overdue
                          </p>
                        </>
                      ) : rev.revision_type === 'flashcard' ? (
                        <>
                          <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.flashcard?.topic?.id)}>
                            <Badge bg={getSourceTypeDisplay(rev.flashcard?.topic?.source_type).variant} className="me-2">
                              <i className={getSourceTypeDisplay(rev.flashcard?.topic?.source_type).icon + " me-1"}></i>
                              {getSourceTypeDisplay(rev.flashcard?.topic?.source_type).label}
                            </Badge>
                            {rev.flashcard?.title || 'Untitled Flashcard'}
                          </h6>
                          <p className="mb-1 text-muted small">
                            Topic: {rev.flashcard?.topic?.title || 'Untitled Topic'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                            <Badge bg={getSourceTypeDisplay(rev.topic?.source_type).variant} className="me-2">
                              <i className={getSourceTypeDisplay(rev.topic?.source_type).icon + " me-1"}></i>
                              {getSourceTypeDisplay(rev.topic?.source_type).label}
                            </Badge>
                            {rev.topic?.title || 'Untitled Topic'}
                          </h6>
                          <p className="mb-1 text-muted small">
                            Missed revision: {formatRevisionDate(rev.scheduled_date)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      {rev.revision_type === 'flashcard_group' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleStartFlashcardGroupReview(rev)}
                        >
                          <i className="bi bi-play-fill"></i>
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            disabled={processingId === rev.id}
                            onClick={() => handleComplete(rev.id, true)}
                          >
                            {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-check-lg"></i>}
                          </Button>
                          <Button
                            variant="warning"
                            size="sm"
                            disabled={processingId === rev.id}
                            onClick={() => handlePostpone(rev.id, true)}
                          >
                            {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-clock"></i>}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
              </div>
            </Tab>

            {/* Completed Today Tab */}
            <Tab
              eventKey="completed"
              title={
                <span className="d-flex align-items-center gap-2">
                  <i className="bi bi-check-circle"></i>
                  <span>Completed</span>
                  {completedRevisions.length > 0 && (
                    <Badge bg="success">
                      {completedRevisions.length}
                    </Badge>
                  )}
                </span>
              }
            >
              <div className="tab-content-wrapper">
            {completedError && (
              <Alert variant="danger" className="m-3 mb-0">
                {completedError}
              </Alert>
            )}
            {completedLoading ? (
              <div className="text-center py-4">
                <Spinner animation="border" variant="success" />
              </div>
            ) : (
              <ListGroup variant="flush">
                {completedRevisions.map((rev, index) => (
                  <ListGroup.Item key={`completed-${rev.topic?.id}-${index}`} className="border-0">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                          <Badge bg={getSourceTypeDisplay(rev.topic?.source_type).variant} className="me-2">
                            <i className={getSourceTypeDisplay(rev.topic?.source_type).icon + " me-1"}></i>
                            {getSourceTypeDisplay(rev.topic?.source_type).label}
                          </Badge>
                          {rev.topic?.title || 'Untitled Topic'}
                        </h6>
                        <p className="mb-1 text-muted small">
                          {rev.flashcard_count} flashcard{rev.flashcard_count > 1 ? 's' : ''} completed today
                        </p>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleStartPracticeMode(rev)}
                        >
                          <i className="bi bi-arrow-repeat"></i>
                        </Button>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Topic Detail Modal */}
      <TopicDetailCard
        show={showTopicDetail}
        onHide={handleCloseTopicDetail}
        topicId={selectedTopicId}
      />

      {/* Flashcard Review Session */}
      <FlashcardReviewSession
        revisions={sessionRevisions}
        show={showReviewSession}
        onHide={handleCloseReviewSession}
        onComplete={handleCloseReviewSession}
      />
    </div>
  );
};

export default TodaysRevisionsList; 