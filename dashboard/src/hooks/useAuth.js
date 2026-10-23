import { useState, useEffect, useCallback } from 'react';
import { 
  getAuthToken, 
  setAuthToken, 
  getServerInstance, 
  clearAuthSession, 
  registerUnauthorizedHandler, 
  authApi 
} from '../services/api';

export function useAuth() {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [isInitialized, setIsInitialized] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
    setAuthMode('login');
  }, []);

  // Register unauthorized listener so any 401 response logs out immediately
  useEffect(() => {
    registerUnauthorizedHandler(handleLogout);
  }, [handleLogout]);

  // Initial Auth Check & Server Instance Validation
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setAuthLoading(true);

      let currentServerInstance = null;
      try {
        const { ok, data } = await authApi.getStatus();
        if (ok && isMounted) {
          setIsInitialized(data.initialized);
          currentServerInstance = data.serverInstance;
          if (!data.initialized) {
            setAuthMode('signup');
          }
        }
      } catch (e) {
        console.warn('System status check warning:', e);
      }

      // If server was restarted, the instance ID changed -> force session expiry
      const savedInstance = getServerInstance();
      if (savedInstance && currentServerInstance && savedInstance !== currentServerInstance) {
        handleLogout();
        if (isMounted) setAuthLoading(false);
        return;
      }

      const activeToken = getAuthToken();
      if (activeToken) {
        try {
          const { ok, data } = await authApi.getMe(activeToken);
          if (ok && isMounted) {
            setUser(data);
            setToken(activeToken);
            if (currentServerInstance) {
              setAuthToken(activeToken, currentServerInstance);
            }
          } else {
            handleLogout();
          }
        } catch (e) {
          console.error(e);
          handleLogout();
        }
      } else {
        handleLogout();
      }

      if (isMounted) setAuthLoading(false);
    };

    initAuth();
    return () => { isMounted = false; };
  }, [handleLogout]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const trimmedEmail = (authForm.email || '').trim().toLowerCase();
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail) {
      setAuthError('Email address is required.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    if (!authForm.password) {
      setAuthError('Password is required.');
      return;
    }

    if (authMode === 'signup') {
      const trimmedName = (authForm.name || '').trim();
      if (!trimmedName) {
        setAuthError('Please enter your full name.');
        return;
      }
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        setAuthError('Full name must be between 2 and 100 characters.');
        return;
      }
      if (authForm.password.length < 8 || authForm.password.length > 128) {
        setAuthError('Password must be between 8 and 128 characters long.');
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match. Please retype your password.');
        return;
      }
    }

    try {
      let data;
      if (authMode === 'signup') {
        data = await authApi.signup({
          name: authForm.name.trim(),
          email: trimmedEmail,
          password: authForm.password,
          confirmPassword: authForm.confirmPassword
        });
      } else {
        data = await authApi.login({
          email: trimmedEmail,
          password: authForm.password
        });
      }

      setAuthToken(data.token, data.serverInstance);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  return {
    token,
    user,
    setUser,
    authLoading,
    authMode,
    setAuthMode,
    isInitialized,
    authError,
    setAuthError,
    authForm,
    setAuthForm,
    handleAuthSubmit,
    handleLogout
  };
}
