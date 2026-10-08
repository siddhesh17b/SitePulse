import React, { useState, useEffect, useRef } from 'react';
import { Menu, Layers, Plus } from 'lucide-react';
import { io } from 'socket.io-client';

import AuthView from './components/AuthView';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import CustomizerView from './components/CustomizerView';
import FeedbackView from './components/FeedbackView';
import AnalyticsView from './components/AnalyticsView';
import PageRulesView from './components/PageRulesView';
import SettingsView from './components/SettingsView';
import { 
  ChangeDomainModal, 
  NewSiteModal, 
  DeleteSiteModal, 
  DeleteChatsModal 
} from './components/Modals';

const BACKEND_URL = (window.location.origin.includes(':3000') || window.location.origin.includes(':5173'))
  ? 'http://localhost:5000' 
  : window.location.origin;

export default function App() {
  // Purge any legacy persistent tokens from localStorage
  try {
    localStorage.removeItem('sitepulse_admin_token');
  } catch (e) {}

  // Auth state (session-scoped: clears on tab/browser close or server restart)
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem('sitepulse_admin_token') || null;
    } catch (e) {
      return null;
    }
  });
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [isInitialized, setIsInitialized] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  // Navigation & Sites state
  const [activeNav, setActiveNav] = useState('chat'); // 'chat' | 'customizer' | 'page-rules' | 'feedback' | 'analytics' | 'settings'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatView, setMobileChatView] = useState(false);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [deleteSiteModal, setDeleteSiteModal] = useState({
    open: false,
    site: null,
    password: '',
    error: '',
    loading: false
  });
  const [deleteChatsModal, setDeleteChatsModal] = useState({
    open: false,
    site: null,
    password: '',
    error: '',
    loading: false
  });
  const [newSiteForm, setNewSiteForm] = useState({ name: '', domain: '' });
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [siteDetailsForm, setSiteDetailsForm] = useState({ name: '', domain: '' });
  const [savingSiteDetails, setSavingSiteDetails] = useState(false);
  const [siteDetailsMessage, setSiteDetailsMessage] = useState(null);
  const [changeDomainModal, setChangeDomainModal] = useState({
    open: false,
    domain: '',
    error: '',
    loading: false
  });

  // Widget Customizer State
  const [settings, setSettings] = useState({
    primaryColor: '#000000',
    title: 'SitePulse Support',
    subtitle: 'We are here to help!',
    greeting: 'Hi there! How can we help you today?',
    position: 'right',
    enableChat: true,
    enableFeedback: true,
    enableBugReport: true,
    requireEmail: false
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Live Chat & Unread State
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // { [conversationId]: count }
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'open' | 'resolved'
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const chatBottomRef = useRef(null);
  const agentTypingTimeoutRef = useRef(null);

  // Feedback & Bug State
  const [feedbacks, setFeedbacks] = useState([]);
  const [bugs, setBugs] = useState([]);

  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalPageviews: 0,
    uniqueVisitors: 0,
    topPages: []
  });

  // Page Rules & Auto-Discovery State
  const [discoveredPages, setDiscoveredPages] = useState([]);
  const [pageRules, setPageRules] = useState({
    enabled: true,
    defaultPolicy: 'allow',
    rules: {}
  });
  const [scanningSite, setScanningSite] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [customPatternInput, setCustomPatternInput] = useState('');
  const [customPatternAction, setCustomPatternAction] = useState('block');
  const [savingPageRules, setSavingPageRules] = useState(false);
  const [pageRulesSaved, setPageRulesSaved] = useState(false);

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('sitepulse_admin_token');
      sessionStorage.removeItem('sitepulse_server_instance');
      localStorage.removeItem('sitepulse_admin_token');
    } catch (e) {}
    setToken(null);
    setUser(null);
    setSites([]);
    setActiveSite(null);
    setAuthMode('login');
  };

  // Helper for authenticated fetch with automatic 401 interception
  const authFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 401) {
      handleLogout();
    }
    return res;
  };

  // 1. Check Auth Status on Load & Validate Server Instance
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);

      // Check system initialization state & server instance
      let currentServerInstance = null;
      try {
        const statusRes = await fetch(`${BACKEND_URL}/api/v1/auth/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIsInitialized(statusData.initialized);
          currentServerInstance = statusData.serverInstance;
          if (!statusData.initialized) {
            setAuthMode('signup');
          }
        }
      } catch (e) {
        console.warn('System status check warning:', e);
      }

      // If server was restarted, the instance ID changed -> force session expiry to login page
      let savedInstance = null;
      try { savedInstance = sessionStorage.getItem('sitepulse_server_instance'); } catch (e) {}
      if (savedInstance && currentServerInstance && savedInstance !== currentServerInstance) {
        handleLogout();
        setAuthLoading(false);
        return;
      }

      let activeToken = null;
      try {
        activeToken = sessionStorage.getItem('sitepulse_admin_token');
      } catch (e) {}

      if (activeToken) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
            headers: { 'Authorization': `Bearer ${activeToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data);
            setToken(activeToken);
            if (currentServerInstance) {
              try { sessionStorage.setItem('sitepulse_server_instance', currentServerInstance); } catch (e) {}
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
      setAuthLoading(false);
    };
    initAuth();
  }, []);

  // Auth Submit: Login or Signup
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

    const endpoint = authMode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login';

    try {
      const payload = authMode === 'signup'
        ? { name: authForm.name, email: authForm.email, password: authForm.password, confirmPassword: authForm.confirmPassword }
        : { email: authForm.email, password: authForm.password };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      try {
        sessionStorage.setItem('sitepulse_admin_token', data.token);
        if (data.serverInstance) {
          sessionStorage.setItem('sitepulse_server_instance', data.serverInstance);
        }
      } catch (e) {}

      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // 2. Load User Sites
  const fetchSites = async () => {
    if (!token) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites`);
      if (res.ok) {
        const data = await res.json();
        setSites(data);
        if (data.length > 0 && !activeSite) {
          setActiveSite(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSites();
    }
  }, [user]);

  // Create Site
  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!newSiteForm.name || !newSiteForm.domain) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSiteForm)
      });
      if (res.ok) {
        const created = await res.json();
        setSites([created, ...sites]);
        setActiveSite(created);
        setShowNewSiteModal(false);
        setNewSiteForm({ name: '', domain: '' });
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Delete Site with Admin Password Verification
  const promptDeleteSite = (siteToDelete) => {
    const target = siteToDelete || activeSite;
    if (!target) return;
    setDeleteSiteModal({
      open: true,
      site: target,
      password: '',
      error: '',
      loading: false
    });
  };

  const handleConfirmDeleteSite = async (e) => {
    e.preventDefault();
    if (!deleteSiteModal.site || !token) return;
    if (!deleteSiteModal.password) {
      setDeleteSiteModal(prev => ({ ...prev, error: 'Please enter your admin password' }));
      return;
    }

    setDeleteSiteModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${deleteSiteModal.site.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deleteSiteModal.password })
      });
      const data = await res.json();
      if (res.ok) {
        const remaining = sites.filter(s => s.id !== deleteSiteModal.site.id);
        setSites(remaining);
        if (activeSite?.id === deleteSiteModal.site.id) {
          setActiveSite(remaining.length > 0 ? remaining[0] : null);
        }
        setDeleteSiteModal({ open: false, site: null, password: '', error: '', loading: false });
      } else {
        setDeleteSiteModal(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to delete website property'
        }));
      }
    } catch (e) {
      setDeleteSiteModal(prev => ({
        ...prev,
        loading: false,
        error: e.message || 'An unexpected error occurred'
      }));
    }
  };

  // Delete All Chats for Site with Admin Password Verification
  const promptDeleteChats = (site) => {
    const target = site || activeSite;
    if (!target) return;
    setDeleteChatsModal({
      open: true,
      site: target,
      password: '',
      error: '',
      loading: false
    });
  };

  const handleConfirmDeleteChats = async (e) => {
    e.preventDefault();
    if (!deleteChatsModal.site || !token) return;
    if (!deleteChatsModal.password) {
      setDeleteChatsModal(prev => ({ ...prev, error: 'Please enter your admin password' }));
      return;
    }

    setDeleteChatsModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${deleteChatsModal.site.id}/conversations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deleteChatsModal.password })
      });
      const data = await res.json();
      if (res.ok) {
        setConversations([]);
        setSelectedConv(null);
        setMessages([]);
        setUnreadCounts({});
        setDeleteChatsModal({ open: false, site: null, password: '', error: '', loading: false });
      } else {
        setDeleteChatsModal(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to delete conversations'
        }));
      }
    } catch (e) {
      setDeleteChatsModal(prev => ({
        ...prev,
        loading: false,
        error: e.message || 'An unexpected error occurred'
      }));
    }
  };

  // 3. Socket.IO Connection for Real-Time Chat
  useEffect(() => {
    if (!activeSite) return;
    const s = io(BACKEND_URL);
    setSocket(s);

    s.on('connect', () => {
      s.emit('join_site_admin', { siteKey: activeSite.apiKey });
    });

    s.on('new_message_notification', (data) => {
      fetchConversations();
      const isCurrentConv = selectedConv && selectedConv.id === data.conversationId;
      if (isCurrentConv) {
        setMessages((prev) => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      } else {
        // Track unread if sent by visitor
        if (data.message?.senderType === 'visitor') {
          setUnreadCounts((prev) => ({
            ...prev,
            [data.conversationId]: (prev[data.conversationId] || 0) + 1
          }));
        }
      }
    });

    s.on('message_received', (msg) => {
      if (selectedConv && msg.conversationId === selectedConv.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    s.on('typing', ({ conversationId, senderType, isTyping }) => {
      if (selectedConv && conversationId === selectedConv.id && senderType === 'visitor') {
        setIsVisitorTyping(isTyping);
      }
    });

    s.on('all_conversations_deleted', () => {
      setConversations([]);
      setSelectedConv(null);
      setMessages([]);
      setUnreadCounts({});
    });

    return () => s.disconnect();
  }, [activeSite, selectedConv]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isVisitorTyping]);

  // 4. Load Active Site Config & Conversations
  useEffect(() => {
    if (!activeSite) return;
    if (activeSite.widgetSettings) {
      setSettings(activeSite.widgetSettings);
    }
    setSiteDetailsForm({ name: activeSite.name || '', domain: activeSite.domain || '' });
    setSiteDetailsMessage(null);
    setSelectedConv(null);
    setMessages([]);
    setIsVisitorTyping(false);
    fetchConversations();
  }, [activeSite]);

  const fetchConversations = async () => {
    if (!activeSite || !token) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/conversations?siteKey=${activeSite.apiKey}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (!selectedConv && data.length > 0) {
          handleSelectConversation(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConv(conv);
    setMobileChatView(true);
    // Mark conversation as read
    setUnreadCounts((prev) => {
      if (!prev[conv.id]) return prev;
      const updated = { ...prev };
      delete updated[conv.id];
      return updated;
    });
  };

  // Load Messages when selected conversation changes
  useEffect(() => {
    if (!selectedConv || !token) return;
    const fetchMessages = async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/v1/conversations/${selectedConv.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMessages();

    if (socket) {
      socket.emit('join_conversation', { conversationId: selectedConv.id });
    }
  }, [selectedConv]);

  // Load Feedback, Bugs & Analytics on tab activation
  useEffect(() => {
    if (!activeSite || !token) return;
    if (activeNav === 'feedback') {
      authFetch(`${BACKEND_URL}/api/v1/feedback?siteKey=${activeSite.apiKey}`)
        .then(r => r.json())
        .then(d => setFeedbacks(Array.isArray(d) ? d : []));
      authFetch(`${BACKEND_URL}/api/v1/bugs?siteKey=${activeSite.apiKey}`)
        .then(r => r.json())
        .then(d => setBugs(Array.isArray(d) ? d : []));
    } else if (activeNav === 'analytics') {
      authFetch(`${BACKEND_URL}/api/v1/events/stats?siteKey=${activeSite.apiKey}`)
        .then(r => r.json())
        .then(d => setAnalytics(d));
    } else if (activeNav === 'page-rules') {
      loadDiscoveredPages();
    }
  }, [activeNav, activeSite]);

  // Send Reply from Agent
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || !socket) return;

    socket.emit('send_message', {
      conversationId: selectedConv.id,
      siteKey: activeSite.apiKey,
      senderType: 'agent',
      senderName: user.name || 'Support Agent',
      content: replyText.trim()
    });

    setReplyText('');
    socket.emit('typing', { conversationId: selectedConv.id, senderType: 'agent', isTyping: false });
  };

  // Toggle Conversation Status (open / resolved)
  const handleToggleStatus = async () => {
    if (!selectedConv || !token) return;
    const nextStatus = selectedConv.status === 'resolved' ? 'open' : 'resolved';
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/conversations/${selectedConv.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedConv(updated);
        setConversations(conversations.map(c => c.id === updated.id ? updated : c));
      }
    } catch (e) {
      alert('Error updating status: ' + e.message);
    }
  };

  // Save Widget Settings
  const handleSaveSettings = async () => {
    if (!activeSite || !token) return;
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/widget/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey: activeSite.apiKey, settings })
      });
      if (res.ok) {
        setActiveSite(prev => ({ ...prev, widgetSettings: settings }));
        setSites(prev => prev.map(s => s.id === activeSite.id ? { ...s, widgetSettings: settings } : s));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to save settings: ${errData.error || res.statusText}`);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const copyEmbedCode = () => {
    if (!activeSite) return;
    const code = `<script src="${BACKEND_URL}/sitepulse.js" data-site-key="${activeSite.apiKey}" defer></script>`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleUpdateSiteName = async (e) => {
    e.preventDefault();
    if (!activeSite || !token || savingSiteDetails) return;
    if (!siteDetailsForm.name.trim()) {
      setSiteDetailsMessage({ type: 'error', text: 'Website name cannot be empty.' });
      return;
    }

    setSavingSiteDetails(true);
    setSiteDetailsMessage(null);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${activeSite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: siteDetailsForm.name.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.site) {
        setActiveSite(data.site);
        setSites(prev => prev.map(s => s.id === data.site.id ? data.site : s));
        setSiteDetailsMessage({ 
          type: 'success', 
          text: 'Website name updated successfully.' 
        });
        setTimeout(() => setSiteDetailsMessage(null), 4000);
      } else {
        setSiteDetailsMessage({ type: 'error', text: data.error || 'Failed to update website name.' });
      }
    } catch (err) {
      setSiteDetailsMessage({ type: 'error', text: err.message || 'Network error updating website property.' });
    } finally {
      setSavingSiteDetails(false);
    }
  };

  const promptChangeDomain = () => {
    if (!activeSite) return;
    setChangeDomainModal({
      open: true,
      domain: activeSite.domain,
      error: '',
      loading: false
    });
  };

  const handleConfirmChangeDomain = async (e) => {
    e.preventDefault();
    if (!activeSite || !token || changeDomainModal.loading) return;
    const newDomain = changeDomainModal.domain.trim();
    if (!newDomain) {
      setChangeDomainModal(prev => ({ ...prev, error: 'Domain URL cannot be empty.' }));
      return;
    }
    setChangeDomainModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${activeSite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain })
      });
      const data = await res.json();
      if (res.ok && data.site) {
        setActiveSite(data.site);
        setSites(prev => prev.map(s => s.id === data.site.id ? data.site : s));
        setSiteDetailsForm(prev => ({ ...prev, domain: data.site.domain }));
        setChangeDomainModal({ open: false, domain: '', error: '', loading: false });
        setSiteDetailsMessage({ type: 'success', text: 'Domain URL updated successfully in Danger Zone.' });
        setTimeout(() => setSiteDetailsMessage(null), 4000);
      } else {
        setChangeDomainModal(prev => ({ ...prev, loading: false, error: data.error || 'Failed to update domain URL.' }));
      }
    } catch (err) {
      setChangeDomainModal(prev => ({ ...prev, loading: false, error: err.message || 'Network error updating domain.' }));
    }
  };

  // Page Rules Handlers
  const loadDiscoveredPages = async () => {
    if (!activeSite || !token) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${activeSite.apiKey}/pages`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredPages(data.pages || []);
        if (data.pageRules) {
          setPageRules(data.pageRules);
        }
      }
    } catch (e) {
      console.error('Failed to load site pages:', e);
    }
  };

  const handleScanWebsite = async () => {
    if (!activeSite || !token || scanningSite) return;
    setScanningSite(true);
    setScanMessage(null);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${activeSite.apiKey}/scan`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setScanMessage({ 
          type: 'success', 
          text: `Scan complete: ${data.count} page(s) discovered on ${activeSite.domain}` 
        });
        await loadDiscoveredPages();
      } else {
        setScanMessage({ type: 'error', text: data.error || 'Scan failed' });
      }
    } catch (e) {
      setScanMessage({ type: 'error', text: 'Scan request failed: ' + e.message });
    } finally {
      setScanningSite(false);
    }
  };

  const handleTogglePageRule = (path) => {
    const isExplicit = pageRules.rules?.[path] !== undefined;
    const isCurrentlyAllowed = isExplicit 
      ? Boolean(pageRules.rules[path])
      : pageRules.defaultPolicy !== 'block';
    
    const nextAllowed = !isCurrentlyAllowed;
    setPageRules(prev => ({
      ...prev,
      rules: {
        ...(prev.rules || {}),
        [path]: nextAllowed
      }
    }));
  };

  const handleRemovePageRule = (path, isCustom) => {
    setPageRules(prev => {
      const nextRules = { ...(prev.rules || {}) };
      delete nextRules[path];
      return {
        ...prev,
        rules: nextRules
      };
    });
    if (isCustom) {
      setDiscoveredPages(prev => prev.filter(p => p.path !== path));
    }
  };

  const handleBulkSetRules = (shouldAllow) => {
    const newRules = { ...(pageRules.rules || {}) };
    discoveredPages.forEach(p => {
      newRules[p.path] = shouldAllow;
    });
    setPageRules(prev => ({
      ...prev,
      rules: newRules
    }));
  };

  const handleAddCustomPattern = (e) => {
    e.preventDefault();
    if (!customPatternInput.trim()) return;
    let clean = customPatternInput.trim().toLowerCase();
    if (!clean.startsWith('/') && !clean.startsWith('*')) {
      clean = '/' + clean;
    }
    if (clean.length > 1 && clean.endsWith('/') && !clean.endsWith('/*')) {
      clean = clean.slice(0, -1);
    }
    const isAllowed = customPatternAction === 'allow';
    setPageRules(prev => ({
      ...prev,
      rules: {
        ...(prev.rules || {}),
        [clean]: isAllowed
      }
    }));
    if (!discoveredPages.some(p => p.path === clean)) {
      setDiscoveredPages(prev => [
        { path: clean, source: 'custom_rule', lastSeen: new Date().toISOString(), views: 0 },
        ...prev
      ]);
    }
    setCustomPatternInput('');
  };

  const handleSavePageRules = async () => {
    if (!activeSite || !token) return;
    setSavingPageRules(true);
    setPageRulesSaved(false);
    try {
      const currentSettings = activeSite.widgetSettings || {};
      const updatedSettings = {
        ...currentSettings,
        widgetActive: pageRules.enabled !== false,
        pageRules: {
          ...pageRules,
          discoveredPages: discoveredPages
        }
      };
      const res = await authFetch(`${BACKEND_URL}/api/v1/widget/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey: activeSite.apiKey, settings: updatedSettings })
      });
      if (res.ok) {
        setPageRulesSaved(true);
        setActiveSite(prev => ({ ...prev, widgetSettings: updatedSettings }));
        setTimeout(() => setPageRulesSaved(false), 2500);
      } else {
        alert('Failed to save page rules');
      }
    } catch (e) {
      alert('Error saving rules: ' + e.message);
    } finally {
      setSavingPageRules(false);
    }
  };

  // Total unread across all conversations
  const totalUnreadCount = Object.values(unreadCounts).reduce((acc, count) => acc + count, 0);

  // Filtered conversations with unread support
  const filteredConversations = conversations.filter(conv => {
    if (statusFilter === 'unread') return (unreadCounts[conv.id] || 0) > 0;
    if (statusFilter === 'open' && conv.status === 'resolved') return false;
    if (statusFilter === 'resolved' && conv.status !== 'resolved') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = conv.visitorName?.toLowerCase().includes(q);
      const emailMatch = conv.visitorEmail?.toLowerCase().includes(q);
      const extMatch = conv.externalId?.toLowerCase().includes(q);
      const msgMatch = conv.messages?.[0]?.content?.toLowerCase().includes(q);
      return nameMatch || emailMatch || extMatch || msgMatch;
    }
    return true;
  });

  // Auth Screen (loading / login / signup)
  if (authLoading || !user) {
    return (
      <AuthView
        authLoading={authLoading}
        user={user}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        authForm={authForm}
        setAuthForm={setAuthForm}
        handleAuthSubmit={handleAuthSubmit}
      />
    );
  }

  // Authenticated Dashboard
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        activeSite={activeSite}
        sites={sites}
        setActiveSite={setActiveSite}
        setShowNewSiteModal={setShowNewSiteModal}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        totalUnreadCount={totalUnreadCount}
        conversations={conversations}
        copiedSnippet={copiedSnippet}
        copyEmbedCode={copyEmbedCode}
        user={user}
        handleLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 transition cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {activeNav === 'chat' && 'Live Support Inbox'}
              {activeNav === 'customizer' && 'Widget Customization & Styling'}
              {activeNav === 'page-rules' && 'Page Rules & Display'}
              {activeNav === 'feedback' && 'Customer Feedback & Bug Reports'}
              {activeNav === 'analytics' && 'Website Analytics'}
              {activeNav === 'settings' && 'Website Property Settings'}
            </h2>
          </div>
          {activeSite && (
            <div className="flex items-center gap-2 shrink-0">
              <span 
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                title={`Active website: ${activeSite.name} (${activeSite.domain})`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{activeSite.name}</span>
                <span className="text-slate-500 text-xs font-mono">({activeSite.domain})</span>
              </span>
            </div>
          )}
        </header>

        {/* Dynamic Views */}
        <div className="flex-1 overflow-hidden min-w-0">
          {!activeSite ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 bg-[#287170]/10 text-[#287170] rounded-2xl flex items-center justify-center mb-4">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Website Selected</h3>
              <p className="text-sm text-slate-600 max-w-sm mt-1 mb-5">
                Select a website from the sidebar or add a new website to manage support and analytics.
              </p>
              <button
                onClick={() => setShowNewSiteModal(true)}
                className="bg-[#287170] hover:bg-[#205d5c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-[#287170]/25 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Website</span>
              </button>
            </div>
          ) : (
            <>
              {activeNav === 'chat' && (
                <ChatView
                  filteredConversations={filteredConversations}
                  conversations={conversations}
                  fetchConversations={fetchConversations}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  unreadCounts={unreadCounts}
                  selectedConv={selectedConv}
                  handleSelectConversation={handleSelectConversation}
                  mobileChatView={mobileChatView}
                  setMobileChatView={setMobileChatView}
                  handleToggleStatus={handleToggleStatus}
                  messages={messages}
                  chatBottomRef={chatBottomRef}
                  isVisitorTyping={isVisitorTyping}
                  handleSendReply={handleSendReply}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  socket={socket}
                  agentTypingTimeoutRef={agentTypingTimeoutRef}
                />
              )}

              {activeNav === 'customizer' && (
                <CustomizerView
                  settings={settings}
                  setSettings={setSettings}
                  handleSaveSettings={handleSaveSettings}
                  savingSettings={savingSettings}
                  saveSuccess={saveSuccess}
                />
              )}

              {activeNav === 'page-rules' && (
                <PageRulesView
                  activeSite={activeSite}
                  pageRules={pageRules}
                  setPageRules={setPageRules}
                  discoveredPages={discoveredPages}
                  pageSearchQuery={pageSearchQuery}
                  setPageSearchQuery={setPageSearchQuery}
                  handleScanWebsite={handleScanWebsite}
                  scanningSite={scanningSite}
                  scanMessage={scanMessage}
                  setScanMessage={setScanMessage}
                  handleBulkSetRules={handleBulkSetRules}
                  handleTogglePageRule={handleTogglePageRule}
                  handleRemovePageRule={handleRemovePageRule}
                  customPatternInput={customPatternInput}
                  setCustomPatternInput={setCustomPatternInput}
                  customPatternAction={customPatternAction}
                  setCustomPatternAction={setCustomPatternAction}
                  handleAddCustomPattern={handleAddCustomPattern}
                  pageRulesSaved={pageRulesSaved}
                  handleSavePageRules={handleSavePageRules}
                  savingPageRules={savingPageRules}
                />
              )}

              {activeNav === 'feedback' && (
                <FeedbackView
                  feedbacks={feedbacks}
                  bugs={bugs}
                />
              )}

              {activeNav === 'analytics' && (
                <AnalyticsView
                  analytics={analytics}
                />
              )}

              {activeNav === 'settings' && (
                <SettingsView
                  activeSite={activeSite}
                  BACKEND_URL={BACKEND_URL}
                  siteDetailsForm={siteDetailsForm}
                  setSiteDetailsForm={setSiteDetailsForm}
                  siteDetailsMessage={siteDetailsMessage}
                  setSiteDetailsMessage={setSiteDetailsMessage}
                  savingSiteDetails={savingSiteDetails}
                  handleUpdateSiteName={handleUpdateSiteName}
                  copiedSnippet={copiedSnippet}
                  copyEmbedCode={copyEmbedCode}
                  setActiveNav={setActiveNav}
                  promptChangeDomain={promptChangeDomain}
                  promptDeleteChats={promptDeleteChats}
                  promptDeleteSite={promptDeleteSite}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Danger Zone: Change Domain Modal */}
      <ChangeDomainModal
        changeDomainModal={changeDomainModal}
        setChangeDomainModal={setChangeDomainModal}
        activeSite={activeSite}
        handleConfirmChangeDomain={handleConfirmChangeDomain}
      />

      {/* Add New Website Modal */}
      <NewSiteModal
        showNewSiteModal={showNewSiteModal}
        setShowNewSiteModal={setShowNewSiteModal}
        newSiteForm={newSiteForm}
        setNewSiteForm={setNewSiteForm}
        handleCreateSite={handleCreateSite}
      />

      {/* Danger Zone: Delete Website Property Modal */}
      <DeleteSiteModal
        deleteSiteModal={deleteSiteModal}
        setDeleteSiteModal={setDeleteSiteModal}
        handleConfirmDeleteSite={handleConfirmDeleteSite}
      />

      {/* Danger Zone: Clear All Chats Modal */}
      <DeleteChatsModal
        deleteChatsModal={deleteChatsModal}
        setDeleteChatsModal={setDeleteChatsModal}
        handleConfirmDeleteChats={handleConfirmDeleteChats}
      />
    </div>
  );
}
