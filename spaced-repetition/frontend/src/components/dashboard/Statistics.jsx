import { useState, useEffect, useContext } from 'react';
import { Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getGamificationStats, getStudyStats } from '../../services/api';
import { RefreshContext } from './ModernDashboard';
import StreakTracker from './StreakTracker';
import LevelProgress from './LevelProgress';
import AchievementGrid from './AchievementGrid';
import DailyGoals from './DailyGoals';
import StudyTimeCard from './StudyTimeCard';
import WeeklyHeatmap from './WeeklyHeatmap';
import CompletionRateCard from './CompletionRateCard';
import NeedsAttentionCard from './NeedsAttentionCard';
import './Statistics.css';

const Statistics = () => {
  const [gamificationData, setGamificationData] = useState(null);
  const [studyStats, setStudyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { refreshTrigger } = useContext(RefreshContext);

  useEffect(() => {
    loadAllStats();
  }, [refreshTrigger]);

  const loadAllStats = async () => {
    try {
      setLoading(true);
      // Fetch both gamification stats and study analytics in parallel
      const [gamificationResponse, studyResponse] = await Promise.all([
        getGamificationStats(),
        getStudyStats().catch(err => {
          console.warn('Study stats not available:', err);
          return null;
        })
      ]);
      setGamificationData(gamificationResponse);
      setStudyStats(studyResponse);
      setError('');
    } catch (err) {
      setError('Failed to load statistics');
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !gamificationData) {
    return (
      <div className="statistics-loading">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading your progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <i className="bi bi-exclamation-triangle me-2"></i>
        {error}
      </Alert>
    );
  }

  if (!gamificationData) {
    return (
      <Alert variant="info" className="m-4">
        <i className="bi bi-info-circle me-2"></i>
        No statistics available yet. Start studying to see your progress!
      </Alert>
    );
  }

  const { streak, level, recent_achievements, total_achievements, available_achievements, daily_goals, goals_completed_today } = gamificationData;

  return (
    <div className="statistics-container">
      {/* Hero Banner with Gradient */}
      <div className="stats-hero-banner">
        <div className="stats-hero-content">
          <div className="stats-hero-icon">
            <i className="bi bi-rocket-takeoff-fill"></i>
          </div>
          <div className="stats-hero-text">
            <h1 className="stats-hero-title">Level Up Your Skills</h1>
            <p className="stats-hero-subtitle">Track your progress, unlock achievements, and master your learning goals</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Summary - Moved to Top */}
      <Row className="mb-3">
        <Col xs={12}>
          <Card className="quick-stats-card">
            <Card.Body>
              <Row className="text-center">
                <Col xs={6} md={3}>
                  <div className="quick-stat">
                    <i className="bi bi-fire stat-icon streak-color"></i>
                    <div className="stat-value">{streak?.current_streak || 0}</div>
                    <div className="stat-label">Day Streak</div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="quick-stat">
                    <i className="bi bi-award-fill stat-icon level-color"></i>
                    <div className="stat-value">Level {level?.current_level || 1}</div>
                    <div className="stat-label">{level?.total_xp || 0} Total XP</div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="quick-stat">
                    <i className="bi bi-trophy-fill stat-icon achievement-color"></i>
                    <div className="stat-value">{total_achievements || 0}</div>
                    <div className="stat-label">Achievements</div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="quick-stat">
                    <i className="bi bi-check-circle-fill stat-icon goal-color"></i>
                    <div className="stat-value">{goals_completed_today || 0}/{daily_goals?.length || 0}</div>
                    <div className="stat-label">Daily Goals</div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Gamification Stats Grid - 3 Equal Columns */}
      <Row className="g-2">
        {/* Column 1 - Streak Tracker */}
        <Col lg={4}>
          <StreakTracker streak={streak} />
        </Col>

        {/* Column 2 - Level Progress */}
        <Col lg={4}>
          <LevelProgress level={level} />
        </Col>

        {/* Column 3 - Goals & Achievements */}
        <Col lg={4}>
          <DailyGoals
            goals={daily_goals}
            goalsCompletedToday={goals_completed_today}
          />
          <div className="mt-2">
            <AchievementGrid
              achievements={recent_achievements}
              totalAchievements={available_achievements}
            />
          </div>
        </Col>
      </Row>

      {/* Study Analytics Section */}
      <div className="study-analytics-section">
        <div className="section-header">
          <h2 className="section-title">
            <i className="bi bi-bar-chart-line-fill"></i>
            Study Analytics
          </h2>
          <p className="section-subtitle">Insights from your learning sessions</p>
        </div>

        <Row className="g-2 mb-3">
          {/* Study Time Card */}
          <Col lg={6}>
            <StudyTimeCard studyStats={studyStats} />
          </Col>

          {/* Weekly Heatmap */}
          <Col lg={6}>
            <WeeklyHeatmap weeklyActivity={studyStats?.weekly_activity} />
          </Col>
        </Row>

        <Row className="g-2">
          {/* Completion Rate Card */}
          <Col lg={6}>
            <CompletionRateCard studyStats={studyStats} />
          </Col>

          {/* Needs Attention Card */}
          <Col lg={6}>
            <NeedsAttentionCard cards={studyStats?.needs_attention_cards} />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Statistics;
