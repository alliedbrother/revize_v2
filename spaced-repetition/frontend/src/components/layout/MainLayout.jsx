import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const closeMobileMenu = () => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  // Calculate content width based on sidebar state
  const getContentWidth = () => {
    if (isMobile) {
      return '100%';
    }
    return isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 280px)';
  };

  // Calculate content margin based on sidebar state
  const getContentMargin = () => {
    if (isMobile) {
      return '0';
    }
    return isSidebarCollapsed ? '80px' : '280px';
  };

  return (
    <div className="main-layout">
      {/* Mobile Overlay */}
      {isMobile && (
        <div 
          className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        isMobile={isMobile}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Main Content */}
      <div 
        className="main-content"
        style={{
          width: getContentWidth(),
          marginLeft: getContentMargin(),
        }}
      >
        {/* Mobile Header with Menu Button */}
        {isMobile && (
          <div className="mobile-header">
            <button className="mobile-menu-toggle" onClick={toggleSidebar}>
              <i className="bi bi-list"></i>
            </button>
            <div className="mobile-brand">
              <div className="brand-icon">R</div>
              <span className="brand-text">Revize</span>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MainLayout; 