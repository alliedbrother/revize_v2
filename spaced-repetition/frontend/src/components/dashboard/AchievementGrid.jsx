import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import './AchievementGrid.css';

const AchievementGrid = ({ achievements, totalAchievements }) => {
  if (!achievements || achievements.length === 0) {
    return (
      <Card className="achievement-grid-card">
        <Card.Body>
          <div className="achievement-header">
            <h5 className="achievement-title">
              <i className="bi bi-trophy-fill"></i>
              Achievements
            </h5>
            <Badge bg="secondary">0 / {totalAchievements || 0}</Badge>
          </div>
          <div className="no-achievements">
            <i className="bi bi-trophy"></i>
            <p>Complete your first revision to start unlocking achievements!</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  const tierColors = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2'
  };

  const tierIcons = {
    bronze: 'award',
    silver: 'gem',
    gold: 'trophy',
    platinum: 'star-fill'
  };

  return (
    <Card className="achievement-grid-card">
      <Card.Body>
        <div className="achievement-header">
          <h5 className="achievement-title">
            <i className="bi bi-trophy-fill"></i>
            Recent Achievements
          </h5>
          <Badge bg="primary">{achievements.length} / {totalAchievements || achievements.length}</Badge>
        </div>

        <div className="achievements-grid">
          {achievements.map((userAchievement) => {
            const achievement = userAchievement.achievement;
            const tierColor = tierColors[achievement.tier] || tierColors.bronze;
            const tierIcon = tierIcons[achievement.tier] || tierIcons.bronze;

            return (
              <div key={userAchievement.id} className="achievement-item">
                <div
                  className={`achievement-icon tier-${achievement.tier}`}
                  style={{ '--tier-color': tierColor }}
                >
                  <i className={`bi bi-${achievement.icon || tierIcon}`}></i>
                </div>
                <div className="achievement-info">
                  <div className="achievement-name">{achievement.name}</div>
                  <div className="achievement-description">{achievement.description}</div>
                  <div className="achievement-meta">
                    <Badge
                      className={`tier-badge tier-${achievement.tier}`}
                      style={{
                        backgroundColor: tierColor,
                        color: achievement.tier === 'gold' || achievement.tier === 'platinum' ? '#1a1a1a' : 'white'
                      }}
                    >
                      {achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}
                    </Badge>
                    <span className="achievement-xp">
                      <i className="bi bi-star-fill"></i>
                      +{achievement.xp_reward} XP
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
};

export default AchievementGrid;
