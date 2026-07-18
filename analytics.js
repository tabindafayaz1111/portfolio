// Portfolio Analytics System: analytics.js
// Handles client-side tracking, heartbeat sessions, dynamic script injection, and event exposure.

(function () {
  let config = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    CLARITY_PROJECT_ID: ''
  };

  // Helper to generate a UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Get or create session ID (stored in sessionStorage, valid for browser tab session)
  let sessionId = sessionStorage.getItem('portfolio_session_id');
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem('portfolio_session_id', sessionId);
  }

  // Get or create visitor ID (stored in localStorage, persists for returning visitor tracking)
  let visitorId = localStorage.getItem('portfolio_visitor_id');
  if (!visitorId) {
    visitorId = generateUUID();
    localStorage.setItem('portfolio_visitor_id', visitorId);
  }

  // Get or set landing page (first page visited in this session)
  let landingPage = sessionStorage.getItem('portfolio_landing_page');
  if (!landingPage) {
    landingPage = window.location.pathname + window.location.hash + window.location.search;
    sessionStorage.setItem('portfolio_landing_page', landingPage);
  }

  // Capture client specs
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const language = navigator.language || 'Unknown';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const referrer = document.referrer || 'Direct';

  // Queue to hold events if config isn't loaded yet
  const eventQueue = [];
  let isConfigLoaded = false;

  // Fetch public configuration from backend serverless function
  async function fetchConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        config = await response.json();
        isConfigLoaded = true;

        // 1. Inject Microsoft Clarity if configured
        if (config.CLARITY_PROJECT_ID) {
          (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
          })(window, document, "clarity", "script", config.CLARITY_PROJECT_ID);
        }

        // 2. Process queued events
        while (eventQueue.length > 0) {
          const queuedEvent = eventQueue.shift();
          sendTrackingRequest(queuedEvent.type, queuedEvent.data);
        }
      }
    } catch (error) {
      console.error('Failed to load analytics config:', error);
    }
  }

  // Expose trackEvent globally so other scripts (like script.js) can use it
  window.trackEvent = function (type, data = {}) {
    if (!isConfigLoaded) {
      eventQueue.push({ type, data });
    } else {
      sendTrackingRequest(type, data);
    }
  };

  // Sends the tracking POST request to /api/track
  async function sendTrackingRequest(eventType, eventData = {}) {
    const currentPage = window.location.pathname + window.location.hash + window.location.search;
    const payload = {
      session_id: sessionId,
      visitor_id: visitorId,
      screen_resolution: screenResolution,
      language: language,
      timezone: timezone,
      referrer: referrer,
      current_page: currentPage,
      landing_page: landingPage,
      event_type: eventType,
      event_data: eventData
    };

    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        keepalive: eventType === 'heartbeat' || eventType === 'resume_download' // Keep connection open during unload
      });
    } catch (error) {
      console.warn('Analytics report failed:', error);
    }
  }

  // Initialize tracking on page load
  window.addEventListener('load', () => {
    fetchConfig().then(() => {
      // Send initial pageview event
      window.trackEvent('page_view', { title: document.title });

      // Start Heartbeat: send pings every 15 seconds to track active session duration
      let heartbeatInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          window.trackEvent('heartbeat');
        }
      }, 15000);

      // Stop heartbeats and send exit ping if tab is hidden/closed
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          window.trackEvent('heartbeat'); // Final duration update
        }
      });

      // Bind click listener for Resume downloads (catches dynamically added classes too)
      document.body.addEventListener('click', (e) => {
        const target = e.target.closest('#resumeDownload, .resume-link');
        if (target) {
          window.trackEvent('resume_download', {
            href: target.getAttribute('href') || '',
            text: target.textContent.trim()
          });
        }
      });
    });
  });
})();
