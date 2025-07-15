# Google OAuth Setup Guide

This guide will help you set up Google Sign-In for your Revize application.

## 🔧 Required Configurations

### 1. Google Cloud Console Setup

1. **Go to Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google APIs**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
   - Also enable "Google Identity Services API"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application" as the application type
   - Add authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `https://yourdomain.com` (for production)
   - Add authorized redirect URIs:
     - `http://localhost:5173` (for development)
     - `https://yourdomain.com` (for production)
   - Save and copy the **Client ID** (you'll need this)

### 2. Backend Configuration (Django)

The backend is already configured with:
- ✅ `django-allauth` installed
- ✅ Google OAuth provider configured
- ✅ Custom Google login endpoint at `/api/auth/google/`
- ✅ Database migrations applied

**Optional: Set Google credentials in settings.py** (for additional verification):
```python
# In spaced-repetition/backend/spaced_repetition/settings.py
GOOGLE_OAUTH2_CLIENT_ID = 'your_google_client_id_here'
GOOGLE_OAUTH2_CLIENT_SECRET = 'your_google_client_secret_here'
```

### 3. Frontend Configuration (React)

1. **Create environment file**:
   ```bash
   cd spaced-repetition/frontend
   cp .env.example .env
   ```

2. **Add your Google Client ID**:
   ```env
   # In spaced-repetition/frontend/.env
   VITE_GOOGLE_CLIENT_ID=207768218915-deijp30cnukg4i6p9pudmv4vrhapfoup.apps.googleusercontent.com
   VITE_API_URL=http://localhost:8000
   ```

3. **The frontend is already configured with**:
   - ✅ Google Identity Services integration
   - ✅ Google Sign-In component
   - ✅ Updated Login and Register pages
   - ✅ AuthContext with Google login support

## 🚀 How It Works

### Frontend Flow:
1. User clicks "Sign in with Google" button
2. Google Identity Services popup opens
3. User authenticates with Google
4. Google returns a JWT credential
5. Frontend sends credential to backend `/api/auth/google/`
6. Backend verifies and creates/logs in user
7. Backend returns authentication token
8. User is redirected to dashboard

### Backend Flow:
1. Receives Google JWT credential
2. Extracts user email and name from JWT
3. Checks if user exists in database
4. Creates new user if doesn't exist (with unique username)
5. Returns Django authentication token
6. Token is used for subsequent API requests

## 🧪 Testing the Integration

1. **Start the backend**:
   ```bash
   cd spaced-repetition/backend
   python manage.py runserver
   ```

2. **Start the frontend**:
   ```bash
   cd spaced-repetition/frontend
   npm run dev
   ```

3. **Test Google Sign-In**:
   - Go to `http://localhost:5173/login`
   - Click "Sign in with Google"
   - Complete Google authentication
   - Should redirect to dashboard

## 🔒 Security Features

- ✅ JWT credential verification
- ✅ Email-based user identification
- ✅ Automatic user creation for new Google accounts
- ✅ Unique username generation to avoid conflicts
- ✅ Django token-based authentication
- ✅ CORS properly configured

## 🐛 Troubleshooting

### Common Issues:

1. **"Invalid Google Client ID" error**:
   - Make sure `VITE_GOOGLE_CLIENT_ID` is set correctly in `.env`
   - Verify the Client ID in Google Cloud Console

2. **CORS errors**:
   - Ensure your domain is added to authorized origins in Google Cloud Console
   - Check that `CORS_ALLOW_ALL_ORIGINS = True` in Django settings (development only)

3. **"Google login failed" error**:
   - Check browser developer console for detailed errors
   - Verify the backend API endpoint is accessible
   - Ensure Django server is running

4. **User creation fails**:
   - Check Django logs for database errors
   - Ensure migrations have been applied

### Debug Steps:

1. **Check browser console** for JavaScript errors
2. **Check Django logs** for backend errors
3. **Verify Google Cloud Console** settings
4. **Test API endpoint** directly: `POST /api/auth/google/`

## 📝 Additional Notes

- The integration automatically creates Django users for new Google accounts
- Existing users can link their Google account by using the same email
- The system generates unique usernames to avoid conflicts
- Google Sign-In works alongside traditional email/password authentication
- Users can have both Google and password authentication methods

## 🔄 Production Deployment

For production deployment:

1. **Update Google Cloud Console**:
   - Add your production domain to authorized origins
   - Add production redirect URIs

2. **Update environment variables**:
   - Set `VITE_GOOGLE_CLIENT_ID` with production Client ID
   - Set `VITE_API_URL` to your production API URL

3. **Django settings**:
   - Set `CORS_ALLOW_ALL_ORIGINS = False`
   - Add specific origins to `CORS_ALLOWED_ORIGINS`
   - Set `DEBUG = False`

That's it! Your Google OAuth integration is now ready to use. 🎉 