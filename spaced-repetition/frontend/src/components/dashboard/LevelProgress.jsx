import React from 'react';
import { Card, ProgressBar } from 'react-bootstrap';
import './LevelProgress.css';

const LevelProgress = ({ level }) => {
  if (!level) return null;

  const { current_level, total_xp, progress } = level;
  const { current_xp, xp_needed, percentage } = progress || { current_xp: 0, xp_needed: 100, percentage: 0 };

  return (
    <Card className="level-progress-card">
      <Card.Body>
        <div className="level-header">
          <h5 className="level-title">
            <i className="bi bi-award-fill"></i>
            Level & XP
          </h5>
        </div>

        <div className="level-content">
          <div className="level-badge-container">
            <div className="level-badge">
              <div className="level-badge-inner">
                <div className="level-number">{current_level}</div>
                <div className="level-label">Level</div>
              </div>
              <div className="level-badge-glow"></div>
            </div>
            <div className="total-xp">
              <i className="bi bi-star-fill"></i>
              {total_xp.toLocaleString()} Total XP
            </div>
          </div>

          <div className="xp-progress-section">
            <div className="xp-progress-header">
              <span className="xp-current">{current_xp} XP</span>
              <span className="xp-target">/ {xp_needed} XP</span>
            </div>

            <ProgressBar
              now={percentage}
              className="xp-progress-bar"
              variant="success"
            />

            <div className="xp-progress-footer">
              <span className="xp-percentage">{percentage}% to Level {current_level + 1}</span>
              <span className="xp-remaining">{xp_needed - current_xp} XP remaining</span>
            </div>
          </div>
        </div>

        {percentage >= 80 && (
          <div className="level-up-soon">
            <i className="bi bi-lightning-fill"></i>
            Almost there! Keep studying!
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default LevelProgress;
