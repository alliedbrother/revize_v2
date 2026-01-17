import { useState } from 'react';
import { Container, Button } from 'react-bootstrap';
import AddTopicModal from './AddTopicModal';
import './TodaysLearning.css';

const TodaysLearning = () => {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="todays-learning-container">
      {/* Timer Container */}
      <Container fluid className="timer-container">
        {/* Add Topic Button */}
            <Button 
          className="timer-add-btn"
              variant="primary" 
          size="lg"
          onClick={() => setShowAddModal(true)}
          title="Add New Topic"
            >
          <i className="bi bi-plus-lg"></i>
            </Button>
      </Container>
      
      {/* Add Topic Modal */}
      <AddTopicModal 
        show={showAddModal} 
        onHide={() => setShowAddModal(false)} 
      />
    </div>
  );
};

export default TodaysLearning; 