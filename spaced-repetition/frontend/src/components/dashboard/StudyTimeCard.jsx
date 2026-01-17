import { Card } from 'react-bootstrap';
import './StudyTimeCard.css';

const StudyTimeCard = ({ studyStats }) => {
  if (!studyStats) {
    return (
      <Card className="study-time-card">
        <Card.Body>
          <div className="study-time-placeholder">
            <i className="bi bi-clock"></i>
            <p>Start studying to track your time</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  const {
    study_time_today_formatted,
    study_time_week_formatted,
    avg_time_per_card_seconds,
    cards_reviewed_today,
    cards_reviewed_week
  } = studyStats;

  return (
    <Card className="study-time-card">
      <Card.Body>
        <div className="study-time-header">
          <i className="bi bi-clock-history"></i>
          <h5>Study Time</h5>
        </div>

        <div className="study-time-grid">
          {/* Today's Stats */}
          <div className="time-stat today">
            <div className="time-stat-value">{study_time_today_formatted || '0s'}</div>
            <div className="time-stat-label">Today</div>
            <div className="time-stat-cards">
              <i className="bi bi-card-text"></i>
              {cards_reviewed_today || 0} cards
            </div>
          </div>

          {/* This Week's Stats */}
          <div className="time-stat week">
            <div className="time-stat-value">{study_time_week_formatted || '0s'}</div>
            <div className="time-stat-label">This Week</div>
            <div className="time-stat-cards">
              <i className="bi bi-card-text"></i>
              {cards_reviewed_week || 0} cards
            </div>
          </div>

          {/* Average Time Per Card */}
          <div className="time-stat average">
            <div className="time-stat-value">{Math.round(avg_time_per_card_seconds || 0)}s</div>
            <div className="time-stat-label">Avg per Card</div>
            <div className="time-stat-cards">
              <i className="bi bi-speedometer2"></i>
              efficiency
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default StudyTimeCard;
