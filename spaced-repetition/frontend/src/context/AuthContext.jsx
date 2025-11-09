import { createContext, useContext, useState, useEffect } from 'react';
import { authService, userService } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await userService.getProfile();
          setUser(userData);
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setError(null);
      console.log('AuthContext: Attempting login with:', credentials);

      const response = await authService.login(credentials);
      console.log('AuthContext: Login response:', response);

      if (response && response.token) {
        localStorage.setItem('token', response.token);
        setUser({
          id: response.user_id,
          username: response.username,
          email: response.email,
          first_name: response.first_name || '',
          last_name: response.last_name || '',
          profile_picture: response.profile_picture || null
        });
        return { success: true };
      } else {
        throw new Error('Invalid response from server: No token received');
      }
    } catch (err) {
      console.error('AuthContext: Login error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      const errorMessage = err.response?.data?.message || err.message || 'Failed to login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      console.log('AuthContext: Attempting registration with:', {
        username: userData.username,
        email: userData.email,
        password: '********',
        password_confirm: '********'
      });
      
      const response = await authService.register(userData);
      console.log('AuthContext: Registration response:', response);

      if (response && response.token) {
        localStorage.setItem('token', response.token);
        setUser({
          id: response.user_id,
          username: response.username,
          email: response.email,
          first_name: response.first_name || '',
          last_name: response.last_name || '',
          profile_picture: response.profile_picture || null
        });
        return { success: true };
      } else {
        throw new Error('Invalid response from server: No token received');
      }
    } catch (err) {
      console.error('AuthContext: Registration error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Failed to register';
      
      if (err.response) {
        if (err.response.data) {
          if (err.response.data.password) {
            errorMessage = err.response.data.password;
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message;
          } else if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error;
          }
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
    }
  };

  const changePassword = async (passwordData) => {
    try {
      setError(null);
      await authService.changePassword(passwordData);
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to change password';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const googleLogin = async (credential) => {
    try {
      setError(null);
      console.log('AuthContext: Attempting Google login');
      
      const response = await authService.googleLogin(credential);
      console.log('AuthContext: Google login response:', response);
      
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        setUser({
          id: response.user_id,
          username: response.username,
          email: response.email,
          first_name: response.first_name || '',
          last_name: response.last_name || '',
          profile_picture: response.profile_picture || null
        });
        return { success: true };
      } else {
        throw new Error('Invalid response from server: No token received');
      }
    } catch (err) {
      console.error('AuthContext: Google login error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to login with Google';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const updateUser = async (updatedData) => {
    try {
      setError(null);

      // Always merge the updated data with existing user state
      // This ensures profile_picture, first_name, etc. are preserved and updated
      setUser(prevUser => ({
        ...prevUser,
        ...updatedData
      }));

      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    updateUser,
    changePassword,
    googleLogin,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 