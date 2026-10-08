import React from 'react';
import { User as UserIcon, Mail, Lock } from 'lucide-react';
import SitePulseLogo from './SitePulseLogo';

export default function AuthView({
  authLoading,
  user,
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  authForm,
  setAuthForm,
  handleAuthSubmit
}) {
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

  if (user) return null;

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
