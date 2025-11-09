import { useState, useContext } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { createTopic } from '../../services/api';
import { RefreshContext } from '../../context/RefreshContext';

const AddTopicModal = ({ show, onHide }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [studyDate, setStudyDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();
  const { triggerRefresh } = useContext(RefreshContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await createTopic({ 
        title, 
        content, 
        initial_revision_date: studyDate 
      });
      setSuccess('Topic added successfully!');
      setTitle('');
      setContent('');
      setStudyDate(new Date().toISOString().split('T')[0]);
      
      // Trigger refresh in other components
      triggerRefresh();
      
      // Close modal after success
      setTimeout(() => {
        setSuccess('');
        onHide();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to add topic');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    setStudyDate(new Date().toISOString().split('T')[0]);
    setError('');
    setSuccess('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-plus-circle me-2"></i>
          Add New Topic
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>
              <i className="bi bi-card-text me-2"></i>
              Title
            </Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Enter topic title"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              <i className="bi bi-file-text me-2"></i>
              Content
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="Enter topic content"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>
              <i className="bi bi-calendar3 me-2"></i>
              Study Date
            </Form.Label>
            <Form.Text className="text-muted d-block mb-2">
              When did you study this topic? Revision dates will be calculated from this date.
            </Form.Text>
            <Form.Control
              type="date"
              value={studyDate}
              onChange={(e) => setStudyDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              disabled={loading}
            />
          </Form.Group>

          <div className="d-flex justify-content-end gap-2">
            <Button 
              variant="secondary" 
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Adding...
                </>
              ) : (
                <>
                  <i className="bi bi-plus-lg me-2"></i>
                  Add Topic
                </>
              )}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default AddTopicModal; 