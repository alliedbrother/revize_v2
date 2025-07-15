import { useState, useEffect, useContext } from 'react';
import { Card, ListGroup, Badge, Spinner, Alert, Button } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getTodaysRevisions, getMissedRevisions, completeRevision, postponeRevision } from '../../services/api';
import { RefreshContext } from '../dashboard/ModernDashboard';
import { formatDate } from '../../utils/dateUtils';
import TopicDetailCard from './TopicDetailCard';
import './TodaysRevisionsList.css';

const TodaysRevisionsList = () => {
  const [revisions, setRevisions] = useState([]);
  const [missedRevisions, setMissedRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missedLoading, setMissedLoading] = useState(true);
  const [error, setError] = useState('');
  const [missedError, setMissedError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [showTopicDetail, setShowTopicDetail] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const { user } = useAuth();
  const { refreshTrigger, triggerRefresh } = useContext(RefreshContext);

  useEffect(() => {
    if (user) {
      fetchTodaysRevisions();
      fetchMissedRevisions();
    }
  }, [user, refreshTrigger]);

  const fetchTodaysRevisions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getTodaysRevisions();
      setRevisions(response || []);
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
      setMissedRevisions(response || []);
    } catch (err) {
      setMissedError('Failed to fetch missed revisions');
      console.error('Error fetching missed revisions:', err);
    } finally {
      setMissedLoading(false);
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

  const handleTopicClick = (topicId) => {
    setSelectedTopicId(topicId);
    setShowTopicDetail(true);
  };

  const handleCloseTopicDetail = () => {
    setShowTopicDetail(false);
    setSelectedTopicId(null);
  };

  return (
    <div className="todays-revisions-list">
      {/* Today's Revisions Section */}
      <Card className="h-100 mb-4">
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-book me-2"></i>
            Today's Revisions
            {revisions.length > 0 && (
              <Badge bg="primary" className="ms-2">
                {revisions.length}
              </Badge>
            )}
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
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
              {revisions.map((rev) => (
                <ListGroup.Item key={rev.id} className="border-0">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                        {rev.topic?.title || 'Untitled Topic'}
                      </h6>
                      <p className="mb-1 text-muted small">
                        Revision scheduled: {formatRevisionDate(rev.scheduled_date)}
                      </p>
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={processingId === rev.id}
                        onClick={() => handleComplete(rev.id)}
                      >
                        {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-check-lg me-1"></i>}
                        Complete
                      </Button>
                      <Button
                        variant="warning"
                        size="sm"
                        disabled={processingId === rev.id}
                        onClick={() => handlePostpone(rev.id)}
                      >
                        {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-clock me-1"></i>}
                        Postpone
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Missed Revisions Section */}
      <Card className="h-100">
        <Card.Header>
          <h5 className="mb-0 text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Missed Revisions
            {missedRevisions.length > 0 && (
              <Badge bg="danger" className="ms-2">
                {missedRevisions.length}
              </Badge>
            )}
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
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
              {missedRevisions.map((rev) => (
                <ListGroup.Item key={rev.id} className="border-0">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <h6 className="mb-1 fw-semibold clickable-topic" onClick={() => handleTopicClick(rev.topic?.id)}>
                        {rev.topic?.title || 'Untitled Topic'}
                      </h6>
                      <p className="mb-1 text-muted small">
                        Missed revision: {formatRevisionDate(rev.scheduled_date)}
                      </p>
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={processingId === rev.id}
                        onClick={() => handleComplete(rev.id, true)}
                      >
                        {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-check-lg me-1"></i>}
                        Complete
                      </Button>
                      <Button
                        variant="warning"
                        size="sm"
                        disabled={processingId === rev.id}
                        onClick={() => handlePostpone(rev.id, true)}
                      >
                        {processingId === rev.id ? <Spinner size="sm" animation="border" /> : <i className="bi bi-clock me-1"></i>}
                        Postpone
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Topic Detail Modal */}
      <TopicDetailCard
        show={showTopicDetail}
        onHide={handleCloseTopicDetail}
        topicId={selectedTopicId}
      />
    </div>
  );
};

export default TodaysRevisionsList; 