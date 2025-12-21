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

// Add access token and timezone to requests
api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 error and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          // Try to refresh the token
          const response = await axios.post(`${API_URL}/token/refresh/`, {
            refresh: refreshToken
          });

          const { access } = response.data;
          localStorage.setItem('accessToken', access);

          // Update the failed request with new token and retry
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - redirect to login
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

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

export const uploadLink = async (linkData) => {
  const response = await api.post('/topics/upload-link/', linkData);
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

// Gamification API
export const getGamificationStats = async () => {
  const response = await api.get('/gamification/stats/');
  return response.data;
};

export const getUserStreak = async () => {
  const response = await api.get('/gamification/streak/');
  return response.data;
};

export const updateUserStreak = async () => {
  const response = await api.post('/gamification/streak/');
  return response.data;
};

export const getUserLevel = async () => {
  const response = await api.get('/gamification/level/');
  return response.data;
};

export const awardXP = async (xpAmount) => {
  const response = await api.post('/gamification/level/', { xp_amount: xpAmount });
  return response.data;
};

export const getAllAchievements = async () => {
  const response = await api.get('/gamification/achievements/');
  return response.data;
};

export const getMyAchievements = async () => {
  const response = await api.get('/gamification/achievements/my_achievements/');
  return response.data;
};

export const getAchievementProgress = async () => {
  const response = await api.get('/gamification/achievements/progress/');
  return response.data;
};

export const getTodayGoals = async () => {
  const response = await api.get('/gamification/goals/today/');
  return response.data;
};

export const updateGoalProgress = async (goalId, value = 1) => {
  const response = await api.post(`/gamification/goals/${goalId}/update_progress/`, { value });
  return response.data;
};

export const getGoalsHistory = async (days = 7) => {
  const response = await api.get(`/gamification/goals/history/?days=${days}`);
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
  },

  // ==============================
  // CREDIT SYSTEM API
  // ==============================

  /**
   * Get user's current credit balance
   * @returns {Promise<{available_credits: number, total_credits_earned: number, total_credits_used: number, unlimited_access: boolean}>}
   */
  getUserCredits: async () => {
    const response = await api.get('/credits/');
    return response.data;
  },

  /**
   * Redeem a promo code
   * @param {string} promoCode - The promo code to redeem
   * @returns {Promise<{message: string, credits_granted: number, unlimited_granted: boolean, available_credits: number, unlimited_access: boolean, tier: string}>}
   */
  redeemPromoCode: async (promoCode) => {
    const response = await api.post('/credits/redeem/', {
      promo_code: promoCode
    });
    return response.data;
  },

  /**
   * Get credit usage history
   * @returns {Promise<Array<{action: string, action_display: string, credits_changed: number, credits_after: number, description: string, created_at: string}>>}
   */
  getCreditHistory: async () => {
    const response = await api.get('/credits/history/');
    return response.data;
  },

  /**
   * Upload profile picture
   * @param {File} file - The image file to upload
   * @returns {Promise<{message: string, profile_picture: string, user: object}>}
   */
  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);
    const response = await api.post('/profile/upload-picture/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};

export default api; 