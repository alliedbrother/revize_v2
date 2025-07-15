import { useState, useEffect, useContext } from 'react';
import { Card, ListGroup, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getMissedRevisions, completeRevision, postponeRevision } from '../../services/api';
import { RefreshContext } from '../dashboard/ModernDashboard';

const MissedRevisionsList = () => {
  const [missedRevisions, setMissedRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [completedIds, setCompletedIds] = useState([]);
  const [postponedIds, setPostponedIds] = useState([]);
  const { user } = useAuth();
  const { refreshTrigger, triggerRefresh } = useContext(RefreshContext);

  useEffect(() => {
    if (user) {
      fetchMissedRevisions();
    }
  }, [user, refreshTrigger]);

  const fetchMissedRevisions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getMissedRevisions();
      setMissedRevisions(response.data || []);
    } catch (err) {
      setError('Failed to fetch missed revisions');
      console.error('Error fetching missed revisions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRevision = async (revisionId) => {
    try {
      setCompletedIds(prev => [...prev, revisionId]);
      
      setTimeout(async () => {
        await completeRevision(revisionId);
        setSuccess('Revision completed successfully!');
        setMissedRevisions(prev => prev.filter(rev => rev.id !== revisionId));
        setCompletedIds(prev => prev.filter(id => id !== revisionId));
        triggerRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }, 500);
    } catch (err) {
      setCompletedIds(prev => prev.filter(id => id !== revisionId));
      setError('Failed to complete revision: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePostponeRevision = async (revisionId) => {
    try {
      setPostponedIds(prev => [...prev, revisionId]);
      
      setTimeout(async () => {
        await postponeRevision(revisionId);
        setSuccess('Revision postponed successfully!');
        setMissedRevisions(prev => prev.filter(rev => rev.id !== revisionId));
        setPostponedIds(prev => prev.filter(id => id !== revisionId));
        triggerRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }, 500);
    } catch (err) {
      setPostponedIds(prev => prev.filter(id => id !== revisionId));
      setError('Failed to postpone revision: ' + (err.message || 'Unknown error'));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = today - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  if (loading) {
    return (
      <Card className="h-100">
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Missed Revisions
          </h5>
        </Card.Header>
        <Card.Body className="d-flex justify-content-center align-items-center">
          <Spinner animation="border" variant="warning" />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="h-100">
      <Card.Header>
        <h5 className="mb-0">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Missed Revisions
          {missedRevisions.length > 0 && (
            <Badge bg="danger" className="ms-2 notification-badge">
              {missedRevisions.length}
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
        {success && (
          <Alert variant="success" className="m-3 mb-0">
            {success}
          </Alert>
        )}
        
        {missedRevisions.length === 0 ? (
          <div className="text-center py-4">
            <i className="bi bi-check-circle display-4 text-success mb-3"></i>
            <p className="text-muted mb-0">No missed revisions!</p>
            <small className="text-muted">You're all caught up</small>
          </div>
        ) : (
          <ListGroup variant="flush">
            {missedRevisions.map((revision) => (
              <ListGroup.Item 
                key={revision.id} 
                className={`border-0 revision-item missed-revision ${
                  completedIds.includes(revision.id) ? 'completed-animation' : ''
                } ${
                  postponedIds.includes(revision.id) ? 'postponed-animation' : ''
                }`}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="flex-grow-1">
                    <h6 className="mb-1 fw-semibold revision-title">
                      {revision.topic_title}
                    </h6>
                    <p className="mb-1 text-muted small revision-content" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {revision.topic_content}
                    </p>
                    <small className="text-danger fw-semibold">
                      <i className="bi bi-clock me-1"></i>
                      Due: {formatDate(revision.scheduled_date)}
                    </small>
                  </div>
                </div>
                <div className="revision-actions">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleCompleteRevision(revision.id)}
                    disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                  >
                    <i className="bi bi-check-lg me-1"></i>
                    Complete
                  </Button>
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={() => handlePostponeRevision(revision.id)}
                    disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                  >
                    <i className="bi bi-clock me-1"></i>
                    Postpone
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default MissedRevisionsList; 