import React, { useState, createContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './ModernDashboard.css';

// Import existing components
import AddTopicCard from '../topics/AddTopicCard';
import AllTopics from '../topics/AllTopics';
import Statistics from '../dashboard/Statistics';
import FlashcardReviewArea from '../flashcards/FlashcardReviewArea';

// Create a context for triggering data refresh
export const RefreshContext = createContext();

const ModernDashboard = () => {
  const { user, logout } = useAuth();
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <RefreshContext.Provider value={{ refreshTrigger, triggerRefresh }}>
      <div className="zen-dashboard">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-content">
            <div className="dash-header-left">
              <h1 className="dash-greeting">
                {getGreeting()}, <span className="dash-name">{user?.first_name || user?.username || 'Scholar'}</span>
              </h1>
              <p className="dash-subtitle">Ready to strengthen your knowledge?</p>
            </div>

            <div className="dash-header-right">
              {/* Profile Link */}
              <Link to="/profile" className="dash-avatar">
                <img
                  src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=d4a853&color=1a1f36&bold=true`}
                  alt="Profile"
                />
              </Link>

              {/* Logout */}
              <button className="dash-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="dash-main">
          {activeTab === 'today' && (
            <div className="dash-today-layout">
              {/* Left - Flashcard Review Area */}
              <div className="dash-review-section">
                <FlashcardReviewArea />
              </div>

              {/* Right - Add Topic Card */}
              <div className="dash-sidebar-section">
                <AddTopicCard />
              </div>
            </div>
          )}

          {activeTab === 'topics' && (
            <div className="dash-topics-view">
              <AllTopics />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="dash-stats-view">
              <Statistics />
            </div>
          )}
        </main>
      </div>
    </RefreshContext.Provider>
  );
};

export default ModernDashboard;
