import React, { useState, createContext, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './ModernDashboard.css';

// Import existing components
import AddTopicCard from '../topics/AddTopicCard';
import FloatingTimerButton from '../pomodoro/FloatingTimerButton';
import TodaysRevisionsList from '../topics/TodaysRevisionsList';
import AllTopics from '../topics/AllTopics';
import Statistics from '../dashboard/Statistics';
import WaveBottom from '../common/WaveBottom';

// Create a context for triggering data refresh
export const RefreshContext = createContext();

const ModernDashboard = () => {
  const { user, logout } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('today');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle URL parameters to set active tab
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['today', 'topics', 'stats'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'today':
        return (
          <div className="today-learning-layout">
            {/* Left Half - Add Topic Card */}
            <AddTopicCard />

            {/* Right Half - Progress */}
            <div className="progress-section">
              <TodaysRevisionsList />
            </div>
          </div>
        );
      case 'topics':
        return (
          <div className="full-width-content">
            <AllTopics />
          </div>
        );
      case 'stats':
        return (
          <div className="full-width-content">
            <Statistics />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <RefreshContext.Provider value={{ refreshTrigger, triggerRefresh }}>
      <div className="modern-dashboard">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="welcome-message">
                Welcome back, {user?.username || 'Student'}!
              </h1>
              <p className="header-subtitle">Ready to continue your learning journey?</p>
            </div>
            <div className="header-right">
              <div className="user-menu">
                <div className="user-avatar">
                  <img 
                    src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=3b82f6&color=fff`} 
                    alt="User Avatar" 
                  />
                </div>
                <div className="user-info">
                  <button className="logout-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>



        {/* Main Content */}
        <main className="dashboard-main">
          <div className="tab-content">
            {renderTabContent()}
          </div>
        </main>
        
        {/* Floating Timer Button */}
        <FloatingTimerButton />
      </div>
    </RefreshContext.Provider>
  );
};

export default ModernDashboard; 