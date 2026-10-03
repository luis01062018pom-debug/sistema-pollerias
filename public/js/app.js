/* App principal: router de vistas + estado */
const ICONOS = {
  vender: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  compras: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  inventario: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="16" x2="14" y2="16"/>',
  corte: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  mas: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  reportes: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  config: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  admin: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  enviar: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  pluma: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>',
  offline: '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  cuenta: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  pagos: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  dinero: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  usuarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
};

const App = {
  state: { user: null, negocio: null, piezas: [], vista: 'vender', carrito: [], filtroPos: '', suscripcion: null },

  ico(nombre, clase) {
    return `<svg class="ico ${clase || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
  },

  /* ===== Utilidades ===== */
  $(sel) { return document.querySelector(sel); },
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  dinero(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  num(n, d = 2) { return (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: d }); },
  uuid() {
    return (crypto.randomUUID) ? crypto.randomUUID()
      : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  },
  avisar(txt, esError) {
    const div = document.createElement('div');
    div.className = esError ? 'msg-error' : 'msg-ok';
    div.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:99;box-shadow:0 4px 14px rgba(0,0,0,.18)';
    div.textContent = txt;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2600);
  },

  modal(html) {
    this.cerrarModal();
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.id = 'modal';
    fondo.innerHTML = `<div class="modal">${html}</div>`;
    fondo.addEventListener('click', e => { if (e.target === fondo) App.cerrarModal(); });
    document.body.appendChild(fondo);
  },
  cerrarModal() { const m = document.getElementById('modal'); if (m) m.remove(); },

  flag(nombre) {
    const f = (this.state.negocio && this.state.negocio.flags) || {};
    return f[nombre] !== false; // encendido por defecto
  },

  /* ===== Arranque ===== */
  async iniciar() {
    // Antes de entrar, la app es del SISTEMA, no de ningún cliente: nombre
    // genérico, icono genérico y manifest genérico. La única excepción es
    // abrir la liga de UNA pollería (/?negocio=CLAVE): esa sale con su marca,
    // para que al instalarla desde ahí quede con su logo. No se recuerda:
    // sin la liga, la entrada vuelve a ser la genérica.
    if (!API.token) { await this.marcaDeLaLiga(); return this.vistaLogin(); }
    API.asegurarNegocioDelAparato();
    try {
      const boot = await API.bootstrap();
      this.state.user = boot.user;
      this.state.negocio = boot.negocio;
      this.state.piezas = boot.piezas || [];
      this.state.suscripcion = boot.suscripcion || null;
      this.state.arranqueSinRed = !!boot.deCache;
      this.aplicarMarca(boot.negocio);
      // Si el servicio está suspendido por falta de pago, lo único que se
      // puede hacer es subir el comprobante: se entra directo a esa pantalla.
      this.state.vista = boot.user.rol === 'superadmin' ? 'admin'
        : (this.suspendido() ? 'cuenta' : (this.vistaDelAtajo() || 'vender'));
      this.pintar();
      if (boot.deCache) {
        this.avisar('Sin internet: se abrió con los datos guardados. Puedes vender igual.');
      }
      API.sincronizarYAvisar(true);
    } catch (e) {
      if (/suspendido/i.test(e.message)) {
        document.getElementById('app').innerHTML =
          `<div class="login-wrap"><div class="login-caja tarjeta centrado">
             <h2>Negocio suspendido</h2><p class="suave">${this.esc(e.message)}</p>
             <button class="btn" onclick="App.salir()">Salir</button></div></div>`;
      } else {
        this.marcaGenerica();
        this.vistaLogin(API.esDeRed(e)
          ? 'Sin internet y sin datos guardados en este equipo. Conéctate una vez para dejar la app lista.'
          : e.message);
      }
    }
  },

  /* El atajo del icono ("Vender", "Corte") llega como /?ir=corte */
  vistaDelAtajo() {
    const v = new URLSearchParams(location.search).get('ir');
    return ['vender', 'corte', 'compras', 'inventario'].includes(v) ? v : null;
  },

  async marcaDeLaLiga() {
    this.state.marcaLiga = null;
    const codigo = (new URLSearchParams(location.search).get('negocio') || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(codigo)) return this.marcaGenerica();
    try {
      const r = await fetch('/api/publico/marca/' + encodeURIComponent(codigo));
      if (!r.ok) return this.marcaGenerica();
      const n = (await r.json()).marca;
      this.marcaGenerica();
      this.aplicarMarca(n);
      this.state.marcaLiga = n;
    } catch (e) {
      this.marcaGenerica();   // sin internet: la entrada genérica sirve igual
    }
  },

  /* Deja la app con la cara del sistema: la de la pantalla de entrada. */
  marcaGenerica() {
    document.title = 'Sistema Pollerías — Punto de Venta';
    aplicarPaleta(TEMAS[0]);
    const lnk = document.getElementById('lnk-manifest');
    if (lnk) lnk.setAttribute('href', 'manifest.json');
    const apple = document.getElementById('lnk-apple');
    if (apple) apple.setAttribute('href', 'icons/apple-touch-icon.png?v=2');
    try { localStorage.removeItem('marca'); } catch (e) {}
  },

  aplicarMarca(n) {
    if (!n) return;
    aplicarPaleta({
      primario: n.color_primario, secundario: n.color_secundario,
      acento: n.color_acento, fondo: n.color_fondo,
    });
    if (n.nombre) document.title = n.nombre;
    if (n.codigo) {
      // Cada pollería instala la app con SU logo: el manifest se apunta al de
      // su negocio, y con eso el icono del teléfono y el del escritorio son
      // los suyos, no los nuestros.
      const lnk = document.getElementById('lnk-manifest');
      const destino = '/api/publico/manifest/' + encodeURIComponent(n.codigo);
      if (lnk && lnk.getAttribute('href') !== destino) lnk.setAttribute('href', destino);
      const apple = document.getElementById('lnk-apple');
      if (apple && n.tiene_iconos !== false) {
        apple.setAttribute('href', `/api/publico/icono/${encodeURIComponent(n.codigo)}/192.png`);
      }
    }
  },

  salir() {
    API.setToken(null);
    API.olvidarBootstrap();
    this.marcaGenerica();
    location.reload();
  },

  /* ===== Login ===== */
  vistaLogin(error) {
    const pendientes = API.colaPendiente();
    document.getElementById('app').innerHTML = `
      <div class="login-wrap"><div class="login-caja">
        <div class="marca">
          ${this.state.marcaLiga ? `
            ${this.state.marcaLiga.tiene_iconos ? `<img class="logo-marca" style="width:84px;height:84px;border-radius:18px;background:#fff"
               src="/api/publico/icono/${encodeURIComponent(this.state.marcaLiga.codigo)}/192.png" alt="">` : ''}
            <h2 style="margin:.4rem 0 0">${this.esc(this.state.marcaLiga.nombre)}</h2>`
          : '<img class="logo-marca ancho" src="icons/logo-horizontal.svg?v=2" alt="Sistema Pollerías">'}
        </div>
        ${pendientes > 0 ? `<div class="cinta">Tienes ${pendientes} venta(s) guardadas en este equipo.
           Entra para que se suban.</div>` : ''}
        <div class="tarjeta">
          <label>Usuario</label>
          <input id="lg-usuario" autocomplete="username" autocapitalize="none">
          <label>Contraseña</label>
          <input id="lg-pass" type="password" autocomplete="current-password">
          <button class="btn" onclick="App.login()">Entrar</button>
          ${error ? `<div class="msg-error">${this.esc(error)}</div>` : ''}
          <div id="lg-msg"></div>
          <!-- Casi todos los "no me deja entrar" son esto: se escribe el nombre
               del negocio o el de la persona en vez del usuario. Aquí no va
               ningún ejemplo: sería enseñarle a cualquiera un usuario real. -->
          <p class="suave" style="margin-top:.8rem">El usuario es el nombre corto que te
            dieron para entrar, no el nombre del negocio ni el tuyo. Si no lo recuerdas,
            pídelo por WhatsApp.</p>
        </div>
      </div></div>`;
    this.$('#lg-pass').addEventListener('keydown', e => { if (e.key === 'Enter') App.login(); });
  },

  async login() {
    const usuario = this.$('#lg-usuario').value.trim();
    const password = this.$('#lg-pass').value;
    this.$('#lg-msg').innerHTML = '';
    try {
      const r = await API.post('/login', { usuario, password });
      API.setToken(r.token);
      API.asegurarNegocioDelAparato();
      await this.iniciar();
    } catch (e) {
      this.$('#lg-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`;
    }
  },

  /* ===== Cascarón (topbar + nav) ===== */
  /* ¿La renta está tan vencida que ya se suspendió el servicio? */
  suspendido() {
    const s = this.state.suscripcion;
    return !!s && ['SUSPENDIDA', 'CANCELADA'].includes(s.estado);
  },

  pintar() {
    const n = this.state.negocio;
    const esAdmin = this.state.user.rol === 'superadmin';
    const tabs = esAdmin
      ? [['admin', 'Negocios'], ['pagos', 'Pagos'], ['dinero', 'Dinero']]
      : this.suspendido()
        ? [['cuenta', 'Mi cuenta']]
        : [
            ['vender', 'Vender'],
            ...(this.flag('compras') ? [['compras', 'Compras']] : []),
            ...(this.flag('inventario') ? [['inventario', 'Inventario']] : []),
            ...(this.flag('corte') ? [['corte', 'Corte']] : []),
            ['mas', 'Más']
          ];
    document.getElementById('app').innerHTML = `
      <div class="topbar">
        ${esAdmin ? this.ico('admin', 'g')
          : `<img class="logo" src="${n && n.logo ? n.logo : 'icons/icon-192.png?v=2'}" alt="">`}
        <div class="nombre">${this.esc(esAdmin ? 'Panel de administración' : (n ? n.nombre : ''))}</div>
        <span id="estado-red"></span>
        <div class="usuario">${this.esc(this.state.user.nombre)}<br>
          <a href="#" style="color:#fff;opacity:.85" onclick="App.salir();return false">salir</a></div>
      </div>
      ${this.avisoSuscripcion()}
      <div class="contenido" id="vista"></div>
      <div class="navbar">
        ${tabs.map(([id, txt]) =>
          `<button class="${this.state.vista === id ? 'activo' : ''}" onclick="App.ir('${id}')">
             ${this.ico(id)}${txt}</button>`).join('')}
      </div>`;
    this.pintarEstadoRed();
    this.pintarVista();
  },

  /* Cinta de aviso de cobranza. Solo aparece cuando hay algo que decir, y
     siempre con el botón que resuelve el problema, no solo el regaño. */
  avisoSuscripcion() {
    const s = this.state.suscripcion;
    if (!s || !s.aviso || this.state.user.rol === 'superadmin') return '';
    const urgente = ['GRACIA', 'RESTRINGIDA', 'SUSPENDIDA', 'CANCELADA'].includes(s.estado);
    return `<div class="cinta ${urgente ? 'urgente' : ''}">
        <span>${this.esc(s.aviso)}</span>
        <button onclick="App.ir('cuenta')">Ver mi cuenta</button>
      </div>`;
  },

  /* El semáforo de la barra: sin internet, o cuántas ventas faltan por subir.
     Se puede tocar para forzar el envío sin esperar al reintento automático. */
  pintarEstadoRed() {
    const el = document.getElementById('estado-red');
    if (!el) return;
    const pend = API.colaPendiente();
    const sinRed = !navigator.onLine;
    if (!sinRed && !pend) return (el.innerHTML = '');
    const texto = sinRed
      ? (pend > 0 ? `SIN INTERNET · ${pend} por subir` : 'SIN INTERNET')
      : `${pend} por subir`;
    el.innerHTML = `<span class="badge-offline" title="Tocar para intentar sincronizar"
        onclick="App.sincronizarAhora()">${texto}</span>`;
  },

  async sincronizarAhora() {
    if (!API.colaPendiente()) return;
    this.avisar('Enviando ventas guardadas…');
    const n = await API.sincronizarYAvisar(true);
    this.avisar(n > 0 ? `${n} venta(s) sincronizada(s)`
      : 'Todavía no hay internet. Se seguirán intentando solas.', n === 0);
    this.pintarEstadoRed();
  },

  ir(vista) {
    this.state.vista = vista;
    this.pintar();
  },

  /* Una vista que truena no debe dejar la pantalla en blanco con la caja
     abierta: se avisa y se ofrece volver a vender. */
  pintarVista() {
    const v = this.state.vista;
    const fn = {
      vender: this.vistaVender, compras: this.vistaCompras, inventario: this.vistaInventario,
      corte: this.vistaCorte, mas: this.vistaMas, reportes: this.vistaReportes,
      config: this.vistaConfig, admin: this.vistaAdmin, cuenta: this.vistaCuenta,
      pagos: this.vistaPagos, dinero: this.vistaDinero
    }[v];
    if (!fn) return;
    try {
      const r = fn.call(this);
      if (r && typeof r.catch === 'function') r.catch(e => this.vistaConProblema(e));
    } catch (e) { this.vistaConProblema(e); }
  },

  vistaConProblema(e) {
    console.error(e);
    const el = this.$('#vista');
    if (!el) return;
    el.innerHTML = `<div class="tarjeta centrado">
        <h3>No se pudo mostrar esta pantalla</h3>
        <p class="suave">${this.esc((e && e.message) || 'Error inesperado')}</p>
        <button class="btn" onclick="App.ir('vender')">Volver a vender</button>
      </div>`;
  },

  /* =========================================================
     VENDER (POS)
     ========================================================= */
  vistaVender() {
    const filtro = (this.state.filtroPos || '').toLowerCase();
    const piezas = this.state.piezas.filter(p =>
      p.vendible && (!filtro || p.nombre.toLowerCase().includes(filtro)));
    const car = this.state.carrito;
    const total = car.reduce((s, i) => s + i.subtotal, 0);
    this.$('#vista').innerHTML = `
      <div class="buscador">
        ${this.ico('buscar')}
        <input id="pos-buscar" placeholder="Buscar producto (ej. patas, pechuga...)" value="${this.esc(this.state.filtroPos)}"
               oninput="App.filtrarPos(this.value)" autocapitalize="none">
      </div>
      <div class="grid-piezas" id="pos-grid">
        ${piezas.map(p => this._tilePieza(p)).join('') || '<p class="suave">Sin resultados para esa búsqueda.</p>'}
      </div>
      <div class="carrito tarjeta" ${car.length ? '' : 'style="display:none"'}>
        ${car.map((i, idx) => `
          <div class="item">
            <div><b>${this.esc(i.nombre)}</b><br>
              <span class="qx">${this.num(i.cantidad, 3)} ${i.modo === 'kg' ? 'kg' : 'pza(s)'} × ${this.dinero(i.precio)}</span></div>
            <div>${this.dinero(i.subtotal)}
              <button class="quitar" onclick="App.quitarItem(${idx})">✕</button></div>
          </div>`).join('')}
        <div class="total-linea"><span>TOTAL</span><span>${this.dinero(total)}</span></div>
        <button class="btn" onclick="App.abrirCobro()">COBRAR ${this.dinero(total)}</button>
      </div>`;
  },

  _tilePieza(p) {
    const puedePieza = !p.es_extra && p.por_pollo > 0 && p.precio_pieza > 0;
    return `
      <div class="pieza-btn ${p.es_extra ? 'extra' : ''}" onclick="App.abrirPieza(${p.id})">
        <span class="pnombre">${this.esc(p.nombre)}</span>
        <span class="pprecio">${this.dinero(p.precio_kilo)} <small>kg</small></span>
        ${puedePieza
          ? `<span class="punidad">${this.dinero(p.precio_pieza)} por pieza</span>`
          : `<span class="punidad">por kilo</span>`}
      </div>`;
  },

  filtrarPos(v) {
    this.state.filtroPos = v;
    const filtro = v.toLowerCase();
    const piezas = this.state.piezas.filter(p =>
      p.vendible && (!filtro || p.nombre.toLowerCase().includes(filtro)));
    this.$('#pos-grid').innerHTML =
      piezas.map(p => this._tilePieza(p)).join('') || '<p class="suave">Sin resultados para esa búsqueda.</p>';
  },

  abrirPieza(piezaId) {
    const p = this.state.piezas.find(x => x.id === piezaId);
    if (!p) return;
    const puedePieza = !p.es_extra && p.por_pollo > 0 && p.precio_pieza > 0;
    this.modal(`
      <h3>${this.esc(p.nombre)}</h3>
      <p class="suave">${this.dinero(p.precio_kilo)} por kilo${puedePieza ? ' · ' + this.dinero(p.precio_pieza) + ' por pieza' : ''}</p>
      ${puedePieza ? `
        <div class="selector-modo">
          <button id="modo-kg" class="activo" onclick="App._modo('kg')">Por KILO</button>
          <button id="modo-pieza" onclick="App._modo('pieza')">Por PIEZA</button>
        </div>` : ''}
      <label id="lbl-cant">Kilos</label>
      <input id="cantidad" type="number" step="0.001" inputmode="decimal" placeholder="0.000">
      <div class="atajos" id="atajos"></div>
      <button class="btn" onclick="App.agregarItem(${p.id})">Agregar</button>`);
    this._piezaModo = 'kg';
    this._pintarAtajos(p);
    setTimeout(() => this.$('#cantidad').focus(), 60);
  },

  _modo(m) {
    this._piezaModo = m;
    this.$('#modo-kg').classList.toggle('activo', m === 'kg');
    this.$('#modo-pieza').classList.toggle('activo', m === 'pieza');
    this.$('#lbl-cant').textContent = m === 'kg' ? 'Kilos' : 'Número de piezas';
    this.$('#cantidad').value = '';
    const p = this.state.piezas.find(x => x.id === this._piezaActual);
    this._pintarAtajos(p);
  },

  _pintarAtajos(p) {
    if (p) this._piezaActual = p.id;
    const vals = this._piezaModo === 'kg' ? [0.25, 0.5, 1, 1.5, 2] : [1, 2, 3, 4, 6];
    this.$('#atajos').innerHTML = vals.map(v =>
      `<button onclick="App.$('#cantidad').value='${v}'">${v}${this._piezaModo === 'kg' ? ' kg' : ''}</button>`).join('');
  },

  agregarItem(piezaId) {
    const p = this.state.piezas.find(x => x.id === piezaId);
    const cant = parseFloat(this.$('#cantidad').value);
    if (!p || !cant || cant <= 0) return this.avisar('Escribe una cantidad válida', true);
    const modo = this._piezaModo || 'kg';
    const precio = modo === 'kg' ? p.precio_kilo : p.precio_pieza;
    this.state.carrito.push({
      pieza_id: p.id, nombre: p.nombre, modo, cantidad: cant, precio,
      subtotal: Math.round(cant * precio * 100) / 100
    });
    this.cerrarModal();
    this.vistaVender();
  },

  quitarItem(idx) {
    this.state.carrito.splice(idx, 1);
    this.vistaVender();
  },

  abrirCobro() {
    const total = this.state.carrito.reduce((s, i) => s + i.subtotal, 0);
    this.modal(`
      <h3>Cobrar</h3>
      <div class="total-grande">${this.dinero(total)}</div>
      <label>Pago del cliente</label>
      <input id="pago" type="number" step="0.01" inputmode="decimal" placeholder="0.00"
             oninput="App._calcCambio(${total})">
      <div class="atajos">
        ${[Math.ceil(total), Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 200) * 200]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(v => `<button onclick="App.$('#pago').value='${v}';App._calcCambio(${total})">$${v}</button>`).join('')}
      </div>
      <div id="cambio" class="cambio-grande" style="margin-top:.6rem"></div>
      <button class="btn" onclick="App.confirmarVenta()">${this.ico('check')} CONFIRMAR VENTA</button>`);
  },

  _calcCambio(total) {
    const pago = parseFloat(this.$('#pago').value) || 0;
    this.$('#cambio').textContent = pago >= total ? 'Cambio: ' + this.dinero(pago - total) : '';
  },

  async confirmarVenta() {
    const items = this.state.carrito;
    if (!items.length) return;
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const pago = parseFloat(this.$('#pago') ? this.$('#pago').value : 0) || 0;
    const venta = { uuid: this.uuid(), items, pago };
    const btn = document.querySelector('#modal .btn');
    if (btn) btn.disabled = true;
    try {
      const r = await API.registrarVenta(venta);
      const cambio = pago > total ? pago - total : 0;
      this.state.carrito = [];
      this.mostrarTicket({ items, total, pago, cambio, offline: !r.online });
      this.pintarEstadoRed();
    } catch (e) {
      if (btn) btn.disabled = false;
      this.avisar(e.message, true);
    }
  },

  mostrarTicket(v) {
    const n = this.state.negocio;
    const lineas = [];
    lineas.push(centro(n.nombre));
    if (n.ticket_direccion) lineas.push(centro(n.ticket_direccion));
    if (n.ticket_telefono) lineas.push(centro('Tel: ' + n.ticket_telefono));
    lineas.push(new Date().toLocaleString('es-MX'));
    lineas.push('--------------------------------');
    for (const i of v.items) {
      lineas.push(i.nombre);
      lineas.push(`  ${this.num(i.cantidad, 3)} ${i.modo === 'kg' ? 'kg' : 'pza'} x ${this.dinero(i.precio)} = ${this.dinero(i.subtotal)}`);
    }
    lineas.push('--------------------------------');
    lineas.push('TOTAL:  ' + this.dinero(v.total));
    if (v.pago > 0) {
      lineas.push('PAGO:   ' + this.dinero(v.pago));
      lineas.push('CAMBIO: ' + this.dinero(v.cambio));
    }
    lineas.push('');
    lineas.push(centro(n.ticket_leyenda || 'GRACIAS POR SU COMPRA'));
    const texto = lineas.join('\n');
    function centro(s) { s = String(s || ''); const pad = Math.max(0, Math.floor((32 - s.length) / 2)); return ' '.repeat(pad) + s; }

    this.modal(`
      <h3>${v.offline ? this.ico('offline') + ' Venta guardada (se sincronizará)' : this.ico('check') + ' Venta registrada'}</h3>
      <div class="ticket">${this.esc(texto)}</div>
      ${this.flag('whatsapp') ? `
        <button class="btn secundario" onclick="window.open('https://wa.me/?text=' + encodeURIComponent(${JSON.stringify(texto).replace(/"/g, '&quot;')}))">
          ${this.ico('enviar')} Enviar ticket por WhatsApp</button>` : ''}
      <button class="btn" onclick="App.cerrarModal();App.vistaVender()">Nueva venta</button>`);
  },

  /* =========================================================
     COMPRAS (despiece automático)
     ========================================================= */
  async vistaCompras() {
    const n = this.state.negocio;
    this.$('#vista').innerHTML = `
      <h2>${this.ico('compras')} Compra de pollo</h2>
      <div class="tarjeta">
        <label>¿Cuántos pollos compraste?</label>
        <input id="cp-pollos" type="number" inputmode="numeric" placeholder="15"
               oninput="App._sugerirKg()">
        <div class="fila">
          <div><label>Kilos totales (báscula)</label>
            <input id="cp-kg" type="number" step="0.01" inputmode="decimal"></div>
          <div><label>Costo por kilo</label>
            <input id="cp-costo" type="number" step="0.01" inputmode="decimal" value="${n.costo_kilo || ''}"></div>
        </div>
        <button class="btn" onclick="App.registrarCompra()">Registrar compra y calcular despiece</button>
        <div id="cp-msg"></div>
      </div>
      <div id="cp-resultado"></div>
      <h3>Compras recientes</h3>
      <div class="tarjeta tabla-scroll" id="cp-lista">Cargando…</div>`;
    try {
      const c = await API.getCache('/compras', 'compras');
      const lista = c.datos || [];
      this.$('#cp-lista').innerHTML = (c.deCache
        ? `<div class="cinta">${this.ico('offline')} <span>Sin conexión: compras guardadas
             a las ${this.hora(c.capturado_en)}. Para registrar una compra nueva sí hace falta internet.</span></div>`
        : '') + (lista.length ? `
        <table><tr><th>Fecha</th><th class="num">Pollos</th><th class="num">Kilos</th><th class="num">$/kg</th><th class="num">Costo</th></tr>
        ${lista.map(co => `<tr>
          <td>${String(co.fecha).slice(0, 10)}</td>
          <td class="num">${co.pollos}</td>
          <td class="num">${this.num(co.kg_total)}</td>
          <td class="num">${this.dinero(co.costo_kilo)}</td>
          <td class="num">${this.dinero(co.costo_total)}</td></tr>`).join('')}</table>`
        : '<p class="suave">Aún no hay compras registradas.</p>');
    } catch (e) {
      this.$('#cp-lista').innerHTML = `<p class="suave">${this.esc(API.esDeRed(e)
        ? 'Sin internet y sin compras guardadas en este equipo.' : e.message)}</p>`;
    }
  },

  _sugerirKg() {
    const pollos = parseInt(this.$('#cp-pollos').value, 10) || 0;
    if (pollos > 0 && !this.$('#cp-kg').value) {
      const kg = pollos * (this.state.negocio.peso_promedio_g || 2500) / 1000;
      this.$('#cp-kg').placeholder = kg.toFixed(1) + ' (estimado)';
    }
  },

  async registrarCompra() {
    const pollos = parseInt(this.$('#cp-pollos').value, 10);
    let kg = parseFloat(this.$('#cp-kg').value);
    const costo = parseFloat(this.$('#cp-costo').value);
    if (!kg && pollos) kg = pollos * (this.state.negocio.peso_promedio_g || 2500) / 1000;
    this.$('#cp-msg').innerHTML = '';
    try {
      const r = await API.post('/compras', { pollos, kg_total: kg, costo_kilo: costo });
      this._ultimaCompra = r;
      this.$('#cp-resultado').innerHTML = `
        <div class="tarjeta">
          <h3>${this.ico('check')} Despiece esperado de ${pollos} pollos (${this.num(kg)} kg — ${this.dinero(r.costo_total)})</h3>
          <p class="suave">Puedes corregir las piezas o los kilos si tu despiece real fue distinto, y guardar los ajustes.</p>
          <div class="tabla-scroll"><table>
            <tr><th>Pieza</th><th class="num">Piezas</th><th class="num">Kilos esperados</th></tr>
            ${r.despiece.map(d => `<tr>
              <td>${this.esc(d.nombre)}</td>
              <td class="num"><input style="width:70px" type="number" step="1" id="dp-pz-${d.pieza_id}" value="${d.piezas_esperadas}"></td>
              <td class="num"><input style="width:80px" type="number" step="0.01" id="dp-kg-${d.pieza_id}" value="${d.kg_esperados}"></td></tr>`).join('')}
          </table></div>
          <button class="btn secundario" onclick="App.guardarDespiece(${r.compra_id})">Guardar ajustes del despiece</button>
          <p class="suave">El inventario ya se actualizó con estos kilos; si ajustas, se corrige solo.</p>
        </div>`;
      this.avisar('Compra registrada');
    } catch (e) {
      this.$('#cp-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`;
    }
  },

  async guardarDespiece(compraId) {
    const r = this._ultimaCompra;
    if (!r || r.compra_id !== compraId) return;
    const items = r.despiece.map(d => ({
      pieza_id: d.pieza_id,
      piezas_esperadas: parseFloat(this.$('#dp-pz-' + d.pieza_id).value) || 0,
      kg_esperados: parseFloat(this.$('#dp-kg-' + d.pieza_id).value) || 0
    }));
    try {
      await API.put('/compras/' + compraId + '/despiece', { items });
      for (const d of r.despiece) {
        const nuevo = items.find(i => i.pieza_id === d.pieza_id);
        d.piezas_esperadas = nuevo.piezas_esperadas;
        d.kg_esperados = nuevo.kg_esperados;
      }
      this.avisar('Despiece ajustado; inventario corregido');
    } catch (e) { this.avisar(e.message, true); }
  },

  /* =========================================================
     INVENTARIO
     ========================================================= */
  async vistaInventario() {
    this.$('#vista').innerHTML = `<h2>${this.ico('inventario')} Inventario actual</h2><div class="tarjeta tabla-scroll" id="inv">Cargando…</div>
      <p class="suave">Los kilos entran con cada compra (despiece) y se descuentan con cada venta.
      Un número negativo significa que se vendió más de lo esperado en el despiece.</p>`;
    try {
      const c = await API.getCache('/inventario', 'inventario');
      const n = this.state.negocio;
      const inv = (c.datos || []).map(p => ({ ...p }));

      // Sin internet, al inventario guardado se le restan las ventas que este
      // equipo hizo después: es un estimado, pero es el número con el que se
      // trabaja en el mostrador.
      const extra = API.ventasNoContadas(c.capturado_en);
      for (const v of extra) {
        for (const it of (v.items || [])) {
          const p = inv.find(x => x.pieza_id === it.pieza_id);
          if (!p) continue;
          const pesoPieza = p.por_pollo > 0 ? (p.rendimiento * n.peso_promedio_g / 1000) / p.por_pollo : 0;
          p.kg -= it.modo === 'pieza' ? (Number(it.cantidad) || 0) * pesoPieza : (Number(it.cantidad) || 0);
        }
      }

      this.$('#inv').innerHTML = `
        ${c.deCache ? `<div class="cinta">${this.ico('offline')}
          <span>Sin conexión: inventario guardado a las ${this.hora(c.capturado_en)},
          menos lo vendido aquí desde entonces.</span></div>` : ''}
        <table><tr><th>Pieza</th><th class="num">Kilos</th><th class="num">≈ Piezas</th></tr>
        ${inv.map(p => {
          const pesoPieza = p.por_pollo > 0 ? (p.rendimiento * n.peso_promedio_g / 1000) / p.por_pollo : 0;
          const aproxPzas = pesoPieza > 0 ? p.kg / pesoPieza : 0;
          return `<tr class="${p.kg < 0 ? 'alerta' : ''}">
            <td>${this.esc(p.nombre)}</td>
            <td class="num">${this.num(p.kg, 2)}</td>
            <td class="num">${pesoPieza > 0 ? this.num(aproxPzas, 0) : '—'}</td></tr>`;
        }).join('')}</table>`;
    } catch (e) {
      this.$('#inv').innerHTML = `<p class="suave">${this.esc(API.esDeRed(e)
        ? 'Sin internet y todavía sin una copia del inventario en este equipo.'
        : e.message)}</p>`;
    }
  },

  /* =========================================================
     CORTE DE CAJA
     ========================================================= */
  /**
   * Corte de caja que también funciona sin internet.
   *
   * Se parte del último resumen que dio el servidor (guardado en el equipo) y
   * se le suman las ventas de este dispositivo que el servidor todavía no
   * tenía en ese momento. Así el número que ve el dueño es el bueno, con o
   * sin señal, y ninguna venta se cuenta dos veces.
   */
  async vistaCorte() {
    this.$('#vista').innerHTML = `<h2>${this.ico('corte')} Corte de caja</h2><div id="corte-cont">Cargando…</div>`;
    // Las ventas del día de TODOS los equipos (si no hay señal, sigue con
    // lo que se sepa de este). No afecta ninguna suma del corte: esos
    // números siguen saliendo del resumen del servidor.
    await API.ventasDelDiaServidor();
    let base = null, deCache = false, capturado = 0, falloRed = false;
    try {
      const c = await API.getCache('/corte/hoy', 'corte-hoy');
      base = c.datos; deCache = c.deCache; capturado = c.capturado_en || 0;
    } catch (e) {
      if (!API.esDeRed(e)) {
        return (this.$('#corte-cont').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`);
      }
      falloRed = true;
    }
    const r = base || { num_ventas: 0, total_ventas: 0, por_pieza: [], cerrado: false,
                        compras: { costo: 0, pollos: 0, kg: 0 } };

    const extra = API.ventasNoContadas(capturado);
    const totalExtra = extra.reduce((s, v) => s + this._totalVenta(v), 0);
    const porPieza = (r.por_pieza || []).map(p => ({ ...p }));
    for (const v of extra) {
      for (const it of (v.items || [])) {
        const y = porPieza.find(p => p.nombre === it.nombre && p.modo === it.modo);
        if (y) { y.cantidad += Number(it.cantidad) || 0; y.importe += Number(it.subtotal) || 0; }
        else porPieza.push({ nombre: it.nombre, modo: it.modo,
                             cantidad: Number(it.cantidad) || 0, importe: Number(it.subtotal) || 0 });
      }
    }
    porPieza.sort((a, b) => b.importe - a.importe);
    const numVentas = (r.num_ventas || 0) + extra.length;
    const total = (r.total_ventas || 0) + totalExtra;
    const sinRed = deCache || falloRed || !navigator.onLine;
    const sinSubir = extra.filter(v => !v.sincronizada);

    this.$('#corte-cont').innerHTML = `
      ${sinRed ? `<div class="cinta">
          ${this.ico('offline')} <span>Sin conexión: ${base
            ? 'los totales del servidor son de ' + this.hora(capturado) + ' más lo vendido aquí desde entonces.'
            : 'se muestran solo las ventas hechas en este equipo.'}</span></div>` : ''}
      <div class="stats">
        <div class="stat"><div class="v">${numVentas}</div><div class="l">Ventas hoy</div></div>
        <div class="stat"><div class="v">${this.dinero(total)}</div><div class="l">Total vendido</div></div>
        <div class="stat"><div class="v">${this.dinero(r.compras.costo)}</div><div class="l">Compras hoy (${r.compras.pollos} pollos)</div></div>
      </div>
      ${extra.length ? `<p class="suave">Incluye ${extra.length} venta(s) de este equipo por
        ${this.dinero(totalExtra)}${sinSubir.length ? `, de las cuales ${sinSubir.length} todavía no
        suben al servidor` : ''}.</p>` : ''}
      <div class="tarjeta tabla-scroll">
        <h3>Vendido por producto</h3>
        ${porPieza.length ? `<table><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Importe</th></tr>
          ${porPieza.map(p => `<tr><td>${this.esc(p.nombre)}</td>
            <td class="num">${this.num(p.cantidad, 2)} ${p.modo === 'kg' ? 'kg' : 'pzas'}</td>
            <td class="num">${this.dinero(p.importe)}</td></tr>`).join('')}</table>`
          : '<p class="suave">Sin ventas todavía.</p>'}
      </div>
      ${this.tarjetaVentasDelDia()}
      <div class="tarjeta">
        <h3>${r.cerrado ? 'Corte cerrado ' + this.ico('check') : 'Cerrar el día'}</h3>
        ${r.cerrado ? `
          <p>Efectivo contado: <b>${this.dinero(r.corte.efectivo_contado)}</b><br>
             Diferencia: <b style="color:${r.corte.diferencia < 0 ? 'var(--error)' : 'var(--ok)'}">${this.dinero(r.corte.diferencia)}</b></p>
          <p class="suave">Puedes volver a cerrarlo si registraste más ventas después.</p>` : ''}
        <label>Efectivo contado en caja</label>
        <input id="ct-efectivo" type="number" step="0.01" inputmode="decimal">
        <button class="btn" onclick="App.cerrarCorte()">Cerrar corte de hoy</button>
        <p class="suave">El corte se cierra en el servidor: si no hay internet, primero
          se suben las ventas guardadas.</p>
        <div id="ct-msg"></div>
      </div>`;
  },

  _totalVenta(v) {
    if (Number.isFinite(v.total)) return v.total;
    return (v.items || []).reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  },

  hora(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Ventas del día de TODO el negocio: las que ya están en el servidor (las
   * haya hecho el teléfono, la compu o cualquier otro equipo) más las de
   * este aparato que todavía no suben. Sin internet se ven las de este
   * equipo, como antes.
   */
  tarjetaVentasDelDia() {
    const delServidor = API.ventasServidorGuardadas();
    const locales = API.ventasDeHoy();
    // Las que ya subieron llegan por el servidor: aquí solo se agregan las
    // que faltan, para no contar la misma venta dos veces en la lista.
    const pendientes = locales.filter((v) => !v.sincronizada);
    const ventas = delServidor
      ? [...pendientes, ...delServidor.lista]
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      : locales;
    const sinRed = !delServidor || delServidor.falloRed;
    if (!ventas.length) return '';
    return `
      <div class="tarjeta tabla-scroll">
        <h3>Ventas de hoy${sinRed ? ' en este equipo' : ''} (${ventas.length})</h3>
        <table>
          <tr><th>Hora</th><th>Productos</th><th class="num">Total</th><th></th></tr>
          ${ventas.slice(0, 60).map(v => `<tr>
            <td>${this.hora(new Date(v.fecha).getTime())}</td>
            <td>${this.esc((v.items || []).map(i => i.nombre).join(', ')).slice(0, 60)}</td>
            <td class="num">${this.dinero(this._totalVenta(v))}</td>
            <td>${v.sincronizada
              ? `<span class="suave" title="Ya está en el servidor">${this.ico('check')}</span>`
              : '<span class="etiqueta chica" style="background:#b8860b">por subir</span>'}</td>
          </tr>`).join('')}
        </table>
        <p class="suave">${sinRed
          ? 'Sin conexión: se muestran las de este equipo. Se suben solas cuando vuelve la señal.'
          : 'Incluye lo cobrado en todos los equipos del negocio.'}</p>
      </div>`;
  },

  async cerrarCorte() {
    const efectivo = parseFloat(this.$('#ct-efectivo').value) || 0;
    try {
      // Primero suben las ventas pendientes: cerrar el corte sin ellas daría
      // una diferencia falsa y el dueño creería que le falta dinero.
      if (API.colaPendiente() > 0) {
        this.$('#ct-msg').innerHTML = '<p class="suave">Subiendo las ventas guardadas…</p>';
        await API.sincronizar();
        if (API.colaPendiente() > 0) {
          this.$('#ct-msg').innerHTML = `<div class="msg-error">Faltan ${API.colaPendiente()} venta(s)
            por subir y sin internet no se puede cerrar el corte. Conéctate un momento y vuelve a intentar.</div>`;
          return;
        }
      }
      const r = await API.post('/corte', { efectivo_contado: efectivo });
      this.avisar('Corte cerrado. Diferencia: ' + this.dinero(r.diferencia), false);
      this.vistaCorte();
    } catch (e) {
      this.$('#ct-msg').innerHTML = `<div class="msg-error">${this.esc(
        API.esDeRed(e) ? 'Sin internet: el corte se cierra cuando vuelva la señal. Tus ventas ya están guardadas.' : e.message)}</div>`;
    }
  },

  /* =========================================================
     MÁS (menú)
     ========================================================= */
  vistaMas() {
    const esDueno = this.state.user.rol === 'dueno';
    const pend = API.colaPendiente();
    const rechazadas = API.ventasRechazadas().length;
    this.$('#vista').innerHTML = `
      <h2>Más opciones</h2>
      <div class="tarjeta">
        <h3>${navigator.onLine ? this.ico('check') : this.ico('offline')} Conexión</h3>
        <p class="suave">${navigator.onLine ? 'Con internet.' : 'Sin internet: puedes seguir vendiendo, todo se guarda aquí.'}</p>
        <p>${pend > 0
          ? `<b>${pend}</b> venta(s) esperando para subir.`
          : 'No hay ventas pendientes de subir.'}</p>
        ${pend > 0 ? `<button class="btn chico" onclick="App.sincronizarAhora()">Intentar subirlas ahora</button>` : ''}
        ${rechazadas > 0 ? `<p class="suave" style="color:var(--error)">${rechazadas} venta(s) que el
          servidor no aceptó. Anótalas a mano y avisa a soporte.</p>` : ''}
      </div>
      ${this.tarjetaInstalar()}
      <div class="tarjeta lista-simple">
        ${this.flag('reportes') ? `<div onclick="App.ir('reportes')" style="cursor:pointer"><span>${this.ico('reportes')} Reportes</span><span>›</span></div>` : ''}
        ${esDueno ? `<div onclick="App.ir('config')" style="cursor:pointer"><span>${this.ico('config')} Configuración del negocio</span><span>›</span></div>` : ''}
        ${esDueno ? `<div onclick="App.ir('cuenta')" style="cursor:pointer"><span>${this.ico('cuenta')} Mi cuenta y pagos</span><span>›</span></div>` : ''}
        <div onclick="App.salir()" style="cursor:pointer"><span>${this.ico('salir')} Cerrar sesión</span><span>›</span></div>
      </div>
      <p class="suave centrado">Versión 1.2 · funciona sin internet</p>`;
  },

  /**
   * Instalar la app en el equipo. Instalada pesa menos, abre a pantalla
   * completa y —lo que importa aquí— guarda su caché aparte, así que aguanta
   * mejor los días sin internet.
   */
  tarjetaInstalar() {
    const instalada = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (instalada) {
      return `<div class="tarjeta"><h3>${this.ico('check')} App instalada</h3>
        <p class="suave">Estás usando la app instalada en este equipo.</p></div>`;
    }
    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (this._instalador) {
      return `<div class="tarjeta">
        <h3>Instalar la app en este equipo</h3>
        <p class="suave">Queda con su icono en la pantalla de inicio o en el escritorio.</p>
        <button class="btn" onclick="App.instalar()">Instalar</button></div>`;
    }
    if (esIOS) {
      return `<div class="tarjeta">
        <h3>Instalar en el iPhone</h3>
        <p class="suave">Toca el botón de compartir de Safari y elige
          <b>“Agregar a la pantalla de inicio”</b>.</p></div>`;
    }
    return `<div class="tarjeta">
      <h3>Instalar la app</h3>
      <p class="suave">En Android o en la computadora, abre el menú del navegador y elige
        <b>“Instalar app”</b> o <b>“Agregar a la pantalla de inicio”</b>.</p></div>`;
  },

  async instalar() {
    if (!this._instalador) return;
    this._instalador.prompt();
    try { await this._instalador.userChoice; } catch (e) { /* el usuario cerró */ }
    this._instalador = null;
    this.vistaMas();
  },

  /* =========================================================
     REPORTES
     ========================================================= */
  async vistaReportes() {
    const hoy = new Date().toISOString().slice(0, 10);
    const hace7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    this.$('#vista').innerHTML = `
      <h2>${this.ico('reportes')} Reportes</h2>
      <div class="tarjeta"><div class="fila">
        <div><label>Desde</label><input id="rp-desde" type="date" value="${hace7}"></div>
        <div><label>Hasta</label><input id="rp-hasta" type="date" value="${hoy}"></div>
      </div>
      <button class="btn chico" style="margin-top:.7rem" onclick="App.cargarReporte()">Actualizar</button></div>
      <div id="rp-cont">Cargando…</div>`;
    this.cargarReporte();
  },

  async cargarReporte() {
    try {
      const r = await API.get(`/reportes/resumen?desde=${this.$('#rp-desde').value}&hasta=${this.$('#rp-hasta').value}`);
      this.$('#rp-cont').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="v">${this.dinero(r.total_ventas)}</div><div class="l">Ventas</div></div>
          <div class="stat"><div class="v">${this.dinero(r.total_compras)}</div><div class="l">Compras</div></div>
          <div class="stat"><div class="v" style="color:${r.ganancia_bruta < 0 ? 'var(--error)' : 'var(--ok)'}">${this.dinero(r.ganancia_bruta)}</div><div class="l">Ganancia bruta</div></div>
        </div>
        <div class="tarjeta tabla-scroll"><h3>Por día</h3>
          ${r.por_dia.length ? `<table><tr><th>Día</th><th class="num">Ventas</th><th class="num">Total</th></tr>
          ${r.por_dia.map(d => `<tr><td>${String(d.dia).slice(0, 10)}</td><td class="num">${d.ventas}</td><td class="num">${this.dinero(d.total)}</td></tr>`).join('')}</table>` : '<p class="suave">Sin ventas en el periodo.</p>'}
        </div>
        <div class="tarjeta tabla-scroll"><h3>Productos más vendidos</h3>
          ${r.top_piezas.length ? `<table><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Importe</th></tr>
          ${r.top_piezas.map(p => `<tr><td>${this.esc(p.nombre)}</td><td class="num">${this.num(p.cantidad, 2)}</td><td class="num">${this.dinero(p.importe)}</td></tr>`).join('')}</table>` : '<p class="suave">—</p>'}
        </div>`;
    } catch (e) { this.$('#rp-cont').innerHTML = '<p class="suave">Necesitas internet para los reportes.</p>'; }
  },

  /* =========================================================
     CONFIGURACIÓN (dueño)
     ========================================================= */
  async vistaConfig() {
    const n = this.state.negocio;
    this.$('#vista').innerHTML = `
      <h2>${this.ico('config')} Configuración</h2>
      <div class="tarjeta">
        <h3>Datos del negocio</h3>
        <p class="suave">El nombre, logo y colores de tu app los personaliza el administrador del sistema — pídeselos por WhatsApp.</p>
        <label>Dirección (para el ticket)</label><input id="cf-dir" value="${this.esc(n.ticket_direccion)}">
        <div class="fila">
          <div><label>Teléfono</label><input id="cf-tel" value="${this.esc(n.ticket_telefono)}"></div>
          <div><label>WhatsApp del negocio</label><input id="cf-wa" value="${this.esc(n.whatsapp)}"></div>
        </div>
        <label>Leyenda del ticket</label><input id="cf-leyenda" value="${this.esc(n.ticket_leyenda)}">
        <div class="fila">
          <div><label>Peso promedio del pollo (gramos)</label><input id="cf-peso" type="number" value="${n.peso_promedio_g}"></div>
          <div><label>Costo por kilo (compra)</label><input id="cf-costo" type="number" step="0.01" value="${n.costo_kilo}"></div>
        </div>
        <button class="btn" onclick="App.guardarConfig()">Guardar datos</button>
        <div id="cf-msg"></div>
      </div>
      ${this.flag('precios') ? `
      <div class="tarjeta tabla-scroll">
        <h3>Precios y despiece esperado</h3>
        <p class="suave">El % de rendimiento y las piezas por pollo definen el despiece que se calcula en cada compra. Ajústalos a como corta tu pollería.</p>
        <table><tr><th>Pieza</th><th class="num">$/kilo</th><th class="num">$/pieza</th><th class="num">% rend.</th><th class="num">Pzas/pollo</th></tr>
        ${this.state.piezas.map(p => `<tr>
          <td>${this.esc(p.nombre)}</td>
          <td class="num"><input style="width:70px" type="number" step="0.01" id="pk-${p.id}" value="${p.precio_kilo}"></td>
          <td class="num"><input style="width:70px" type="number" step="0.01" id="pp-${p.id}" value="${p.precio_pieza}"></td>
          <td class="num">${p.es_extra ? '—' : `<input style="width:60px" type="number" step="0.1" id="rd-${p.id}" value="${Math.round(p.rendimiento * 1000) / 10}">`}</td>
          <td class="num">${p.es_extra ? '—' : `<input style="width:55px" type="number" step="1" id="pl-${p.id}" value="${p.por_pollo}">`}</td></tr>`).join('')}</table>
        <button class="btn" onclick="App.guardarPrecios()">Guardar precios y despiece</button>
      </div>` : ''}
      ${this.flag('empleados') ? `
      <div class="tarjeta">
        <h3>Empleados</h3>
        <p class="suave">Tú decides qué puede hacer cada quien y tú le entregas su
          contraseña. Ellos no la pueden cambiar: si se les olvida, aquí la vuelves a ver.</p>
        <div id="cf-empleados" class="lista-simple">Cargando…</div>
        <div class="fila" style="margin-top:.7rem">
          <input id="em-nombre" placeholder="Nombre de la persona">
          <input id="em-usuario" placeholder="usuario" autocapitalize="none">
        </div>
        <div class="fila" style="margin-top:.6rem">
          <input id="em-pass" placeholder="contraseña">
          <button class="btn chico" onclick="App.sugerirClaveEmpleado()">Generar una</button>
        </div>
        <div id="em-funciones" class="funciones-emp"></div>
        <button class="btn chico" style="margin-top:.7rem" onclick="App.crearEmpleado()">+ Agregar empleado</button>
        <div id="em-msg"></div>
      </div>` : ''}`;
    if (!this.flag('empleados')) return;
    this.pintarFuncionesEmpleado();
    try {
      // La lista llega como arreglo (la forma de siempre). Las funciones que
      // se pueden marcar son las de aquí abajo: no hace falta preguntarlas.
      const empleados = await API.get('/empleados');
      const el = this.$('#cf-empleados');
      if (el) el.innerHTML = (empleados || []).map((e) => `
        <div class="renglon-emp">
          <div>
            <b>${this.esc(e.nombre)}</b>
            <span class="suave">${this.esc(e.usuario)} · ${this.esc(e.rol)}${e.activo ? '' : ' · dado de baja'}</span>
            <div class="suave chico">${e.rol === 'dueno' ? 'Todo'
              : (e.permisos.length ? e.permisos.map((p) => this.NOMBRE_FUNCION[p] || p).join(' · ') : 'ninguna función marcada')}</div>
          </div>
          <div class="acciones-emp">
            <button class="btn chico" onclick="App.verAccesoEmpleado(${e.id})">Ver acceso</button>
            ${e.rol === 'dueno' ? '' : `<button class="btn chico" onclick="App.editarEmpleado(${e.id})">Funciones</button>`}
          </div>
        </div>`).join('') || '<p class="suave">Solo tú por ahora.</p>';
      this.state.empleados = empleados || [];
    } catch (e) {
      const el = this.$('#cf-empleados');
      if (el) el.innerHTML = '<p class="suave">No se pudo cargar la lista (¿sin internet?).</p>';
    }
  },

  NOMBRE_FUNCION: {
    vender: 'Cobrar', compras: 'Compras y despiece', inventario: 'Inventario',
    corte: 'Corte de caja', reportes: 'Reportes y ganancias',
  },

  /* Las palomitas de "qué puede hacer" del empleado nuevo. */
  pintarFuncionesEmpleado(marcadas) {
    const caja = this.$('#em-funciones');
    if (!caja) return;
    const lista = this.state.funcionesEmpleado || ['vender', 'compras', 'inventario', 'corte', 'reportes'];
    const puestas = marcadas || lista;
    caja.innerHTML = '<p class="suave" style="margin:.6rem 0 .3rem">Qué puede hacer</p>'
      + lista.map((f) => `<label class="funcion-emp">
          <input type="checkbox" id="fn-${f}" ${puestas.includes(f) ? 'checked' : ''}>
          <span>${this.NOMBRE_FUNCION[f] || f}</span></label>`).join('');
  },

  funcionesMarcadas() {
    return (this.state.funcionesEmpleado || ['vender', 'compras', 'inventario', 'corte', 'reportes'])
      .filter((f) => { const c = this.$('#fn-' + f); return c && c.checked; });
  },

  async sugerirClaveEmpleado() {
    try {
      const r = await API.get('/empleados-clave-sugerida');
      this.$('#em-pass').value = r.password;
    } catch (e) { this.avisar(e.message, true); }
  },

  /* El acceso de un empleado, para volver a dictárselo. */
  verAccesoEmpleado(id) {
    const e = (this.state.empleados || []).find((x) => x.id === id);
    if (!e) return;
    this.$('#em-msg').innerHTML = `
      <div class="tarjeta" style="margin-top:.7rem">
        <b>Acceso de ${this.esc(e.nombre)}</b>
        <div>Usuario: <b>${this.esc(e.usuario)}</b></div>
        <div>Contraseña: <b>${e.password ? this.esc(e.password) : '— no guardada —'}</b></div>
        ${e.password ? '' : '<p class="suave">Se puso antes de que el sistema guardara una copia. Ponle una nueva abajo y desde ahí ya se puede consultar.</p>'}
        <p class="suave">No lo dejes a la vista de nadie más.</p>
      </div>`;
  },

  /* Cambiarle las funciones o la contraseña a un empleado. */
  async editarEmpleado(id) {
    const e = (this.state.empleados || []).find((x) => x.id === id);
    if (!e) return;
    this.pintarFuncionesEmpleado(e.permisos);
    this.$('#em-nombre').value = e.nombre;
    this.$('#em-usuario').value = e.usuario;
    this.$('#em-usuario').disabled = true;
    this.$('#em-pass').value = '';
    this.$('#em-pass').placeholder = 'contraseña nueva (opcional)';
    this.$('#em-msg').innerHTML = `
      <div class="fila" style="margin-top:.7rem">
        <button class="btn chico" onclick="App.guardarEmpleado(${id})">Guardar cambios de ${this.esc(e.nombre)}</button>
        <button class="btn chico gris" onclick="App.vistaConfig()">Cancelar</button>
        <button class="btn chico gris" onclick="App.bajaEmpleado(${id})">Dar de baja</button>
      </div>`;
  },

  async guardarEmpleado(id) {
    try {
      const cuerpo = { nombre: this.$('#em-nombre').value, permisos: this.funcionesMarcadas() };
      if (this.$('#em-pass').value) cuerpo.password = this.$('#em-pass').value;
      await API.put('/empleados/' + id, cuerpo);
      this.avisar('Empleado actualizado');
      this.vistaConfig();
    } catch (e) { this.$('#em-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async bajaEmpleado(id) {
    if (!confirm('¿Dar de baja a esta persona? Dejará de poder entrar de inmediato.')) return;
    try {
      await API.put('/empleados/' + id, { activo: false });
      this.avisar('Empleado dado de baja');
      this.vistaConfig();
    } catch (e) { this.avisar(e.message, true); }
  },

  async guardarConfig() {
    const body = {
      ticket_direccion: this.$('#cf-dir').value,
      ticket_telefono: this.$('#cf-tel').value,
      whatsapp: this.$('#cf-wa').value,
      ticket_leyenda: this.$('#cf-leyenda').value,
      peso_promedio_g: parseInt(this.$('#cf-peso').value, 10) || 2500,
      costo_kilo: parseFloat(this.$('#cf-costo').value) || null
    };
    try {
      await API.put('/config', body);
      Object.assign(this.state.negocio, body);
      this.avisar('Configuración guardada');
    } catch (e) { this.$('#cf-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async guardarPrecios() {
    try {
      for (const p of this.state.piezas) {
        const pk = parseFloat(this.$('#pk-' + p.id).value);
        const pp = parseFloat(this.$('#pp-' + p.id).value);
        const rdEl = this.$('#rd-' + p.id);
        const plEl = this.$('#pl-' + p.id);
        const rd = rdEl ? (parseFloat(rdEl.value) || 0) / 100 : p.rendimiento;
        const pl = plEl ? (parseFloat(plEl.value) || 0) : p.por_pollo;
        if (pk !== p.precio_kilo || pp !== p.precio_pieza || rd !== p.rendimiento || pl !== p.por_pollo) {
          await API.put('/piezas/' + p.id, { precio_kilo: pk, precio_pieza: pp, rendimiento: rd, por_pollo: pl });
          p.precio_kilo = pk; p.precio_pieza = pp; p.rendimiento = rd; p.por_pollo = pl;
        }
      }
      this.avisar('Precios y despiece guardados');
    } catch (e) { this.avisar(e.message, true); }
  },

  async crearEmpleado() {
    try {
      const clave = this.$('#em-pass').value;
      await API.post('/empleados', {
        nombre: this.$('#em-nombre').value,
        usuario: this.$('#em-usuario').value,
        password: clave,
        permisos: this.funcionesMarcadas()
      });
      this.avisar('Empleado creado');
      const usuario = this.$('#em-usuario').value;
      await this.vistaConfig();
      // Se le enseña el acceso al dueño para que lo anote y se lo entregue.
      this.$('#em-msg').innerHTML = `
        <div class="tarjeta" style="margin-top:.7rem">
          <b>Anota su acceso y entrégaselo</b>
          <div>Usuario: <b>${this.esc(String(usuario).trim().toLowerCase())}</b></div>
          <div>Contraseña: <b>${this.esc(clave)}</b></div>
          <p class="suave">Él no la puede cambiar. Si se le olvida, aquí mismo la vuelves a ver.</p>
        </div>`;
    } catch (e) { this.$('#em-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  /* =========================================================
     MI CUENTA (dueño de la pollería): estado de la renta y pagos
     ========================================================= */
  async vistaCuenta() {
    this.$('#vista').innerHTML = `<h2>${this.ico('cuenta')} Mi cuenta</h2><div id="cu-cont">Cargando…</div>`;
    try {
      const c = await API.get('/suscripcion');
      this.state.suscripcion = { ...c };
      const badge = this.badgeEstado(c.estado);
      this.$('#cu-cont').innerHTML = `
        <div class="tarjeta">
          <div class="estado-grande">
            <span class="etiqueta" style="background:${badge.color}">${badge.texto}</span>
            ${c.dias !== null && c.dias !== undefined ? `<span class="suave">${c.dias >= 0
                ? `${c.dias} día(s) por delante` : `vencida hace ${-c.dias} día(s)`}</span>` : ''}
          </div>
          <p style="margin-top:.6rem">${this.esc(c.aviso || 'Tu servicio está al corriente. ¡Gracias!')}</p>
          <div class="stats" style="margin-top:.8rem">
            <div class="stat"><div class="v">${this.dinero(c.precio_mensual)}</div><div class="l">Renta mensual</div></div>
            <div class="stat"><div class="v">${c.fecha_corte ? String(c.fecha_corte).slice(0, 10) : '—'}</div><div class="l">Próximo corte</div></div>
          </div>
        </div>
        <div class="tarjeta">
          <h3>Ya pagué: subir mi comprobante</h3>
          <p class="suave">Toma la foto de tu transferencia o ficha de depósito. En cuanto la revisemos se activa tu mes.</p>
          <div class="fila">
            <div><label>¿Cuánto pagaste?</label>
              <input id="cu-monto" type="number" step="0.01" inputmode="decimal" value="${c.precio_mensual || ''}"></div>
            <div><label>¿Cómo pagaste?</label>
              <select id="cu-metodo">
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
                <option value="efectivo">Efectivo</option>
              </select></div>
          </div>
          <label>Referencia o folio (opcional)</label>
          <input id="cu-ref" placeholder="Últimos dígitos, folio, etc.">
          <label>Foto del comprobante</label>
          <input id="cu-foto" type="file" accept="image/*" capture="environment">
          <button class="btn" id="cu-enviar" onclick="App.enviarComprobante()">Enviar comprobante</button>
          <div id="cu-msg"></div>
        </div>
        <div class="tarjeta tabla-scroll">
          <h3>Mis pagos</h3>
          ${c.pagos.length ? `<table><tr><th>Fecha</th><th class="num">Monto</th><th>Estado</th></tr>
            ${c.pagos.map(p => `<tr>
              <td>${new Date(p.creado_en).toLocaleDateString('es-MX')}</td>
              <td class="num">${this.dinero(p.monto)}</td>
              <td>${this.esc(p.estado === 'PENDIENTE' ? 'En revisión' : p.estado.toLowerCase())}
                  ${p.motivo_rechazo ? `<br><span class="suave">${this.esc(p.motivo_rechazo)}</span>` : ''}</td>
            </tr>`).join('')}</table>`
            : '<p class="suave">Todavía no has subido ningún pago.</p>'}
        </div>`;
    } catch (e) {
      this.$('#cu-cont').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`;
    }
  },

  badgeEstado(estado) {
    return {
      PRUEBA:      { texto: 'MES DE PRUEBA', color: '#0b7285' },
      ACTIVA:      { texto: 'AL CORRIENTE',  color: 'var(--ok)' },
      CORTESIA:    { texto: 'CORTESÍA',      color: '#0b7285' },
      GRACIA:      { texto: 'PAGO PENDIENTE', color: '#b8860b' },
      RESTRINGIDA: { texto: 'RESTRINGIDA',   color: '#c2410c' },
      SUSPENDIDA:  { texto: 'SUSPENDIDA',    color: 'var(--error)' },
      CANCELADA:   { texto: 'CANCELADA',     color: 'var(--error)' }
    }[estado] || { texto: estado, color: 'var(--texto-suave)' };
  },

  /* La foto se encoge en el teléfono antes de subirla: una foto de cámara
     pesa 4 MB y con 1200 px se lee perfecto el comprobante. */
  async _comprimirFoto(file, maxLado = 1200, calidad = 0.72) {
    const dataURL = await new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataURL;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * escala);
    cv.height = Math.round(img.height * escala);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', calidad);
  },

  async enviarComprobante() {
    const btn = this.$('#cu-enviar');
    const file = this.$('#cu-foto').files[0];
    this.$('#cu-msg').innerHTML = '';
    btn.disabled = true;
    try {
      const body = {
        monto: parseFloat(this.$('#cu-monto').value),
        metodo: this.$('#cu-metodo').value,
        referencia: this.$('#cu-ref').value
      };
      if (file) body.imagen = await this._comprimirFoto(file);
      const r = await API.post('/suscripcion/comprobante', body);
      this.avisar(r.mensaje);
      this.vistaCuenta();
    } catch (e) {
      btn.disabled = false;
      this.$('#cu-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`;
    }
  },

  /* =========================================================
     ADMIN (superadmin): negocios, renta y usuarios
     ========================================================= */
  async vistaAdmin() {
    this.$('#vista').innerHTML = `
      <h2>${this.ico('admin')} Negocios</h2>
      <div class="tarjeta" id="ad-accesos">
        <h3 style="margin:0 0 .4rem">Entradas a este panel</h3>
        <div id="ad-accesos-lista" class="chico">Cargando…</div>
      </div>
      <div class="tarjeta" id="ad-lista">Cargando…</div>
      <div class="tarjeta">
        <h3>+ Dar de alta una pollería</h3>
        <div class="fila">
          <div><label>Código (corto, único)</label><input id="ad-codigo" placeholder="POLLERIA1" autocapitalize="characters"></div>
          <div><label>Nombre del negocio</label><input id="ad-nombre" placeholder="Pollería Doña Mary"></div>
        </div>
        <label>Nombre del dueño</label><input id="ad-dnombre">
        <div class="fila">
          <div><label>Usuario del dueño</label><input id="ad-dusuario" autocapitalize="none"></div>
          <div><label>Contraseña</label><input id="ad-dpass"></div>
        </div>
        <div class="fila">
          <div><label>Renta mensual</label><input id="ad-precio" type="number" step="1" value="150"></div>
          <div><label>Días de prueba gratis</label><input id="ad-prueba" type="number" step="1" value="30"></div>
        </div>
        <label>WhatsApp de contacto</label><input id="ad-wa" placeholder="521...">
        <button class="btn" onclick="App.crearNegocio()">Crear negocio (con catálogo base de pollería)</button>
        <div id="ad-msg"></div>
      </div>`;
    this.cargarNegocios();
    this.cargarAccesos();
  },

  /* Quién ha entrado a este panel. Es la forma de enterarse si alguien más
     tiene la contraseña: aquí saldría su entrada, con su dirección y su hora. */
  async cargarAccesos() {
    const caja = this.$('#ad-accesos-lista');
    if (!caja) return;
    try {
      const lista = await API.get('/admin/accesos');
      if (!lista.length) { caja.textContent = 'Todavía no hay entradas registradas.'; return; }
      const fallidos = lista.filter(a => !a.exito).length;
      const nuevas = lista.filter(a => a.exito && !a.conocida).length;
      const resumen = [];
      if (nuevas) resumen.push(`${nuevas} entrada(s) desde una dirección nueva`);
      if (fallidos) resumen.push(`${fallidos} intento(s) fallido(s)`);
      caja.innerHTML = `
        ${resumen.length ? `<p style="color:#a4562f;font-weight:700;margin:.2rem 0 .5rem">⚠ ${resumen.join(' · ')}</p>`
                         : '<p style="margin:.2rem 0 .5rem;color:#5b6b5f">Sin novedades: todas las entradas son de direcciones ya conocidas.</p>'}
        <table class="datos"><thead><tr><th>Cuándo</th><th>Usuario</th><th>Desde</th><th></th></tr></thead><tbody>
        ${lista.slice(0, 12).map(a => `<tr${a.exito ? '' : ' style="opacity:.7"'}>
            <td>${new Date(a.fecha).toLocaleString('es-MX')}</td>
            <td>${this.esc(a.usuario)}</td>
            <td>${this.esc(a.ip || '—')}</td>
            <td>${!a.exito ? '<b style="color:#b3453d">falló</b>'
                            : (a.conocida ? 'conocida' : '<b style="color:#a4562f">dirección nueva</b>')}</td>
          </tr>`).join('')}
        </tbody></table>
        <p class="chico" style="color:#5b6b5f;margin-top:.4rem">Si ves una entrada que no fuiste tú, cambia la contraseña del superadministrador ese mismo momento.</p>`;
    } catch (e) { caja.textContent = 'No se pudieron cargar las entradas.'; }
  },

  async cargarNegocios() {
    try {
      const lista = await API.get('/admin/negocios');
      this._negocios = lista;
      this.$('#ad-lista').innerHTML = lista.length ? lista.map(n => {
        const b = this.badgeEstado(n.situacion.estado);
        return `
        <div class="negocio-fila">
          <span class="punto" style="background:${n.activo ? b.color : 'var(--error)'}"></span>
          <div class="info">
            <div class="n">${this.esc(n.nombre)} <span class="suave">(${this.esc(n.codigo)})</span></div>
            <div class="suave">
              <span class="etiqueta chica" style="background:${b.color}">${b.texto}</span>
              ${n.precio_mensual > 0 ? this.dinero(n.precio_mensual) + '/mes · ' : 'sin cobro · '}
              ${n.fecha_corte ? 'corte ' + String(n.fecha_corte).slice(0, 10) : 'sin fecha de corte'}
            </div>
            <div class="suave">${n.usuarios} usuario(s) · ${n.ventas_hoy} venta(s) hoy ·
              ${this.dinero(n.vendido_mes)} este mes
              ${n.pagos_pendientes > 0 ? ` · <b style="color:#b8860b">${n.pagos_pendientes} comprobante(s) por revisar</b>` : ''}</div>
          </div>
          <button class="btn chico secundario" onclick="App.editarNegocio(${n.id})">Gestionar</button>
        </div>`; }).join('') : '<p class="suave">Sin negocios todavía.</p>';
    } catch (e) { this.$('#ad-lista').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  editarNegocio(id) {
    const n = this._negocios.find(x => x.id === id);
    if (!n) return;
    const FLAGS = [
      ['compras', 'Compras con despiece automático', 'Registrar la compra de pollos y repartirla en piezas'],
      ['inventario', 'Inventario', 'Kilos por pieza, entran con la compra y salen con la venta'],
      ['corte', 'Corte de caja', 'Cierre del día con efectivo contado y diferencia'],
      ['reportes', 'Reportes', 'Ventas, compras y ganancia por rango de fechas'],
      ['precios', 'El dueño edita sus precios', 'Si se apaga, los precios solo los cambiamos nosotros'],
      ['empleados', 'El dueño da de alta empleados', 'Crear usuarios de mostrador desde su app'],
      ['whatsapp', 'Ticket por WhatsApp', 'Botón para mandarle el ticket al cliente'],
    ];
    const b = this.badgeEstado(n.situacion.estado);
    this._iconosNuevos = null;
    this.modal(`
      <h3>${this.esc(n.nombre)}
        <span class="etiqueta chica" style="background:${b.color}">${b.texto}</span></h3>

      <h3>Renta mensual</h3>
      <div class="fila">
        <div><label>Precio al mes</label>
          <input id="ng-precio" type="number" step="1" value="${n.precio_mensual || 0}"></div>
        <div><label>Próximo corte</label>
          <input id="ng-corte" type="date" value="${n.fecha_corte ? String(n.fecha_corte).slice(0, 10) : ''}"></div>
      </div>
      <div class="fila">
        <div><label>Estado</label>
          <select id="ng-estado">
            ${['PRUEBA', 'ACTIVA', 'CANCELADA'].map(e =>
              `<option value="${e}" ${n.estado === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select></div>
        <div><label>Días de gracia</label>
          <input id="ng-gracia" type="number" step="1" value="${n.dias_gracia ?? 5}"></div>
      </div>
      <div class="fila">
        <div><label>Contacto</label><input id="ng-contacto" value="${this.esc(n.contacto_nombre || '')}"></div>
        <div><label>WhatsApp</label><input id="ng-wa" value="${this.esc(n.whatsapp_contacto || '')}"></div>
      </div>
      <label>Notas internas (no las ve el cliente)</label>
      <input id="ng-notas" value="${this.esc(n.notas_internas || '')}">

      <h3>Registrar un cobro (efectivo)</h3>
      <div class="fila">
        <div><label>Monto</label><input id="cb-monto" type="number" step="0.01" value="${n.precio_mensual || 0}"></div>
        <div><label>Meses</label><input id="cb-meses" type="number" step="1" value="1"></div>
      </div>
      <button class="btn chico" style="margin-top:.6rem" onclick="App.cobrarManual(${n.id})">Cobrar y sumar el mes</button>

      <h3>Diseño de su app</h3>
      <label>Nombre del negocio (es el que se ve en la app y en el ticket)</label>
      <input id="ng-nombre" value="${this.esc(n.nombre)}">
      <label>Paleta</label>
      <div class="temas" id="ng-temas">
        ${TEMAS.map(t => `
          <button type="button" class="tema ${(n.tema || 'pizarra') === t.id ? 'activo' : ''}"
                  data-tema="${t.id}" onclick="App.elegirTema('${t.id}')">
            <span class="muestra" style="background:${t.primario}"></span>
            <span class="muestra" style="background:${t.acento}"></span>
            <span class="muestra" style="background:${t.fondo};border:1px solid #ddd"></span>
            <b>${t.nombre}</b>
          </button>`).join('')}
      </div>
      <div class="fila">
        <div><label>Color principal</label><input id="ng-color1" type="color" value="${n.color_primario || '#263949'}"></div>
        <div><label>Color secundario</label><input id="ng-color2" type="color" value="${n.color_secundario || '#16222e'}"></div>
      </div>
      <div class="fila">
        <div><label>Acento</label><input id="ng-color3" type="color" value="${n.color_acento || '#b8934a'}"></div>
        <div><label>Fondo</label><input id="ng-color4" type="color" value="${n.color_fondo || '#f4f3f0'}"></div>
      </div>

      <h3>Logo del cliente</h3>
      <p class="suave">Se ve en su barra, en su pantalla de entrada y —lo importante— se convierte
        en el icono con el que instalan la app en el teléfono y en la lap.</p>
      <div class="logo-fila">
        <img id="ng-logo-vista" class="logo-vista"
             src="${n.tiene_iconos ? `/api/publico/icono/${encodeURIComponent(n.codigo)}/192.png?v=${Date.now()}` : 'icons/icon-192.png?v=2'}" alt="">
        <div>
          <input id="ng-logo" type="file" accept="image/*" onchange="App.prepararLogo()">
          <p class="suave" id="ng-logo-msg">Cuadrado se ve mejor. Se recorta y se achica solo.</p>
          ${n.tiene_logo || n.tiene_iconos
            ? `<button class="btn chico secundario" onclick="App.quitarLogo(${n.id})">Quitar logo y volver al genérico</button>` : ''}
        </div>
      </div>

      <div class="switch-linea"><span><b>Negocio activo</b> (apagar = cerrarle el acceso a mano)</span>
        <input type="checkbox" id="ng-activo" ${n.activo ? 'checked' : ''}></div>

      <h3>Funciones que tiene contratadas</h3>
      <p class="suave">Lo que apagues aquí desaparece de su menú y además queda bloqueado en el
        servidor, no solo escondido.</p>
      ${FLAGS.map(([k, txt, ayuda]) => `
        <div class="switch-linea">
          <span>${txt}<br><span class="suave">${ayuda}</span></span>
          <input type="checkbox" id="fl-${k}" ${n.flags[k] !== false ? 'checked' : ''}></div>`).join('')}
      <button class="btn" onclick="App.guardarNegocio(${n.id})">Guardar cambios</button>

      <h3>${this.ico('usuarios')} Usuarios de este negocio</h3>
      <div id="ng-usuarios" class="lista-simple">Cargando…</div>
      <h3>+ Agregar usuario</h3>
      <div class="fila">
        <input id="nu-nombre" placeholder="Nombre">
        <input id="nu-usuario" placeholder="usuario" autocapitalize="none">
      </div>
      <div class="fila" style="margin-top:.6rem">
        <input id="nu-pass" placeholder="contraseña">
        <select id="nu-rol"><option value="empleado">Empleado</option><option value="dueno">Dueño</option></select>
      </div>
      <button class="btn chico secundario" style="margin-top:.6rem" onclick="App.crearUsuarioNegocio(${n.id})">+ Agregar usuario</button>

      <h3 style="color:var(--error)">Dar de baja este cliente</h3>
      <p class="suave">Deja de aparecer en el panel y nadie de esa pollería puede volver
        a entrar. Si ya tiene ventas o pagos, el historial se conserva para que la
        contabilidad siga cuadrando.</p>
      <button class="btn secundario" style="border-color:var(--error);color:var(--error)"
              onclick="App.confirmarEliminarNegocio(${n.id})">Eliminar ${this.esc(n.nombre)}</button>
      <div id="ng-msg"></div>`);
    this.cargarUsuariosNegocio(id);
  },

  /* Borrar un cliente por error sería feo de explicar: se pide escribir el
     nombre completo, no un "¿estás seguro?" que se acepta sin leer. */
  confirmarEliminarNegocio(id) {
    const n = this._negocios.find(x => x.id === id);
    if (!n) return;
    this.modal(`
      <h3 style="color:var(--error)">Eliminar ${this.esc(n.nombre)}</h3>
      <p>Se va del panel y se le cierra el acceso a todos sus usuarios.
        ${n.ventas_hoy > 0 || n.vendido_mes > 0
          ? 'Como ya tiene movimientos, sus ventas y pagos <b>se conservan</b> en la contabilidad.'
          : 'Como todavía no tiene ventas ni pagos, se borra por completo.'}</p>
      <p class="suave">Esto no se puede deshacer desde el panel.</p>
      <label>Escribe <b>${this.esc(n.nombre)}</b> para confirmar</label>
      <input id="del-nombre" autocapitalize="none" placeholder="${this.esc(n.nombre)}">
      <button class="btn" style="background:var(--error)" onclick="App.eliminarNegocio(${id})">
        Sí, eliminar</button>
      <button class="btn secundario" onclick="App.editarNegocio(${id})">Cancelar</button>
      <div id="del-msg"></div>`);
  },

  async eliminarNegocio(id) {
    try {
      const r = await API.req('DELETE', '/admin/negocios/' + id,
        { confirmacion: this.$('#del-nombre').value });
      this.cerrarModal();
      this.avisar(r.borrado === 'completo'
        ? `${r.nombre} se eliminó por completo`
        : `${r.nombre} se dio de baja; se conservaron ${r.ventas} venta(s) y ${r.pagos} pago(s)`);
      this.cargarNegocios();
    } catch (e) { this.$('#del-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  /** Aplica una paleta a los cuatro selectores de color del panel. */
  elegirTema(idTema) {
    const t = temaPorId(idTema);
    this._temaElegido = t.id;
    this.$('#ng-color1').value = t.primario;
    this.$('#ng-color2').value = t.secundario;
    this.$('#ng-color3').value = t.acento;
    this.$('#ng-color4').value = t.fondo;
    document.querySelectorAll('#ng-temas .tema').forEach(b =>
      b.classList.toggle('activo', b.dataset.tema === t.id));
  },

  /**
   * Del logo que sube el superadmin salen tres cosas: la imagen chica para la
   * barra y los dos iconos (192 y 512) que usa el sistema operativo al
   * instalar la app. Se recortan aquí, en el navegador, porque el servidor no
   * tiene con qué procesar imágenes.
   */
  async prepararLogo() {
    const file = this.$('#ng-logo').files[0];
    const msg = this.$('#ng-logo-msg');
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      this._iconosNuevos = null;
      return (msg.innerHTML = '<span style="color:var(--error)">Esa imagen pesa más de 4 MB, usa una más chica.</span>');
    }
    msg.textContent = 'Preparando el logo…';
    try {
      const img = await new Promise((ok, mal) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => mal(new Error('No se pudo leer la imagen'));
        i.src = URL.createObjectURL(file);
      });
      const fondo = this.$('#ng-color4').value || '#ffffff';
      const cuadrar = (lado, conFondo) => {
        const c = document.createElement('canvas');
        c.width = c.height = lado;
        const x = c.getContext('2d');
        if (conFondo) { x.fillStyle = fondo; x.fillRect(0, 0, lado, lado); }
        // Se ajusta dentro del cuadro sin deformar (nada de logos estirados)
        const escala = Math.min(lado / img.width, lado / img.height) * (conFondo ? 0.86 : 1);
        const an = img.width * escala, al = img.height * escala;
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, (lado - an) / 2, (lado - al) / 2, an, al);
        return c.toDataURL('image/png');
      };
      this._iconosNuevos = {
        logo: cuadrar(256, false),
        icono_192: cuadrar(192, true),
        icono_512: cuadrar(512, true),
      };
      this.$('#ng-logo-vista').src = this._iconosNuevos.icono_192;
      msg.textContent = 'Listo. Se guarda al presionar "Guardar cambios".';
    } catch (e) {
      this._iconosNuevos = null;
      msg.innerHTML = `<span style="color:var(--error)">${this.esc(e.message)}</span>`;
    }
  },

  async quitarLogo(id) {
    try {
      await API.put('/admin/negocios/' + id, { quitar_logo: true });
      this.avisar('Logo quitado: vuelve al icono genérico');
      this.cerrarModal();
      this.cargarNegocios();
    } catch (e) { this.avisar(e.message, true); }
  },

  async cargarUsuariosNegocio(id) {
    try {
      const us = await API.get(`/admin/negocios/${id}/usuarios`);
      const el = this.$('#ng-usuarios');
      if (!el) return;
      this._usuariosNegocio = us;
      // El usuario se muestra grande y aparte: es el dato que se dicta por
      // teléfono cuando el cliente no puede entrar. La contraseña no se puede
      // enseñar (se guarda cifrada, ni nosotros la vemos): se le pone una nueva.
      el.innerHTML = us.length ? us.map(u =>
        `<div>
           <span><b>${this.esc(u.usuario)}</b>
             <span class="suave">— ${this.esc(u.nombre)} · ${u.rol === 'dueno' ? 'dueño' : 'empleado'}</span>
             ${u.activo ? '' : '<span class="etiqueta chica" style="background:var(--error)">sin acceso</span>'}</span>
           <button class="btn chico secundario" onclick="App.editarUsuario(${id},${u.id})">Usuario y contraseña</button>
         </div>`).join('')
        : '<p class="suave">Sin usuarios.</p>';
    } catch (e) { /* el modal pudo cerrarse */ }
  },

  /** Cambiar nombre, usuario, papel, contraseña o el acceso de una persona. */
  editarUsuario(negocioId, uid) {
    const u = (this._usuariosNegocio || []).find(x => x.id === uid);
    if (!u) return;
    this.modal(`
      <h3>${this.ico('usuarios')} ${this.esc(u.nombre)}</h3>
      <label>Nombre</label>
      <input id="eu-nombre" value="${this.esc(u.nombre)}">
      <div class="fila">
        <div><label>Usuario para entrar</label>
          <input id="eu-usuario" value="${this.esc(u.usuario)}" autocapitalize="none"></div>
        <div><label>Papel</label>
          <select id="eu-rol">
            <option value="empleado" ${u.rol === 'empleado' ? 'selected' : ''}>Empleado (solo vende)</option>
            <option value="dueno" ${u.rol === 'dueno' ? 'selected' : ''}>Dueño (todo)</option>
          </select></div>
      </div>
      <h3>Contraseña</h3>
      <p class="suave">La contraseña guardada no se puede ver: se guarda cifrada y ni
        nosotros la conocemos. Si el cliente no puede entrar, aquí se le pone una nueva
        y se la dictas.</p>
      <div class="fila">
        <input id="eu-pass" placeholder="déjala vacía para no cambiarla">
        <button class="btn chico secundario" onclick="App.generarPass()">Generar una</button>
      </div>
      <div class="switch-linea"><span><b>Puede entrar</b></span>
        <input type="checkbox" id="eu-activo" ${u.activo ? 'checked' : ''}></div>
      <button class="btn" onclick="App.guardarUsuario(${negocioId},${uid})">Guardar</button>
      <button class="btn secundario" onclick="App.editarNegocio(${negocioId})">Volver</button>
      <div id="eu-msg"></div>`);
  },

  /* Una contraseña que se pueda dictar por teléfono sin equivocarse: sin
     eñes, sin acentos y sin letras que se confunden (l/1, O/0). */
  generarPass() {
    const letras = 'abcdefghjkmnpqrstuvwxyz';
    const numeros = '23456789';
    let p = '';
    for (let i = 0; i < 5; i++) p += letras[Math.floor(Math.random() * letras.length)];
    for (let i = 0; i < 3; i++) p += numeros[Math.floor(Math.random() * numeros.length)];
    this.$('#eu-pass').value = p;
    this.$('#eu-pass').type = 'text';
  },

  async guardarUsuario(negocioId, uid) {
    const body = {
      nombre: this.$('#eu-nombre').value,
      usuario: this.$('#eu-usuario').value,
      rol: this.$('#eu-rol').value,
      activo: this.$('#eu-activo').checked,
    };
    const pass = this.$('#eu-pass').value;
    if (pass) body.password = pass;
    try {
      await API.put(`/admin/negocios/${negocioId}/usuarios/${uid}`, body);
      if (pass) {
        // Se enseña una sola vez y en grande: es el único momento en que esta
        // contraseña existe en algún lado donde se pueda leer.
        this.modal(`
          <h3>${this.ico('check')} Listo, ya puede entrar</h3>
          <p>Dile esto al cliente:</p>
          <div class="tarjeta centrado" style="background:var(--fondo)">
            <div class="suave">usuario</div>
            <div style="font-size:1.4rem;font-weight:800">${this.esc(body.usuario)}</div>
            <div class="suave" style="margin-top:.6rem">contraseña</div>
            <div style="font-size:1.4rem;font-weight:800;letter-spacing:.06em">${this.esc(pass)}</div>
          </div>
          <p class="suave">Anótala ahora: al cerrar esta ventana ya no se puede volver a ver,
            solo generar otra.</p>
          <button class="btn" onclick="App.editarNegocio(${negocioId})">Entendido</button>`);
        return;
      }
      this.avisar('Usuario actualizado');
      this.editarNegocio(negocioId);
    } catch (e) { this.$('#eu-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async crearUsuarioNegocio(id) {
    try {
      await API.post(`/admin/negocios/${id}/usuarios`, {
        nombre: this.$('#nu-nombre').value,
        usuario: this.$('#nu-usuario').value,
        password: this.$('#nu-pass').value,
        rol: this.$('#nu-rol').value
      });
      this.avisar('Usuario creado');
      this.$('#nu-nombre').value = ''; this.$('#nu-usuario').value = ''; this.$('#nu-pass').value = '';
      this.cargarUsuariosNegocio(id);
    } catch (e) { this.$('#ng-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async cobrarManual(id) {
    try {
      const r = await API.post('/admin/pagos/manual', {
        negocio_id: id,
        monto: parseFloat(this.$('#cb-monto').value),
        meses: parseInt(this.$('#cb-meses').value, 10) || 1,
        metodo: 'efectivo'
      });
      this.avisar(`Cobrado. ${r.negocio} corta ahora el ${r.nueva_fecha_corte}`);
      this.cerrarModal();
      this.cargarNegocios();
    } catch (e) { this.$('#ng-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async guardarNegocio(id) {
    const flags = {};
    for (const k of ['compras', 'inventario', 'corte', 'reportes', 'precios', 'empleados', 'whatsapp']) {
      const el = this.$('#fl-' + k);
      if (el) flags[k] = el.checked;
    }
    const body = {
      activo: this.$('#ng-activo').checked,
      flags,
      nombre: this.$('#ng-nombre').value || null,
      tema: this._temaElegido || null,
      color_primario: this.$('#ng-color1').value,
      color_secundario: this.$('#ng-color2').value,
      color_acento: this.$('#ng-color3').value,
      color_fondo: this.$('#ng-color4').value,
      precio_mensual: parseFloat(this.$('#ng-precio').value) || 0,
      estado: this.$('#ng-estado').value,
      fecha_corte: this.$('#ng-corte').value || null,
      dias_gracia: parseInt(this.$('#ng-gracia').value, 10) || 0,
      contacto_nombre: this.$('#ng-contacto').value,
      whatsapp_contacto: this.$('#ng-wa').value,
      notas_internas: this.$('#ng-notas').value
    };
    if (this._iconosNuevos) Object.assign(body, this._iconosNuevos);
    try {
      await API.put('/admin/negocios/' + id, body);
      this._iconosNuevos = null;
      this._temaElegido = null;
      this.avisar('Negocio actualizado');
      this.cerrarModal();
      this.cargarNegocios();
    } catch (e) { this.$('#ng-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async crearNegocio() {
    try {
      await API.post('/admin/negocios', {
        codigo: this.$('#ad-codigo').value,
        nombre: this.$('#ad-nombre').value,
        dueno_nombre: this.$('#ad-dnombre').value,
        dueno_usuario: this.$('#ad-dusuario').value,
        dueno_password: this.$('#ad-dpass').value,
        precio_mensual: parseFloat(this.$('#ad-precio').value) || 0,
        dias_prueba: parseInt(this.$('#ad-prueba').value, 10) || 0,
        whatsapp_contacto: this.$('#ad-wa').value
      });
      this.avisar('Negocio creado con su catálogo base y su mes de prueba');
      this.vistaAdmin();
    } catch (e) { this.$('#ad-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  /* =========================================================
     PAGOS (superadmin): bandeja de comprobantes
     ========================================================= */
  async vistaPagos() {
    this.$('#vista').innerHTML = `
      <h2>${this.ico('pagos')} Pagos de renta</h2>
      <div class="tarjeta">
        <div class="selector-modo">
          <button id="pg-f-PENDIENTE" class="activo" onclick="App.cargarPagos('PENDIENTE')">Por revisar</button>
          <button id="pg-f-APROBADO" onclick="App.cargarPagos('APROBADO')">Aprobados</button>
          <button id="pg-f-" onclick="App.cargarPagos('')">Todos</button>
        </div>
      </div>
      <div id="pg-lista">Cargando…</div>`;
    this.cargarPagos('PENDIENTE');
  },

  async cargarPagos(filtro) {
    for (const f of ['PENDIENTE', 'APROBADO', '']) {
      const b = this.$('#pg-f-' + f);
      if (b) b.classList.toggle('activo', f === filtro);
    }
    try {
      const lista = await API.get('/admin/pagos' + (filtro ? '?estado=' + filtro : ''));
      this.$('#pg-lista').innerHTML = lista.length ? lista.map(p => `
        <div class="tarjeta">
          <div class="negocio-fila" style="border:0;padding:0">
            <div class="info">
              <div class="n">${this.esc(p.negocio)} — ${this.dinero(p.monto)}</div>
              <div class="suave">${new Date(p.creado_en).toLocaleString('es-MX')} ·
                ${this.esc(p.metodo)}${p.referencia ? ' · ref ' + this.esc(p.referencia) : ''}</div>
              <div class="suave">${p.estado === 'PENDIENTE' ? 'Por revisar'
                : p.estado === 'APROBADO' ? 'Aprobado · cubre hasta ' + String(p.periodo_fin || '').slice(0, 10)
                : 'Rechazado: ' + this.esc(p.motivo_rechazo || '')}</div>
            </div>
          </div>
          ${p.tiene_comprobante
            ? `<img class="comprobante" id="cmp-${p.id}" onclick="window.open(this.src)" alt="comprobante">`
            : '<p class="suave">Sin foto de comprobante (cobro registrado por nosotros).</p>'}
          ${p.estado === 'PENDIENTE' ? `
            <div class="fila" style="margin-top:.6rem">
              <div><label>Meses que cubre</label><input id="pg-meses-${p.id}" type="number" step="1" value="1"></div>
            </div>
            <button class="btn" onclick="App.aprobarPago(${p.id})">${this.ico('check')} Aprobar y sumar el mes</button>
            <button class="btn secundario" onclick="App.rechazarPago(${p.id})">Rechazar</button>` : ''}
        </div>`).join('') : '<div class="tarjeta"><p class="suave">No hay pagos aquí.</p></div>';

      for (const p of lista.filter(x => x.tiene_comprobante)) {
        API.blobURL(`/admin/pagos/${p.id}/comprobante`)
          .then(url => { const img = this.$('#cmp-' + p.id); if (img) img.src = url; })
          .catch(() => {});
      }
    } catch (e) { this.$('#pg-lista').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async aprobarPago(id) {
    try {
      const meses = parseInt(this.$('#pg-meses-' + id).value, 10) || 1;
      const r = await API.post(`/admin/pagos/${id}/aprobar`, { meses });
      this.avisar(`${r.negocio}: pagado hasta el ${r.nueva_fecha_corte}`);
      this.cargarPagos('PENDIENTE');
    } catch (e) { this.avisar(e.message, true); }
  },

  async rechazarPago(id) {
    const motivo = prompt('¿Por qué se rechaza? (lo va a leer el cliente)');
    if (!motivo) return;
    try {
      await API.post(`/admin/pagos/${id}/rechazar`, { motivo });
      this.avisar('Pago rechazado');
      this.cargarPagos('PENDIENTE');
    } catch (e) { this.avisar(e.message, true); }
  },

  /* =========================================================
     DINERO (superadmin): contabilidad del sistema
     ========================================================= */
  async vistaDinero() {
    this.$('#vista').innerHTML = `<h2>${this.ico('dinero')} Dinero</h2><div id="dn-cont">Cargando…</div>`;
    try {
      const c = await API.get('/admin/contabilidad');
      this.$('#dn-cont').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="v">${this.dinero(c.mrr)}</div><div class="l">Renta al mes (${c.negocios_cobrando})</div></div>
          <div class="stat"><div class="v">${this.dinero(c.ingresos_mes)}</div><div class="l">Cobrado este mes</div></div>
          <div class="stat"><div class="v" style="color:${c.utilidad_mes < 0 ? 'var(--error)' : 'var(--ok)'}">${this.dinero(c.utilidad_mes)}</div><div class="l">Utilidad del mes</div></div>
        </div>
        ${c.morosos.length ? `<div class="tarjeta">
          <h3>Deben</h3>
          ${c.morosos.map(m => `<div class="negocio-fila" style="border:0;padding:.3rem 0">
            <span class="punto" style="background:${this.badgeEstado(m.estado).color}"></span>
            <div class="info"><div class="n">${this.esc(m.nombre)}</div>
              <div class="suave">${this.dinero(m.precio_mensual)} · venció hace ${-m.dias} día(s)</div></div>
          </div>`).join('')}</div>` : ''}
        <div class="tarjeta">
          <h3>Registrar un gasto</h3>
          <div class="fila">
            <div><label>Concepto</label><input id="dn-concepto" placeholder="Railway, dominio…"></div>
            <div><label>Monto</label><input id="dn-monto" type="number" step="0.01"></div>
          </div>
          <button class="btn chico" style="margin-top:.6rem" onclick="App.registrarGasto()">Guardar gasto</button>
          <div id="dn-msg"></div>
        </div>
        <div class="tarjeta tabla-scroll">
          <h3>Movimientos</h3>
          ${c.movimientos.length ? `<table><tr><th>Fecha</th><th>Concepto</th><th class="num">Monto</th></tr>
            ${c.movimientos.map(m => `<tr>
              <td>${String(m.fecha).slice(0, 10)}</td>
              <td>${this.esc(m.concepto)}</td>
              <td class="num" style="color:${m.tipo === 'GASTO' ? 'var(--error)' : 'var(--ok)'}">
                ${m.tipo === 'GASTO' ? '-' : '+'}${this.dinero(m.monto)}</td></tr>`).join('')}</table>`
            : '<p class="suave">Sin movimientos todavía.</p>'}
        </div>
        <div class="tarjeta tabla-scroll">
          <h3>Por mes</h3>
          ${c.por_mes.length ? `<table><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos</th></tr>
            ${c.por_mes.map(m => `<tr><td>${m.mes}</td><td class="num">${this.dinero(m.ingresos)}</td>
              <td class="num">${this.dinero(m.gastos)}</td></tr>`).join('')}</table>`
            : '<p class="suave">—</p>'}
        </div>`;
    } catch (e) { this.$('#dn-cont').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async registrarGasto() {
    try {
      await API.post('/admin/gastos', {
        concepto: this.$('#dn-concepto').value,
        monto: parseFloat(this.$('#dn-monto').value)
      });
      this.avisar('Gasto registrado');
      this.vistaDinero();
    } catch (e) { this.$('#dn-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  }
};

window.App = App;

/* Almacenamiento permanente: le pide al navegador que NO borre lo guardado
   de esta app cuando ande corto de espacio. Aquí adentro viven las ventas
   hechas sin internet que todavía no suben, y esas no se pueden perder. */
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then((ya) => (ya ? true : navigator.storage.persist()))
    .catch(() => false);
}

/* El navegador avisa cuando la app ya cumple para instalarse: se guarda el
   aviso para poder ofrecer el botón desde "Más". */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  App._instalador = e;
  if (App.state && App.state.vista === 'mas') App.vistaMas();
});
window.addEventListener('appinstalled', () => { App._instalador = null; });

/* Versión nueva instalada. Si la caja está desocupada se recarga sola; si hay
   una venta a medias, jamás: primero se cobra. */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (!e.data || e.data.tipo !== 'actualizado') return;
    const ocupado = (App.state.carrito || []).length > 0 || !!document.getElementById('modal');
    if (ocupado) return App.avisar('Hay una versión nueva: se aplicará al cerrar y volver a abrir.');
    App.avisar('Actualizando la app…');
    setTimeout(() => location.reload(), 1200);
  });
}

/* Último parachoques: un error que nadie atrapó no debe dejar la pantalla
   en blanco con la caja abierta. */
window.addEventListener('error', (e) => console.error('[app]', e.message));
window.addEventListener('unhandledrejection', (e) => {
  console.error('[app] promesa sin atrapar', e.reason);
  if (window.App && App.state && App.state.user && API.esDeRed(e.reason)) {
    App.avisar('Sin conexión con el servidor. Puedes seguir vendiendo.', true);
    e.preventDefault();
  }
});

App.iniciar();
