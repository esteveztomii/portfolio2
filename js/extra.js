/* EXTRA · movimiento e interacciones del portfolio
   Módulos: estela de pixeles, letras del título, aparición al scrollear, header con sección activa,
   foto con inclinación y vista previa de los videos. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function safe(name, fn) { try { fn(); } catch (e) { console.error('[extra:' + name + ']', e); } }

  /* ---------- estela de pixeles (sólo mouse) ---------- */
  safe('trail', function () {
    if (reduce || !fine) return;
    var COLORS = ['#ff6bff', '#fff94a', '#16d93a', '#38c8f0', '#ff5a1f', '#ffffff'], c = document.createElement('canvas'), ctx, parts = [], running = false, dpr = 1, last = 0, lx = -99, ly = -99, lt = 0;
    c.id = 'fxc'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c); ctx = c.getContext('2d');
    function fit() { dpr = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * dpr; c.height = innerHeight * dpr; } fit(); addEventListener('resize', fit);
    function tick(now) {
      var dt = Math.min(.05, (now - last) / 1000); last = now; ctx.clearRect(0, 0, c.width, c.height);
      for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.l -= dt; if (p.l <= 0) { parts.splice(i, 1); continue; } p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.min(1, p.l / p.m * 1.6); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x * dpr / 4) * 4, Math.round(p.y * dpr / 4) * 4, p.s * dpr, p.s * dpr); }
      ctx.globalAlpha = 1; if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, c.width, c.height); }
    }
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return; var now = performance.now(); if (now - lt < 45 || Math.hypot(e.clientX - lx, e.clientY - ly) < 16) return; lt = now; lx = e.clientX; ly = e.clientY;
      var life = .55 + Math.random() * .4; parts.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 40, l: life, m: life, s: 4 + (Math.random() * 3 | 0), c: COLORS[(Math.random() * COLORS.length) | 0] }); if (parts.length > 120) parts.shift();
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    }, { passive: true });
  });

  /* ---------- letras del título ---------- */
  safe('letters', function () {
    var h = $('.hero h1'); if (!h || reduce) return; var i = 0; h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    (function walk(n) {
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) { var f = document.createDocumentFragment(); c.textContent.split('').forEach(function (ch) { if (!ch.trim()) { f.appendChild(document.createTextNode(ch)); return; } var s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i++); s.textContent = ch; f.appendChild(s); }); n.replaceChild(f, c); }
        else if (c.nodeType === 1) walk(c);
      });
    })(h);
  });

  /* ---------- aparición al scrollear ---------- */
  safe('reveal', function () {
    var G = [['main>section.win:not(.hero), .win.full, .win.proy-win, .ticker', 'up'], ['.verdes li', 'l'], ['.cols>.win', 'up'], ['.skills li', 'z'], ['.logos li', 'z'], ['.globo', 'z'], ['.vgrid4 figure', 'z'], ['.vg-item', 'up'], ['.foto', 'z'], ['.browser', 'up'], ['.anim', 'up']];
    var els = []; G.forEach(function (g) {
      var m = $$(g[0]).filter(function (e) { return !e.classList.contains('rv'); });
      m.forEach(function (e) { var sib = m.filter(function (o) { return o.parentNode === e.parentNode; }); e.style.setProperty('--d', Math.min(sib.indexOf(e) * 90, 540) + 'ms'); e.classList.add('rv'); if (g[1] !== 'up') e.classList.add(g[1] === 'l' ? 'l' : 'z'); els.push(e); });
    });
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { threshold: .1, rootMargin: '0px 0px -5% 0px' });
    els.forEach(function (e) { io.observe(e); });
  });

  /* ---------- header: sección activa ---------- */
  safe('spy', function () {
    var links = $$('.site nav a'), ids = links.map(function (a) { return a.getAttribute('href').slice(1); }), secs = ids.map(function (id) { return document.getElementById(id); }), raf = 0;
    function upd() { raf = 0; var y = innerHeight * .38, cur = -1; secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= y) cur = i; }); links.forEach(function (a, i) { a.classList.toggle('on', i === cur); if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); addEventListener('resize', upd); upd();
  });

  /* ---------- foto: inclinación suave con el mouse/dedo ---------- */
  safe('photo', function () {
    var fr = $('.foto-frame'); if (!fr || reduce) return;
    fr.addEventListener('pointermove', function (e) { var b = fr.getBoundingClientRect(); fr.style.setProperty('--ty', (((e.clientX - b.left) / b.width - .5) * 14).toFixed(2) + 'deg'); fr.style.setProperty('--tx', ((.5 - (e.clientY - b.top) / b.height) * 10).toFixed(2) + 'deg'); });
    fr.addEventListener('pointerleave', function () { fr.style.setProperty('--ty', '0deg'); fr.style.setProperty('--tx', '0deg'); });
  });

  /* ---------- videos: vista previa muda al pasar el mouse (sólo desktop) ---------- */
  safe('preview', function () {
    if (reduce || !fine) return;
    $$('.vgrid4 figure').forEach(function (f) {
      var v = $('video', f); if (!v) return;
      f.addEventListener('pointerenter', function () { if (v.dataset.user) return; v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); });
      f.addEventListener('pointerleave', function () { if (v.dataset.user) return; v.pause(); try { if (v.readyState >= 1) v.currentTime = .1; } catch (e) {} });
      v.addEventListener('click', function () { v.dataset.user = '1'; }); v.addEventListener('volumechange', function () { if (!v.muted) v.dataset.user = '1'; });
    });
  });

  /* ---------- video de fondo de Vagari: sólo cuando se ve ---------- */
  safe('bgvideo', function () {
    var v = $('.vg-bg'); if (!v) return;
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      }, { threshold: .1 }).observe(v);
    } else {
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
  });
})();
