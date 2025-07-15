import { useState, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createTopic } from '../../services/api';
import { RefreshContext } from '../dashboard/ModernDashboard';
import './AddTopicCard.css';

const AddTopicCard = () => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    resourceUrl: '',
    studyDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const { user } = useAuth();
  const { triggerRefresh } = useContext(RefreshContext);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Topic title is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Topic description is required';
    }
    
    if (formData.resourceUrl && !isValidUrl(formData.resourceUrl)) {
      newErrors.resourceUrl = 'Please enter a valid URL';
    }
    
    if (!formData.studyDate) {
      newErrors.studyDate = 'Start date is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setSuccess('');
    
    try {
      await createTopic({
        title: formData.title,
        content: formData.content,
        resource_url: formData.resourceUrl || null,
        initial_revision_date: formData.studyDate
      });
      
      setSuccess('Topic added successfully! 🎉');
      setFormData({
        title: '',
        content: '',
        resourceUrl: '',
        studyDate: new Date().toISOString().split('T')[0]
      });
      
      // Trigger refresh in other components
      triggerRefresh();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to add topic' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-topic-card">
      <div className="add-topic-header">
        <h3 className="add-topic-title">Add New Topic</h3>
        <p className="add-topic-subtitle">Create a new topic for your spaced repetition learning</p>
      </div>
      
      {success && (
        <div className="success-message">
          <i className="bi bi-check-circle-fill"></i>
          {success}
        </div>
      )}
      
      {errors.submit && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {errors.submit}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="add-topic-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            <i className="bi bi-card-text"></i>
            Topic Title
          </label>
          <input
            type="text"
            id="title"
            className={`form-input ${errors.title ? 'error' : ''}`}
            placeholder="Enter your topic title..."
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            disabled={loading}
          />
          {errors.title && <span className="error-text">{errors.title}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="content" className="form-label">
            <i className="bi bi-file-text"></i>
            Topic Description
          </label>
          <textarea
            id="content"
            className={`form-textarea ${errors.content ? 'error' : ''}`}
            placeholder="Describe what you want to learn and remember..."
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            disabled={loading}
            rows={4}
          />
          {errors.content && <span className="error-text">{errors.content}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="resourceUrl" className="form-label">
            <i className="bi bi-link-45deg"></i>
            Study Resource (Optional)
          </label>
          <input
            type="url"
            id="resourceUrl"
            className={`form-input ${errors.resourceUrl ? 'error' : ''}`}
            placeholder="https://example.com/study-material"
            value={formData.resourceUrl}
            onChange={(e) => handleInputChange('resourceUrl', e.target.value)}
            disabled={loading}
          />
          {errors.resourceUrl && <span className="error-text">{errors.resourceUrl}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="studyDate" className="form-label">
            <i className="bi bi-calendar3"></i>
            Start Date
          </label>
          <div className="date-input-container">
            <input
              type="date"
              id="studyDate"
              className={`form-input date-input ${errors.studyDate ? 'error' : ''}`}
              value={formData.studyDate}
              onChange={(e) => handleInputChange('studyDate', e.target.value)}
              disabled={loading}
            />
            <i className="bi bi-calendar3 date-icon"></i>
          </div>
          {errors.studyDate && <span className="error-text">{errors.studyDate}</span>}
          {formData.studyDate && (
            <div className="date-info">
              <small>
                <i className="bi bi-info-circle"></i>
                Your first revision will be on {new Date(new Date(formData.studyDate).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
              </small>
            </div>
          )}
        </div>
        
        <button 
          type="submit" 
          className="add-topic-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              Adding Topic...
            </>
          ) : (
            <>
              <i className="bi bi-plus-lg"></i>
              Add Topic
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AddTopicCard; 