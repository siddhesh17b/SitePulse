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
  ShieldCheck, 
  Globe,
  Radio
} from 'lucide-react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5000';
const DEFAULT_SITE_KEY = 'sp_demo_12345';

export default function App() {
  const [activeNav, setActiveNav] = useState('chat'); // 'chat' | 'customizer' | 'feedback' | 'analytics'
  const [siteKey, setSiteKey] = useState(DEFAULT_SITE_KEY);
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
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
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

  // 1. Initialize Socket.IO connection for Agent
  useEffect(() => {
    const s = io(BACKEND_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to SitePulse Gateway as Admin');
      s.emit('join_site_admin', { siteKey });
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
  }, [siteKey, selectedConv]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. Fetch Widget Settings from Backend
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/widget/config?key=${siteKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.settings) {
          setSettings(data.settings);
        }
      })
      .catch((err) => console.log('Backend not yet ready or offline:', err));
  }, [siteKey]);

  // 3. Fetch Conversations
  const fetchConversations = () => {
    fetch(`${BACKEND_URL}/api/v1/conversations?siteKey=${siteKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConversations(data);
          if (!selectedConv && data.length > 0) {
            setSelectedConv(data[0]);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [siteKey]);

  // Fetch messages when selected conversation changes
  useEffect(() => {
    if (selectedConv) {
      if (socket) {
        socket.emit('join_conversation', { conversationId: selectedConv.id });
      }
      fetch(`${BACKEND_URL}/api/v1/conversations/${selectedConv.id}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setMessages(data);
        })
        .catch(() => {});
    }
  }, [selectedConv, socket]);

  // 4. Fetch Feedbacks & Bugs
  useEffect(() => {
    if (activeNav === 'feedback') {
      fetch(`${BACKEND_URL}/api/v1/feedback?siteKey=${siteKey}`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setFeedbacks(data); });

      fetch(`${BACKEND_URL}/api/v1/bugs?siteKey=${siteKey}`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setBugs(data); });
    }
  }, [activeNav, siteKey]);

  // Handle Agent Sending Message
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || !socket) return;

    socket.emit('send_message', {
      conversationId: selectedConv.id,
      siteKey: siteKey,
      senderType: 'agent',
      senderName: 'Support Agent',
      content: replyText.trim()
    });

    setReplyText('');
  };

  // Save Widget Customization Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/widget/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey, settings })
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
    const code = `<script src="${BACKEND_URL}/sitepulse.js" data-site-key="${siteKey}" defer></script>`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const colorPresets = [
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Indigo Purple', hex: '#8b5cf6' },
    { name: 'Rose Red', hex: '#f43f5e' },
    { name: 'Amber Warm', hex: '#f59e0b' },
    { name: 'Midnight', hex: '#0f172a' }
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">SitePulse</h1>
              <span className="text-xs text-slate-400">Admin Platform</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveNav('chat')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeNav === 'chat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeNav === 'customizer'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Widget Customizer</span>
            </button>

            <button
              onClick={() => setActiveNav('feedback')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeNav === 'feedback'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Bug className="w-4 h-4" />
              <span>Feedback & Bugs</span>
            </button>
          </nav>
        </div>

        {/* Site Key Info Card */}
        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
            <div className="text-[11px] text-slate-400 font-medium">Active Site Key</div>
            <div className="font-mono text-xs text-blue-400 mt-1 truncate">{siteKey}</div>
            <button
              onClick={copyEmbedCode}
              className="mt-2 text-xs flex items-center gap-1.5 text-slate-300 hover:text-white transition"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet ? 'Copied script!' : 'Copy embed snippet'}</span>
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
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Real-time Gateway Active
            </span>
          </div>
        </header>

        {/* Dynamic Tab Views */}
        <div className="flex-1 overflow-hidden">
          {/* TAB 1: LIVE CHAT INBOX */}
          {activeNav === 'chat' && (
            <div className="flex h-full">
              {/* Conversations List */}
              <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Conversations ({conversations.length})
                  </span>
                  <button 
                    onClick={fetchConversations}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No visitor conversations yet.<br />
                      Open the <strong className="text-slate-600">demo site</strong> and type a message in the widget!
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
                            isSelected
                              ? 'bg-blue-50/80 border-l-4 border-blue-600'
                              : 'hover:bg-slate-50'
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

              {/* Chat Thread */}
              {selectedConv ? (
                <div className="flex-1 flex flex-col bg-slate-50">
                  {/* Chat Top Bar */}
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

                  {/* Messages Bubble Area */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-slate-400 text-sm mt-12">
                        No messages in this conversation yet. Send the first greeting!
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isAgent = m.senderType === 'agent';
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                          >
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
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Reply Input Bar */}
                  <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-slate-200 flex gap-3">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply to the customer..."
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

          {/* TAB 2: WIDGET CUSTOMIZER & STYLING */}
          {activeNav === 'customizer' && (
            <div className="flex h-full overflow-hidden">
              {/* Form Controls */}
              <div className="w-[480px] border-r border-slate-200 bg-white p-8 overflow-y-auto space-y-6 shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Brand & Colors</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Customize the widget's appearance on your website.</p>
                  
                  {/* Preset Colors */}
                  <div className="mt-3 flex items-center gap-2">
                    {colorPresets.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setSettings({ ...settings, primaryColor: c.hex })}
                        title={c.name}
                        style={{ backgroundColor: c.hex }}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                          settings.primaryColor.toLowerCase() === c.hex.toLowerCase()
                            ? 'scale-125 border-slate-800 ring-2 ring-blue-500/30'
                            : 'border-white hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>

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

                <hr className="border-slate-100" />

                {/* Headers and Text */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">Titles & Greetings</h3>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Widget Title</label>
                    <input
                      type="text"
                      value={settings.title}
                      onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={settings.subtitle}
                      onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Greeting Message</label>
                    <textarea
                      value={settings.greeting}
                      onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Features & Tabs */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">Features & Position</h3>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 font-medium">Position on screen</span>
                    <select
                      value={settings.position}
                      onChange={(e) => setSettings({ ...settings, position: e.target.value })}
                      className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value="right">Bottom Right</option>
                      <option value="left">Bottom Left</option>
                    </select>
                  </div>

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

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Changes Saved & Published Live!</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{savingSettings ? 'Saving...' : 'Save & Publish Changes'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Embed snippet box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-700">Embed on your website</span>
                    <button
                      onClick={copyEmbedCode}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedSnippet ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono bg-slate-900 text-sky-400 p-2.5 rounded-lg overflow-x-auto">
{`<script src="${BACKEND_URL}/sitepulse.js" data-site-key="${siteKey}" defer></script>`}
                  </pre>
                </div>
              </div>

              {/* Live Interactive Preview */}
              <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center p-8 relative">
                <div className="absolute top-6 left-6 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Live Interactive Widget Preview
                </div>

                {/* Mock Widget Container */}
                <div className="w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                  {/* Header */}
                  <div
                    style={{ backgroundColor: settings.primaryColor }}
                    className="text-white p-4 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <h4 className="font-semibold text-sm leading-tight">{settings.title}</h4>
                      <p className="text-xs opacity-90 mt-0.5">{settings.subtitle}</p>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-medium">
                    {settings.enableChat && (
                      <div
                        style={{ borderBottomColor: settings.primaryColor, color: settings.primaryColor }}
                        className="flex-1 py-2 text-center border-b-2 font-semibold bg-white cursor-pointer"
                      >
                        💬 Chat
                      </div>
                    )}
                    {settings.enableFeedback && (
                      <div className="flex-1 py-2 text-center text-slate-500 cursor-pointer">
                        ⭐ Feedback
                      </div>
                    )}
                    {settings.enableBugReport && (
                      <div className="flex-1 py-2 text-center text-slate-500 cursor-pointer">
                        🐞 Report Bug
                      </div>
                    )}
                  </div>

                  {/* Mock Chat View */}
                  <div className="flex-1 bg-slate-50 p-4 space-y-3 overflow-y-auto">
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-sm text-xs text-slate-800 shadow-sm max-w-[85%]">
                      {settings.greeting}
                      <div className="text-[10px] text-slate-400 mt-1">Support Team</div>
                    </div>
                  </div>

                  {/* Mock Input Bar */}
                  <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      disabled
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-500"
                    />
                    <div
                      style={{ backgroundColor: settings.primaryColor }}
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Mock Floating Launcher Button */}
                <div
                  style={{ backgroundColor: settings.primaryColor }}
                  className={`absolute bottom-8 ${settings.position === 'left' ? 'left-8' : 'right-8'} w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center cursor-pointer transition-all hover:scale-105`}
                >
                  <MessageSquare className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FEEDBACK & BUGS */}
          {activeNav === 'feedback' && (
            <div className="p-8 overflow-y-auto h-full space-y-8">
              {/* Feedback Section */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span>Customer Feedback Ratings</span>
                </h3>

                {feedbacks.length === 0 ? (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
                    No customer feedback received yet. Submit one from the widget!
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

              {/* Bug Reports Section */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Bug className="w-5 h-5 text-rose-500" />
                  <span>Reported Issues & Diagnostic Info</span>
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
                          <span className="text-xs bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full font-medium border border-rose-100">
                            {b.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{b.description}</p>
                        
                        {/* Auto-Captured Diagnostics */}
                        <div className="mt-3 bg-slate-50 p-3 rounded-lg text-xs font-mono text-slate-500 space-y-1">
                          <div><strong>URL:</strong> {b.url || 'N/A'}</div>
                          <div><strong>Screen:</strong> {b.device || 'N/A'}</div>
                          <div className="truncate"><strong>User Agent:</strong> {b.browser || 'N/A'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
