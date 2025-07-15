import { useEffect } from 'react';
import PomodoroTimer from './PomodoroTimer';
import './PomodoroModal.css';

const PomodoroModal = ({ show, onClose }) => {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [show, onClose]);

  // Handle click outside to close modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="pomodoro-modal-overlay" onClick={handleOverlayClick}>
      <div className="pomodoro-modal-container">
        <div className="pomodoro-modal-header">
          <h2 className="pomodoro-modal-title">
            <i className="bi bi-stopwatch"></i>
            Pomodoro Timer
          </h2>
          <button 
            className="pomodoro-modal-close"
            onClick={onClose}
            aria-label="Close timer"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="pomodoro-modal-content">
          <PomodoroTimer />
        </div>
      </div>
    </div>
  );
};

export default PomodoroModal; 