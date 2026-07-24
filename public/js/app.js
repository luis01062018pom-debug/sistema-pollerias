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
  offline: '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
};

const App = {
  state: { user: null, negocio: null, piezas: [], vista: 'vender', carrito: [], filtroPos: '' },

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
    if (!API.token) return this.vistaLogin();
    try {
      const boot = await API.get('/bootstrap');
      this.state.user = boot.user;
      this.state.negocio = boot.negocio;
      this.state.piezas = boot.piezas || [];
      this.aplicarMarca();
      this.state.vista = boot.user.rol === 'superadmin' ? 'admin' : 'vender';
      this.pintar();
      API.sincronizar();
    } catch (e) {
      if (/suspendido/i.test(e.message)) {
        document.getElementById('app').innerHTML =
          `<div class="login-wrap"><div class="login-caja tarjeta centrado">
             <h2>Negocio suspendido</h2><p class="suave">${this.esc(e.message)}</p>
             <button class="btn" onclick="App.salir()">Salir</button></div></div>`;
      } else {
        this.vistaLogin(e.message);
      }
    }
  },

  aplicarMarca() {
    const n = this.state.negocio;
    if (!n) return;
    document.documentElement.style.setProperty('--primario', n.color_primario || '#263949');
    document.documentElement.style.setProperty('--secundario', n.color_secundario || '#16222e');
    document.title = n.nombre;
  },

  salir() {
    API.setToken(null);
    location.reload();
  },

  /* ===== Login ===== */
  vistaLogin(error) {
    document.getElementById('app').innerHTML = `
      <div class="login-wrap"><div class="login-caja">
        <div class="marca"><div class="sello">${this.ico('pluma')}</div><h1>Punto de Venta<br>Pollería</h1></div>
        <div class="tarjeta">
          <label>Usuario</label>
          <input id="lg-usuario" autocomplete="username" autocapitalize="none">
          <label>Contraseña</label>
          <input id="lg-pass" type="password" autocomplete="current-password">
          <button class="btn" onclick="App.login()">Entrar</button>
          ${error ? `<div class="msg-error">${this.esc(error)}</div>` : ''}
          <div id="lg-msg"></div>
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
      await this.iniciar();
    } catch (e) {
      this.$('#lg-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`;
    }
  },

  /* ===== Cascarón (topbar + nav) ===== */
  pintar() {
    const n = this.state.negocio;
    const esAdmin = this.state.user.rol === 'superadmin';
    const tabs = esAdmin
      ? [['admin', 'Negocios']]
      : [
          ['vender', 'Vender'],
          ['compras', 'Compras'],
          ...(this.flag('inventario') ? [['inventario', 'Inventario']] : []),
          ['corte', 'Corte'],
          ['mas', 'Más']
        ];
    document.getElementById('app').innerHTML = `
      <div class="topbar">
        ${n && n.logo ? `<img class="logo" src="${n.logo}">` : this.ico('pluma', 'g')}
        <div class="nombre">${this.esc(esAdmin ? 'Panel de administración' : (n ? n.nombre : ''))}</div>
        <span id="estado-red"></span>
        <div class="usuario">${this.esc(this.state.user.nombre)}<br>
          <a href="#" style="color:#fff;opacity:.85" onclick="App.salir();return false">salir</a></div>
      </div>
      <div class="contenido" id="vista"></div>
      <div class="navbar">
        ${tabs.map(([id, txt]) =>
          `<button class="${this.state.vista === id ? 'activo' : ''}" onclick="App.ir('${id}')">
             ${this.ico(id)}${txt}</button>`).join('')}
      </div>`;
    this.pintarEstadoRed();
    this.pintarVista();
  },

  pintarEstadoRed() {
    const el = document.getElementById('estado-red');
    if (!el) return;
    const pend = API.colaPendiente();
    el.innerHTML = !navigator.onLine
      ? '<span class="badge-offline">SIN INTERNET</span>'
      : (pend > 0 ? `<span class="badge-offline">${pend} por sincronizar</span>` : '');
  },

  ir(vista) {
    this.state.vista = vista;
    this.pintar();
  },

  pintarVista() {
    const v = this.state.vista;
    const fn = {
      vender: this.vistaVender, compras: this.vistaCompras, inventario: this.vistaInventario,
      corte: this.vistaCorte, mas: this.vistaMas, reportes: this.vistaReportes,
      config: this.vistaConfig, admin: this.vistaAdmin
    }[v];
    if (fn) fn.call(this);
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
      const lista = await API.get('/compras');
      this.$('#cp-lista').innerHTML = lista.length ? `
        <table><tr><th>Fecha</th><th class="num">Pollos</th><th class="num">Kilos</th><th class="num">$/kg</th><th class="num">Costo</th></tr>
        ${lista.map(c => `<tr>
          <td>${String(c.fecha).slice(0, 10)}</td>
          <td class="num">${c.pollos}</td>
          <td class="num">${this.num(c.kg_total)}</td>
          <td class="num">${this.dinero(c.costo_kilo)}</td>
          <td class="num">${this.dinero(c.costo_total)}</td></tr>`).join('')}</table>`
        : '<p class="suave">Aún no hay compras registradas.</p>';
    } catch (e) { this.$('#cp-lista').innerHTML = `<p class="suave">Sin conexión — las compras se registran solo con internet.</p>`; }
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
      const inv = await API.get('/inventario');
      const n = this.state.negocio;
      this.$('#inv').innerHTML = `
        <table><tr><th>Pieza</th><th class="num">Kilos</th><th class="num">≈ Piezas</th></tr>
        ${inv.map(p => {
          const pesoPieza = p.por_pollo > 0 ? (p.rendimiento * n.peso_promedio_g / 1000) / p.por_pollo : 0;
          const aproxPzas = pesoPieza > 0 ? p.kg / pesoPieza : 0;
          return `<tr class="${p.kg < 0 ? 'alerta' : ''}">
            <td>${this.esc(p.nombre)}</td>
            <td class="num">${this.num(p.kg, 2)}</td>
            <td class="num">${pesoPieza > 0 ? this.num(aproxPzas, 0) : '—'}</td></tr>`;
        }).join('')}</table>`;
    } catch (e) { this.$('#inv').innerHTML = '<p class="suave">Necesitas internet para ver el inventario.</p>'; }
  },

  /* =========================================================
     CORTE DE CAJA
     ========================================================= */
  async vistaCorte() {
    this.$('#vista').innerHTML = `<h2>${this.ico('corte')} Corte de caja</h2><div id="corte-cont">Cargando…</div>`;
    try {
      const r = await API.get('/corte/hoy');
      this.$('#corte-cont').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="v">${r.num_ventas}</div><div class="l">Ventas hoy</div></div>
          <div class="stat"><div class="v">${this.dinero(r.total_ventas)}</div><div class="l">Total vendido</div></div>
          <div class="stat"><div class="v">${this.dinero(r.compras.costo)}</div><div class="l">Compras hoy (${r.compras.pollos} pollos)</div></div>
        </div>
        <div class="tarjeta tabla-scroll">
          <h3>Vendido por producto</h3>
          ${r.por_pieza.length ? `<table><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Importe</th></tr>
            ${r.por_pieza.map(p => `<tr><td>${this.esc(p.nombre)}</td>
              <td class="num">${this.num(p.cantidad, 2)} ${p.modo === 'kg' ? 'kg' : 'pzas'}</td>
              <td class="num">${this.dinero(p.importe)}</td></tr>`).join('')}</table>`
            : '<p class="suave">Sin ventas todavía.</p>'}
        </div>
        <div class="tarjeta">
          <h3>${r.cerrado ? 'Corte cerrado ' + this.ico('check') : 'Cerrar el día'}</h3>
          ${r.cerrado ? `
            <p>Efectivo contado: <b>${this.dinero(r.corte.efectivo_contado)}</b><br>
               Diferencia: <b style="color:${r.corte.diferencia < 0 ? 'var(--error)' : 'var(--ok)'}">${this.dinero(r.corte.diferencia)}</b></p>
            <p class="suave">Puedes volver a cerrarlo si registraste más ventas después.</p>` : ''}
          <label>Efectivo contado en caja</label>
          <input id="ct-efectivo" type="number" step="0.01" inputmode="decimal">
          <button class="btn" onclick="App.cerrarCorte()">Cerrar corte de hoy</button>
          <div id="ct-msg"></div>
        </div>`;
    } catch (e) { this.$('#corte-cont').innerHTML = '<p class="suave">Necesitas internet para el corte.</p>'; }
  },

  async cerrarCorte() {
    try {
      const r = await API.post('/corte', { efectivo_contado: parseFloat(this.$('#ct-efectivo').value) || 0 });
      this.avisar('Corte cerrado. Diferencia: ' + this.dinero(r.diferencia), false);
      this.vistaCorte();
    } catch (e) { this.$('#ct-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  /* =========================================================
     MÁS (menú)
     ========================================================= */
  vistaMas() {
    const esDueno = this.state.user.rol === 'dueno';
    this.$('#vista').innerHTML = `
      <h2>Más opciones</h2>
      <div class="tarjeta lista-simple">
        ${this.flag('reportes') ? `<div onclick="App.ir('reportes')" style="cursor:pointer"><span>${this.ico('reportes')} Reportes</span><span>›</span></div>` : ''}
        ${esDueno ? `<div onclick="App.ir('config')" style="cursor:pointer"><span>${this.ico('config')} Configuración del negocio</span><span>›</span></div>` : ''}
        <div onclick="App.salir()" style="cursor:pointer"><span>${this.ico('salir')} Cerrar sesión</span><span>›</span></div>
      </div>
      <p class="suave centrado">Versión 1.1</p>`;
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
      </div>
      <div class="tarjeta">
        <h3>Empleados</h3>
        <div id="cf-empleados" class="lista-simple">Cargando…</div>
        <div class="fila" style="margin-top:.7rem">
          <input id="em-nombre" placeholder="Nombre">
          <input id="em-usuario" placeholder="usuario" autocapitalize="none">
        </div>
        <input id="em-pass" placeholder="contraseña" style="margin-top:.6rem">
        <button class="btn chico" style="margin-top:.7rem" onclick="App.crearEmpleado()">+ Agregar empleado</button>
        <div id="em-msg"></div>
      </div>`;
    try {
      const emp = await API.get('/empleados');
      this.$('#cf-empleados').innerHTML = emp.map(e =>
        `<div><span>${this.esc(e.nombre)} <span class="suave">(${this.esc(e.usuario)} · ${e.rol})</span></span></div>`).join('') || '<p class="suave">Solo tú por ahora.</p>';
    } catch (e) {}
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
      await API.post('/empleados', {
        nombre: this.$('#em-nombre').value,
        usuario: this.$('#em-usuario').value,
        password: this.$('#em-pass').value
      });
      this.avisar('Empleado creado');
      this.vistaConfig();
    } catch (e) { this.$('#em-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  /* =========================================================
     ADMIN (superadmin)
     ========================================================= */
  async vistaAdmin() {
    this.$('#vista').innerHTML = `
      <h2>${this.ico('admin')} Negocios</h2>
      <div class="tarjeta" id="ad-lista">Cargando…</div>
      <div class="tarjeta">
        <h3>+ Dar de alta un negocio</h3>
        <div class="fila">
          <div><label>Código (corto, único)</label><input id="ad-codigo" placeholder="POLLERIA1" autocapitalize="characters"></div>
          <div><label>Nombre del negocio</label><input id="ad-nombre" placeholder="Pollería Doña Mary"></div>
        </div>
        <label>Nombre del dueño</label><input id="ad-dnombre">
        <div class="fila">
          <div><label>Usuario del dueño</label><input id="ad-dusuario" autocapitalize="none"></div>
          <div><label>Contraseña</label><input id="ad-dpass"></div>
        </div>
        <button class="btn" onclick="App.crearNegocio()">Crear negocio (con catálogo base de pollería)</button>
        <div id="ad-msg"></div>
      </div>`;
    this.cargarNegocios();
  },

  async cargarNegocios() {
    try {
      const lista = await API.get('/admin/negocios');
      this._negocios = lista;
      this.$('#ad-lista').innerHTML = lista.length ? lista.map(n => `
        <div class="negocio-fila">
          <span class="punto" style="background:${n.activo ? 'var(--ok)' : 'var(--error)'}"></span>
          <div class="info">
            <div class="n">${this.esc(n.nombre)} <span class="suave">(${this.esc(n.codigo)})</span></div>
            <div class="suave">${n.usuarios} usuario(s) · ${n.ventas_hoy} venta(s) hoy</div>
          </div>
          <button class="btn chico secundario" onclick="App.editarNegocio(${n.id})">Gestionar</button>
        </div>`).join('') : '<p class="suave">Sin negocios todavía.</p>';
    } catch (e) { this.$('#ad-lista').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  editarNegocio(id) {
    const n = this._negocios.find(x => x.id === id);
    if (!n) return;
    const FLAGS = [['inventario', 'Inventario'], ['reportes', 'Reportes'], ['whatsapp', 'Ticket por WhatsApp']];
    this.modal(`
      <h3>${this.esc(n.nombre)}</h3>
      <div class="switch-linea"><span><b>Negocio activo</b> (apagar = suspender acceso)</span>
        <input type="checkbox" id="ng-activo" ${n.activo ? 'checked' : ''}></div>
      <h3>Personalización</h3>
      <label>Nombre del negocio</label>
      <input id="ng-nombre" value="${this.esc(n.nombre)}">
      <div class="fila">
        <div><label>Color principal</label><input id="ng-color1" type="color" value="${n.color_primario || '#263949'}"></div>
        <div><label>Color secundario</label><input id="ng-color2" type="color" value="${n.color_secundario || '#16222e'}"></div>
      </div>
      <label>Logo (imagen cuadrada, máx. 400 KB)</label>
      <input id="ng-logo" type="file" accept="image/*">
      <h3>Funciones habilitadas</h3>
      ${FLAGS.map(([k, txt]) => `
        <div class="switch-linea"><span>${txt}</span>
          <input type="checkbox" id="fl-${k}" ${n.flags[k] !== false ? 'checked' : ''}></div>`).join('')}
      <button class="btn" onclick="App.guardarNegocio(${n.id})">Guardar</button>
      <h3>Restablecer contraseña de un usuario</h3>
      <div class="fila">
        <input id="rp-usuario" placeholder="usuario">
        <input id="rp-pass" placeholder="nueva contraseña">
      </div>
      <button class="btn chico secundario" style="margin-top:.6rem" onclick="App.resetPass(${n.id})">Restablecer</button>
      <div id="ng-msg"></div>`);
  },

  async guardarNegocio(id) {
    const flags = {};
    for (const k of ['inventario', 'reportes', 'whatsapp']) flags[k] = this.$('#fl-' + k).checked;
    const body = {
      activo: this.$('#ng-activo').checked,
      flags,
      nombre: this.$('#ng-nombre').value || null,
      color_primario: this.$('#ng-color1').value,
      color_secundario: this.$('#ng-color2').value
    };
    const file = this.$('#ng-logo').files[0];
    if (file) {
      if (file.size > 400 * 1024) return this.avisar('El logo debe pesar menos de 400 KB', true);
      body.logo = await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(file);
      });
    }
    try {
      await API.put('/admin/negocios/' + id, body);
      this.avisar('Negocio actualizado');
      this.cerrarModal();
      this.cargarNegocios();
    } catch (e) { this.$('#ng-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async resetPass(id) {
    try {
      await API.post(`/admin/negocios/${id}/reset-password`, {
        usuario: this.$('#rp-usuario').value, password: this.$('#rp-pass').value
      });
      this.avisar('Contraseña restablecida');
    } catch (e) { this.$('#ng-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  },

  async crearNegocio() {
    try {
      await API.post('/admin/negocios', {
        codigo: this.$('#ad-codigo').value,
        nombre: this.$('#ad-nombre').value,
        dueno_nombre: this.$('#ad-dnombre').value,
        dueno_usuario: this.$('#ad-dusuario').value,
        dueno_password: this.$('#ad-dpass').value
      });
      this.avisar('Negocio creado con su catálogo base');
      this.vistaAdmin();
    } catch (e) { this.$('#ad-msg').innerHTML = `<div class="msg-error">${this.esc(e.message)}</div>`; }
  }
};

window.App = App;
App.iniciar();
