import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Bug, 
  BarChart3, 
  Send, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Star, 
  Radio,
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
  X
} from 'lucide-react';
import { io } from 'socket.io-client';

const BACKEND_URL = (window.location.origin.includes(':3000') || window.location.origin.includes(':5173'))
  ? 'http://localhost:5000' 
  : window.location.origin;

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('sitepulse_admin_token'));
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSystemInitialized, setIsSystemInitialized] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  // Navigation & Sites state
  const [activeNav, setActiveNav] = useState('chat'); // 'chat' | 'customizer' | 'feedback' | 'analytics'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatView, setMobileChatView] = useState(false);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState({ name: '', domain: '' });
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Widget Customizer State
  const [settings, setSettings] = useState({
    primaryColor: '#2563eb',
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

  // Live Chat State
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'resolved'
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

  // Helper for authenticated fetch
  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  };

  // 1. Check Auth Status on Load
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      if (token) {
        try {
          const res = await authFetch(`${BACKEND_URL}/api/v1/auth/me`);
          if (res.ok) {
            const data = await res.json();
            setUser(data);
          } else {
            handleLogout();
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/status`);
          const data = await res.json();
          setIsSystemInitialized(data.initialized);
          if (!data.initialized) {
            setAuthMode('signup');
          }
        } catch (e) {
          console.error(e);
        }
      }
      setAuthLoading(false);
    };
    initAuth();
  }, [token]);

  // Handle Login / Signup
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login';

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('sitepulse_admin_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sitepulse_admin_token');
    setToken(null);
    setUser(null);
    setSites([]);
    setActiveSite(null);
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

  // Create New Site
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

  // Delete Site
  const handleDeleteSite = async (siteToDelete) => {
    const target = siteToDelete || activeSite;
    if (!target || !token) return;

    const confirmed = confirm(
      `Are you sure you want to remove "${target.name}" (${target.domain})?\n\nThis will permanently delete this website property along with all its conversations, visitor feedback, bug reports, and analytics data.`
    );
    if (!confirmed) return;

    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/sites/${target.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const remaining = sites.filter(s => s.id !== target.id);
        setSites(remaining);
        if (activeSite?.id === target.id) {
          setActiveSite(remaining.length > 0 ? remaining[0] : null);
        }
      } else {
        const data = await res.json();
        alert('Failed to delete website: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error deleting website: ' + e.message);
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
      if (selectedConv && selectedConv.id === data.conversationId) {
        setMessages((prev) => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
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
          setSelectedConv(data[0]);
        }
      }
    } catch (e) {}
  };

  // Load conversation messages
  useEffect(() => {
    if (selectedConv && token) {
      setIsVisitorTyping(false);
      if (socket) {
        socket.emit('join_conversation', { conversationId: selectedConv.id });
      }
      authFetch(`${BACKEND_URL}/api/v1/conversations/${selectedConv.id}/messages`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setMessages(data);
        })
        .catch(() => {});
    }
  }, [selectedConv, socket, token]);

  // 5. Load Feedback, Bugs, & Analytics
  useEffect(() => {
    if (!activeSite || !token) return;
    if (activeNav === 'feedback') {
      authFetch(`${BACKEND_URL}/api/v1/feedback?siteKey=${activeSite.apiKey}`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setFeedbacks(data); });

      authFetch(`${BACKEND_URL}/api/v1/bugs?siteKey=${activeSite.apiKey}`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setBugs(data); });
    } else if (activeNav === 'analytics') {
      authFetch(`${BACKEND_URL}/api/v1/events/stats?siteKey=${activeSite.apiKey}`)
        .then(res => res.json())
        .then(data => setAnalytics(data));
    }
  }, [activeNav, activeSite, token]);

  // Agent Send Reply
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || !socket || !activeSite) return;

    socket.emit('send_message', {
      conversationId: selectedConv.id,
      siteKey: activeSite.apiKey,
      senderType: 'agent',
      senderName: user ? user.name : 'Support Agent',
      content: replyText.trim()
    });

    socket.emit('typing', {
      conversationId: selectedConv.id,
      senderType: 'agent',
      isTyping: false
    });

    setReplyText('');
  };

  // Toggle Conversation Status (Open / Resolved)
  const handleToggleStatus = async () => {
    if (!selectedConv || !token) return;
    const newStatus = selectedConv.status === 'resolved' ? 'open' : 'resolved';
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/conversations/${selectedConv.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedConv(prev => ({ ...prev, status: updated.status }));
        setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, status: updated.status } : c));
      }
    } catch (e) {
      console.error(e);
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
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
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

  // ==========================================
  // AUTH SCREEN (LOGIN / INITIAL SIGNUP)
  // ==========================================
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <Radio className="w-8 h-8 text-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-300">Loading SitePulse Platform...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center shadow-xl shadow-blue-500/25">
            <Radio className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {authMode === 'signup' ? 'Setup Your SitePulse Admin Account' : 'Sign in to SitePulse Admin'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {authMode === 'signup'
              ? 'Complete first-time setup to manage support chat, feedback, and privacy analytics.'
              : 'Enter your administrator credentials to access your dashboard.'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
            {authError && (
              <div className="mb-5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-xl">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">Your Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="e.g. Sarah Connor"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    placeholder="admin@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-base shadow-lg shadow-blue-600/30 transition"
              >
                {authMode === 'signup' ? 'Complete Admin Setup' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              {authMode === 'signup' ? (
                <span>
                  Already have an account?{' '}
                  <button onClick={() => setAuthMode('login')} className="text-blue-400 hover:underline font-semibold">
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  Need to setup first admin?{' '}
                  <button onClick={() => setAuthMode('signup')} className="text-blue-400 hover:underline font-semibold">
                    Create Account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredConversations = conversations.filter(conv => {
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
  // AUTHENTICATED DASHBOARD
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                <Radio className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight leading-none">SitePulse</h1>
                <span className="text-xs text-slate-400 font-medium">Production Suite</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Site Selector */}
          <div className="p-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Site</span>
              <button
                onClick={() => {
                  setShowNewSiteModal(true);
                  setMobileMenuOpen(false);
                }}
                className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
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
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3.5 py-2.5 border border-slate-700 font-medium focus:outline-none appearance-none cursor-pointer"
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
          <nav className="p-3 space-y-1.5">
            <button
              onClick={() => {
                setActiveNav('chat');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeNav === 'chat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                <span>Live Support Inbox</span>
              </div>
              {conversations.length > 0 && (
                <span className="bg-slate-800 text-slate-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {conversations.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveNav('customizer');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeNav === 'customizer'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Widget Customizer</span>
            </button>

            <button
              onClick={() => {
                setActiveNav('feedback');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeNav === 'feedback'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Bug className="w-5 h-5" />
              <span>Feedback & Bugs</span>
            </button>

            <button
              onClick={() => {
                setActiveNav('analytics');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeNav === 'analytics'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Privacy Analytics</span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {activeSite && (
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Site Key</div>
              <div className="font-mono text-sm text-blue-400 mt-1 truncate select-all">{activeSite.apiKey}</div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-700/60">
                <button
                  onClick={copyEmbedCode}
                  className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-slate-300 hover:text-white transition"
                >
                  {copiedSnippet ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSnippet ? 'Copied script!' : 'Copy script'}</span>
                </button>
                <button
                  onClick={() => handleDeleteSite(activeSite)}
                  title="Remove this site"
                  className="text-xs sm:text-sm font-medium flex items-center gap-1 text-slate-400 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="truncate">
              <div className="text-sm font-bold text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 capitalize truncate">
              {activeNav === 'chat' && 'Live Support Inbox'}
              {activeNav === 'customizer' && 'Widget Customization & Styling'}
              {activeNav === 'feedback' && 'Feedback & Bug Reports'}
              {activeNav === 'analytics' && 'Privacy-Preserving Website Analytics'}
            </h2>
          </div>
          {activeSite && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{activeSite.name}</span>
                <span className="text-slate-400 text-xs font-normal">({activeSite.domain})</span>
              </span>
            </div>
          )}
        </header>

        {/* Dynamic Views */}
        <div className="flex-1 overflow-hidden min-w-0">
          {!activeSite ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Website Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                You don't have any active websites. Create a website property to get an embed code and start chatting with visitors.
              </p>
              <button
                onClick={() => setShowNewSiteModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Website</span>
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: LIVE CHAT */}
          {activeNav === 'chat' && (
            <div className="flex h-full min-w-0">
              <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 ${mobileChatView ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Conversations ({filteredConversations.length})
                  </span>
                  <button onClick={fetchConversations} className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
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
                      className="w-full bg-slate-50 text-sm pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 font-medium placeholder-slate-400"
                    />
                  </div>
                  <div className="flex gap-1.5 text-xs overflow-x-auto pb-0.5">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      All ({conversations.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('open')}
                      className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 ${statusFilter === 'open' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Open ({conversations.filter(c => c.status !== 'resolved').length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('resolved')}
                      className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 ${statusFilter === 'resolved' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Resolved ({conversations.filter(c => c.status === 'resolved').length})
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm font-medium">
                      {searchQuery ? 'No conversations matching search.' : 'No conversations found in this view.'}
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isSelected = selectedConv?.id === conv.id;
                      const lastMsg = conv.messages?.[0]?.content || 'Started conversation';
                      const isResolved = conv.status === 'resolved';
                      return (
                        <div
                          key={conv.id}
                          onClick={() => {
                            setSelectedConv(conv);
                            setMobileChatView(true);
                          }}
                          className={`p-4 cursor-pointer transition ${
                            isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-base text-slate-900 truncate">
                              {conv.visitorName || conv.visitorEmail || `Visitor #${conv.visitorId.slice(-6)}`}
                            </span>
                            <span className="text-xs text-slate-400 font-medium shrink-0">
                              {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {conv.visitorEmail && (
                            <div className="text-xs sm:text-sm text-blue-600 font-medium truncate mt-1 flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="truncate">{conv.visitorEmail}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {conv.externalId && (
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold truncate">
                                Identified: #{conv.externalId}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${isResolved ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                              {isResolved ? 'Resolved' : 'Open'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1.5 truncate leading-normal">{lastMsg}</p>
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
                        <span className="text-xs sm:text-sm font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hidden sm:flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate">{selectedConv.visitorEmail}</span>
                        </span>
                      )}
                      {selectedConv.externalId && (
                        <span className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 hidden sm:inline">
                          ✓ #{selectedConv.externalId}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono hidden xl:inline">
                        (Session: {selectedConv.visitorId.slice(0, 8)}...)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleToggleStatus}
                        className={`text-sm px-3.5 sm:px-4 py-1.5 rounded-xl font-semibold transition flex items-center gap-2 shrink-0 ${
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
                                ? 'bg-blue-600 text-white rounded-br-sm shadow-sm'
                                : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm shadow-sm'
                            }`}
                          >
                            {m.content}
                          </div>
                          <span className="text-xs text-slate-400 font-medium mt-1.5 px-1">
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
                    <div className="px-4 sm:px-6 py-2.5 text-sm font-medium text-blue-600 italic bg-blue-50/70 flex items-center gap-2 border-t border-blue-100/70 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
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
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-500 placeholder-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 sm:px-6 py-3 rounded-xl font-semibold text-base flex items-center gap-2 transition shrink-0 shadow-sm"
                    >
                      <Send className="w-5 h-5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 text-base font-medium">
                  Select a conversation from the left to start chatting.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WIDGET CUSTOMIZER */}
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
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subtitle</label>
                    <input
                      type="text"
                      value={settings.subtitle}
                      onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Greeting Message</label>
                    <textarea
                      value={settings.greeting}
                      onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                      rows={3}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-blue-500"
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
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-base text-slate-800 font-medium">Enable Live Chat</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableFeedback}
                      onChange={(e) => setSettings({ ...settings, enableFeedback: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-base text-slate-800 font-medium">Enable Feedback Rating</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableBugReport}
                      onChange={(e) => setSettings({ ...settings, enableBugReport: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-base text-slate-800 font-medium">Enable Bug Reporting</span>
                  </label>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-base shadow-sm transition flex items-center justify-center gap-2"
                >
                  {saveSuccess ? <Check className="w-5 h-5 text-emerald-300" /> : <Sparkles className="w-5 h-5" />}
                  <span>{savingSettings ? 'Saving...' : (saveSuccess ? 'Changes Published Live!' : 'Save & Publish Changes')}</span>
                </button>

                {/* Danger Zone: Delete Site */}
                {activeSite && (
                  <div className="pt-5 border-t border-slate-200 mt-2">
                    <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2.5">
                      <span className="text-sm font-bold text-rose-800 uppercase tracking-wider block">
                        Danger Zone
                      </span>
                      <p className="text-sm text-rose-700 leading-relaxed">
                        Permanently delete <strong>{activeSite.name}</strong> ({activeSite.domain}) and all associated chats, feedback, and analytics data.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(activeSite)}
                        className="mt-1 w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Website Property</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center p-6 sm:p-8 relative min-h-[580px] lg:min-h-0">
                <div className="w-[360px] h-[500px] bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
                  <div style={{ backgroundColor: settings.primaryColor }} className="text-white p-4">
                    <h4 className="font-semibold text-sm">{settings.title}</h4>
                    <p className="text-xs opacity-90 mt-0.5">{settings.subtitle}</p>
                  </div>
                  <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-medium">
                    {settings.enableChat && <div className="flex-1 py-2 text-center border-b-2 font-semibold bg-white" style={{ color: settings.primaryColor, borderBottomColor: settings.primaryColor }}>💬 Chat</div>}
                    {settings.enableFeedback && <div className="flex-1 py-2 text-center text-slate-500">⭐ Feedback</div>}
                    {settings.enableBugReport && <div className="flex-1 py-2 text-center text-slate-500">🐞 Bug Report</div>}
                  </div>
                  <div className="flex-1 bg-slate-50 p-4 space-y-3">
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl text-xs text-slate-800 shadow-sm max-w-[85%]">
                      {settings.greeting}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FEEDBACK & BUGS */}
          {activeNav === 'feedback' && (
            <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2.5">
                  <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                  <span>Customer Ratings & Reviews</span>
                </h3>
                {feedbacks.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-base font-medium">
                    No feedback received yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {feedbacks.map((f) => (
                      <div key={f.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-center gap-1 text-amber-500">
                          {[...Array(f.rating)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 fill-amber-500" />
                          ))}
                        </div>
                        <p className="text-base text-slate-900 mt-2 font-medium leading-relaxed">"{f.comment}"</p>
                        <div className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-100 flex justify-between font-medium">
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
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-base font-medium">
                    No bugs reported yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bugs.map((b) => (
                      <div key={b.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
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
            <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Pageviews</span>
                  <div className="text-4xl font-extrabold text-slate-900 mt-2">{analytics.totalPageviews}</div>
                  <p className="text-sm text-slate-500 mt-1.5 font-medium">Recorded without intrusive third-party cookies</p>
                </div>
                <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Unique Daily Visitors</span>
                  <div className="text-4xl font-extrabold text-blue-600 mt-2">{analytics.uniqueVisitors}</div>
                  <p className="text-sm text-slate-500 mt-1.5 font-medium">Calculated via daily salted cryptographic hashes</p>
                </div>
              </div>

              <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
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
                  <div className="text-base text-slate-400 text-center py-8 font-medium">
                    No analytics events captured yet. Visits on your connected website will appear here in real time.
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </main>

      {/* New Site Modal */}
      {showNewSiteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-7">
            <h3 className="text-xl font-bold text-slate-900">Add New Website</h3>
            <p className="text-sm text-slate-500 mt-1">Generate a new Site Key and separate widget for another domain.</p>

            <form onSubmit={handleCreateSite} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Online Store"
                  value={newSiteForm.name}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-blue-500"
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
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewSiteModal(false)}
                  className="px-5 py-2.5 text-base font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
                >
                  Create Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
