import { useState, useEffect, useContext } from 'react';
import { Card, ListGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getTodaysRevisions } from '../../services/api';
import { RefreshContext } from '../../context/RefreshContext';
import { formatDate } from '../../utils/dateUtils';

const TodaysRevisionsList = () => {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { refreshTrigger } = useContext(RefreshContext);

  useEffect(() => {
    if (user) {
      fetchTodaysRevisions();
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

  const formatRevisionDate = (dateString) => {
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <Card className="h-100">
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-book me-2"></i>
            Today's Revisions
          </h5>
        </Card.Header>
        <Card.Body className="d-flex justify-content-center align-items-center">
          <Spinner animation="border" variant="primary" />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="h-100">
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
        
        {revisions.length === 0 ? (
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
                    <h6 className="mb-1 fw-semibold">{rev.topic?.title || 'Untitled Topic'}</h6>
                    <p className="mb-1 text-muted small">
                      Revision scheduled: {formatRevisionDate(rev.scheduled_date)}
                    </p>
                  </div>
                  <Badge bg="success" className="ms-2">
                    Pending
                  </Badge>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default TodaysRevisionsList; 