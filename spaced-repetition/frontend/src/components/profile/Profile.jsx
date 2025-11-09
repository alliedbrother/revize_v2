import { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, Alert, Container, Row, Col, Badge, Modal } from 'react-bootstrap';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';
import CreditDisplay from '../common/CreditDisplay';
import './Profile.css';

const Profile = () => {
  const { user, changePassword, logout, updateUser } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Credit system state
  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Profile picture upload state
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ aspect: 1, unit: '%', width: 90 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [pictureLoading, setPictureLoading] = useState(false);
  const imgRef = useRef(null);

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

  // Fetch credits
  const fetchCredits = async () => {
    try {
      setCreditsLoading(true);
      const data = await userService.getUserCredits();
      setCredits(data);
    } catch (err) {
      console.error('Error fetching credits:', err);
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  };

  // Redeem promo code
  const handleRedeemPromo = async (e) => {
    e.preventDefault();
    setPromoError('');
    setPromoSuccess('');
    setPromoLoading(true);

    try {
      const result = await userService.redeemPromoCode(promoCode);
      setPromoSuccess(result.message);
      setPromoCode('');
      fetchCredits(); // Refresh credits
    } catch (err) {
      setPromoError(err.response?.data?.error || 'Failed to redeem promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  // Get user initial for avatar
  const getUserInitial = () => {
    if (user?.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    } else if (user?.first_name) {
      return user.first_name;
    }
    return user?.username || 'User';
  };

  // Initialize profile data when editing
  const startEditingProfile = () => {
    setProfileData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || ''
    });
    setIsEditingProfile(true);
    setProfileError('');
    setProfileSuccess('');
  };

  // Cancel profile editing
  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setProfileError('');
    setProfileSuccess('');
  };

  // Handle profile input change
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      // Call API to update profile
      const updatedUser = await userService.updateProfile(profileData);
      // Update local state with the response
      await updateUser(updatedUser);
      setProfileSuccess('Profile updated successfully!');
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle profile picture selection
  const handlePictureSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file
      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        setError('Image must be JPG, PNG, or WEBP');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result);
        setShowPictureModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload cropped picture
  const handleUploadPicture = async () => {
    if (!completedCrop || !imgRef.current) return;

    setPictureLoading(true);
    try {
      // Create canvas with cropped image
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );

      // Convert to blob
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });

        try {
          const result = await userService.uploadProfilePicture(file);

          // Update user state with the full user object from response
          if (result && result.user) {
            await updateUser(result.user);
          }

          setSuccess('Profile picture updated successfully!');
          setShowPictureModal(false);
          setSelectedImage(null);

          // Force a small delay then clear success message
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to upload picture');
        } finally {
          setPictureLoading(false);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      setError('Failed to process image');
      setPictureLoading(false);
    }
  };

  // Fetch credits on component mount
  useEffect(() => {
    if (user) {
      fetchCredits();
    }
  }, [user]);

  return (
    <div className="modern-profile-page">
      <Container fluid className="profile-wrapper">
        {/* Hero Section */}
        <Card className="profile-hero-card">
          <Card.Body className="profile-hero-body">
            <div className="profile-avatar-container">
              <div className="profile-avatar-large">
                {user?.profile_picture ? (
                  <img src={user.profile_picture} alt="Profile" className="profile-picture-img" />
                ) : (
                  <span className="avatar-initial">{getUserInitial()}</span>
                )}
              </div>
              <label htmlFor="profile-picture-input" className="profile-picture-upload-btn">
                <i className="bi bi-camera-fill"></i>
                <input
                  id="profile-picture-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePictureSelect}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <div className="profile-header-info">
              <h1 className="profile-display-name">{getDisplayName()}</h1>
              <p className="profile-username-display">@{user?.username || 'user'}</p>
              <p className="profile-email-display">
                <i className="bi bi-envelope me-2"></i>
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </Card.Body>
        </Card>

        {/* Main Content */}
        <Row className="profile-content-row g-4">
          {/* Profile Information */}
          <Col lg={12}>
            <Card className="profile-info-card">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-person-fill me-2"></i>
                  Profile Information
                </h5>
                {!isEditingProfile && (
                  <Button variant="outline-primary" size="sm" onClick={startEditingProfile}>
                    <i className="bi bi-pencil me-1"></i>
                    Edit
                  </Button>
                )}
              </Card.Header>
              <Card.Body>
                {profileSuccess && (
                  <Alert variant="success" className="mb-3">
                    <i className="bi bi-check-circle me-2"></i>
                    {profileSuccess}
                  </Alert>
                )}
                {profileError && (
                  <Alert variant="danger" className="mb-3">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {profileError}
                  </Alert>
                )}

                {isEditingProfile ? (
                  <Form>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>First Name</Form.Label>
                          <Form.Control
                            type="text"
                            name="first_name"
                            value={profileData.first_name}
                            onChange={handleProfileChange}
                            placeholder="Enter first name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Last Name</Form.Label>
                          <Form.Control
                            type="text"
                            name="last_name"
                            value={profileData.last_name}
                            onChange={handleProfileChange}
                            placeholder="Enter last name"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleProfileChange}
                        placeholder="Enter email"
                      />
                    </Form.Group>
                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        onClick={handleSaveProfile}
                        disabled={profileLoading}
                      >
                        {profileLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check-lg me-1"></i>
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button variant="outline-secondary" onClick={cancelEditingProfile}>
                        Cancel
                      </Button>
                    </div>
                  </Form>
                ) : (
                  <Row>
                    <Col md={6}>
                      <div className="profile-info-item mb-3">
                        <label className="profile-info-label">First Name</label>
                        <p className="profile-info-value">{user?.first_name || 'Not set'}</p>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="profile-info-item mb-3">
                        <label className="profile-info-label">Last Name</label>
                        <p className="profile-info-value">{user?.last_name || 'Not set'}</p>
                      </div>
                    </Col>
                    <Col md={12}>
                      <div className="profile-info-item">
                        <label className="profile-info-label">Email</label>
                        <p className="profile-info-value">{user?.email || 'Not set'}</p>
                      </div>
                    </Col>
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* AI Generation Credits */}
          <Col lg={12}>
            <Card className="credits-card">
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-lightning-charge-fill me-2"></i>
                  AI Generation Credits
                </h5>
              </Card.Header>
              <Card.Body>
                {creditsLoading ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="credit-info mb-4">
                      <div className="credit-balance">
                        <CreditDisplay
                          credits={credits?.available_credits || 0}
                          unlimitedAccess={credits?.unlimited_access || false}
                          size="lg"
                        />
                      </div>
                      <p className="credit-description mt-3">
                        Each AI-powered topic creation uses 1 credit.
                        Redeem a promo code below to get more credits.
                      </p>
                      <div className="credit-stats mt-2">
                        <small className="text-muted">
                          <i className="bi bi-info-circle me-1"></i>
                          Total earned: {credits?.total_credits_earned || 0} |
                          Total used: {credits?.total_credits_used || 0}
                        </small>
                      </div>
                    </div>

                    <Form onSubmit={handleRedeemPromo}>
                      <Form.Group>
                        <Form.Label>Promo Code</Form.Label>
                        <div className="d-flex gap-2">
                          <Form.Control
                            type="text"
                            placeholder="Enter promo code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            disabled={promoLoading || credits?.unlimited_access}
                          />
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={!promoCode || promoLoading || credits?.unlimited_access}
                          >
                            {promoLoading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Redeeming...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-check-circle me-1"></i>
                                Redeem
                              </>
                            )}
                          </Button>
                        </div>
                      </Form.Group>

                      {promoError && (
                        <Alert variant="danger" className="mt-3 mb-0">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          {promoError}
                        </Alert>
                      )}

                      {promoSuccess && (
                        <Alert variant="success" className="mt-3 mb-0">
                          <i className="bi bi-check-circle me-2"></i>
                          {promoSuccess}
                        </Alert>
                      )}

                      {credits?.unlimited_access && (
                        <Alert variant="info" className="mt-3 mb-0">
                          <i className="bi bi-infinity me-2"></i>
                          You have unlimited access! No need for promo codes.
                        </Alert>
                      )}
                    </Form>
                  </>
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

      {/* Profile Picture Crop Modal */}
      <Modal show={showPictureModal} onHide={() => setShowPictureModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-crop me-2"></i>
            Crop Profile Picture
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {success && <Alert variant="success" className="mb-3">{success}</Alert>}

          {selectedImage && (
            <div className="crop-container">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  src={selectedImage}
                  alt="Crop preview"
                  style={{ maxWidth: '100%' }}
                />
              </ReactCrop>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setShowPictureModal(false);
                setSelectedImage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUploadPicture}
              disabled={!completedCrop || pictureLoading}
            >
              {pictureLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <i className="bi bi-upload me-1"></i>
                  Upload Picture
                </>
              )}
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Profile; 