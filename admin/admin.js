// Portfolio Admin Dashboard Logic: admin.js
// Handles Supabase authentication, fetching visitor logs, chart rendering, searching/sorting/filtering, and realtime updates.

let supabase = null;
let visitorsData = [];
let filteredVisitors = [];
let currentPage = 1;
const pageSize = 10;
let currentSortColumn = 'visit_time';
let currentSortOrder = 'desc'; // 'asc' or 'desc'

// Chart.js instances
let trafficChartInst = null;
let deviceChartInst = null;
let osChartInst = null;
let browserChartInst = null;
let projectsChartInst = null;
let countryChartInst = null;
let cityChartInst = null;

// Initialize config and Supabase
async function init() {
  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();

    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      showAuthError("Database credentials are not configured. Please set environment variables.");
      return;
    }

    // Initialize Supabase client
    const supabaseCreator = typeof supabaseJS !== 'undefined' ? supabaseJS : (typeof window.supabase !== 'undefined' ? window.supabase : null);
    if (!supabaseCreator || !supabaseCreator.createClient) {
      showAuthError("Failed to load Supabase SDK from CDN.");
      return;
    }
    supabase = supabaseCreator.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

    // Check current auth status
    const { data: { session } } = await supabase.auth.getSession();
    handleAuthState(session);

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthState(session);
    });

  } catch (error) {
    console.error("Dashboard initialization error:", error);
    showAuthError("Failed to initialize dashboard. Server error.");
  }
}

// Handle login state changes
function handleAuthState(session) {
  const authWrapper = document.getElementById('authWrapper');
  const dashboardContainer = document.getElementById('dashboardContainer');

  if (session) {
    authWrapper.style.display = 'none';
    dashboardContainer.style.display = 'block';
    
    // Load dashboard metrics
    fetchDashboardData();
    
    // Subscribe to realtime database changes
    setupRealtimeSubscription();
  } else {
    authWrapper.style.display = 'flex';
    dashboardContainer.style.display = 'none';
    
    // Destroy charts on logout to prevent canvas reuse errors
    destroyAllCharts();
  }
}

// Show error messages in login card
function showAuthError(message) {
  const errEl = document.getElementById('authError');
  errEl.textContent = message;
  errEl.style.display = 'block';
}

// Login Submit
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';

  if (!supabase) return;

  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Authenticating...';

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthError(error.message);
    }
  } catch (err) {
    showAuthError("Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

// Logout Action
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }
});

// Refresh Action
document.getElementById('refreshBtn').addEventListener('click', () => {
  fetchDashboardData();
});

// Fetch all sessions from the last 30 days + overall summary metrics
async function fetchDashboardData() {
  if (!supabase) return;

  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing...';

  try {
    // 1. Fetch total overall count (all time sessions)
    const { count: totalSessions, error: countErr } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    // 2. Fetch visitor records (limit to last 1000 for client dashboard scaling)
    const { data: visitors, error: fetchErr } = await supabase
      .from('visitors')
      .select('*')
      .order('visit_time', { ascending: false })
      .limit(1000);

    if (fetchErr) throw fetchErr;

    visitorsData = visitors || [];
    
    // Update overview metric cards
    renderOverviewCards(totalSessions);
    
    // Draw charts
    renderCharts();
    
    // Apply filters, search and sort to construct table
    applyTableFilters();

  } catch (error) {
    console.error("Error loading dashboard metrics:", error);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '🔄 Refresh Data';
  }
}

// Compute statistics and update card counters
function renderOverviewCards(totalSessions) {
  const now = new Date();
  
  // Timestamps ranges
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  
  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - 7);
  
  const startOfMonth = new Date();
  startOfMonth.setDate(now.getDate() - 30);

  // Group counters
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  let totalDownloads = 0;
  let totalFormSubmissions = 0;
  let totalDurationSec = 0;
  let visitorSessionCounts = {};

  visitorsData.forEach(v => {
    const visitDate = new Date(v.visit_time);
    
    // Timestamps counts
    if (visitDate >= startOfToday) todayCount++;
    if (visitDate >= startOfWeek) weekCount++;
    if (visitDate >= startOfMonth) monthCount++;

    // Total CV downloads
    totalDownloads += (v.resume_downloaded || 0);

    // Total Form submissions
    if (v.contact_form_submitted) totalFormSubmissions++;

    // Cumulative duration
    totalDurationSec += (v.session_duration || 0);

    // Count sessions per visitor ID (to discover returning visitors)
    visitorSessionCounts[v.visitor_id] = (visitorSessionCounts[v.visitor_id] || 0) + 1;
  });

  // Calculate returning rate
  let returningCount = 0;
  const uniqueVisitorIds = Object.keys(visitorSessionCounts);
  uniqueVisitorIds.forEach(vid => {
    if (visitorSessionCounts[vid] > 1) {
      returningCount += (visitorSessionCounts[vid] - 1);
    }
  });
  
  const returningPercent = uniqueVisitorIds.length > 0 
    ? Math.round((returningCount / visitorsData.length) * 100) 
    : 0;

  // Average session duration
  const avgDuration = visitorsData.length > 0 ? Math.round(totalDurationSec / visitorsData.length) : 0;
  const formatAvgDuration = (sec) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // Populate HTML elements
  document.getElementById('statsToday').textContent = todayCount;
  document.getElementById('statsWeek').textContent = weekCount;
  document.getElementById('statsMonth').textContent = monthCount;
  document.getElementById('statsTotal').textContent = totalSessions || visitorsData.length;
  document.getElementById('statsReturning').textContent = `${returningCount} sessions`;
  document.getElementById('statsReturningPercent').textContent = `${returningPercent}% of sessions returning`;
  document.getElementById('statsDownloads').textContent = totalDownloads;
  document.getElementById('statsFormSubmits').textContent = totalFormSubmissions;
  document.getElementById('statsDuration').textContent = formatAvgDuration(avgDuration);
}

// Compile stats and instantiate ChartJS canvas objects
function renderCharts() {
  destroyAllCharts();

  // Helper arrays for accent chart colors
  const primaryColor = '#2dd4bf'; // Teal
  const primaryRGB = '45, 212, 192';
  const secondaryColor = '#0e7490'; // Cyan
  const textMuted = '#8b9eb0';
  const gridColor = 'rgba(45, 212, 192, 0.08)';

  // Chart defaults configuration
  Chart.defaults.color = textMuted;
  Chart.defaults.borderColor = gridColor;
  Chart.defaults.font.family = "'Inter', sans-serif";

  // --- 1. Daily Traffic Chart (Last 14 Days) ---
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    return d;
  }).reverse();

  const trafficDataMap = {};
  last14Days.forEach(d => {
    const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    trafficDataMap[key] = { visitors: 0, views: 0 };
  });

  visitorsData.forEach(v => {
    const vDate = new Date(v.visit_time);
    vDate.setHours(0,0,0,0);
    const match = last14Days.find(d => d.getTime() === vDate.getTime());
    if (match) {
      const key = match.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      trafficDataMap[key].visitors += 1;
      // Estimate pageviews by summing length of pages_visited
      const pages = Array.isArray(v.pages_visited) ? v.pages_visited.length : 1;
      trafficDataMap[key].views += pages;
    }
  });

  const trafficLabels = Object.keys(trafficDataMap);
  const trafficSessions = trafficLabels.map(l => trafficDataMap[l].visitors);
  const trafficViews = trafficLabels.map(l => trafficDataMap[l].views);

  const trafficCtx = document.getElementById('trafficChart').getContext('2d');
  trafficChartInst = new Chart(trafficCtx, {
    type: 'line',
    data: {
      labels: trafficLabels,
      datasets: [
        {
          label: 'Visitor Sessions',
          data: trafficSessions,
          borderColor: primaryColor,
          backgroundColor: `rgba(${primaryRGB}, 0.1)`,
          fill: true,
          tension: 0.35,
          borderWidth: 2
        },
        {
          label: 'Page Views (estimated)',
          data: trafficViews,
          borderColor: secondaryColor,
          backgroundColor: 'transparent',
          tension: 0.35,
          borderWidth: 2,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { position: 'top', align: 'end' }
      }
    }
  });

  // --- Helper function for aggregations ---
  function getAggs(key) {
    const map = {};
    visitorsData.forEach(v => {
      const val = v[key] || 'Unknown';
      map[val] = (map[val] || 0) + 1;
    });
    const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]);
    return {
      labels: sorted.map(x => x[0]),
      data: sorted.map(x => x[1])
    };
  }

  // --- 2. Devices Breakdown ---
  const deviceAggs = getAggs('device_type');
  const deviceCtx = document.getElementById('deviceChart').getContext('2d');
  deviceChartInst = new Chart(deviceCtx, {
    type: 'doughnut',
    data: {
      labels: deviceAggs.labels,
      datasets: [{
        data: deviceAggs.data,
        backgroundColor: [primaryColor, secondaryColor, '#0ea5e9', '#38bdf8', '#7dd3fc'],
        borderWidth: 2,
        borderColor: '#0b1520'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });

  // --- 3. Operating System Breakdown ---
  const osAggs = getAggs('operating_system');
  const osCtx = document.getElementById('osChart').getContext('2d');
  osChartInst = new Chart(osCtx, {
    type: 'pie',
    data: {
      labels: osAggs.labels.slice(0, 5),
      datasets: [{
        data: osAggs.data.slice(0, 5),
        backgroundColor: [secondaryColor, primaryColor, '#0d9488', '#0f766e', '#115e59'],
        borderWidth: 2,
        borderColor: '#0b1520'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });

  // --- 4. Browser Usage Breakdown ---
  const browserAggs = getAggs('browser');
  const browserCtx = document.getElementById('browserChart').getContext('2d');
  browserChartInst = new Chart(browserCtx, {
    type: 'doughnut',
    data: {
      labels: browserAggs.labels.slice(0, 5),
      datasets: [{
        data: browserAggs.data.slice(0, 5),
        backgroundColor: [primaryColor, '#14b8a6', '#0ea5e9', secondaryColor, '#1e293b'],
        borderWidth: 2,
        borderColor: '#0b1520'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });

  // --- 5. Top Projects Clicked ---
  const projectClicksMap = {};
  visitorsData.forEach(v => {
    if (v.project_clicked && typeof v.project_clicked === 'object') {
      Object.entries(v.project_clicked).forEach(([pName, count]) => {
        projectClicksMap[pName] = (projectClicksMap[pName] || 0) + count;
      });
    }
  });
  const projectClicksSorted = Object.entries(projectClicksMap).sort((a,b) => b[1] - a[1]).slice(0, 6);
  const projectLabels = projectClicksSorted.map(x => x[0]);
  const projectCounts = projectClicksSorted.map(x => x[1]);

  const projectsCtx = document.getElementById('projectsChart').getContext('2d');
  projectsChartInst = new Chart(projectsCtx, {
    type: 'bar',
    data: {
      labels: projectLabels.length > 0 ? projectLabels : ['No clicks logged'],
      datasets: [{
        label: 'Clicks',
        data: projectCounts.length > 0 ? projectCounts : [0],
        backgroundColor: primaryColor,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, grid: { color: gridColor } },
        y: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // --- 6. Top Countries ---
  const countryAggs = getAggs('country');
  const countryCtx = document.getElementById('countryChart').getContext('2d');
  countryChartInst = new Chart(countryCtx, {
    type: 'bar',
    data: {
      labels: countryAggs.labels.slice(0, 7),
      datasets: [{
        label: 'Sessions',
        data: countryAggs.data.slice(0, 7),
        backgroundColor: secondaryColor,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // --- 7. Top Cities ---
  const cityAggs = getAggs('city');
  const cityCtx = document.getElementById('cityChart').getContext('2d');
  cityChartInst = new Chart(cityCtx, {
    type: 'bar',
    data: {
      labels: cityAggs.labels.slice(0, 7),
      datasets: [{
        label: 'Sessions',
        data: cityAggs.data.slice(0, 7),
        backgroundColor: primaryColor,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, grid: { color: gridColor } },
        y: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// Clean up Chart.js instances before re-render
function destroyAllCharts() {
  if (trafficChartInst) trafficChartInst.destroy();
  if (deviceChartInst) deviceChartInst.destroy();
  if (osChartInst) osChartInst.destroy();
  if (browserChartInst) browserChartInst.destroy();
  if (projectsChartInst) projectsChartInst.destroy();
  if (countryChartInst) countryChartInst.destroy();
  if (cityChartInst) cityChartInst.destroy();
}

// --- Table Sorting, Searching, and Pagination ---

// Filter search input triggers
document.getElementById('tableSearch').addEventListener('input', () => {
  currentPage = 1;
  applyTableFilters();
});

document.getElementById('filterDevice').addEventListener('change', () => {
  currentPage = 1;
  applyTableFilters();
});

document.getElementById('filterAction').addEventListener('change', () => {
  currentPage = 1;
  applyTableFilters();
});

// Setup click listeners on table headers for sorting
document.querySelectorAll('#tableHeaders th').forEach(th => {
  th.addEventListener('click', () => {
    const colName = th.dataset.column;
    if (!colName) return;

    if (currentSortColumn === colName) {
      currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortColumn = colName;
      currentSortOrder = 'desc';
    }

    // Toggle arrow headers
    document.querySelectorAll('#tableHeaders th').forEach(el => {
      el.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(currentSortOrder === 'asc' ? 'sort-asc' : 'sort-desc');

    applyTableFilters();
  });
});

// Pagination controls
document.getElementById('prevPageBtn').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
});

document.getElementById('nextPageBtn').addEventListener('click', () => {
  const maxPage = Math.ceil(filteredVisitors.length / pageSize);
  if (currentPage < maxPage) {
    currentPage++;
    renderTable();
  }
});

// Apply filters in-memory
function applyTableFilters() {
  const query = document.getElementById('tableSearch').value.toLowerCase().trim();
  const deviceVal = document.getElementById('filterDevice').value;
  const actionVal = document.getElementById('filterAction').value;

  filteredVisitors = visitorsData.filter(v => {
    // Search match
    const searchStr = `${v.country} ${v.city} ${v.operating_system} ${v.browser} ${v.ip_address}`.toLowerCase();
    const matchSearch = !query || searchStr.includes(query);

    // Device filter
    const matchDevice = deviceVal === 'all' || v.device_type === deviceVal;

    // Action filter
    let matchAction = true;
    if (actionVal === 'resume') {
      matchAction = (v.resume_downloaded || 0) > 0;
    } else if (actionVal === 'contact') {
      matchAction = v.contact_form_submitted === true;
    }

    return matchSearch && matchDevice && matchAction;
  });

  // Sort filtered list
  filteredVisitors.sort((a, b) => {
    let valA = a[currentSortColumn];
    let valB = b[currentSortColumn];

    // Fallback checks
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    // Handle special cases
    if (currentSortColumn === 'pages_visited') {
      valA = Array.isArray(valA) ? valA.length : 0;
      valB = Array.isArray(valB) ? valB.length : 0;
    }

    if (typeof valA === 'string') {
      return currentSortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return currentSortOrder === 'asc' 
        ? valA - valB 
        : valB - valA;
    }
  });

  renderTable();
}

// Map Country codes to flag emojis (optional pretty flags)
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode === 'Unknown' || countryCode === 'Local Dev') return '🌐';
  // Check if it is a standard two-letter ISO country code
  if (countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char =>  127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Render paginated rows in table body
function renderTable() {
  const body = document.getElementById('visitorTableBody');
  body.innerHTML = '';

  const totalLogs = filteredVisitors.length;
  
  if (totalLogs === 0) {
    body.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--muted); padding: 40px;">No matching sessions found.</td></tr>';
    document.getElementById('paginationInfo').textContent = 'Showing 0 to 0 of 0 logs';
    document.getElementById('prevPageBtn').disabled = true;
    document.getElementById('nextPageBtn').disabled = true;
    return;
  }

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalLogs);
  const paginatedList = filteredVisitors.slice(startIdx, endIdx);

  paginatedList.forEach(v => {
    const tr = document.createElement('tr');
    
    // Click row to open details modal
    tr.addEventListener('click', () => {
      openVisitorDetails(v);
    });

    const visitTime = new Date(v.visit_time).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Duration formatting
    const duration = v.session_duration || 0;
    const formatDuration = duration < 60 ? `${duration}s` : `${Math.floor(duration/60)}m ${duration%60}s`;

    // Flag + location
    const locationStr = `${getFlagEmoji(v.country)} ${v.city || 'Unknown'}, ${v.country || 'Unknown'}`;

    // Pages count
    const pagesCount = Array.isArray(v.pages_visited) ? v.pages_visited.length : 0;

    tr.innerHTML = `
      <td class="td-time">${visitTime}</td>
      <td>${locationStr}</td>
      <td>${v.device_type || 'Desktop'}</td>
      <td>${v.browser || 'Unknown'}</td>
      <td>${v.operating_system || 'Unknown'}</td>
      <td><span class="page-count-badge">${pagesCount} pg</span></td>
      <td>${formatDuration}</td>
      <td><span class="badge-tag ${v.resume_downloaded > 0 ? 'yes' : 'no'}">${v.resume_downloaded > 0 ? '✓' : '—'}</span></td>
      <td><span class="badge-tag ${v.contact_form_submitted ? 'yes' : 'no'}">${v.contact_form_submitted ? '✓' : '—'}</span></td>
    `;
    body.appendChild(tr);
  });

  // Update Pagination Info
  document.getElementById('paginationInfo').textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalLogs} logs`;
  document.getElementById('prevPageBtn').disabled = currentPage === 1;
  document.getElementById('nextPageBtn').disabled = endIdx >= totalLogs;
}

// --- Visitor Details Modal and timeline ---

// Close Modal
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('detailsModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('detailsModal')) closeModal();
});

function closeModal() {
  document.getElementById('detailsModal').style.display = 'none';
}

// Open modal drawer, load metrics & timelines
async function openVisitorDetails(visitor) {
  const modal = document.getElementById('detailsModal');
  const title = document.getElementById('modalTitle');
  const infoList = document.getElementById('modalInfoList');
  const timeline = document.getElementById('modalTimeline');

  title.innerHTML = `Visitor Session <span>#${visitor.session_id.substring(0, 8)}</span>`;
  modal.style.display = 'flex';

  // Format info panel items
  const formatTime = (iso) => iso ? new Date(iso).toLocaleString() : '—';
  const duration = visitor.session_duration || 0;
  const durationStr = duration < 60 ? `${duration}s` : `${Math.floor(duration/60)}m ${duration%60}s`;

  infoList.innerHTML = `
    <div class="info-item"><span class="lbl">IP Address</span><span class="val">${visitor.ip_address || '—'}</span></div>
    <div class="info-item"><span class="lbl">Location</span><span class="val">${visitor.city || '—'}, ${visitor.region || '—'}, ${visitor.country || '—'}</span></div>
    <div class="info-item"><span class="lbl">Coordinates</span><span class="val">${visitor.latitude || '—'}, ${visitor.longitude || '—'}</span></div>
    <div class="info-item"><span class="lbl">Screen Size</span><span class="val">${visitor.screen_resolution || '—'}</span></div>
    <div class="info-item"><span class="lbl">Language</span><span class="val">${visitor.language || '—'}</span></div>
    <div class="info-item"><span class="lbl">Timezone</span><span class="val">${visitor.timezone || '—'}</span></div>
    <div class="info-item"><span class="lbl">User Agent OS</span><span class="val">${visitor.operating_system || '—'}</span></div>
    <div class="info-item"><span class="lbl">User Agent Browser</span><span class="val">${visitor.browser || '—'} (${visitor.browser_version || ''})</span></div>
    <div class="info-item"><span class="lbl">Referrer URL</span><span class="val" style="word-break: break-all;">${visitor.referrer || 'Direct'}</span></div>
    <div class="info-item"><span class="lbl">Landing Page</span><span class="val" style="word-break: break-all;">${visitor.landing_page || '—'}</span></div>
    <div class="info-item"><span class="lbl">Current/Exit Page</span><span class="val" style="word-break: break-all;">${visitor.current_page || '—'}</span></div>
    <div class="info-item"><span class="lbl">Visit Started</span><span class="val">${formatTime(visitor.visit_time)}</span></div>
    <div class="info-item"><span class="lbl">Last Activity</span><span class="val">${formatTime(visitor.last_activity)}</span></div>
    <div class="info-item"><span class="lbl">Session Length</span><span class="val">${durationStr}</span></div>
    <div class="info-item"><span class="lbl">Pages Visited Count</span><span class="val">${Array.isArray(visitor.pages_visited) ? visitor.pages_visited.length : 0}</span></div>
    <div class="info-item"><span class="lbl">Resume Downloaded</span><span class="val">${visitor.resume_downloaded || 0} times</span></div>
    <div class="info-item"><span class="lbl">Form Submitted</span><span class="val">${visitor.contact_form_submitted ? 'Yes' : 'No'}</span></div>
  `;

  timeline.innerHTML = 'Loading visitor history timeline...';

  // Fetch chronological timeline events from visitor_events table
  if (supabase) {
    try {
      const { data: events, error } = await supabase
        .from('visitor_events')
        .select('*')
        .eq('session_id', visitor.session_id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      timeline.innerHTML = '';
      
      if (!events || events.length === 0) {
        timeline.innerHTML = '<div style="color: var(--muted); font-size: 13px;">No timeline events recorded.</div>';
        return;
      }

      events.forEach(e => {
        const node = document.createElement('div');
        node.className = `timeline-node ${e.event_type}`;

        const evTime = new Date(e.created_at).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        let desc = '';
        let meta = '';

        switch (e.event_type) {
          case 'page_view':
            desc = 'Visited portfolio page';
            meta = e.event_data?.title || '';
            break;
          case 'project_click':
            desc = `Clicked Project Card`;
            meta = e.event_data?.project_name || 'Project Details';
            break;
          case 'resume_download':
            desc = 'Downloaded Resume / CV placeholder';
            meta = 'resume.pdf';
            break;
          case 'contact_submit':
            const status = e.event_data?.success ? 'Success' : 'Failed';
            desc = `Submitted Contact Form (${status})`;
            meta = e.event_data?.error ? `Error: ${e.event_data.error}` : 'Web3Forms Triggered';
            break;
          default:
            desc = `Action event: ${e.event_type}`;
            meta = JSON.stringify(e.event_data);
        }

        node.innerHTML = `
          <div class="timeline-node-time">${evTime}</div>
          <div class="timeline-node-desc">${desc}</div>
          ${meta ? `<div class="timeline-node-meta">${meta}</div>` : ''}
        `;
        timeline.appendChild(node);
      });

    } catch (err) {
      console.error("Failed to load timeline events:", err);
      timeline.innerHTML = '<div style="color: var(--error); font-size: 13px;">Failed to load event log.</div>';
    }
  }
}

// --- Supabase Realtime Channels Subscription ---
let realtimeChannel = null;

function setupRealtimeSubscription() {
  if (!supabase || realtimeChannel) return;

  console.log("Setting up Supabase Realtime Channel...");
  realtimeChannel = supabase
    .channel('visitors-schema-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'visitors'
      },
      (payload) => {
        console.log('Real-time database payload received:', payload);
        // Silently reload data to update all dashboard stats & tables live!
        fetchDashboardData();
      }
    )
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
    });
}

// Start app
init();
