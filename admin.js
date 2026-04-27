// ============================================================
// AMAN: Tidak ada kredensial di sini.
// Login dikirim ke /api/login (Vercel Serverless Function)
// Password tersimpan di Environment Variables Vercel (server-side only)
// ============================================================

// State Aplikasi
let currentPage = 1;
let itemsPerPage = 10;
let currentFilter = 'all';
let allDonations = [];
let charts = {};
let tickerInterval = null;

// Inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  updateDate();
  setupEventListeners();
});

// ============================================================
// AUTH — Token disimpan di sessionStorage, divalidasi client-side
// ============================================================
function checkAuth() {
  const token = sessionStorage.getItem('admin_token');
  const expiresAt = sessionStorage.getItem('admin_expires');

  if (token && expiresAt && Date.now() < parseInt(expiresAt)) {
    showDashboard();
  } else {
    // Hapus token expired
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_expires');
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('dashboardPage').style.display = 'none';
  stopTicker();
}

function showDashboard() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboardPage').style.display = 'flex';
  loadDonations();
  updateStats();
  setTimeout(() => {
    renderCharts();
    updateTopDonors();
    updateRecentList();
    startLiveTicker();
  }, 100);
}

function setupEventListeners() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin(e);
    });
  }
}

// Login ke Vercel Serverless Function /api/login
async function handleLogin(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value;
  const btn = document.querySelector('.login-btn');
  const errorEl = document.getElementById('loginError');

  if (!usernameInput || !passwordInput) {
    showLoginError('Username dan password wajib diisi');
    return;
  }

  btn.classList.add('loading');
  if (errorEl) errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Simpan token & waktu expire di sessionStorage
      sessionStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('admin_expires', String(data.expiresAt));
      toast('<i class="fas fa-check-circle" style="color:var(--green)"></i> Login berhasil!', 'success');
      showDashboard();
    } else {
      showLoginError(data.error || 'Username atau password salah');
    }
  } catch (err) {
    // Fallback jika /api/login tidak tersedia (misal local dev tanpa Vercel CLI)
    showLoginError('Tidak bisa terhubung ke server. Pastikan deploy di Vercel.');
  }

  btn.classList.remove('loading');
}

function showLoginError(msg) {
  const errorEl = document.getElementById('loginError');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'flex';
    errorEl.style.animation = 'none';
    void errorEl.offsetWidth; // trigger reflow
    errorEl.style.animation = 'shake 0.4s ease';
  }
  toast(`<i class="fas fa-times-circle" style="color:var(--red)"></i> ${msg}`, 'error');
}

function togglePassword() {
  const input = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function logout() {
  sessionStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_expires');
  toast('<i class="fas fa-sign-out-alt"></i> Logout berhasil', 'info');
  setTimeout(() => {
    showLogin();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }, 500);
}

// ============================================================
// DONASI DATA
// ============================================================
function loadDonations() {
  const stored = localStorage.getItem('jarzgosling_donations');
  allDonations = stored ? JSON.parse(stored) : getSampleData();
  if (!stored) localStorage.setItem('jarzgosling_donations', JSON.stringify(allDonations));
  renderDonationsTable();
  updateSidebarBadge();
}

function getSampleData() {
  return [
    { id: 1, name: 'Budi Santoso', amount: 50000, method: 'qris', msg: 'Semangat terus kak! 💪', date: '2026-04-13 14:30', status: 'completed' },
    { id: 2, name: 'Anonim', amount: 10000, method: 'dana', msg: 'Keep creating!', date: '2026-04-13 13:15', status: 'completed' },
    { id: 3, name: 'Sinta Rahayu', amount: 100000, method: 'gopay', msg: 'Kontennya keren banget!', date: '2026-04-13 11:00', status: 'completed' },
    { id: 4, name: 'Hendra K.', amount: 25000, method: 'ovo', msg: 'Ditunggu project barunya!', date: '2026-04-12 20:30', status: 'pending' },
    { id: 5, name: 'Rini Wulandari', amount: 75000, method: 'qris', msg: '❤️ sukses selalu', date: '2026-04-12 18:00', status: 'completed' },
  ];
}

function updateStats() {
  const total = allDonations.reduce((sum, d) => sum + d.amount, 0);
  const completed = allDonations.filter(d => d.status === 'completed');
  const pending = allDonations.filter(d => d.status === 'pending').length;
  const avg = completed.length ? Math.round(completed.reduce((s, d) => s + d.amount, 0) / completed.length) : 0;

  animateNumber('totalDonations', total, true);
  animateNumber('totalDonors', allDonations.length, false);
  animateNumber('avgDonation', avg, true);
  animateNumber('pendingCount', pending, false);
}

function animateNumber(id, target, isCurrency) {
  const el = document.getElementById(id);
  if (!el) return;
  let start = 0;
  const step = target / (800 / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = isCurrency ? formatRp(Math.round(start)) : Math.round(start);
    if (start >= target) clearInterval(timer);
  }, 16);
}

function updateSidebarBadge() {
  const badge = document.getElementById('sidebarBadge');
  if (badge) badge.textContent = allDonations.length;
}

function updateRecentList() {
  const list = document.getElementById('recentList');
  if (!list) return;
  const recent = [...allDonations].slice(0, 5);
  list.innerHTML = recent.map(d => `
    <div class="recent-item">
      <div class="recent-avatar">${d.name === 'Anonim' ? '<i class="fas fa-user-secret"></i>' : d.name.charAt(0).toUpperCase()}</div>
      <div class="recent-info">
        <div class="recent-name">${d.name}</div>
        <div class="recent-time">${d.date}</div>
      </div>
      <div class="recent-amount">${formatRp(d.amount)}</div>
    </div>
  `).join('');
}

function updateTopDonors() {
  const topList = document.getElementById('topDonorsList');
  if (!topList) return;
  const sorted = [...allDonations].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const rankColors = ['#f5c842', '#a0a0b8', '#cd7f32', '#7c5cfc', '#3b82f6'];
  const rankIcons = ['🥇', '🥈', '🥉', '4', '5'];
  topList.innerHTML = sorted.map((d, i) => `
    <div class="top-item">
      <div class="top-rank" style="background:${rankColors[i]}22;color:${rankColors[i]};font-size:16px;">${rankIcons[i]}</div>
      <div class="top-info">
        <div class="top-name">${d.name}</div>
        <div class="top-amount">${formatRp(d.amount)}</div>
      </div>
      <span class="method-tag ${d.method}">${d.method.toUpperCase()}</span>
    </div>
  `).join('');
}

// ============================================================
// LIVE TICKER
// ============================================================
function startLiveTicker() {
  buildTickerItems();
  stopTicker();
  tickerInterval = setInterval(() => {
    const stored = localStorage.getItem('jarzgosling_donations');
    const fresh = stored ? JSON.parse(stored) : [];
    if (fresh.length !== allDonations.length) {
      allDonations = fresh;
      buildTickerItems();
      updateStats();
      renderDonationsTable();
      updateSidebarBadge();
      updateRecentList();
      updateTopDonors();
      renderCharts();
    }
  }, 3000);
}

function buildTickerItems() {
  const ticker = document.getElementById('liveTickerTrack');
  if (!ticker) return;
  const recent = [...allDonations].slice(0, 10);
  const items = recent.map(d =>
    `<span class="ticker-item">
      <i class="fas fa-heart" style="color:var(--red)"></i>
      <strong>${d.name}</strong> donasi <strong style="color:var(--gold)">${formatRp(d.amount)}</strong>
      via ${d.method.toUpperCase()}
      ${d.msg ? `· "${d.msg.substring(0, 30)}${d.msg.length > 30 ? '...' : ''}"` : ''}
    </span>`
  );
  ticker.innerHTML = [...items, ...items].join('<span class="ticker-sep">✦</span>');
}

function stopTicker() {
  if (tickerInterval) clearInterval(tickerInterval);
}

// ============================================================
// TABLE & FILTERING
// ============================================================
function renderDonationsTable() {
  let filtered = currentFilter === 'all' ? allDonations : allDonations.filter(d => d.status === currentFilter);
  const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
  if (search) {
    filtered = filtered.filter(d =>
      d.name.toLowerCase().includes(search) ||
      d.msg?.toLowerCase().includes(search) ||
      d.method.toLowerCase().includes(search) ||
      String(d.amount).includes(search)
    );
  }
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = 1;
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  const tbody = document.getElementById('donationsTable');
  if (!tbody) return;
  tbody.innerHTML = paginated.length ? paginated.map(d => `
    <tr>
      <td><span style="color:var(--text3);font-size:12px;">#${d.id}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="recent-avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0;">
            ${d.name === 'Anonim' ? '<i class="fas fa-user-secret"></i>' : d.name.charAt(0).toUpperCase()}
          </div>
          <span>${d.name}</span>
        </div>
      </td>
      <td><strong style="color:var(--gold)">${formatRp(d.amount)}</strong></td>
      <td><span class="method-tag ${d.method}">${d.method.toUpperCase()}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2);">${d.msg || '<span style="color:var(--text3);font-style:italic;">—</span>'}</td>
      <td style="color:var(--text3);font-size:13px;">${d.date}</td>
      <td><span class="status-badge ${d.status}">${d.status === 'completed' ? '✓ Selesai' : '⏳ Menunggu'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button onclick="viewDonation(${d.id})" class="action-btn view" title="Detail"><i class="fas fa-eye"></i></button>
          <button onclick="deleteDonation(${d.id})" class="action-btn delete" title="Hapus"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)"><i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:12px;"></i>Belum ada donasi</td></tr>';
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pg = document.getElementById('pagination');
  if (!pg || totalPages <= 1) { if (pg) pg.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  pg.innerHTML = html;
}

function goPage(n) { currentPage = n; renderDonationsTable(); }

function filterDonations(filter) {
  currentFilter = filter;
  currentPage = 1;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderDonationsTable();
}

function searchDonations() { currentPage = 1; renderDonationsTable(); }

function viewDonation(id) {
  const d = allDonations.find(x => x.id === id);
  if (!d) return;
  toast(`<div><strong>${d.name}</strong> · ${formatRp(d.amount)}<br><span style="font-size:12px;color:var(--text3)">${d.method.toUpperCase()} · ${d.date}</span>${d.msg ? `<br><span style="font-size:12px;">"${d.msg}"</span>` : ''}</div>`, 'info');
}

function deleteDonation(id) {
  if (!confirm('Hapus donasi ini?')) return;
  allDonations = allDonations.filter(d => d.id !== id);
  localStorage.setItem('jarzgosling_donations', JSON.stringify(allDonations));
  renderDonationsTable(); updateStats(); updateSidebarBadge(); updateRecentList(); updateTopDonors(); renderCharts();
  toast('<i class="fas fa-trash"></i> Donasi dihapus', 'error');
}

// ============================================================
// SECTION NAVIGATION
// ============================================================
function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(section + 'Section')?.classList.add('active');
  event.currentTarget.classList.add('active');
  if (section === 'analytics') setTimeout(() => { renderCharts(); updateTopDonors(); }, 100);
  document.getElementById('mobileSidebar')?.classList.remove('open');
}

// ============================================================
// CHARTS
// ============================================================
function renderCharts() { renderWeeklyChart(); renderMethodChart(); }

function renderWeeklyChart() {
  const ctx = document.getElementById('weeklyChart');
  if (!ctx) return;
  if (charts.weekly) charts.weekly.destroy();
  const days = [], amounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    const dateStr = d.toISOString().split('T')[0];
    const dayTotal = allDonations.filter(don => don.date?.startsWith(dateStr)).reduce((s, don) => s + don.amount, 0);
    days.push(label); amounts.push(dayTotal);
  }
  charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: { labels: days, datasets: [{ label: 'Total Donasi', data: amounts, backgroundColor: amounts.map(a => a > 0 ? 'rgba(245,200,66,0.7)' : 'rgba(255,255,255,0.05)'), borderColor: amounts.map(a => a > 0 ? '#f5c842' : 'rgba(255,255,255,0.1)'), borderWidth: 2, borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatRp(ctx.raw) } } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6a6a88', callback: v => 'Rp ' + (v/1000) + 'K' } }, x: { grid: { display: false }, ticks: { color: '#6a6a88' } } } }
  });
}

function renderMethodChart() {
  const ctx = document.getElementById('methodChart');
  if (!ctx) return;
  if (charts.method) charts.method.destroy();
  const methods = {};
  allDonations.forEach(d => { methods[d.method] = (methods[d.method] || 0) + d.amount; });
  const colors = { qris: '#f5c842', dana: '#0072ef', ovo: '#9c6be8', gopay: '#00c95e' };
  charts.method = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(methods).map(m => m.toUpperCase()), datasets: [{ data: Object.values(methods), backgroundColor: Object.keys(methods).map(m => colors[m] || '#a0a0b8'), borderColor: '#1c1c26', borderWidth: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0a0b8', padding: 20 } }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatRp(ctx.raw)}` } } } }
  });
}

// ============================================================
// DATA MANAGEMENT
// ============================================================
function refreshData() {
  loadDonations(); updateStats(); updateRecentList(); updateTopDonors(); renderCharts(); buildTickerItems();
  toast('<i class="fas fa-rotate-right"></i> Data diperbarui', 'success');
}

function exportData() {
  const rows = [['ID','Nama','Jumlah','Metode','Pesan','Tanggal','Status']];
  allDonations.forEach(d => rows.push([d.id, d.name, d.amount, d.method, d.msg || '', d.date, d.status]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `jarzgosling_donations_${Date.now()}.csv`; a.click();
  toast('<i class="fas fa-download"></i> CSV berhasil diunduh', 'success');
}

function backupData() {
  const blob = new Blob([JSON.stringify(allDonations, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `jarzgosling_backup_${Date.now()}.json`; a.click();
  toast('<i class="fas fa-download"></i> Backup berhasil', 'success');
}

function importData(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error();
      allDonations = data;
      localStorage.setItem('jarzgosling_donations', JSON.stringify(allDonations));
      renderDonationsTable(); updateStats(); updateSidebarBadge(); updateRecentList(); updateTopDonors(); renderCharts(); buildTickerItems();
      toast('<i class="fas fa-upload"></i> Import berhasil!', 'success');
    } catch { toast('<i class="fas fa-times"></i> File tidak valid', 'error'); }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('⚠️ Hapus SEMUA data donasi? Tindakan ini tidak bisa dibatalkan!')) return;
  allDonations = [];
  localStorage.removeItem('jarzgosling_donations');
  renderDonationsTable(); updateStats(); updateSidebarBadge(); updateRecentList(); updateTopDonors(); renderCharts(); buildTickerItems();
  toast('<i class="fas fa-trash"></i> Semua data dihapus', 'error');
}

function toggleMobileSidebar() {
  document.getElementById('mobileSidebar')?.classList.toggle('open');
}

// ============================================================
// UTILITIES
// ============================================================
function formatRp(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }

function toast(html, type = 'info') {
  const box = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.innerHTML = html; box.appendChild(t);
  setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 320); }, 3200);
}

function updateDate() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}