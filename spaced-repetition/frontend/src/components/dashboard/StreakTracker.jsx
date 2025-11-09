import React from 'react';
import { Card } from 'react-bootstrap';
import './StreakTracker.css';

const StreakTracker = ({ streak }) => {
  if (!streak) return null;

  const { current_streak, longest_streak, total_study_days } = streak;

  return (
    <Card className="streak-tracker-card">
      <Card.Body>
        <div className="streak-header">
          <h5 className="streak-title">
            <i className="bi bi-fire"></i>
            Study Streak
          </h5>
        </div>

        <div className="streak-content">
          <div className="streak-main">
            <div className="streak-flame-container">
              <i className="bi bi-fire streak-flame-icon"></i>
              <div className="streak-number">{current_streak}</div>
            </div>
            <p className="streak-label">Day{current_streak !== 1 ? 's' : ''} Streak</p>
          </div>

          <div className="streak-stats">
            <div className="streak-stat-item">
              <div className="stat-icon longest">
                <i className="bi bi-trophy-fill"></i>
              </div>
              <div className="stat-info">
                <div className="stat-value">{longest_streak}</div>
                <div className="stat-label">Longest</div>
              </div>
            </div>

            <div className="streak-divider"></div>

            <div className="streak-stat-item">
              <div className="stat-icon total">
                <i className="bi bi-calendar-check-fill"></i>
              </div>
              <div className="stat-info">
                <div className="stat-value">{total_study_days}</div>
                <div className="stat-label">Total Days</div>
              </div>
            </div>
          </div>
        </div>

        {current_streak >= 3 && (
          <div className="streak-encouragement">
            <i className="bi bi-star-fill"></i>
            {current_streak >= 30 ? 'Incredible dedication!' :
             current_streak >= 7 ? 'Keep it going!' :
             'Great start!'}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StreakTracker;
