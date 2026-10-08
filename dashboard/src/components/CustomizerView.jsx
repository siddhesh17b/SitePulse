import React from 'react';
import { Check } from 'lucide-react';
import { getContrastColors } from '../utils/colors';

export default function CustomizerView({
  settings,
  setSettings,
  handleSaveSettings,
  savingSettings,
  saveSuccess
}) {
  const previewContrast = getContrastColors(settings.primaryColor);

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden min-w-0">
      <div className="w-full lg:w-[440px] xl:w-[480px] border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-6 sm:p-8 overflow-y-visible lg:overflow-y-auto space-y-7 shrink-0">
        <div>
          <h3 className="text-base font-bold text-slate-900">Brand Color</h3>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="color"
              value={settings.primaryColor}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              className="w-11 h-11 p-0 rounded-xl cursor-pointer border border-slate-200"
              title="Select primary brand accent color"
            />
            <input
              type="text"
              value={settings.primaryColor}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              className="font-mono text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl w-32 text-slate-800 font-medium focus:outline-none focus:border-[#287170]"
              title="Hex color code"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Titles & Greetings</h3>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Widget Title</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#287170]"
              title="Main header title displayed inside the widget"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subtitle</label>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#287170]"
              title="Secondary subtitle text in the widget header"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Greeting Message</label>
            <textarea
              value={settings.greeting}
              onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#287170]"
              title="Initial welcome message displayed to visitors opening chat"
            />
          </div>
        </div>

        <div className="space-y-3.5">
          <h3 className="text-base font-bold text-slate-900">Features</h3>
          <label className="flex items-center gap-3 cursor-pointer" title="Enable real-time messaging between visitors and operators">
            <input
              type="checkbox"
              checked={settings.enableChat}
              onChange={(e) => setSettings({ ...settings, enableChat: e.target.checked })}
              className="w-4 h-4 accent-[#287170] rounded cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-800">Enable Live Chat</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer" title="Allow visitors to submit 1-to-5 star feedback ratings">
            <input
              type="checkbox"
              checked={settings.enableFeedback}
              onChange={(e) => setSettings({ ...settings, enableFeedback: e.target.checked })}
              className="w-4 h-4 accent-[#287170] rounded cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-800">Enable Feedback Rating</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer" title="Allow visitors to submit bug reports with client runtime diagnostics">
            <input
              type="checkbox"
              checked={settings.enableBugReport}
              onChange={(e) => setSettings({ ...settings, enableBugReport: e.target.checked })}
              className="w-4 h-4 accent-[#287170] rounded cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-800">Enable Bug Reporting</span>
          </label>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="w-full bg-[#287170] hover:bg-[#205d5c] text-white font-semibold py-2.5 rounded-xl text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          title="Save widget branding, titles, and feature configuration"
        >
          <Check className="w-4 h-4" />
          <span>{savingSettings ? 'Saving...' : (saveSuccess ? 'Changes Saved' : 'Save Changes')}</span>
        </button>
      </div>

      {/* Live Preview */}
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
    </div>
  );
}
