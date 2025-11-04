import axios from 'axios';
import config from '../config/environment.js';

const API_URL = config.API_BASE_URL;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token and timezone to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }

  // Add user's timezone to all requests
  // This ensures the backend can calculate "today" based on user's local time
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    config.headers['X-Timezone'] = userTimezone;
  } catch (e) {
    console.warn('Could not detect user timezone:', e);
  }

  return config;
});

// Server Time
export const getServerTime = async () => {
  const response = await api.get('/server-time/');
  return response.data;
};

// Topics
export const createTopic = async (topicData) => {
  const response = await api.post('/topics/', topicData);
  return response.data;
};

export const getAllTopics = async () => {
  const response = await api.get('/topics/');
  return response.data;
};

export const getTodaysTopics = async () => {
  const response = await api.get('/topics/today/');
  return response.data;
};

export const getTopic = async (id) => {
  const response = await api.get(`/topics/${id}/`);
  return response.data;
};

export const updateTopic = async (id, topicData) => {
  const response = await api.put(`/topics/${id}/`, topicData);
  return response.data;
};

export const deleteTopic = async (id) => {
  await api.delete(`/topics/${id}/`);
};

export const uploadDocument = async (formData) => {
  const response = await api.post('/topics/upload-document/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadImages = async (formData) => {
  const response = await api.post('/topics/upload-images/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Revisions
export const getTodaysRevisions = async () => {
  // We're using the server's endpoint which determines "today" based on server time
  // This avoids timezone discrepancies between client and server
  const response = await api.get('/revisions/today/');
  return response.data;
};

export const getMissedRevisions = async () => {
  const response = await api.get('/revisions/missed/');
  return response.data;
};

export const getCompletedTodayRevisions = async () => {
  const response = await api.get('/revisions/completed-today/');
  return response.data;
};

export const getRevisionSchedule = async () => {
  const response = await api.get('/revisions/schedule/');
  return response.data;
};

export const completeRevision = async (revisionId) => {
  const response = await api.post(`/revisions/${revisionId}/complete/`);
  return response.data;
};

export const postponeRevision = async (revisionId) => {
  const response = await api.post(`/revisions/${revisionId}/postpone/`);
  return response.data;
};

// Flashcard Revisions
export const completeFlashcardRevision = async (revisionId) => {
  const response = await api.post(`/flashcard-revisions/${revisionId}/complete/`);
  return response.data;
};

export const postponeFlashcardRevision = async (revisionId) => {
  const response = await api.post(`/flashcard-revisions/${revisionId}/postpone/`);
  return response.data;
};

// Statistics
export const getStatistics = async () => {
  const response = await api.get('/statistics/');
  return response.data;
};

// Auth Service
export const authService = {
  login: async (credentials) => {
    const response = await api.post('/login/', credentials);
    return response.data;
  },
  
  register: async (userData) => {
    const response = await api.post('/register/', userData);
    return response.data;
  },
  
  logout: async () => {
    // Token-based auth doesn't need backend logout
    // Just clear local storage (handled in AuthContext)
    return Promise.resolve();
  },
  
  changePassword: async (passwordData) => {
    const response = await api.post('/change-password/', passwordData);
    return response.data;
  },

  googleLogin: async (credential) => {
    // Decode the JWT credential to get the access token
    const payload = JSON.parse(atob(credential.split('.')[1]));
    
    const response = await api.post('/auth/google/', {
      access_token: credential,
      email: payload.email,
      name: payload.name,
      google_id: payload.sub
    });
    return response.data;
  }
};

// User Service
export const userService = {
  getProfile: async () => {
    const response = await api.get('/profile/');
    return response.data;
  },
  
  updateProfile: async (profileData) => {
    const response = await api.put('/profile/', profileData);
    return response.data;
  }
};

export default api; 