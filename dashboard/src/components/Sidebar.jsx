import React from 'react';
import {
  MessageSquare,
  Palette,
  Layers,
  Bug,
  BarChart3,
  Settings,
  Plus,
  ChevronDown,
  X,
  Copy,
  Check,
  LogOut
} from 'lucide-react';
import SitePulseLogo from './SitePulseLogo';

export default function Sidebar({
  mobileMenuOpen,
  setMobileMenuOpen,
  activeSite,
  sites,
  setActiveSite,
  setShowNewSiteModal,
  activeNav,
  setActiveNav,
  totalUnreadCount,
  conversations,
  copiedSnippet,
  copyEmbedCode,
  user,
  handleLogout
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-white text-slate-700 border-r border-slate-200 flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <SitePulseLogo className="w-9 h-9" />
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight block leading-tight">SitePulse</span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Admin Panel</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close menu"
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
            title="Real-time visitor chat threads and operator replies"
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
            title="Customize widget styling, colors, and branding"
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
            title="Target widget display by path or wildcard patterns"
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeNav === 'page-rules'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span>Page Rules & Display</span>
          </button>

          {/* 4. Feedback & Bugs */}
          <button
            onClick={() => {
              setActiveNav('feedback');
              setMobileMenuOpen(false);
            }}
            title="Customer ratings and bug reports with diagnostics"
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeNav === 'feedback'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Bug className="w-5 h-5" />
            <span>Feedback & Bugs</span>
          </button>

          {/* 5. Analytics */}
          <button
            onClick={() => {
              setActiveNav('analytics');
              setMobileMenuOpen(false);
            }}
            title="Privacy-friendly traffic and pageview metrics"
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeNav === 'analytics'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Analytics</span>
          </button>

          {/* 6. Settings */}
          <button
            onClick={() => {
              setActiveNav('settings');
              setMobileMenuOpen(false);
            }}
            title="Website settings, embed code, and dangerous actions"
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
            <div className="text-sm font-bold text-slate-900 truncate">{user?.name}</div>
            <div className="text-xs text-slate-600 font-medium truncate">{user?.email}</div>
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
  );
}
