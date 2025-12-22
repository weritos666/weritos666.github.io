(function () {
  'use strict';

  if (window.__garlandfx_loaded__) return;
  window.__garlandfx_loaded__ = true;
  // guards against double init
  if (window.__garlandfx_started__ === undefined) window.__garlandfx_started__ = false;
  if (window.__garlandfx_settings_added__ === undefined) window.__garlandfx_settings_added__ = false;

  // ===== Storage keys =====
  var KEY_ENABLED = 'garlandfx_enabled';
  var KEY_MODE    = 'garlandfx_mode';     // 0 auto, 1 canvas, 2 dom
  var KEY_QUALITY = 'garlandfx_quality';  // 0 auto, 1 low, 2 medium, 3 high

  // ===== IDs =====
  var DOM_ROOT_ID     = 'lampa-garland-dom-root';
  var DOM_STYLE_ID    = 'lampa-garland-dom-style';
  var CANVAS_ROOT_ID  = 'lampa-garland-canvas-root';
  var CANVAS_STYLE_ID = 'lampa-garland-canvas-style';
  var CANVAS_ID       = 'lampa-garland-canvas';

  // ===== Icon (как у snow: через класс + css белая/цветная) =====
  var GARLAND_ICON =
    '<svg class="garlandfx-menu-icon" width="88" height="83" viewBox="0 0 88 83" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill-rule="evenodd" clip-rule="evenodd">' +
        '<path d="M8 26c10 10 22 14 36 14s26-4 36-14v6C70 42 58 46 44 46S18 42 8 32v-6z"/>' +
        '<path d="M16 44c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zm21 2c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zm21-2c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z"/>' +
        '<path d="M20 35h6v6h-6v-6zm21 0h6v6h-6v-6zm21 0h6v6h-6v-6z"/>' +
      '</g>' +
    '</svg>';

  function UA() { return (navigator.userAgent || ''); }

  function isTizen() {
    try { if (window.Lampa && Lampa.Platform && Lampa.Platform.is && Lampa.Platform.is('tizen')) return true; } catch (e) {}
    return /Tizen/i.test(UA());
  }

  function isTvDevice() {
    return /SMART-TV|Tizen|Web0S|NetCast|HbbTV|AndroidTV|BRAVIA|AFT|TV/i.test(UA());
  }

  function isMobileDevice() {
    var small = (Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 900);
    var mobileUA = /Mobile|iPhone|iPad|iPod|Android/i.test(UA());
    return small && mobileUA && !isTvDevice();
  }

  function prefersReduceMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function storageGet(key, def) {
    try { if (window.Lampa && Lampa.Storage && Lampa.Storage.get) return Lampa.Storage.get(key, def); }
    catch (e) {}
    try {
      var v = localStorage.getItem(key);
      if (v === null || typeof v === 'undefined') return def;
      return v;
    } catch (e2) {}
    return def;
  }

  function num(v, def) {
    v = Number(v);
    return isNaN(v) ? def : v;
  }

  // ======= Icon CSS (как snow) =======
  function injectGarlandIconCSS() {
    try {
      if (document.getElementById('garlandfx_menu_icon_css')) return;

      var st = document.createElement('style');
      st.id = 'garlandfx_menu_icon_css';
      st.type = 'text/css';

      st.textContent =
        '.garlandfx-menu-icon *{fill:#fff !important;}' +
        '.menu__item.select .garlandfx-menu-icon *,' +
        '.menu__item.active .garlandfx-menu-icon *,' +
        '.menu__item.hover .garlandfx-menu-icon *,' +
        '.menu__item:focus .garlandfx-menu-icon *,' +
        '.menu__item:hover .garlandfx-menu-icon *,' +
        '.menu li.focus .garlandfx-menu-icon *,' +
        '.menu li.select .garlandfx-menu-icon *{fill:currentColor !important;}';

      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  // ======= Common hide detection =======
  var state_in_player = false;

  function isElVisible(el) {
    if (!el) return false;
    try {
      var r = el.getBoundingClientRect();
      if (!r || r.width < 10 || r.height < 10) return false;

      var Wv = window.innerWidth || 1;
      var Hv = window.innerHeight || 1;
      if (r.right <= 0 || r.bottom <= 0 || r.left >= Wv || r.top >= Hv) return false;

      var cs = window.getComputedStyle ? getComputedStyle(el) : null;
      if (cs) {
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (Number(cs.opacity) === 0) return false;
      }
      return true;
    } catch (e) { return false; }
  }

  function rectAreaRatio(r) {
    var Wv = window.innerWidth || 1;
    var Hv = window.innerHeight || 1;
    var x1 = Math.max(0, r.left);
    var y1 = Math.max(0, r.top);
    var x2 = Math.min(Wv, r.right);
    var y2 = Math.min(Hv, r.bottom);
    var ww = Math.max(0, x2 - x1);
    var hh = Math.max(0, y2 - y1);
    return (ww * hh) / (Wv * Hv);
  }

  function detectPlayerOpen() {
    if (state_in_player) return true;

    var videos = document.getElementsByTagName('video');
    if (!videos || !videos.length) return false;

    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (!isElVisible(v)) continue;
      var r = v.getBoundingClientRect();
      if (rectAreaRatio(r) >= 0.25) return true;
    }
    return false;
  }

  function detectOverlayOpen() {
    var sels = [
      '.settings', '.settings__layer', '.settings-window',
      '.modal', '.dialog', '.notification',
      '[role="dialog"]', '[aria-modal="true"]',
      '.selectbox', '.selectbox__layer', '.selectbox__content', '.selectbox__body'
    ];

    for (var i = 0; i < sels.length; i++) {
      var el = null;
      try { el = document.querySelector(sels[i]); } catch (e) {}
      if (!el) continue;
      if (!isElVisible(el)) continue;

      var r = el.getBoundingClientRect();
      if (rectAreaRatio(r) < 0.10) continue;

      return true;
    }
    return false;
  }

  function shouldHideNow() {
    var h = (location.hash || '').toLowerCase();
    var byHashSettings = (h.indexOf('settings') !== -1 || h.indexOf('настройк') !== -1);
    return byHashSettings || detectOverlayOpen() || detectPlayerOpen();
  }

  // ======= Quality compute =======
  function computeQuality() {
    var q = num(storageGet(KEY_QUALITY, 0), 0) | 0;
    if (q === 1) return 'low';
    if (q === 2) return 'medium';
    if (q === 3) return 'high';

    if (isTizen() || isTvDevice() || isMobileDevice()) return 'low';
    return 'medium';
  }

  // ======= Settings UI =======
function addSettingsUI() {
  if (window.__garlandfx_settings_added__) return;
  window.__garlandfx_settings_added__ = true;

  injectGarlandIconCSS();
  if (!window.Lampa || !Lampa.SettingsApi) return;

    try {
      Lampa.SettingsApi.addComponent({
        component: 'garlandfx',
        name: 'Гирлянда',
        icon: GARLAND_ICON
      });

      Lampa.SettingsApi.addParam({
        component: 'garlandfx',
        param: {
          name: KEY_ENABLED,
          type: 'select',
          values: { 0: 'Выкл', 1: 'Вкл' },
          "default": 1
        },
        field: {
          name: 'Гирлянда на экранах',
          description: 'Главная / Фильмы / Сериалы / Категории (в плеере и оверлеях скрывается)'
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'garlandfx',
        param: {
          name: KEY_MODE,
          type: 'select',
          values: {
            0: 'Авто (рекомендовано)',
            1: 'Canvas (быстро)',
            2: 'DOM (красиво, тяжелее)'
          },
          "default": 0
        },
        field: {
          name: 'Режим отрисовки',
          description: 'Авто: на TV/Tizen/мобиле выбирает Canvas'
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'garlandfx',
        param: {
          name: KEY_QUALITY,
          type: 'select',
          values: { 0: 'Авто', 1: 'Низкое', 2: 'Среднее', 3: 'Высокое' },
          "default": 0
        },
        field: {
          name: 'Качество эффекта',
          description: 'Влияет на нагрузку и красоту. На TV/Tizen лучше Авто/Низкое'
        }
      });
    } catch (e) {}
  }

  // ======= ПЕРЕМЕЩЕНИЕ РЯДОМ СО СНЕГОМ =======
  function closestMenuItem(node) {
    if (!node) return null;
    return node.closest('.menu__item') || node.closest('li') || node.closest('.menu-item') || null;
  }

  function reorderGarlandAfterSnow() {
    // снег из snow_no_stripes.js: .snowfx-menu-icon
    var snowIcon = document.querySelector('.snowfx-menu-icon');
    var garIcon  = document.querySelector('.garlandfx-menu-icon');
    if (!snowIcon || !garIcon) return false;

    var snowItem = closestMenuItem(snowIcon);
    var garItem  = closestMenuItem(garIcon);
    if (!snowItem || !garItem) return false;

    var parent = snowItem.parentNode;
    if (!parent || parent !== garItem.parentNode) return false;

    // уже стоит сразу после снега
    if (snowItem.nextSibling === garItem) return true;

    parent.insertBefore(garItem, snowItem.nextSibling);
    return true;
  }

  var settingsMO = null;
  var reorderTimer = 0;

  function startSettingsReorderWatch() {
    if (settingsMO) return;

    // несколько попыток (меню иногда строится с задержкой)
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(reorderGarlandAfterSnow, 50);
    setTimeout(reorderGarlandAfterSnow, 250);
    setTimeout(reorderGarlandAfterSnow, 700);

    settingsMO = new MutationObserver(function () {
      // throttle
      clearTimeout(reorderTimer);
      reorderTimer = setTimeout(reorderGarlandAfterSnow, 40);
    });

    settingsMO.observe(document.body, { childList: true, subtree: true });
  }

  function stopSettingsReorderWatch() {
    if (!settingsMO) return;
    try { settingsMO.disconnect(); } catch (e) {}
    settingsMO = null;
  }

  function onHashForReorder() {
    var h = (location.hash || '').toLowerCase();
    var inSettings = (h.indexOf('settings') !== -1 || h.indexOf('настройк') !== -1);

    if (inSettings) startSettingsReorderWatch();
    else stopSettingsReorderWatch();
  }

  // ======= Renderer manager =======
  var current_renderer = null;
  var current_key = null;

  function chooseMode() {
    var enabled = num(storageGet(KEY_ENABLED, 1), 1) ? 1 : 0;
    if (!enabled) return 'off';

    if (prefersReduceMotion()) return 'canvas';

    var mode = num(storageGet(KEY_MODE, 0), 0) | 0;
    if (mode === 1) return 'canvas';
    if (mode === 2) return 'dom';

    if (isTizen() || isTvDevice() || isMobileDevice()) return 'canvas';
    return 'dom';
  }

  function applyMode() {
    var mode = chooseMode();
    var q = computeQuality();

    var key = mode + ':' + q;
    if (key === current_key) return;

    if (current_renderer && current_renderer.destroy) {
      try { current_renderer.destroy(); } catch (e) {}
    }
    current_renderer = null;
    current_key = key;

    if (mode === 'off') return;

    if (mode === 'canvas') current_renderer = createCanvasRenderer(q);
    else current_renderer = createDomRenderer(q);
  }

  // ======= DOM renderer =======
  function createDomRenderer(Q) {
    if (document.getElementById(DOM_ROOT_ID)) return { destroy: function () {} };

    var TIZEN = isTizen();
    var TV = isTvDevice();
    var MOBILE = isMobileDevice();

    var root = document.createElement('div');
    root.id = DOM_ROOT_ID;
    root.className = (TIZEN ? 'is-tizen ' : '') + (MOBILE ? 'is-mobile ' : '') + ('q-' + Q);
    document.body.appendChild(root);

    var st = document.createElement('style');
    st.id = DOM_STYLE_ID;

    st.textContent =
      '#' + DOM_ROOT_ID + '{position:fixed;left:0;top:0;width:100%;height:130px;pointer-events:none;z-index:99999;opacity:1;transition:opacity .18s ease;transform:translateZ(0);contain:layout paint;}' +
      '#' + DOM_ROOT_ID + '.hidden{opacity:0;}' +
      '#' + DOM_ROOT_ID + '.paused .bulb{animation-play-state:paused !important;box-shadow:none !important;}' +
      '#' + DOM_ROOT_ID + '.is-mobile{height:76px;overflow:hidden;padding-top:env(safe-area-inset-top);}' +
      '#' + DOM_ROOT_ID + ' .wrap{position:absolute;left:0;top:0;width:100%;height:130px;}' +
      '#' + DOM_ROOT_ID + '.is-mobile .wrap{height:76px;}' +
      '#' + DOM_ROOT_ID + ' .wire{position:absolute;left:-6%;width:112%;top:72px;height:40px;border-top:2px solid rgba(0,0,0,.45);border-radius:0 0 85% 85%;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));opacity:.95;}' +
      '#' + DOM_ROOT_ID + '.is-tizen .wire{filter:none;border-top-color:rgba(0,0,0,.38);}' +
      '#' + DOM_ROOT_ID + '.is-mobile .wire{top:36px;height:22px;border-radius:0 0 80% 80%;filter:none;}' +
      '#' + DOM_ROOT_ID + ' .bulb{position:absolute;width:14px;height:18px;border-radius:50% 50% 45% 45%;transform:translateX(-50%);background:var(--c,#ff3b30);opacity:.95;animation:blink var(--t,2.6s) ease-in-out var(--d,0s) infinite;will-change:opacity;}' +
      '#' + DOM_ROOT_ID + '.q-high .bulb{box-shadow:0 0 7px var(--c,#ff3b30),0 0 16px var(--c,#ff3b30);}' +
      '#' + DOM_ROOT_ID + '.q-medium .bulb{box-shadow:0 0 5px var(--c,#ff3b30),0 0 10px var(--c,#ff3b30);}' +
      '#' + DOM_ROOT_ID + '.q-low .bulb{box-shadow:none;}' +
      '#' + DOM_ROOT_ID + '.is-mobile .bulb{width:10px;height:12px;}' +
      '#' + DOM_ROOT_ID + ' .bulb:after{content:"";position:absolute;left:50%;top:-6px;width:12px;height:7px;transform:translateX(-50%);border-radius:4px 4px 2px 2px;background:rgba(20,20,20,.85);box-shadow:0 1px 0 rgba(255,255,255,.12) inset;}' +
      '#' + DOM_ROOT_ID + '.is-mobile .bulb:after{top:-5px;width:10px;height:6px;}' +
      '#' + DOM_ROOT_ID + ' .bulb:before{content:"";position:absolute;left:50%;top:-14px;width:2px;height:12px;transform:translateX(-50%);background:rgba(0,0,0,.65);}' +
      '#' + DOM_ROOT_ID + '.is-mobile .bulb:before{top:-10px;height:9px;}' +
      '@keyframes blink{' +
        '0%{opacity:.95;filter:brightness(1) saturate(1);}' +
        '1%,4%{opacity:0.08;filter:brightness(.22) saturate(.75);box-shadow:none;}' +
        '10%,38%{opacity:.95;filter:brightness(1) saturate(1);}' +
        '45%{opacity:.55;filter:brightness(.6) saturate(.9);box-shadow:none;}' +
        '60%{opacity:.85;filter:brightness(.9) saturate(.95);}' +
        '100%{opacity:.95;filter:brightness(1) saturate(1);}' +
      '}' +
      '@keyframes blinkTizen{' +
        '0%{opacity:.95;}' +
        '1%,4%{opacity:0.08;box-shadow:none;}' +
        '10%,38%{opacity:.95;}' +
        '45%{opacity:.55;}' +
        '60%{opacity:.85;}' +
        '100%{opacity:.95;}' +
      '}' +
      '#' + DOM_ROOT_ID + '.is-tizen .bulb{animation-name:blinkTizen;}' +
      '@media (prefers-reduced-motion: reduce){#' + DOM_ROOT_ID + ' .bulb{animation:none !important;}}';

    (document.head || document.documentElement).appendChild(st);

    root.innerHTML = '<div class="wrap"><div class="wire"></div></div>';
    var wrap = root.querySelector('.wrap');

    var COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#bf5af2', '#ff9f0a', '#64d2ff'];

    function render() {
      if (!wrap) return;

      var olds = wrap.querySelectorAll('.bulb');
      for (var k = 0; k < olds.length; k++) olds[k].remove();

      var w = Math.max(320, window.innerWidth || 1920);

      var div, maxBulbs;
      if (MOBILE) {
        div = (Q === 'low') ? 62 : (Q === 'medium') ? 48 : 42;
        maxBulbs = (Q === 'low') ? 18 : (Q === 'medium') ? 26 : 32;
      } else if (TIZEN || TV) {
        div = (Q === 'low') ? 120 : (Q === 'medium') ? 92 : 72;
        maxBulbs = (Q === 'low') ? 22 : (Q === 'medium') ? 34 : 44;
      } else {
        div = (Q === 'low') ? 92 : (Q === 'medium') ? 72 : 58;
        maxBulbs = (Q === 'low') ? 34 : (Q === 'medium') ? 48 : 70;
      }

      var count = Math.floor(w / div);
      var min = MOBILE ? 12 : 16;
      if (count < min) count = min;
      if (count > maxBulbs) count = maxBulbs;

      var spacing = w / (count - 1);

      var wireY = MOBILE ? 36 : 72;
      var sagAmp = MOBILE ? 3 : (TIZEN ? 8 : 10);
      var hang = MOBILE ? 6 : 6;

      for (var i = 0; i < count; i++) {
        var x = i * spacing;
        var t = i / (count - 1);
        var sag = Math.sin(t * Math.PI) * sagAmp;
        var y = wireY + sag + hang;

        var b = document.createElement('div');
        b.className = 'bulb';
        b.style.left = x + 'px';
        b.style.top = y + 'px';
        b.style.setProperty('--c', COLORS[i % COLORS.length]);
        b.style.setProperty('--t', (2600 + (i % 7) * 220) + 'ms'); // твои
        b.style.setProperty('--d', ((i % 9) * 140) + 'ms');        // твои

        wrap.appendChild(b);
      }
    }

    function sync() {
      root.classList.toggle('hidden', shouldHideNow());
    }

    var scrollTimer = 0;
    function onScroll() {
      root.classList.add('paused');
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { root.classList.remove('paused'); }, 180);
    }

    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        MOBILE = isMobileDevice();
        root.classList.toggle('is-mobile', MOBILE);
        render();
        sync();
      }, 120);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('hashchange', sync);

    render();
    sync();

    var poll = setInterval(sync, 650);

    return {
      destroy: function () {
        try { clearInterval(poll); } catch (e) {}
        try { window.removeEventListener('scroll', onScroll); } catch (e2) {}
        try { window.removeEventListener('resize', onResize); } catch (e3) {}
        try { window.removeEventListener('hashchange', sync); } catch (e4) {}
        try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e5) {}
        try { var s = document.getElementById(DOM_STYLE_ID); if (s && s.parentNode) s.parentNode.removeChild(s); } catch (e6) {}
      }
    };
  }

  // ======= CANVAS renderer =======
  function createCanvasRenderer(Q) {
    if (document.getElementById(CANVAS_ROOT_ID)) return { destroy: function () {} };

    var TIZEN = isTizen();
    var TV = isTvDevice();
    var MOBILE = isMobileDevice();

    var root = document.createElement('div');
    root.id = CANVAS_ROOT_ID;
    if (MOBILE) root.classList.add('is-mobile');
    document.body.appendChild(root);

    var st = document.createElement('style');
    st.id = CANVAS_STYLE_ID;
    st.textContent =
      '#' + CANVAS_ROOT_ID + '{position:fixed;left:0;top:0;width:100%;height:130px;pointer-events:none;z-index:99999;opacity:1;transition:opacity .18s ease;contain:layout paint;}' +
      '#' + CANVAS_ROOT_ID + '.hidden{opacity:0;}' +
      '#' + CANVAS_ROOT_ID + '.is-mobile{height:76px;overflow:hidden;padding-top:env(safe-area-inset-top);}' +
      '#' + CANVAS_ROOT_ID + ' canvas{display:block;width:100%;height:100%;}';
    (document.head || document.documentElement).appendChild(st);

    var canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d', { alpha: true });

    var COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#bf5af2', '#ff9f0a', '#64d2ff'];

    function dprCap() {
      if (TIZEN || TV) return 1.25;
      if (MOBILE) return 1.75;
      return 2.0;
    }

    var dpr = 1;
    var bulbs = [];
    var spritesGlow = {};
    var spritesNoGlow = {};
    var rafId = 0;
    var pausedUntil = 0;

    function bulbPeriod(i) { return (2600 + (i % 7) * 220); }
    function bulbDelay(i) { return ((i % 9) * 140); }

    function colorToRgba(hex, a) {
      var r = 255, g = 255, b = 255;
      if (hex && hex.length === 7 && hex.charAt(0) === '#') {
        r = parseInt(hex.substr(1, 2), 16);
        g = parseInt(hex.substr(3, 2), 16);
        b = parseInt(hex.substr(5, 2), 16);
      }
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function roundRect(c, x, y, w, h, r) {
      var rr = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }

    function blinkState(p) {
      function lerp(a, b, t) { return a + (b - a) * t; }

      if (p >= 0.01 && p <= 0.04) return { a: 0.08, g: 0.0 };
      if (p > 0.04 && p < 0.10) {
        var t1 = (p - 0.04) / 0.06;
        return { a: lerp(0.08, 0.95, t1), g: lerp(0.0, 1.0, t1) };
      }
      if (p >= 0.10 && p <= 0.38) return { a: 0.95, g: 1.0 };
      if (p > 0.38 && p < 0.45) {
        var t2 = (p - 0.38) / 0.07;
        return { a: lerp(0.95, 0.45, t2), g: lerp(1.0, 0.15, t2) };
      }
      if (p >= 0.45 && p < 0.60) {
        var t3 = (p - 0.45) / 0.15;
        return { a: lerp(0.45, 0.85, t3), g: lerp(0.15, 0.85, t3) };
      }
      return { a: 0.95, g: 1.0 };
    }

    function drawBulbBody(c, cx, cy, size, color) {
      c.save();
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(cx, cy, size * 0.90, size * 1.18, 0, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = 'rgba(255,255,255,0.20)';
      c.beginPath();
      c.ellipse(cx - size * 0.18, cy - size * 0.15, size * 0.20, size * 0.32, -0.2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    function makeBulbSprite(color, size, glowStrength) {
      var s = Math.ceil(size * 3.2);
      var c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      var g = c.getContext('2d');
      var cx = s / 2;
      var cy = s / 2 + size * 0.10;

      if (glowStrength > 0) {
        var r = size * 1.6;
        var gr = g.createRadialGradient(cx, cy, size * 0.2, cx, cy, r);
        gr.addColorStop(0, 'rgba(255,255,255,' + (0.08 * glowStrength) + ')');
        gr.addColorStop(0.25, colorToRgba(color, 0.30 * glowStrength));
        gr.addColorStop(1, colorToRgba(color, 0.0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
      }

      drawBulbBody(g, cx, cy, size, color);
      return c;
    }

    function rebuildSprites(size) {
      spritesGlow = {};
      spritesNoGlow = {};

      var glow = (Q === 'low') ? ((TIZEN || TV) ? 0.35 : 0.55) : (Q === 'medium') ? 0.75 : 1.0;

      for (var i = 0; i < COLORS.length; i++) {
        var col = COLORS[i];
        spritesGlow[col] = makeBulbSprite(col, size, glow);
        spritesNoGlow[col] = makeBulbSprite(col, size, 0.0);
      }
    }

    function getBulbCount(w) {
      var div, maxBulbs;
      if (MOBILE) {
        div = (Q === 'low') ? 58 : (Q === 'medium') ? 48 : 42;
        maxBulbs = (Q === 'low') ? 18 : (Q === 'medium') ? 24 : 30;
      } else if (TIZEN || TV) {
        div = (Q === 'low') ? 100 : (Q === 'medium') ? 92 : 72;
        maxBulbs = (Q === 'low') ? 28 : (Q === 'medium') ? 32 : 44;
      } else {
        div = (Q === 'low') ? 92 : (Q === 'medium') ? 72 : 58;
        maxBulbs = (Q === 'low') ? 34 : (Q === 'medium') ? 44 : 60;
      }

      var count = Math.floor(w / div);
      var min = MOBILE ? 12 : 16;
      if (count < min) count = min;
      if (count > maxBulbs) count = maxBulbs;
      return count;
    }

    function setupCanvasSize() {
      MOBILE = isMobileDevice();
      root.classList.toggle('is-mobile', MOBILE);

      var cap = dprCap();
      var real = (window.devicePixelRatio || 1);
      dpr = Math.min(cap, real);

      var w = Math.max(320, window.innerWidth || 1920);
      var h = MOBILE ? 76 : ((TIZEN || TV) ? 96 : 130);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildBulbs(w);
    }

    function buildBulbs(w) {
      bulbs = [];

      var count = getBulbCount(w);
	  var wireY  = MOBILE ? 36 : ((TIZEN || TV) ? 36 : 72);
	  var sagAmp = MOBILE ? 2  : ((TIZEN || TV) ? ((Q === 'low') ? 3 : 4) : ((Q === 'low') ? 6 : 10));
	  var hang   = MOBILE ? 1  : ((TIZEN || TV) ? ((Q === 'low') ? 3 : 4) : ((Q === 'low') ? 4 : 6));

      var size = MOBILE ? 5 : 7;
      if (Q === 'high') size = MOBILE ? 6 : 8;

      rebuildSprites(size);

      for (var i = 0; i < count; i++) {
        var t = (count <= 1) ? 0 : (i / (count - 1));
        bulbs.push({
          i: i,
          t: t,
          color: COLORS[i % COLORS.length],
          period: bulbPeriod(i),
          delay: bulbDelay(i),
          wireY: wireY,
          sagAmp: sagAmp,
          hang: hang,
          size: size
        });
      }
    }

    function drawWire(w) {
	var wireY  = MOBILE ? 36 : ((TIZEN || TV) ? 36 : 72);
	var sagAmp = MOBILE ? 2  : ((TIZEN || TV) ? ((Q === 'low') ? 3 : 4) : ((Q === 'low') ? 6 : 10));

      ctx.save();
      ctx.lineWidth = MOBILE ? 1.5 : 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.40)';
      ctx.beginPath();

      var count = bulbs.length;
      for (var i = 0; i < count; i++) {
        var b = bulbs[i];
        var x = b.t * w;
        var sag = Math.sin(b.t * Math.PI) * sagAmp;
        var y = wireY + sag;

        if (i === 0) ctx.moveTo(x, y);
        else {
          var prev = bulbs[i - 1];
          var px = prev.t * w;
          var psag = Math.sin(prev.t * Math.PI) * sagAmp;
          var py = wireY + psag;

          var mx = (px + x) / 2;
          var my = (py + y) / 2;

          ctx.quadraticCurveTo(px, py, mx, my);
          if (i === count - 1) ctx.quadraticCurveTo(x, y, x, y);
        }
      }

      ctx.stroke();
      ctx.restore();
    }

function drawBulb(b, w, now) {
  var x = b.t * w;

  var sag = Math.sin(b.t * Math.PI) * b.sagAmp;
  var wireY = b.wireY + sag;
  var offset = MOBILE ? (b.size * 2.0) : ((TIZEN || TV) ? (b.size * 1.9) : (b.size * 1.6));
  var y = wireY + b.hang + offset;

  var local = (now + b.delay) % b.period;
  var p = local / b.period;
  var stt = blinkState(p);

  ctx.save();

  var socketTop = y - b.size * 2.15;

  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(x, wireY - 2);
  ctx.lineTo(x, socketTop);
  ctx.stroke();

  // socket
  ctx.fillStyle = 'rgba(20,20,20,0.85)';
  roundRect(ctx, x - (b.size * 0.75), socketTop, b.size * 1.5, b.size * 0.9, 3);
  ctx.fill();

  var sprite = (stt.g > 0.05) ? spritesGlow[b.color] : spritesNoGlow[b.color];
  ctx.globalAlpha = stt.a;

  var sw = sprite.width;
  var sh = sprite.height;
  ctx.drawImage(sprite, x - sw / 2, y - sh / 2);

  ctx.restore();
}

    function clearAll(w, h) {
      ctx.clearRect(0, 0, w, h);
    }

    var lastHidden = false;

    function tick() {
      var w = Math.max(320, window.innerWidth || 1920);
      var h = MOBILE ? 76 : 130;

      var hidden = shouldHideNow();
      root.classList.toggle('hidden', hidden);

      if (hidden) {
        if (!lastHidden) {
          clearAll(w, h);
          lastHidden = true;
        }
        scheduleNext(500);
        return;
      }

      lastHidden = false;

      var now = Date.now();
      if (now < pausedUntil) {
        scheduleNext(120);
        return;
      }

      clearAll(w, h);
      drawWire(w);
      for (var i = 0; i < bulbs.length; i++) drawBulb(bulbs[i], w, now);

      var next = (Q === 'low' && (TV || TIZEN || MOBILE)) ? 42 : 16;
      scheduleNext(next);
    }

    function scheduleNext(ms) {
      if (rafId) cancelAnimationFrame(rafId);
      setTimeout(function () { rafId = requestAnimationFrame(tick); }, ms);
    }

    var scrollTimer = 0;
    function onScroll() {
      pausedUntil = Date.now() + 200;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { pausedUntil = 0; }, 240);
    }

    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { setupCanvasSize(); }, 120);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    setupCanvasSize();
    scheduleNext(50);

    return {
      destroy: function () {
        try { if (rafId) cancelAnimationFrame(rafId); } catch (e) {}
        try { window.removeEventListener('scroll', onScroll); } catch (e2) {}
        try { window.removeEventListener('resize', onResize); } catch (e3) {}
        try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e4) {}
        try { var s = document.getElementById(CANVAS_STYLE_ID); if (s && s.parentNode) s.parentNode.removeChild(s); } catch (e5) {}
      }
    };
  }

  // ======= Lampa hooks (player) =======
  function bindLampaHooks() {
    if (!window.Lampa) return;
    try {
      if (Lampa.Player && Lampa.Player.listener && Lampa.Player.listener.follow) {
        Lampa.Player.listener.follow('start', function () { state_in_player = true; });
        Lampa.Player.listener.follow('destroy', function () { state_in_player = false; });
      }
    } catch (e) {}
  }

  // ======= Boot =======
  if (window.__garlandfx_started__) return;
  window.__garlandfx_started__ = true;
  function start() {
    addSettingsUI();
    bindLampaHooks();

    // включаем “держать рядом со снегом”
    window.addEventListener('hashchange', onHashForReorder);
    onHashForReorder(); // если настройки уже открыты

    applyMode();

    var last_enabled = null;
    var last_mode = null;
    var last_quality = null;

    setInterval(function () {
      var en = num(storageGet(KEY_ENABLED, 1), 1) | 0;
      var mo = num(storageGet(KEY_MODE, 0), 0) | 0;
      var qu = num(storageGet(KEY_QUALITY, 0), 0) | 0;

      if (en !== last_enabled || mo !== last_mode || qu !== last_quality) {
        last_enabled = en;
        last_mode = mo;
        last_quality = qu;
        applyMode();
      }

      // если в настройках — периодически пробуем ещё раз (на случай ленивой отрисовки меню)
      var h = (location.hash || '').toLowerCase();
      if (h.indexOf('settings') !== -1 || h.indexOf('настройк') !== -1) {
        reorderGarlandAfterSnow();
      }
    }, 700);
  }

  function startWhenReady() {
    if (document.body && document.head) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  if (window.Lampa && window.Lampa.Listener && typeof window.Lampa.Listener.follow === 'function') {
    Lampa.Listener.follow('app', function (e) {
      if (e && e.type === 'ready') startWhenReady();
    });
    setTimeout(startWhenReady, 1200);
  } else {
    startWhenReady();
  }
})();
