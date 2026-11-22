/* FILO NEWS · mini computadora 3D dentro de la ventana: gira y recorre el mockup mientras la ventana cruza la pantalla.
   Editá los números de update() para cambiar cuánto gira y cuándo se desliza el mockup. */
(function () {
  'use strict';
  var box = document.getElementById('pc-scroll'); if (!box) return;
  var pc = box.querySelector('.pc-3d'), view = box.querySelector('.pc-view'), img = view.querySelector('img');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { pc.style.transform = 'rotateX(-4deg) rotateY(-14deg)'; view.style.overflow = 'auto'; img.style.position = 'static'; return; }
  var raf = 0, vis = true;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function update() {
    raf = 0;
    if (!vis) return;
    var r = box.getBoundingClientRect(), vh = innerHeight;
    var p = clamp((vh * .92 - r.top) / (vh * .92 - vh * .1 + r.height * .2), 0, 1);
    var spin = ease(p / .42), q = ease((p - .38) / .5), out = ease((p - .9) / .1);
    var ry = -(1 - spin) * 150 + Math.sin(q * Math.PI * 2) * 7 + out * 18, rx = -4 + (1 - spin) * 8, s = .8 + .2 * spin;
    pc.style.transform = 'scale(' + s.toFixed(3) + ') rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    var pan = Math.max(0, img.offsetHeight - view.clientHeight);
    img.style.transform = 'translate3d(0,' + (-q * pan).toFixed(1) + 'px,0)';
  }
  function req() { if (vis && !raf) raf = requestAnimationFrame(update); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      vis = en[0].isIntersecting;
      if (vis) req();
    }, { rootMargin: '150px 0px 150px 0px' }).observe(box);
  }
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); img.addEventListener('load', req); req();
})();
