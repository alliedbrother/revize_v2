const environment = {
  development: {
    API_BASE_URL: 'http://localhost:8000/api',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    DEBUG: true,
  },
  staging: {
    API_BASE_URL: import.meta.env.VITE_API_URL || 'https://your-staging-api.com/api',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    DEBUG: false,
  },
  production: {
    API_BASE_URL: import.meta.env.VITE_API_URL || '/api',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    DEBUG: false,
  }
};

const currentEnv = import.meta.env.MODE || 'development';
const config = environment[currentEnv] || environment.development;

export default config; 