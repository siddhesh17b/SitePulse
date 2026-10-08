import React from 'react';

// Modern Geometric SitePulse Logo Mark
export default function SitePulseLogo({ className = "w-9 h-9" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xs">
        <defs>
          <linearGradient id="spGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#287170" />
            <stop offset="100%" stopColor="#1e5857" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#spGrad)" />
        <path
          d="M8.5 20.5H13L16 13L20.5 27L24.5 16.5L27 20.5H31.5"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20.5" cy="27" r="2" fill="#ffffff" />
      </svg>
    </div>
  );
}
