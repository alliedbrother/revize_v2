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

  // Calculate days since joining (placeholder)
  const getDaysSinceJoined = () => {
    return Math.floor(Math.random() * 100) + 30; // Placeholder calculation
  };

  return (
    <div className="modern-profile-page">
      <Container fluid className="profile-wrapper">
        {/* Hero Section */}
        <div className="profile-hero">
          <div className="hero-background">
            <div className="hero-pattern"></div>
          </div>
          <div className="hero-content">
            <div className="profile-avatar-large">
              <span className="avatar-initial">{getUserInitial()}</span>
              <div className="avatar-status"></div>
            </div>
            <div className="profile-header-info">
              <h1 className="profile-display-name">{user?.username || 'User'}</h1>
              <p className="profile-email-display">{user?.email || 'user@example.com'}</p>
              <div className="profile-badges">
                <Badge bg="success" className="member-badge">
                  <i className="bi bi-check-circle-fill me-1"></i>
                  Active Member
                </Badge>
                <Badge bg="primary" className="streak-badge">
                  <i className="bi bi-fire me-1"></i>
                  {getDaysSinceJoined()} Days
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Row className="profile-content-row">
          {/* Left Column - Quick Stats */}
          <Col lg={4} className="mb-4">
            <Card className="stats-card">
              <Card.Header className="stats-header">
                <h5 className="stats-title">
                  <i className="bi bi-graph-up me-2"></i>
                  Learning Stats
                </h5>
              </Card.Header>
              <Card.Body className="stats-body">
                {statsLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="stat-item">
                      <div className="stat-icon topics-icon">
                        <i className="bi bi-book"></i>
                      </div>
                      <div className="stat-details">
                        <div className="stat-number">{stats?.total_topics || 0}</div>
                        <div className="stat-label">Topics Created</div>
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon revisions-icon">
                        <i className="bi bi-arrow-repeat"></i>
                      </div>
                      <div className="stat-details">
                        <div className="stat-number">{stats?.completed_revisions || 0}</div>
                        <div className="stat-label">Revisions Done</div>
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon streak-icon">
                        <i className="bi bi-fire"></i>
                      </div>
                      <div className="stat-details">
                        <div className="stat-number">{stats?.topics_this_week || 0}</div>
                        <div className="stat-label">Topics This Week</div>
                      </div>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>

            {/* Quick Actions */}
            <Card className="actions-card">
              <Card.Header className="actions-header">
                <h5 className="actions-title">
                  <i className="bi bi-lightning-charge me-2"></i>
                  Quick Actions
                </h5>
              </Card.Header>
              <Card.Body className="actions-body">
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
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column - Account Information */}
          <Col lg={8}>
            <Card className="account-card">
              <Card.Header className="account-header">
                <h5 className="account-title">
                  <i className="bi bi-person-circle me-2"></i>
                  Account Information
                </h5>
              </Card.Header>
              <Card.Body className="account-body">
                <Row>
                  <Col md={6}>
                    <div className="info-group">
                      <label className="info-label">Username</label>
                      <div className="info-value">
                        <i className="bi bi-person me-2"></i>
                        {user?.username || 'Not set'}
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="info-group">
                      <label className="info-label">Email Address</label>
                      <div className="info-value">
                        <i className="bi bi-envelope me-2"></i>
                        {user?.email || 'Not set'}
                      </div>
                    </div>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={6}>
                    <div className="info-group">
                      <label className="info-label">Member Since</label>
                      <div className="info-value">
                        <i className="bi bi-calendar-check me-2"></i>
                        January 2024
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="info-group">
                      <label className="info-label">Account Status</label>
                      <div className="info-value">
                        <i className="bi bi-check-circle-fill text-success me-2"></i>
                        Active
                      </div>
                    </div>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <div className="info-group">
                      <label className="info-label">Last Login</label>
                      <div className="info-value">
                        <i className="bi bi-clock me-2"></i>
                        Today at 10:30 AM
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="info-group">
                      <label className="info-label">Preferred Language</label>
                      <div className="info-value">
                        <i className="bi bi-globe me-2"></i>
                        English
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Learning Preferences */}
            <Card className="preferences-card">
              <Card.Header className="preferences-header">
                <h5 className="preferences-title">
                  <i className="bi bi-gear me-2"></i>
                  Learning Preferences
                </h5>
              </Card.Header>
              <Card.Body className="preferences-body">
                <Row>
                  <Col md={6}>
                    <div className="preference-item">
                      <div className="preference-icon">
                        <i className="bi bi-bell"></i>
                      </div>
                      <div className="preference-details">
                        <div className="preference-name">Daily Reminders</div>
                        <div className="preference-status enabled">Enabled</div>
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="preference-item">
                      <div className="preference-icon">
                        <i className="bi bi-moon"></i>
                      </div>
                      <div className="preference-details">
                        <div className="preference-name">Dark Mode</div>
                        <div className="preference-status enabled">Enabled</div>
                      </div>
                    </div>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <div className="preference-item">
                      <div className="preference-icon">
                        <i className="bi bi-clock"></i>
                      </div>
                      <div className="preference-details">
                        <div className="preference-name">Study Reminders</div>
                        <div className="preference-status enabled">9:00 AM Daily</div>
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="preference-item">
                      <div className="preference-icon">
                        <i className="bi bi-trophy"></i>
                      </div>
                      <div className="preference-details">
                        <div className="preference-name">Achievement Notifications</div>
                        <div className="preference-status enabled">Enabled</div>
                      </div>
                    </div>
                  </Col>
                </Row>
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