import { useState, useEffect, useContext } from 'react';
import { Card, Row, Col, Alert, Button, ProgressBar } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getStatistics } from '../../services/api';
import { RefreshContext } from './ModernDashboard';
import './css/Statistics.css';

const Statistics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { refreshTrigger } = useContext(RefreshContext);

  useEffect(() => {
    loadStatistics();
  }, [refreshTrigger]); // Refresh when triggerRefresh is called

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await getStatistics();
      setStats(data);
      setError('');
    } catch (err) {
      setError('Failed to load statistics');
      console.error("Error loading statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="statistics-loading">
        <i className="bi bi-graph-up spinning"></i>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return <Alert variant="info">No statistics available yet.</Alert>;
  }

  const completionRate = stats.total_revisions > 0
    ? Math.round((stats.completed_revisions / stats.total_revisions) * 100)
    : 0;

  return (
    <div className="statistics-container">
      <Card className="statistics-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            <i className="bi bi-bar-chart-fill me-2"></i>
            Your Learning Statistics
          </h4>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={loadStatistics}
            disabled={loading}
          >
            <i className={`bi bi-arrow-repeat me-1 ${loading ? 'spinning' : ''}`}></i>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Key Metrics Grid */}
          <Row className="g-4 mb-4">
            <Col md={3} sm={6}>
              <Card className="metric-card h-100">
                <Card.Body className="text-center">
                  <div className="metric-icon-wrapper bg-primary bg-opacity-10 mx-auto mb-3">
                    <i className="bi bi-journal-text text-primary"></i>
                  </div>
                  <h2 className="metric-value mb-1">{stats.total_topics || 0}</h2>
                  <p className="metric-label text-muted mb-0">Total Topics</p>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3} sm={6}>
              <Card className="metric-card h-100">
                <Card.Body className="text-center">
                  <div className="metric-icon-wrapper bg-success bg-opacity-10 mx-auto mb-3">
                    <i className="bi bi-check-circle text-success"></i>
                  </div>
                  <h2 className="metric-value mb-1">{stats.completed_revisions || 0}</h2>
                  <p className="metric-label text-muted mb-0">Completed Revisions</p>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3} sm={6}>
              <Card className="metric-card h-100">
                <Card.Body className="text-center">
                  <div className="metric-icon-wrapper bg-warning bg-opacity-10 mx-auto mb-3">
                    <i className="bi bi-hourglass-split text-warning"></i>
                  </div>
                  <h2 className="metric-value mb-1">{stats.pending_revisions || 0}</h2>
                  <p className="metric-label text-muted mb-0">Pending Revisions</p>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3} sm={6}>
              <Card className="metric-card h-100">
                <Card.Body className="text-center">
                  <div className="metric-icon-wrapper bg-info bg-opacity-10 mx-auto mb-3">
                    <i className="bi bi-calendar-week text-info"></i>
                  </div>
                  <h2 className="metric-value mb-1">{stats.topics_this_week || 0}</h2>
                  <p className="metric-label text-muted mb-0">Topics This Week</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Completion Progress */}
          <Row>
            <Col xs={12}>
              <Card className="progress-card">
                <Card.Header>
                  <h5 className="mb-0">
                    <i className="bi bi-graph-up me-2"></i>
                    Overall Progress
                  </h5>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="fw-semibold">Completion Rate</span>
                      <span className="fw-bold text-primary">{completionRate}%</span>
                    </div>
                    <ProgressBar
                      now={completionRate}
                      variant="primary"
                      className="custom-progress-bar"
                      style={{ height: '12px' }}
                    />
                  </div>

                  <Row className="text-center mt-4 pt-3 border-top">
                    <Col xs={4}>
                      <div className="stat-detail">
                        <div className="stat-value text-success">{stats.completed_revisions || 0}</div>
                        <div className="stat-label text-muted small">Completed</div>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="stat-detail">
                        <div className="stat-value text-warning">{stats.pending_revisions || 0}</div>
                        <div className="stat-label text-muted small">Pending</div>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="stat-detail">
                        <div className="stat-value text-primary">{stats.total_revisions || 0}</div>
                        <div className="stat-label text-muted small">Total</div>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Statistics; 