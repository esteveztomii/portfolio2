/* HERO · Game Boy Color 3D (three.js r128 + GLTFLoader)
   La pantallita funciona como una GBC: menú de íconos (stats, música, visuales, juegos).
   Se maneja tocando la pantalla, con la cruz / A / B / SELECT / START del modelo, o con el teclado.
   Al tocar la consola se acerca un poco para que sea fácil apretar los botones. */
(function () {
  'use strict';
  var root = document.getElementById('home');
  if (!root) return;
  var visor = document.getElementById('visor'), srEl = document.getElementById('gb-sr'), loadEl = document.getElementById('gb-load');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, A = reduce ? 0 : 1;
  var dirty = true;
  function markDirty() { dirty = true; }

  /* ---------- audio: fragmentos de 30 s de mis canciones favoritas (js/musica.js) ---------- */
  var TRACKS = (window.GB_AUDIO && window.GB_AUDIO.length) ? window.GB_AUDIO : [{ n: 'Sin audio', a: 'Falta js/musica.js', src: '' }];
  var AU = { ctx: null, an: null, data: null, out: null, playing: false, idx: 0, buf: [], src: null, startAt: 0, loading: false, gen: 0 };
  function ensureCtx() {
    if (AU.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    var c = AU.ctx = new AC(), master = c.createGain(); master.gain.value = 0.9;
    AU.an = c.createAnalyser(); AU.an.fftSize = 128; AU.data = new Uint8Array(AU.an.frequencyBinCount);
    master.connect(AU.an); AU.an.connect(c.destination); AU.out = master; return true;
  }
  function decode(i) {
    if (AU.buf[i]) return Promise.resolve(AU.buf[i]);
    var src = TRACKS[i].src; if (!src) return Promise.reject();
    var ab = b64buf(src.split(',')[1]);
    return new Promise(function (res, rej) { var ok = function (b) { AU.buf[i] = b; res(b); }; var pr = AU.ctx.decodeAudioData(ab, ok, rej); if (pr && pr.then) pr.then(ok, rej); });
  }
  function stopSrc() { if (AU.src) { AU.src.onended = null; try { AU.src.stop(); } catch (e) {} try { AU.src.disconnect(); } catch (e) {} AU.src = null; } }
  function startTrack(i) {
    var gen = ++AU.gen; stopSrc(); AU.idx = i; AU.loading = true; markDirty();
    decode(i).then(function (buf) {
      if (gen !== AU.gen) return; AU.loading = false;
      var sn = AU.ctx.createBufferSource(); sn.buffer = buf; sn.connect(AU.out);
      sn.onended = function () { if (gen === AU.gen && AU.playing) { startTrack((AU.idx + 1) % TRACKS.length); } }; // al terminar los 30 s pasa a la siguiente
      AU.src = sn; AU.startAt = AU.ctx.currentTime; sn.start(0); AU.playing = true; markDirty(); announce();
    }, function () { AU.loading = false; markDirty(); });
  }
  function play() { if (!ensureCtx()) return; AU.ctx.resume(); if (AU.src && !AU.playing) { AU.playing = true; markDirty(); return; } startTrack(AU.idx); }
  function pause() { if (!AU.ctx) return; AU.playing = false; AU.ctx.suspend(); markDirty(); }
  function go(d) { if (!ensureCtx()) return; AU.ctx.resume(); startTrack((AU.idx + d + TRACKS.length) % TRACKS.length); }
  var fmt = function (s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  function audioLevel() { if (!AU.playing || !AU.an) return 0; AU.an.getByteFrequencyData(AU.data); var l = 0; for (var i = 1; i < 11; i++) l += AU.data[i]; return l / 2550; }

  /* ---------- contenido ---------- */
  var MENU = [ // el nombre sólo lo leen los lectores de pantalla: en pantalla van íconos
    { n: 'Stats', p: 'stats', i: 1 }, { n: 'Música', p: 'musica', i: 2 }, { n: 'Visuales interactivos', p: 'rave', i: 3 }, { n: 'Juegos favoritos', p: 'juegos', i: 4 }
  ];
  var GAMES = ['Resident Evil', 'Marvel Rivals', 'The Walking Dead', 'Life is Strange'];
  var STATS = [['Motion & Visual', 90], ['Edición & Video', 85], ['Diseño UX/UI', 80], ['Código Creativo', 75]];
  var ST = { page: 'home', sel: 0, game: 0, t0: 0, spinT: -9, selT: 0 };
  var VIS = { mode: 0, cx: 40, cy: 31, parts: [], pulseT: -9, lastT: 0 };
  var NMODES = 4;

  /* ---------- pantalla (canvas lógico 160×144, dibujado a 2x) ---------- */
  var LW = 160, LH = 144, K = 2;
  var scr = document.createElement('canvas'); scr.width = LW * K; scr.height = LH * K;
  var g = scr.getContext('2d');
  var C = { bg: '#e9f1f7', ink: '#181830', mid: '#5b6b8c', lt: '#b9c8de', wh: '#ffffff', blue: '#2850c8', red: '#d83828', grn: '#28a038', yel: '#f8c820', pink: '#f878a8', cy: '#38c8f0', night: '#080626' };
  var FONT = 'VT323, monospace';
  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function ell(cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var dy = -ry; dy <= ry; dy++) { var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + .01)))); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
  }
  function txt(s, x, y, col, px, al) { g.font = px + 'px ' + FONT; g.fillStyle = col; g.textAlign = al || 'left'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); g.fillText(s, x + 0.5, y); }
  function panel(x, y, w, h, fill, bord) {
    bord = bord || C.ink; R(x + 1, y, w - 2, h, bord); R(x, y + 1, w, h - 2, bord); R(x + 2, y + 1, w - 4, h - 2, fill); R(x + 1, y + 2, w - 2, h - 4, fill);
  }
  function fit(s, w, px) { while (px > 8) { g.font = px + 'px ' + FONT; if (g.measureText(s).width <= w) break; px--; } return px; }
  var HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  function heart(x, y, c) { HEART.forEach(function (r, j) { for (var i = 0; i < 7; i++) if (r[i] === 'X') R(x + i, y + j, 1, 1, c); }); }
  function tri(x, y, w, h, dir, col) {
    g.fillStyle = col; g.beginPath();
    if (dir === 'r') { g.moveTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h / 2); }
    else if (dir === 'l') { g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h / 2); }
    else { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w / 2, y + h); }
    g.closePath(); g.fill();
  }

  /* ---------- tu foto, "vista desde la Game Boy Color" ---------- */
  var PH = new Image(); PH.onload = markDirty; if (window.GB_FOTO) PH.src = window.GB_FOTO;
  function photo(x, y) { panel(x - 2, y - 2, 104, 79, C.wh); if (PH.complete && PH.naturalWidth) g.drawImage(PH, x, y, 100, 75); }

  /* ---------- íconos (16×16) ---------- */
  function icon(k, cx, cy, t, on) {
    var i, dy;
    if (k === 1) { // bola roja y blanca
      for (dy = -7; dy <= 7; dy++) { var hw = Math.round(Math.sqrt(49.5 - dy * dy)); R(cx - hw, cy + dy, hw * 2 + 1, 1, C.ink); }
      for (dy = -6; dy <= 6; dy++) { var h2 = Math.round(Math.sqrt(36.5 - dy * dy)); R(cx - h2, cy + dy, h2 * 2 + 1, 1, dy < -1 ? C.red : (dy > 1 ? C.wh : C.ink)); }
      ell(cx, cy, 3, 3, C.ink); ell(cx, cy, 2, 2, C.wh);
    } else if (k === 2) { // notas
      var b = on && !reduce ? Math.round(Math.sin(t * 8)) : 0;
      R(cx - 2, cy - 6 + b, 1, 10, C.ink); R(cx + 5, cy - 8 + b, 1, 10, C.ink); R(cx - 2, cy - 7 + b, 8, 2, C.blue);
      ell(cx - 4, cy + 4 + b, 3, 2, C.ink); ell(cx + 3, cy + 2 + b, 3, 2, C.ink);
    } else if (k === 3) { // onda neón
      R(cx - 8, cy - 7, 16, 14, C.ink); R(cx - 7, cy - 6, 14, 12, '#10143a');
      var ph = on && !reduce ? t * 4 : 0;
      for (i = -6; i <= 6; i++) { R(cx + i, cy + Math.round(Math.sin(i * .8 + ph) * 3) - 1, 1, 2, C.cy); R(cx + i, cy + Math.round(Math.sin(i * .8 + ph + 2.2) * 3) + 1, 1, 1, C.pink); }
    } else { // joystick
      R(cx - 8, cy - 4, 16, 9, '#8a94a8'); R(cx - 7, cy - 5, 14, 11, '#8a94a8'); R(cx - 8, cy - 4, 16, 1, '#b9c1d0'); R(cx - 8, cy + 4, 16, 1, '#5a6478');
      R(cx - 6, cy, 5, 1, C.ink); R(cx - 4, cy - 2, 1, 5, C.ink); ell(cx + 3, cy + 1, 1, 1, C.red); ell(cx + 6, cy - 1, 1, 1, C.red);
    }
  }
  var ICOBOX = function (i) { return { x: 4 + i * 39, y: 98, w: 35, h: 40 }; };

  /* ---------- cartuchos que rotan (pseudo-3D en pixel art) ---------- */
  var CARTS = null, LOGOS = {};
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; var x = c.getContext('2d'); x.scale(2, 2); return [c, x]; }
  function cartBody(x, back) {
    x.fillStyle = '#14141e'; x.beginPath(); x.moveTo(3, 0); x.lineTo(40, 0); x.lineTo(48, 8); x.lineTo(48, 53); x.lineTo(45, 56); x.lineTo(3, 56); x.lineTo(0, 53); x.lineTo(0, 3); x.closePath(); x.fill();
    x.fillStyle = back ? '#979db0' : '#b4b9c6'; x.beginPath(); x.moveTo(3, 1.5); x.lineTo(39.5, 1.5); x.lineTo(46.5, 8.5); x.lineTo(46.5, 52.5); x.lineTo(44.5, 54.5); x.lineTo(3.5, 54.5); x.lineTo(1.5, 52.5); x.lineTo(1.5, 3); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(3, 2, 36, 1);
    x.fillStyle = '#14141e'; x.fillRect(9, 47, 30, 6); x.fillStyle = '#7d8394'; x.fillRect(10, 48, 28, 4);
  }
  function label(x, i) {
    x.fillStyle = '#14141e'; x.fillRect(4, 6, 40, 34); x.save(); x.beginPath(); x.rect(5, 7, 38, 32); x.clip(); x.textAlign = 'center';
    var src = window.GB_LOGOS && window.GB_LOGOS[i], im = LOGOS[i];
    if (src && !im) { im = LOGOS[i] = new Image(); im.onload = function () { CARTS = null; markDirty(); }; im.src = src; }
    if (im && im.complete && im.naturalWidth) x.drawImage(im, 5, 7, 38, 32);
    else {
    var lg;
    if (i === 0) {
      x.fillStyle = '#0b0b0f'; x.fillRect(5, 7, 38, 32); x.fillStyle = '#8c1010'; x.fillRect(5, 7, 38, 2);
      x.font = 'bold 8px Georgia,serif'; x.fillStyle = '#d02020'; x.fillText('RESIDENT', 24, 20);
      x.font = 'bold 15px Georgia,serif'; x.fillStyle = '#f2f2f2'; x.fillText('EVIL', 24, 35); x.fillStyle = '#b01010'; x.fillRect(10, 37, 28, 1);
    } else if (i === 1) {
      lg = x.createLinearGradient(0, 7, 0, 39); lg.addColorStop(0, '#1a1450'); lg.addColorStop(1, '#6a1ab0'); x.fillStyle = lg; x.fillRect(5, 7, 38, 32);
      x.fillStyle = '#ffd23a'; x.beginPath(); x.moveTo(31, 8); x.lineTo(25, 20); x.lineTo(29, 20); x.lineTo(24, 31); x.lineTo(35, 17); x.lineTo(30, 17); x.lineTo(34, 8); x.closePath(); x.fill();
      x.font = 'bold 7px Arial,sans-serif'; x.fillStyle = '#ffd23a'; x.fillText('MARVEL', 17, 17);
      x.font = 'italic bold 12px Arial,sans-serif'; x.fillStyle = '#f070b0'; x.fillText('RIVALS', 25, 36); x.fillStyle = '#38e0ff'; x.fillText('RIVALS', 24, 35);
    } else if (i === 2) {
      lg = x.createLinearGradient(0, 7, 0, 39); lg.addColorStop(0, '#1b1b1b'); lg.addColorStop(1, '#4a1212'); x.fillStyle = lg; x.fillRect(5, 7, 38, 32);
      x.font = 'bold 5px Arial,sans-serif'; x.fillStyle = '#9a9a9a'; x.fillText('THE', 24, 14);
      x.font = 'bold 8px Georgia,serif'; x.fillStyle = '#d0d0d0'; x.fillText('WALKING', 24, 23);
      x.font = 'bold 13px Georgia,serif'; x.fillStyle = '#c01414'; x.fillText('DEAD', 24, 35); x.fillRect(14, 36, 2, 3); x.fillRect(24, 36, 2, 2); x.fillRect(32, 36, 2, 4);
    } else {
      lg = x.createLinearGradient(0, 7, 0, 39); lg.addColorStop(0, '#bfe6f0'); lg.addColorStop(1, '#f6ecd8'); x.fillStyle = lg; x.fillRect(5, 7, 38, 32);
      x.fillStyle = '#2aa6c8'; x.beginPath(); x.ellipse(18, 16, 6, 5, -.3, 0, 7); x.ellipse(30, 16, 6, 5, .3, 0, 7); x.fill();
      x.fillStyle = '#5ac8e0'; x.beginPath(); x.ellipse(20, 22, 4, 3, .4, 0, 7); x.ellipse(28, 22, 4, 3, -.4, 0, 7); x.fill();
      x.fillStyle = '#1d5a70'; x.fillRect(23.5, 11, 1.5, 14);
      x.font = 'bold 6px Arial,sans-serif'; x.fillText('LIFE IS', 24, 31); x.font = 'bold 8px Arial,sans-serif'; x.fillText('STRANGE', 24, 37);
    }
    }
    x.restore(); x.fillStyle = '#8a90a0'; x.fillRect(8, 42, 32, 1); x.fillRect(8, 44, 32, 1);
  }
  function buildCarts() {
    CARTS = { f: [], b: null };
    for (var i = 0; i < 4; i++) { var p = mk(48, 56); cartBody(p[1], false); label(p[1], i); CARTS.f.push(p[0]); }
    var q = mk(48, 56), x = q[1]; cartBody(x, true);
    x.fillStyle = '#14141e'; x.fillRect(7, 7, 34, 26); x.fillStyle = '#dadde5'; x.fillRect(8, 8, 32, 24);
    x.fillStyle = '#8a8fa0'; x.fillRect(11, 12, 26, 2); x.fillRect(11, 17, 20, 2); x.fillRect(11, 22, 24, 2); for (var b = 0; b < 12; b++) x.fillRect(11 + b * 2, 27, b % 3 ? 1 : 2, 3);
    CARTS.b = q[0];
  }
  function cartAngle(t, ph, sway) { // se queda de frente con un leve vaivén y cada tanto da una vuelta
    if (reduce) return 0;
    var u = (((t + ph) % 4.2) + 4.2) % 4.2 / 4.2;
    if (u < .62) return Math.sin(u / .62 * Math.PI * 2) * sway;
    var v = (u - .62) / .38; return (v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2) * Math.PI * 2;
  }
  function drawCart(i, cx, y, h, th, alpha) {
    if (!CARTS) buildCarts();
    var s = h / 56, W = 48 * s, co = Math.cos(th), si = Math.sin(th), fw = Math.max(1, W * Math.abs(co)), sw = 9 * s * Math.abs(si), x0 = cx - (fw + sw) / 2, right = si > 0;
    g.save(); g.globalAlpha = alpha == null ? 1 : alpha; g.imageSmoothingEnabled = true;
    if (sw > 0.5) { var sx = right ? x0 + fw : x0; R(sx, y, sw, h, '#14141e'); R(sx + (right ? 0 : 1), y + 1, Math.max(0, sw - 1), h - 2, '#7b8192'); for (var r = 3; r < h - 3; r += 3) R(sx, y + r, sw, 1, '#5d6374'); }
    g.drawImage(co >= 0 ? CARTS.f[i] : CARTS.b, right ? x0 : x0 + sw, y, fw, h);
    g.fillStyle = 'rgba(10,10,50,' + (0.28 * Math.abs(si)).toFixed(2) + ')'; g.fillRect(right ? x0 : x0 + sw, y, fw, h);
    g.restore();
  }

  /* ---------- visuales interactivos ---------- */
  var RAMP = [];
  (function () {
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 1; var x = cv.getContext('2d'), gr = x.createLinearGradient(0, 0, 64, 0);
    [[0, '#080626'], [.18, '#2a12a8'], [.34, '#2f6df0'], [.5, '#38d0f8'], [.62, '#ffffff'], [.74, '#ff7ac0'], [.88, '#9a1fd0'], [1, '#080626']].forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    x.fillStyle = gr; x.fillRect(0, 0, 64, 1); var d = x.getImageData(0, 0, 64, 1).data; for (var i = 0; i < 64; i++) RAMP.push('rgb(' + d[i * 4] + ',' + d[i * 4 + 1] + ',' + d[i * 4 + 2] + ')');
  })();
  var GX = 80, GY = 62, GY0 = 19;
  function ramp(v) { v = v - Math.floor(v); return RAMP[Math.floor(v * 63)]; }
  function burst(n) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, s = 8 + Math.random() * 22; VIS.parts.push({ x: VIS.cx, y: VIS.cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, l: 1 }); } if (VIS.parts.length > 220) VIS.parts.splice(0, VIS.parts.length - 220); }
  function pVisual(now) {
    var t = reduce ? 2 : now / 1000, dt = Math.min(.1, Math.max(0, t - VIS.lastT)); VIS.lastT = t;
    var cx = VIS.cx, cy = VIS.cy, lv = audioLevel(), gx, gy, i, m = VIS.mode, pt = t - VIS.pulseT;
    header(3, now);
    if (m < 2) {
      var lastI = -1;
      for (gy = 0; gy < GY; gy++) {
        var runX = 0, runI = -1;
        for (gx = 0; gx <= GX; gx++) {
          var idx = -1;
          if (gx < GX) {
            var dx = gx - cx, dy = (gy - cy), d = Math.sqrt(dx * dx + dy * dy), v;
            if (m === 0) v = Math.sin(d * .28 - t * 3.2) * .5 + Math.sin(gx * .11 + t * 1.3) * .25 + Math.sin(gy * .13 - t * 1.7) * .25;
            else v = Math.sin(d * .45 - t * 4 + Math.atan2(dy, dx) * 2) * .6 + Math.sin(d * .12 - t) * .2;
            if (pt < 1.6) v += Math.sin((d - pt * 60) * .5) * Math.exp(-Math.abs(d - pt * 60) * .12) * .9;
            idx = Math.floor((((v * .5 + .5) * .9 + d * .004 + lv * .35 + t * .02) % 1 + 1) % 1 * 63);
          }
          if (idx !== runI) { if (runI >= 0) { g.fillStyle = RAMP[runI]; g.fillRect(runX * 2, GY0 + gy * 2, (gx - runX) * 2, 2); } runX = gx; runI = idx; }
        }
      }
    } else {
      R(0, GY0, LW, LH - GY0, C.night);
      for (i = 0; i < 26; i++) R((i * 37 + 11) % LW, GY0 + (i * 53 + 7) % (LH - GY0), 1, 1, i % 3 ? '#2a2a70' : '#6a6ac0');
      if (m === 2) {
        var P = VIS.parts; for (i = 0; i < 3 && !reduce; i++) { var a = -1.57 + (Math.random() - .5) * 2.2, s = 10 + Math.random() * 18; P.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1 }); }
        for (i = P.length - 1; i >= 0; i--) { var p = P[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 26 * dt; p.l -= dt * .8; if (p.l <= 0 || p.y > GY) { P.splice(i, 1); continue; } R(Math.round(p.x) * 2, GY0 + Math.round(p.y) * 2, 2, 2, ramp(.3 + p.l * .5 + t * .05)); }
      } else {
        var fr = .08 + cx / GX * .3, amp = 3 + cy / GY * 10 + lv * 8;
        for (var k = 0; k < 6; k++) { var col = ramp(.3 + k * .09 + t * .04); for (gx = 0; gx < GX; gx++) R(gx * 2, GY0 + Math.round(31 + (k - 2.5) * 7 + Math.sin(gx * fr + t * 2.2 + k * .8) * amp) * 2, 2, 2, col); }
      }
    }
    if (m === 2 && !reduce) { /* partículas ya dibujadas */ }
    var px_ = cx * 2, py_ = GY0 + cy * 2; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(px_ - 6, py_, 4, 1); g.fillRect(px_ + 3, py_, 4, 1); g.fillRect(px_, py_ - 6, 1, 4); g.fillRect(px_, py_ + 3, 1, 4);
    for (i = 0; i < NMODES; i++) { R(121 + i * 8, 135, 6, 6, '#0c1030'); R(122 + i * 8, 136, 4, 4, i === m ? C.wh : '#4a4a90'); }
  }

  /* ---------- páginas ---------- */
  function clockStr() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function noteIcon(x) { ell(x, 11, 2, 1, C.yel); R(x + 1, 4, 1, 7, C.yel); R(x + 1, 4, 3, 1, C.yel); }
  function header(k, now) {
    R(0, 0, LW, 18, C.blue); R(0, 18, LW, 1, C.ink);
    panel(3, 1, 20, 16, C.wh); icon(k, 13, 9, now / 1000, false);
    txt(clockStr(), LW - 5, 13, C.wh, 14, 'right'); if (AU.playing) noteIcon(LW - 44);
  }
  function pHome(now) {
    var t = now / 1000;
    R(0, 0, LW, 12, C.blue); R(0, 12, LW, 1, C.ink);
    for (var i = 0; i < 3; i++) heart(5 + i * 9, 3, C.red);
    txt(clockStr(), LW - 5, 10, C.wh, 12, 'right'); if (AU.playing) noteIcon(LW - 38);
    photo(6, 16);
    panel(110, 14, 46, 79, C.wh);
    txt('TOMÁS', 115, 31, C.ink, 14); txt('ESTÉVEZ', 115, 42, C.ink, fit('ESTÉVEZ', 38, 11)); R(115, 46, 36, 1, C.lt);
    txt('Diseño', 115, 57, C.mid, 9); txt('Multimedial', 115, 66, C.mid, fit('Multimedial', 38, 9)); txt('UNLP', 115, 76, C.red, 9); heart(128, 80, C.red);
    MENU.forEach(function (m, k) {
      var b = ICOBOX(k), on = k === ST.sel;
      if (on) { panel(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.red); panel(b.x + 1, b.y + 1, b.w - 2, b.h - 2, '#fff2b8'); } else panel(b.x, b.y, b.w, b.h, C.wh);
      icon(m.i, b.x + 17, b.y + 20 + (on && !reduce && Math.floor(t * 3) % 2 ? -1 : 0), t, on);
    });
  }
  function pStats(now) {
    header(1, now);
    panel(4, 22, 152, 22, C.wh); txt('TOMÁS E.', 10, 38, C.ink, 14); panel(88, 26, 64, 14, C.yel); txt('TIPO MULTIMEDIA', 120, 36, C.ink, 10, 'center');
    var e = Math.min(1, (now - ST.t0) / 700); e = 1 - Math.pow(1 - e, 3);
    STATS.forEach(function (s, i) {
      var y = 49 + i * 22;
      txt(s[0].toUpperCase(), 6, y + 8, C.ink, 11); txt(String(s[1]), 154, y + 8, C.blue, 11, 'right');
      R(5, y + 11, 150, 7, C.ink); R(6, y + 12, 148, 5, C.lt);
      var w = Math.round(148 * s[1] / 100 * e); R(6, y + 12, w, 5, s[1] >= 85 ? C.grn : C.yel); R(6, y + 12, w, 1, C.wh);
    });
    txt('PASIVA: MODO NOCTURNO', 80, 141, C.mid, 10, 'center');
  }
  function pMusica(now) {
    var t = now / 1000, tr = TRACKS[AU.idx], i;
    header(2, now);
    var s1 = tr.n.toUpperCase(); txt(s1, 6, 33, C.ink, fit(s1, 148, 16)); txt(tr.a, 6, 43, C.mid, fit(tr.a, 148, 10));
    panel(4, 47, 152, 42, C.ink); R(6, 49, 148, 38, '#0c1030');
    if (AU.playing) AU.an.getByteFrequencyData(AU.data);
    for (i = 0; i < 24; i++) {
      var v = AU.playing ? AU.data[i + 1] / 255 : 0.1 + 0.05 * Math.sin(t * 2 + i) * A, bh = Math.max(2, Math.round(v * 34 / 2) * 2);
      for (var yy = 0; yy < bh; yy += 2) R(8 + i * 6, 85 - yy - 2, 5, 2, yy < 18 ? C.grn : (yy < 28 ? C.yel : C.red));
    }
    var buf = AU.buf[AU.idx], dur = buf ? buf.duration : 30, pos = (AU.src && AU.ctx) ? Math.min(1, Math.max(0, (AU.ctx.currentTime - AU.startAt) / dur)) : 0;
    R(5, 94, 150, 7, C.ink); R(6, 95, 148, 5, C.lt); R(6, 95, Math.round(148 * pos), 5, C.blue);
    txt(AU.loading ? 'CARGANDO...' : fmt(pos * dur) + ' / ' + fmt(dur), 6, 118, C.ink, 13);
    panel(88, 105, 66, 22, C.wh);
    tri(94, 111, 8, 10, 'l', C.blue); R(95, 111, 2, 10, C.blue);
    if (AU.playing) { R(116, 110, 4, 12, C.red); R(122, 110, 4, 12, C.red); } else tri(116, 110, 10, 12, 'r', C.grn);
    tri(140, 111, 8, 10, 'r', C.blue); R(147, 111, 2, 10, C.blue);
  }
  function pJuegos(now) {
    var t = now / 1000, i;
    header(4, now);
    var sp = (t - ST.spinT) < .9 ? (1 - Math.pow(1 - (t - ST.spinT) / .9, 3)) * 6.283 : 0;
    ell(80, 87, 20, 3, 'rgba(24,24,48,.22)');
    drawCart(ST.game, 80, 24, 60, cartAngle(t - ST.selT, 0, .38) + sp, 1);
    tri(10, 48, 7, 11, 'l', C.blue); tri(143, 48, 7, 11, 'r', C.blue);
    for (i = 0; i < 4; i++) {
      var cx = 24 + i * 37.5, on = i === ST.game;
      if (on) panel(cx - 17, 95, 34, 44, '#fff2b8', C.red); else panel(cx - 17, 95, 34, 44, C.wh, C.lt);
      drawCart(i, cx, 99, 36, cartAngle(t, i * 1.1, .3), on ? 1 : .8);
    }
  }
  function paint(now) {
    g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingEnabled = false;
    R(0, 0, LW, LH, C.bg);
    ({ home: pHome, stats: pStats, musica: pMusica, rave: pVisual, juegos: pJuegos })[ST.page](now);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = lcd(); g.fillRect(0, 0, LW * K, LH * K); // rejilla LCD
  }
  var lcdPat; function lcd() {
    if (lcdPat) return lcdPat;
    var c = document.createElement('canvas'); c.width = c.height = 2; var x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,40,.075)'; x.fillRect(1, 0, 1, 2); x.fillRect(0, 1, 2, 1);
    return (lcdPat = g.createPattern(c, 'repeat'));
  }

  /* ---------- navegación ---------- */
  function announce() {
    var s = '', p = ST.page;
    if (p === 'home') s = 'Menú: ' + MENU[ST.sel].n + ', opción ' + (ST.sel + 1) + ' de ' + MENU.length;
    else if (p === 'stats') s = 'Stats. ' + STATS.map(function (x) { return x[0] + ' ' + x[1]; }).join(', ');
    else if (p === 'musica') s = 'Música: ' + TRACKS[AU.idx].n + ', ' + TRACKS[AU.idx].a + ', ' + (AU.playing ? 'reproduciendo' : 'en pausa');
    else if (p === 'rave') s = 'Visuales interactivos. Mové el cursor con la cruz o tocando la pantalla; A cambia el efecto.';
    else s = 'Juego favorito ' + (ST.game + 1) + ' de ' + GAMES.length + ': ' + GAMES[ST.game];
    srEl.textContent = s;
  }
  function open(p) { ST.page = p; ST.t0 = performance.now(); ST.selT = ST.t0 / 1000; markDirty(); announce(); }
  function back() { if (ST.page !== 'home') open('home'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function goSobreMi() { var el = document.getElementById('sobre-mi'); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  function press(b) {
    var p = ST.page; markInteract();
    if (b === 'start') { goSobreMi(); nudge = 1; return; }  // START lleva a "Sobre mí"
    if (b === 'select') b = 'a';                            // SELECT: segunda forma de elegir (igual que A)
    if (b === 'b') back();
    else if (p === 'home') {
      if (b === 'right' || b === 'down') ST.sel = (ST.sel + 1) % MENU.length; else if (b === 'left' || b === 'up') ST.sel = (ST.sel + MENU.length - 1) % MENU.length;
      if (b === 'a') open(MENU[ST.sel].p); else { markDirty(); announce(); }
    } else if (p === 'musica') {
      if (b === 'a') { AU.playing ? pause() : play(); } else if (b === 'right') go(1); else if (b === 'left') go(-1); announce();
    } else if (p === 'rave') {
      if (b === 'a') { VIS.mode = (VIS.mode + 1) % NMODES; VIS.pulseT = performance.now() / 1000; burst(18); }
      else { VIS.cx = clamp(VIS.cx + (b === 'right' ? 6 : b === 'left' ? -6 : 0), 2, GX - 3); VIS.cy = clamp(VIS.cy + (b === 'down' ? 6 : b === 'up' ? -6 : 0), 2, GY - 3); VIS.pulseT = performance.now() / 1000; }
      markDirty();
    } else if (p === 'juegos') {
      if (b === 'right') ST.game = (ST.game + 1) % 4; else if (b === 'left') ST.game = (ST.game + 3) % 4; else if (b === 'a') ST.spinT = performance.now() / 1000; if (b === 'right' || b === 'left') ST.selT = performance.now() / 1000;
      markDirty(); announce();
    } else if (b === 'left') back();
    nudge = 1;
  }
  function tap(x, y) { // toque directo sobre la pantallita (0..160 × 0..144)
    var i, p = ST.page; markInteract();
    if (p === 'home') { for (i = 0; i < MENU.length; i++) { var b = ICOBOX(i); if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { ST.sel = i; open(MENU[i].p); return true; } } return false; }
    if (y < 19 && x < 30) { back(); return true; }
    if (p === 'musica' && y > 100 && y < 130) { press(x < 108 ? 'left' : (x > 134 ? 'right' : 'a')); return true; }
    if (p === 'juegos') {
      if (y >= 94) { ST.game = clamp(Math.round((x - 24) / 37.5), 0, 3); ST.selT = performance.now() / 1000; markDirty(); announce(); return true; }
      if (y > 19) { if (x < 40) press('left'); else if (x > 120) press('right'); else press('a'); return true; }
    }
    if (p === 'rave' && y > 19) {
      if (y > 130 && x > 118) { VIS.mode = (VIS.mode + 1) % NMODES; } else { VIS.cx = clamp(Math.round(x / 2), 2, GX - 3); VIS.cy = clamp(Math.round((y - GY0) / 2), 2, GY - 3); }
      VIS.pulseT = performance.now() / 1000; burst(22); markDirty(); return true;
    }
    if (p === 'stats' && y > 19) { back(); return true; }
    return false;
  }

  /* ---------- textura: foto del Game Boy + pantalla en vivo ---------- */
  var S = 2, TS = 1024 * S, baseCv, texCv, tx, tex, nudge = 0;
  var BTN = { // botones: posición y tamaño medidos sobre el modelo (x derecha, y arriba, z frente); r/w/h = zona táctil, vr/vw/vh = tamaño visible
    dpad: { x: -0.235, y: -0.083, z: 0.205, r: 0.105, vr: 0.09 }, a: { x: 0.307, y: -0.039, z: 0.209, r: 0.054, vr: 0.043 }, b: { x: 0.187, y: -0.093, z: 0.209, r: 0.054, vr: 0.043 },
    select: { x: -0.057, y: -0.283, z: 0.195, w: 0.1, h: 0.06, vw: 0.08, vh: 0.036 }, start: { x: 0.066, y: -0.283, z: 0.195, w: 0.1, h: 0.06, vw: 0.08, vh: 0.036 }
  };
  function hitTest(p) {
    if (p.z < 0.1) return null;
    var k, o, dx, dy;
    for (k in BTN) {
      o = BTN[k]; dx = p.x - o.x; dy = p.y - o.y;
      if (o.r ? (dx * dx + dy * dy <= o.r * o.r) : (Math.abs(dx) <= o.w / 2 && Math.abs(dy) <= o.h / 2)) {
        if (k === 'dpad') return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'down' : 'up');
        return k;
      }
    }
    return null;
  }
  function screenUV(u, v) {
    var a = u * 1024, b = v * 1024;
    if (a < 70 || a > 233 || b < 475 || b > 659) return null;
    return { x: -(b - 567) / (182 / 160) + 80, y: -(a - 151.5) / (161 / 144) + 72 };
  }
  var GEO, fx, hv, hints = [], fxUntil = 0, hoverId = null, lastInteract = -1e9, zoomUntil = 0, zoom = 1, downHit = null;
  function markInteract() { lastInteract = performance.now(); }
  function place(m, id) { // coloca un resaltado exactamente sobre un botón
    var o = BTN[(id === 'left' || id === 'right' || id === 'up' || id === 'down') ? 'dpad' : id], x = o.x, y = o.y, w, h;
    if (o === BTN.dpad) { var vert = id === 'up' || id === 'down', sg = (id === 'right' || id === 'up') ? 1 : -1; w = vert ? 0.05 : 0.075; h = vert ? 0.075 : 0.05; x += vert ? 0 : sg * 0.058; y += vert ? sg * 0.058 : 0; m.geometry = GEO.box; }
    else if (o.vr) { w = h = o.vr * 2; m.geometry = GEO.disc; }
    else { w = o.vw; h = o.vh; m.geometry = GEO.box; }
    m.position.set(x, y, o.z + 0.012); m.scale.set(w, h, 1);
  }
  function flash(id) { if (!fx) return; place(fx, id); fx.visible = true; fxUntil = performance.now() + 150; }
  function overlay(op) { return new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
  function blit() {
    tx.save(); tx.translate(151.5 * S, 567 * S); tx.rotate(Math.PI / 2); tx.scale(-1, 1);
    tx.scale(182 * S / (LW * K), 161 * S / (LH * K)); tx.imageSmoothingEnabled = false; tx.drawImage(scr, -LW * K / 2, -LH * K / 2); tx.restore();
    tex.needsUpdate = true;
  }

  /* ---------- escena 3D ---------- */
  var T = window.THREE, r, scene3, cam, rootG, model, mesh, SIZE, ray, ready = false, vis = true;
  var lvlS = 0, px = 0, py = 0, spin = 0, spinV = 0, drag = false, moved = 0, lastX = 0, lastPaint = 0;

  function fail(msg) { root.classList.add('no3d'); if (loadEl) { loadEl.hidden = false; loadEl.textContent = msg; } }
  function b64buf(b64) { var s = atob(b64), n = s.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  function size() {
    if (!r || !SIZE) return;
    var w = visor.clientWidth, h = visor.clientHeight; if (!w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    var tn = Math.tan(cam.fov * Math.PI / 360), dH = (SIZE.y * 1.04 / 2) / tn, dW = (SIZE.x * 1.06 / 2) / (tn * cam.aspect);
    cam.position.z = Math.max(dH, dW) + SIZE.z / 2;
  }
  function pointerNDC(e) { var b = r.domElement.getBoundingClientRect(); return new T.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); }
  function hitAt(e) { // {b:'a'} botón físico · {s:{x,y}} pantallita · null
    if (!ready) return null;
    scene3.updateMatrixWorld(true); ray.setFromCamera(pointerNDC(e), cam);
    var h = ray.intersectObject(mesh, false)[0]; if (!h) return null;
    var lp = model.worldToLocal(h.point.clone()), b = hitTest(lp); if (b) return { b: b };
    var s = h.uv && lp.z > 0.1 ? screenUV(h.uv.x, h.uv.y) : null; return s ? { s: s } : null;
  }

  function init() {
    if (!T) return fail('Falta js/three.min.js (revisá el nombre y la carpeta).');
    if (!T.GLTFLoader) return fail('Falta js/GLTFLoader.js (subilo a la carpeta js).');
    if (!window.GB_GLB_B64) return fail('Falta js/gameboy-model.js (subilo a la carpeta js).');
    try { r = new T.WebGLRenderer({ alpha: true, antialias: true }); } catch (e) { return fail('Tu navegador no soporta WebGL. Usá la barra de abajo para moverte por la página.'); }
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputEncoding = T.sRGBEncoding;
    Array.prototype.forEach.call(root.querySelectorAll('.gb-keys, .gb-credit'), function (n) { n.parentNode.removeChild(n); }); // sin textos de ayuda
    visor.appendChild(r.domElement); r.domElement.setAttribute('aria-hidden', 'true');
    scene3 = new T.Scene(); cam = new T.PerspectiveCamera(30, 1, 0.1, 60); ray = new T.Raycaster();
    rootG = new T.Group(); scene3.add(rootG);
    GEO = { box: new T.PlaneGeometry(1, 1), disc: new T.CircleGeometry(0.5, 28), ring: new T.RingGeometry(0.4, 0.5, 40) };
    new T.GLTFLoader().parse(b64buf(window.GB_GLB_B64), '', function (gltf) {
      model = gltf.scene;
      model.traverse(function (o) { if (o.name === 'GameBoy') { o.matrix.identity(); o.matrixAutoUpdate = false; } if (o.isMesh) mesh = o; });
      model.updateMatrixWorld(true);
      var bb = new T.Box3().setFromObject(model); SIZE = bb.getSize(new T.Vector3()); model.position.sub(bb.getCenter(new T.Vector3()));
      rootG.add(model);
      fx = new T.Mesh(GEO.box, overlay(0.55)); fx.visible = false; model.add(fx);          // destello al apretar
      hv = new T.Mesh(GEO.box, overlay(0.3)); hv.visible = false; model.add(hv);            // resaltado al pasar el mouse
      [['dpad', 0.09], ['a', 0.043], ['b', 0.043], ['select', 0], ['start', 0]].forEach(function (h) { // pista sutil: anillos que "respiran" justo sobre cada botón
        var o = BTN[h[0]], m = new T.Mesh(h[1] ? GEO.ring : GEO.box, overlay(0)); m.position.set(o.x, o.y, o.z + 0.012);
        if (h[1]) m.scale.set(h[1] * 2.7, h[1] * 2.7, 1); else m.scale.set(o.vw * 1.15, o.vh * 1.3, 1); m.visible = false; model.add(m); hints.push(m);
      });
      var img = mesh.material.map.image;
      baseCv = document.createElement('canvas'); baseCv.width = baseCv.height = TS;
      var b = baseCv.getContext('2d'); b.imageSmoothingQuality = 'high'; b.drawImage(img, 0, 0, TS, TS);
      var lg = b.createRadialGradient(184 * S, 691 * S, 0, 184 * S, 691 * S, 14 * S);
      lg.addColorStop(0, 'rgba(255,60,60,1)'); lg.addColorStop(0.3, 'rgba(255,40,40,.8)'); lg.addColorStop(1, 'rgba(255,0,0,0)');
      b.fillStyle = lg; b.fillRect(160 * S, 667 * S, 48 * S, 48 * S);
      texCv = document.createElement('canvas'); texCv.width = texCv.height = TS; tx = texCv.getContext('2d'); tx.drawImage(baseCv, 0, 0);
      tex = new T.CanvasTexture(texCv); tex.flipY = false; tex.encoding = T.sRGBEncoding; tex.anisotropy = r.capabilities.getMaxAnisotropy();
      mesh.material.map = tex; mesh.material.needsUpdate = true;
      size(); ready = true; if (loadEl) loadEl.hidden = true; announce();
    }, function (err) { console.error(err); fail('Error al leer el modelo: ' + (err && err.message ? err.message : err)); });

    addEventListener('resize', size);
    if (window.ResizeObserver) new ResizeObserver(size).observe(visor);
    addEventListener('pointermove', function (e) {
      var b = visor.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / 350));
      py = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / 260));
      if (drag) { spinV = (e.clientX - lastX) * 0.012; spin += spinV; moved += Math.abs(e.clientX - lastX); lastX = e.clientX; }
      else if (ready && e.target === r.domElement) {
        var h = hitAt(e); visor.style.cursor = (h && (h.b || h.s)) ? 'pointer' : 'grab';
        hoverId = h && h.b ? h.b : null;
        if (h && h.s && ST.page === 'rave' && e.pointerType !== 'touch') { VIS.cx = clamp(Math.round(h.s.x / 2), 2, GX - 3); VIS.cy = clamp(Math.round((h.s.y - GY0) / 2), 2, GY - 3); markDirty(); }
      } else hoverId = null;
    });
    visor.addEventListener('pointerdown', function (e) {
      drag = true; moved = 0; lastX = e.clientX; downHit = hitAt(e); // el toque se resuelve antes de que la consola se acerque
      zoomUntil = performance.now() + 4500; markInteract();
      try { visor.setPointerCapture(e.pointerId); } catch (x) {}
    });
    addEventListener('pointerup', function (e) {
      if (drag && moved < 6) { var h = downHit; if (h && h.b) { press(h.b); flash(h.b); } else if (h && h.s && tap(h.s.x, h.s.y)) nudge = .6; zoomUntil = performance.now() + 4500; }
      drag = false; downHit = null; if (e.pointerType === 'touch') hoverId = null;
    });
    visor.addEventListener('keydown', function (e) {
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'a', ' ': 'a', z: 'a', Z: 'a', Escape: 'b', Backspace: 'b', x: 'b', X: 'b' }[e.key];
      if (!m) return; e.preventDefault(); press(m); flash(m);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (!vis && AU.playing) pause(); }).observe(visor);
    document.addEventListener('visibilitychange', function () { if (document.hidden && AU.playing) pause(); });
    if (document.fonts) { document.fonts.load('16px VT323').then(markDirty, function () {}); document.fonts.ready.then(function () { CARTS = null; markDirty(); }); }
    requestAnimationFrame(loop);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!ready || !vis || document.hidden) return;
    var t = now / 1000, p = ST.page;
    var every = (p === 'rave') ? 60 : (p === 'juegos' || p === 'musica') ? 70 : (p === 'stats' && now - ST.t0 < 800) ? 40 : 280;
    if (dirty || (!reduce && now - lastPaint > every)) { paint(now); blit(); dirty = false; lastPaint = now; }
    if (!drag) { spinV *= 0.92; spin += spinV; spin *= 0.95; }
    rootG.rotation.y += (spin + px * 0.35 * A - rootG.rotation.y) * 0.12;
    rootG.rotation.x += (py * 0.16 * A - rootG.rotation.x) * 0.12;
    rootG.position.y = Math.sin(t * 1.6) * 0.02 * A;
    lvlS += (audioLevel() - lvlS) * .3;
    if (fx && fx.visible && now > fxUntil) fx.visible = false;
    if (hv) { if (hoverId) { place(hv, hoverId); hv.visible = true; } else hv.visible = false; }
    var idle = now - lastInteract > 3500;                               // pista: anillos suaves sobre los botones cuando nadie interactúa
    hints.forEach(function (m, k) { var pul = reduce ? .5 : .5 + .5 * Math.sin(t * 2.2 + k * .6); m.visible = idle; m.material.opacity = idle ? (reduce ? .12 : .04 + .26 * pul * pul) * (k > 2 ? .6 : 1) : 0; });
    zoom += ((now < zoomUntil ? (visor.clientWidth < 500 ? 1.05 : 1.13) : 1) - zoom) * 0.14;                // al tocar la consola se acerca un poco
    nudge *= 0.85; rootG.scale.setScalar(zoom * (1 - nudge * 0.02 + lvlS * 0.03 * A));
    r.render(scene3, cam);
  }
  init();
})();
