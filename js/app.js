/**
 * Aplikasi Absensi - PT. Ecolum Pandu Aluvia
 * Satu halaman (SPA) tanpa framework. Bergantung pada config.js dan api.js.
 */
(function () {
  'use strict';

  // ============================================================
  //  Helper umum
  // ============================================================
  const $ = function (sel, el) { return (el || document).querySelector(sel); };
  const $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  const ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>'
  };

  function icon(name) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  let toastTimer;
  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 4000);
  }

  async function withBusy(btn, fn) {
    if (!btn || btn.classList.contains('is-busy')) return;
    const wasDisabled = btn.disabled;
    btn.classList.add('is-busy');
    btn.disabled = true;
    try { return await fn(); }
    finally {
      btn.classList.remove('is-busy');
      btn.disabled = wasDisabled;
    }
  }

  function badge(status) {
    const map = {
      Hadir: 'b-ok', Telat: 'b-warn', Izin: 'b-info', Sakit: 'b-info', Cuti: 'b-info',
      Alpha: 'b-bad', Menunggu: 'b-warn', Disetujui: 'b-ok', Ditolak: 'b-bad'
    };
    return '<span class="badge ' + (map[status] || 'b-muted') + '">' + esc(status || '-') + '</span>';
  }

  // ---------- Tanggal & waktu (selalu zona waktu Jakarta) ----------
  function nowParts() {
    const tz = CONFIG.TIMEZONE;
    const d = new Date();
    return {
      time: d.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false }),
      date: d.toLocaleDateString('en-CA', { timeZone: tz }), // yyyy-mm-dd
      long: d.toLocaleDateString('id-ID', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    };
  }

  function greeting() {
    const h = parseInt(nowParts().time.slice(0, 2), 10);
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  function parseYmd(s) {
    const a = String(s).split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]);
  }

  function fmtTgl(s) {
    if (!s) return '-';
    const d = parseYmd(s);
    return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtJam(v) {
    if (!v) return '—';
    const s = String(v);
    return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : s;
  }

  function fmtWaktuIso(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return '';
    return d.toLocaleString('id-ID', { timeZone: CONFIG.TIMEZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function initials(nama) {
    return String(nama || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ============================================================
  //  State & navigasi
  // ============================================================
  const state = {
    user: null,
    status: null,
    tab: 'absen',
    run: 0,
    clock: null,
    pos: null,
    posError: null,
    posLoading: false,
    adminTab: 'rekap',
    bulanRiwayat: null,
    bulanRekap: null
  };

  function loadingHtml() {
    return '<div class="empty"><span class="spinner spinner-dark"></span></div>';
  }

  function errorHtml(msg) {
    return '<div class="card center"><p style="margin-bottom:14px">' + esc(msg) + '</p>' +
      '<button class="btn btn-ghost" id="btn-retry">Coba lagi</button></div>';
  }

  function emptyHtml(text) {
    return '<div class="empty">' + icon('inbox') + '<p>' + esc(text) + '</p></div>';
  }

  function showView(name) {
    $('#view-login').classList.toggle('hidden', name !== 'login');
    $('#view-app').classList.toggle('hidden', name !== 'app');
    const s = $('#splash');
    s.classList.add('out');
    setTimeout(function () { s.classList.add('hidden'); }, 350);
  }

  function showLogin(msg) {
    clearInterval(state.clock);
    showView('login');
    $('#login-pin').value = '';
    const err = $('#login-error');
    if (msg) { err.textContent = msg; err.classList.remove('hidden'); } else { err.classList.add('hidden'); }
  }

  function logout(msg) {
    Session.clear();
    state.user = null; state.status = null; state.pos = null;
    state.run++;
    showLogin(msg);
  }

  function handleError(e) {
    if (e && e.logout) { logout(e.message); return; }
    toast((e && e.message) || 'Terjadi kesalahan', 'error');
  }

  function buildShell() {
    const u = state.user;
    const items = [
      ['absen', 'Absen', 'clock'],
      ['riwayat', 'Riwayat', 'calendar'],
      ['izin', 'Izin', 'file'],
      ['profil', 'Profil', 'user']
    ];
    if (u.role === 'admin') items.push(['admin', 'Admin', 'shield']);

    $('#nav').innerHTML = items.map(function (it) {
      return '<button class="nav-item" data-tab="' + it[0] + '">' + icon(it[2]) + '<span>' + it[1] + '</span></button>';
    }).join('');
    $$('#nav .nav-item').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.tab); });
    });

    $('#user-avatar').textContent = initials(u.nama);
    $('#user-name').textContent = u.nama;
    $('#btn-logout').innerHTML = icon('logout') + '<span>Keluar</span>';
  }

  const PAGES = {};

  async function go(tab) {
    state.tab = tab;
    clearInterval(state.clock);
    const run = ++state.run;

    $$('#nav .nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    const page = $('#page');
    page.classList.toggle('wide', tab === 'admin');
    page.innerHTML = loadingHtml();
    window.scrollTo(0, 0);

    try {
      await PAGES[tab](run);
    } catch (e) {
      if (run !== state.run) return;
      if (e.logout) return handleError(e);
      page.innerHTML = errorHtml(e.message);
      const r = $('#btn-retry');
      if (r) r.onclick = function () { go(tab); };
    }
  }

  async function enterApp() {
    buildShell();
    showView('app');
    await go('absen');
  }

  // ============================================================
  //  Dialog umum
  // ============================================================
  function openDialog(opts) {
    const modal = $('#dialog'), form = $('#dialog-form'), err = $('#dialog-error'), ok = $('#dialog-ok');
    $('#dialog-title').textContent = opts.title;
    $('#dialog-body').innerHTML = opts.body || '';
    ok.textContent = opts.okText || 'Simpan';
    ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    err.classList.add('hidden');
    modal.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    const first = $('input, select, textarea', form);
    if (first) setTimeout(function () { first.focus(); }, 60);

    function close() {
      modal.classList.add('hidden');
      document.body.classList.remove('no-scroll');
    }

    $('#dialog-cancel').onclick = close;
    modal.onclick = function (e) { if (e.target === modal) close(); };
    form.onsubmit = async function (e) {
      e.preventDefault();
      err.classList.add('hidden');
      const data = {};
      $$('input, select, textarea', form).forEach(function (el) { if (el.name) data[el.name] = el.value.trim(); });
      try {
        await withBusy(ok, function () { return opts.onSubmit(data); });
        close();
      } catch (ex) {
        if (ex.logout) { close(); return handleError(ex); }
        err.textContent = ex.message;
        err.classList.remove('hidden');
      }
    };
  }

  // ============================================================
  //  Kamera selfie
  // ============================================================
  function openCamera() {
    return new Promise(async function (resolve) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Kamera tidak didukung. Buka aplikasi lewat alamat https.', 'error');
        return resolve(null);
      }

      const modal = $('#cam'), video = $('#cam-video'), canvas = $('#cam-canvas');
      const bShoot = $('#cam-shoot'), bRetake = $('#cam-retake'), bSend = $('#cam-send'), bCancel = $('#cam-cancel');
      let stream = null, dataUrl = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } },
          audio: false
        });
      } catch (e) {
        toast('Kamera tidak dapat diakses. Izinkan akses kamera di pengaturan browser.', 'error');
        return resolve(null);
      }

      function mode(m) {
        const review = m === 'review';
        video.classList.toggle('hidden', review);
        canvas.classList.toggle('hidden', !review);
        bShoot.classList.toggle('hidden', review);
        bRetake.classList.toggle('hidden', !review);
        bSend.classList.toggle('hidden', !review);
        bCancel.classList.toggle('hidden', review);
        $('#cam-hint').textContent = review ? 'Foto sudah siap. Kirim atau ulangi.' : 'Pastikan wajah terlihat jelas, lalu ambil foto.';
      }

      function finish(val) {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        video.srcObject = null;
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll');
        resolve(val);
      }

      video.srcObject = stream;
      mode('live');
      modal.classList.remove('hidden');
      document.body.classList.add('no-scroll');
      try { await video.play(); } catch (e) { /* autoplay */ }

      bShoot.onclick = function () {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) { toast('Kamera belum siap, tunggu sebentar.', 'error'); return; }
        const scale = Math.min(1, 640 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        let q = 0.72;
        dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > 1300000 && q > 0.35) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q); }
        mode('review');
      };
      bRetake.onclick = function () { dataUrl = null; mode('live'); };
      bSend.onclick = function () { finish(dataUrl); };
      bCancel.onclick = function () { finish(null); };
    });
  }

  // ============================================================
  //  Lokasi
  // ============================================================
  function getPosition(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('Perangkat tidak mendukung GPS'));
      navigator.geolocation.getCurrentPosition(
        function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }); },
        function (e) {
          reject(new Error(e.code === 1
            ? 'Izin lokasi ditolak. Aktifkan akses lokasi untuk situs ini di pengaturan browser.'
            : 'Lokasi tidak ditemukan. Pastikan GPS aktif.'));
        },
        { enableHighAccuracy: true, timeout: timeoutMs || 15000, maximumAge: 10000 }
      );
    });
  }

  async function refreshLocation() {
    state.posLoading = true; state.posError = null;
    updateAbsenUI();
    try { state.pos = await getPosition(15000); }
    catch (e) { state.posError = e.message; state.pos = null; }
    state.posLoading = false;
    if (state.tab === 'absen') updateAbsenUI();
  }

  function locInfo() {
    const st = state.status;
    if (state.posLoading) return { tone: 'load', title: 'Mencari lokasi…', detail: 'Mohon tunggu sebentar', ok: false };
    if (state.posError) {
      return { tone: st.wajibGps ? 'bad' : 'warn', title: 'Lokasi tidak tersedia', detail: state.posError, ok: !st.wajibGps };
    }
    if (!state.pos) return { tone: '', title: 'Lokasi belum diambil', detail: 'Ketuk tombol segarkan', ok: !st.wajibGps };
    if (!st.lokasi.length) {
      return { tone: 'warn', title: 'Area absen belum diatur', detail: 'Hubungi admin', ok: !st.wajibGps };
    }
    let best = null;
    st.lokasi.forEach(function (l) {
      const d = haversine(state.pos.lat, state.pos.lng, Number(l.lat), Number(l.lng));
      if (!best || d < best.d) best = { d: d, nama: l.nama, radius: Number(l.radius) };
    });
    const acc = state.pos.acc ? ' · akurasi ±' + Math.round(state.pos.acc) + ' m' : '';
    if (best.d <= best.radius) {
      return { tone: 'ok', title: 'Dalam area absen', detail: Math.round(best.d) + ' m dari ' + best.nama + acc, ok: true };
    }
    return {
      tone: 'bad', title: 'Di luar area absen',
      detail: Math.round(best.d) + ' m dari ' + best.nama + ' (maks. ' + best.radius + ' m)' + acc, ok: false
    };
  }

  // ============================================================
  //  Halaman: ABSEN
  // ============================================================
  function absenMode() {
    const a = state.status.absen;
    if (!a) return 'masuk';
    if (a.jamMasuk && !a.jamPulang) return 'pulang';
    if (a.jamMasuk && a.jamPulang) return 'selesai';
    return 'libur';
  }

  PAGES.absen = async function (run) {
    const st = await api('status');
    if (run !== state.run) return;
    state.status = st;
    state.user = Object.assign({}, state.user, st.user);
    renderAbsen();
    refreshLocation();
  };

  function absenBanner(a) {
    if (!a) return '';
    if (!a.jamMasuk) {
      return '<div class="banner banner-info">' + icon('check') + '<div><strong>Hari ini tercatat: ' + esc(a.status) + '</strong>' +
        (a.keterangan ? '<span>' + esc(a.keterangan) + '</span>' : '') + '</div></div>';
    }
    if (a.jamPulang) {
      return '<div class="banner banner-ok">' + icon('check') + '<div><strong>Absensi hari ini selesai</strong>' +
        '<span>Masuk ' + esc(fmtJam(a.jamMasuk)) + ' · Pulang ' + esc(fmtJam(a.jamPulang)) + '. Terima kasih!</span></div></div>';
    }
    return '<div class="banner ' + (a.status === 'Telat' ? 'banner-warn' : 'banner-ok') + '">' + icon('check') + '<div>' +
      '<strong>Anda sudah absen masuk</strong><span>Pukul ' + esc(fmtJam(a.jamMasuk)) +
      (a.status === 'Telat' ? ' (telat)' : '') + '. Jangan lupa absen pulang nanti.</span></div></div>';
  }

  function renderAbsen() {
    clearInterval(state.clock);
    const st = state.status, a = st.absen, sh = st.shift;
    $('#page').innerHTML =
      '<section class="hero">' +
        '<p class="hero-hello">' + greeting() + ',</p>' +
        '<h2 class="hero-name">' + esc(st.user.nama) + '</h2>' +
        '<div class="hero-clock" id="clock">--:--:--</div>' +
        '<div class="hero-date" id="today"></div>' +
      '</section>' +
      absenBanner(a) +
      '<section class="card">' +
        '<div class="stats">' +
          '<div class="stat"><span class="stat-label">Shift</span><strong>' + fmtJam(sh.jamMasuk) + '–' + fmtJam(sh.jamPulang) + '</strong></div>' +
          '<div class="stat"><span class="stat-label">Masuk</span><strong>' + (a ? fmtJam(a.jamMasuk) : '—') + '</strong></div>' +
          '<div class="stat"><span class="stat-label">Pulang</span><strong>' + (a ? fmtJam(a.jamPulang) : '—') + '</strong></div>' +
        '</div>' +
        (a ? '<div class="stat-foot">' + badge(a.status) + (a.keterangan ? '<span class="muted small">' + esc(a.keterangan) + '</span>' : '') + '</div>' : '') +
      '</section>' +
      '<section class="card"><div class="loc-row" id="loc"></div></section>' +
      '<div class="absen-actions">' +
        '<button type="button" id="btn-masuk"></button>' +
        '<button type="button" id="btn-pulang"></button>' +
      '</div>' +
      '<p class="hint" id="absen-hint"></p>';

    function tick() {
      const n = nowParts();
      const c = $('#clock'); if (!c) return;
      c.textContent = n.time;
      $('#today').textContent = n.long;
      if (n.time.slice(6, 8) === '00') updateAbsenUI();
    }
    tick();
    state.clock = setInterval(tick, 1000);

    $('#btn-masuk').addEventListener('click', function () { doAbsen('masuk'); });
    $('#btn-pulang').addEventListener('click', function () { doAbsen('pulang'); });
    updateAbsenUI();
  }

  function toMenit(str) {
    const p = String(str || '0:0').split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }

  function belumJamPulang() {
    return toMenit(nowParts().time) < toMenit(state.status.shift.jamPulang);
  }

  function updateAbsenUI() {
    const st = state.status;
    const locEl = $('#loc'), bMasuk = $('#btn-masuk'), bPulang = $('#btn-pulang'), hint = $('#absen-hint');
    if (!st || !locEl || !bMasuk || !bPulang) return;

    const li = locInfo();
    locEl.innerHTML =
      '<span class="loc-dot ' + li.tone + (li.tone === 'load' ? ' load' : '') + '"></span>' +
      '<div class="loc-text"><strong>' + esc(li.title) + '</strong><span class="muted small">' + esc(li.detail) + '</span></div>' +
      '<button class="icon-btn" id="btn-loc" type="button" aria-label="Segarkan lokasi">' + icon('refresh') + '</button>';
    $('#btn-loc').onclick = refreshLocation;

    const a = st.absen, mode = absenMode();
    const camIcon = st.wajibSelfie ? icon('camera') : '';

    function paint(btn, o) {
      if (btn.classList.contains('is-busy')) return;
      btn.className = 'btn btn-lg act ' + o.cls;
      btn.disabled = o.disabled;
      btn.innerHTML = '<span class="act-label">' + (o.icon || '') + esc(o.label) + '</span>' +
        '<span class="act-sub">' + esc(o.sub) + '</span>';
    }

    // Tombol MASUK
    if (mode === 'masuk') {
      paint(bMasuk, { cls: 'btn-primary', disabled: !li.ok, icon: camIcon, label: 'Absen Masuk', sub: 'Shift mulai ' + fmtJam(st.shift.jamMasuk) });
    } else if (a && a.jamMasuk) {
      paint(bMasuk, { cls: 'is-done', disabled: true, icon: icon('check'), label: 'Sudah masuk', sub: 'Pukul ' + fmtJam(a.jamMasuk) });
    } else {
      paint(bMasuk, { cls: 'btn-ghost', disabled: true, label: 'Absen Masuk', sub: 'Tercatat: ' + (a ? a.status : '-') });
    }

    // Tombol PULANG
    if (mode === 'pulang') {
      paint(bPulang, { cls: 'btn-primary', disabled: !li.ok, icon: camIcon, label: 'Absen Pulang', sub: 'Shift selesai ' + fmtJam(st.shift.jamPulang) });
    } else if (mode === 'selesai') {
      paint(bPulang, { cls: 'is-done', disabled: true, icon: icon('check'), label: 'Sudah pulang', sub: 'Pukul ' + fmtJam(a.jamPulang) });
    } else {
      paint(bPulang, { cls: 'btn-ghost', disabled: true, label: 'Absen Pulang', sub: mode === 'masuk' ? 'Aktif setelah absen masuk' : '—' });
    }

    let hintText = '';
    if (mode === 'masuk' || mode === 'pulang') {
      if (!li.ok) hintText = st.wajibGps ? 'Tombol aktif saat Anda berada di dalam area absen.' : '';
      else if (mode === 'pulang' && belumJamPulang()) hintText = 'Belum jam pulang (' + fmtJam(st.shift.jamPulang) + '). Jika absen sekarang, tercatat pulang lebih awal.';
      else if (st.wajibSelfie) hintText = 'Anda akan diminta mengambil foto selfie.';
    } else if (mode === 'selesai') {
      hintText = 'Sampai jumpa besok!';
    }
    hint.textContent = hintText;
  }

  async function doAbsen(kind) {
    const st = state.status, mode = absenMode(), btn = $('#btn-' + kind);
    if (!btn || mode !== kind) return;

    if (kind === 'pulang' && belumJamPulang()) {
      if (!window.confirm('Belum jam pulang (' + fmtJam(st.shift.jamPulang) + '). Tetap absen pulang sekarang?')) return;
    }

    let foto = null;
    if (st.wajibSelfie) {
      foto = await openCamera();
      if (!foto) return;
    }

    await withBusy(btn, async function () {
      // Ambil lokasi terbaru sebelum dikirim (server tetap memvalidasi ulang)
      try { state.pos = await getPosition(8000); state.posError = null; } catch (e) { /* pakai lokasi terakhir */ }

      try {
        const r = await api(kind === 'masuk' ? 'absenMasuk' : 'absenPulang', {
          lat: state.pos ? state.pos.lat : '',
          lng: state.pos ? state.pos.lng : '',
          foto: foto
        });
        toast(r.pesan, 'ok');
        state.status.absen = r.absen;   // status langsung diperbarui dari respons server
        renderAbsen();
        window.scrollTo(0, 0);
      } catch (e) {
        handleError(e);
      }
    });
    updateAbsenUI();
  }

  // ============================================================
  //  Halaman: RIWAYAT
  // ============================================================
  PAGES.riwayat = async function (run) {
    const bulan = state.bulanRiwayat || nowParts().date.slice(0, 7);
    $('#page').innerHTML =
      '<h2 class="page-title">Riwayat Absensi</h2>' +
      '<div class="card"><label class="field" style="margin:0"><span>Bulan</span>' +
      '<input type="month" id="rw-bulan" value="' + bulan + '"></label></div>' +
      '<div id="rw-body">' + loadingHtml() + '</div>';

    async function load(b) {
      state.bulanRiwayat = b;
      $('#rw-body').innerHTML = loadingHtml();
      try {
        const d = await api('getRiwayat', { bulan: b });
        if (run !== state.run) return;
        const rows = d.riwayat;
        const count = function (s) { return rows.filter(function (r) { return r.status === s; }).length; };
        if (!rows.length) { $('#rw-body').innerHTML = emptyHtml('Belum ada data absensi pada bulan ini.'); return; }

        $('#rw-body').innerHTML =
          '<div class="chips">' +
            '<span class="chip"><b>' + count('Hadir') + '</b>Hadir</span>' +
            '<span class="chip"><b>' + count('Telat') + '</b>Telat</span>' +
            '<span class="chip"><b>' + (count('Izin') + count('Sakit') + count('Cuti')) + '</b>Izin/Sakit/Cuti</span>' +
          '</div>' +
          '<div class="list">' + rows.map(function (r) {
            const dt = parseYmd(r.tanggal);
            const waktu = r.jamMasuk ? 'Masuk ' + fmtJam(r.jamMasuk) + ' · Pulang ' + fmtJam(r.jamPulang) : (r.keterangan || '');
            return '<div class="item">' +
              '<div class="item-date"><b>' + dt.getDate() + '</b><span>' + HARI[dt.getDay()] + '</span></div>' +
              '<div class="item-main"><strong>' + esc(waktu) + '</strong>' +
              (r.jamMasuk && r.keterangan ? '<span class="muted">' + esc(r.keterangan) + '</span>' : '') + '</div>' +
              '<div class="item-side">' + badge(r.status) + '</div></div>';
          }).join('') + '</div>';
      } catch (e) {
        if (run !== state.run) return;
        if (e.logout) return handleError(e);
        $('#rw-body').innerHTML = errorHtml(e.message);
        $('#btn-retry').onclick = function () { load(b); };
      }
    }

    $('#rw-bulan').addEventListener('change', function (e) { if (e.target.value) load(e.target.value); });
    await load(bulan);
  };

  // ============================================================
  //  Halaman: IZIN
  // ============================================================
  PAGES.izin = async function (run) {
    const today = nowParts().date;
    $('#page').innerHTML =
      '<h2 class="page-title">Izin, Sakit &amp; Cuti</h2>' +
      '<form class="card" id="form-izin" novalidate>' +
        '<h3 class="card-title">Ajukan baru</h3>' +
        '<label class="field"><span>Jenis</span><select name="jenis">' +
          '<option>Izin</option><option>Sakit</option><option>Cuti</option></select></label>' +
        '<div class="row2">' +
          '<label class="field"><span>Mulai</span><input type="date" name="tglMulai" value="' + today + '" required></label>' +
          '<label class="field"><span>Selesai</span><input type="date" name="tglSelesai" value="' + today + '" required></label>' +
        '</div>' +
        '<label class="field"><span>Alasan</span><textarea name="alasan" maxlength="500" placeholder="Tuliskan alasan singkat" required></textarea></label>' +
        '<p class="alert alert-bad hidden" id="izin-error"></p>' +
        '<button class="btn btn-primary btn-block" type="submit">Kirim Pengajuan</button>' +
      '</form>' +
      '<h3 class="card-title" style="margin-top:22px">Pengajuan saya</h3>' +
      '<div id="izin-list">' + loadingHtml() + '</div>';

    async function loadList() {
      try {
        const d = await api('getIzinSaya');
        if (run !== state.run) return;
        $('#izin-list').innerHTML = !d.izin.length ? emptyHtml('Belum ada pengajuan.') :
          '<div class="list">' + d.izin.map(function (z) {
            const rentang = z.tglMulai === z.tglSelesai ? fmtTgl(z.tglMulai) : fmtTgl(z.tglMulai) + ' – ' + fmtTgl(z.tglSelesai);
            return '<div class="item"><div class="item-main"><strong>' + esc(z.jenis) + ' · ' + esc(rentang) + '</strong>' +
              '<span class="muted">' + esc(z.alasan) + '</span></div>' +
              '<div class="item-side">' + badge(z.status) + '</div></div>';
          }).join('') + '</div>';
      } catch (e) {
        if (run !== state.run) return;
        if (e.logout) return handleError(e);
        $('#izin-list').innerHTML = errorHtml(e.message);
        $('#btn-retry').onclick = loadList;
      }
    }

    $('#form-izin').addEventListener('submit', async function (e) {
      e.preventDefault();
      const f = e.target, err = $('#izin-error');
      err.classList.add('hidden');
      const body = {
        jenis: f.jenis.value, tglMulai: f.tglMulai.value,
        tglSelesai: f.tglSelesai.value, alasan: f.alasan.value.trim()
      };
      await withBusy($('button[type=submit]', f), async function () {
        try {
          const r = await api('ajukanIzin', body);
          toast(r.pesan, 'ok');
          f.alasan.value = '';
          loadList();
        } catch (ex) {
          if (ex.logout) return handleError(ex);
          err.textContent = ex.message; err.classList.remove('hidden');
        }
      });
    });

    await loadList();
  };

  // ============================================================
  //  Halaman: PROFIL
  // ============================================================
  PAGES.profil = async function () {
    const u = state.user;
    $('#page').innerHTML =
      '<h2 class="page-title">Profil</h2>' +
      '<section class="card">' +
        '<div class="profile-head"><span class="avatar avatar-lg">' + esc(initials(u.nama)) + '</span>' +
        '<div><h2>' + esc(u.nama) + '</h2><p class="muted">' + esc(u.jabatan || '-') + '</p></div></div>' +
        '<dl class="kv"><dt>ID Karyawan</dt><dd>' + esc(u.id) + '</dd>' +
        '<dt>Shift</dt><dd>' + esc(u.shift || '-') + '</dd>' +
        '<dt>Peran</dt><dd>' + (u.role === 'admin' ? 'Administrator' : 'Karyawan') + '</dd></dl>' +
      '</section>' +
      '<form class="card" id="form-pin" novalidate>' +
        '<h3 class="card-title">Ubah PIN</h3>' +
        '<label class="field"><span>PIN lama</span><input type="password" inputmode="numeric" maxlength="6" name="pinLama" autocomplete="current-password" required></label>' +
        '<label class="field"><span>PIN baru</span><input type="password" inputmode="numeric" maxlength="6" name="pinBaru" autocomplete="new-password" placeholder="6 digit angka" required></label>' +
        '<label class="field"><span>Ulangi PIN baru</span><input type="password" inputmode="numeric" maxlength="6" name="pinUlang" autocomplete="new-password" required></label>' +
        '<p class="alert alert-bad hidden" id="pin-error"></p>' +
        '<button class="btn btn-primary btn-block" type="submit">Simpan PIN</button>' +
      '</form>' +
      '<button class="btn btn-ghost btn-block" id="btn-logout-2">' + icon('logout') + '<span>Keluar</span></button>';

    $('#btn-logout-2').addEventListener('click', function () { logout(); });
    $('#form-pin').addEventListener('submit', async function (e) {
      e.preventDefault();
      const f = e.target, err = $('#pin-error');
      err.classList.add('hidden');
      if (f.pinBaru.value !== f.pinUlang.value) { err.textContent = 'PIN baru dan pengulangan tidak sama'; err.classList.remove('hidden'); return; }
      await withBusy($('button[type=submit]', f), async function () {
        try {
          const r = await api('ubahPin', { pinLama: f.pinLama.value, pinBaru: f.pinBaru.value });
          toast(r.pesan, 'ok'); f.reset();
        } catch (ex) {
          if (ex.logout) return handleError(ex);
          err.textContent = ex.message; err.classList.remove('hidden');
        }
      });
    });
  };

  // ============================================================
  //  Halaman: ADMIN
  // ============================================================
  PAGES.admin = async function (run) {
    $('#page').innerHTML =
      '<h2 class="page-title">Administrasi</h2>' +
      '<div class="seg" id="seg">' +
        '<button data-t="rekap">Rekap</button><button data-t="karyawan">Karyawan</button><button data-t="izin">Persetujuan</button>' +
      '</div><div id="admin-body">' + loadingHtml() + '</div>';

    function setTab(t) {
      state.adminTab = t;
      $$('#seg button').forEach(function (b) { b.classList.toggle('active', b.dataset.t === t); });
      const fn = { rekap: adminRekap, karyawan: adminKaryawan, izin: adminIzin }[t];
      fn(run).catch(function (e) {
        if (run !== state.run) return;
        if (e.logout) return handleError(e);
        $('#admin-body').innerHTML = errorHtml(e.message);
        $('#btn-retry').onclick = function () { setTab(t); };
      });
    }
    $$('#seg button').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.t); }); });
    setTab(state.adminTab);
  };

  // ---------- Rekap ----------
  async function adminRekap(run) {
    const bulan = state.bulanRekap || nowParts().date.slice(0, 7);
    const body = $('#admin-body');
    body.innerHTML =
      '<div class="toolbar">' +
        '<label class="field"><span>Bulan</span><input type="month" id="rk-bulan" value="' + bulan + '"></label>' +
        '<button class="btn btn-ghost" id="rk-csv">' + icon('download') + '<span>Unduh CSV</span></button>' +
      '</div><div id="rk-body">' + loadingHtml() + '</div>';

    async function load(b) {
      state.bulanRekap = b;
      $('#rk-body').innerHTML = loadingHtml();
      try {
        const d = await api('getRekap', { bulan: b });
        if (run !== state.run) return;
        $('#rk-body').innerHTML = !d.rekap.length ? emptyHtml('Belum ada karyawan aktif.') :
          '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Hadir</th><th>Telat</th><th>Izin</th><th>Sakit</th><th>Cuti</th></tr></thead><tbody>' +
          d.rekap.map(function (r) {
            return '<tr><td><strong>' + esc(r.nama) + '</strong><span class="sub">' + esc(r.id) + '</span></td>' +
              '<td class="num">' + r.hadir + '</td><td class="num">' + r.telat + '</td>' +
              '<td class="num">' + r.izin + '</td><td class="num">' + r.sakit + '</td><td class="num">' + r.cuti + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="hint">"Hadir" belum termasuk yang telat. Jumlah hadir total = Hadir + Telat.</p>';
      } catch (e) {
        if (run !== state.run) return;
        if (e.logout) return handleError(e);
        $('#rk-body').innerHTML = errorHtml(e.message);
        $('#btn-retry').onclick = function () { load(b); };
      }
    }

    $('#rk-bulan').addEventListener('change', function (e) { if (e.target.value) load(e.target.value); });
    $('#rk-csv').addEventListener('click', function (e) {
      const b = $('#rk-bulan').value;
      withBusy(e.currentTarget, async function () {
        try {
          const d = await api('getRekap', { bulan: b, detail: true });
          downloadCsv(d.detail || [], b);
        } catch (ex) { handleError(ex); }
      });
    });
    await load(bulan);
  }

  function downloadCsv(rows, bulan) {
    if (!rows.length) { toast('Tidak ada data untuk diunduh', 'error'); return; }
    const head = ['ID Karyawan', 'Nama', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan', 'Foto Masuk', 'Foto Pulang'];
    const q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    const lines = [head.map(q).join(',')].concat(rows.map(function (r) {
      return [r.idKaryawan, r.nama, r.tanggal, fmtJam(r.jamMasuk) === '—' ? '' : fmtJam(r.jamMasuk),
        fmtJam(r.jamPulang) === '—' ? '' : fmtJam(r.jamPulang), r.status, r.keterangan, r.fotoMasuk, r.fotoPulang].map(q).join(',');
    }));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'absensi-' + bulan + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------- Karyawan ----------
  async function adminKaryawan(run) {
    const body = $('#admin-body');
    const d = await api('listKaryawan');
    if (run !== state.run) return;

    body.innerHTML =
      '<div class="toolbar"><button class="btn btn-primary" id="kr-add">+ Tambah Karyawan</button></div>' +
      '<div class="list">' + d.karyawan.map(function (k) {
        const aktif = k.status === 'Aktif';
        return '<div class="item" style="align-items:flex-start">' +
          '<span class="avatar">' + esc(initials(k.nama)) + '</span>' +
          '<div class="item-main"><strong>' + esc(k.nama) + '</strong>' +
          '<span class="muted">' + esc(k.id) + ' · ' + esc(k.jabatan || '-') + ' · ' + esc(k.shift || '-') + (k.role === 'admin' ? ' · Admin' : '') + '</span>' +
          '<div class="item-actions">' +
            '<button class="btn btn-ghost btn-sm" data-act="pin" data-id="' + esc(k.id) + '" data-nama="' + esc(k.nama) + '">Reset PIN</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="status" data-id="' + esc(k.id) + '" data-nama="' + esc(k.nama) + '" data-to="' + (aktif ? 'Nonaktif' : 'Aktif') + '">' + (aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
          '</div></div>' +
          '<div class="item-side"><span class="badge ' + (aktif ? 'b-ok' : 'b-muted') + '">' + esc(k.status) + '</span></div></div>';
      }).join('') + '</div>';

    $('#kr-add').addEventListener('click', function () {
      openDialog({
        title: 'Tambah Karyawan',
        okText: 'Tambahkan',
        body:
          '<label class="field"><span>ID Karyawan</span><input name="idKaryawan" autocapitalize="characters" placeholder="contoh: KRY002" required></label>' +
          '<label class="field"><span>Nama lengkap</span><input name="nama" required></label>' +
          '<div class="row2">' +
            '<label class="field"><span>Jabatan</span><input name="jabatan"></label>' +
            '<label class="field"><span>Shift</span><input name="shift" value="Reguler"></label>' +
          '</div>' +
          '<div class="row2">' +
            '<label class="field"><span>Peran</span><select name="role"><option value="karyawan">Karyawan</option><option value="admin">Admin</option></select></label>' +
            '<label class="field"><span>PIN awal</span><input name="pin" inputmode="numeric" maxlength="6" placeholder="6 digit" required></label>' +
          '</div>',
        onSubmit: async function (data) {
          await api('tambahKaryawan', data);
          toast('Karyawan ditambahkan', 'ok');
          adminKaryawan(run);
        }
      });
    });

    $$('[data-act]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.dataset.id, nama = b.dataset.nama;
        if (b.dataset.act === 'pin') {
          openDialog({
            title: 'Reset PIN · ' + nama,
            okText: 'Reset PIN',
            body: '<label class="field"><span>PIN baru</span><input name="pinBaru" inputmode="numeric" maxlength="6" placeholder="6 digit angka" required></label>',
            onSubmit: async function (data) {
              await api('resetPin', { idKaryawan: id, pinBaru: data.pinBaru });
              toast('PIN direset', 'ok');
            }
          });
        } else {
          const to = b.dataset.to;
          openDialog({
            title: to === 'Nonaktif' ? 'Nonaktifkan karyawan?' : 'Aktifkan karyawan?',
            okText: to === 'Nonaktif' ? 'Nonaktifkan' : 'Aktifkan',
            danger: to === 'Nonaktif',
            body: '<p class="muted" style="margin-bottom:16px">' + esc(nama) + ' (' + esc(id) + ') ' +
              (to === 'Nonaktif' ? 'tidak akan bisa login lagi sampai diaktifkan kembali.' : 'akan bisa login kembali.') + '</p>',
            onSubmit: async function () {
              await api('setStatusKaryawan', { idKaryawan: id, status: to });
              toast('Status diperbarui', 'ok');
              adminKaryawan(run);
            }
          });
        }
      });
    });
  }

  // ---------- Persetujuan izin ----------
  async function adminIzin(run) {
    const body = $('#admin-body');
    const d = await api('listIzin');
    if (run !== state.run) return;
    if (!d.izin.length) { body.innerHTML = emptyHtml('Belum ada pengajuan.'); return; }

    const sorted = d.izin.slice().sort(function (a, b) {
      return (a.status === 'Menunggu' ? 0 : 1) - (b.status === 'Menunggu' ? 0 : 1);
    });

    body.innerHTML = '<div class="list">' + sorted.map(function (z) {
      const rentang = z.tglMulai === z.tglSelesai ? fmtTgl(z.tglMulai) : fmtTgl(z.tglMulai) + ' – ' + fmtTgl(z.tglSelesai);
      const aksi = z.status === 'Menunggu'
        ? '<div class="item-actions">' +
            '<button class="btn btn-primary btn-sm" data-keputusan="Disetujui" data-id="' + esc(z.idIzin) + '" data-nama="' + esc(z.nama) + '">Setujui</button>' +
            '<button class="btn btn-ghost btn-sm" data-keputusan="Ditolak" data-id="' + esc(z.idIzin) + '" data-nama="' + esc(z.nama) + '">Tolak</button></div>'
        : '';
      return '<div class="item" style="align-items:flex-start"><div class="item-main">' +
        '<strong>' + esc(z.nama) + ' · ' + esc(z.jenis) + '</strong>' +
        '<span class="muted">' + esc(rentang) + '</span>' +
        '<span class="muted">' + esc(z.alasan) + '</span>' +
        '<span class="muted small">Diajukan ' + esc(fmtWaktuIso(z.timestamp)) + '</span>' + aksi + '</div>' +
        '<div class="item-side">' + badge(z.status) + '</div></div>';
    }).join('') + '</div>';

    $$('[data-keputusan]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        const k = b.dataset.keputusan;
        openDialog({
          title: k === 'Disetujui' ? 'Setujui pengajuan?' : 'Tolak pengajuan?',
          okText: k === 'Disetujui' ? 'Setujui' : 'Tolak',
          danger: k === 'Ditolak',
          body: '<p class="muted" style="margin-bottom:16px">Pengajuan dari ' + esc(b.dataset.nama) + '. ' +
            (k === 'Disetujui' ? 'Hari yang diajukan akan otomatis tercatat di data absensi.' : 'Karyawan akan melihat statusnya ditolak.') + '</p>',
          onSubmit: async function () {
            const r = await api('putuskanIzin', { idIzin: b.dataset.id, keputusan: k });
            toast(r.pesan, 'ok');
            adminIzin(run);
          }
        });
      });
    });
  }

  // ============================================================
  //  Login & boot
  // ============================================================
  function bindStatic() {
    $('#btn-logout').addEventListener('click', function () { logout(); });

    $('#login-pin').addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    $('#form-login').addEventListener('submit', async function (e) {
      e.preventDefault();
      const id = $('#login-id').value.trim(), pin = $('#login-pin').value;
      const err = $('#login-error');
      err.classList.add('hidden');
      if (!id || !pin) { err.textContent = 'ID dan PIN wajib diisi'; err.classList.remove('hidden'); return; }

      await withBusy($('#btn-login'), async function () {
        try {
          const d = await api('login', { idKaryawan: id, pin: pin }, { auth: false });
          Session.save(d.token, d.user);
          state.user = d.user;
          await enterApp();
        } catch (ex) {
          err.textContent = ex.message; err.classList.remove('hidden');
          $('#login-pin').value = '';
        }
      });
    });
  }

  async function boot() {
    bindStatic();
    const s = Session.load();
    if (!s) return showLogin();
    state.user = s.user;
    try {
      await enterApp();
    } catch (e) {
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
