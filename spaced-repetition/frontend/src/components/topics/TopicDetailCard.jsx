import { useState, useEffect } from 'react';
import { Modal, Card, Badge, Spinner, Alert, Button, Row, Col } from 'react-bootstrap';
import { getTopic } from '../../services/api';
import { formatDateTime, formatDateFromTimestamp } from '../../utils/dateUtils';
import './TopicDetailCard.css';

const TopicDetailCard = ({ show, onHide, topicId }) => {
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    
    const completed = topic.revisions.filter(rev => rev.completed).length;
    const pending = topic.revisions.filter(rev => !rev.completed).length;
    const total = topic.revisions.length;
    
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
    
    return topic.revisions.filter(rev => 
      !rev.completed && new Date(rev.scheduled_date) < today
    ).length;
  };

  const handleClose = () => {
    setTopic(null);
    setError('');
    onHide();
  };

  const stats = calculateRevisionStats();
  const nextRevisionDate = getNextRevisionDate();
  const missedCount = getMissedRevisionCount();

  return (
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
            {/* Topic Header */}
            <div className="topic-header mb-4">
              <h3 className="topic-title mb-2">{topic.title}</h3>
              <div className="topic-meta">
                <Badge bg="light" text="dark" className="me-2">
                  <i className="bi bi-calendar-plus me-1"></i>
                  Created: {formatDateFromTimestamp(topic.created_at)}
                </Badge>
                <Badge bg="light" text="dark">
                  <i className="bi bi-clock me-1"></i>
                  {formatDateTime(topic.created_at)}
                </Badge>
              </div>
            </div>

            {/* Revision Statistics */}
            <Row className="mb-4">
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
            <Card className="mb-4">
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

            {/* Study Resource */}
            {topic.resource_url && (
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="mb-0">
                    <i className="bi bi-link-45deg me-2"></i>
                    Study Resource
                  </h5>
                </Card.Header>
                <Card.Body>
                  <a 
                    href={topic.resource_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="resource-link"
                  >
                    <i className="bi bi-box-arrow-up-right me-2"></i>
                    {topic.resource_url}
                  </a>
                </Card.Body>
              </Card>
            )}

            {/* Next Revision Info */}
            {nextRevisionDate && (
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="mb-0">
                    <i className="bi bi-calendar-check me-2"></i>
                    Next Revision
                  </h5>
                </Card.Header>
                <Card.Body>
                  <div className="next-revision-info">
                    <Badge bg="primary" className="me-2">
                      {formatDateFromTimestamp(nextRevisionDate)}
                    </Badge>
                    <span className="text-muted">
                      Your next revision is scheduled for this date
                    </span>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Revision History */}
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-clock-history me-2"></i>
                  Revision Schedule
                </h5>
              </Card.Header>
              <Card.Body>
                {topic.revisions && topic.revisions.length > 0 ? (
                  <div className="revision-timeline">
                    {topic.revisions
                      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
                      .map((revision, index) => (
                      <div key={revision.id} className="revision-item">
                        <div className={`revision-marker ${revision.completed ? 'completed' : 'pending'}`}>
                          {revision.completed ? (
                            <i className="bi bi-check-circle-fill"></i>
                          ) : (
                            <i className="bi bi-circle"></i>
                          )}
                        </div>
                        <div className="revision-content">
                          <div className="revision-date">
                            {formatDateFromTimestamp(revision.scheduled_date)}
                          </div>
                          <div className="revision-status">
                            <Badge 
                              bg={revision.completed ? 'success' : 'warning'}
                              className="me-2"
                            >
                              {revision.completed ? 'Completed' : 'Pending'}
                            </Badge>
                            <span className="revision-number">
                              Revision {index + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-center py-3">
                    No revisions scheduled
                  </p>
                )}
              </Card.Body>
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
  );
};

export default TopicDetailCard; 