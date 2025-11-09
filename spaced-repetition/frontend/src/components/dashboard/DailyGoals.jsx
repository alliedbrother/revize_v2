import React from 'react';
import { Card, ProgressBar } from 'react-bootstrap';
import './DailyGoals.css';

const DailyGoals = ({ goals, goalsCompletedToday }) => {
  if (!goals || goals.length === 0) {
    return null;
  }

  const goalIcons = {
    complete_revisions: 'check-circle',
    create_topics: 'plus-circle',
    maintain_streak: 'fire'
  };

  const goalLabels = {
    complete_revisions: 'Complete Revisions',
    create_topics: 'Create Topics',
    maintain_streak: 'Maintain Streak'
  };

  return (
    <Card className="daily-goals-card">
      <Card.Body>
        <div className="goals-header">
          <h5 className="goals-title">
            <i className="bi bi-target"></i>
            Daily Goals
          </h5>
          <div className="goals-progress-badge">
            {goalsCompletedToday || 0} / {goals.length} Complete
          </div>
        </div>

        <div className="goals-list">
          {goals.map((goal) => {
            const progress = goal.progress_percentage || 0;
            const isCompleted = goal.completed;
            const icon = goalIcons[goal.goal_type] || 'circle';

            return (
              <div key={goal.id} className={`goal-item ${isCompleted ? 'completed' : ''}`}>
                <div className="goal-icon">
                  <i className={`bi bi-${icon}${isCompleted ? '-fill' : ''}`}></i>
                </div>

                <div className="goal-content">
                  <div className="goal-header-row">
                    <span className="goal-label">{goalLabels[goal.goal_type] || goal.goal_type}</span>
                    <span className="goal-values">
                      {goal.current_value} / {goal.target_value}
                    </span>
                  </div>

                  <ProgressBar
                    now={progress}
                    className="goal-progress-bar"
                    variant={isCompleted ? 'success' : 'primary'}
                  />
                </div>

                {isCompleted && (
                  <div className="goal-checkmark">
                    <i className="bi bi-check-lg"></i>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {goalsCompletedToday === goals.length && (
          <div className="all-goals-complete">
            <i className="bi bi-trophy-fill"></i>
            Awesome! All goals completed today!
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default DailyGoals;
