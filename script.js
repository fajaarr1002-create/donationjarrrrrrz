// Payment Data Configuration
const METHODS = {
  qris: {
    name: 'QRIS',
    sub: 'Scan QR Code dengan e-wallet apapun lalu selesaikan pembayaran.',
    hasWallet: false,
    color: '#f5c842',
    modalBg: 'rgba(245,200,66,0.1)',
    logoUrl: 'https://kimi-web-img.moonshot.cn/img/logowik.com/dffbff7e3087baa7626bf9869c64a3213fbf86cb.webp'
  },
  dana: {
    name: 'DANA',
    sub: 'Salin nomor DANA di bawah lalu transfer sesuai nominal donasi.',
    hasWallet: true,
    number: '6285708557587',
    color: '#0072ef',
    modalBg: 'rgba(0,114,239,0.1)',
    icon: '💙',
    logoUrl: 'https://kimi-web-img.moonshot.cn/img/upload.wikimedia.org/23fa6c7ab03d5a081a3d04fe18238797337c6313.png'
  },
  ovo: {
    name: 'OVO',
    sub: 'Salin nomor OVO di bawah lalu transfer sesuai nominal donasi.',
    hasWallet: true,
    number: '62xxxxxxxxxxx',
    color: '#9c6be8',
    modalBg: 'rgba(100,44,179,0.1)',
    icon: '💜',
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTIwIDQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0MCIgcng9IjYiIGZpbGw9IiM2MzJjYjMiLz48dGV4dCB4PSI1MCUiIHk9IjI4IiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2ssc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSIyIj5PVk88L3RleHQ+PC9zdmc+'
  },
  gopay: {
    name: 'GoPay',
    sub: 'Salin nomor GoPay di bawah lalu transfer sesuai nominal donasi.',
    hasWallet: true,
    number: '6285178914529',
    color: '#00c95e',
    modalBg: 'rgba(0,169,79,0.1)',
    icon: '💚',
    logoUrl: 'https://kimi-web-img.moonshot.cn/img/1000logos.net/6d833cf77619bd9b0a926007acc3dd6ef616e1e3.png'
  }
};

const INITIAL_DONORS = [
  { name: 'Budi S.',   amount: 50000,  msg: 'Semangat terus kak! 💪',                    time: '3 menit lalu' },
  { name: 'Anonim',    amount: 10000,  msg: 'Keep creating!',                             time: '17 menit lalu' },
  { name: 'Sinta R.',  amount: 100000, msg: 'Kontennya keren banget, sukses ya!',         time: '1 jam lalu' },
  { name: 'Hendra K.', amount: 25000,  msg: 'Terus berkarya, ditunggu project barunya!', time: '3 jam lalu' },
];

let selectedMethod = 'qris';
let donationData = {};
let audioCtx;
let paymentCountdownTimer = null;
let paymentSecondsLeft = 60;

// ============================================================
// INITIALIZE
// ============================================================
window.addEventListener('load', () => {
  renderDonors(INITIAL_DONORS);
  initReveal();
  loadDonationsFromStorage();
  document.addEventListener('click', () => {
    try { getAudio().resume(); } catch(e) {}
  }, { once: true });
});

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 90);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

function loadDonationsFromStorage() {
  const stored = localStorage.getItem('JarzGosling_donations');
  if (stored) {
    const donations = JSON.parse(stored);
    const currentCount = 142 + donations.length;
    document.getElementById('donorCount').innerHTML = `${currentCount} <i class="fas fa-users"></i>`;
  }
}

// ============================================================
// METHOD SELECTION
// ============================================================
function selectMethod(m) {
  selectedMethod = m;
  document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
  document.getElementById('card-' + m).classList.add('active');
  playTick();
  toast(`<i class="fas fa-circle-check" style="color:var(--green)"></i> ${METHODS[m].name} dipilih`, 'info');
}

// ============================================================
// AMOUNT PRESETS
// ============================================================
function setPreset(val, btn) {
  document.getElementById('amountInput').value = val;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  playTick();
}

function clearPresets() {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

// ============================================================
// PAYMENT MODAL
// ============================================================
function openPayment() {
  const amount = parseInt(document.getElementById('amountInput').value) || 0;
  if (amount < 1000) {
    toast('<i class="fas fa-triangle-exclamation"></i> Minimal donasi Rp 1.000', 'error');
    return;
  }
  const name = document.getElementById('nameInput').value.trim() || 'Anonim';
  donationData = {
    amount,
    name,
    message: document.getElementById('messageInput').value.trim(),
    method: selectedMethod,
    timestamp: new Date().toISOString()
  };

  const btn = document.getElementById('donateBtn');
  btn.classList.add('loading'); btn.disabled = true;
  playTick();

  setTimeout(() => {
    btn.classList.remove('loading'); btn.disabled = false;
    buildModal();
    document.getElementById('step1').classList.add('active');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('confirmBtn').innerHTML = '<i class="fas fa-circle-check"></i> Konfirmasi Pembayaran';
    document.getElementById('confirmBtn').disabled = false;
    document.getElementById('modalOverlay').classList.add('open');
    startPaymentCountdown();
  }, 1100);
}

function buildModal() {
  const m = METHODS[selectedMethod];
  const logoContainer = document.getElementById('modalLogo');
  logoContainer.innerHTML = `<img src="${m.logoUrl}" alt="${m.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />`;
  logoContainer.style.background = m.modalBg;

  document.getElementById('modalTitle').textContent = m.hasWallet ? `Transfer via ${m.name}` : 'Scan QRIS';
  document.getElementById('modalSub').textContent = m.sub;

  document.getElementById('qrSection').style.display = m.hasWallet ? 'none' : 'block';
  document.getElementById('walletSection').style.display = m.hasWallet ? 'flex' : 'none';

  if (m.hasWallet) {
    document.getElementById('walletNumber').textContent = m.number;
    document.getElementById('walletIcon').textContent = m.icon;
  }

  document.getElementById('infoName').textContent = donationData.name;
  document.getElementById('infoMethod').textContent = m.name;
  document.getElementById('infoAmount').textContent = formatRp(donationData.amount);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('confettiContainer').innerHTML = '';
  stopPaymentCountdown();
}

// ============================================================
// COUNTDOWN TIMER (1 minute)
// ============================================================
function startPaymentCountdown() {
  stopPaymentCountdown();
  paymentSecondsLeft = 60;
  updateCountdownUI();

  paymentCountdownTimer = setInterval(() => {
    paymentSecondsLeft--;
    updateCountdownUI();

    if (paymentSecondsLeft <= 0) {
      stopPaymentCountdown();
      onCountdownExpired();
    }

    // Warning pulse at 10 seconds
    if (paymentSecondsLeft <= 10) {
      const countEl = document.getElementById('countdownDisplay');
      if (countEl) countEl.style.color = 'var(--red)';
    }
  }, 1000);
}

function updateCountdownUI() {
  const countEl = document.getElementById('countdownDisplay');
  const ringEl = document.getElementById('countdownRing');
  const barEl = document.getElementById('countdownBar');

  if (countEl) countEl.textContent = `${String(paymentSecondsLeft).padStart(2, '0')}`;
  if (ringEl) {
    const pct = (paymentSecondsLeft / 60) * 100;
    const circ = 2 * Math.PI * 22; // r=22
    const offset = circ * (1 - pct / 100);
    ringEl.style.strokeDashoffset