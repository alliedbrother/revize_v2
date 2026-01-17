import { Card } from 'react-bootstrap';
import './WeeklyHeatmap.css';

const WeeklyHeatmap = ({ weeklyActivity }) => {
  if (!weeklyActivity || weeklyActivity.length === 0) {
    return (
      <Card className="weekly-heatmap-card">
        <Card.Body>
          <div className="heatmap-header">
            <i className="bi bi-calendar-week"></i>
            <h5>Weekly Activity</h5>
          </div>
          <div className="heatmap-placeholder">
            <p>No activity data yet</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  // Find max cards for intensity calculation
  const maxCards = Math.max(...weeklyActivity.map(d => d.cards_reviewed), 1);

  // Get intensity level (0-4) based on cards reviewed
  const getIntensity = (cards) => {
    if (cards === 0) return 0;
    const ratio = cards / maxCards;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  // Get total cards for the week
  const totalCards = weeklyActivity.reduce((sum, day) => sum + day.cards_reviewed, 0);
  const totalTime = weeklyActivity.reduce((sum, day) => sum + day.time_spent_seconds, 0);

  // Format total time
  const formatTotalTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Card className="weekly-heatmap-card">
      <Card.Body>
        <div className="heatmap-header">
          <i className="bi bi-calendar-week"></i>
          <h5>Weekly Activity</h5>
          <div className="heatmap-summary">
            <span className="summary-stat">
              <i className="bi bi-card-text"></i>
              {totalCards} cards
            </span>
            <span className="summary-stat">
              <i className="bi bi-clock"></i>
              {formatTotalTime(totalTime)}
            </span>
          </div>
        </div>

        <div className="heatmap-grid">
          {weeklyActivity.map((day, index) => (
            <div
              key={index}
              className={`heatmap-day intensity-${getIntensity(day.cards_reviewed)}`}
              title={`${day.day_name}: ${day.cards_reviewed} cards, ${day.time_spent_formatted}`}
            >
              <span className="day-label">{day.day_name}</span>
              <span className="day-count">{day.cards_reviewed}</span>
            </div>
          ))}
        </div>

        <div className="heatmap-legend">
          <span className="legend-label">Less</span>
          <div className="legend-squares">
            <div className="legend-square intensity-0"></div>
            <div className="legend-square intensity-1"></div>
            <div className="legend-square intensity-2"></div>
            <div className="legend-square intensity-3"></div>
            <div className="legend-square intensity-4"></div>
          </div>
          <span className="legend-label">More</span>
        </div>
      </Card.Body>
    </Card>
  );
};

export default WeeklyHeatmap;
