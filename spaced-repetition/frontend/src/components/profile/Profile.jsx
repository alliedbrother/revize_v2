import { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Container, Row, Col, Badge, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getStatistics } from '../../services/api';
import './Profile.css';

const Profile = () => {
  const { user, changePassword, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validatePasswordChange = () => {
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      setError('Please fill in all password fields');
      return false;
    }

    if (passwordData.new_password.length < 6) {
      setError('New password must be at least 6 characters long');
      return false;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return false;
    }

    return true;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePasswordChange()) {
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      
      const { success, error } = await changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });

      if (success) {
        setSuccess('Password updated successfully');
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        setTimeout(() => {
          setShowPasswordModal(false);
          setSuccess('');
        }, 2000);
      } else {
        setError(error || 'Failed to update password');
      }
    } catch (err) {
      console.error('Password change error:', err);
      setError('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordData({
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    setError('');
    setSuccess('');
  };

  // Get user initial for avatar
  const getUserInitial = () => {
    if (user?.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Fetch statistics on component mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const data = await getStatistics();
        setStats(data);
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  return (
    <div className="modern-profile-page">
      <Container fluid className="profile-wrapper">
        {/* Hero Section */}
        <Card className="profile-hero-card">
          <Card.Body className="profile-hero-body">
            <div className="profile-avatar-large">
              <span className="avatar-initial">{getUserInitial()}</span>
            </div>
            <div className="profile-header-info">
              <h1 className="profile-display-name">{user?.username || 'User'}</h1>
              <p className="profile-email-display">
                <i className="bi bi-envelope me-2"></i>
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </Card.Body>
        </Card>

        {/* Main Content */}
        <Row className="profile-content-row g-4">
          {/* Learning Stats */}
          <Col lg={12}>
            <Card className="stats-card">
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart-fill me-2"></i>
                  Learning Statistics
                </h5>
              </Card.Header>
              <Card.Body>
                {statsLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <Row className="g-4">
                    <Col md={3} sm={6}>
                      <div className="stat-item">
                        <div className="stat-icon-wrapper bg-primary bg-opacity-10">
                          <i className="bi bi-journal-text text-primary"></i>
                        </div>
                        <div className="stat-content">
                          <div className="stat-number">{stats?.total_topics || 0}</div>
                          <div className="stat-label">Total Topics</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} sm={6}>
                      <div className="stat-item">
                        <div className="stat-icon-wrapper bg-success bg-opacity-10">
                          <i className="bi bi-check-circle text-success"></i>
                        </div>
                        <div className="stat-content">
                          <div className="stat-number">{stats?.completed_revisions || 0}</div>
                          <div className="stat-label">Completed Revisions</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} sm={6}>
                      <div className="stat-item">
                        <div className="stat-icon-wrapper bg-warning bg-opacity-10">
                          <i className="bi bi-hourglass-split text-warning"></i>
                        </div>
                        <div className="stat-content">
                          <div className="stat-number">{stats?.pending_revisions || 0}</div>
                          <div className="stat-label">Pending Revisions</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} sm={6}>
                      <div className="stat-item">
                        <div className="stat-icon-wrapper bg-info bg-opacity-10">
                          <i className="bi bi-calendar-week text-info"></i>
                        </div>
                        <div className="stat-content">
                          <div className="stat-number">{stats?.topics_this_week || 0}</div>
                          <div className="stat-label">Topics This Week</div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Account Actions */}
          <Col lg={12}>
            <Card className="actions-card">
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-gear me-2"></i>
                  Account Settings
                </h5>
              </Card.Header>
              <Card.Body>
                <div className="actions-grid">
                  <Button
                    variant="outline-primary"
                    className="action-btn"
                    onClick={() => setShowPasswordModal(true)}
                  >
                    <i className="bi bi-shield-lock me-2"></i>
                    Change Password
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="action-btn"
                    onClick={logout}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Sign Out
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Password Change Modal */}
      <Modal show={showPasswordModal} onHide={closePasswordModal} centered>
        <Modal.Header closeButton className="password-modal-header">
          <Modal.Title className="password-modal-title">
            <i className="bi bi-shield-lock me-2"></i>
            Change Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="password-modal-body">
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {success && <Alert variant="success" className="mb-3">{success}</Alert>}
          
          <Form onSubmit={handlePasswordSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className="password-label">Current Password</Form.Label>
              <Form.Control
                type="password"
                name="current_password"
                value={passwordData.current_password}
                onChange={handlePasswordChange}
                className="password-input"
                placeholder="Enter your current password"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="password-label">New Password</Form.Label>
              <Form.Control
                type="password"
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                className="password-input"
                placeholder="Enter your new password"
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="password-label">Confirm New Password</Form.Label>
              <Form.Control
                type="password"
                name="confirm_password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                className="password-input"
                placeholder="Confirm your new password"
                required
              />
            </Form.Group>

            <div className="password-modal-actions">
              <Button
                variant="outline-secondary"
                onClick={closePasswordModal}
                className="cancel-password-btn"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={loading}
                className="save-password-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Updating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-2"></i>
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Profile; 