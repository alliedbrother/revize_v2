import { useState } from 'react';
import PomodoroModal from './PomodoroModal';
import './FloatingTimerButton.css';

const FloatingTimerButton = () => {
  const [showModal, setShowModal] = useState(false);

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <button 
        className="floating-timer-button"
        onClick={handleOpenModal}
        title="Open Pomodoro Timer"
        aria-label="Open Pomodoro Timer"
      >
        <i className="bi bi-stopwatch"></i>
      </button>
      
      <PomodoroModal 
        show={showModal} 
        onClose={handleCloseModal} 
      />
    </>
  );
};

export default FloatingTimerButton; 