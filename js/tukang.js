(function () {
  'use strict';
  var C = window.CONFIG, $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { user: null, proyek: [], r: null, tab: 'masuk', tgl: null, jam: 2, pid: null, lpid: null, kegM: '', kegL: '' };

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function perangkat() {
    var d = store('dev_id');
    if (!d || d.length < 16) {
      var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      d = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      store('dev_id', d);
    }
    return d;
  }
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(s) { var d = parse(s); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtJam(n) { return String(n).replace('.', ','); }
  function today() { return S.r ? S.r.hari_ini : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); }
  function minTgl() { return addDays(today(), -7); }
  function tanggalPilihan() { if (!S.tgl) S.tgl = today(); return S.tgl; }
  var tt;
  function toast(m, bad) { var t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { t.className = 'toast'; }, 3200); }
  function busy(btn, on, label) { btn.disabled = on; if (on) { btn.dataset.l = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; } else btn.innerHTML = label || btn.dataset.l || btn.innerHTML; }

  /* ---------- API (REST langsung, tanpa library) ---------- */
  function rpc(fn, args) {
    var h = { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(C.SUPABASE_ANON_KEY)) h.Authorization = 'Bearer ' + C.SUPABASE_ANON_KEY;
    return fetch(C.SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(args || {}) })
      .catch(function () { throw new Error('Tidak ada koneksi internet'); })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (j) {
          if (!res.ok) throw new Error((j && j.message) || 'Terjadi kesalahan');
          return j;
        });
      });
  }
  function auth(extra) { return Object.assign({ p_id: S.user.id, p_perangkat: perangkat() }, extra || {}); }
  function onErr(e) {
    if (/Sesi tidak valid/.test(e.message)) { keluar(); toast('Sesi berakhir, silakan masuk lagi', true); return; }
    toast(e.message, true);
  }

  /* ---------- tampilan ---------- */
  function show(v) { $('#v-login').classList.toggle('hidden', v !== 'login'); $('#v-app').classList.toggle('hidden', v !== 'app'); }
  function keluar() { store('tukang', null); S.user = null; S.r = null; S.tgl = null; S.pid = null; S.lpid = null; S.kegM = ''; S.kegL = ''; $('#in-nama').value = ''; show('login'); }

  function muat() {
    return Promise.all([rpc('daftar_proyek'), rpc('tukang_riwayat', auth())]).then(function (r) { S.proyek = r[0] || []; S.r = r[1]; });
  }
  function masukApp() {
    show('app'); $('#page').innerHTML = '<p class="empty"><span class="spinner spinner-dark"></span></p>';
    muat().then(function () { render(); }).catch(function (e) { if (/Sesi/.test(e.message)) onErr(e); else { toast(e.message, true); render(); } });
  }

  function kalender() {
    var tg = tanggalPilihan();
    return '<label class="field"><span>Tanggal</span><input type="date" id="in-tgl" value="' + tg + '" min="' + minTgl() + '" max="' + today() + '"></label>' +
      '<p class="tglnama">' + fmt(tg) + (tg === today() ? ' (hari ini)' : '') + '</p>';
  }

  function render() {
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === S.tab); });
    var el = $('#page');
    if (S.tab === 'masuk') { el.innerHTML = vMasuk(); initPick(); }
    else if (S.tab === 'lembur') { el.innerHTML = vLembur(); cekLemburAda(); }
    else el.innerHTML = vRiwayat();
    window.scrollTo(0, 0);
  }

  function vMasuk() {
    var tg = tanggalPilihan();
    var ada = S.r.absensi.filter(function (a) { return a.tanggal === tg; });
    var st = ada.length ? '<div class="status">Sudah masuk pada <b>' + fmt(tg) + '</b>:<br>' + ada.map(function (a) { return '• ' + esc(a.proyek); }).join('<br>') + '</div>' : '';
    var h = '<h2 class="hello">Hi Pak ' + esc(S.user.nama) + '</h2><p class="lead">Jangan lupa absen hari ini. Pilih hari dan proyek yang dikerjakan.</p>' + kalender() + st;
    if (!S.proyek.length) return h + '<p class="alert alert-bad">Belum ada proyek. Hubungi admin.</p>';
    return h + '<label class="field"><span>Proyek</span><input id="in-proyek" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ketik untuk mencari proyek"></label>' +
      '<div id="pick" class="pick hidden"></div>' +
      '<label class="field"><span>Kegiatan</span><textarea id="in-keg-m" rows="3" maxlength="200" placeholder="Isi sesuai pekerjaan hari ini, contoh: pasang elektrikal">' + esc(S.kegM) + '</textarea></label>' +
      '<button id="btn-masuk" class="btn btn-primary btn-lg btn-block" type="button">Masuk</button>' +
      '<p class="muted small center" style="margin-top:12px">Berganti proyek di hari yang sama? Catat lagi dengan proyek lain.</p>';
  }

  /* pencarian proyek */
  function namaProyek(id) { var p = S.proyek.filter(function (x) { return x.id === id; })[0]; return p ? p.nama : ''; }
  function initPick() {
    var inp = $('#in-proyek'); if (!inp) return;
    var last = +store('last_proyek'); if (last && namaProyek(last)) { S.pid = last; inp.value = namaProyek(last); } else S.pid = null;
  }
  function renderPick(tampil) {
    var box = $('#pick'), inp = $('#in-proyek'); if (!box) return;
    if (!tampil) { box.classList.add('hidden'); return; }
    var q = inp.value.trim().toLowerCase();
    var hasil = S.proyek.filter(function (p) { return !q || p.nama.toLowerCase().indexOf(q) >= 0; }).slice(0, 30);
    box.innerHTML = hasil.length ? hasil.map(function (p) { return '<button type="button" data-pid="' + p.id + '" class="' + (S.pid === p.id ? 'on' : '') + '">' + esc(p.nama) + (S.pid === p.id ? '<span>✓</span>' : '') + '</button>'; }).join('') : '<div class="none">Proyek tidak ditemukan</div>';
    box.classList.remove('hidden');
  }

  function vLembur() {
    var tg = tanggalPilihan();
    var ops = S.r.absensi.filter(function (a) { return a.tanggal === tg; });
    var h = '<h2>Input Lembur</h2><p class="lead">Jam kerja biasa 08.00–17.00. Isi jam di luar itu.</p>' + kalender();
    if (!ops.length) return h + '<p class="alert alert-bad">Belum ada catatan masuk pada ' + fmt(tg) + '. Catat masuk dulu di menu Masuk.</p>';
    var list = [];
    S.proyek.forEach(function (p) { if (ops.some(function (a) { return a.proyek === p.nama; })) list.push(p); });
    ops.forEach(function (a) { if (!list.some(function (p) { return p.nama === a.proyek; })) { var pp = S.proyek.filter(function (p) { return p.nama === a.proyek; })[0]; if (pp) list.push(pp); } });
    if (!list.some(function (p) { return p.id === S.lpid; })) S.lpid = list.length ? list[0].id : null;
    return h + '<div class="field"><span>Proyek</span></div><div class="pick" style="margin-top:0">' + list.map(function (p) { return '<button type="button" data-lp="' + p.id + '" class="' + (S.lpid === p.id ? 'on' : '') + '">' + esc(p.nama) + (S.lpid === p.id ? '<span>✓</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="field"><span>Jumlah jam lembur</span></div>' +
      '<div class="stepper"><button type="button" id="jam-min" aria-label="Kurangi">−</button><output id="jam-out">' + fmtJam(S.jam) + ' <small>jam</small></output><button type="button" id="jam-plus" aria-label="Tambah">+</button></div>' +
      '<label class="field"><span>Kegiatan lembur</span><textarea id="in-keg-l" rows="3" maxlength="200" placeholder="Isi sesuai pekerjaan saat lembur, contoh: pasang elektrikal">' + esc(S.kegL) + '</textarea></label>' +
      '<p id="lembur-ada" class="muted small" style="margin-bottom:14px"></p>' +
      '<button id="btn-lembur" class="btn btn-primary btn-lg btn-block" type="button">Simpan Lembur</button>';
  }

  function vRiwayat() {
    var by = {};
    S.r.absensi.forEach(function (a) { (by[a.tanggal] = by[a.tanggal] || { m: [], l: [] }).m.push(a); });
    S.r.lembur.forEach(function (l) { (by[l.tanggal] = by[l.tanggal] || { m: [], l: [] }).l.push(l); });
    var ds = Object.keys(by).sort().reverse();
    var h = '<h2>Riwayat</h2><p class="lead">60 hari terakhir.</p>';
    if (!ds.length) return h + '<p class="empty">Belum ada catatan masuk.</p>';
    return h + ds.map(function (d) {
      var x = by[d];
      return '<section class="day"><h3>' + fmt(d) + '</h3>' +
        x.m.map(function (a) { return row('Masuk', a.proyek, a.kegiatan, a.bisa_batal, 'absensi', a.id); }).join('') +
        x.l.map(function (l) { return row('Lembur ' + fmtJam(l.jam) + ' jam', l.proyek, l.kegiatan, l.bisa_batal, 'lembur', l.id); }).join('') + '</section>';
    }).join('');
  }
  function row(judul, proyek, kegiatan, bisa, jenis, id) {
    return '<div class="row"><div class="t"><b>' + esc(judul) + '</b><span>' + esc(proyek) + '</span>' + (kegiatan ? '<span style="display:block;color:var(--ink);margin-top:2px">' + esc(kegiatan) + '</span>' : '') + '</div>' +
      (bisa ? '<button class="btn btn-danger btn-sm" data-batal="' + jenis + ':' + id + '" type="button">Batal</button>' : '') + '</div>';
  }

  function cekLemburAda() {
    var o = $('#lembur-ada'); if (!o) return;
    var nm = namaProyek(S.lpid), tg = tanggalPilihan();
    var l = S.r.lembur.filter(function (x) { return x.tanggal === tg && x.proyek === nm; })[0];
    o.textContent = l ? 'Sudah tercatat ' + fmtJam(l.jam) + ' jam. Menyimpan akan mengganti jumlah itu.' : '';
  }

  /* ---------- aksi ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; render(); return; }
    if (t.dataset.pid) { S.pid = +t.dataset.pid; $('#in-proyek').value = namaProyek(S.pid); renderPick(false); return; }
    if (t.dataset.lp) { S.lpid = +t.dataset.lp; render(); return; }
    if (t.id === 'jam-min') { S.jam = Math.max(0.5, S.jam - 0.5); $('#jam-out').firstChild.nodeValue = fmtJam(S.jam) + ' '; return; }
    if (t.id === 'jam-plus') { S.jam = Math.min(12, S.jam + 0.5); $('#jam-out').firstChild.nodeValue = fmtJam(S.jam) + ' '; return; }
    if (t.id === 'btn-masuk') {
      if (!S.pid) { toast('Pilih proyek dari daftar', true); $('#in-proyek').focus(); return; }
      if (S.kegM.trim().length < 3) { toast('Isi kegiatan terlebih dahulu', true); $('#in-keg-m').focus(); return; }
      store('last_proyek', String(S.pid)); busy(t, true);
      rpc('tukang_absen', auth({ p_tanggal: tanggalPilihan(), p_proyek: S.pid, p_kegiatan: S.kegM.trim() })).then(muat).then(function () { S.kegM = ''; toast('Masuk tercatat ✓'); render(); }).catch(function (er) { busy(t, false); onErr(er); });
    }
    if (t.id === 'btn-lembur') {
      if (S.kegL.trim().length < 3) { toast('Isi kegiatan lembur terlebih dahulu', true); $('#in-keg-l').focus(); return; }
      busy(t, true);
      rpc('tukang_lembur', auth({ p_tanggal: tanggalPilihan(), p_proyek: S.lpid, p_jam: S.jam, p_kegiatan: S.kegL.trim() })).then(muat).then(function () { S.kegL = ''; toast('Lembur tersimpan ✓'); render(); }).catch(function (er) { busy(t, false); onErr(er); });
    }
    if (t.dataset.batal) {
      var p = t.dataset.batal.split(':'); if (!confirm('Batalkan catatan ini?')) return; busy(t, true);
      rpc('tukang_batal', auth({ p_jenis: p[0], p_item: +p[1] })).then(muat).then(function () { toast('Dibatalkan'); render(); }).catch(function (er) { busy(t, false); onErr(er); });
    }
    if (t.id === 'btn-keluar') keluar();
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'in-tgl') return;
    var v = e.target.value;
    if (!v || v < minTgl() || v > today()) { toast('Pilih tanggal dari 7 hari terakhir sampai hari ini', true); e.target.value = tanggalPilihan(); return; }
    S.tgl = v; render();
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'in-keg-m') { S.kegM = e.target.value; return; }
    if (e.target.id === 'in-keg-l') { S.kegL = e.target.value; return; }
    if (e.target.id !== 'in-proyek') return;
    if (S.pid && namaProyek(S.pid) !== e.target.value) S.pid = null;
    renderPick(true);
  });
  document.addEventListener('focusin', function (e) { if (e.target.id === 'in-proyek') { e.target.select(); renderPick(true); } });
  document.addEventListener('click', function (e) { if (!e.target.closest('#pick') && e.target.id !== 'in-proyek') renderPick(false); });

  $('#f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var nama = $('#in-nama').value.trim(), err = $('#login-err'), btn = $('#btn-login');
    err.classList.add('hidden');
    if (!nama) { err.textContent = 'Nama harus diisi'; err.classList.remove('hidden'); return; }
    busy(btn, true);
    rpc('tukang_login', { p_nama: nama, p_perangkat: perangkat() }).then(function (u) {
      S.user = u; store('tukang', JSON.stringify(u)); busy(btn, false, 'Masuk'); S.tab = 'masuk'; S.tgl = null; masukApp();
    }).catch(function (er) { busy(btn, false, 'Masuk'); err.textContent = er.message; err.classList.remove('hidden'); });
  });

  /* ---------- mulai ---------- */
  if (!C || /PASTE_/.test(C.SUPABASE_URL)) { show('login'); $('#login-err').textContent = 'Aplikasi belum dikonfigurasi (js/config.js)'; $('#login-err').classList.remove('hidden'); return; }
  try { S.user = JSON.parse(store('tukang') || 'null'); } catch (e) { S.user = null; }
  if (S.user && S.user.id) masukApp(); else show('login');
})();
