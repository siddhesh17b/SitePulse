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
  Layers
} from 'lucide-react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.origin.includes(':3000') 
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
  const [socket, setSocket] = useState(null);
  const chatBottomRef = useRef(null);

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

    return () => s.disconnect();
  }, [activeSite, selectedConv]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Load Active Site Config & Conversations
  useEffect(() => {
    if (!activeSite) return;
    // Widget settings
    if (activeSite.widgetSettings) {
      setSettings(activeSite.widgetSettings);
    }

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

    setReplyText('');
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
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
            {authMode === 'signup' ? 'Setup Your SitePulse Admin Account' : 'Sign in to SitePulse Admin'}
          </h2>
          <p className="mt-1.5 text-xs text-slate-400">
            {authMode === 'signup'
              ? 'Complete first-time setup to manage support chat, feedback, and privacy analytics.'
              : 'Enter your administrator credentials to access your dashboard.'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
            {authError && (
              <div className="mb-5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-3.5 py-2.5 rounded-lg">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="e.g. Sarah Connor"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    placeholder="admin@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm shadow-lg shadow-blue-600/30 transition"
              >
                {authMode === 'signup' ? 'Complete Admin Setup' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
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

  // ==========================================
  // AUTHENTICATED DASHBOARD
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-5 flex items-center gap-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none">SitePulse</h1>
              <span className="text-[11px] text-slate-400 font-medium">Production Suite</span>
            </div>
          </div>

          {/* Active Site Selector */}
          <div className="p-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Site</span>
              <button
                onClick={() => setShowNewSiteModal(true)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
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
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 font-medium focus:outline-none appearance-none cursor-pointer"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.domain})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveNav('chat')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeNav === 'chat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4" />
                <span>Live Support Inbox</span>
              </div>
              {conversations.length > 0 && (
                <span className="bg-slate-800 text-slate-200 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {conversations.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('customizer')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeNav === 'customizer'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Widget Customizer</span>
            </button>

            <button
              onClick={() => setActiveNav('feedback')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeNav === 'feedback'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Bug className="w-4 h-4" />
              <span>Feedback & Bugs</span>
            </button>

            <button
              onClick={() => setActiveNav('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeNav === 'analytics'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Privacy Analytics</span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {activeSite && (
            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-slate-400 font-medium">Site Key</div>
              <div className="font-mono text-xs text-blue-400 mt-0.5 truncate">{activeSite.apiKey}</div>
              <button
                onClick={copyEmbedCode}
                className="mt-1.5 text-xs flex items-center gap-1.5 text-slate-300 hover:text-white transition"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet ? 'Copied script!' : 'Copy embed script'}</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 capitalize">
              {activeNav === 'chat' && 'Live Support Inbox'}
              {activeNav === 'customizer' && 'Widget Customization & Styling'}
              {activeNav === 'feedback' && 'Feedback & Bug Reports'}
              {activeNav === 'analytics' && 'Privacy-Preserving Website Analytics'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Real-time Gateway Online
            </span>
          </div>
        </header>

        {/* Dynamic Views */}
        <div className="flex-1 overflow-hidden">
          {/* TAB 1: LIVE CHAT */}
          {activeNav === 'chat' && (
            <div className="flex h-full">
              <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Conversations ({conversations.length})
                  </span>
                  <button onClick={fetchConversations} className="text-xs text-blue-600 hover:underline font-medium">
                    Refresh
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No visitor conversations yet.<br />
                      Embed your script or visit the demo page to start chatting!
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const isSelected = selectedConv?.id === conv.id;
                      const lastMsg = conv.messages?.[0]?.content || 'Started conversation';
                      return (
                        <div
                          key={conv.id}
                          onClick={() => setSelectedConv(conv)}
                          className={`p-4 cursor-pointer transition ${
                            isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-sm text-slate-800 truncate">
                              {conv.visitorName || `Visitor #${conv.visitorId.slice(-6)}`}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 truncate">{lastMsg}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedConv ? (
                <div className="flex-1 flex flex-col bg-slate-50">
                  <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
                    <div>
                      <span className="font-semibold text-sm text-slate-800">
                        {selectedConv.visitorName || `Visitor #${selectedConv.visitorId}`}
                      </span>
                      <span className="ml-2 text-xs text-slate-400 font-mono">
                        (ID: {selectedConv.visitorId.slice(0, 14)}...)
                      </span>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                      Status: Open
                    </span>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {messages.map((m) => {
                      const isAgent = m.senderType === 'agent';
                      return (
                        <div key={m.id} className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isAgent
                                ? 'bg-blue-600 text-white rounded-br-sm shadow-sm'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                            }`}
                          >
                            {m.content}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 px-1">
                            {isAgent ? 'You (Agent)' : (m.senderName || 'Visitor')} •{' '}
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-slate-200 flex gap-3">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply to the visitor..."
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  Select a conversation from the left to start chatting.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WIDGET CUSTOMIZER */}
          {activeNav === 'customizer' && (
            <div className="flex h-full overflow-hidden">
              <div className="w-[480px] border-r border-slate-200 bg-white p-8 overflow-y-auto space-y-6 shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Brand Color</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="w-10 h-10 p-0 rounded-lg cursor-pointer border border-slate-200"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="font-mono text-sm px-3 py-1.5 border border-slate-200 rounded-lg w-28 text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">Titles & Greetings</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Widget Title</label>
                    <input
                      type="text"
                      value={settings.title}
                      onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={settings.subtitle}
                      onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Greeting Message</label>
                    <textarea
                      value={settings.greeting}
                      onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">Features</h3>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableChat}
                      onChange={(e) => setSettings({ ...settings, enableChat: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-slate-700">Enable Live Chat</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableFeedback}
                      onChange={(e) => setSettings({ ...settings, enableFeedback: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-slate-700">Enable Feedback Rating</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableBugReport}
                      onChange={(e) => setSettings({ ...settings, enableBugReport: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-slate-700">Enable Bug Reporting</span>
                  </label>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm shadow transition flex items-center justify-center gap-2"
                >
                  {saveSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
                  <span>{savingSettings ? 'Saving...' : (saveSuccess ? 'Changes Published Live!' : 'Save & Publish Changes')}</span>
                </button>
              </div>

              {/* Live Preview */}
              <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center p-8 relative">
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
            <div className="p-8 overflow-y-auto h-full space-y-8">
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span>Customer Ratings & Reviews</span>
                </h3>
                {feedbacks.length === 0 ? (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
                    No feedback received yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {feedbacks.map((f) => (
                      <div key={f.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-1 text-amber-500">
                          {[...Array(f.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-amber-500" />
                          ))}
                        </div>
                        <p className="text-sm text-slate-800 mt-2 font-medium">"{f.comment}"</p>
                        <div className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100 flex justify-between">
                          <span>{f.userEmail || 'Anonymous'}</span>
                          <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Bug className="w-5 h-5 text-rose-500" />
                  <span>Reported Issues</span>
                </h3>
                {bugs.length === 0 ? (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
                    No bugs reported yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bugs.map((b) => (
                      <div key={b.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-sm text-slate-900">{b.title}</h4>
                          <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                            {b.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{b.description}</p>
                        <div className="mt-3 bg-slate-50 p-2.5 rounded-lg text-xs font-mono text-slate-500 space-y-1">
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
            <div className="p-8 overflow-y-auto h-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pageviews</span>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{analytics.totalPageviews}</div>
                  <p className="text-xs text-slate-400 mt-1">Recorded without intrusive third-party cookies</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Daily Visitors</span>
                  <div className="text-3xl font-bold text-blue-600 mt-2">{analytics.uniqueVisitors}</div>
                  <p className="text-xs text-slate-400 mt-1">Calculated via daily salted cryptographic hashes</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Top Visited Pages</h4>
                {analytics.topPages && analytics.topPages.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {analytics.topPages.map((p, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center text-sm">
                        <span className="font-mono text-slate-700 text-xs">{p.path}</span>
                        <span className="font-semibold text-slate-900">{p.count} views</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 text-center py-6">
                    No analytics events captured yet. Navigate on the demo site to generate events!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Site Modal */}
      {showNewSiteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900">Add New Website</h3>
            <p className="text-xs text-slate-500 mt-1">Generate a new Site Key and separate widget for another domain.</p>

            <form onSubmit={handleCreateSite} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Website Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Online Store"
                  value={newSiteForm.name}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. store.com"
                  value={newSiteForm.domain}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, domain: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewSiteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
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
