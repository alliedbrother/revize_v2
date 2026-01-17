import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService } from '../../services/api';
import CreditDisplay from '../common/CreditDisplay';
import './Profile.css';

const Profile = () => {
  const { user, changePassword, logout, updateUser } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
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
      fetchCredits();
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
      const updatedUser = await userService.updateProfile(profileData);
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

      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });

        try {
          const result = await userService.uploadProfilePicture(file);

          if (result && result.user) {
            await updateUser(result.user);
          }

          setSuccess('Profile picture updated successfully!');
          setShowPictureModal(false);
          setSelectedImage(null);

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
    <div className="zen-profile">
      {/* Ambient Background */}
      <div className="profile-ambient">
        <div className="profile-orb orb-1"></div>
        <div className="profile-orb orb-2"></div>
      </div>

      {/* Header */}
      <header className="profile-header">
        <Link to="/dashboard" className="profile-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </Link>
        <button className="profile-theme-toggle" onClick={toggleDarkMode} aria-label="Toggle theme">
          {isDarkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </header>

      <main className="profile-main">
        <div className="profile-container">
          {/* Hero Card */}
          <section className="profile-hero">
            <div className="hero-avatar-wrapper">
              <div className="hero-avatar">
                {user?.profile_picture ? (
                  <img src={user.profile_picture} alt="Profile" />
                ) : (
                  <span className="avatar-initial">{getUserInitial()}</span>
                )}
              </div>
              <label htmlFor="profile-picture-input" className="avatar-upload-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <input
                  id="profile-picture-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePictureSelect}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <div className="hero-info">
              <h1 className="hero-name">{getDisplayName()}</h1>
              <p className="hero-username">@{user?.username || 'user'}</p>
              <p className="hero-email">{user?.email || 'user@example.com'}</p>
            </div>
          </section>

          {/* Success/Error Messages */}
          {success && (
            <div className="profile-alert success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {success}
            </div>
          )}

          {/* Profile Information Card */}
          <section className="profile-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Profile Information
              </h2>
              {!isEditingProfile && (
                <button className="edit-btn" onClick={startEditingProfile}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              )}
            </div>

            <div className="card-body">
              {profileSuccess && (
                <div className="profile-alert success small">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {profileSuccess}
                </div>
              )}
              {profileError && (
                <div className="profile-alert error small">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {profileError}
                </div>
              )}

              {isEditingProfile ? (
                <form className="edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">First Name</label>
                      <input
                        type="text"
                        name="first_name"
                        className="form-input"
                        value={profileData.first_name}
                        onChange={handleProfileChange}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Name</label>
                      <input
                        type="text"
                        name="last_name"
                        className="form-input"
                        value={profileData.last_name}
                        onChange={handleProfileChange}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      name="email"
                      className="form-input"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSaveProfile}
                      disabled={profileLoading}
                    >
                      {profileLoading ? (
                        <>
                          <span className="spinner"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
                    <button type="button" className="btn-secondary" onClick={cancelEditingProfile}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">First Name</span>
                    <span className="info-value">{user?.first_name || 'Not set'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Last Name</span>
                    <span className="info-value">{user?.last_name || 'Not set'}</span>
                  </div>
                  <div className="info-item full-width">
                    <span className="info-label">Email</span>
                    <span className="info-value">{user?.email || 'Not set'}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* AI Credits Card */}
          <section className="profile-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                AI Generation Credits
              </h2>
            </div>

            <div className="card-body">
              {creditsLoading ? (
                <div className="loading-state">
                  <span className="spinner large"></span>
                  <span>Loading credits...</span>
                </div>
              ) : (
                <>
                  <div className="credits-display">
                    <CreditDisplay
                      credits={credits?.available_credits || 0}
                      unlimitedAccess={credits?.unlimited_access || false}
                      size="lg"
                    />
                  </div>
                  <p className="credits-description">
                    Each AI-powered topic creation uses 1 credit.
                    Redeem a promo code below to get more credits.
                  </p>
                  <div className="credits-stats">
                    Total earned: {credits?.total_credits_earned || 0} |
                    Total used: {credits?.total_credits_used || 0}
                  </div>

                  <form className="promo-form" onSubmit={handleRedeemPromo}>
                    <div className="promo-input-group">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        disabled={promoLoading || credits?.unlimited_access}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={!promoCode || promoLoading || credits?.unlimited_access}
                      >
                        {promoLoading ? (
                          <>
                            <span className="spinner"></span>
                            Redeeming...
                          </>
                        ) : (
                          'Redeem'
                        )}
                      </button>
                    </div>

                    {promoError && (
                      <div className="profile-alert error small">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 8v4M12 16h.01"/>
                        </svg>
                        {promoError}
                      </div>
                    )}

                    {promoSuccess && (
                      <div className="profile-alert success small">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        {promoSuccess}
                      </div>
                    )}

                    {credits?.unlimited_access && (
                      <div className="profile-alert info small">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="2" y1="12" x2="6" y2="12"/>
                          <line x1="18" y1="12" x2="22" y2="12"/>
                          <path d="M6 12a6 6 0 0 0 12 0 6 6 0 0 0-12 0"/>
                        </svg>
                        You have unlimited access! No need for promo codes.
                      </div>
                    )}
                  </form>
                </>
              )}
            </div>
          </section>

          {/* Account Settings Card */}
          <section className="profile-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Account Settings
              </h2>
            </div>

            <div className="card-body">
              <div className="actions-grid">
                <button className="action-btn" onClick={() => setShowPasswordModal(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>Change Password</span>
                </button>
                <button className="action-btn danger" onClick={logout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={closePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Change Password
              </h3>
              <button className="modal-close" onClick={closePasswordModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="profile-alert error small">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="profile-alert success small">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {success}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    name="current_password"
                    className="form-input"
                    value={passwordData.current_password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    name="new_password"
                    className="form-input"
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your new password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    name="confirm_password"
                    className="form-input"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    placeholder="Confirm your new password"
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={closePasswordModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner"></span>
                        Updating...
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Update Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Profile Picture Crop Modal */}
      {showPictureModal && (
        <div className="modal-overlay" onClick={() => setShowPictureModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 3v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3"/>
                  <path d="M6 21h12"/>
                  <path d="M12 11v10"/>
                </svg>
                Crop Profile Picture
              </h3>
              <button className="modal-close" onClick={() => setShowPictureModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="profile-alert error small">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {error}
                </div>
              )}

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

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowPictureModal(false);
                    setSelectedImage(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUploadPicture}
                  disabled={!completedCrop || pictureLoading}
                >
                  {pictureLoading ? (
                    <>
                      <span className="spinner"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Upload Picture
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
