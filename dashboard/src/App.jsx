import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  MessageSquareX,
  Palette, 
  Bug, 
  BarChart3, 
  Settings, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  Star, 
  LogOut, 
  Plus, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ChevronDown, 
  ChevronLeft, 
  Layers, 
  Search, 
  CheckCircle2, 
  Trash2, 
  Menu, 
  X,
  Globe,
  Key,
  Code2,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { io } from 'socket.io-client';

const BACKEND_URL = (window.location.origin.includes(':3000') || window.location.origin.includes(':5173'))
  ? 'http://localhost:5000' 
  : window.location.origin;

// Modern Geometric SitePulse Logo Mark
function SitePulseLogo({ className = "w-9 h-9" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xs">
        <defs>
          <linearGradient id="spGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#287170" />
            <stop offset="100%" stopColor="#1e5857" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#spGrad)" />
        <path
          d="M8.5 20.5H13L16 13L20.5 27L24.5 16.5L27 20.5H31.5"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20.5" cy="27" r="2" fill="#ffffff" />
      </svg>
    </div>
  );
}

function getContrastColors(hexColor) {
  let hex = (hexColor || '#000000').replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const isLight = yiq >= 170;

  return {
    isLight,
    text: isLight ? '#0f172a' : '#ffffff',
    textMuted: isLight ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.88)',
    headerBorder: isLight ? '1px solid #e2e8f0' : 'none',
    activeTab: isLight ? '#0f172a' : (hexColor || '#000000'),
    closeBtnBg: isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.14)',
    bubbleBorder: isLight ? '1px solid #cbd5e1' : 'none',
    launcherBorder: isLight ? '1px solid #cbd5e1' : 'none'
  };
}

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
  const [activeNav, setActiveNav] = useState('chat'); // 'chat' | 'customizer' | 'feedback' | 'analytics' | 'settings'
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

  const handleAddCustomPattern = (e) => {
    e.preventDefault();
    if (!customPatternInput.trim()) return;
    let clean = customPatternInput.trim().toLowerCase();
    if (!clean.startsWith('/') && !clean.startsWith('*')) {
      clean = '/' + clean;
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

  // ==========================================
  // AUTH SCREEN (LOGIN / INITIAL SIGNUP)
  // Modern Clean White & #287170 Theme
  // ==========================================
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-slate-900 font-sans">
        <div className="flex flex-col items-center gap-3">
          <SitePulseLogo className="w-12 h-12 animate-pulse" />
          <span className="text-sm font-medium text-slate-500">Loading SitePulse...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen relative flex flex-col justify-between font-sans selection:bg-[#287170]/20 selection:text-[#287170] overflow-hidden">
        {/* Animated Cube Background */}
        <ul className="background" aria-hidden="true">
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
        </ul>

        {/* Clean Header */}
        <header className="relative z-10 w-full border-b border-white/40 bg-white/70 backdrop-blur-md shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SitePulseLogo className="w-8 h-8 shadow-xs" />
              <span className="font-bold text-lg text-slate-900 tracking-tight">SitePulse</span>
            </div>
            <span className="text-xs font-semibold text-slate-700 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">Admin Portal</span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative z-10 flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 drop-shadow-2xs">
              {authMode === 'signup' ? 'Create an account' : 'Sign in to SitePulse'}
            </h2>
            <p className="mt-2 text-sm text-slate-700 font-medium max-w-sm mx-auto">
              {authMode === 'signup'
                ? 'Enter your details below to create your admin account'
                : 'Enter your credentials to access the admin dashboard'}
            </p>
          </div>

          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white/95 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl shadow-slate-900/10 rounded-2xl border border-white/80">
              {authError && (
                <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <span className="font-semibold">Error:</span> {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={authForm.name}
                        onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                        placeholder="e.g. Sarah Connor"
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#287170] focus:ring-2 focus:ring-[#287170]/15 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="admin@example.com"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#287170] focus:ring-2 focus:ring-[#287170]/15 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder={authMode === 'signup' ? '•••••••• (min. 8 characters)' : '••••••••'}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#287170] focus:ring-2 focus:ring-[#287170]/15 transition"
                    />
                  </div>
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Retype Password
                    </label>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={authForm.confirmPassword}
                        onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                        placeholder="Retype password to confirm"
                        className={`w-full bg-slate-50/50 border ${
                          authForm.confirmPassword && authForm.password !== authForm.confirmPassword
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200 focus:border-[#287170] focus:ring-[#287170]/15'
                        } rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition`}
                      />
                    </div>
                    {authForm.confirmPassword && authForm.password !== authForm.confirmPassword && (
                      <p className="text-xs text-rose-600 mt-1.5 font-medium">Passwords do not match</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full mt-2 bg-[#287170] hover:bg-[#205d5c] text-white font-semibold py-3.5 rounded-xl text-base shadow-sm shadow-[#287170]/25 transition duration-150 active:scale-[0.99] cursor-pointer"
                >
                  {authMode === 'signup' ? 'Complete Setup' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
                {authMode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button
                      onClick={() => { setAuthMode('login'); setAuthError(''); setAuthForm(prev => ({ ...prev, confirmPassword: '' })); }}
                      className="text-[#287170] hover:underline font-semibold transition cursor-pointer"
                    >
                      Sign In
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account?{' '}
                    <button
                      onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthForm(prev => ({ ...prev, confirmPassword: '' })); }}
                      className="text-[#287170] hover:underline font-semibold transition cursor-pointer"
                    >
                      Create Account
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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

  // ==========================================
  // AUTHENTICATED DASHBOARD (WHITE & #287170 THEME)
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation - Clean Modern Light / White Theme */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-white text-slate-700 border-r border-slate-200 flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-5 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <SitePulseLogo className="w-9 h-9" />
              <div>
                <h1 className="font-bold text-lg tracking-tight text-slate-900 leading-none">SitePulse</h1>
                <span className="text-xs text-slate-600 font-semibold">Dashboard</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Site Selector */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Active Site</span>
              <button
                onClick={() => {
                  setShowNewSiteModal(true);
                  setMobileMenuOpen(false);
                }}
                className="text-xs sm:text-sm text-[#287170] hover:text-[#205d5c] flex items-center gap-1 font-semibold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Site</span>
              </button>
            </div>

            <div className="relative">
              <select
                value={activeSite?.id || ''}
                onChange={(e) => {
                  const s = sites.find(item => item.id === e.target.value);
                  if (s) setActiveSite(s);
                }}
                className="w-full bg-slate-50 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 font-medium focus:outline-none focus:border-[#287170] focus:ring-1 focus:ring-[#287170]/20 appearance-none cursor-pointer"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.domain})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {/* 1. Live Chat */}
            <button
              onClick={() => {
                setActiveNav('chat');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeNav === 'chat'
                  ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                <span>Live Support Inbox</span>
              </div>
              {totalUnreadCount > 0 ? (
                <span className="bg-white text-[#287170] text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
                  {totalUnreadCount} new
                </span>
              ) : conversations.length > 0 ? (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeNav === 'chat' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {conversations.length}
                </span>
              ) : null}
            </button>

            {/* 2. Widget Customizer */}
            <button
              onClick={() => {
                setActiveNav('customizer');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeNav === 'customizer'
                  ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Palette className="w-5 h-5" />
              <span>Widget Customizer</span>
            </button>

            {/* 3. Page Rules & Display */}
            <button
              onClick={() => {
                setActiveNav('page-rules');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeNav === 'page-rules'
                  ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span>Page Rules & Display</span>
            </button>

            {/* 3. Feedback & Bugs */}
            <button
              onClick={() => {
                setActiveNav('feedback');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeNav === 'feedback'
                  ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bug className="w-5 h-5" />
              <span>Feedback & Bugs</span>
            </button>

            {/* 4. Analytics */}
            <button
              onClick={() => {
                setActiveNav('analytics');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeNav === 'analytics'
                  ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Analytics</span>
            </button>

            {/* 5. Settings & Danger Zone */}
            <button
              onClick={() => {
                setActiveNav('settings');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeNav === 'settings'
                  ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Site Key Card & User Footer */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          {activeSite && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Site Key</div>
              <div className="font-mono text-sm text-[#287170] font-semibold mt-1 truncate select-all">{activeSite.apiKey}</div>
              <div className="mt-2.5 pt-2 border-t border-slate-200">
                <button
                  onClick={copyEmbedCode}
                  className="w-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 transition cursor-pointer"
                >
                  {copiedSnippet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#287170]" />}
                  <span>{copiedSnippet ? 'Copied script!' : 'Copy embed script'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="truncate">
              <div className="text-sm font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-xs text-slate-600 font-medium truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-500 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

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
              {activeNav === 'feedback' && 'Customer Feedback & Bug Reports'}
              {activeNav === 'analytics' && 'Website Analytics'}
              {activeNav === 'settings' && 'Website Property Settings'}
            </h2>
          </div>
          {activeSite && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{activeSite.name}</span>
                <span className="text-slate-600 text-xs font-medium">({activeSite.domain})</span>
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
              {/* TAB 1: LIVE CHAT */}
              {activeNav === 'chat' && (
                <div className="flex h-full min-w-0">
                  <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 ${mobileChatView ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Conversations ({filteredConversations.length})
                      </span>
                      <button onClick={fetchConversations} className="text-sm text-[#287170] hover:text-[#205d5c] font-semibold transition cursor-pointer">
                        Refresh
                      </button>
                    </div>

                    {/* Search & Status Filters */}
                    <div className="p-3.5 border-b border-slate-100 space-y-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Search visitor, email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 text-sm pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-[#287170] font-medium placeholder-slate-400"
                        />
                      </div>
                      <div className="flex gap-1.5 text-xs overflow-x-auto pb-0.5">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'all' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          All ({conversations.length})
                        </button>
                        <button
                          onClick={() => setStatusFilter('unread')}
                          className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'unread' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          Unread ({conversations.filter(c => (unreadCounts[c.id] || 0) > 0).length})
                        </button>
                        <button
                          onClick={() => setStatusFilter('open')}
                          className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'open' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          Open ({conversations.filter(c => c.status !== 'resolved').length})
                        </button>
                        <button
                          onClick={() => setStatusFilter('resolved')}
                          className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'resolved' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          Resolved ({conversations.filter(c => c.status === 'resolved').length})
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                      {filteredConversations.length === 0 ? (
                        <div className="p-8 text-center text-slate-600 text-sm font-medium">
                          {searchQuery ? 'No conversations matching search.' : 'No conversations found in this view.'}
                        </div>
                      ) : (
                        filteredConversations.map((conv) => {
                          const isSelected = selectedConv?.id === conv.id;
                          const lastMsg = conv.messages?.[0]?.content || 'Started conversation';
                          const isResolved = conv.status === 'resolved';
                          const unreadCount = unreadCounts[conv.id] || 0;

                          return (
                            <div
                              key={conv.id}
                              onClick={() => handleSelectConversation(conv)}
                              className={`p-4 cursor-pointer transition ${
                                isSelected ? 'bg-[#287170]/5 border-l-4 border-[#287170]' : 'hover:bg-slate-50 border-l-4 border-transparent'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {unreadCount > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-[#287170] shrink-0" />
                                  )}
                                  <span className={`text-base truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                    {conv.visitorName || conv.visitorEmail || `Visitor #${conv.visitorId.slice(-6)}`}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-600 font-medium shrink-0">
                                  {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {conv.visitorEmail && (
                                <div className="text-xs sm:text-sm text-[#287170] font-medium truncate mt-1 flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5 text-[#287170] shrink-0" />
                                  <span className="truncate">{conv.visitorEmail}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {unreadCount > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#287170] text-white">
                                    {unreadCount} new
                                  </span>
                                )}
                                {conv.externalId && (
                                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold truncate">
                                    Identified: #{conv.externalId}
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${isResolved ? 'bg-slate-100 text-slate-600' : 'bg-[#287170]/10 text-[#287170]'}`}>
                                  {isResolved ? 'Resolved' : 'Open'}
                                </span>
                              </div>
                              <p className={`text-sm mt-1.5 truncate leading-normal ${unreadCount > 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{lastMsg}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {selectedConv ? (
                    <div className={`flex-1 flex flex-col bg-slate-50 min-w-0 ${!mobileChatView ? 'hidden md:flex' : 'flex'}`}>
                      <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={() => setMobileChatView(false)}
                            className="md:hidden p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0 transition"
                            title="Back to conversation list"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <span className="font-bold text-base sm:text-lg text-slate-900 truncate">
                            {selectedConv.visitorName || 'Visitor'}
                          </span>
                          {selectedConv.visitorEmail && (
                            <span className="text-xs sm:text-sm font-mono text-[#287170] bg-[#287170]/10 px-2.5 py-1 rounded-full border border-[#287170]/25 hidden sm:flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" />
                              <span className="truncate">{selectedConv.visitorEmail}</span>
                            </span>
                          )}
                          {selectedConv.externalId && (
                            <span className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 hidden sm:inline">
                              ✓ #{selectedConv.externalId}
                            </span>
                          )}
                          <span className="text-xs text-slate-600 font-mono hidden xl:inline">
                            (Session: {selectedConv.visitorId.slice(0, 8)}...)
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleToggleStatus}
                            className={`text-sm px-3.5 sm:px-4 py-1.5 rounded-xl font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                              selectedConv.status === 'resolved'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{selectedConv.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                        {messages.map((m) => {
                          const isAgent = m.senderType === 'agent';
                          return (
                            <div key={m.id} className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                              <div
                                className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl text-base leading-relaxed ${
                                  isAgent
                                    ? 'bg-[#287170] text-white rounded-br-sm shadow-sm'
                                    : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm shadow-xs'
                                }`}
                              >
                                {m.content}
                              </div>
                              <span className="text-xs text-slate-600 font-medium mt-1.5 px-1">
                                {isAgent ? 'You (Agent)' : (m.senderName || 'Visitor')} •{' '}
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })}
                        <div ref={chatBottomRef} />
                      </div>

                      {/* Visitor Typing Indicator */}
                      {isVisitorTyping && (
                        <div className="px-4 sm:px-6 py-2.5 text-sm font-medium text-[#287170] italic bg-[#287170]/5 flex items-center gap-2 border-t border-[#287170]/20 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-[#287170]" />
                          <span>Visitor is typing a reply...</span>
                        </div>
                      )}

                      <form onSubmit={handleSendReply} className="p-3 sm:p-4 bg-white border-t border-slate-200 flex gap-2 sm:gap-3">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => {
                            setReplyText(e.target.value);
                            if (socket && selectedConv) {
                              socket.emit('typing', { conversationId: selectedConv.id, senderType: 'agent', isTyping: true });
                              clearTimeout(agentTypingTimeoutRef.current);
                              agentTypingTimeoutRef.current = setTimeout(() => {
                                socket.emit('typing', { conversationId: selectedConv.id, senderType: 'agent', isTyping: false });
                              }, 1200);
                            }
                          }}
                          placeholder="Type your reply to the visitor..."
                          className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-[#287170] placeholder-slate-500"
                        />
                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className="bg-[#287170] hover:bg-[#205d5c] disabled:opacity-50 text-white px-5 sm:px-6 py-3 rounded-xl font-semibold text-base flex items-center gap-2 transition shrink-0 shadow-sm cursor-pointer"
                        >
                          <Send className="w-5 h-5" />
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="hidden md:flex flex-1 items-center justify-center text-slate-600 text-base font-medium bg-slate-50">
                      Select a conversation to view messages.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: WIDGET CUSTOMIZER (Pure Styling, No Danger Zone) */}
              {activeNav === 'customizer' && (
                <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden min-w-0">
                  <div className="w-full lg:w-[440px] xl:w-[480px] border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-6 sm:p-8 overflow-y-visible lg:overflow-y-auto space-y-7 shrink-0">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Brand Color</h3>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="w-11 h-11 p-0 rounded-xl cursor-pointer border border-slate-200"
                        />
                        <input
                          type="text"
                          value={settings.primaryColor}
                          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="font-mono text-base px-3.5 py-2 border border-slate-200 rounded-xl w-32 text-slate-800 font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900">Titles & Greetings</h3>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Widget Title</label>
                        <input
                          type="text"
                          value={settings.title}
                          onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#287170]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subtitle</label>
                        <input
                          type="text"
                          value={settings.subtitle}
                          onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#287170]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Greeting Message</label>
                        <textarea
                          value={settings.greeting}
                          onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                          rows={3}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#287170]"
                        />
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <h3 className="text-lg font-bold text-slate-900">Features</h3>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.enableChat}
                          onChange={(e) => setSettings({ ...settings, enableChat: e.target.checked })}
                          className="w-5 h-5 accent-[#287170] rounded cursor-pointer"
                        />
                        <span className="text-base text-slate-800 font-medium">Enable Live Chat</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.enableFeedback}
                          onChange={(e) => setSettings({ ...settings, enableFeedback: e.target.checked })}
                          className="w-5 h-5 accent-[#287170] rounded cursor-pointer"
                        />
                        <span className="text-base text-slate-800 font-medium">Enable Feedback Rating</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.enableBugReport}
                          onChange={(e) => setSettings({ ...settings, enableBugReport: e.target.checked })}
                          className="w-5 h-5 accent-[#287170] rounded cursor-pointer"
                        />
                        <span className="text-base text-slate-800 font-medium">Enable Bug Reporting</span>
                      </label>
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="w-full bg-[#287170] hover:bg-[#205d5c] text-white font-semibold py-3 rounded-xl text-base shadow-sm shadow-[#287170]/25 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {saveSuccess ? <Check className="w-5 h-5 text-emerald-300" /> : <Sparkles className="w-5 h-5" />}
                      <span>{savingSettings ? 'Saving...' : (saveSuccess ? 'Changes Published Live!' : 'Save & Publish Changes')}</span>
                    </button>
                  </div>

                  {/* Live Preview */}
                  {(() => {
                    const previewContrast = getContrastColors(settings.primaryColor);
                    return (
                      <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center p-6 sm:p-8 relative min-h-[580px] lg:min-h-0 space-y-4">
                        <div className="w-[360px] h-[520px] bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
                          <div
                            style={{
                              backgroundColor: settings.primaryColor,
                              borderBottom: previewContrast.headerBorder
                            }}
                            className="p-4 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <h4 className="font-bold text-base tracking-tight" style={{ color: previewContrast.text }}>
                                {settings.title}
                              </h4>
                              <p className="text-sm mt-0.5 font-medium" style={{ color: previewContrast.textMuted }}>
                                {settings.subtitle}
                              </p>
                            </div>
                            <div
                              style={{ background: previewContrast.closeBtnBg, color: previewContrast.text }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer"
                            >
                              ✕
                            </div>
                          </div>
                          <div className="flex border-b border-slate-100 bg-slate-50 text-sm font-semibold">
                            {settings.enableChat && (
                              <div
                                className="flex-1 py-2.5 text-center border-b-2 font-bold bg-white"
                                style={{ color: previewContrast.activeTab, borderBottomColor: previewContrast.activeTab }}
                              >
                                💬 Chat
                              </div>
                            )}
                            {settings.enableFeedback && <div className="flex-1 py-2.5 text-center text-slate-500 font-semibold">⭐ Feedback</div>}
                            {settings.enableBugReport && <div className="flex-1 py-2.5 text-center text-slate-500 font-semibold">🐞 Bug Report</div>}
                          </div>
                          <div className="flex-1 bg-slate-50 p-4 space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="bg-white border border-slate-200 p-3 rounded-2xl text-xs text-slate-800 shadow-xs max-w-[85%] rounded-bl-sm">
                                {settings.greeting}
                              </div>
                              <div
                                style={{
                                  backgroundColor: settings.primaryColor,
                                  color: previewContrast.text,
                                  border: previewContrast.bubbleBorder
                                }}
                                className="p-3 rounded-2xl text-xs shadow-xs max-w-[85%] ml-auto rounded-br-sm font-medium"
                              >
                                Visitor message sample
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                              <div className="flex-1 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-400">
                                Type a message...
                              </div>
                              <div
                                style={{
                                  backgroundColor: settings.primaryColor,
                                  color: previewContrast.text,
                                  border: previewContrast.launcherBorder
                                }}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-xs"
                              >
                                ➤
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-medium">Launcher Button:</span>
                          <div
                            style={{
                              backgroundColor: settings.primaryColor,
                              color: previewContrast.text,
                              border: previewContrast.launcherBorder
                            }}
                            className="w-11 h-11 rounded-full shadow-md flex items-center justify-center font-bold text-sm"
                          >
                            💬
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 3: FEEDBACK & BUGS */}
              {activeNav === 'feedback' && (
                <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-8 bg-slate-50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2.5">
                      <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                      <span>Customer Ratings & Reviews</span>
                    </h3>
                    {feedbacks.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-600 text-base font-medium">
                        No feedback received yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {feedbacks.map((f) => (
                          <div key={f.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                            <div className="flex items-center gap-1 text-amber-500">
                              {[...Array(f.rating)].map((_, i) => (
                                <Star key={i} className="w-5 h-5 fill-amber-500" />
                              ))}
                            </div>
                            <p className="text-base text-slate-900 mt-2 font-medium leading-relaxed">"{f.comment}"</p>
                            <div className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100 flex justify-between font-medium">
                              <span>{f.userEmail || 'Anonymous'}</span>
                              <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2.5">
                      <Bug className="w-6 h-6 text-rose-500" />
                      <span>Reported Issues</span>
                    </h3>
                    {bugs.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-600 text-base font-medium">
                        No bugs reported yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {bugs.map((b) => (
                          <div key={b.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-base text-slate-900">{b.title}</h4>
                              <span className="text-xs bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                                {b.status}
                              </span>
                            </div>
                            <p className="text-base text-slate-700 leading-relaxed">{b.description}</p>
                            <div className="mt-3 bg-slate-50 p-3.5 rounded-xl text-sm font-mono text-slate-600 space-y-1">
                              <div><strong>URL:</strong> {b.url || 'N/A'}</div>
                              <div><strong>Device:</strong> {b.device || 'N/A'}</div>
                              <div className="truncate"><strong>User-Agent:</strong> {b.browser || 'N/A'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PRIVACY ANALYTICS */}
              {activeNav === 'analytics' && (
                <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Total Pageviews</span>
                      <div className="text-4xl font-extrabold text-slate-900 mt-2">{analytics.totalPageviews}</div>
                      <p className="text-sm text-slate-600 mt-1.5 font-medium">Total pageview events recorded</p>
                    </div>
                    <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Unique Daily Visitors</span>
                      <div className="text-4xl font-extrabold text-[#287170] mt-2">{analytics.uniqueVisitors}</div>
                      <p className="text-sm text-slate-600 mt-1.5 font-medium">Daily unique visitor count</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-lg font-bold text-slate-900 mb-4">Top Visited Pages</h4>
                    {analytics.topPages && analytics.topPages.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {analytics.topPages.map((p, idx) => (
                          <div key={idx} className="py-3 flex justify-between items-center">
                            <span className="font-mono text-slate-800 text-sm font-medium">{p.path}</span>
                            <span className="font-bold text-slate-900 text-base">{p.count} views</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-base text-slate-600 text-center py-8 font-medium">
                        No analytics events recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: PAGE RULES & DISPLAY */}
              {activeNav === 'page-rules' && (
                <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6 max-w-5xl bg-slate-50">
                  {/* 1. Header & Master Status */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-xl font-bold text-slate-900">Page Targeting & Display Rules</h2>
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#287170]/10 text-[#287170]">
                            {activeSite.name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 font-medium">
                          Control exactly which pages display the SitePulse widget across your website without editing code.
                        </p>
                      </div>

                      {/* Master Widget Switch */}
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 px-3.5 rounded-xl shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Widget Status</div>
                          <div className={`text-sm font-bold ${pageRules.enabled !== false ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pageRules.enabled !== false ? 'Active Site-wide' : 'Disabled Site-wide'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPageRules(prev => ({ ...prev, enabled: prev.enabled === false }))}
                          className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                            pageRules.enabled !== false ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
                        </button>
                      </div>
                    </div>

                    {/* 2. Default Policy Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div>
                        <label className="text-sm font-bold text-slate-800 block">Default Visibility for New / Unlisted Pages</label>
                        <p className="text-xs text-slate-500 font-medium">When a visitor visits a page not explicitly listed in the table below</p>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPageRules(prev => ({ ...prev, defaultPolicy: 'allow' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            pageRules.defaultPolicy !== 'block'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Show Widget (Default)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageRules(prev => ({ ...prev, defaultPolicy: 'block' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            pageRules.defaultPolicy === 'block'
                              ? 'bg-white text-rose-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Hide Widget (Strict Whitelist)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Discovered Pages Table & Scanner */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>Discovered Pages & Paths</span>
                          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                            {discoveredPages.filter(p => !pageSearchQuery || p.path.toLowerCase().includes(pageSearchQuery.toLowerCase())).length} Found
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Auto-detected via website link crawler and real-time visitor traffic.
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Search Box */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Filter paths..."
                            value={pageSearchQuery}
                            onChange={(e) => setPageSearchQuery(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#287170] w-40 sm:w-48 font-medium"
                          />
                        </div>

                        {/* Crawler Scan Button */}
                        <button
                          type="button"
                          onClick={handleScanWebsite}
                          disabled={scanningSite}
                          className="px-3.5 py-1.5 bg-[#287170] hover:bg-[#205d5c] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${scanningSite ? 'animate-spin' : ''}`} />
                          <span>{scanningSite ? 'Scanning...' : 'Scan Website'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Scan Feedback Banner */}
                    {scanMessage && (
                      <div className={`p-3 px-5 text-xs font-semibold flex items-center justify-between border-b ${
                        scanMessage.type === 'success' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                          : 'bg-rose-50 text-rose-800 border-rose-100'
                      }`}>
                        <span>{scanMessage.text}</span>
                        <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                      </div>
                    )}

                    {/* Pages Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-5">Path / Page</th>
                            <th className="py-3 px-4">Discovery Source</th>
                            <th className="py-3 px-4">Rule Mode</th>
                            <th className="py-3 px-5 text-right">Widget Visibility</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {discoveredPages.filter(p => !pageSearchQuery || p.path.toLowerCase().includes(pageSearchQuery.toLowerCase())).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                                {pageSearchQuery ? 'No pages match your search.' : 'No pages discovered yet. Click "Scan Website" to crawl your domain.'}
                              </td>
                            </tr>
                          ) : (
                            discoveredPages
                              .filter(p => !pageSearchQuery || p.path.toLowerCase().includes(pageSearchQuery.toLowerCase()))
                              .map((item) => {
                                const path = item.path;
                                const isExplicit = pageRules.rules?.[path] !== undefined;
                                const isAllowed = isExplicit 
                                  ? Boolean(pageRules.rules[path])
                                  : pageRules.defaultPolicy !== 'block';

                                return (
                                  <tr key={path} className="hover:bg-slate-50/75 transition-colors">
                                    <td className="py-3.5 px-5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold text-slate-900 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                                          {path}
                                        </span>
                                        {path === '/' && (
                                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            Homepage
                                          </span>
                                        )}
                                        {item.views > 0 && (
                                          <span className="text-[11px] text-slate-500 font-medium">
                                            ({item.views} {item.views === 1 ? 'view' : 'views'})
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4">
                                      {item.source === 'traffic' ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">
                                          📡 Real Traffic
                                        </span>
                                      ) : item.source === 'crawler' ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                                          🔍 Crawler Link
                                        </span>
                                      ) : item.source === 'custom_rule' ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                                          ⚙️ Custom Pattern
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                          🏠 Root
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 text-xs font-medium text-slate-500">
                                      {isExplicit ? (
                                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">Custom Override</span>
                                      ) : (
                                        <span className="text-slate-400">Default Policy</span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePageRule(path)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                                          isAllowed
                                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                        }`}
                                      >
                                        {isAllowed ? (
                                          <>
                                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Active (Visible)</span>
                                          </>
                                        ) : (
                                          <>
                                            <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                                            <span>Hidden (Disabled)</span>
                                          </>
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. Add Custom Wildcard / Pattern Rule */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-lg">
                        *
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Add Custom Path or Wildcard Pattern</h3>
                        <p className="text-xs text-slate-500 font-medium">Pre-emptively hide or show the widget on paths (e.g. <code>/checkout/*</code>, <code>/admin/*</code>, or <code>/login</code>)</p>
                      </div>
                    </div>

                    <form onSubmit={handleAddCustomPattern} className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                      <div className="relative flex-1 w-full">
                        <input
                          type="text"
                          placeholder="e.g. /checkout/* or /login or *.html"
                          value={customPatternInput}
                          onChange={(e) => setCustomPatternInput(e.target.value)}
                          className="w-full font-mono text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#287170] font-medium"
                        />
                      </div>
                      <select
                        value={customPatternAction}
                        onChange={(e) => setCustomPatternAction(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#287170] cursor-pointer"
                      >
                        <option value="block">Hide Widget (Disabled)</option>
                        <option value="allow">Show Widget (Active)</option>
                      </select>
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Pattern</span>
                      </button>
                    </form>
                  </div>

                  {/* 5. Save & Publish Bar */}
                  <div className="sticky bottom-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 font-medium">
                      Changes take effect in real-time across your visitors and single-page app navigations.
                    </div>
                    <button
                      type="button"
                      onClick={handleSavePageRules}
                      disabled={savingPageRules}
                      className="px-6 py-2.5 bg-[#287170] hover:bg-[#205d5c] text-white text-sm font-bold rounded-xl transition shadow-sm shadow-[#287170]/25 flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {pageRulesSaved ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Rules Published Live!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{savingPageRules ? 'Publishing...' : 'Save & Publish Rules'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: PROPERTY SETTINGS & DANGER ZONE */}
              {activeNav === 'settings' && (
                <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6 max-w-4xl bg-slate-50">
                  {/* Property Details Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-[#287170]/10 text-[#287170] flex items-center justify-center">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Website Property</h3>
                        <p className="text-sm text-slate-600 font-medium">Active domain identifiers and configuration</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Property Name
                        </label>
                        <div className="text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                          {activeSite.name}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Registered Domain
                        </label>
                        <div className="text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                          {activeSite.domain}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Site Key Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-[#287170]/10 text-[#287170] flex items-center justify-center">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Site Key (Public API Key)</h3>
                        <p className="text-sm text-slate-600 font-medium">Embedded in your client-side website code to authenticate the widget</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={activeSite.apiKey}
                        className="flex-1 bg-slate-50 border border-slate-200 font-mono text-sm px-3.5 py-2.5 rounded-xl text-slate-900 font-semibold select-all"
                      />
                      <button
                        onClick={copyEmbedCode}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedSnippet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#287170]" />}
                        <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Embed Script Integration */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-[#287170]/10 text-[#287170] flex items-center justify-center">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">HTML Embed Script</h3>
                        <p className="text-sm text-slate-600 font-medium">Insert this single line right before the closing &lt;/body&gt; tag on your website</p>
                      </div>
                    </div>

                    <div className="relative">
                      <pre className="p-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl font-mono text-sm overflow-x-auto leading-relaxed select-all">
                        {`<script src="${BACKEND_URL}/sitepulse.js" data-site-key="${activeSite.apiKey}" defer></script>`}
                      </pre>
                      <button
                        onClick={copyEmbedCode}
                        className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 border border-slate-200 shadow-xs cursor-pointer"
                      >
                        {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#287170]" />}
                        <span>{copiedSnippet ? 'Copied' : 'Copy Code'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Layers className="w-4 h-4 text-[#287170]" />
                        <span>Want to show or hide the widget on specific pages?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveNav('page-rules')}
                        className="text-[#287170] hover:text-[#205d5c] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Configure Page Rules →</span>
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone: Destructive Actions */}
                  <div className="bg-white rounded-2xl border border-rose-200 shadow-xs p-6 space-y-5">
                    <div className="flex items-center gap-3 pb-3 border-b border-rose-100">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-rose-900">Danger Zone</h3>
                        <p className="text-sm text-rose-600">Irreversible destructive actions for this website property</p>
                      </div>
                    </div>

                    {/* Action 1: Delete All Chats */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 rounded-xl border border-rose-100 bg-rose-50/40">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                          <MessageSquareX className="w-4 h-4 text-rose-600" />
                          <span>Delete All Chats</span>
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                          Permanently delete all active and resolved visitor conversations, messages, and chat sessions for <strong className="text-slate-900">{activeSite.name}</strong>. Feedback ratings, bug reports, and analytics will remain intact.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => promptDeleteChats(activeSite)}
                        className="self-start sm:self-center px-4 py-2.5 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 hover:text-rose-800 font-semibold rounded-xl text-sm transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                      >
                        <MessageSquareX className="w-4 h-4 text-rose-600" />
                        <span>Delete All Chats</span>
                      </button>
                    </div>

                    {/* Action 2: Delete Entire Website Property */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 rounded-xl border border-rose-100 bg-rose-50/40">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          <span>Delete Entire Website Property</span>
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                          Permanently delete <strong className="text-slate-900">{activeSite.name}</strong> ({activeSite.domain}) and all associated conversations, feedback, bugs, and analytics.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => promptDeleteSite(activeSite)}
                        className="self-start sm:self-center px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Website</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* New Site Modal */}
      {showNewSiteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-7">
            <h3 className="text-xl font-bold text-slate-900">Add New Website</h3>
            <p className="text-sm text-slate-600 mt-1 font-medium">Register a domain to generate an embed key.</p>

            <form onSubmit={handleCreateSite} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Online Store"
                  value={newSiteForm.name}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#287170]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. store.com"
                  value={newSiteForm.domain}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, domain: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#287170]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewSiteModal(false)}
                  className="px-5 py-2.5 text-base font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-base font-semibold bg-[#287170] hover:bg-[#205d5c] text-white rounded-xl shadow-sm shadow-[#287170]/25 transition cursor-pointer"
                >
                  Add Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Site Confirmation Modal (Password Verification) */}
      {deleteSiteModal.open && deleteSiteModal.site && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-100 w-full max-w-md p-7">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Delete Website Property</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              You are about to permanently delete <strong className="text-slate-900">{deleteSiteModal.site.name}</strong> ({deleteSiteModal.site.domain}). All associated conversations, feedback ratings, and visitor analytics will be permanently erased.
            </p>

            {deleteSiteModal.error && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm font-medium text-rose-700">
                {deleteSiteModal.error}
              </div>
            )}

            <form onSubmit={handleConfirmDeleteSite} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Confirm Admin Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Enter your admin account password"
                    value={deleteSiteModal.password}
                    onChange={(e) => setDeleteSiteModal(prev => ({ ...prev, password: e.target.value, error: '' }))}
                    className="w-full px-3.5 pl-10 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteSiteModal({ open: false, site: null, password: '', error: '', loading: false })}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteSiteModal.loading || !deleteSiteModal.password}
                  className="px-5 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  {deleteSiteModal.loading ? 'Verifying...' : 'Confirm & Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete All Chats Confirmation Modal (Password Verification) */}
      {deleteChatsModal.open && deleteChatsModal.site && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-100 w-full max-w-md p-7">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <MessageSquareX className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Delete All Conversations</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              You are about to permanently delete all conversations and message transcripts for <strong className="text-slate-900">{deleteChatsModal.site.name}</strong>. Feedback ratings, bug reports, and analytics will not be affected.
            </p>

            {deleteChatsModal.error && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm font-medium text-rose-700">
                {deleteChatsModal.error}
              </div>
            )}

            <form onSubmit={handleConfirmDeleteChats} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Confirm Admin Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Enter your admin account password"
                    value={deleteChatsModal.password}
                    onChange={(e) => setDeleteChatsModal(prev => ({ ...prev, password: e.target.value, error: '' }))}
                    className="w-full px-3.5 pl-10 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteChatsModal({ open: false, site: null, password: '', error: '', loading: false })}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteChatsModal.loading || !deleteChatsModal.password}
                  className="px-5 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  {deleteChatsModal.loading ? 'Deleting...' : 'Confirm & Delete All Chats'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
