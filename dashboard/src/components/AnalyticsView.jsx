import React from 'react';

export default function AnalyticsView({ analytics = { totalPageviews: 0, uniqueVisitors: 0, topPages: [] } }) {
  return (
    <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-6 bg-slate-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs"
          title="Total recorded pageview tracking events across all pages"
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pageviews</span>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">{analytics.totalPageviews}</div>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">Total pageview events recorded</p>
        </div>
        <div 
          className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs"
          title="Unique daily visitors identified using cookieless privacy-first hashes"
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Daily Visitors</span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#287170] mt-2">{analytics.uniqueVisitors}</div>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">Daily unique visitor count</p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
        <h4 className="text-base font-bold text-slate-900 mb-4">Top Visited Pages</h4>
        {analytics.topPages && analytics.topPages.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {analytics.topPages.map((p, idx) => (
              <div key={idx} className="py-3 flex justify-between items-center" title={`${p.count} views recorded on ${p.path}`}>
                <span className="font-mono text-slate-800 text-sm font-medium">{p.path}</span>
                <span className="font-semibold text-slate-900 text-sm">{p.count} views</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 text-center py-8 font-medium">
            No analytics events recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
