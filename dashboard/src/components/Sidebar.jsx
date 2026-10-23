import React from 'react';
import {
  MessageSquare,
  Palette,
  Layers,
  Bug,
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
  sidebarCollapsed,
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
      className={`fixed inset-y-0 left-0 z-50 bg-white text-slate-700 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out lg:static ${
        sidebarCollapsed
          ? 'lg:w-0 lg:border-r-0 lg:overflow-hidden lg:opacity-0 lg:pointer-events-none'
          : 'lg:w-80 lg:border-r lg:border-slate-200 lg:opacity-100'
      } ${
        mobileMenuOpen ? 'w-80 translate-x-0 shadow-2xl border-r border-slate-200' : 'w-80 -translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="w-80 flex flex-col h-full justify-between">
        <div className="flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200">
            <div className="flex items-center gap-3.5">
              <SitePulseLogo className="w-10 h-10" />
              <div className="flex flex-col justify-center">
                <span className="font-bold text-xl text-slate-900 tracking-tight leading-tight">SitePulse</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Admin Panel</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Active Site Selector */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Active Site</span>
            <button
              onClick={() => {
                setShowNewSiteModal(true);
                setMobileMenuOpen(false);
              }}
              className="text-sm text-[#287170] hover:text-[#205d5c] flex items-center gap-1 font-bold transition cursor-pointer"
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
              className="w-full bg-slate-50 text-slate-900 text-[15px] sm:text-base rounded-2xl px-4 py-3 border border-slate-200 font-semibold focus:outline-none focus:border-[#287170] focus:ring-1 focus:ring-[#287170]/20 appearance-none cursor-pointer"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.domain})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-4 pointer-events-none" />
          </div>
        </div>

        {/* Navigation Items (Left Tab Buttons) */}
        <nav className="p-3.5 space-y-1.5">
          {/* 1. Live Chat */}
          <button
            onClick={() => {
              setActiveNav('chat');
              setMobileMenuOpen(false);
            }}
            title="Real-time visitor chat threads and operator replies"
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-[15.5px] sm:text-base font-semibold transition cursor-pointer ${
              activeNav === 'chat'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <MessageSquare className="w-5.5 h-5.5" />
              <span>Live Support Inbox</span>
            </div>
            {totalUnreadCount > 0 ? (
              <span className="bg-white text-[#287170] text-xs sm:text-sm px-2.5 py-1 rounded-full font-extrabold shadow-xs">
                {totalUnreadCount} new
              </span>
            ) : conversations.length > 0 ? (
              <span className={`text-xs sm:text-sm px-2.5 py-1 rounded-full font-bold ${activeNav === 'chat' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
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
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[15.5px] sm:text-base font-semibold transition cursor-pointer ${
              activeNav === 'customizer'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Palette className="w-5.5 h-5.5" />
            <span>Widget Customizer</span>
          </button>

          {/* 3. Page Rules & Display */}
          <button
            onClick={() => {
              setActiveNav('page-rules');
              setMobileMenuOpen(false);
            }}
            title="Target widget display by path or wildcard patterns"
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[15.5px] sm:text-base font-semibold transition cursor-pointer ${
              activeNav === 'page-rules'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-5.5 h-5.5" />
            <span>Page Rules & Display</span>
          </button>

          {/* 4. Feedback & Bugs */}
          <button
            onClick={() => {
              setActiveNav('feedback');
              setMobileMenuOpen(false);
            }}
            title="Customer ratings and bug reports with diagnostics"
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[15.5px] sm:text-base font-semibold transition cursor-pointer ${
              activeNav === 'feedback'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Bug className="w-5.5 h-5.5" />
            <span>Feedback & Bugs</span>
          </button>

          {/* 5. Settings */}
          <button
            onClick={() => {
              setActiveNav('settings');
              setMobileMenuOpen(false);
            }}
            title="Website settings, embed code, and dangerous actions"
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[15.5px] sm:text-base font-semibold transition cursor-pointer ${
              activeNav === 'settings'
                ? 'bg-[#287170] text-white shadow-sm shadow-[#287170]/25 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings className="w-5.5 h-5.5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Site Key Card & User Footer */}
      <div className="p-4 border-t border-slate-100 space-y-3.5">
        {activeSite && (
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Site Key</div>
            <div className="font-mono text-sm text-[#287170] font-bold mt-1 truncate select-all">{activeSite.apiKey}</div>
            <div className="mt-2.5 pt-2 border-t border-slate-200">
              <button
                onClick={copyEmbedCode}
                className="w-full text-sm font-bold flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 transition cursor-pointer shadow-2xs"
              >
                {copiedSnippet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#287170]" />}
                <span>{copiedSnippet ? 'Copied script!' : 'Copy embed script'}</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 px-1">
          <div className="truncate">
            <div className="text-base font-bold text-slate-900 truncate">{user?.name}</div>
            <div className="text-xs text-slate-600 font-medium truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="text-slate-500 hover:text-rose-600 p-2.5 rounded-xl hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>
    </aside>
  );
}
