import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Sidebar.css';

const Sidebar = ({ isCollapsed, toggleSidebar, isMobile, isMobileMenuOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile && isMobileMenuOpen) {
      toggleSidebar();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path, tab = null) => {
    if (tab) {
      return location.pathname === path && (location.search.includes(`tab=${tab}`) || (tab === 'today' && location.search === ''));
    }
    return location.pathname === path;
  };

  const NavItem = ({ icon, label, badge, active, onClick, collapsed }) => (
    <div
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="nav-icon-wrapper">
        <i className={`bi bi-${icon}`}></i>
        {badge > 0 && collapsed && (
          <span className="nav-badge-dot"></span>
        )}
      </div>
      {!collapsed && (
        <>
          <span className="nav-label">{label}</span>
          {badge > 0 && (
            <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>
          )}
        </>
      )}
      {collapsed && (
        <div className="nav-tooltip">{label}</div>
      )}
    </div>
  );

  const QuickActionItem = ({ icon, label, onClick }) => (
    <div
      className="quick-action-item"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <i className={`bi bi-${icon}`}></i>
      <span>{label}</span>
    </div>
  );

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile && isMobileMenuOpen ? 'mobile-open' : ''} ${isDarkMode ? 'dark' : ''}`}>
      {/* Logo Section */}
      <div className="sidebar-header">
        <div className="sidebar-logo" onClick={() => handleNavigation('/dashboard?tab=today')}>
          <img src="/icon-192.png" alt="Revize" className="logo-icon" />
          {!isCollapsed && <span className="logo-text">Revize</span>}
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <i className={`bi bi-chevron-${isCollapsed ? 'right' : 'left'}`}></i>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          {!isCollapsed && <div className="nav-section-title">Menu</div>}
          <NavItem
            icon="house-door"
            label="Dashboard"
            badge={0}
            active={isActive('/dashboard', 'today')}
            onClick={() => handleNavigation('/dashboard?tab=today')}
            collapsed={isCollapsed}
          />
          <NavItem
            icon="book"
            label="All Topics"
            badge={0}
            active={isActive('/dashboard', 'topics')}
            onClick={() => handleNavigation('/dashboard?tab=topics')}
            collapsed={isCollapsed}
          />
          <NavItem
            icon="bar-chart-line"
            label="Statistics"
            badge={0}
            active={isActive('/dashboard', 'stats')}
            onClick={() => handleNavigation('/dashboard?tab=stats')}
            collapsed={isCollapsed}
          />
        </div>

        {/* Quick Actions Section */}
        {!isCollapsed && (
          <div className="nav-section quick-actions-section">
            <div
              className="nav-section-title clickable"
              onClick={() => setQuickActionsExpanded(!quickActionsExpanded)}
            >
              <span>Quick Actions</span>
              <i className={`bi bi-chevron-${quickActionsExpanded ? 'up' : 'down'} chevron-icon`}></i>
            </div>
            <div className={`quick-actions-content ${quickActionsExpanded ? 'expanded' : ''}`}>
              <QuickActionItem
                icon="plus-circle"
                label="Add Topic"
                onClick={() => handleNavigation('/dashboard?tab=topics&action=add')}
              />
              <QuickActionItem
                icon="play-circle"
                label="Start Review"
                onClick={() => handleNavigation('/dashboard?tab=today')}
              />
              <QuickActionItem
                icon="graph-up"
                label="View Stats"
                onClick={() => handleNavigation('/dashboard?tab=stats')}
              />
            </div>
          </div>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <div
          className="footer-item"
          onClick={toggleTheme}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggleTheme()}
        >
          <div className="footer-icon-wrapper">
            <i className={`bi bi-${isDarkMode ? 'sun' : 'moon'}`}></i>
          </div>
          {!isCollapsed && (
            <span className="footer-label">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          )}
          {isCollapsed && (
            <div className="nav-tooltip">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</div>
          )}
        </div>

        {/* Feedback */}
        <div
          className="footer-item"
          role="button"
          tabIndex={0}
        >
          <div className="footer-icon-wrapper">
            <i className="bi bi-chat-square-dots"></i>
          </div>
          {!isCollapsed && <span className="footer-label">Feedback</span>}
          {isCollapsed && <div className="nav-tooltip">Feedback</div>}
        </div>

        {/* Divider */}
        <div className="footer-divider"></div>

        {/* Profile Section */}
        <div
          className={`footer-item profile-item ${isActive('/profile') ? 'active' : ''}`}
          onClick={() => handleNavigation('/profile')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigation('/profile')}
        >
          <div className="profile-avatar">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          {!isCollapsed && (
            <div className="profile-info">
              <div className="profile-name">{user?.username || 'User'}</div>
              <div className="profile-email">{user?.email || 'user@example.com'}</div>
            </div>
          )}
          {isCollapsed && (
            <div className="nav-tooltip">{user?.username || 'Profile'}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
