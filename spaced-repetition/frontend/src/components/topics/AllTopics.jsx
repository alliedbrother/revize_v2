import { useState, useEffect, useContext } from 'react';
import { Card, Button, Modal, Form, Alert, Badge, Spinner, ListGroup } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { getAllTopics, createTopic, deleteTopic, updateTopic, getTopic } from '../../services/api';
import { RefreshContext } from '../dashboard/ModernDashboard';
import { formatDateTime, formatDateFromTimestamp } from '../../utils/dateUtils';
import TopicDetailCard from './TopicDetailCard';
import FlashcardReviewSession from '../flashcards/FlashcardReviewSession';
import './AllTopics.css';

const AllTopics = () => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', content: '' });
  const [editTopic, setEditTopic] = useState({ id: null, title: '', content: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showTopicDetail, setShowTopicDetail] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [showReviewSession, setShowReviewSession] = useState(false);
  const [sessionRevisions, setSessionRevisions] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(new Set());

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [dateSort, setDateSort] = useState('newest');

  const { user } = useAuth();
  const { refreshTrigger, triggerRefresh } = useContext(RefreshContext);

  useEffect(() => {
    loadTopics();
  }, [refreshTrigger]);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const data = await getAllTopics();
      setTopics(data);
      setError('');
    } catch (err) {
      setError('Failed to load topics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (!newTopic.title.trim()) {
      setFormError('Title is required');
      return;
    }
    
    if (!newTopic.content.trim()) {
      setFormError('Content is required');
      return;
    }
    
    try {
      await createTopic(newTopic);
      setShowAddModal(false);
      setNewTopic({ title: '', content: '' });
      setFormError('');
      setSuccess('Topic created successfully!');
      triggerRefresh(); // Refresh the topics list
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setFormError('Failed to create topic');
      console.error(err);
    }
  };

  const handleEditTopic = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (!editTopic.title.trim()) {
      setFormError('Title is required');
      return;
    }
    
    if (!editTopic.content.trim()) {
      setFormError('Content is required');
      return;
    }
    
    try {
      setIsEditing(true);
      await updateTopic(editTopic.id, {
        title: editTopic.title,
        content: editTopic.content
      });
      
      // Update local state
      setTopics(topics.map(topic => 
        topic.id === editTopic.id 
          ? {...topic, title: editTopic.title, content: editTopic.content} 
          : topic
      ));
      
      setShowEditModal(false);
      setEditTopic({ id: null, title: '', content: '' });
      setFormError('');
      setSuccess('Topic updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setFormError('Failed to update topic');
      console.error(err);
    } finally {
      setIsEditing(false);
    }
  };

  const openEditModal = (topic) => {
    setEditTopic({
      id: topic.id,
      title: topic.title,
      content: topic.content
    });
    setShowEditModal(true);
  };

  const handleDeleteTopic = async (topicId) => {
    try {
      setIsDeleting(true);
      await deleteTopic(topicId);
      setTopics(topics.filter(topic => topic.id !== topicId));
      setDeleteConfirm(null);
      setSuccess('Topic deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete topic');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTopicClick = (topicId) => {
    setSelectedTopicId(topicId);
    setShowTopicDetail(true);
  };

  const handleCloseTopicDetail = () => {
    setShowTopicDetail(false);
    setSelectedTopicId(null);
  };

  const handleStartReview = async (topicId) => {
    try {
      setReviewLoading(prev => new Set(prev).add(topicId));
      const topicData = await getTopic(topicId);

      if (topicData.flashcards && topicData.flashcards.length > 0) {
        // Format flashcards to match the structure expected by FlashcardReviewSession
        const formattedFlashcards = topicData.flashcards.map((flashcard) => ({
          id: null, // No revision ID since this is practice mode
          flashcard: {
            id: flashcard.id,
            title: flashcard.title,
            content: flashcard.content,
          },
          isPracticeMode: true // Mark as practice mode
        }));

        setSessionRevisions(formattedFlashcards);
        setShowReviewSession(true);
      } else {
        setError('No flashcards available for this topic');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Failed to load flashcards for review');
      console.error('Error loading flashcards:', err);
      setTimeout(() => setError(''), 3000);
    } finally {
      setReviewLoading(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  const handleCloseReviewSession = () => {
    setShowReviewSession(false);
    setSessionRevisions([]);
  };

  // Get source type display name and badge variant
  const getSourceTypeInfo = (sourceType) => {
    const typeMap = {
      'manual': { label: 'Manual', variant: 'primary' },
      'document': { label: 'Doc', variant: 'success' },
      'image': { label: 'Image', variant: 'info' },
      'link': { label: 'Link', variant: 'warning' }
    };
    return typeMap[sourceType?.toLowerCase()] || { label: 'Manual', variant: 'primary' };
  };

  // Filter and sort topics
  const getFilteredTopics = () => {
    let filtered = [...topics];

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(topic =>
        topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(topic => {
        const topicType = topic.source_type?.toLowerCase() || 'manual';
        return topicType === selectedType;
      });
    }

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const filteredTopics = getFilteredTopics();

  return (
    <div className="all-topics-list">
      <Card className="topics-card shadow-sm">
        <Card.Header className="d-flex justify-content-center align-items-center topics-header position-relative">
          <h4 className="mb-0 fw-bold text-center">
            <i className="bi bi-collection me-2"></i>
            All Topics
            {topics.length > 0 && (
              <Badge bg="primary" pill className="ms-2 badge-count">{topics.length}</Badge>
            )}
          </h4>
          <Button 
            variant="primary" 
            onClick={() => setShowAddModal(true)}
            className="add-button position-absolute"
            style={{ right: '1.25rem' }}
          >
            <i className="bi bi-plus-lg me-1"></i>
            Add New Topic
          </Button>
        </Card.Header>
        <Card.Body className="topics-card-body">
          {/* Search and Filter Bar */}
          <div className="filter-bar mb-3">
            <div className="search-box-container">
              <i className="bi bi-search search-icon"></i>
              <Form.Control
                type="text"
                placeholder="Search topics by name or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>

            <div className="filter-controls">
              <Form.Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="manual">Manual</option>
                <option value="document">Document</option>
                <option value="image">Image</option>
                <option value="link">Link</option>
              </Form.Select>

              <Form.Select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value)}
                className="filter-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </Form.Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || selectedType !== 'all') && (
            <div className="active-filters mb-3">
              <span className="filter-label">Active Filters:</span>
              {searchQuery && (
                <Badge bg="secondary" className="filter-badge">
                  Search: "{searchQuery}"
                  <button
                    className="badge-close"
                    onClick={() => setSearchQuery('')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </Badge>
              )}
              {selectedType !== 'all' && (
                <Badge bg="secondary" className="filter-badge">
                  Type: {getSourceTypeInfo(selectedType).label}
                  <button
                    className="badge-close"
                    onClick={() => setSelectedType('all')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </Badge>
              )}
              <button
                className="clear-all-filters"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {error && <Alert variant="danger" className="mb-3 alert-animated">{error}</Alert>}
          {success && <Alert variant="success" className="mb-3 alert-animated">{success}</Alert>}
          
          {loading && topics.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading topics...</p>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-journal-text display-1 text-muted"></i>
              <h5 className="mt-3">No topics yet</h5>
              <p className="text-muted">Create your first topic to start learning!</p>
              <Button
                variant="primary"
                onClick={() => setShowAddModal(true)}
                className="mt-2"
              >
                <i className="bi bi-plus-lg me-1"></i>
                Add New Topic
              </Button>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-search display-1 text-muted"></i>
              <h5 className="mt-3">No topics found</h5>
              <p className="text-muted">Try adjusting your search or filters</p>
              <Button
                variant="outline-primary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                }}
                className="mt-2"
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>
                Clear Filters
              </Button>
            </div>
          ) : (
            <ListGroup variant="flush" className="topics-list scrollable-list">
              {filteredTopics.map((topic) => (
                <ListGroup.Item
                  key={topic.id}
                  className="topic-item"
                >
                  <div className="topic-content">
                    <div className="topic-text">
                      <h5 className="topic-title clickable" onClick={() => handleTopicClick(topic.id)}>
                        {topic.title}
                      </h5>
                      <p className="topic-description">
                        {topic.content.length > 150
                          ? `${topic.content.substring(0, 150)}...`
                          : topic.content}
                      </p>
                    </div>
                    <div className="topic-actions">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleStartReview(topic.id)}
                        className="action-button-sm"
                        title="Review Flashcards"
                        disabled={reviewLoading.has(topic.id)}
                      >
                        <i className="bi bi-card-checklist me-1"></i>
                        Review
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openEditModal(topic)}
                        className="action-button-sm"
                        title="Edit Topic"
                      >
                        <i className="bi bi-pencil me-1"></i>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteConfirm(topic.id)}
                        className="action-button-sm"
                        title="Delete Topic"
                      >
                        <i className="bi bi-trash me-1"></i>
                        Delete
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Add Topic Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton className="modal-header">
          <Modal.Title>
            <i className="bi bi-plus-circle me-2"></i>
            Add New Topic
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleAddTopic}>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter topic title"
                value={newTopic.title}
                onChange={(e) => setNewTopic({...newTopic, title: e.target.value})}
                className="form-input"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                placeholder="Enter topic content"
                value={newTopic.content}
                onChange={(e) => setNewTopic({...newTopic, content: e.target.value})}
                className="form-input"
              />
              <Form.Text className="text-muted">
                Include all the information you want to review later.
              </Form.Text>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button variant="outline-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                <i className="bi bi-plus-lg me-1"></i>
                Create Topic
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit Topic Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton className="modal-header">
          <Modal.Title>
            <i className="bi bi-pencil-square me-2"></i>
            Edit Topic
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleEditTopic}>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter topic title"
                value={editTopic.title}
                onChange={(e) => setEditTopic({...editTopic, title: e.target.value})}
                className="form-input"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                placeholder="Enter topic content"
                value={editTopic.content}
                onChange={(e) => setEditTopic({...editTopic, content: e.target.value})}
                className="form-input"
              />
              <Form.Text className="text-muted">
                Include all the information you want to review later.
              </Form.Text>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button variant="outline-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isEditing}>
                {isEditing ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" />
                    <span className="ms-1">Updating...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1"></i>
                    Update Topic
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={deleteConfirm !== null} onHide={() => setDeleteConfirm(null)}>
        <Modal.Header closeButton className="modal-header">
          <Modal.Title>
            <i className="bi bi-exclamation-triangle me-2 text-danger"></i>
            Confirm Deletion
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this topic? All associated revisions will be deleted as well.</p>
          <p className="text-danger fw-bold">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={() => handleDeleteTopic(deleteConfirm)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Spinner as="span" animation="border" size="sm" />
                <span className="ms-1">Deleting...</span>
              </>
            ) : (
              <>
                <i className="bi bi-trash me-1"></i>
                Delete Topic
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Topic Detail Modal */}
      <TopicDetailCard
        show={showTopicDetail}
        onHide={handleCloseTopicDetail}
        topicId={selectedTopicId}
      />

      {/* Flashcard Review Session */}
      <FlashcardReviewSession
        revisions={sessionRevisions}
        show={showReviewSession}
        onHide={handleCloseReviewSession}
        onComplete={handleCloseReviewSession}
      />
    </div>
  );
};

export default AllTopics; 