import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Button, Alert, Badge, Spinner, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';

// Fallback API functions for when backend is not available
const fallbackAPI = {
  getTodaysRevisions: async () => {
    // Return mock data for demonstration
    return [
      {
        id: 1,
        topic_name: "React Hooks",
        revision_number: 3,
        scheduled_date: new Date().toISOString(),
        postponed: false
      },
      {
        id: 2,
        topic_name: "JavaScript Promises",
        revision_number: 1,
        scheduled_date: new Date().toISOString(),
        postponed: false
      }
    ];
  },
  getMissedRevisions: async () => {
    return [
      {
        id: 3,
        topic_name: "CSS Grid",
        revision_number: 2,
        scheduled_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        postponed: false
      }
    ];
  },
  completeRevision: async (id) => {
    console.log(`Completing revision ${id}`);
    return { success: true };
  },
  postponeRevision: async (id) => {
    console.log(`Postponing revision ${id}`);
    return { success: true };
  },
  getServerTime: async () => {
    return { current_time: new Date().toISOString() };
  }
};

// Try to import real API, fall back to mock if not available
let apiService;
try {
  apiService = require('../../services/api');
} catch (error) {
  console.log('API service not available, using fallback');
  apiService = fallbackAPI;
}

const {
  getTodaysRevisions = fallbackAPI.getTodaysRevisions,
  getMissedRevisions = fallbackAPI.getMissedRevisions,
  completeRevision = fallbackAPI.completeRevision,
  postponeRevision = fallbackAPI.postponeRevision,
  getServerTime = fallbackAPI.getServerTime
} = apiService;

const TodaysRevisions = () => {
  const [revisions, setRevisions] = useState([]);
  const [missedRevisions, setMissedRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missedLoading, setMissedLoading] = useState(true);
  const [error, setError] = useState('');
  const [missedError, setMissedError] = useState('');
  const [success, setSuccess] = useState('');
  const [completedIds, setCompletedIds] = useState([]); // Track animations
  const [postponedIds, setPostponedIds] = useState([]); // Track animations
  const [serverTime, setServerTime] = useState(null);
  const [activeTab, setActiveTab] = useState('regular');
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShownCelebration, setHasShownCelebration] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadServerTime();
    loadTodaysRevisions();
    loadMissedRevisions();
  }, []);

  // Check if all tasks are completed and trigger celebration
  useEffect(() => {
    const regularRevisions = revisions.filter(rev => !rev.postponed);
    const postponedRevisions = revisions.filter(rev => rev.postponed);
    
    // Check if all tasks are completed (no regular revisions, no postponed revisions, no missed revisions)
    // Only trigger if we have finished loading and there were initially some tasks
    const allTasksCompleted = 
      !loading && 
      !missedLoading && 
      regularRevisions.length === 0 && 
      postponedRevisions.length === 0 && 
      missedRevisions.length === 0 &&
      !hasShownCelebration;
    
    if (allTasksCompleted) {
      // Add a small delay to ensure the UI has updated
      setTimeout(() => {
        setShowCelebration(true);
        setHasShownCelebration(true);
      }, 800);
    }
  }, [revisions, missedRevisions, loading, missedLoading, hasShownCelebration]);

  const loadServerTime = async () => {
    try {
      const data = await getServerTime();
      setServerTime(data);
    } catch (err) {
      console.error("Error loading server time:", err);
    }
  };

  const loadTodaysRevisions = async () => {
    try {
      setLoading(true);
      const data = await getTodaysRevisions();
      setRevisions(data);
      setError('');
    } catch (err) {
      setError('Failed to load revisions');
      console.error("Error loading today's revisions:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadMissedRevisions = async () => {
    try {
      setMissedLoading(true);
      const data = await getMissedRevisions();
      setMissedRevisions(data);
      setMissedError('');
    } catch (err) {
      setMissedError('Failed to load missed revisions');
      console.error("Error loading missed revisions:", err);
    } finally {
      setMissedLoading(false);
    }
  };

  const handleComplete = async (revisionId, isMissed = false) => {
    try {
      // Start animation
      setCompletedIds(prev => [...prev, revisionId]);
      
      // Wait a bit for animation to play
      setTimeout(async () => {
        await completeRevision(revisionId);
        setSuccess('Revision completed successfully!');
        
        // Update local state
        if (isMissed) {
          setMissedRevisions(missedRevisions.filter(rev => rev.id !== revisionId));
        } else {
          setRevisions(revisions.filter(rev => rev.id !== revisionId));
        }
        
        // Clear animation state
        setCompletedIds(prev => prev.filter(id => id !== revisionId));
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }, 500);
    } catch (err) {
      setCompletedIds(prev => prev.filter(id => id !== revisionId));
      setError('Failed to complete revision: ' + (err.message || 'Unknown error'));
      console.error("Error completing revision:", err);
    }
  };

  const handlePostpone = async (revisionId, isMissed = false) => {
    try {
      // Start animation
      setPostponedIds(prev => [...prev, revisionId]);
      
      // Wait a bit for animation to play
      setTimeout(async () => {
        await postponeRevision(revisionId);
        setSuccess('Revision postponed successfully!');
        
        // Update local state
        if (isMissed) {
          setMissedRevisions(missedRevisions.filter(rev => rev.id !== revisionId));
        } else {
          setRevisions(revisions.filter(rev => rev.id !== revisionId));
        }
        
        // Clear animation state
        setPostponedIds(prev => prev.filter(id => id !== revisionId));
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }, 500);
    } catch (err) {
      setPostponedIds(prev => prev.filter(id => id !== revisionId));
      setError('Failed to postpone revision: ' + (err.message || 'Unknown error'));
      console.error("Error postponing revision:", err);
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
  };

  const formatServerDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  // Separate regular and postponed revisions
  const regularRevisions = revisions.filter(rev => !rev.postponed);
  const postponedRevisions = revisions.filter(rev => rev.postponed);

  const renderTodaysRevisions = () => {
    return (
      <Card className="revision-card shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center revision-card-header">
          <div>
            <h4 className="mb-0 fw-bold">
              <i className="bi bi-calendar-check me-2"></i>
              Today's Learning
            </h4>
          </div>
        </Card.Header>
        <Card.Body className="revision-card-body">
          {error && <Alert variant="danger" className="mb-3 alert-animated">{error}</Alert>}
          {success && <Alert variant="success" className="mb-3 alert-animated">{success}</Alert>}
          
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading your revisions...</p>
            </div>
          ) : (
            <>
              {regularRevisions.length === 0 && postponedRevisions.length === 0 ? (
                <div className="text-center py-4 no-revisions">
                  <div className="mb-3">
                    <i className="bi bi-check-circle text-success" style={{ fontSize: '3rem' }}></i>
                  </div>
                  <h5 className="text-success">Great job!</h5>
                  <p className="text-muted">You've completed all your revisions for today.</p>
                </div>
              ) : (
                <ListGroup variant="flush">
                  {regularRevisions.map((revision) => (
                    <ListGroup.Item 
                      key={revision.id} 
                      className={`revision-item d-flex justify-content-between align-items-center py-3
                        ${completedIds.includes(revision.id) ? 'completing' : ''}
                        ${postponedIds.includes(revision.id) ? 'postponing' : ''}
                      `}
                    >
                      <div className="revision-content">
                        <h6 className="mb-1 fw-semibold topic-title">{revision.topic_name}</h6>
                        <div className="d-flex align-items-center gap-2">
                          <Badge bg="primary" className="revision-badge">
                            Revision #{revision.revision_number}
                          </Badge>
                          <small className="text-muted">
                            Due: {new Date(revision.scheduled_date).toLocaleDateString()}
                          </small>
                        </div>
                      </div>
                      <div className="revision-actions">
                        <Button
                          variant="success"
                          size="sm"
                          className="me-2 action-btn complete-btn"
                          onClick={() => handleComplete(revision.id)}
                          disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                        >
                          {completedIds.includes(revision.id) ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-1" />
                              Completing...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check-lg me-1"></i>
                              Complete
                            </>
                          )}
                        </Button>
                        <Button
                          variant="warning"
                          size="sm"
                          className="action-btn postpone-btn"
                          onClick={() => handlePostpone(revision.id)}
                          disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                        >
                          {postponedIds.includes(revision.id) ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-1" />
                              Postponing...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-clock me-1"></i>
                              Postpone
                            </>
                          )}
                        </Button>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
              
              {postponedRevisions.length > 0 && (
                <div className="mt-4 postponed-section">
                  <h6 className="text-warning mb-3">
                    <i className="bi bi-clock-history me-2"></i>
                    Postponed Today ({postponedRevisions.length})
                  </h6>
                  <ListGroup variant="flush">
                    {postponedRevisions.map((revision) => (
                      <ListGroup.Item 
                        key={revision.id} 
                        className={`revision-item postponed-item d-flex justify-content-between align-items-center py-3
                          ${completedIds.includes(revision.id) ? 'completing' : ''}
                          ${postponedIds.includes(revision.id) ? 'postponing' : ''}
                        `}
                      >
                        <div className="revision-content">
                          <h6 className="mb-1 fw-semibold topic-title">{revision.topic_name}</h6>
                          <div className="d-flex align-items-center gap-2">
                            <Badge bg="warning" className="revision-badge">
                              Revision #{revision.revision_number}
                            </Badge>
                            <small className="text-muted">
                              Postponed from: {new Date(revision.scheduled_date).toLocaleDateString()}
                            </small>
                          </div>
                        </div>
                        <div className="revision-actions">
                          <Button
                            variant="success"
                            size="sm"
                            className="me-2 action-btn complete-btn"
                            onClick={() => handleComplete(revision.id)}
                            disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                          >
                            {completedIds.includes(revision.id) ? (
                              <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Completing...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-check-lg me-1"></i>
                                Complete
                              </>
                            )}
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    );
  };

  const renderMissedRevisions = () => {
    return (
      <Card className="revision-card shadow-sm mt-4">
        <Card.Header className="revision-card-header">
          <h5 className="mb-0 fw-bold text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Missed Revisions ({missedRevisions.length})
          </h5>
        </Card.Header>
        <Card.Body>
          {missedError && <Alert variant="danger" className="mb-3">{missedError}</Alert>}
          
          {missedLoading ? (
            <div className="text-center py-3">
              <Spinner animation="border" variant="danger" />
              <p className="mt-2 text-muted">Loading missed revisions...</p>
            </div>
          ) : missedRevisions.length === 0 ? (
            <Alert variant="success" className="mb-0">
              <i className="bi bi-check-circle-fill me-2"></i>
              No missed revisions! You're up to date.
            </Alert>
          ) : (
            <ListGroup variant="flush">
              {missedRevisions.map((revision) => (
                <ListGroup.Item 
                  key={revision.id} 
                  className={`revision-item missed-item d-flex justify-content-between align-items-center py-3
                    ${completedIds.includes(revision.id) ? 'completing' : ''}
                    ${postponedIds.includes(revision.id) ? 'postponing' : ''}
                  `}
                >
                  <div className="revision-content">
                    <h6 className="mb-1 fw-semibold topic-title">{revision.topic_name}</h6>
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg="danger" className="revision-badge">
                        Revision #{revision.revision_number}
                      </Badge>
                      <small className="text-muted">
                        Missed: {new Date(revision.scheduled_date).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                  <div className="revision-actions">
                    <Button
                      variant="success"
                      size="sm"
                      className="me-2 action-btn complete-btn"
                      onClick={() => handleComplete(revision.id, true)}
                      disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                    >
                      {completedIds.includes(revision.id) ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-lg me-1"></i>
                          Complete
                        </>
                      )}
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      className="action-btn postpone-btn"
                      onClick={() => handlePostpone(revision.id, true)}
                      disabled={completedIds.includes(revision.id) || postponedIds.includes(revision.id)}
                    >
                      {postponedIds.includes(revision.id) ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          Postponing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-clock me-1"></i>
                          Postpone
                        </>
                      )}
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

  return (
    <div className="todays-revisions">
      {renderTodaysRevisions()}
      {renderMissedRevisions()}
      {/* CelebrationAnimation component was removed from imports, so it's removed from here */}
    </div>
  );
};

export default TodaysRevisions; 