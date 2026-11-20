(function () {
  'use strict';
  var C = window.CONFIG, $ = function (s, r) { return (r || document).querySelector(s); };
  var sb = null;
  var S = { tab: 'tukang', tukang: [], proyek: [], usaha: { nama_usaha: 'PT. Ecolum Pandu Aluvia', alamat_usaha: '' }, f: null, gajiMulai: null, slipCache: [] };
  var TABS = [['tukang', 'Data Tukang'], ['proyek', 'Data Proyek'], ['absensi', 'Absensi'], ['lembur', 'Lembur'], ['gaji', 'Slip Gaji'], ['laporan', 'Laporan Absensi']];

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(s) { var d = parse(s); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtS(s) { var d = parse(s); return d.getDate() + ' ' + BLN[d.getMonth()]; }
  function fmtL(s) { var d = parse(s); return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); }
  function rp(n) { return 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID'); }
  function jam(n) { return String(+n).replace('.', ','); }
  function todayStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); }
  function periodeStart(s) { var d = parse(s); return addDays(s, -((d.getDay() - 5 + 7) % 7)); } // Jumat
  var tt;
  function toast(m, bad) { var t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { t.className = 'toast'; }, 3500); }
  function ok(r) { if (r.error) throw r.error; return r.data; }
  function fail(e) { toast(e.message || 'Terjadi kesalahan', true); }
  function loading() { $('#page').innerHTML = '<p class="muted center" style="padding:40px"><span class="spinner spinner-dark"></span></p>'; }

  /* ---------- dialog ---------- */
  function dialog(o) {
    var d = $('#dialog'), f = $('#dlg-form'), err = $('#dlg-err'), okb = $('#dlg-ok');
    $('#dlg-title').textContent = o.title; $('#dlg-body').innerHTML = o.body; okb.textContent = o.ok || 'Simpan'; err.classList.add('hidden'); d.classList.remove('hidden');
    if (o.init) o.init(f);
    var first = f.querySelector('input,select'); if (first) first.focus();
    function close() { d.classList.add('hidden'); f.onsubmit = null; $('#dlg-cancel').onclick = null; }
    $('#dlg-cancel').onclick = close;
    f.onsubmit = function (e) {
      e.preventDefault(); okb.disabled = true; err.classList.add('hidden');
      Promise.resolve().then(function () { return o.submit(new FormData(f)); }).then(function () { close(); }).catch(function (x) { err.textContent = x.message || 'Gagal'; err.classList.remove('hidden'); }).then(function () { okb.disabled = false; });
    };
  }
  function selOpts(list, sel, blank) {
    return (blank ? '<option value="">' + blank + '</option>' : '') + list.map(function (x) { return '<option value="' + x.id + '"' + (String(x.id) === String(sel) ? ' selected' : '') + '>' + esc(x.nama) + '</option>'; }).join('');
  }

  /* ---------- data dasar ---------- */
  function muatDasar() {
    return Promise.all([
      sb.from('tukang').select('*').eq('aktif', true).order('nama'),
      sb.from('proyek').select('*').order('nama'),
      sb.from('pengaturan').select('*').eq('id', 1).maybeSingle()
    ]).then(function (r) { S.tukang = ok(r[0]); S.proyek = ok(r[1]); if (ok(r[2])) S.usaha = ok(r[2]); });
  }
  function defaultFilter() { var m = periodeStart(todayStr()); return { dari: m, sampai: addDays(m, 6), tukang: '', proyek: '' }; }

  /* ---------- navigasi ---------- */
  function nav() {
    $('#nav').innerHTML = TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
  }
  function go(tab) {
    S.tab = tab; nav(); loading();
    var fn = { tukang: pTukang, proyek: pProyek, absensi: pAbsensi, lembur: pLembur, gaji: pGaji, laporan: pLaporan }[tab];
    muatDasar().then(fn).catch(fail);
  }

  /* ================= DATA TUKANG ================= */
  function pTukang() {
    var rows = S.tukang.map(function (t) {
      return '<tr><td><b>' + esc(t.nama) + '</b></td><td>' + esc(t.jabatan) + '</td><td class="n">' + rp(t.gaji_harian) + '</td><td class="n">' + rp(t.tarif_lembur) + '</td>' +
        '<td class="acts"><button class="btn btn-sm" data-a="edit-tukang" data-id="' + t.id + '">Edit</button>' +
        '<button class="btn btn-danger btn-sm" data-a="hapus-tukang" data-id="' + t.id + '">Hapus</button></td></tr>';
    }).join('');
    $('#page').innerHTML = '<div class="bar"><div class="grow"><h2>Data Tukang</h2><p class="muted small">Nama harus unik. Tukang masuk dengan mengetik nama ini, dari HP atau perangkat mana saja.</p></div>' +
      '<button class="btn btn-primary" data-a="tambah-tukang">+ Tambah Tukang</button></div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Nama</th><th>Jabatan</th><th class="n">Gaji harian</th><th class="n">Lembur / jam</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="center muted" style="padding:28px">Belum ada tukang</td></tr>') + '</tbody></table></div>';
  }
  function formTukang(t) {
    t = t || {};
    return '<label class="field"><span>Nama</span><input name="nama" value="' + esc(t.nama || '') + '" required></label>' +
      '<label class="field"><span>Jabatan</span><input name="jabatan" value="' + esc(t.jabatan || '') + '" placeholder="contoh: Tukang Besi"></label>' +
      '<label class="field"><span>Gaji harian (Rp)</span><input name="gaji" type="number" inputmode="numeric" min="0" step="1000" value="' + (t.gaji_harian != null ? t.gaji_harian : '') + '" required></label>' +
      '<label class="field"><span>Tarif lembur per jam (Rp)</span><input name="tarif" type="number" inputmode="numeric" min="0" step="500" value="' + (t.tarif_lembur != null ? t.tarif_lembur : '') + '" required></label>';
  }
  function simpanTukang(id) {
    return function (fd) {
      var v = { nama: String(fd.get('nama')).trim(), jabatan: String(fd.get('jabatan')).trim(), gaji_harian: +fd.get('gaji'), tarif_lembur: +fd.get('tarif') };
      if (!v.nama) throw new Error('Nama harus diisi');
      if (!(v.gaji_harian >= 0) || !(v.tarif_lembur >= 0)) throw new Error('Gaji dan tarif harus angka');
      var q = id ? sb.from('tukang').update(v).eq('id', id) : sb.from('tukang').insert(v);
      return q.then(function (r) {
        if (r.error) throw new Error(r.error.code === '23505' ? 'Nama tukang sudah ada' : r.error.message);
        toast('Tersimpan'); go('tukang');
      });
    };
  }
  function tukangById(id) { return S.tukang.filter(function (t) { return String(t.id) === String(id); })[0]; }
  function hapusDenganFallback(tabel, id, label, bisaNonaktif) {
    if (!confirm('Hapus ' + label + '?')) return;
    sb.from(tabel).delete().eq('id', id).then(function (r) {
      if (!r.error) { toast('Dihapus'); return go(S.tab); }
      if (r.error.code === '23503' && bisaNonaktif) {
        if (!confirm(label + ' sudah punya riwayat absensi sehingga tidak bisa dihapus permanen.\nNonaktifkan saja? Riwayat dan slip lama tetap aman.')) return;
        return sb.from(tabel).update({ aktif: false }).eq('id', id).then(function (r2) { if (r2.error) throw r2.error; toast('Dinonaktifkan'); go(S.tab); });
      }
      throw r.error;
    }).catch(fail);
  }

  /* ================= DATA PROYEK ================= */
  function pProyek() {
    var rows = S.proyek.map(function (p) {
      return '<tr><td><b>' + esc(p.nama) + '</b></td><td>' + (p.aktif ? '<span class="pill">aktif</span>' : '<span class="pill bad">nonaktif</span>') + '</td>' +
        '<td class="acts"><button class="btn btn-sm" data-a="edit-proyek" data-id="' + p.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-a="toggle-proyek" data-id="' + p.id + '">' + (p.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
        '<button class="btn btn-danger btn-sm" data-a="hapus-proyek" data-id="' + p.id + '">Hapus</button></td></tr>';
    }).join('');
    $('#page').innerHTML = '<div class="bar"><div class="grow"><h2>Data Proyek</h2><p class="muted small">Proyek aktif muncul sebagai pilihan di HP tukang. Tambahkan proyek baru di sini.</p></div>' +
      '<button class="btn btn-primary" data-a="tambah-proyek">+ Tambah Proyek</button></div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Nama proyek</th><th>Status</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" class="center muted" style="padding:28px">Belum ada proyek</td></tr>') + '</tbody></table></div>';
  }
  function simpanProyek(id) {
    return function (fd) {
      var nama = String(fd.get('nama')).trim(); if (!nama) throw new Error('Nama proyek harus diisi');
      var q = id ? sb.from('proyek').update({ nama: nama }).eq('id', id) : sb.from('proyek').insert({ nama: nama });
      return q.then(function (r) { if (r.error) throw new Error(r.error.code === '23505' ? 'Nama proyek sudah ada' : r.error.message); toast('Tersimpan'); go('proyek'); });
    };
  }

  /* ================= FILTER bersama ================= */
  function barFilter(denganProyek) {
    var f = S.f;
    return '<div class="bar"><label class="field"><span>Dari</span><input type="date" id="f-dari" value="' + f.dari + '"></label>' +
      '<label class="field"><span>Sampai</span><input type="date" id="f-sampai" value="' + f.sampai + '"></label>' +
      '<label class="field"><span>Tukang</span><select id="f-tukang">' + selOpts(S.tukang, f.tukang, 'Semua') + '</select></label>' +
      (denganProyek ? '<label class="field"><span>Proyek</span><select id="f-proyek">' + selOpts(S.proyek, f.proyek, 'Semua') + '</select></label>' : '') + '</div>';
  }
  function bacaFilter() {
    S.f.dari = $('#f-dari').value || S.f.dari; S.f.sampai = $('#f-sampai').value || S.f.sampai;
    S.f.tukang = $('#f-tukang').value; if ($('#f-proyek')) S.f.proyek = $('#f-proyek').value;
    if (S.f.sampai < S.f.dari) S.f.sampai = S.f.dari;
  }
  function query(tabel, kolom) {
    var q = sb.from(tabel).select(kolom).gte('tanggal', S.f.dari).lte('tanggal', S.f.sampai).order('tanggal', { ascending: false }).order('id', { ascending: false }).limit(5000);
    if (S.f.tukang) q = q.eq('tukang_id', S.f.tukang);
    if (S.f.proyek) q = q.eq('proyek_id', S.f.proyek);
    return q;
  }

  /* ================= ABSENSI ================= */
  function pAbsensi() {
    if (!S.f) S.f = defaultFilter();
    $('#page').innerHTML = '<div class="bar"><div class="grow"><h2>Absensi</h2></div><button class="btn btn-primary" data-a="tambah-absensi">+ Tambah Absensi</button></div>' + barFilter(true) + '<div id="hasil"></div>';
    query('absensi', 'id,tanggal,tukang_id,proyek_id,tukang(nama),proyek(nama)').then(function (r) {
      var d = ok(r), hari = {}; d.forEach(function (x) { hari[x.tukang_id + '|' + x.tanggal] = 1; });
      $('#hasil').innerHTML = '<div class="sum"><div class="card"><b>' + d.length + '</b><span>catatan masuk</span></div><div class="card"><b>' + Object.keys(hari).length + '</b><span>hari kerja (gaji)</span></div></div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Tanggal</th><th>Tukang</th><th>Proyek</th><th></th></tr></thead><tbody>' +
        (d.map(function (x) { return '<tr><td>' + fmt(x.tanggal) + '</td><td>' + esc(x.tukang && x.tukang.nama) + '</td><td>' + esc(x.proyek && x.proyek.nama) + '</td><td class="acts"><button class="btn btn-danger btn-sm" data-a="hapus-absensi" data-id="' + x.id + '">Hapus</button></td></tr>'; }).join('') || '<tr><td colspan="4" class="center muted" style="padding:28px">Tidak ada data</td></tr>') + '</tbody></table></div>';
    }).catch(fail);
  }
  function formTambah(tabel) {
    return '<label class="field"><span>Tukang</span><select name="tukang" required>' + selOpts(S.tukang, '', '— pilih —') + '</select></label>' +
      '<label class="field"><span>Tanggal</span><input type="date" name="tanggal" value="' + todayStr() + '" required></label>' +
      '<label class="field"><span>Proyek</span><select name="proyek" required>' + selOpts(S.proyek.filter(function (p) { return p.aktif; }), '', '— pilih —') + '</select></label>' +
      (tabel === 'lembur' ? '<label class="field"><span>Jam lembur</span><input name="jam" type="number" min="0.5" max="12" step="0.5" required></label>' : '');
  }
  function simpanBaru(tabel) {
    return function (fd) {
      var v = { tukang_id: +fd.get('tukang'), tanggal: fd.get('tanggal'), proyek_id: +fd.get('proyek') };
      if (!v.tukang_id || !v.tanggal || !v.proyek_id) throw new Error('Lengkapi semua isian');
      if (tabel === 'lembur') v.jam = +fd.get('jam');
      var q = tabel === 'lembur' ? sb.from('lembur').upsert(v, { onConflict: 'tukang_id,tanggal,proyek_id' }) : sb.from('absensi').insert(v);
      return q.then(function (r) { if (r.error) throw new Error(r.error.code === '23505' ? 'Data sudah ada' : r.error.message); toast('Tersimpan'); go(tabel); });
    };
  }

  /* ================= LEMBUR ================= */
  function pLembur() {
    if (!S.f) S.f = defaultFilter();
    $('#page').innerHTML = '<div class="bar"><div class="grow"><h2>Lembur</h2></div><button class="btn btn-primary" data-a="tambah-lembur">+ Tambah Lembur</button></div>' + barFilter(true) + '<div id="hasil"></div>';
    query('lembur', 'id,tanggal,jam,tukang_id,proyek_id,tukang(nama),proyek(nama)').then(function (r) {
      var d = ok(r), tot = d.reduce(function (a, x) { return a + +x.jam; }, 0);
      $('#hasil').innerHTML = '<div class="sum"><div class="card"><b>' + jam(tot) + ' jam</b><span>total lembur</span></div></div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Tanggal</th><th>Tukang</th><th>Proyek</th><th class="n">Jam</th><th></th></tr></thead><tbody>' +
        (d.map(function (x) { return '<tr><td>' + fmt(x.tanggal) + '</td><td>' + esc(x.tukang && x.tukang.nama) + '</td><td>' + esc(x.proyek && x.proyek.nama) + '</td><td class="n">' + jam(x.jam) + '</td><td class="acts"><button class="btn btn-sm" data-a="edit-lembur" data-id="' + x.id + '" data-jam="' + x.jam + '">Ubah jam</button><button class="btn btn-danger btn-sm" data-a="hapus-lembur" data-id="' + x.id + '">Hapus</button></td></tr>'; }).join('') || '<tr><td colspan="5" class="center muted" style="padding:28px">Tidak ada data</td></tr>') + '</tbody></table></div>';
    }).catch(fail);
  }

  /* ================= SLIP GAJI ================= */
  function pGaji() {
    if (!S.gajiMulai) S.gajiMulai = periodeStart(todayStr());
    var m = S.gajiMulai, a = addDays(m, 6);
    Promise.all([
      sb.from('periode_gaji').select('*').eq('tanggal_mulai', m).maybeSingle(),
      sb.from('absensi').select('tukang_id,tanggal,proyek(nama)').gte('tanggal', m).lte('tanggal', a).order('tanggal'),
      sb.from('lembur').select('tukang_id,tanggal,jam,proyek(nama)').gte('tanggal', m).lte('tanggal', a).order('tanggal'),
    ]).then(function (r) {
      var per = ok(r[0]), abs = ok(r[1]), lem = ok(r[2]);
      var head = '<div class="bar"><div class="grow"><h2>Slip Gaji</h2><p class="muted small">Periode Jumat–Kamis, dibayar Jumat berikutnya.</p></div></div>' +
        '<div class="bar"><button class="btn" data-a="per-prev">‹ Sebelumnya</button>' +
        '<label class="field"><span>Periode (pilih tanggal di dalamnya)</span><input type="date" id="g-tgl" value="' + m + '"></label>' +
        '<button class="btn" data-a="per-next">Berikutnya ›</button></div>' +
        '<div class="card" style="margin-bottom:16px"><b>' + fmt(m) + ' – ' + fmt(a) + '</b><br><span class="muted small">Dibayar ' + fmt(addDays(m, 7)) + ' · Status: ' +
        (per ? '<span class="pill ' + (per.status === 'final' ? '' : 'warn') + '">' + per.status + '</span>' : '<span class="pill warn">belum dihitung</span>') + '</span></div>';
      var act = '<div class="bar">' + (!per || per.status === 'terbuka' ? '<button class="btn btn-primary" data-a="hitung">' + (per ? 'Hitung ulang slip' : 'Hitung slip') + '</button>' : '') +
        (per && per.status === 'terbuka' ? '<button class="btn" data-a="finalkan" data-id="' + per.id + '">Finalkan periode</button>' : '') +
        (per && per.status === 'final' ? '<button class="btn" data-a="buka" data-id="' + per.id + '">Buka kembali</button>' : '') + '</div>';
      if (!per) { $('#page').innerHTML = head + act + '<p class="muted">Tekan “Hitung slip” untuk membuat slip dari data absensi dan lembur periode ini.</p>'; return; }
      return sb.from('slip_gaji').select('*').eq('periode_id', per.id).order('nama_tukang').then(function (r2) {
        var slips = ok(r2); S.slipCache = { per: per, slips: slips, abs: abs, lem: lem };
        var total = slips.reduce(function (a, s) { return a + +s.total_dibayar; }, 0);
        var rows = slips.map(function (s) {
          return '<tr><td><b>' + esc(s.nama_tukang) + '</b><br><span class="muted small">' + esc(s.jabatan) + '</span></td><td class="n">' + s.jumlah_hari + '</td><td class="n">' + jam(s.jam_lembur) + '</td>' +
            '<td class="n">' + rp(s.upah_pokok) + '</td><td class="n">' + rp(s.upah_lembur) + '</td><td class="n">' + rp(s.bonus) + '</td><td class="n">' + rp(s.potongan) + '</td><td class="n"><b>' + rp(s.total_dibayar) + '</b></td>' +
            '<td class="acts">' + (per.status === 'terbuka' ? '<button class="btn btn-sm" data-a="edit-slip" data-id="' + s.id + '">Bonus/Potongan</button>' : '') + '<button class="btn btn-sm" data-a="cetak-slip" data-id="' + s.id + '">Cetak</button></td></tr>';
        }).join('');
        $('#page').innerHTML = head + act + '<div class="sum"><div class="card"><b>' + slips.length + '</b><span>slip</span></div><div class="card"><b>' + rp(total) + '</b><span>total dibayarkan</span></div></div>' +
          (slips.length ? '<div class="bar"><button class="btn" data-a="cetak-semua">Cetak semua slip</button><button class="btn" data-a="cetak-rekap">Cetak rekap gaji</button></div>' : '') +
          '<div class="tbl-wrap"><table><thead><tr><th>Tukang</th><th class="n">Hari</th><th class="n">Jam lembur</th><th class="n">Upah pokok</th><th class="n">Upah lembur</th><th class="n">Bonus</th><th class="n">Potongan</th><th class="n">Total</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="9" class="center muted" style="padding:28px">Tidak ada absensi di periode ini</td></tr>') + '</tbody></table></div>';
      });
    }).catch(fail);
  }

  /* ---------- cetak ---------- */
  function kop(judul, sub) {
    return '<div class="kop"><img src="assets/logo.png" alt=""><div><h2>' + esc(S.usaha.nama_usaha) + '</h2>' + (S.usaha.alamat_usaha ? '<div>' + esc(S.usaha.alamat_usaha) + '</div>' : '') + '</div><div style="flex:1;text-align:right"><h1>' + judul + '</h1><div>' + sub + '</div></div></div>';
  }
  function cetak(html, landscape) {
    $('#print').innerHTML = html;
    var st = document.createElement('style'); st.id = 'pg'; st.textContent = '@media print{@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:12mm}}'; document.head.appendChild(st);
    document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); var p = $('#pg'); if (p) p.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { window.print(); }, 150);
  }
  function slipHtml(s, c) {
    var per = c.per, by = {};
    c.abs.filter(function (a) { return a.tukang_id === s.tukang_id; }).forEach(function (a) { var d = by[a.tanggal] = by[a.tanggal] || { p: {}, l: 0 }; d.p[(a.proyek && a.proyek.nama) || '-'] = 1; });
    c.lem.filter(function (l) { return l.tukang_id === s.tukang_id; }).forEach(function (l) { var d = by[l.tanggal] = by[l.tanggal] || { p: {}, l: 0 }; d.l += +l.jam; if (l.proyek) d.p[l.proyek.nama] = d.p[l.proyek.nama] || 1; });
    var rinci = Object.keys(by).sort().map(function (t, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + fmt(t) + '</td><td>' + esc(Object.keys(by[t].p).join(', ')) + '</td><td class="n">' + (by[t].l ? jam(by[t].l) + ' jam' : '-') + '</td></tr>';
    }).join('');
    return '<div class="slip">' + kop('SLIP GAJI', 'Periode ' + fmtL(per.tanggal_mulai) + ' – ' + fmtL(per.tanggal_selesai)) +
      '<div class="meta"><div>Nama: <b>' + esc(s.nama_tukang) + '</b></div><div>Tanggal bayar: <b>' + fmtL(per.tanggal_bayar) + '</b></div><div>Jabatan: ' + esc(s.jabatan || '-') + '</div><div>Jumlah hari kerja: ' + s.jumlah_hari + ' hari</div></div>' +
      '<table style="width:100%"><thead><tr><th>Keterangan</th><th class="n">Jumlah</th><th class="n">Tarif</th><th class="n">Nilai</th></tr></thead><tbody>' +
      '<tr><td>Gaji harian</td><td class="n">' + s.jumlah_hari + ' hari</td><td class="n">' + rp(s.gaji_harian) + '</td><td class="n">' + rp(s.upah_pokok) + '</td></tr>' +
      '<tr><td>Lembur</td><td class="n">' + jam(s.jam_lembur) + ' jam</td><td class="n">' + rp(s.tarif_lembur) + '</td><td class="n">' + rp(s.upah_lembur) + '</td></tr>' +
      (+s.bonus ? '<tr><td colspan="3">Bonus' + (s.catatan ? ' (' + esc(s.catatan) + ')' : '') + '</td><td class="n">' + rp(s.bonus) + '</td></tr>' : '') +
      (+s.potongan ? '<tr><td colspan="3">Potongan' + (s.catatan && !+s.bonus ? ' (' + esc(s.catatan) + ')' : '') + '</td><td class="n">- ' + rp(s.potongan) + '</td></tr>' : '') +
      '<tr class="total"><td colspan="3">TOTAL DITERIMA</td><td class="n">' + rp(s.total_dibayar) + '</td></tr></tbody></table>' +
      (rinci ? '<p style="margin:10px 0 4px"><b>Rincian kehadiran</b></p><table style="width:100%"><thead><tr><th style="width:28px">No</th><th>Tanggal</th><th>Proyek</th><th class="n">Lembur</th></tr></thead><tbody>' + rinci + '</tbody></table>' : '') +
      '<div class="ttd"><div>Penerima<br><br><br><br>( ' + esc(s.nama_tukang) + ' )</div><div>Admin<br><br><br><br>( ................ )</div></div></div>';
  }

  /* ================= LAPORAN ================= */
  function pLaporan() {
    if (!S.f) S.f = defaultFilter();
    $('#page').innerHTML = '<div class="bar"><div class="grow"><h2>Laporan Absensi</h2><p class="muted small">Rekap per tukang untuk rentang tanggal (maksimal 31 hari).</p></div><button class="btn btn-primary" data-a="cetak-laporan">Cetak laporan</button></div>' + barFilter(false) + '<div id="hasil"></div>';
    var sel = S.f.dari, n = 0, tanggal = [];
    for (var d = S.f.dari; d <= S.f.sampai && n < 31; d = addDays(d, 1), n++) tanggal.push(d);
    var qa = sb.from('absensi').select('tukang_id,tanggal,proyek(nama)').gte('tanggal', S.f.dari).lte('tanggal', S.f.sampai).limit(10000);
    var ql = sb.from('lembur').select('tukang_id,tanggal,jam').gte('tanggal', S.f.dari).lte('tanggal', S.f.sampai).limit(10000);
    if (S.f.tukang) { qa = qa.eq('tukang_id', S.f.tukang); ql = ql.eq('tukang_id', S.f.tukang); }
    Promise.all([qa, ql]).then(function (r) {
      var abs = ok(r[0]), lem = ok(r[1]), cell = {}, ljam = {};
      abs.forEach(function (a) { var k = a.tukang_id + '|' + a.tanggal; (cell[k] = cell[k] || []).push(a.proyek && a.proyek.nama); });
      lem.forEach(function (l) { var k = l.tukang_id + '|' + l.tanggal; ljam[k] = (ljam[k] || 0) + +l.jam; });
      var daftar = S.tukang.filter(function (t) { return !S.f.tukang || String(t.id) === S.f.tukang; });
      var rows = daftar.map(function (t, i) {
        var hari = 0, lj = 0;
        var tds = tanggal.map(function (d) {
          var k = t.id + '|' + d, c = cell[k], l = ljam[k]; if (c) hari++; if (l) lj += l;
          return '<td style="text-align:center">' + (c ? esc(c.join(' / ')) : '') + (l ? '<br><i>lembur ' + jam(l) + 'j</i>' : '') + '</td>';
        }).join('');
        return { hari: hari, lj: lj, html: '<tr><td>' + (i + 1) + '</td><td><b>' + esc(t.nama) + '</b><br>' + esc(t.jabatan) + '</td>' + tds + '<td style="text-align:center"><b>' + hari + '</b></td><td style="text-align:center"><b>' + jam(lj) + '</b></td></tr>' };
      }).filter(function (x) { return x.hari || x.lj || S.f.tukang; });
      var ths = tanggal.map(function (d) { return '<th style="text-align:center">' + HARI[parse(d).getDay()] + '<br>' + fmtS(d) + '</th>'; }).join('');
      var tabel = '<table style="width:100%"><thead><tr><th>No</th><th>Tukang</th>' + ths + '<th>Hari</th><th>Lembur (jam)</th></tr></thead><tbody>' + (rows.map(function (x) { return x.html; }).join('') || '<tr><td colspan="' + (tanggal.length + 4) + '" style="text-align:center">Tidak ada data</td></tr>') + '</tbody></table>';
      S.laporanHtml = kop('LAPORAN ABSENSI', fmtL(S.f.dari) + ' – ' + fmtL(S.f.sampai)) + tabel + '<p style="margin-top:6px;font-size:10px">Dicetak ' + fmtL(todayStr()) + '. Gaji harian dihitung satu kali per tanggal masuk.</p>';
      $('#hasil').innerHTML = '<div class="tbl-wrap"><div class="doc">' + tabel + '</div></div>';
    }).catch(fail);
  }

  /* ================= Pengaturan ================= */
  function dlgPengaturan() {
    dialog({ title: 'Pengaturan usaha', body: '<label class="field"><span>Nama usaha (kop cetakan)</span><input name="nama" value="' + esc(S.usaha.nama_usaha) + '" required></label><label class="field"><span>Alamat (opsional)</span><input name="alamat" value="' + esc(S.usaha.alamat_usaha) + '"></label>',
      submit: function (fd) { return sb.from('pengaturan').update({ nama_usaha: String(fd.get('nama')).trim(), alamat_usaha: String(fd.get('alamat')).trim() }).eq('id', 1).then(function (r) { if (r.error) throw r.error; toast('Tersimpan'); return muatDasar(); }); } });
  }

  /* ================= EVENT ================= */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) return go(b.dataset.tab);
    if (b.id === 'btn-keluar') { sb.auth.signOut().then(function () { location.reload(); }); return; }
    if (b.id === 'btn-set') return dlgPengaturan();
    var a = b.dataset.a, id = b.dataset.id; if (!a) return;
    var t;
    switch (a) {
      case 'tambah-tukang': dialog({ title: 'Tambah tukang', body: formTukang(), init: autoTarif, submit: simpanTukang(null) }); break;
      case 'edit-tukang': t = tukangById(id); dialog({ title: 'Edit tukang', body: formTukang(t), submit: simpanTukang(t.id) }); break;
      case 'reset-hp':
        if (confirm('Reset HP untuk ' + tukangById(id).nama + '? Tukang bisa masuk lagi dari HP baru.')) sb.from('tukang').update({ perangkat_id: null }).eq('id', id).then(function (r) { if (r.error) throw r.error; toast('HP direset'); go('tukang'); }).catch(fail);
        break;
      case 'hapus-tukang': hapusDenganFallback('tukang', id, 'tukang ' + tukangById(id).nama, true); break;
      case 'tambah-proyek': dialog({ title: 'Tambah proyek', body: '<label class="field"><span>Nama proyek</span><input name="nama" required></label>', submit: simpanProyek(null) }); break;
      case 'edit-proyek': t = S.proyek.filter(function (p) { return String(p.id) === id; })[0]; dialog({ title: 'Edit proyek', body: '<label class="field"><span>Nama proyek</span><input name="nama" value="' + esc(t.nama) + '" required></label>', submit: simpanProyek(t.id) }); break;
      case 'toggle-proyek': t = S.proyek.filter(function (p) { return String(p.id) === id; })[0]; sb.from('proyek').update({ aktif: !t.aktif }).eq('id', id).then(function (r) { if (r.error) throw r.error; go('proyek'); }).catch(fail); break;
      case 'hapus-proyek': t = S.proyek.filter(function (p) { return String(p.id) === id; })[0]; hapusDenganFallback('proyek', id, 'proyek ' + t.nama, true); break;
      case 'tambah-absensi': dialog({ title: 'Tambah absensi', body: formTambah('absensi'), submit: simpanBaru('absensi') }); break;
      case 'tambah-lembur': dialog({ title: 'Tambah / ganti lembur', body: formTambah('lembur'), submit: simpanBaru('lembur') }); break;
      case 'hapus-absensi': if (confirm('Hapus catatan masuk ini?')) sb.from('absensi').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; toast('Dihapus'); go('absensi'); }).catch(fail); break;
      case 'hapus-lembur': if (confirm('Hapus data lembur ini?')) sb.from('lembur').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; toast('Dihapus'); go('lembur'); }).catch(fail); break;
      case 'edit-lembur': dialog({ title: 'Ubah jam lembur', body: '<label class="field"><span>Jam lembur</span><input name="jam" type="number" min="0.5" max="12" step="0.5" value="' + b.dataset.jam + '" required></label>',
        submit: function (fd) { return sb.from('lembur').update({ jam: +fd.get('jam') }).eq('id', id).then(function (r) { if (r.error) throw r.error; toast('Tersimpan'); go('lembur'); }); } }); break;
      case 'per-prev': S.gajiMulai = addDays(S.gajiMulai, -7); go('gaji'); break;
      case 'per-next': S.gajiMulai = addDays(S.gajiMulai, 7); go('gaji'); break;
      case 'hitung': b.disabled = true; sb.rpc('admin_buat_slip', { p_mulai: S.gajiMulai }).then(function (r) { ok(r); toast('Slip dihitung'); go('gaji'); }).catch(function (x) { b.disabled = false; fail(x); }); break;
      case 'finalkan': if (confirm('Finalkan periode ini? Absensi dan lembur di periode ini akan terkunci.')) sb.rpc('admin_status_periode', { p_id: +id, p_status: 'final' }).then(function (r) { ok(r); toast('Periode final'); go('gaji'); }).catch(fail); break;
      case 'buka': if (confirm('Buka kembali periode ini untuk diedit?')) sb.rpc('admin_status_periode', { p_id: +id, p_status: 'terbuka' }).then(function (r) { ok(r); go('gaji'); }).catch(fail); break;
      case 'edit-slip':
        t = S.slipCache.slips.filter(function (s) { return String(s.id) === id; })[0];
        dialog({ title: 'Bonus / potongan — ' + t.nama_tukang, body: '<label class="field"><span>Bonus (Rp)</span><input name="bonus" type="number" min="0" step="1000" value="' + t.bonus + '"></label><label class="field"><span>Potongan (Rp)</span><input name="pot" type="number" min="0" step="1000" value="' + t.potongan + '"></label><label class="field"><span>Catatan (tampil di slip)</span><input name="cat" value="' + esc(t.catatan) + '" placeholder="contoh: kasbon"></label>',
          submit: function (fd) { return sb.rpc('admin_ubah_slip', { p_id: +id, p_bonus: +fd.get('bonus') || 0, p_potongan: +fd.get('pot') || 0, p_catatan: String(fd.get('cat')).trim() }).then(function (r) { ok(r); toast('Tersimpan'); go('gaji'); }); } });
        break;
      case 'cetak-slip': t = S.slipCache.slips.filter(function (s) { return String(s.id) === id; })[0]; cetak(slipHtml(t, S.slipCache), false); break;
      case 'cetak-semua': cetak(S.slipCache.slips.map(function (s) { return slipHtml(s, S.slipCache); }).join(''), false); break;
      case 'cetak-rekap': {
        var c = S.slipCache, tot = 0;
        cetak(kop('REKAP GAJI', 'Periode ' + fmtL(c.per.tanggal_mulai) + ' – ' + fmtL(c.per.tanggal_selesai) + ' · Dibayar ' + fmtL(c.per.tanggal_bayar)) +
          '<table style="width:100%"><thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Hari</th><th>Lembur (jam)</th><th>Upah pokok</th><th>Upah lembur</th><th>Bonus</th><th>Potongan</th><th>Total</th><th>TTD</th></tr></thead><tbody>' +
          c.slips.map(function (s, i) { tot += +s.total_dibayar; return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.nama_tukang) + '</td><td>' + esc(s.jabatan) + '</td><td>' + s.jumlah_hari + '</td><td>' + jam(s.jam_lembur) + '</td><td align="right">' + rp(s.upah_pokok) + '</td><td align="right">' + rp(s.upah_lembur) + '</td><td align="right">' + rp(s.bonus) + '</td><td align="right">' + rp(s.potongan) + '</td><td align="right"><b>' + rp(s.total_dibayar) + '</b></td><td style="width:70px"></td></tr>'; }).join('') +
          '<tr><td colspan="9" align="right"><b>TOTAL</b></td><td align="right"><b>' + rp(tot) + '</b></td><td></td></tr></tbody></table>', true);
        break;
      }
      case 'cetak-laporan': if (S.laporanHtml) cetak(S.laporanHtml, true); break;
    }
  });
  document.addEventListener('change', function (e) {
    var id = e.target.id;
    if (/^f-(dari|sampai|tukang|proyek)$/.test(id)) { bacaFilter(); go(S.tab); }
    if (id === 'g-tgl' && e.target.value) { S.gajiMulai = periodeStart(e.target.value); go('gaji'); }
  });
  function autoTarif(f) {
    var g = f.querySelector('[name=gaji]'), t = f.querySelector('[name=tarif]'), manual = false;
    t.addEventListener('input', function () { manual = true; });
    g.addEventListener('input', function () { if (!manual) t.value = g.value ? Math.round(+g.value / 8 / 500) * 500 : ''; });
  }

  /* ================= login ================= */
  function show(v) { $('#v-login').classList.toggle('hidden', v !== 'login'); $('#v-app').classList.toggle('hidden', v !== 'app'); }
  function mulaiApp() {
    sb.from('admin').select('id,nama').maybeSingle().then(function (r) {
      var a = r.data;
      if (!a) { return sb.auth.signOut().then(function () { show('login'); var er = $('#login-err'); er.textContent = 'Akun ini bukan admin. Daftarkan di tabel admin (lihat panduan).'; er.classList.remove('hidden'); }); }
      show('app'); S.f = defaultFilter(); go('tukang');
    }).catch(fail);
  }
  $('#f-login').addEventListener('submit', function (e) {
    e.preventDefault(); var btn = $('#btn-login'), er = $('#login-err'); er.classList.add('hidden'); btn.disabled = true;
    sb.auth.signInWithPassword({ email: $('#in-email').value.trim(), password: $('#in-pass').value }).then(function (r) {
      btn.disabled = false;
      if (r.error) { er.textContent = 'Email atau password salah'; er.classList.remove('hidden'); return; }
      mulaiApp();
    });
  });
  if (!C || /PASTE_/.test(C.SUPABASE_URL)) { show('login'); $('#login-err').textContent = 'Aplikasi belum dikonfigurasi (js/config.js)'; $('#login-err').classList.remove('hidden'); return; }
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  sb.auth.getSession().then(function (r) { if (r.data && r.data.session) mulaiApp(); else show('login'); });
})();
