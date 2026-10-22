import React, { useState, useEffect } from 'react';
import { Menu, Layers, Plus } from 'lucide-react';

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

import { useAuth } from './hooks/useAuth';
import { useSites } from './hooks/useSites';
import { useChat } from './hooks/useChat';
import { BACKEND_URL, widgetApi, sitesApi, feedbackApi, bugsApi, eventsApi } from './services/api';

export default function App() {
  // 1. Authentication Hook
  const {
    token,
    user,
    authLoading,
    authMode,
    setAuthMode,
    authError,
    setAuthError,
    authForm,
    setAuthForm,
    handleAuthSubmit,
    handleLogout
  } = useAuth();

  // Navigation State
  const [activeNav, setActiveNav] = useState('chat'); // 'chat' | 'customizer' | 'page-rules' | 'feedback' | 'analytics' | 'settings'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 2. Sites Management Hook
  const {
    sites,
    setSites,
    activeSite,
    setActiveSite,
    showNewSiteModal,
    setShowNewSiteModal,
    newSiteForm,
    setNewSiteForm,
    handleCreateSite,
    siteDetailsForm,
    setSiteDetailsForm,
    savingSiteDetails,
    siteDetailsMessage,
    setSiteDetailsMessage,
    handleUpdateSiteName,
    changeDomainModal,
    setChangeDomainModal,
    promptChangeDomain,
    handleConfirmChangeDomain,
    deleteSiteModal,
    setDeleteSiteModal,
    promptDeleteSite,
    handleConfirmDeleteSite,
    deleteChatsModal,
    setDeleteChatsModal,
    promptDeleteChats,
    handleConfirmDeleteChats,
    copiedSnippet,
    copyEmbedCode
  } = useSites(token, user, () => resetChatState());

  // 3. Realtime Chat & Inbox Hook
  const {
    conversations,
    selectedConv,
    unreadCounts,
    messages,
    replyText,
    setReplyText,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isVisitorTyping,
    mobileChatView,
    setMobileChatView,
    socket,
    chatBottomRef,
    agentTypingTimeoutRef,
    fetchConversations,
    handleSelectConversation,
    handleSendReply,
    handleToggleStatus,
    resetChatState,
    totalUnreadCount,
    filteredConversations
  } = useChat(activeSite, token, user);

  // 4. Widget Customizer State
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

  // Sync widget customizer settings when active site changes
  useEffect(() => {
    if (activeSite?.widgetSettings) {
      setSettings(activeSite.widgetSettings);
    }
  }, [activeSite]);

  const handleSaveSettings = async () => {
    if (!activeSite || !token) return;
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      await widgetApi.updateConfig({ siteKey: activeSite.apiKey, settings });
      setActiveSite(prev => ({ ...prev, widgetSettings: settings }));
      setSites(prev => prev.map(s => s.id === activeSite.id ? { ...s, widgetSettings: settings } : s));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // 5. Feedback, Bugs & Analytics State
  const [feedbacks, setFeedbacks] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalPageviews: 0,
    uniqueVisitors: 0,
    topPages: []
  });

  // 6. Page Rules & Auto-Discovery State
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

  const loadDiscoveredPages = async () => {
    if (!activeSite || !token) return;
    try {
      const data = await sitesApi.getPages(activeSite.apiKey);
      setDiscoveredPages(data.pages || []);
      if (data.pageRules) {
        setPageRules(data.pageRules);
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
      const data = await sitesApi.scanSite(activeSite.apiKey);
      setScanMessage({ 
        type: 'success', 
        text: `Scan complete: ${data.count} page(s) discovered on ${activeSite.domain}` 
      });
      await loadDiscoveredPages();
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
      await widgetApi.updateConfig({ siteKey: activeSite.apiKey, settings: updatedSettings });
      setPageRulesSaved(true);
      setActiveSite(prev => ({ ...prev, widgetSettings: updatedSettings }));
      setTimeout(() => setPageRulesSaved(false), 2500);
    } catch (e) {
      alert('Error saving rules: ' + e.message);
    } finally {
      setSavingPageRules(false);
    }
  };

  // Fetch feedback, bugs & analytics when tabs activate
  useEffect(() => {
    if (!activeSite || !token) return;
    if (activeNav === 'feedback') {
      feedbackApi.getAll(activeSite.apiKey).then(setFeedbacks);
      bugsApi.getAll(activeSite.apiKey).then(setBugs);
    } else if (activeNav === 'analytics') {
      eventsApi.getStats(activeSite.apiKey).then(setAnalytics);
    } else if (activeNav === 'page-rules') {
      loadDiscoveredPages();
    }
  }, [activeNav, activeSite, token]);

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
