import React, { useState, createContext, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './ModernDashboard.css';

// Import existing components
import AddTopicCard from '../topics/AddTopicCard';
import TodaysRevisionsList from '../topics/TodaysRevisionsList';
import AllTopics from '../topics/AllTopics';
import Statistics from '../dashboard/Statistics';
import WaveBottom from '../common/WaveBottom';
import FlashcardReviewArea from '../flashcards/FlashcardReviewArea';

// Create a context for triggering data refresh
export const RefreshContext = createContext();

const ModernDashboard = () => {
  const { user, logout } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get active tab from URL, default to 'today'
  const activeTab = searchParams.get('tab') || 'today';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <RefreshContext.Provider value={{ refreshTrigger, triggerRefresh }}>
      <div className="modern-dashboard">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="welcome-message">
                Welcome back, {user?.first_name || user?.username || 'Student'}!
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
          {activeTab === 'today' && (
            <div className="today-learning-layout">
              {/* Left 70% - Flashcard Review Area */}
              <div className="flashcard-review-section">
                <FlashcardReviewArea />
              </div>

              {/* Right 30% - Add Topic Card */}
              <div className="add-topic-section">
                <AddTopicCard />
              </div>
            </div>
          )}

          {activeTab === 'topics' && (
            <div className="topics-view">
              <AllTopics />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-view">
              <Statistics />
            </div>
          )}
        </main>
      </div>
    </RefreshContext.Provider>
  );
};

export default ModernDashboard; 