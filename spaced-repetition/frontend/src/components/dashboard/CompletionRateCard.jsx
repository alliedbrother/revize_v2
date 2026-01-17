import { Card } from 'react-bootstrap';
import './CompletionRateCard.css';

const CompletionRateCard = ({ studyStats }) => {
  if (!studyStats) {
    return (
      <Card className="completion-rate-card">
        <Card.Body>
          <div className="completion-placeholder">
            <i className="bi bi-pie-chart"></i>
            <p>Complete some reviews to see your rate</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  const {
    completion_rate_today,
    completion_rate_week,
    completion_rate_all_time,
    cards_reviewed_today,
    cards_postponed_today,
    total_cards_reviewed,
    total_cards_postponed
  } = studyStats;

  // Calculate the circumference for the progress ring
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const rate = completion_rate_all_time || 0;
  const offset = circumference - (rate / 100) * circumference;

  // Get rate color
  const getRateColor = (rate) => {
    if (rate >= 80) return 'var(--accent-success)';
    if (rate >= 60) return 'var(--accent-warning)';
    return 'var(--accent-error)';
  };

  // Get rate label
  const getRateLabel = (rate) => {
    if (rate >= 90) return 'Excellent';
    if (rate >= 80) return 'Great';
    if (rate >= 70) return 'Good';
    if (rate >= 60) return 'Fair';
    return 'Needs Work';
  };

  return (
    <Card className="completion-rate-card">
      <Card.Body>
        <div className="completion-header">
          <i className="bi bi-graph-up-arrow"></i>
          <h5>Completion Rate</h5>
        </div>

        <div className="completion-content">
          {/* Main Circular Progress */}
          <div className="main-progress">
            <svg className="progress-ring" viewBox="0 0 100 100">
              <circle
                className="progress-ring-bg"
                cx="50"
                cy="50"
                r={radius}
                strokeWidth="8"
              />
              <circle
                className="progress-ring-fill"
                cx="50"
                cy="50"
                r={radius}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ stroke: getRateColor(rate) }}
              />
            </svg>
            <div className="progress-text">
              <span className="rate-value">{Math.round(rate)}%</span>
              <span className="rate-label">{getRateLabel(rate)}</span>
            </div>
          </div>

          {/* Breakdown Stats */}
          <div className="completion-breakdown">
            <div className="breakdown-item">
              <div className="breakdown-header">
                <span className="breakdown-label">Today</span>
                <span className="breakdown-value" style={{ color: getRateColor(completion_rate_today) }}>
                  {Math.round(completion_rate_today || 0)}%
                </span>
              </div>
              <div className="breakdown-bar">
                <div
                  className="breakdown-fill"
                  style={{
                    width: `${completion_rate_today || 0}%`,
                    background: getRateColor(completion_rate_today)
                  }}
                />
              </div>
              <div className="breakdown-counts">
                <span className="count completed">
                  <i className="bi bi-check-circle-fill"></i>
                  {cards_reviewed_today || 0}
                </span>
                <span className="count postponed">
                  <i className="bi bi-arrow-repeat"></i>
                  {cards_postponed_today || 0}
                </span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-header">
                <span className="breakdown-label">This Week</span>
                <span className="breakdown-value" style={{ color: getRateColor(completion_rate_week) }}>
                  {Math.round(completion_rate_week || 0)}%
                </span>
              </div>
              <div className="breakdown-bar">
                <div
                  className="breakdown-fill"
                  style={{
                    width: `${completion_rate_week || 0}%`,
                    background: getRateColor(completion_rate_week)
                  }}
                />
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-header">
                <span className="breakdown-label">All Time</span>
                <span className="breakdown-value" style={{ color: getRateColor(completion_rate_all_time) }}>
                  {Math.round(completion_rate_all_time || 0)}%
                </span>
              </div>
              <div className="breakdown-bar">
                <div
                  className="breakdown-fill"
                  style={{
                    width: `${completion_rate_all_time || 0}%`,
                    background: getRateColor(completion_rate_all_time)
                  }}
                />
              </div>
              <div className="breakdown-counts">
                <span className="count completed">
                  <i className="bi bi-check-circle-fill"></i>
                  {total_cards_reviewed || 0} mastered
                </span>
                <span className="count postponed">
                  <i className="bi bi-arrow-repeat"></i>
                  {total_cards_postponed || 0} to review
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default CompletionRateCard;
