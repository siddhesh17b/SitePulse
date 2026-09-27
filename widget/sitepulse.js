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

  // 2. Generate or retrieve persistent visitor ID (for conversation continuity)
  function getVisitorId() {
    let vid = localStorage.getItem('sitepulse_visitor_id');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('sitepulse_visitor_id', vid);
    }
    return vid;
  }
  const visitorId = getVisitorId();

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
    } catch (e) {
      // Analytics failure shouldn't affect user experience
    }
  }
  // Track initial pageview
  trackPageView();

  // Track SPA route changes
  window.addEventListener('popstate', trackPageView);

  // 4. Fetch Widget Settings & Render
  let widgetSettings = {
    primaryColor: '#2563eb',
    title: 'SitePulse Support',
    subtitle: 'Ask us anything or leave feedback',
    greeting: 'Hi there! How can we help you today?',
    position: 'right',
    enableChat: true,
    enableFeedback: true,
    enableBugReport: true,
    requireEmail: false
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
    // Determine active tab based on enabled settings
    if (widgetSettings.enableChat) activeTab = 'chat';
    else if (widgetSettings.enableFeedback) activeTab = 'feedback';
    else if (widgetSettings.enableBugReport) activeTab = 'bug';

    // Create container element with Shadow DOM
    const container = document.createElement('div');
    container.id = 'sitepulse-widget-root';
    document.body.appendChild(container);
    shadowRoot = container.attachShadow({ mode: 'open' });

    renderWidgetDOM();
    injectStyles();

    // Dynamically load Socket.IO client script if chat is enabled
    if (widgetSettings.enableChat) {
      loadSocketIO(() => {
        setupRealtimeChat();
      });
    }
  }

  function injectStyles() {
    const isLeft = widgetSettings.position === 'left';
    const primary = widgetSettings.primaryColor || '#2563eb';

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
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.12);
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
        fill: currentColor;
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
        color: #ffffff;
        padding: 18px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sp-header-info h3 {
        font-size: 16px;
        font-weight: 600;
      }

      .sp-header-info p {
        font-size: 12px;
        opacity: 0.88;
        margin-top: 3px;
      }

      .sp-close-btn {
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        opacity: 0.8;
        padding: 4px;
        border-radius: 6px;
      }
      .sp-close-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.15);
      }

      /* Tab Nav */
      .sp-nav {
        display: flex;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .sp-tab-btn {
        flex: 1;
        padding: 10px 8px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: 13px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .sp-tab-btn.active {
        color: ${primary};
        border-bottom-color: ${primary};
        background: #ffffff;
        font-weight: 600;
      }

      /* Content Area */
      .sp-content {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .sp-tab-panel {
        display: none;
        flex: 1;
        flex-direction: column;
      }

      .sp-tab-panel.active {
        display: flex;
      }

      /* Chat Panel */
      .sp-chat-messages {
        flex: 1;
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
        color: #ffffff;
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
        opacity: 0.7;
        margin-top: 4px;
        text-align: right;
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
        border-color: ${primary};
      }

      .sp-send-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background-color: ${primary};
        color: #ffffff;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
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
        border-color: ${primary};
      }

      .sp-textarea {
        min-height: 90px;
        resize: vertical;
      }

      .sp-submit-btn {
        background-color: ${primary};
        color: #ffffff;
        border: none;
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

      .sp-success-msg {
        display: none;
        padding: 20px;
        text-align: center;
        color: #16a34a;
        font-weight: 500;
        font-size: 14px;
      }

      /* Auto-attached diagnostic banner */
      .sp-diagnostic-tag {
        font-size: 11px;
        background: #f1f5f9;
        color: #64748b;
        padding: 8px 10px;
        border-radius: 6px;
        border-left: 3px solid ${primary};
        line-height: 1.4;
      }
    `;
    shadowRoot.appendChild(style);
  }

  function renderWidgetDOM() {
    const launcher = document.createElement('div');
    launcher.className = 'sp-launcher';
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
        <button class="sp-close-btn" id="sp-close-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="6"></line>
          </svg>
        </button>
      </div>

      <div class="sp-nav">
        ${widgetSettings.enableChat ? '<button class="sp-tab-btn active" data-tab="chat">💬 Chat</button>' : ''}
        ${widgetSettings.enableFeedback ? '<button class="sp-tab-btn" data-tab="feedback">⭐ Feedback</button>' : ''}
        ${widgetSettings.enableBugReport ? '<button class="sp-tab-btn" data-tab="bug">🐞 Report Bug</button>' : ''}
      </div>

      <div class="sp-content">
        <!-- 1. Chat Tab Panel -->
        <div class="sp-tab-panel active" id="sp-panel-chat">
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
            <input type="email" class="sp-input" id="sp-feedback-email" placeholder="name@example.com" />
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
            <input type="email" class="sp-input" id="sp-bug-email" placeholder="name@example.com" />
            
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

    // Star rating interactions
    setupRatingStars();

    // Feedback Form Submission
    shadowRoot.getElementById('sp-feedback-form').addEventListener('submit', handleFeedbackSubmit);

    // Bug Report Form Submission
    shadowRoot.getElementById('sp-bug-form').addEventListener('submit', handleBugSubmit);
  }

  function toggleWidget() {
    isOpen = !isOpen;
    const win = shadowRoot.getElementById('sp-window');
    if (isOpen) {
      win.classList.add('open');
      unreadCount = 0;
      updateBadge();
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
  }

  let selectedRating = 5;
  function setupRatingStars() {
    const stars = shadowRoot.querySelectorAll('.sp-star');
    stars.forEach((star, index) => {
      // Default to 5 selected
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

  // Socket.IO Chat Client Setup
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

  function setupRealtimeChat() {
    // 1. Initialize conversation on backend
    fetch(`${backendUrl}/api/v1/conversations/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteKey,
        visitorId
      })
    })
      .then((res) => res.json())
      .then((conv) => {
        conversation = conv;

        // Render any previous messages
        if (conv.messages && conv.messages.length > 0) {
          const chatArea = shadowRoot.getElementById('sp-chat-messages');
          chatArea.innerHTML = ''; // Clear default greeting if history exists
          conv.messages.forEach((msg) => {
            appendMessage(msg.content, msg.senderType, msg.senderName, false);
          });
        }

        // Connect Socket.IO
        socket = window.io(backendUrl);

        socket.on('connect', () => {
          socket.emit('join_conversation', { conversationId: conversation.id });
        });

        // Listen for new messages
        socket.on('message_received', (msg) => {
          if (msg.conversationId === conversation.id) {
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
            typingEl.style.display = isTyping ? 'block' : 'none';
          }
        });

        // Listen for live widget settings update from admin dashboard!
        socket.on('widget_settings_updated', (newSettings) => {
          widgetSettings = { ...widgetSettings, ...newSettings };
          // Dynamically update UI
          const titleEl = shadowRoot.getElementById('sp-title');
          const subtitleEl = shadowRoot.getElementById('sp-subtitle');
          if (titleEl) titleEl.textContent = widgetSettings.title;
          if (subtitleEl) subtitleEl.textContent = widgetSettings.subtitle;
        });
      })
      .catch((err) => console.error('[SitePulse] Chat init failed:', err));
  }

  function handleSendMessage() {
    const input = shadowRoot.getElementById('sp-chat-input');
    const content = input.value.trim();
    if (!content || !conversation || !socket) return;

    socket.emit('send_message', {
      conversationId: conversation.id,
      siteKey: siteKey,
      senderType: 'visitor',
      content: content
    });

    input.value = '';
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
      chatArea.scrollTop = chatArea.scrollHeight;
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

  // Handle Feedback Submission
  function handleFeedbackSubmit(e) {
    e.preventDefault();
    const comment = shadowRoot.getElementById('sp-feedback-text').value.trim();
    const userEmail = shadowRoot.getElementById('sp-feedback-email').value.trim();

    fetch(`${backendUrl}/api/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteKey,
        rating: selectedRating,
        comment,
        userEmail
      })
    })
      .then((res) => res.json())
      .then(() => {
        shadowRoot.getElementById('sp-feedback-form').style.display = 'none';
        shadowRoot.getElementById('sp-feedback-success').style.display = 'block';
      })
      .catch((err) => alert('Failed to submit feedback: ' + err.message));
  }

  // Handle Bug Report Submission
  function handleBugSubmit(e) {
    e.preventDefault();
    const title = shadowRoot.getElementById('sp-bug-title').value.trim();
    const description = shadowRoot.getElementById('sp-bug-desc').value.trim();
    const userEmail = shadowRoot.getElementById('sp-bug-email').value.trim();

    fetch(`${backendUrl}/api/v1/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteKey,
        title,
        description,
        userEmail,
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

  // Public JavaScript API (Matches Papercups standard)
  window.SitePulse = {
    open: () => { if (!isOpen) toggleWidget(); },
    close: () => { if (isOpen) toggleWidget(); },
    toggle: toggleWidget,
    switchTab: switchTab
  };
})();
