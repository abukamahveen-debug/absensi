(function () {
  'use strict';
  var C = window.CONFIG, $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { user: null, proyek: [], r: null, tab: 'masuk', tgl: 0, jam: 2 }; // tgl: 0 = hari ini, 1 = kemarin

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
  function fmt(s) { var d = parse(s); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtJam(n) { return String(n).replace('.', ','); }
  function today() { return S.r ? S.r.hari_ini : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); }
  function tanggalPilihan() { var d = parse(today()); d.setDate(d.getDate() - S.tgl); return iso(d); }
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
  function keluar() { store('tukang', null); S.user = null; S.r = null; $('#in-nama').value = ''; show('login'); }

  function muat() {
    return Promise.all([rpc('daftar_proyek'), rpc('tukang_riwayat', auth())]).then(function (r) { S.proyek = r[0] || []; S.r = r[1]; });
  }
  function masukApp() {
    $('#who-nama').textContent = S.user.nama; $('#who-jabatan').textContent = S.user.jabatan || 'Tukang';
    show('app'); $('#page').innerHTML = '<p class="empty"><span class="spinner spinner-dark"></span></p>';
    muat().then(function () { render(); }).catch(function (e) { if (/Sesi/.test(e.message)) onErr(e); else { toast(e.message, true); render(); } });
  }

  function opsiProyek(list, sel) {
    return list.map(function (p) { return '<option value="' + p.id + '"' + (String(p.id) === String(sel) ? ' selected' : '') + '>' + esc(p.nama) + '</option>'; }).join('');
  }
  function segTanggal() {
    var h = parse(today()), k = new Date(h); k.setDate(k.getDate() - 1);
    function b(i, t, d) { return '<button type="button" data-tgl="' + i + '" class="' + (S.tgl === i ? 'on' : '') + '">' + t + '<small>' + d.getDate() + ' ' + BLN[d.getMonth()] + '</small></button>'; }
    return '<div class="seg">' + b(0, 'Hari ini', h) + b(1, 'Kemarin', k) + '</div>';
  }

  function render() {
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === S.tab); });
    var el = $('#page');
    if (S.tab === 'masuk') el.innerHTML = vMasuk();
    else if (S.tab === 'lembur') el.innerHTML = vLembur();
    else el.innerHTML = vRiwayat();
    window.scrollTo(0, 0);
  }

  function vMasuk() {
    var tg = tanggalPilihan();
    var ada = S.r.absensi.filter(function (a) { return a.tanggal === tg; });
    var st = ada.length ? '<div class="status">Sudah masuk pada <b>' + fmt(tg) + '</b>:<br>' + ada.map(function (a) { return '• ' + esc(a.proyek); }).join('<br>') + '</div>' : '';
    var h = '<h2>Catat Masuk</h2><p class="lead">Pilih hari dan proyek yang dikerjakan.</p>' + segTanggal() + st;
    if (!S.proyek.length) return h + '<p class="alert alert-bad">Belum ada proyek. Hubungi admin.</p>';
    return h + '<label class="field"><span>Proyek</span><select id="sel-proyek">' + opsiProyek(S.proyek, store('last_proyek')) + '</select></label>' +
      '<button id="btn-masuk" class="btn btn-primary btn-lg btn-block" type="button">Catat Masuk</button>' +
      '<p class="muted small center" style="margin-top:12px">Berganti proyek di hari yang sama? Catat lagi dengan proyek lain.</p>';
  }

  function vLembur() {
    var tg = tanggalPilihan();
    var ops = S.r.absensi.filter(function (a) { return a.tanggal === tg; });
    var h = '<h2>Input Lembur</h2><p class="lead">Jam kerja biasa 08.00–17.00. Isi jam di luar itu.</p>' + segTanggal();
    if (!ops.length) return h + '<p class="alert alert-bad">Belum ada catatan masuk pada ' + fmt(tg) + '. Catat masuk dulu di menu Masuk.</p>';
    var uniq = {}, list = [];
    S.proyek.forEach(function (p) { ops.forEach(function (a) { if (a.proyek === p.nama && !uniq[p.id]) { uniq[p.id] = 1; list.push(p); } }); });
    return h + '<label class="field"><span>Proyek</span><select id="sel-lembur">' + opsiProyek(list) + '</select></label>' +
      '<div class="field"><span>Jumlah jam lembur</span></div>' +
      '<div class="stepper"><button type="button" id="jam-min" aria-label="Kurangi">−</button><output id="jam-out">' + fmtJam(S.jam) + ' <small>jam</small></output><button type="button" id="jam-plus" aria-label="Tambah">+</button></div>' +
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
        x.m.map(function (a) { return row('Masuk', a.proyek, a.bisa_batal, 'absensi', a.id); }).join('') +
        x.l.map(function (l) { return row('Lembur ' + fmtJam(l.jam) + ' jam', l.proyek, l.bisa_batal, 'lembur', l.id); }).join('') + '</section>';
    }).join('');
  }
  function row(judul, proyek, bisa, jenis, id) {
    return '<div class="row"><div class="t"><b>' + esc(judul) + '</b><span>' + esc(proyek) + '</span></div>' +
      (bisa ? '<button class="btn btn-danger btn-sm" data-batal="' + jenis + ':' + id + '" type="button">Batal</button>' : '') + '</div>';
  }

  function cekLemburAda() {
    var s = $('#sel-lembur'), o = $('#lembur-ada'); if (!s || !o) return;
    var nm = (S.proyek.filter(function (p) { return String(p.id) === s.value; })[0] || {}).nama, tg = tanggalPilihan();
    var l = S.r.lembur.filter(function (x) { return x.tanggal === tg && x.proyek === nm; })[0];
    o.textContent = l ? 'Sudah tercatat ' + fmtJam(l.jam) + ' jam. Menyimpan akan mengganti jumlah itu.' : '';
  }

  /* ---------- aksi ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; render(); cekLemburAda(); return; }
    if (t.dataset.tgl !== undefined) { S.tgl = +t.dataset.tgl; render(); cekLemburAda(); return; }
    if (t.id === 'jam-min') { S.jam = Math.max(0.5, S.jam - 0.5); $('#jam-out').firstChild.nodeValue = fmtJam(S.jam) + ' '; return; }
    if (t.id === 'jam-plus') { S.jam = Math.min(12, S.jam + 0.5); $('#jam-out').firstChild.nodeValue = fmtJam(S.jam) + ' '; return; }
    if (t.id === 'btn-masuk') {
      var pid = +$('#sel-proyek').value; store('last_proyek', String(pid)); busy(t, true);
      rpc('tukang_absen', auth({ p_tanggal: tanggalPilihan(), p_proyek: pid })).then(muat).then(function () { toast('Masuk tercatat ✓'); render(); }).catch(function (er) { busy(t, false); onErr(er); });
    }
    if (t.id === 'btn-lembur') {
      busy(t, true);
      rpc('tukang_lembur', auth({ p_tanggal: tanggalPilihan(), p_proyek: +$('#sel-lembur').value, p_jam: S.jam })).then(muat).then(function () { toast('Lembur tersimpan ✓'); render(); cekLemburAda(); }).catch(function (er) { busy(t, false); onErr(er); });
    }
    if (t.dataset.batal) {
      var p = t.dataset.batal.split(':'); if (!confirm('Batalkan catatan ini?')) return; busy(t, true);
      rpc('tukang_batal', auth({ p_jenis: p[0], p_item: +p[1] })).then(muat).then(function () { toast('Dibatalkan'); render(); }).catch(function (er) { busy(t, false); onErr(er); });
    }
    if (t.id === 'btn-keluar') keluar();
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'sel-lembur') cekLemburAda(); });

  $('#f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var nama = $('#in-nama').value.trim(), err = $('#login-err'), btn = $('#btn-login');
    err.classList.add('hidden');
    if (!nama) { err.textContent = 'Nama harus diisi'; err.classList.remove('hidden'); return; }
    busy(btn, true);
    rpc('tukang_login', { p_nama: nama, p_perangkat: perangkat() }).then(function (u) {
      S.user = u; store('tukang', JSON.stringify(u)); busy(btn, false, 'Masuk'); S.tab = 'masuk'; S.tgl = 0; masukApp();
    }).catch(function (er) { busy(btn, false, 'Masuk'); err.textContent = er.message; err.classList.remove('hidden'); });
  });

  /* ---------- mulai ---------- */
  if (!C || /PASTE_/.test(C.SUPABASE_URL)) { show('login'); $('#login-err').textContent = 'Aplikasi belum dikonfigurasi (js/config.js)'; $('#login-err').classList.remove('hidden'); return; }
  try { S.user = JSON.parse(store('tukang') || 'null'); } catch (e) { S.user = null; }
  if (S.user && S.user.id) masukApp(); else show('login');
})();
