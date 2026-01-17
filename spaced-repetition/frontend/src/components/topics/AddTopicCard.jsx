import { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createTopic, uploadDocument, uploadImages, uploadLink, userService } from '../../services/api';
import { RefreshContext } from '../dashboard/ModernDashboard';
import { getCurrentDateString } from '../../utils/dateUtils';
import './AddTopicCard.css';

const AddTopicCard = () => {
  const [sourceType, setSourceType] = useState('manual'); // manual, link, image, document
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    link: '',
    studyDate: getCurrentDateString()
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [credits, setCredits] = useState({ available_credits: 0, unlimited_access: false });
  const [creditsLoading, setCreditsLoading] = useState(true);

  const { user } = useAuth();
  const { triggerRefresh } = useContext(RefreshContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const dateInputRef = useRef(null);

  // Fetch credits function (can be called on mount and after flashcard generation)
  const fetchCredits = async () => {
    if (user) {
      setCreditsLoading(true);
      try {
        const data = await userService.getUserCredits();
        setCredits(data);
      } catch (err) {
        console.error('Failed to fetch credits:', err);
        setCredits({ available_credits: 0, unlimited_access: false });
      } finally {
        setCreditsLoading(false);
      }
    }
  };

  // Fetch credits when component mounts
  useEffect(() => {
    fetchCredits();
  }, [user]);

  // Handle credits click - navigate to profile credits section
  const handleCreditsClick = () => {
    navigate('/profile');
    setTimeout(() => {
      const creditsSection = document.querySelector('.credits-card');
      if (creditsSection) {
        creditsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

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

  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    setFiles([]);
    setErrors({});
    setFormData({
      title: '',
      content: '',
      link: '',
      studyDate: getCurrentDateString()
    });
  };

  const handleFileSelect = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);

    // Validate file types and count
    if (sourceType === 'image') {
      const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

      if (files.length + imageFiles.length > 10) {
        setErrors({ files: 'Maximum 10 images allowed' });
        return;
      }

      setFiles(prev => [...prev, ...imageFiles].slice(0, 10));
      setErrors(prev => ({ ...prev, files: '' }));
    } else if (sourceType === 'document') {
      const docFile = fileArray[0];

      if (!docFile) return;

      // Check file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(docFile.type)) {
        setErrors({ files: 'Only PDF and Word documents are allowed' });
        return;
      }

      // Check file size (rough estimate: 3 pages ~500KB)
      if (docFile.size > 1024 * 1024 * 2) { // 2MB limit
        setErrors({ files: 'Document too large. Please limit to 3 pages.' });
        return;
      }

      setFiles([docFile]);
      setErrors(prev => ({ ...prev, files: '' }));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Title is optional for all types

    if (sourceType === 'manual') {
      if (!formData.title.trim()) {
        newErrors.title = 'Topic title is required';
      }
      if (!formData.content.trim()) {
        newErrors.content = 'Topic description is required';
      }
    } else if (sourceType === 'link') {
      if (!formData.link.trim()) {
        newErrors.link = 'Link is required';
      } else if (!isValidUrl(formData.link)) {
        newErrors.link = 'Please enter a valid URL';
      }
    } else if (sourceType === 'image' || sourceType === 'document') {
      if (files.length === 0) {
        newErrors.files = `Please upload ${sourceType === 'image' ? 'images' : 'a document'}`;
      }
    }

    if (!formData.studyDate) {
      newErrors.studyDate = 'Start date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSuccess('');
    setProcessingStatus('');

    try {
      // Handle document upload with AI flashcard generation
      if (sourceType === 'document') {
        setProcessingStatus('Uploading document...');

        const documentData = new FormData();
        documentData.append('document', files[0]);

        if (formData.title.trim()) {
          documentData.append('title', formData.title);
        }

        documentData.append('initial_revision_date', formData.studyDate);

        setProcessingStatus('Extracting text from document...');

        // Small delay to show the status
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Generating flashcards with AI...');

        const response = await uploadDocument(documentData);

        setSuccess(`✨ Successfully created ${response.flashcards_count} flashcards from your document!`);

        // Reset form
        setFormData({
          title: '',
          content: '',
          link: '',
          studyDate: getCurrentDateString()
        });
        setFiles([]);

        // Trigger refresh in other components
        triggerRefresh();

        // Refresh credits to show updated balance
        fetchCredits();

        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else if (sourceType === 'image') {
        // Handle image upload with AI flashcard generation
        setProcessingStatus('Uploading images...');

        const imageData = new FormData();
        files.forEach(file => {
          imageData.append('images', file);
        });

        if (formData.title.trim()) {
          imageData.append('title', formData.title);
        }

        imageData.append('initial_revision_date', formData.studyDate);

        setProcessingStatus('Analyzing images with AI...');

        // Small delay to show the status
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Extracting text and concepts from images...');

        // Small delay to show the status
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Generating flashcards...');

        const response = await uploadImages(imageData);

        setSuccess(`✨ Successfully created ${response.flashcards_count} flashcards from ${response.images_processed} image(s)!`);

        // Reset form
        setFormData({
          title: '',
          content: '',
          link: '',
          studyDate: getCurrentDateString()
        });
        setFiles([]);

        // Trigger refresh in other components
        triggerRefresh();

        // Refresh credits to show updated balance
        fetchCredits();

        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else if (sourceType === 'link') {
        // Handle link upload with AI flashcard generation
        setProcessingStatus('Validating link...');

        const linkData = {
          url: formData.link,
          initial_revision_date: formData.studyDate
        };

        if (formData.title.trim()) {
          linkData.title = formData.title;
        }

        setProcessingStatus('Checking if link is accessible...');
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Extracting content from webpage...');
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Analyzing content with AI...');
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Generating flashcards...');

        const response = await uploadLink(linkData);

        const linkTypeDisplay = response.link_type || 'web';
        setSuccess(`✨ Successfully created ${response.flashcards_count} flashcards from ${linkTypeDisplay} link!`);

        // Reset form
        setFormData({
          title: '',
          content: '',
          link: '',
          studyDate: getCurrentDateString()
        });
        setFiles([]);

        // Trigger refresh in other components
        triggerRefresh();

        // Refresh credits to show updated balance
        fetchCredits();

        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else if (sourceType === 'manual') {
        // Handle manual topic creation with AI flashcard generation
        setProcessingStatus('Creating topic...');

        // Small delay to show the status
        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Analyzing content with AI...');

        await new Promise(resolve => setTimeout(resolve, 500));

        setProcessingStatus('Generating flashcards...');

        const response = await createTopic({
          title: formData.title,
          content: formData.content,
          initial_revision_date: formData.studyDate
        });

        // Show success with flashcard count and LLM provider
        const llmProvider = response.llm_provider
          ? (response.llm_provider === 'gemini' ? 'Gemini' : 'OpenAI')
          : 'AI';
        const flashcardCount = response.flashcards_count || 5;

        setSuccess(`✨ Successfully created ${flashcardCount} flashcards using ${llmProvider}!`);

        // Reset form
        setFormData({
          title: '',
          content: '',
          link: '',
          studyDate: getCurrentDateString()
        });
        setFiles([]);

        // Trigger refresh in other components
        triggerRefresh();

        // Refresh credits to show updated balance
        fetchCredits();

        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || err.message || 'Failed to process request' });
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="add-topic-card">
      <div className="add-topic-split-layout">
        {/* Top Section: Add Topic Form */}
        <div className="add-topic-top-section">
          <div className="add-topic-header">
            <div className="header-content">
              <h3 className="add-topic-title">Add New Learning Material</h3>
            </div>
          </div>

          <div className="add-topic-content">

      {success && (
        <div className="success-message">
          <i className="bi bi-check-circle-fill"></i>
          {success}
        </div>
      )}

      {processingStatus && (
        <div className="processing-message">
          <div className="spinner-small"></div>
          <span>{processingStatus}</span>
        </div>
      )}

      {errors.submit && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {errors.submit}
        </div>
      )}

      {/* Source Type Selector */}
      <div className="source-type-selector">
        <button
          type="button"
          className={`source-type-btn ${sourceType === 'manual' ? 'active' : ''}`}
          onClick={() => handleSourceTypeChange('manual')}
        >
          <i className="bi bi-pencil-square"></i>
          <span>Manual</span>
        </button>
        <button
          type="button"
          className={`source-type-btn ${sourceType === 'link' ? 'active' : ''}`}
          onClick={() => handleSourceTypeChange('link')}
        >
          <i className="bi bi-link-45deg"></i>
          <span>Link</span>
        </button>
        <button
          type="button"
          className={`source-type-btn ${sourceType === 'image' ? 'active' : ''}`}
          onClick={() => handleSourceTypeChange('image')}
        >
          <i className="bi bi-image"></i>
          <span>Images</span>
        </button>
        <button
          type="button"
          className={`source-type-btn ${sourceType === 'document' ? 'active' : ''}`}
          onClick={() => handleSourceTypeChange('document')}
        >
          <i className="bi bi-file-earmark-text"></i>
          <span>Document</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="add-topic-form">
        {/* Topic Name */}
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            <i className="bi bi-card-text"></i>
            <span>Topic Name</span>
          </label>
          <input
            type="text"
            id="title"
            className={`form-input ${errors.title ? 'error' : ''}`}
            placeholder={
              sourceType === 'manual'
                ? "Enter your topic name..."
                : sourceType === 'link'
                ? "e.g., React Hooks Tutorial"
                : sourceType === 'image'
                ? "e.g., Biology Diagrams"
                : "e.g., Machine Learning Notes"
            }
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            disabled={loading}
          />
          {errors.title && <span className="error-text">{errors.title}</span>}
        </div>

        {/* Start Date */}
        <div className="form-group">
          <label htmlFor="studyDate" className="form-label">
            <i className="bi bi-calendar-check"></i>
            <span>Start Date</span>
          </label>
          <input
            type="date"
            id="studyDate"
            ref={dateInputRef}
            className={`form-input date-picker-input ${errors.studyDate ? 'error' : ''}`}
            value={formData.studyDate}
            onChange={(e) => handleInputChange('studyDate', e.target.value)}
            disabled={loading}
          />
          {errors.studyDate && <span className="error-text">{errors.studyDate}</span>}
        </div>

        {/* Manual Input - Description */}
        {sourceType === 'manual' && (
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
              rows={2}
            />
            {errors.content && <span className="error-text">{errors.content}</span>}
          </div>
        )}

        {/* Link Input */}
        {sourceType === 'link' && (
          <div className="form-group">
            <label htmlFor="link" className="form-label">
              <i className="bi bi-link-45deg"></i>
              Paste Link (YouTube, Article, Website)
            </label>
            <input
              type="url"
              id="link"
              className={`form-input ${errors.link ? 'error' : ''}`}
              placeholder="https://youtube.com/watch?v=... or https://example.com/article"
              value={formData.link}
              onChange={(e) => handleInputChange('link', e.target.value)}
              disabled={loading}
            />
            {errors.link && <span className="error-text">{errors.link}</span>}
          </div>
        )}

        {/* Image Upload */}
        {sourceType === 'image' && (
          <div className="form-group">
            <label className="form-label">
              <i className="bi bi-image"></i>
              Upload Images (Max 10)
            </label>
            <div
              className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${errors.files ? 'error' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              <i className="bi bi-cloud-upload"></i>
              <p>Drag & drop images here or click to browse</p>
              <small>PNG, JPG, JPEG • Max 10 images</small>
            </div>
            {errors.files && <span className="error-text">{errors.files}</span>}

            {/* Image Previews */}
            {files.length > 0 && (
              <div className="file-preview-grid">
                {files.map((file, index) => (
                  <div key={index} className="file-preview-item">
                    <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-file-btn"
                      onClick={() => removeFile(index)}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                    <div className="file-name">{file.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Document Upload */}
        {sourceType === 'document' && (
          <div className="form-group">
            <label className="form-label">
              <i className="bi bi-file-earmark-text"></i>
              Upload Document (Max 3 pages)
            </label>
            <div
              className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${errors.files ? 'error' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              <i className="bi bi-cloud-upload"></i>
              <p>Drag & drop document here or click to browse</p>
              <small>PDF, DOC, DOCX • Max 3 pages</small>
            </div>
            {errors.files && <span className="error-text">{errors.files}</span>}

            {/* Document Preview */}
            {files.length > 0 && (
              <div className="file-preview-list">
                <div className="file-preview-item-doc">
                  <i className="bi bi-file-earmark-pdf"></i>
                  <div className="file-info">
                    <div className="file-name">{files[0].name}</div>
                    <div className="file-size">{(files[0].size / 1024).toFixed(2)} KB</div>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => setFiles([])}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="add-topic-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              Processing...
            </>
          ) : (
            <>
              <i className="bi bi-plus-lg"></i>
              Generate Flashcards
            </>
          )}
        </button>

        {/* Credits Display Button */}
        <button
          type="button"
          className="credits-display-button"
          onClick={handleCreditsClick}
          disabled={creditsLoading}
        >
          {creditsLoading ? (
            <>
              <div className="spinner-small"></div>
              Loading...
            </>
          ) : (
            <>
              {credits.unlimited_access ? (
                <>
                  <i className="bi bi-infinity"></i>
                  Unlimited Credits
                </>
              ) : (
                <>
                  <i className="bi bi-lightning-charge-fill"></i>
                  {credits.available_credits} {credits.available_credits === 1 ? 'Credit' : 'Credits'} Available
                </>
              )}
            </>
          )}
        </button>
      </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTopicCard;
