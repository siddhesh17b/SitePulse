/**
 * SitePulse Embeddable Widget
 * Integrated Real-time Chat, Feedback, Bug Reporting & Privacy Analytics
 */
(function () {
  'use strict';

  // Prevent multiple initializations
  if (window.__SitePulseLoaded) return;
  window.__SitePulseLoaded = true;

  // 1. Determine configuration and backend base URL
  const scriptTag = document.currentScript || document.querySelector('script[data-site-key]');
  const siteKey = scriptTag ? scriptTag.getAttribute('data-site-key') : (window.SitePulseConfig && window.SitePulseConfig.siteKey);

  if (!siteKey) {
    console.error('[SitePulse] Error: Missing data-site-key attribute on script tag.');
    return;
  }

  // Derive backend URL from script source or fallback to origin
  let backendUrl = 'http://localhost:5000';
  if (scriptTag && scriptTag.src) {
    try {
      const url = new URL(scriptTag.src);
      backendUrl = url.origin;
    } catch (e) {
      backendUrl = 'http://localhost:5000';
    }
  }

  // 2. Chat Session Management
  // Immediately purge any legacy visitor credentials from localStorage so visitors are never automatically logged in
  try {
    localStorage.removeItem('sitepulse_visitor_email');
    localStorage.removeItem('sitepulse_visitor_name');
    localStorage.removeItem('sitepulse_external_id');
    localStorage.removeItem('sitepulse_visitor_id');
  } catch (e) {}

  // Generate or retrieve session-scoped chat session ID (persists across reloads in the same tab, but clears on browser/tab close)
  function getChatSessionId() {
    try {
      let sid = sessionStorage.getItem('sitepulse_chat_session_id');
      if (!sid) {
        sid = 'cs_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        sessionStorage.setItem('sitepulse_chat_session_id', sid);
      }
      return sid;
    } catch (e) {
      return 'cs_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    }
  }

  let visitorId = getChatSessionId();
  let visitorEmail = '';
  let visitorName = '';
  let externalId = '';

  try {
    visitorEmail = sessionStorage.getItem('sitepulse_visitor_email') || '';
    visitorName = sessionStorage.getItem('sitepulse_visitor_name') || '';
    externalId = sessionStorage.getItem('sitepulse_external_id') || '';
  } catch (e) {}

  // Capture early queue if SitePulse was called before script loaded
  const preQueue = (window.SitePulse && window.SitePulse._q) || (Array.isArray(window.SitePulse) ? window.SitePulse : []);
  if (window.SitePulse && typeof window.SitePulse === 'object' && window.SitePulse._pendingUser) {
    const pu = window.SitePulse._pendingUser;
    if (pu.email) visitorEmail = pu.email;
    if (pu.name) visitorName = pu.name;
    if (pu.userId) externalId = String(pu.userId);
  }

  // 3. Passive Privacy-Preserving Analytics Tracking
  function trackPageView() {
    try {
      const payload = {
        siteKey: siteKey,
        pathname: window.location.pathname + window.location.search,
        referrer: document.referrer || null,
        browser: navigator.userAgentData ? navigator.userAgentData.brands?.[0]?.brand : 'Browser',
        os: navigator.platform || 'Unknown',
        deviceType: window.innerWidth < 768 ? 'mobile' : (window.innerWidth < 1024 ? 'tablet' : 'desktop')
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon(backendUrl + '/api/v1/events', JSON.stringify(payload));
      } else {
        fetch(backendUrl + '/api/v1/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  }
  trackPageView();
  window.addEventListener('popstate', trackPageView);

  // 4. Fetch Widget Settings & Render
  let widgetSettings = {
    primaryColor: '#000000',
    title: 'SitePulse Support',
    subtitle: 'Ask us anything or leave feedback',
    greeting: 'Hi there! How can we help you today?',
    position: 'right',
    enableChat: true,
    enableFeedback: true,
    enableBugReport: true,
    requireEmail: true
  };

  fetch(`${backendUrl}/api/v1/widget/config?key=${siteKey}`)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.settings) {
        widgetSettings = { ...widgetSettings, ...data.settings };
      }
      initWidget();
    })
    .catch((err) => {
      console.warn('[SitePulse] Using default settings:', err);
      initWidget();
    });

  // State management
  let isOpen = false;
  let activeTab = 'chat';
  let conversation = null;
  let socket = null;
  let unreadCount = 0;
  let shadowRoot = null;

  function initWidget() {
    if (widgetSettings.enableChat) activeTab = 'chat';
    else if (widgetSettings.enableFeedback) activeTab = 'feedback';
    else if (widgetSettings.enableBugReport) activeTab = 'bug';

    const container = document.createElement('div');
    container.id = 'sitepulse-widget-root';
    document.body.appendChild(container);
    shadowRoot = container.attachShadow({ mode: 'open' });

    renderWidgetDOM();
    injectStyles();

    if (widgetSettings.enableChat) {
      loadSocketIO(() => {
        // Only auto-connect if user is already identified or has an active chat session in this tab
        let isChatActive = false;
        try { isChatActive = sessionStorage.getItem('sitepulse_chat_active') === 'true'; } catch (e) {}
        if (visitorEmail || externalId || isChatActive) {
          setupRealtimeChat();
        }
      });
    }
  }

  function getContrastColors(hexColor) {
    let hex = (hexColor || '#000000').replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const isLight = yiq >= 170;

    return {
      isLight,
      text: isLight ? '#0f172a' : '#ffffff',
      textMuted: isLight ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.88)',
      launcherBorder: isLight ? '1px solid #cbd5e1' : 'none',
      headerBorder: isLight ? '1px solid #e2e8f0' : 'none',
      activeTab: isLight ? '#0f172a' : (hexColor || '#000000'),
      closeBtnBg: isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.14)',
      closeBtnHover: isLight ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.28)',
      bubbleBorder: isLight ? '1px solid #cbd5e1' : 'none',
      submitBorder: isLight ? '1px solid #cbd5e1' : 'none',
      sendBtnBorder: isLight ? '1px solid #cbd5e1' : 'none',
      metaColor: isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.75)'
    };
  }

  function injectStyles() {
    const isLeft = widgetSettings.position === 'left';
    const primary = widgetSettings.primaryColor || '#000000';
    const contrast = getContrastColors(primary);

    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }

      .sp-launcher {
        position: fixed;
        bottom: 24px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: ${primary};
        color: ${contrast.text};
        border: ${contrast.launcherBorder};
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.12);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        z-index: 2147483647;
      }

      .sp-launcher:hover {
        transform: scale(1.06);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.24);
      }

      .sp-launcher svg {
        width: 28px;
        height: 28px;
        fill: ${contrast.text};
        transition: transform 0.2s ease;
      }

      .sp-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #ef4444;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
      }

      .sp-window {
        position: fixed;
        bottom: 96px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        width: 380px;
        max-width: calc(100vw - 48px);
        height: 560px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 2147483646;
        animation: spFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .sp-window.open {
        display: flex;
      }

      @keyframes spFadeIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Header */
      .sp-header {
        background-color: ${primary};
        color: ${contrast.text};
        border-bottom: ${contrast.headerBorder};
        padding: 18px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sp-header-info h3 {
        font-size: 18px;
        font-weight: 700;
        color: ${contrast.text};
      }

      .sp-header-info p {
        font-size: 14px;
        color: ${contrast.textMuted};
        margin-top: 3px;
        font-weight: 500;
      }

      .sp-close-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${contrast.closeBtnBg};
        border: none;
        color: ${contrast.text};
        cursor: pointer;
        transition: background 0.15s ease, transform 0.1s ease;
        padding: 0;
      }
      .sp-close-btn:hover {
        opacity: 1;
        background: ${contrast.closeBtnHover};
        transform: scale(1.05);
      }
      .sp-close-btn svg {
        width: 18px;
        height: 18px;
        stroke: ${contrast.text};
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
      }

      /* Tab Nav */
      .sp-nav {
        display: flex;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .sp-tab-btn {
        flex: 1;
        padding: 12px 10px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: 14.5px;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .sp-tab-btn.active {
        color: ${contrast.activeTab};
        border-bottom-color: ${contrast.activeTab};
        background: #ffffff;
        font-weight: 700;
      }

      /* Content Area */
      .sp-content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .sp-tab-panel {
        display: none;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }

      .sp-tab-panel.active {
        display: flex;
      }

      #sp-panel-feedback,
      #sp-panel-bug {
        overflow-y: auto;
      }

      /* Chat Top Banner & Reset Button */
      .sp-chat-top-banner {
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        padding: 7px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #64748b;
        flex-shrink: 0;
      }

      .sp-visitor-tag {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 190px;
      }

      .sp-end-chat-link {
        background: none;
        border: none;
        color: #ef4444;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.15s ease;
      }
      .sp-end-chat-link:hover {
        background: #fee2e2;
        color: #b91c1c;
      }

      /* Chat Panel & Email Gate */
      .sp-email-gate {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #ffffff;
        z-index: 10;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 28px 24px;
        text-align: center;
      }

      .sp-gate-card h4 {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 6px;
      }

      .sp-gate-card p {
        font-size: 12.5px;
        color: #64748b;
        margin-bottom: 18px;
        line-height: 1.45;
      }

      .sp-gate-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-align: left;
      }

      .sp-chat-messages {
        flex: 1;
        min-height: 0;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: #f8fafc;
      }

      .sp-msg {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.45;
        word-break: break-word;
      }

      .sp-msg.visitor {
        align-self: flex-end;
        background-color: ${primary};
        color: ${contrast.text};
        border: ${contrast.bubbleBorder};
        border-bottom-right-radius: 4px;
      }

      .sp-msg.agent {
        align-self: flex-start;
        background-color: #ffffff;
        color: #1e293b;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 4px;
      }

      .sp-msg-meta {
        font-size: 10px;
        opacity: 0.75;
        margin-top: 4px;
        text-align: right;
      }
      .sp-msg.visitor .sp-msg-meta {
        color: ${contrast.metaColor};
      }

      .sp-typing {
        font-size: 11px;
        color: #64748b;
        font-style: italic;
        padding: 4px 16px;
        display: none;
      }

      .sp-chat-input-bar {
        padding: 12px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .sp-chat-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        font-size: 13px;
        outline: none;
      }
      .sp-chat-input:focus {
        border-color: ${contrast.activeTab};
      }

      .sp-send-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background-color: ${primary};
        color: ${contrast.text};
        border: ${contrast.sendBtnBorder};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease;
      }
      .sp-send-btn:hover {
        transform: scale(1.05);
      }
      .sp-send-btn svg {
        fill: ${contrast.text};
      }

      /* Feedback & Bug Panels */
      .sp-form-panel {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .sp-form-panel label {
        font-size: 12.5px;
        font-weight: 600;
        color: #334155;
      }

      .sp-star-rating {
        display: flex;
        gap: 8px;
        font-size: 26px;
        cursor: pointer;
      }
      .sp-star {
        color: #cbd5e1;
        transition: color 0.15s;
      }
      .sp-star.selected, .sp-star:hover, .sp-star.hovered {
        color: #f59e0b;
      }

      .sp-input, .sp-textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13px;
        outline: none;
      }
      .sp-input:focus, .sp-textarea:focus {
        border-color: ${contrast.activeTab};
      }

      .sp-textarea {
        min-height: 90px;
        resize: vertical;
      }

      .sp-submit-btn {
        background-color: ${primary};
        color: ${contrast.text};
        border: ${contrast.submitBorder};
        border-radius: 8px;
        padding: 11px;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .sp-submit-btn:hover {
        opacity: 0.92;
      }

      .sp-guest-btn {
        background: transparent;
        color: #64748b;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        padding: 9px;
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        margin-top: 4px;
      }
      .sp-guest-btn:hover {
        background: #f1f5f9;
        color: #334155;
        border-color: #94a3b8;
      }

      .sp-success-msg {
        display: none;
        padding: 20px;
        text-align: center;
        color: #16a34a;
        font-weight: 500;
        font-size: 14px;
      }

      .sp-diagnostic-tag {
        font-size: 11px;
        background: #f1f5f9;
        color: #64748b;
        padding: 8px 10px;
        border-radius: 6px;
        border-left: 3px solid ${contrast.activeTab};
        line-height: 1.4;
      }
    `;
    shadowRoot.appendChild(style);
  }

  function renderWidgetDOM() {
    const launcher = document.createElement('div');
    launcher.className = 'sp-launcher';
    launcher.id = 'sp-launcher';
    launcher.setAttribute('aria-label', 'Open support chat');
    launcher.innerHTML = `
      <svg id="sp-icon-chat" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
      <div class="sp-badge" id="sp-badge" style="display: none;">0</div>
    `;
    launcher.addEventListener('click', toggleWidget);

    const windowDiv = document.createElement('div');
    windowDiv.className = 'sp-window';
    windowDiv.id = 'sp-window';

    windowDiv.innerHTML = `
      <div class="sp-header">
        <div class="sp-header-info">
          <h3 id="sp-title">${escapeHTML(widgetSettings.title)}</h3>
          <p id="sp-subtitle">${escapeHTML(widgetSettings.subtitle)}</p>
        </div>
        <button class="sp-close-btn" id="sp-close-btn" title="Close" aria-label="Close chat">
          <svg viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="sp-nav">
        ${widgetSettings.enableChat ? '<button class="sp-tab-btn active" data-tab="chat">💬 Chat</button>' : ''}
        ${widgetSettings.enableFeedback ? '<button class="sp-tab-btn" data-tab="feedback">⭐ Feedback</button>' : ''}
        ${widgetSettings.enableBugReport ? '<button class="sp-tab-btn" data-tab="bug">🐞 Bug Report</button>' : ''}
      </div>

      <div class="sp-content">
        <!-- 1. Chat Tab Panel -->
        <div class="sp-tab-panel active" id="sp-panel-chat">
          <!-- Active Session Banner & Reset Option -->
          <div class="sp-chat-top-banner" id="sp-chat-banner" style="display: ${(visitorEmail || externalId || (sessionStorage.getItem('sitepulse_chat_active') === 'true')) ? 'flex' : 'none'};">
            <span class="sp-visitor-tag" id="sp-visitor-tag">Chatting as: <strong>${escapeHTML(visitorName ? (visitorEmail ? `${visitorName} (${visitorEmail})` : visitorName) : (visitorEmail || externalId || 'Visitor'))}</strong></span>
            <button type="button" class="sp-end-chat-link" id="sp-end-chat-btn">End Conversation / Not you?</button>
          </div>

          <!-- Email Gate (bypassed only if actively identified in this session) -->
          <div class="sp-email-gate" id="sp-email-gate" style="display: ${(visitorEmail || externalId || (sessionStorage.getItem('sitepulse_chat_active') === 'true')) ? 'none' : 'flex'};">
            <div class="sp-gate-card">
              <div style="font-size: 32px; margin-bottom: 8px;">💬</div>
              <h4>Start a Conversation</h4>
              <p>Please enter your email so our support team can assist you.</p>
              <form class="sp-gate-form" id="sp-gate-form">
                <div>
                  <label style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 3px;">Your Name (optional):</label>
                  <input type="text" class="sp-input" id="sp-gate-name" placeholder="e.g. Alex Smith" />
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 3px;">Email Address *:</label>
                  <input type="email" class="sp-input" id="sp-gate-email" placeholder="name@example.com" required />
                </div>
                <button type="submit" class="sp-submit-btn" style="margin-top: 6px;">Continue to Chat</button>
                <button type="button" class="sp-guest-btn" id="sp-gate-guest-btn">Or chat as Guest</button>
              </form>
            </div>
          </div>

          <div class="sp-chat-messages" id="sp-chat-messages">
            <div class="sp-msg agent">
              ${escapeHTML(widgetSettings.greeting)}
              <div class="sp-msg-meta">Support Team</div>
            </div>
          </div>
          <div class="sp-typing" id="sp-typing">Agent is typing...</div>
          <div class="sp-chat-input-bar">
            <input type="text" class="sp-chat-input" id="sp-chat-input" placeholder="Type your message..." />
            <button class="sp-send-btn" id="sp-send-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 2. Feedback Tab Panel -->
        <div class="sp-tab-panel" id="sp-panel-feedback">
          <form class="sp-form-panel" id="sp-feedback-form">
            <label>Rate your experience:</label>
            <div class="sp-star-rating" id="sp-star-rating">
              <span class="sp-star" data-rating="1">★</span>
              <span class="sp-star" data-rating="2">★</span>
              <span class="sp-star" data-rating="3">★</span>
              <span class="sp-star" data-rating="4">★</span>
              <span class="sp-star" data-rating="5">★</span>
            </div>
            <label>Tell us what you think:</label>
            <textarea class="sp-textarea" id="sp-feedback-text" placeholder="What did you like or what can we improve?" required></textarea>
            <label>Your Email (optional):</label>
            <input type="email" class="sp-input" id="sp-feedback-email" placeholder="name@example.com" value="${visitorEmail}" />
            <button type="submit" class="sp-submit-btn">Send Feedback</button>
          </form>
          <div class="sp-success-msg" id="sp-feedback-success">
            🎉 Thank you for your feedback! It helps us improve.
          </div>
        </div>

        <!-- 3. Bug Report Tab Panel -->
        <div class="sp-tab-panel" id="sp-panel-bug">
          <form class="sp-form-panel" id="sp-bug-form">
            <label>Issue Summary:</label>
            <input type="text" class="sp-input" id="sp-bug-title" placeholder="e.g. Checkout button unresponsive" required />
            <label>Description & Steps to reproduce:</label>
            <textarea class="sp-textarea" id="sp-bug-desc" placeholder="What happened? What did you expect to happen?" required></textarea>
            <label>Your Email (optional):</label>
            <input type="email" class="sp-input" id="sp-bug-email" placeholder="name@example.com" value="${visitorEmail}" />
            
            <div class="sp-diagnostic-tag">
              ℹ️ Current URL & device diagnostic info will be automatically attached to help resolve this faster.
            </div>

            <button type="submit" class="sp-submit-btn">Submit Bug Report</button>
          </form>
          <div class="sp-success-msg" id="sp-bug-success">
            🛠️ Bug report submitted! Our team will investigate.
          </div>
        </div>
      </div>
    `;

    shadowRoot.appendChild(launcher);
    shadowRoot.appendChild(windowDiv);

    // Event Listeners for UI
    shadowRoot.getElementById('sp-close-btn').addEventListener('click', toggleWidget);

    // Tab buttons
    const tabBtns = shadowRoot.querySelectorAll('.sp-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // Chat Send
    const sendBtn = shadowRoot.getElementById('sp-send-btn');
    const input = shadowRoot.getElementById('sp-chat-input');
    sendBtn.addEventListener('click', handleSendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSendMessage();
    });

    // Typing indicator from visitor
    let visitorTypingTimeout = null;
    input.addEventListener('input', () => {
      if (socket && conversation && conversation.id) {
        socket.emit('typing', { conversationId: conversation.id, senderType: 'visitor', isTyping: true });
        clearTimeout(visitorTypingTimeout);
        visitorTypingTimeout = setTimeout(() => {
          socket.emit('typing', { conversationId: conversation.id, senderType: 'visitor', isTyping: false });
        }, 1200);
      }
    });

    // Email Gate submission
    const gateForm = shadowRoot.getElementById('sp-gate-form');
    if (gateForm) {
      gateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = shadowRoot.getElementById('sp-gate-email');
        const nameInput = shadowRoot.getElementById('sp-gate-name');
        const emailVal = emailInput.value.trim();
        const nameVal = nameInput.value.trim();
        if (!emailVal) return;

        visitorEmail = emailVal;
        visitorName = nameVal;
        try {
          sessionStorage.setItem('sitepulse_visitor_email', visitorEmail);
          if (visitorName) sessionStorage.setItem('sitepulse_visitor_name', visitorName);
          sessionStorage.setItem('sitepulse_chat_active', 'true');
        } catch (err) {}

        // Hide gate and show banner
        shadowRoot.getElementById('sp-email-gate').style.display = 'none';
        const banner = shadowRoot.getElementById('sp-chat-banner');
        const visitorTag = shadowRoot.getElementById('sp-visitor-tag');
        if (banner && visitorTag) {
          const label = visitorName ? `${visitorName} (${visitorEmail})` : visitorEmail;
          visitorTag.innerHTML = `Chatting as: <strong>${escapeHTML(label)}</strong>`;
          banner.style.display = 'flex';
        }

        // Initialize real-time chat with the provided credentials
        loadSocketIO(() => {
          setupRealtimeChat();
        });
      });
    }

    // Guest Chat button
    const guestBtn = shadowRoot.getElementById('sp-gate-guest-btn');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        visitorName = 'Guest';
        visitorEmail = '';
        try {
          sessionStorage.setItem('sitepulse_visitor_name', 'Guest');
          sessionStorage.setItem('sitepulse_chat_active', 'true');
        } catch (err) {}

        // Hide gate and show banner
        shadowRoot.getElementById('sp-email-gate').style.display = 'none';
        const banner = shadowRoot.getElementById('sp-chat-banner');
        const visitorTag = shadowRoot.getElementById('sp-visitor-tag');
        if (banner && visitorTag) {
          visitorTag.innerHTML = `Chatting as: <strong>Guest</strong>`;
          banner.style.display = 'flex';
        }

        // Initialize real-time chat
        loadSocketIO(() => {
          setupRealtimeChat();
        });
      });
    }

    // End Chat / Not You button listener
    const endChatBtn = shadowRoot.getElementById('sp-end-chat-btn');
    if (endChatBtn) {
      endChatBtn.addEventListener('click', () => handleResetSession(true));
    }

    // Star rating interactions
    setupRatingStars();

    // Feedback Form Submission
    shadowRoot.getElementById('sp-feedback-form').addEventListener('submit', handleFeedbackSubmit);

    // Bug Report Form Submission
    shadowRoot.getElementById('sp-bug-form').addEventListener('submit', handleBugSubmit);
  }

  function handleResetSession(confirmPrompt = true) {
    if (confirmPrompt && !confirm('Are you sure you want to end this conversation and clear your session?')) {
      return;
    }

    // 1. Clear SessionStorage & legacy LocalStorage
    try {
      sessionStorage.removeItem('sitepulse_chat_session_id');
      sessionStorage.removeItem('sitepulse_visitor_email');
      sessionStorage.removeItem('sitepulse_visitor_name');
      sessionStorage.removeItem('sitepulse_external_id');
      sessionStorage.removeItem('sitepulse_chat_active');

      localStorage.removeItem('sitepulse_visitor_id');
      localStorage.removeItem('sitepulse_visitor_email');
      localStorage.removeItem('sitepulse_visitor_name');
      localStorage.removeItem('sitepulse_external_id');
    } catch (e) {}

    // 2. Disconnect existing socket room if any
    if (socket && conversation && conversation.id) {
      try {
        socket.emit('leave_conversation', { conversationId: conversation.id });
      } catch (e) {}
    }

    // 3. Reset in-memory state
    visitorEmail = '';
    visitorName = '';
    externalId = '';
    conversation = null;
    unreadCount = 0;
    if (shadowRoot) updateBadge();

    // 4. Generate a fresh chat session ID
    visitorId = getChatSessionId();

    // 4. Reset Chat DOM
    if (shadowRoot) {
      const chatArea = shadowRoot.getElementById('sp-chat-messages');
      if (chatArea) {
        chatArea.innerHTML = `
          <div class="sp-msg agent">
            ${escapeHTML(widgetSettings.greeting)}
            <div class="sp-msg-meta">Support Team</div>
          </div>
        `;
      }

      // 5. Hide banner and display Email Gate
      const banner = shadowRoot.getElementById('sp-chat-banner');
      if (banner) banner.style.display = 'none';

      const gate = shadowRoot.getElementById('sp-email-gate');
      if (gate) {
        gate.style.display = 'flex';
        const emailInput = shadowRoot.getElementById('sp-gate-email');
        const nameInput = shadowRoot.getElementById('sp-gate-name');
        if (emailInput) emailInput.value = '';
        if (nameInput) nameInput.value = '';
      }

      // 6. Reset email inputs in other tabs
      const fbEmail = shadowRoot.getElementById('sp-feedback-email');
      if (fbEmail) fbEmail.value = '';
      const bugEmail = shadowRoot.getElementById('sp-bug-email');
      if (bugEmail) bugEmail.value = '';
    }
  }


  function toggleWidget() {
    isOpen = !isOpen;
    const win = shadowRoot.getElementById('sp-window');
    if (isOpen) {
      win.classList.add('open');
      unreadCount = 0;
      updateBadge();
      if (activeTab === 'chat') {
        const chatArea = shadowRoot.getElementById('sp-chat-messages');
        const input = shadowRoot.getElementById('sp-chat-input');
        requestAnimationFrame(() => {
          if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
          if (input) input.focus();
        });
      }
    } else {
      win.classList.remove('open');
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    shadowRoot.querySelectorAll('.sp-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    shadowRoot.querySelectorAll('.sp-tab-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `sp-panel-${tab}`);
    });
    if (tab === 'chat') {
      const chatArea = shadowRoot.getElementById('sp-chat-messages');
      const input = shadowRoot.getElementById('sp-chat-input');
      requestAnimationFrame(() => {
        if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        if (input) input.focus();
      });
    }
  }

  let selectedRating = 5;
  function setupRatingStars() {
    const stars = shadowRoot.querySelectorAll('.sp-star');
    stars.forEach((star, index) => {
      star.classList.add('selected');
      star.addEventListener('click', () => {
        selectedRating = index + 1;
        stars.forEach((s, i) => {
          s.classList.toggle('selected', i < selectedRating);
        });
      });
      star.addEventListener('mouseenter', () => {
        stars.forEach((s, i) => {
          s.classList.toggle('hovered', i <= index);
        });
      });
      star.addEventListener('mouseleave', () => {
        stars.forEach((s) => s.classList.remove('hovered'));
      });
    });
  }

  function loadSocketIO(callback) {
    if (window.io) {
      callback();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    script.onload = callback;
    document.head.appendChild(script);
  }

  function applyConversation(conv) {
    conversation = conv;
    if (!shadowRoot) return;
    const chatArea = shadowRoot.getElementById('sp-chat-messages');
    if (!chatArea) return;

    chatArea.innerHTML = '';
    if (conv.messages && conv.messages.length > 0) {
      conv.messages.forEach((msg) => {
        appendMessage(msg.content, msg.senderType, msg.senderName, false);
      });
      requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    } else {
      chatArea.innerHTML = `
        <div class="sp-msg agent">
          ${escapeHTML(widgetSettings.greeting)}
          <div class="sp-msg-meta">Support Team</div>
        </div>
      `;
    }
  }

  function handleIdentify(userData) {
    if (!userData || typeof userData !== 'object') return;
    const { email, name, userId } = userData;

    if (email) {
      visitorEmail = email.trim();
      try { sessionStorage.setItem('sitepulse_visitor_email', visitorEmail); } catch (e) {}
    }
    if (name) {
      visitorName = name.trim();
      try { sessionStorage.setItem('sitepulse_visitor_name', visitorName); } catch (e) {}
    }
    if (userId !== undefined && userId !== null) {
      externalId = String(userId).trim();
      try { sessionStorage.setItem('sitepulse_external_id', externalId); } catch (e) {}
    }
    try { sessionStorage.setItem('sitepulse_chat_active', 'true'); } catch (e) {}

    // Immediately update UI if widget DOM is mounted
    if (shadowRoot) {
      const gate = shadowRoot.getElementById('sp-email-gate');
      if (gate) gate.style.display = 'none';

      const banner = shadowRoot.getElementById('sp-chat-banner');
      const visitorTag = shadowRoot.getElementById('sp-visitor-tag');
      if (banner && visitorTag) {
        const label = visitorName ? `${visitorName} (${visitorEmail || externalId})` : (visitorEmail || externalId);
        visitorTag.innerHTML = `Chatting as: <strong>${escapeHTML(label)}</strong>`;
        banner.style.display = 'flex';
      }

      const fbEmail = shadowRoot.getElementById('sp-feedback-email');
      if (fbEmail && visitorEmail) fbEmail.value = visitorEmail;
      const bugEmail = shadowRoot.getElementById('sp-bug-email');
      if (bugEmail && visitorEmail) bugEmail.value = visitorEmail;
    }

    loadSocketIO(() => {
      setupRealtimeChat();
    });
  }

  let isConnectingChat = false;
  function setupRealtimeChat() {
    if (isConnectingChat) return;
    isConnectingChat = true;

    fetch(`${backendUrl}/api/v1/conversations/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteKey,
        visitorId,
        visitorEmail: visitorEmail || null,
        visitorName: visitorName || null,
        externalId: externalId || null
      })
    })
      .then((res) => res.json())
      .then((conv) => {
        isConnectingChat = false;
        applyConversation(conv);

        // Connect Socket.IO
        if (!socket) {
          socket = window.io(backendUrl);

          socket.on('connect', () => {
            if (conversation && conversation.id) {
              socket.emit('join_conversation', { conversationId: conversation.id });
            }
          });

          // Listen for new messages
          socket.on('message_received', (msg) => {
            if (conversation && msg.conversationId === conversation.id) {
              appendMessage(msg.content, msg.senderType, msg.senderName, true);
              if (!isOpen && msg.senderType === 'agent') {
                unreadCount++;
                updateBadge();
              }
            }
          });

          // Listen for typing
          socket.on('typing', ({ senderType, isTyping }) => {
            if (senderType === 'agent') {
              const typingEl = shadowRoot.getElementById('sp-typing');
              if (typingEl) typingEl.style.display = isTyping ? 'block' : 'none';
            }
          });

          // Listen for live widget settings update
          socket.on('widget_settings_updated', (newSettings) => {
            widgetSettings = { ...widgetSettings, ...newSettings };
            const titleEl = shadowRoot.getElementById('sp-title');
            const subtitleEl = shadowRoot.getElementById('sp-subtitle');
            if (titleEl) titleEl.textContent = widgetSettings.title;
            if (subtitleEl) subtitleEl.textContent = widgetSettings.subtitle;
          });

          // Listen for chats wiped by admin
          socket.on('all_conversations_deleted', () => {
            handleResetSession(false);
          });
        } else if (socket.connected && conv && conv.id) {
          socket.emit('join_conversation', { conversationId: conv.id });
        }
      })
      .catch((err) => {
        isConnectingChat = false;
        console.error('[SitePulse] Chat init failed:', err);
      });
  }

  function handleSendMessage() {
    const input = shadowRoot.getElementById('sp-chat-input');
    const content = input.value.trim();
    if (!content || !conversation || !socket) return;

    socket.emit('send_message', {
      conversationId: conversation.id,
      siteKey: siteKey,
      senderType: 'visitor',
      senderName: visitorName || visitorEmail || 'Visitor',
      content: content
    });

    input.value = '';
    input.focus();
    const chatArea = shadowRoot.getElementById('sp-chat-messages');
    if (chatArea) {
      requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    }
  }

  function appendMessage(text, senderType, senderName, scroll = true) {
    const chatArea = shadowRoot.getElementById('sp-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `sp-msg ${senderType}`;
    msgDiv.innerHTML = `
      ${escapeHTML(text)}
      <div class="sp-msg-meta">${senderType === 'agent' ? (senderName || 'Agent') : 'You'}</div>
    `;
    chatArea.appendChild(msgDiv);
    if (scroll) {
      requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    }
  }

  function updateBadge() {
    const badge = shadowRoot.getElementById('sp-badge');
    if (unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = unreadCount;
    } else {
      badge.style.display = 'none';
    }
  }

  function handleFeedbackSubmit(e) {
    e.preventDefault();
    const comment = shadowRoot.getElementById('sp-feedback-text').value.trim();
    const emailVal = shadowRoot.getElementById('sp-feedback-email').value.trim() || visitorEmail;

    fetch(`${backendUrl}/api/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteKey,
        rating: selectedRating,
        comment,
        userEmail: emailVal
      })
    })
      .then((res) => res.json())
      .then(() => {
        shadowRoot.getElementById('sp-feedback-form').style.display = 'none';
        shadowRoot.getElementById('sp-feedback-success').style.display = 'block';
      })
      .catch((err) => alert('Failed to submit feedback: ' + err.message));
  }

  function handleBugSubmit(e) {
    e.preventDefault();
    const title = shadowRoot.getElementById('sp-bug-title').value.trim();
    const description = shadowRoot.getElementById('sp-bug-desc').value.trim();
    const emailVal = shadowRoot.getElementById('sp-bug-email').value.trim() || visitorEmail;

    fetch(`${backendUrl}/api/v1/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteKey,
        title,
        description,
        userEmail: emailVal,
        url: window.location.href,
        browser: navigator.userAgent,
        device: `${window.innerWidth}x${window.innerHeight}`
      })
    })
      .then((res) => res.json())
      .then(() => {
        shadowRoot.getElementById('sp-bug-form').style.display = 'none';
        shadowRoot.getElementById('sp-bug-success').style.display = 'block';
      })
      .catch((err) => alert('Failed to submit bug report: ' + err.message));
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  window.SitePulse = {
    open: () => { if (!isOpen) toggleWidget(); },
    close: () => { if (isOpen) toggleWidget(); },
    toggle: toggleWidget,
    switchTab: switchTab,
    identify: handleIdentify,
    reset: (confirmPrompt) => handleResetSession(confirmPrompt !== false)
  };

  // Replay any queued commands if SitePulse was invoked prior to script initialization
  if (Array.isArray(preQueue) && preQueue.length > 0) {
    preQueue.forEach((cmd) => {
      if (Array.isArray(cmd)) {
        const [fn, args] = cmd;
        if (fn === 'identify' && typeof handleIdentify === 'function') handleIdentify(args);
        else if (fn === 'reset' && typeof handleResetSession === 'function') handleResetSession(false);
      }
    });
  }
})();
