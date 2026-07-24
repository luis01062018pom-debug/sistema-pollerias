/* Capa de red: fetch con token + cola offline para ventas */
const API = {
  token: localStorage.getItem('token') || null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  },

  async req(metodo, ruta, body) {
    const opts = {
      method: metodo,
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.token) opts.headers.Authorization = 'Bearer ' + this.token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch('/api' + ruta, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      API.setToken(null);
      location.reload();
      throw new Error('Sesión expirada');
    }
    if (!r.ok) throw new Error(data.error || 'Error de servidor');
    return data;
  },

  get(ruta) { return this.req('GET', ruta); },
  post(ruta, body) { return this.req('POST', ruta, body); },
  put(ruta, body) { return this.req('PUT', ruta, body); },

  /* ===== Cola offline de ventas ===== */
  _cola() {
    try { return JSON.parse(localStorage.getItem('colaVentas') || '[]'); }
    catch (e) { return []; }
  },
  _guardarCola(c) { localStorage.setItem('colaVentas', JSON.stringify(c)); },

  colaPendiente() { return this._cola().length; },

  async registrarVenta(venta) {
    try {
      const r = await this.post('/ventas', venta);
      return { ...r, online: true };
    } catch (e) {
      // Sin conexión (o servidor caído): guardar localmente y sincronizar después
      if (e instanceof TypeError || /fetch|network|failed/i.test(e.message)) {
        const cola = this._cola();
        cola.push({ ...venta, offline: true, fecha: new Date().toISOString() });
        this._guardarCola(cola);
        return { ok: true, online: false, encolada: true };
      }
      throw e;
    }
  },

  async sincronizar() {
    let cola = this._cola();
    if (!cola.length) return 0;
    let enviadas = 0;
    for (const venta of [...cola]) {
      try {
        await this.post('/ventas', venta);
        cola = cola.filter(v => v.uuid !== venta.uuid);
        this._guardarCola(cola);
        enviadas++;
      } catch (e) {
        if (e instanceof TypeError || /fetch|network|failed/i.test(e.message)) break; // sigue sin internet
        // Error de datos: descartar para no bloquear la cola
        cola = cola.filter(v => v.uuid !== venta.uuid);
        this._guardarCola(cola);
      }
    }
    return enviadas;
  }
};

window.addEventListener('online', () => {
  API.sincronizar().then(n => {
    if (n > 0 && window.App) App.avisar(`${n} venta(s) sincronizada(s)`);
    if (window.App) App.pintarEstadoRed();
  });
});
window.addEventListener('offline', () => { if (window.App) App.pintarEstadoRed(); });
