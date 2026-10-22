import React from 'react';
import {
  Globe,
  RefreshCw,
  Check,
  Lock,
  Trash2,
  MessageSquareX
} from 'lucide-react';

export function ChangeDomainModal({
  changeDomainModal,
  setChangeDomainModal,
  activeSite,
  handleConfirmChangeDomain,
}) {
  if (!changeDomainModal.open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 w-full max-w-md p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Change Domain URL</h3>
            <p className="text-xs text-slate-500 font-medium">Danger Zone: Update website authorization domain</p>
          </div>
        </div>

        {changeDomainModal.error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm font-medium text-rose-700">
            {changeDomainModal.error}
          </div>
        )}

        <form onSubmit={handleConfirmChangeDomain} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Current Domain
            </label>
            <div className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-700">
              {activeSite?.domain}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              New Domain / URL
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. store.com or localhost:3000"
              value={changeDomainModal.domain}
              onChange={(e) => setChangeDomainModal(prev => ({ ...prev, domain: e.target.value }))}
              className="w-full text-sm font-mono font-medium px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#287170] focus:ring-1 focus:ring-[#287170]/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setChangeDomainModal({ open: false, domain: '', error: '', loading: false })}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeDomainModal.loading}
              className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {changeDomainModal.loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Domain</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewSiteModal({
  showNewSiteModal,
  setShowNewSiteModal,
  newSiteForm,
  setNewSiteForm,
  handleCreateSite,
}) {
  if (!showNewSiteModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-7">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900">Add New Website</h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">Register a domain to generate an embed key.</p>

        <form onSubmit={handleCreateSite} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website Name</label>
            <input
              type="text"
              required
              placeholder="e.g. My Online Store"
              value={newSiteForm.name}
              onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#287170] focus:ring-1 focus:ring-[#287170]/20"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Domain</label>
            <input
              type="text"
              required
              placeholder="e.g. store.com or localhost:3000"
              value={newSiteForm.domain}
              onChange={(e) => setNewSiteForm({ ...newSiteForm, domain: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-900 focus:outline-none focus:border-[#287170] focus:ring-1 focus:ring-[#287170]/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowNewSiteModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold bg-[#287170] hover:bg-[#205d5c] text-white rounded-xl shadow-xs transition cursor-pointer"
            >
              Add Website
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DeleteSiteModal({
  deleteSiteModal,
  setDeleteSiteModal,
  handleConfirmDeleteSite,
}) {
  if (!deleteSiteModal.open || !deleteSiteModal.site) return null;

  return (
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
  );
}

export function DeleteChatsModal({
  deleteChatsModal,
  setDeleteChatsModal,
  handleConfirmDeleteChats,
}) {
  if (!deleteChatsModal.open || !deleteChatsModal.site) return null;

  return (
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
  );
}
