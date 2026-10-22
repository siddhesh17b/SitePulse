import React from 'react';
import {
  HelpCircle,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Check
} from 'lucide-react';

export default function PageRulesView({
  activeSite,
  pageRules,
  setPageRules,
  discoveredPages = [],
  pageSearchQuery,
  setPageSearchQuery,
  handleScanWebsite,
  scanningSite,
  scanMessage,
  setScanMessage,
  handleBulkSetRules,
  handleTogglePageRule,
  handleRemovePageRule,
  customPatternInput,
  setCustomPatternInput,
  customPatternAction,
  setCustomPatternAction,
  handleAddCustomPattern,
  pageRulesSaved,
  handleSavePageRules,
  savingPageRules,
}) {
  const filteredPages = discoveredPages.filter(
    (p) => !pageSearchQuery || p.path.toLowerCase().includes(pageSearchQuery.toLowerCase())
  );

  return (
    <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6 max-w-5xl bg-slate-50">
      {/* 1. Global Widget Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900">Page Targeting</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-[#287170]/10 text-[#287170]">
              {activeSite?.name}
            </span>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Control which pages display the SitePulse widget across your website without editing code"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>

          {/* Master Widget Switch */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shrink-0">
            <span className="text-sm font-semibold text-slate-700">
              {pageRules.enabled !== false ? 'Widget Active' : 'Widget Disabled'}
            </span>
            <button
              type="button"
              onClick={() => setPageRules(prev => ({ ...prev, enabled: prev.enabled === false }))}
              title={pageRules.enabled !== false ? "Widget is enabled site-wide. Click to disable." : "Widget is disabled everywhere. Click to enable."}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                pageRules.enabled !== false ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-sm transform transition" />
            </button>
          </div>
        </div>

        {/* 2. Default Policy Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-800">Default Visibility</label>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Determine whether new or unlisted URLs automatically show or hide the widget"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setPageRules(prev => ({ ...prev, defaultPolicy: 'allow' }))}
              title="Widget appears on all pages unless you explicitly add a rule to hide it below."
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                pageRules.defaultPolicy !== 'block'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${pageRules.defaultPolicy !== 'block' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>Show by Default</span>
            </button>

            <button
              type="button"
              onClick={() => setPageRules(prev => ({ ...prev, defaultPolicy: 'block' }))}
              title="Widget is hidden across your site and only appears on pages you explicitly allow."
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                pageRules.defaultPolicy === 'block'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${pageRules.defaultPolicy === 'block' ? 'bg-rose-500' : 'bg-slate-300'}`} />
              <span>Hide by Default (Whitelist)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Discovered Pages Table & Scanner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900">Pages & Paths</h3>
            <span className="text-xs bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
              {filteredPages.length}
            </span>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Auto-detected via website crawler and visitor traffic"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter paths..."
                value={pageSearchQuery}
                onChange={(e) => setPageSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#287170] w-44 sm:w-56 font-medium shadow-2xs"
              />
            </div>

            {/* Crawler Scan Button */}
            <button
              type="button"
              onClick={handleScanWebsite}
              disabled={scanningSite}
              className="px-4 py-2 bg-[#287170] hover:bg-[#205d5c] text-white text-sm font-semibold rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningSite ? 'animate-spin' : ''}`} />
              <span>{scanningSite ? 'Scanning...' : 'Scan Website'}</span>
            </button>

            {/* Bulk Action Buttons */}
            {discoveredPages.length > 1 && (
              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                <button
                  type="button"
                  onClick={() => handleBulkSetRules(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
                  title="Show widget on all discovered pages"
                >
                  Enable All
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetRules(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
                  title="Hide widget on all discovered pages"
                >
                  Disable All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scan Feedback Banner */}
        {scanMessage && (
          <div className={`p-3 px-5 text-sm font-medium flex items-center justify-between border-b ${
            scanMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
              : 'bg-rose-50 text-rose-800 border-rose-100'
          }`}>
            <span>{scanMessage.text}</span>
            <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
          </div>
        )}

        {/* Pages Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 tracking-wider">
                <th className="py-3 px-5">Path / Page</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Rule</th>
                <th className="py-3 px-5 text-right">Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 text-sm">
                    {pageSearchQuery ? 'No paths match your filter.' : 'No pages discovered yet. Click "Scan Website" to crawl your domain.'}
                  </td>
                </tr>
              ) : (
                filteredPages.map((item) => {
                  const path = item.path;
                  const isExplicit = pageRules.rules?.[path] !== undefined;
                  const isAllowed = isExplicit 
                    ? Boolean(pageRules.rules[path])
                    : pageRules.defaultPolicy !== 'block';

                  return (
                    <tr key={path} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
                            {path}
                          </span>
                          {path === '/' && (
                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Home
                            </span>
                          )}
                          {item.views > 0 && (
                            <span className="text-xs text-slate-500 font-medium">
                              ({item.views} {item.views === 1 ? 'view' : 'views'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.source === 'traffic' ? (
                          <span 
                            className="inline-flex items-center text-xs font-medium text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100"
                            title="Discovered from real visitor page views"
                          >
                            Traffic
                          </span>
                        ) : item.source === 'crawler' ? (
                          <span 
                            className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100"
                            title="Discovered from website crawler"
                          >
                            Crawler
                          </span>
                        ) : item.source === 'custom_rule' ? (
                          <span 
                            className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100"
                            title="Custom wildcard or path pattern"
                          >
                            Pattern
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            Root
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium">
                        {isExplicit ? (
                          <span className="text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Override</span>
                        ) : (
                          <span className="text-slate-500 font-medium">Default</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePageRule(path)}
                            title={isAllowed ? "Click to hide widget on this path" : "Click to show widget on this path"}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                              isAllowed
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isAllowed ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                                <span>Hidden</span>
                              </>
                            )}
                          </button>
                          {(isExplicit || item.source === 'custom_rule') && (
                            <button
                              type="button"
                              onClick={() => handleRemovePageRule(path, item.source === 'custom_rule')}
                              title={item.source === 'custom_rule' ? "Delete custom rule" : "Reset override to default"}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Add Custom Wildcard / Pattern Rule */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Add Pattern Rule</h3>
            <span 
              className="text-slate-400 hover:text-slate-600 cursor-help"
              title="Pre-emptively show or hide the widget on specific paths or patterns (e.g. /checkout/*, /admin/*)"
            >
              <HelpCircle className="w-4 h-4" />
            </span>
          </div>
        </div>

        <form onSubmit={handleAddCustomPattern} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="e.g. /checkout/* or /login or *.html"
              value={customPatternInput}
              onChange={(e) => setCustomPatternInput(e.target.value)}
              className="w-full font-mono text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#287170] font-medium"
            />
          </div>
          <select
            value={customPatternAction}
            onChange={(e) => setCustomPatternAction(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#287170] cursor-pointer"
          >
            <option value="block">Hide Widget</option>
            <option value="allow">Show Widget</option>
          </select>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Pattern</span>
          </button>
        </form>

        {/* Quick suggestion chips */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Examples:</span>
          {['/checkout/*', '/admin/*', '/login', '/pricing', '*.html'].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setCustomPatternInput(chip)}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs cursor-pointer transition border border-slate-200/60"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Save Rules Bar */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-md p-3.5 px-5 flex items-center justify-between gap-3">
        <div className="text-xs sm:text-sm font-medium text-slate-600">
          {pageRulesSaved ? (
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Rules saved</span>
            </span>
          ) : (
            <span>Configure page rules and save when ready.</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSavePageRules}
          disabled={savingPageRules}
          className="px-5 py-2 bg-[#287170] hover:bg-[#205d5c] text-white text-sm font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          {savingPageRules ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save Rules</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
