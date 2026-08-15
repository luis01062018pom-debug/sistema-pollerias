/* =======================================================================
   Capa de red y de memoria local.

   Regla de oro de este archivo: la venta NUNCA depende del internet.
   1. Toda venta se guarda primero en el teléfono (cola + bitácora local).
   2. Si hay señal se manda; si no, se queda esperando y se reintenta sola.
   3. El servidor descarta duplicados por `uuid`, así que reintentar es seguro.
   4. Lo que se consultó con internet queda en caché para poder verlo sin él.
   ======================================================================= */

const TIEMPO_LIMITE = 12000;   // 12 s: más allá de eso, la red no sirve
const MAX_VENTAS_LOCALES = 800;
const MAX_INTENTOS = 8;

const ALM = {
  leer(clave, siNoHay) {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? siNoHay : JSON.parse(v);
    } catch (e) { return siNoHay; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) {
      // Se llenó el almacenamiento: se tira lo viejo (caché), nunca las ventas.
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('cache:')) localStorage.removeItem(k);
        localStorage.setItem(clave, JSON.stringify(valor));
        return true;
      } catch (e2) { console.error('No se pudo guardar', clave, e2); return false; }
    }
  },
  borrar(clave) { try { localStorage.removeItem(clave); } catch (e) {} },
};

const API = {
  token: localStorage.getItem('token') || null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  },

  /** ¿Este error fue "no hay internet" y no "el servidor dijo que no"? */
  esDeRed(e) {
    return !!e && (e.red === true || e.name === 'AbortError'
      || e instanceof TypeError || /fetch|network|failed|load/i.test(e.message || ''));
  },

  async req(metodo, ruta, body, op = {}) {
    const ctrl = new AbortController();
    // Sin este cronómetro, una red "presente pero muerta" (el wifi del local
    // que no sale a internet) deja el botón de cobrar girando para siempre.
    const reloj = setTimeout(() => ctrl.abort(), op.limite || TIEMPO_LIMITE);
    let r;
    try {
      const opts = { method: metodo, headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal };
      if (this.token) opts.headers.Authorization = 'Bearer ' + this.token;
      if (body !== undefined) opts.body = JSON.stringify(body);
      r = await fetch('/api' + ruta, opts);
    } catch (e) {
      const err = new Error('Sin conexión con el servidor');
      err.red = true;
      throw err;
    } finally {
      clearTimeout(reloj);
    }

    const data = await r.json().catch(() => ({}));
    // Un 401 al INTENTAR entrar no es una sesión vencida: es que el usuario o
    // la contraseña no coinciden. Tratarlo igual mandaba a recargar la página
    // con un "Sesión expirada" que no le decía nada a nadie.
    if (r.status === 401 && ruta !== '/login') {
      if (op.silencioso) { const e = new Error('Sesión no válida'); e.status = 401; throw e; }
      API.setToken(null);
      location.reload();
      throw new Error('Tu sesión se cerró. Vuelve a entrar.');
    }
    if (!r.ok) {
      const err = new Error(data.error || 'Error de servidor');
      err.status = r.status;
      err.datos = data;
      throw err;
    }
    return data;
  },

  get(ruta, op) { return this.req('GET', ruta, undefined, op); },
  post(ruta, body, op) { return this.req('POST', ruta, body, op); },
  put(ruta, body, op) { return this.req('PUT', ruta, body, op); },

  /* ===== Caché de consultas =====
     Se guarda la última respuesta buena de cada ruta para poder mostrarla
     sin internet, siempre marcada con la hora en que se trajo. */
  async getCache(ruta, clave) {
    const llave = 'cache:' + (clave || ruta);
    try {
      const datos = await this.get(ruta);
      ALM.guardar(llave, { datos, capturado_en: Date.now() });
      return { datos, deCache: false, capturado_en: Date.now() };
    } catch (e) {
      const guardado = ALM.leer(llave, null);
      if (this.esDeRed(e) && guardado) {
        return { datos: guardado.datos, deCache: true, capturado_en: guardado.capturado_en };
      }
      throw e;
    }
  },
  cacheGuardado(clave) { return ALM.leer('cache:' + clave, null); },

  /* ===== Arranque sin internet =====
     El /bootstrap trae usuario, negocio, catálogo y estado de la cuenta. Si no
     hay señal se usa la copia del último arranque bueno: sin esto, la app se
     quedaba en la pantalla de login y no se podía vender. */
  async bootstrap() {
    try {
      const b = await this.get('/bootstrap');
      ALM.guardar('bootstrap', { ...b, capturado_en: Date.now() });
      return { ...b, deCache: false };
    } catch (e) {
      const g = ALM.leer('bootstrap', null);
      if (this.esDeRed(e) && g) return { ...g, deCache: true };
      throw e;
    }
  },
  olvidarBootstrap() { ALM.borrar('bootstrap'); },

  /* ===== Bitácora local de ventas =====
     Todo lo vendido en este dispositivo, haya subido o no. Es lo que permite
     ver las ventas del día y el corte con el internet caído. */
  ventasLocales() { return ALM.leer('ventasLocales', []); },
  _guardarVentas(v) { ALM.guardar('ventasLocales', v.slice(-MAX_VENTAS_LOCALES)); },

  _anotarVenta(venta) {
    const lista = this.ventasLocales();
    if (lista.some((v) => v.uuid === venta.uuid)) return;
    lista.push(venta);
    this._guardarVentas(lista);
  },
  _marcarSubida(uuid) {
    const lista = this.ventasLocales();
    const v = lista.find((x) => x.uuid === uuid);
    if (v) { v.sincronizada = true; v.subida_en = Date.now(); this._guardarVentas(lista); }
  },
  /** Ventas de hoy hechas en este equipo, de la más nueva a la más vieja. */
  /**
   * Las ventas de hoy SEGÚN EL SERVIDOR: las de todos los equipos del
   * negocio, no solo las de este aparato. Se guarda la última respuesta
   * buena para poder pintarlas aunque después se caiga la señal.
   */
  async ventasDelDiaServidor() {
    const hoy = new Date().toLocaleDateString('en-CA');
    try {
      const lista = await this.get('/ventas?fecha=' + hoy);
      this._ventasServidor = { fecha: hoy, lista: Array.isArray(lista) ? lista : [] };
    } catch (e) {
      // Sin internet se conserva lo último que se supo; si nunca hubo nada,
      // la pantalla se queda con lo de este equipo, como antes.
      if (!this._ventasServidor || this._ventasServidor.fecha !== hoy) {
        this._ventasServidor = { fecha: hoy, lista: [], falloRed: true };
      } else {
        this._ventasServidor.falloRed = true;
      }
    }
    return this._ventasServidor;
  },
  ventasServidorGuardadas() {
    const hoy = new Date().toLocaleDateString('en-CA');
    return this._ventasServidor && this._ventasServidor.fecha === hoy ? this._ventasServidor : null;
  },

  ventasDeHoy() {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.ventasLocales()
      .filter((v) => String(v.fecha).slice(0, 10) === hoy)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  },
  /**
   * Las ventas que el servidor todavía no tenía cuando se trajo ese resumen.
   * Es la pieza fina del corte offline: evita contar dos veces una venta que
   * ya venía en el total del servidor.
   */
  ventasNoContadas(capturadoEn) {
    return this.ventasDeHoy().filter(
      (v) => !v.sincronizada || !capturadoEn || (v.subida_en || Infinity) > capturadoEn);
  },

  /* ===== Cola de envío ===== */
  _cola() { return ALM.leer('colaVentas', []); },
  _guardarCola(c) { ALM.guardar('colaVentas', c); },
  colaPendiente() { return this._cola().length; },
  ventasRechazadas() { return ALM.leer('ventasRechazadas', []); },

  _rechazar(venta, motivo) {
    const l = ALM.leer('ventasRechazadas', []);
    l.push({ ...venta, motivo, cuando: new Date().toISOString() });
    ALM.guardar('ventasRechazadas', l.slice(-50));
  },

  /**
   * Registrar una venta. Pase lo que pase queda guardada en el equipo; el
   * envío al servidor es lo secundario.
   */
  async registrarVenta(venta) {
    const local = {
      ...venta,
      fecha: venta.fecha || new Date().toISOString(),
      sincronizada: false,
    };
    this._anotarVenta(local);
    try {
      // `silencioso`: si la sesión venció justo en ese momento, la venta se
      // encola y se sigue cobrando. Cerrar la sesión de golpe a media venta,
      // con el cliente enfrente, sería lo peor que podría hacer la app.
      await this.post('/ventas', local, { silencioso: true });
      this._marcarSubida(local.uuid);
      return { ok: true, online: true };
    } catch (e) {
      if (this.esDeRed(e) || e.status >= 500 || e.status === 402 || e.status === 401) {
        const cola = this._cola();
        cola.push({ ...local, offline: true, intentos: 0 });
        this._guardarCola(cola);
        return { ok: true, online: false, encolada: true };
      }
      // El servidor rechazó los datos (400): la venta no es válida, no tiene
      // caso reintentarla. Se quita de la bitácora y se avisa a quien cobra.
      const lista = this.ventasLocales().filter((v) => v.uuid !== local.uuid);
      this._guardarVentas(lista);
      throw e;
    }
  },

  /** Manda lo que esté esperando. Devuelve cuántas subieron. */
  async sincronizar() {
    if (this._sincronizando) return 0;
    this._sincronizando = true;
    try {
      let cola = this._cola();
      let enviadas = 0;
      for (const venta of [...cola]) {
        try {
          await this.post('/ventas', venta, { silencioso: true });
          this._marcarSubida(venta.uuid);
          cola = cola.filter((v) => v.uuid !== venta.uuid);
          this._guardarCola(cola);
          enviadas++;
        } catch (e) {
          // Sin señal, sesión vencida, renta sin pagar o servidor con problemas:
          // NO se pierde nada, se deja para el siguiente intento.
          if (this.esDeRed(e) || e.status === 401 || e.status === 402) break;
          if (e.status >= 500) {
            venta.intentos = (venta.intentos || 0) + 1;
            if (venta.intentos < MAX_INTENTOS) { this._guardarCola(cola); break; }
          }
          // Datos inválidos (o ya se reintentó demasiado): se aparta para que
          // una sola venta mala no atore a todas las demás.
          this._rechazar(venta, e.message);
          cola = cola.filter((v) => v.uuid !== venta.uuid);
          this._guardarCola(cola);
        }
      }
      return enviadas;
    } finally {
      this._sincronizando = false;
    }
  },

  /** Sincroniza y refresca lo que se ve en pantalla. */
  async sincronizarYAvisar(silencioso) {
    try {
      const n = await this.sincronizar();
      if (window.App) {
        if (n > 0 && !silencioso) App.avisar(`${n} venta(s) sincronizada(s)`);
        App.pintarEstadoRed();
      }
      return n;
    } catch (e) { return 0; }
  },
};

/* Disparadores de sincronización: al volver la señal, al volver a la app y
   cada minuto mientras haya algo pendiente. Con uno solo no basta —
   `navigator.onLine` miente seguido en Android. */
window.addEventListener('online', () => API.sincronizarYAvisar());
window.addEventListener('offline', () => { if (window.App) App.pintarEstadoRed(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && API.colaPendiente() > 0) API.sincronizarYAvisar(true);
});
setInterval(() => { if (API.colaPendiente() > 0) API.sincronizarYAvisar(true); }, 60000);
