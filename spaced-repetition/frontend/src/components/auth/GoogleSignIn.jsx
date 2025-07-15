import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GoogleSignIn = ({ onError }) => {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const initializeGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleButtonRef.current) {
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signin_with',
            shape: 'rectangular',
          }
        );
      }
    }
  };

  const handleCredentialResponse = async (response) => {
    try {
      const { success, error } = await googleLogin(response.credential);
      
      if (success) {
        navigate('/dashboard');
      } else {
        console.error('Google login failed:', error);
        if (onError) {
          onError(error || 'Google sign-in failed');
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
      if (onError) {
        onError('Google sign-in failed. Please try again.');
      }
    }
  };

  return (
    <div className="google-signin-container">
      <div className="divider-container">
        <div className="divider-line"></div>
        <span className="divider-text">or</span>
        <div className="divider-line"></div>
      </div>
      <div 
        ref={googleButtonRef}
        className="google-signin-button"
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '1rem' 
        }}
      />
      <style jsx>{`
        .google-signin-container {
          margin: 1rem 0;
        }
        
        .divider-container {
          display: flex;
          align-items: center;
          margin: 1.5rem 0 1rem 0;
        }
        
        .divider-line {
          flex: 1;
          height: 1px;
          background-color: #e9ecef;
        }
        
        .divider-text {
          margin: 0 1rem;
          color: #6c757d;
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .google-signin-button {
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default GoogleSignIn; 