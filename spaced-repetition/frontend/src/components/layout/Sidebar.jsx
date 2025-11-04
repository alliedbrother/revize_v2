import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Sidebar.css';

const Sidebar = ({ isCollapsed, toggleSidebar, isMobile, isMobileMenuOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleNavigation = (path) => {
    navigate(path);
    // Close mobile menu after navigation
    if (isMobile && isMobileMenuOpen) {
      toggleSidebar();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile && isMobileMenuOpen ? 'mobile-open' : ''}`}>
      {/* Sidebar Header with Toggle */}
      <div className="sidebar-header">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
        </button>
        {!isCollapsed && (
          <div className="sidebar-brand">
            <div className="brand-icon">R</div>
            <span className="brand-text">Revize</span>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        <div 
          className={`nav-item ${isActive('/dashboard') && (location.search.includes('tab=today') || location.search === '') ? 'active' : ''}`}
          data-tooltip="Dashboard"
          onClick={() => handleNavigation('/dashboard?tab=today')}
        >
          <i className="bi bi-house-door"></i>
          {!isCollapsed && <span>Dashboard</span>}
        </div>
        <div
          className={`nav-item ${isActive('/dashboard') && location.search.includes('tab=topics') ? 'active' : ''}`}
          data-tooltip="All Topics"
          onClick={() => handleNavigation('/dashboard?tab=topics')}
        >
          <i className="bi bi-book"></i>
          {!isCollapsed && <span>All Topics</span>}
        </div>
        <div
          className={`nav-item ${isActive('/dashboard') && location.search.includes('tab=stats') ? 'active' : ''}`}
          data-tooltip="Statistics"
          onClick={() => handleNavigation('/dashboard?tab=stats')}
        >
          <i className="bi bi-bar-chart"></i>
          {!isCollapsed && <span>Statistics</span>}
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div 
          className="nav-item" 
          data-tooltip={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          onClick={toggleTheme}
        >
          <i className={`bi ${isDarkMode ? 'bi-sun' : 'bi-moon'}`}></i>
          {!isCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </div>
        <div className="nav-item" data-tooltip="Feedback">
          <i className="bi bi-chat-dots"></i>
          {!isCollapsed && <span>Feedback</span>}
        </div>
        
        {/* Profile Section */}
        <div 
          className={`nav-item profile-section ${isActive('/profile') ? 'active' : ''}`}
          data-tooltip="Profile"
          onClick={() => handleNavigation('/profile')}
        >
          {isCollapsed ? (
            <div className="profile-avatar-small">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
          ) : (
            <div className="profile-info">
              <div className="profile-avatar-small">
                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="profile-details">
                <div className="profile-name">{user?.username || 'User'}</div>
                <div className="profile-email">{user?.email || 'user@example.com'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 