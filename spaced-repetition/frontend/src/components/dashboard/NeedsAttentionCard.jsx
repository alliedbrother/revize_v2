import { Card } from 'react-bootstrap';
import './NeedsAttentionCard.css';

const NeedsAttentionCard = ({ cards }) => {
  if (!cards || cards.length === 0) {
    return (
      <Card className="needs-attention-card">
        <Card.Body>
          <div className="attention-header">
            <i className="bi bi-exclamation-triangle"></i>
            <h5>Needs Attention</h5>
          </div>
          <div className="attention-placeholder">
            <div className="placeholder-icon">
              <i className="bi bi-check-circle"></i>
            </div>
            <p>All cards are being learned well!</p>
            <span className="placeholder-hint">Cards that get postponed frequently will appear here</span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="needs-attention-card">
      <Card.Body>
        <div className="attention-header">
          <i className="bi bi-exclamation-triangle"></i>
          <h5>Needs Attention</h5>
          <span className="attention-count">{cards.length} cards</span>
        </div>

        <div className="attention-description">
          <p>These cards are frequently postponed. Consider breaking them down or reviewing the material.</p>
        </div>

        <div className="attention-list">
          {cards.map((card, index) => (
            <div key={card.id || index} className="attention-item">
              <div className="attention-item-content">
                <div className="item-title">{card.title}</div>
                <div className="item-topic">
                  <i className="bi bi-folder2"></i>
                  {card.topic_title}
                </div>
              </div>
              <div className="attention-item-stats">
                <div className="stat postpone-rate">
                  <span className="stat-value">{Math.round(card.postpone_rate)}%</span>
                  <span className="stat-label">postponed</span>
                </div>
                <div className="stat-breakdown">
                  <span className="reviewed">
                    <i className="bi bi-check"></i>
                    {card.times_reviewed}
                  </span>
                  <span className="postponed">
                    <i className="bi bi-arrow-repeat"></i>
                    {card.times_postponed}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};

export default NeedsAttentionCard;
