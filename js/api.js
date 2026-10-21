/**
 * Klien API ke Google Apps Script + penyimpanan sesi.
 * Semua permintaan memakai POST dengan Content-Type text/plain
 * agar browser tidak mengirim preflight CORS (Apps Script tidak mendukungnya).
 */

const Session = {
  key: 'absensi.session.v1',
  token: null,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.key));
      if (s && s.token) { this.token = s.token; return s; }
    } catch (e) { /* abaikan */ }
    return null;
  },

  save(token, user) {
    this.token = token;
    try { localStorage.setItem(this.key, JSON.stringify({ token: token, user: user })); } catch (e) { /* abaikan */ }
  },

  clear() {
    this.token = null;
    try { localStorage.removeItem(this.key); } catch (e) { /* abaikan */ }
  }
};

async function api(action, params, opts) {
  params = params || {};
  opts = opts || {};

  if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('PASTE_') === 0) {
    throw new Error('API_URL belum diisi. Buka js/config.js dan tempel URL Web App Apps Script.');
  }

  const payload = Object.assign({ action: action }, params);
  if (opts.auth !== false && Session.token) payload.token = Session.token;

  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 60000);

  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'Server terlalu lama merespons. Coba lagi.'
      : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  } finally {
    clearTimeout(timer);
  }

  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error('Respons server tidak valid. Pastikan URL Web App benar dan akses diset "Anyone".'); }

  if (!json.ok) {
    const err = new Error(json.error || 'Terjadi kesalahan');
    if (/Sesi berakhir|Akun tidak aktif/.test(err.message)) err.logout = true;
    throw err;
  }
  return json.data;
}
