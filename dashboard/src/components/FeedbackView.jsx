import React from 'react';
import { Star, Bug } from 'lucide-react';

export default function FeedbackView({ feedbacks = [], bugs = [] }) {
  return (
    <div className="p-5 sm:p-8 overflow-y-auto h-full space-y-8 bg-slate-50">
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2.5">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span>Customer Ratings & Reviews</span>
        </h3>
        {feedbacks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm font-medium">
            No feedback received yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {feedbacks.map((f) => (
              <div key={f.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center gap-1 text-amber-500" title={`Rating: ${f.rating} of 5 stars`}>
                  {[...Array(f.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-500" />
                  ))}
                </div>
                <p className="text-sm text-slate-900 mt-2 font-medium leading-relaxed">"{f.comment}"</p>
                <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex justify-between font-medium">
                  <span>{f.userEmail || 'Anonymous'}</span>
                  <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2.5">
          <Bug className="w-5 h-5 text-rose-500" />
          <span>Reported Issues</span>
        </h3>
        {bugs.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm font-medium">
            No bugs reported yet.
          </div>
        ) : (
          <div className="space-y-4">
            {bugs.map((b) => (
              <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-sm text-slate-900">{b.title}</h4>
                  <span 
                    className="text-xs bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-rose-100"
                    title={`Status: ${b.status}`}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{b.description}</p>
                <div 
                  className="mt-3 bg-slate-50 p-3 rounded-xl text-xs font-mono text-slate-600 space-y-1 border border-slate-100"
                  title="Client runtime environment diagnostics"
                >
                  <div><strong>URL:</strong> {b.url || 'N/A'}</div>
                  <div><strong>Device:</strong> {b.device || 'N/A'}</div>
                  <div className="truncate"><strong>User-Agent:</strong> {b.browser || 'N/A'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
