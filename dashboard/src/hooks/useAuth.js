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

    if (authMode === 'signup') {
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match. Please retype your password.');
        return;
      }
      if (authForm.password.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        return;
      }
    }

    try {
      let data;
      if (authMode === 'signup') {
        data = await authApi.signup({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
          confirmPassword: authForm.confirmPassword
        });
      } else {
        data = await authApi.login({
          email: authForm.email,
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
