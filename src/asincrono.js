/**
 * Red de seguridad para las rutas asíncronas.
 *
 * Express 4 no entiende de promesas: si un `async (req,res)` lanza un error,
 * nadie lo atrapa, Node lo cuenta como "unhandledRejection" y —desde Node 15—
 * **se lleva el proceso entero**. En una pollería eso se ve como que el
 * sistema "se cayó" a media venta por una consulta que falló.
 *
 * `seguro(router)` envuelve todo lo que se registre en ese router para que
 * cualquier error termine en el manejador de errores de Express y solo se
 * pierda esa petición, no el servidor.
 */
function envolver(fn) {
  if (typeof fn !== 'function' || fn.length >= 4 || fn.__envuelta) return fn;
  const nueva = function (req, res, next) {
    try {
      const r = fn.call(this, req, res, next);
      if (r && typeof r.then === 'function') r.catch(next);
      return r;
    } catch (e) {
      next(e);
    }
  };
  nueva.__envuelta = true;
  return nueva;
}

function seguro(router) {
  for (const metodo of ['get', 'post', 'put', 'patch', 'delete', 'use', 'all']) {
    const original = router[metodo].bind(router);
    router[metodo] = (...args) => original(...args.map(envolver));
  }
  return router;
}

module.exports = { seguro, envolver };
