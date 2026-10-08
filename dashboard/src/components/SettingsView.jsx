import React from 'react';
import {
  Globe,
  HelpCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Check,
  Key,
  Copy,
  Code2,
  Layers,
  AlertTriangle,
  MessageSquareX,
  Trash2
} from 'lucide-react';

export default function SettingsView({
  activeSite,
  BACKEND_URL,
  siteDetailsForm,
  setSiteDetailsForm,
  siteDetailsMessage,
  setSiteDetailsMessage,
  savingSiteDetails,
  handleUpdateSiteName,
  copiedSnippet,
  copyEmbedCode,
  setActiveNav,
  promptChangeDomain,
  promptDeleteChats,
  promptDeleteSite,
}) {
  return (
    <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6 max-w-4xl bg-slate-50">
      {/* Property Details (Name only, Domain moved to Danger Zone) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#287170]/10 text-[#287170] flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Website Details</h3>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Manage your website display name"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>
        </div>

        <form onSubmit={handleUpdateSiteName} className="space-y-4 pt-1">
          {siteDetailsMessage && (
            <div className={`p-3 px-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
              siteDetailsMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {siteDetailsMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                <span>{siteDetailsMessage.text}</span>
              </div>
              <button type="button" onClick={() => setSiteDetailsMessage(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Website Name
              </label>
              <input
                type="text"
                required
                value={siteDetailsForm.name}
                onChange={(e) => setSiteDetailsForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. My Online Store"
                className="w-full text-sm font-medium text-slate-900 bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#287170] focus:ring-1 focus:ring-[#287170]/20"
                title="The display name of your website property"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Registered Domain
                </label>
                <span 
                  className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                  title="Domain URL modifications are managed in the Danger Zone"
                >
                  Protected
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={activeSite?.domain}
                  className="w-full text-sm font-mono font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl cursor-not-allowed select-all"
                  title="To modify this domain URL, use the Change Domain action in the Danger Zone below"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <span>To change this domain, use</span>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('danger-zone-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[#287170] hover:underline font-semibold cursor-pointer"
                  title="Scroll to Danger Zone"
                >
                  Danger Zone below ↓
                </button>
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingSiteDetails}
              className="px-5 py-2.5 bg-[#287170] hover:bg-[#205d5c] text-white text-sm font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Save updated website name"
            >
              {savingSiteDetails ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Name</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Site Key Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#287170]/10 text-[#287170] flex items-center justify-center">
            <Key className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Site Key</h3>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Embedded in your client-side website code to authenticate the widget"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={activeSite?.apiKey}
            className="flex-1 bg-slate-50 border border-slate-200 font-mono text-sm px-3.5 py-2.5 rounded-xl text-slate-900 font-semibold select-all"
            title="Your public site key"
          />
          <button
            onClick={copyEmbedCode}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Copy public API key to clipboard"
          >
            {copiedSnippet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#287170]" />}
            <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Embed Script Integration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#287170]/10 text-[#287170] flex items-center justify-center">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">HTML Embed Script</h3>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Insert this single line right before the closing </body> tag on your website"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl font-mono text-sm overflow-x-auto leading-relaxed select-all">
            {`<script src="${BACKEND_URL}/sitepulse.js" data-site-key="${activeSite?.apiKey}" defer></script>`}
          </pre>
          <button
            onClick={copyEmbedCode}
            className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 border border-slate-200 shadow-xs cursor-pointer"
            title="Copy HTML embed script tag"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#287170]" />}
            <span>{copiedSnippet ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <Layers className="w-4 h-4 text-[#287170]" />
            <span>Configure page targeting and display rules</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('page-rules')}
            className="text-[#287170] hover:text-[#205d5c] font-bold flex items-center gap-1 cursor-pointer"
            title="Open Page Rules & Display settings"
          >
            <span>Page Rules →</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Sensitive & Destructive Actions */}
      <div id="danger-zone-section" className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-rose-100 bg-rose-50/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Danger Zone</h3>
          </div>
          <span 
            className="text-xs font-semibold text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-full"
            title="Actions in this section can alter domain origin security or permanently erase data"
          >
            Sensitive & Irreversible
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Action 1: Change Domain URL */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/20">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">Change Domain URL</h4>
                <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {activeSite?.domain}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Update the authorized domain for this site. The embed widget will validate and run on the new domain.
              </p>
            </div>
            <button
              type="button"
              onClick={promptChangeDomain}
              className="px-4 py-2 border border-amber-300 hover:border-amber-400 bg-white hover:bg-amber-50 text-amber-900 font-semibold rounded-xl text-sm transition flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs"
              title="Change the registered domain for this website property"
            >
              <Globe className="w-4 h-4 text-amber-700" />
              <span>Change Domain</span>
            </button>
          </div>

          {/* Action 2: Delete All Chats */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Clear Conversations</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Permanently clear all visitor conversation threads and messages for this site. Feedback and analytics remain intact.
              </p>
            </div>
            <button
              type="button"
              onClick={() => promptDeleteChats(activeSite)}
              className="px-4 py-2 border border-slate-300 hover:border-rose-300 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-semibold rounded-xl text-sm transition flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs"
              title="Permanently remove all visitor messages and chat sessions"
            >
              <MessageSquareX className="w-4 h-4 text-rose-500" />
              <span>Clear Chats</span>
            </button>
          </div>

          {/* Action 3: Delete Entire Website Property */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-rose-50/25">
            <div>
              <h4 className="text-sm font-semibold text-rose-950">Delete Website Property</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Permanently delete <strong className="text-slate-800">{activeSite?.name}</strong> ({activeSite?.domain}) and all associated data, settings, and metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={() => promptDeleteSite(activeSite)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition flex items-center gap-2 shrink-0 shadow-xs cursor-pointer"
              title="Permanently erase this website and all associated records"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Website</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
