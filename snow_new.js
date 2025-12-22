(function () {
  'use strict';

  if (window.__snowfx_loaded__) return;
  window.__snowfx_loaded__ = true;

  var KEY_ENABLED = 'snowfx_enabled';
  var KEY_DENSITY = 'snowfx_density'; // 0 auto, 1 low, 2 mid, 3 high
  var KEY_SETTLE  = 'snowfx_settle';  // 0 off, 1 on
  var KEY_SIZE    = 'snowfx_flake_size'; // 0 auto, 1 small, 2 medium, 3 large, 4 huge
  var KEY_SETTLE_SPEED = 'snowfx_settle_speed'; // 0 auto, 1 slow, 2 medium, 3 fast
  var KEY_FALL_SPEED = 'snowfx_fall_speed'; // 0 auto, 1 slow, 2 medium, 3 fast
  var KEY_SHAKE   = 'snowfx_shake';   // 0 off, 1 on (shake to clear on mobile)
  var KEY_FLAKE   = 'snowfx_flake_style'; // 0 auto, 1 dots, 2 flakes, 3 mixed
  var KEY_IN_CARD = 'snowfx_in_card'; // 0 off, 1 on (details/card screen)
  // Menu icon (filled), behaves like native icons (color inherits from menu item)
  var SNOW_ICON =
    '<svg class="snowfx-menu-icon" width="88" height="83" viewBox="0 0 88 83" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">' +
        // Вертикальная ось (толще)
        '<path d="M40 7H48V76H40Z"/>' +
        // Горизонтальная ось (толще)
        '<path d="M10 37H78V45H10Z"/>' +
        // Диагонали (толщина уже норм, чуть расширены)
        '<path d="M19.8 22.2L26.2 15.8L68.2 57.8L61.8 64.2Z"/>' +
        '<path d="M61.8 15.8L68.2 22.2L26.2 64.2L19.8 57.8Z"/>' +
        // Наконечники (чтобы визуально "полней" как у других иконок)
        '<path d="M34 10H54V18H34Z"/>' +
        '<path d="M34 65H54V73H34Z"/>' +
        '<path d="M12 31H20V51H12Z"/>' +
        '<path d="M68 31H76V51H68Z"/>' +
      '</g>' +
    '</svg>';



  // --- platform detect ---
  function isTizen() {
    try { if (window.Lampa && Lampa.Platform && Lampa.Platform.is && Lampa.Platform.is('tizen')) return true; } catch (e) {}
    return /Tizen/i.test(navigator.userAgent || '');
  }

  function isAndroid() {
    try { if (window.Lampa && Lampa.Platform && Lampa.Platform.is && Lampa.Platform.is('android')) return true; } catch (e) {}
    return /Android/i.test(navigator.userAgent || '');
  }

  function isMobileUA() {
    var ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }

  function isDesktop() {
    return !isMobileUA() && !isTizen();
  }

  function prefersReduceMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function storageGet(key, def) {
    try { if (window.Lampa && Lampa.Storage && Lampa.Storage.get) return Lampa.Storage.get(key, def); }
    catch (e) {}
    return def;
  }

  function num(v, def) {
    v = Number(v);
    return isNaN(v) ? def : v;
  }

function isElVisible(el) {
  if (!el) return false;

  try {
    var r = el.getBoundingClientRect();
    if (!r || r.width < 10 || r.height < 10) return false;

    var Wv = window.innerWidth || 1;
    var Hv = window.innerHeight || 1;

    // обязательно пересечение с вьюпортом (важно для "уехавших" панелей)
    if (r.right <= 0 || r.bottom <= 0 || r.left >= Wv || r.top >= Hv) return false;

    var cs = window.getComputedStyle ? getComputedStyle(el) : null;
    if (cs) {
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (Number(cs.opacity) === 0) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

  // --- overlay detection (настройки/меню/модалки) ---
  // цель: НЕ перекрывать настройки — просто гасим снег пока открыт оверлей
 function detectOverlayOpen() {
  var Wv = window.innerWidth || 1;
  var Hv = window.innerHeight || 1;
  var viewArea = Wv * Hv;

  // кандидаты (настройки/модалки)
  var sels = [
    '.settings',
    '.settings__content',
    '.settings__layer',
    '.settings-window',
    '.modal',
    '.dialog',
    '.selectbox',
    '.notification'];

  function intersectsEnough(r) {
    // считаем площадь пересечения с вьюпортом
    var x1 = Math.max(0, r.left);
    var y1 = Math.max(0, r.top);
    var x2 = Math.min(Wv, r.right);
    var y2 = Math.min(Hv, r.bottom);
    var w = Math.max(0, x2 - x1);
    var h = Math.max(0, y2 - y1);
    var a = w * h;

    // оверлей должен занимать заметную часть экрана
    return a > (viewArea * 0.08); // 8% и выше
  }

  function coversPoint(el) {
    // проверяем, что элемент реально "сверху" (через elementFromPoint)
    try {
      var r = el.getBoundingClientRect();

      // берём точку внутри видимой части элемента
      var px = Math.min(Wv - 2, Math.max(2, (r.left + r.right) / 2));
      var py = Math.min(Hv - 2, Math.max(2, (r.top + r.bottom) / 2));

      var topEl = document.elementFromPoint(px, py);
      if (!topEl) return false;

      return el === topEl || (el.contains && el.contains(topEl));
    } catch (e) {
      return false;
    }
  }

  for (var i = 0; i < sels.length; i++) {
    var el = null;
    try { el = document.querySelector(sels[i]); } catch (e1) {}
    if (!el) continue;
    if (!isElVisible(el)) continue;

    var r = null;
    try { r = el.getBoundingClientRect(); } catch (e2) { r = null; }
    if (!r) continue;

    if (!intersectsEnough(r)) continue;
    if (!coversPoint(el)) continue;

    return true;
  }

  return false;
}

  // --- где показывать снег (главная + фильмы/сериалы + категории) ---
  var ALLOWED_COMPONENTS = {
    main: 1, home: 1, start: 1,
    cub: 1,
    movies: 1, movie: 1,
    tv: 1, series: 1, serial: 1, serials: 1,
    tvshow: 1, tvshows: 1,
    category: 1, categories: 1,
    catalog: 1,
    genre: 1, genres: 1
  };

  // --- activity name for details/card screen ---
  // В разных сборках Lampa карточка фильма/сериала может иметь component: "full" (чаще всего),
  // либо другие варианты. Держим отдельный список, чтобы корректно включать снег по опции.
  var DETAILS_COMPONENTS = {
    full: 1,
    details: 1,
    detail: 1,
    card: 1,
    info: 1
  };

  function isDetailsActivity(e) {
    var c = (e && (e.component || (e.object && e.object.component))) || '';
    return !!DETAILS_COMPONENTS[c];
  }


  function isAllowedActivity(e) {
    var c = (e && (e.component || (e.object && e.object.component))) || '';
    return !!ALLOWED_COMPONENTS[c];
  }

  // --- details/card screen detect (страница карточки фильма/сериала) ---
  function isDetailsScreen() {
    try {
      // Карточка фильма/сериала (детали). Классы могут немного отличаться между версиями/темами,
      // поэтому проверяем несколько устойчивых элементов "шапки" и блока действий.
      return !!document.querySelector(
        '.full, .full-start, .full-start__poster, .full-start__title,' +
        ' .full-start__head, .full-start__body, .full-start__buttons, .full-start__actions,' +
        ' .full__body, .full__head, .full__left, .full__right,' +
        ' .full__poster, .full__title, .full__buttons, .full__actions,' +
        ' .full__descr, .full__tagline, .full__info, .full__meta'
      );
    } catch (e) {
      return false;
    }
  }

  // --- state from Lampa ---
  var on_allowed_screen = true; // если нет событий — считаем "разрешённый экран"
  var in_player = false;
  var overlay_open = false;
  var in_details_activity = false;

  // Реальное определение плеера (фоллбек, когда события start/destroy не приходят)
  function detectActuallyInPlayer() {
    // HTML5 video (внутренний плеер)
    try {
      var vids = document.getElementsByTagName('video');
      for (var i = 0; i < vids.length; i++) {
        var v = vids[i];
        if (!v) continue;
        if (typeof v.paused === 'boolean') {
          if (!v.paused && !v.ended) return true;
        }
      }
    } catch (e1) {}

    // контейнеры плеера (на разных платформах/сборках)
    try {
      var el = document.querySelector('.player, .player__content, .player__video, .player__layer, .player-layer, .video-player');
      if (el && isElVisible(el)) return true;
    } catch (e2) {}

    return false;
  }

  // --- config ---
  function getTargetByDensity(density, platform) {
    if (platform === 'tizen') return 45; // фиксируем как просили

    if (platform === 'android') {
      if (density === 1) return 120;
      if (density === 2) return 180;
      if (density === 3) return 240;
      return 200;
    }

    if (platform === 'desktop') {
      if (density === 1) return 170;
      if (density === 2) return 240;
      if (density === 3) return 310;
      return 270;
    }

    if (density === 1) return 90;
    if (density === 2) return 130;
    if (density === 3) return 190;
    return 120;
  }

  // Размер снежинок (независимо от вида)
  // На Tizen "Авто" чуть меньше для снижения нагрузки.
  function getSizeMult(size, platform) {
    // 0 auto, 1 small, 2 medium, 3 large, 4 huge
    if (platform === 'tizen') {
      // На ТВ лучше не раздувать спрайты
      if (size === 0) return 0.85;
      if (size === 1) return 0.75;
      if (size === 2) return 0.90;
      // large/huge принудительно ограничиваем
      return 0.95;
    }

    if (size === 1) return 0.75;
    if (size === 2) return 1.00;
    if (size === 3) return 1.30;
    if (size === 4) return 1.60;
    return 1.00;
  }

  // Скорость оседания (интенсивность накопления)
  // 0 auto, 1 slow, 2 medium, 3 fast
  function getSettleIntensity(speed, platform) {
    // На Tizen оседание всё равно выключено, но пусть будет безопасное значение
    if (platform === 'tizen') return 0.0;
    if (speed === 1) return 0.60;
    if (speed === 2) return 1.00;
    if (speed === 3) return 1.55;
    // auto
    return 1.00;
  }


  // Скорость падения снежинок (умножитель скорости vy)
  // 0 auto, 1 slow, 2 medium, 3 fast
  function getFallSpeedMult(speed, platform) {
    // Скорость почти не влияет на нагрузку, но на ТВ избегаем слишком "быстрого" эффекта
    if (platform === 'tizen') {
      if (speed === 1) return 0.75;
      if (speed === 2) return 0.95;
      if (speed === 3) return 1.10;
      return 0.95; // auto
    }

    if (speed === 1) return 0.75;
    if (speed === 2) return 1.00;
    if (speed === 3) return 1.35;
    return 1.00; // auto
  }

  function computeConfig() {
    var tizen = isTizen();
    var android = isAndroid();
    var desktop = isDesktop();

    var density = num(storageGet(KEY_DENSITY, 0), 0) | 0;
    if (density < 0) density = 0;
    if (density > 3) density = 3;

    // Оседание: по умолчанию Вкл на Android/ПК, Выкл на Tizen
    var settleDefault = tizen ? 0 : 1;
    var settle = num(storageGet(KEY_SETTLE, settleDefault), settleDefault) ? 1 : 0;

    // Тип снежинок: 0 авто, 1 точки, 2 снежинки, 3 смешанные
    var flakeDefault = 0;
    var flake_style = num(storageGet(KEY_FLAKE, flakeDefault), flakeDefault) | 0;
    if (flake_style < 0) flake_style = 0;
    if (flake_style > 3) flake_style = 3;
    if (tizen && flake_style === 0) flake_style = 1;
    var platform = tizen ? 'tizen' : (android ? 'android' : (desktop ? 'desktop' : 'other'));
    var flakesCount = getTargetByDensity(density, platform);

    var fps = tizen ? 22 : (android ? 50 : 60);

    // На Tizen при выборе "Снежинки/Смешанные" уменьшаем нагрузку
    if (tizen && (flake_style === 2 || flake_style === 3)) {
      fps = 18;
      flakesCount = Math.min(flakesCount, 28);
    }

    // Снег в карточке (детали)
    var inCardDefault = 0;
    var in_card = num(storageGet(KEY_IN_CARD, inCardDefault), inCardDefault) ? 1 : 0;

    // Размер снежинок
    var sizeDefault = 0;
    var flake_size = num(storageGet(KEY_SIZE, sizeDefault), sizeDefault) | 0;
    if (flake_size < 0) flake_size = 0;
    if (flake_size > 4) flake_size = 4;

    // Скорость оседания
    var settleSpeedDefault = 0;
    var settle_speed = num(storageGet(KEY_SETTLE_SPEED, settleSpeedDefault), settleSpeedDefault) | 0;
    if (settle_speed < 0) settle_speed = 0;
    if (settle_speed > 3) settle_speed = 3;
    // Скорость падения снежинок
    var fallSpeedDefault = 0;
    var fall_speed = num(storageGet(KEY_FALL_SPEED, fallSpeedDefault), fallSpeedDefault) | 0;
    if (fall_speed < 0) fall_speed = 0;
    if (fall_speed > 3) fall_speed = 3;


    // На Tizen принудительно ограничиваем тяжёлые варианты размера
    if (tizen && flake_size >= 3) flake_size = 2;

    return {
      tizen: tizen,
      flakes: flakesCount,
      fps: fps,
      settle: settle,
      flake_style: flake_style,
      in_card: in_card,
      flake_size: flake_size,
      settle_speed: settle_speed,
      fall_speed: fall_speed,
      size_mult: getSizeMult(flake_size, platform),
      fall_mult: getFallSpeedMult(fall_speed, platform),
      settle_intensity: getSettleIntensity(settle_speed, platform)
    };
  }

  function shouldRunNow() {
    var enabled = num(storageGet(KEY_ENABLED, 1), 1) ? 1 : 0;
    if (!enabled) return false;
    if (in_player) return false;
    if (overlay_open) return false;      // ключевой фикс: не перекрывать настройки

    // карточка фильма/сериала (детали)
    // В некоторых сборках карточка приходит как "неразрешённая activity",
    // поэтому для неё делаем отдельное правило:
    // - если в настройках включено "Снег в карточке" → показываем
    // - если выключено → не показываем
    var details = in_details_activity || isDetailsScreen();
    if (details) return !!cfg_in_card;

    if (!on_allowed_screen) return false;
    return true;
  }

  // --- canvases ---
  var fallCanvas = null, fallCtx = null;
  var accCanvas  = null, accCtx  = null;

  var W = 0, H = 0, dpr = 1;
  var spriteDot = null;
  var spritesFall = null;

  var flakes = [];
  var running = false;
  var rafId = 0;
  var lastTs = 0;

  // applied cfg
  var cfg_tizen = false;
  var cfg_fps = 30;
  var cfg_flakes = 80;
  var cfg_settle = 0;
  var cfg_settle_user = 0; // user setting (before runtime overrides)
  var cfg_flake_style = 0;
  var cfg_in_card = 0;
  var cfg_size_mult = 1.0;
  var cfg_fall_mult = 1.0;
  var cfg_settle_intensity = 1.0;

  // settle surfaces
  var surfaces = [];
  var surfTimer = 0;
  var capObserver = null;
  var resetTimer = 0;
  var fadeRaf = 0;

function stopFade() {
  if (fadeRaf) cancelAnimationFrame(fadeRaf);
  fadeRaf = 0;
}

// очистка накопленного снега/таймеров (используем при выключении оседания, например в карточке)
function clearAccumulationRuntime(reason) {
  stopFade();
  try { if (surfTimer) { clearTimeout(surfTimer); surfTimer = 0; } } catch (e1) {}
  try { if (resetTimer) { clearTimeout(resetTimer); resetTimer = 0; } } catch (e2) {}
  surfaces = [];
  try { if (accCtx) accCtx.clearRect(0, 0, W, H); } catch (e3) {}
  try { stopCaps(); } catch (e4) {}
}

// мгновенный сброс (для resize/смены экранов/настроек)
function resetAccumulationHard(reason) {
  if (cfg_tizen || !cfg_settle) return;
  if (!accCtx) return;

  stopFade();

    // если эффект выключен — не слушаем датчики
    if (!running || !shake_enabled) stopMotion();

  try { accCtx.clearRect(0, 0, W, H); } catch (e) {}
  surfaces = [];

  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(function () {
    resetTimer = 0;
    buildSurfaces();
  }, 180);
}

// плавный сброс (для прокрутки)
function resetAccumulationSoft(reason) {
  if (cfg_tizen || !cfg_settle) return;
  if (!accCtx) return;

  if (fadeRaf) return; // уже затухаем

  var start = (window.performance && performance.now) ? performance.now() : Date.now();
  var duration = 320;

  function step() {
    if (!accCtx) { stopFade(); return; }

    // вымываем альфу у уже нарисованного
    accCtx.save();
    accCtx.globalCompositeOperation = 'destination-out';
    accCtx.fillStyle = 'rgba(0,0,0,0.22)'; // скорость исчезновения
    accCtx.fillRect(0, 0, W, H);
    accCtx.restore();

    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (now - start < duration) {
      fadeRaf = requestAnimationFrame(step);
    } else {
      stopFade();
      try { accCtx.clearRect(0, 0, W, H); } catch (e) {}
      surfaces = [];

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        resetTimer = 0;
        buildSurfaces();
      }, 160);
    }
  }

  fadeRaf = requestAnimationFrame(step);
}
  function rand(min, max) { return min + Math.random() * (max - min); }

  function makeSprite() {
    if (spritesFall && spriteDot) return;

    // --- dot sprite (for very small flakes + accumulation) ---
    var cd = document.createElement('canvas');
    cd.width = 16;
    cd.height = 16;
    var dctx = cd.getContext('2d');
    dctx.clearRect(0, 0, 16, 16);
    dctx.fillStyle = 'rgba(255,255,255,1)';
    dctx.beginPath();
    dctx.arc(8, 8, 6.2, 0, Math.PI * 2, false);
    dctx.fill();
    spriteDot = cd;

    function makeSnowflakeSprite(variant) {
      var c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);

      // небольшая мягкость, как у "настоящих" снежинок
      ctx.shadowColor = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = variant === 3 ? 1.2 : 0.8;

      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // чем выше variant — тем "плотнее" снежинка
      ctx.lineWidth = variant === 1 ? 3.0 : (variant === 2 ? 3.8 : 4.6);

      var cx = 32, cy = 32;
      var R = 22;

      function line(x1,y1,x2,y2){
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
      }

      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3;
        var ca = Math.cos(a), sa = Math.sin(a);

        // основная "спица"
        line(cx, cy, cx + ca * R, cy + sa * R);

        // веточки ближе к центру
        var b1 = R * 0.55;
        var br1 = R * 0.22;
        var bx1 = cx + ca * b1;
        var by1 = cy + sa * b1;

        var a1 = a + Math.PI / 6;
        var a2 = a - Math.PI / 6;

        line(bx1, by1, bx1 + Math.cos(a1) * br1, by1 + Math.sin(a1) * br1);
        line(bx1, by1, bx1 + Math.cos(a2) * br1, by1 + Math.sin(a2) * br1);

        // дополнительные веточки (для более "богатых" вариантов)
        if (variant >= 2) {
          var b2 = R * 0.78;
          var br2 = R * 0.18;
          var bx2 = cx + ca * b2;
          var by2 = cy + sa * b2;

          line(bx2, by2, bx2 + Math.cos(a1) * br2, by2 + Math.sin(a1) * br2);
          line(bx2, by2, bx2 + Math.cos(a2) * br2, by2 + Math.sin(a2) * br2);
        }

        // маленький "зубчик" на конце
        if (variant === 3) {
          var tipx = cx + ca * R;
          var tipy = cy + sa * R;
          var px = -sa, py = ca;
          line(tipx - px * 2.2, tipy - py * 2.2, tipx + px * 2.2, tipy + py * 2.2);
        }
      }

      // центр
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.arc(cx, cy, variant === 1 ? 2.2 : 2.6, 0, Math.PI * 2, false);
      ctx.fill();

      ctx.shadowBlur = 0;

      return c;
    }

    spritesFall = [];
    // 0: точки, 1..3: снежинки
    spritesFall[0] = spriteDot;
    spritesFall[1] = makeSnowflakeSprite(1);
    spritesFall[2] = makeSnowflakeSprite(2);
    spritesFall[3] = makeSnowflakeSprite(3);
  }


  function ensureCanvases() {
    if (!document.body) return;

    if (!fallCanvas) {
      makeSprite();

      fallCanvas = document.createElement('canvas');
      fallCanvas.id = 'snowfx_fall';
      fallCanvas.style.cssText =
        'position:fixed;left:0;top:0;width:100%;height:100%;' +
        'pointer-events:none;z-index:999999;';

      document.body.appendChild(fallCanvas);
      fallCtx = fallCanvas.getContext('2d', { alpha: true });
    }

    if (!accCanvas) {
      accCanvas = document.createElement('canvas');
      accCanvas.id = 'snowfx_acc';
      accCanvas.style.cssText =
        'position:fixed;left:0;top:0;width:100%;height:100%;' +
        'pointer-events:none;z-index:999998;';

      document.body.appendChild(accCanvas);
      accCtx = accCanvas.getContext('2d', { alpha: true });
    }

    resize();
  }

  function removeCanvases() {
    stopFade();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    try { window.removeEventListener('resize', resize, false); } catch (e) {}

    if (fallCanvas && fallCanvas.parentNode) fallCanvas.parentNode.removeChild(fallCanvas);
    if (accCanvas && accCanvas.parentNode)  accCanvas.parentNode.removeChild(accCanvas);

    fallCanvas = null; fallCtx = null;
    accCanvas = null;  accCtx = null;

    flakes = [];
    surfaces = [];
    running = false;
    lastTs = 0;

    stopCaps();

    // экономим батарею на мобилках
    stopMotion();
  }

  function resize() {
    if (!fallCanvas || !fallCtx || !accCanvas || !accCtx) return;

    dpr = cfg_tizen ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    W = Math.max(1, window.innerWidth || 1);
    H = Math.max(1, window.innerHeight || 1);

    fallCanvas.width = (W * dpr) | 0;
    fallCanvas.height = (H * dpr) | 0;
    accCanvas.width = (W * dpr) | 0;
    accCanvas.height = (H * dpr) | 0;

    fallCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    accCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // при ресайзе лучше сбрасывать оседание, чтобы не "съезжало"
    resetAccumulationHard('resize');
  }

  // --- flakes ---
  function spawnFlake() {
    // style: 0 авто, 1 точки, 2 снежинки, 3 смешанные (поровну)
    var style = cfg_flake_style | 0;
    if (cfg_tizen && style === 0) style = 1;

    var fancy = false;
    var k = 0;

    if (style === 1) {
      fancy = false;
      k = 0;
    }
    else if (style === 2) {
      fancy = true;
      k = 1 + ((Math.random() * 3) | 0);
    }
    else if (style === 3) {
      fancy = Math.random() < 0.5;
      k = fancy ? (1 + ((Math.random() * 3) | 0)) : 0;
    }
    else {
      // 0 = точка, 1..3 = "настоящая" снежинка
      fancy = (Math.random() < (isMobileUA() ? 0.72 : 0.62));
      k = fancy ? (1 + ((Math.random() * 3) | 0)) : 0;
    }

    // размер: точки мелкие, снежинки крупнее (чуть увеличили)
    // + пользовательский множитель размера (независимо от вида)
    var r = fancy ? rand(2.7, 6.6) : rand(1.0, 2.7);
    r = r * (cfg_size_mult || 1);
    // защита от слишком больших значений
    if (r < 0.6) r = 0.6;
    if (!cfg_tizen && r > 12) r = 12;
    if (cfg_tizen && r > 5.2) r = 5.2;

    // большие снежинки падают чуть медленнее
    var vy1 = cfg_tizen ? 0.45 : (fancy ? 0.22 : 0.55);
    var vy2 = cfg_tizen ? 1.25 : (fancy ? 1.05 : 1.55);

    return {
      k: k,
      x: rand(0, W),
      y: rand(-H, 0),
      r: r,
      vy: rand(vy1, vy2) * (cfg_fall_mult || 1),
      vx: rand(cfg_tizen ? -0.20 : -0.30, cfg_tizen ? 0.20 : 0.30),
      a: rand(0.35, 0.95)
    };
  }


  function applyFlakeCount(target) {
    target = Math.max(0, target | 0);

    if (flakes.length > target) {
      flakes.length = target;
      return;
    }
    while (flakes.length < target) flakes.push(spawnFlake());
  }

  // --- poster/card detection (чтобы не цеплять настройки и мелкие элементы) ---
  function looksLikePoster(el) {
    if (!el) return false;

    try {
      var r = el.getBoundingClientRect();
      if (!r || r.width < 90 || r.height < 90) return false;

      // если внутри есть крупная картинка — почти наверняка карточка
      if (el.querySelector) {
        var img = el.querySelector('img');
        if (img) {
          var ir = img.getBoundingClientRect();
          if (ir && ir.width > 70 && ir.height > 70) return true;
        }
      }

      // или фон-картинка (часто в Лампе постер — background-image)
      var cs = window.getComputedStyle ? getComputedStyle(el) : null;
      if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    } catch (e) {}

    return false;
  }

  function getCardElements() {
    var list = [];
    // более точные селекторы, но оставляем несколько для совместимости
    var sels = [
      '.card__view',
      '.items__item .card__view',
      '.full-start__poster',
      '.card',
      '[data-card]',
      '[data-type="card"]'
    ];

    for (var i = 0; i < sels.length; i++) {
      try {
        var nodes = document.querySelectorAll(sels[i]);
        if (nodes && nodes.length) list = list.concat([].slice.call(nodes));
      } catch (e) {}
    }

    // уникализация + фильтр на "похож на постер"
    var uniq = [];
    var seen = [];
    for (var k = 0; k < list.length; k++) {
      var el = list[k];
      if (!el || !el.getBoundingClientRect) continue;
      if (seen.indexOf(el) !== -1) continue;
      seen.push(el);

      if (!looksLikePoster(el)) continue;
      uniq.push(el);
    }

    return uniq;
  }

  // --- settle surfaces ---
  function drawAccDot(x, y, r, a) {
    if (!accCtx) return;
    accCtx.globalAlpha = a;
    var s = (r * 2.0) | 0;
    accCtx.drawImage(spriteDot, x, y, s, s);
    accCtx.globalAlpha = 1;
  }

  function buildSurfaces() {
    surfaces = [];
    if (cfg_tizen || !cfg_settle) return;

    var els = getCardElements();
    var max = isAndroid() ? 40 : 55; // ограничиваем, чтобы не жрать CPU
    var added = 0;

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var r = null;

      // только реально видимые карточки (важно для горизонтальных каруселей и скрытых списков)
      if (!isElVisible(el)) continue;

      try { r = el.getBoundingClientRect(); } catch (e) { r = null; }
      if (!r) continue;

      if (r.bottom < 0 || r.top > H) continue;

      // защита от "широких" контейнеров (иначе могут появляться линии на старте)
      if (r.width > W * 0.82) continue;
      if (r.height > H * 0.95) continue;

      var y = r.top + 2;
      if (y < 0 || y > H) continue;

      // немного сужаем, чтобы не липло на всю ширину "блоков"
      var x1 = r.left + 10;
      var x2 = r.right - 10;
      if ((x2 - x1) < 60) continue;
      surfaces.push({
        x1: x1,
        x2: x2,
        y: y
      });

      added++;
      if (added >= max) break;
    }
  }

  function scheduleSurfaces() {
    if (cfg_tizen || !cfg_settle) return;

    var delay = isAndroid() ? 650 : 750;
    if (surfTimer) return;

    surfTimer = setTimeout(function () {
      surfTimer = 0;
      buildSurfaces();
    }, delay);
  }

  // --- “снежные шапки” (CSS) ---
  function injectCapStyles() {
    if (document.getElementById('snowfx_caps_css')) return;

    var st = document.createElement('style');
    st.id = 'snowfx_caps_css';
    st.type = 'text/css';
    st.textContent =
      '.snowfx_cap{position:absolute;left:-2px;right:-2px;top:-2px;height:14px;pointer-events:none;' +
      'background:linear-gradient(to bottom, rgba(255,255,255,.85), rgba(255,255,255,.20), rgba(255,255,255,0));' +
      'filter:blur(.2px);border-top-left-radius:12px;border-top-right-radius:12px;}' +
      '.snowfx_cap:after{content:"";position:absolute;left:6px;right:6px;top:2px;height:2px;' +
      'background:rgba(255,255,255,.55);border-radius:4px;}';
    document.head.appendChild(st);
  }

  function applyCaps() {
    if (cfg_tizen || !cfg_settle) return;

    injectCapStyles();

    var els = getCardElements();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || el.__snowfx_cap__) continue;

      // делаем контейнером
      try {
        var cs = window.getComputedStyle ? getComputedStyle(el) : null;
        if (cs && cs.position === 'static') el.style.position = 'relative';
      } catch (e) {}

      var cap = document.createElement('div');
      cap.className = 'snowfx_cap';
      cap.style.zIndex = '2';
      cap.style.opacity = '0.8';

      try {
        el.appendChild(cap);
        el.__snowfx_cap__ = true;
      } catch (e2) {}
    }
  }

  function startCaps() {
    if (cfg_tizen || !cfg_settle) return;

    applyCaps();

    if (capObserver) return;
    try {
      capObserver = new MutationObserver(function () {
        setTimeout(function () {
          applyCaps();
          scheduleSurfaces();
        }, 140);
      });
      capObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      capObserver = null;
    }
  }

  function stopCaps() {
    try {
      var caps = document.querySelectorAll('.snowfx_cap');
      for (var i = 0; i < caps.length; i++) {
        var c = caps[i];
        if (c && c.parentNode) {
          var p = c.parentNode;
          p.removeChild(c);
          try { p.__snowfx_cap__ = false; } catch (e4) {}
        }
      }
    } catch (e) {}

    try { if (capObserver) capObserver.disconnect(); } catch (e2) {}
    capObserver = null;

    try {
      var st = document.getElementById('snowfx_caps_css');
      if (st && st.parentNode) st.parentNode.removeChild(st);
    } catch (e3) {}
  }

  // --- loop ---
  function drawFrame(dt) {
    if (!fallCtx) return;

    fallCtx.clearRect(0, 0, W, H);

    if (cfg_settle && !cfg_tizen) {
      scheduleSurfaces();
      // caps disabled (they создавали белые полоски при загрузке)
    }

    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];

      f.y += f.vy * (dt / 16.67);
      f.x += f.vx * (dt / 16.67);

      if (!cfg_tizen) f.x += Math.sin((f.y + i) * 0.01) * 0.25;

      // --- оседание ---
      if (cfg_settle && !cfg_tizen && accCtx && spriteDot) {
        var si = (cfg_settle_intensity || 1);
        if (si < 0) si = 0;
        // для "медленного" оседания просто не всегда рисуем накопление
        function allowDeposit() {
          if (si >= 0.999) return true;
          return Math.random() < si;
        }
        function p(base, cap) {
          if (!cap) cap = 0.95;
          return Math.min(cap, base * si);
        }
        // низ экрана
        if (f.y >= H - 8) {
          if (allowDeposit()) {
            drawAccDot(f.x, H - 10, f.r, Math.min(0.9, f.a + 0.1));
            if (Math.random() < p(0.18, 0.55)) drawAccDot(f.x + rand(-4, 4), H - 10, f.r * 0.85, Math.min(0.85, f.a + 0.05));
          }
          f.x = rand(0, W);
          f.y = rand(-H, 0);
          continue;
        }

        // верх карточек
        if (surfaces.length && f.y > 0) {
          for (var sidx = 0; sidx < surfaces.length; sidx++) {
            var s = surfaces[sidx];
            if (f.x < s.x1 || f.x > s.x2) continue;

            if (f.y >= s.y && f.y <= s.y + 3) {
              if (allowDeposit()) {
                drawAccDot(f.x, s.y - 1, f.r, Math.min(0.9, f.a + 0.15));
                if (Math.random() < p(0.55)) drawAccDot(f.x + rand(-4, 4), s.y - 1, f.r * 0.85, Math.min(0.8, f.a));
                if (Math.random() < p(0.30, 0.85)) drawAccDot(f.x + rand(-6, 6), s.y - 2, f.r * 0.75, Math.min(0.7, f.a));
                // ускоренное оседание: иногда добавим ещё точку
                if (si > 1.25 && Math.random() < Math.min(0.25, (si - 1.0) * 0.18)) {
                  drawAccDot(f.x + rand(-7, 7), s.y - 2, f.r * 0.65, Math.min(0.65, f.a));
                }
              }

              f.x = rand(0, W);
              f.y = rand(-H, 0);
              break;
            }
          }
        }
      }

      if (f.y > H + 12) { f.y = -12; f.x = rand(0, W); }
      if (f.x < -12) f.x = W + 12;
      else if (f.x > W + 12) f.x = -12;

      fallCtx.globalAlpha = f.a;
      var size = (f.r * 2.0) | 0;
      var img = (spritesFall && spritesFall[f.k]) ? spritesFall[f.k] : (spritesFall ? spritesFall[0] : spriteDot);
      fallCtx.drawImage(img, f.x, f.y, size, size);
    }

    fallCtx.globalAlpha = 1;
  }

  function loop(ts) {
    if (!running) return;

    if (document.hidden) {
      lastTs = ts;
      rafId = requestAnimationFrame(loop);
      return;
    }

    var interval = 1000 / cfg_fps;
    if (!lastTs) lastTs = ts;
    var dt = ts - lastTs;

    if (dt >= interval) {
      lastTs = ts;
      drawFrame(dt);
    }

    rafId = requestAnimationFrame(loop);
  }

  function startEngine() {
    if (running) return;
    if (prefersReduceMotion()) return;

    ensureCanvases();
    if (!fallCanvas || !fallCtx) return;

    try { window.addEventListener('resize', resize, false); } catch (e) {}

    flakes = [];
    applyFlakeCount(cfg_flakes);

    // первичный расчёт поверхностей (чуть позже, когда вёрстка стабилизируется)
    if (cfg_settle && !cfg_tizen) {
      // убираем любые старые "шапки" от прошлых версий
      stopCaps();
      setTimeout(function(){
        // на старте делаем чисто, чтобы не появлялись белые полосы
        resetAccumulationHard('warmup');
      }, 350);
    }

    running = true;

    // включаем "стряхивание" при фактическом старте эффекта
    if (shake_enabled) ensureMotion();

    rafId = requestAnimationFrame(loop);
  }

  function stopEngine() {
    removeCanvases();
  }

  // --- прокрутка/движение контента: сбрасываем оседание ---
  // 1) ловим реальные scroll-события (включая вложенные, capture=true)
  // 2) плюс "пробник" на случай если Лампа скроллит transform-ом (без scroll event)
  var scrollDebounce = 0;
  var probeSel = ['.scroll__body', '.scroll__content', '.content', '.activity', '.layer'];
  var probeEl = null;
  var probeTop = null;

  function findProbe() {
    for (var i = 0; i < probeSel.length; i++) {
      var el = null;
      try { el = document.querySelector(probeSel[i]); } catch (e) {}
      if (el && el.getBoundingClientRect) return el;
    }
    return null;
  }

  function onAnyScrollLike() {
    if (cfg_tizen || !cfg_settle) return;
    if (!running) return;

    if (scrollDebounce) return;
    scrollDebounce = setTimeout(function () {
      scrollDebounce = 0;
      resetAccumulationSoft('scroll');
    }, 120);
  }

  function bindScrollReset() {
    if (window.__snowfx_scrollbind__) return;
    window.__snowfx_scrollbind__ = true;

    try { document.addEventListener('scroll', onAnyScrollLike, true); } catch (e1) {}
    try { document.addEventListener('wheel', onAnyScrollLike, { passive: true }); } catch (e2) {}
    try { document.addEventListener('touchmove', onAnyScrollLike, { passive: true }); } catch (e3) {}

    // probe interval
    setInterval(function () {
      if (cfg_tizen || !cfg_settle) return;
      if (!running) return;

      if (!probeEl) probeEl = findProbe();
      if (!probeEl) return;

      var t = null;
      try { t = probeEl.getBoundingClientRect().top; } catch (e4) { t = null; }
      if (t === null) return;

      if (probeTop === null) {
        probeTop = t;
        return;
      }

      // если контент “поехал” — сбрасываем оседание
      if (Math.abs(t - probeTop) > 2.5) {
        probeTop = t;
        onAnyScrollLike();
      }
    }, 250);
  }
  function injectSnowIconCSS() {
    try {
      if (document.getElementById('snowfx_menu_icon_css')) return;

      var st = document.createElement('style');
      st.id = 'snowfx_menu_icon_css';
      st.type = 'text/css';

      // Default: white icon on dark menu
      // Focus/Select/Hover: use currentColor (обычно становится чёрным на светлой подложке)
      st.textContent =
        '.snowfx-menu-icon path{fill:#fff !important;}' +
        '.menu__item.select .snowfx-menu-icon path,' +
        '.menu__item.active .snowfx-menu-icon path,' +
        '.menu__item.hover .snowfx-menu-icon path,' +
        '.menu__item:focus .snowfx-menu-icon path,' +
        '.menu__item:hover .snowfx-menu-icon path,' +
        '.menu li.focus .snowfx-menu-icon path,' +
        '.menu li.select .snowfx-menu-icon path{fill:currentColor !important;}';

      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  // --- Shake to clear snow (mobile) ---
  // Работает через devicemotion. На iOS может требоваться разрешение (первый тап/клик).
  // Важно: запускаем/останавливаем слушатель вместе с запуском/остановкой эффекта, иначе после закрытия настроек
  // (когда снег временно выключен из-за overlay) "стряхивание" может не включиться обратно.
  var shake_enabled = 0;

  var motion_active = false;
  var motion_ready = false;
  var motion_ask_bound = false;

  // last motion sample (для расчёта рывка)
  var last_mot_x = null;
  var last_mot_y = null;
  var last_mot_z = null;
  var last_mot_ts = 0;

  // анти-спам для триггера
  var last_shake_ts = 0;
  var shake_hits = 0;
  var shake_window_ts = 0;

  function setShakeEnabled(v) {
    v = v ? 1 : 0;

    // если значение не менялось — просто синхронизируем состояние слушателя с running
    if (shake_enabled === v) {
      if (!shake_enabled) { stopMotion(); return; }
      if (cfg_tizen || !isMobileUA()) { stopMotion(); return; }
      if (running) ensureMotion(); else stopMotion();
      return;
    }

    shake_enabled = v;

    if (!shake_enabled) {
      stopMotion();
      return;
    }

    // только мобилки, не Tizen
    if (cfg_tizen || !isMobileUA()) {
      stopMotion();
      return;
    }

    // запускаем только когда эффект реально активен
    if (running) ensureMotion();
    else stopMotion();
  }

  function normalizeAccel(ax, ay, az) {
    // Некоторые WebView/браузеры отдают ускорение в "g", некоторые в m/s^2.
    // Если значения очень маленькие (обычно <= ~3), считаем что это g и переводим в m/s^2.
    var mx = Math.max(Math.abs(ax), Math.abs(ay), Math.abs(az));
    if (mx > 0 && mx <= 3.5) {
      ax *= 9.81; ay *= 9.81; az *= 9.81;
    }
    return { x: ax, y: ay, z: az };
  }

  function doShakeEffect() {
    // очищаем "осевший" снег даже если оседание временно выключено (например, в карточке)
    try { clearAccumulationRuntime('shake'); } catch (e1) {}

    // если оседание включено — перестроим поверхности чуть позже
    if (!cfg_tizen && cfg_settle) {
      try {
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          resetTimer = 0;
          buildSurfaces();
        }, 180);
      } catch (e2) {}
    }

    // порыв ветра у падающего снега (чтобы было видно, что встряхивание сработало даже без оседания)
    try {
      for (var i = 0; i < flakes.length; i++) {
        flakes[i].vx += rand(-1.6, 1.6);
        flakes[i].vy *= 0.80;
        // немного "подбросим" часть снежинок вверх
        if (Math.random() < 0.35) flakes[i].y = rand(-H * 0.35, 0);
      }
    } catch (e3) {}
  }

  function onDeviceMotion(e) {
    if (!shake_enabled) return;
    if (cfg_tizen) return;
    if (!isMobileUA()) return;

    // Нечего "стряхивать", если эффект сейчас выключен (настройки/плеер)
    if (!running) return;

    var acc = e && (e.accelerationIncludingGravity || e.acceleration);
    if (!acc) return;

    var ax = Number(acc.x || 0);
    var ay = Number(acc.y || 0);
    var az = Number(acc.z || 0);

    var n = normalizeAccel(ax, ay, az);
    ax = n.x; ay = n.y; az = n.z;

    var now = Date.now();
    if (!last_mot_ts) {
      last_mot_ts = now;
      last_mot_x = ax; last_mot_y = ay; last_mot_z = az;
      return;
    }

    // если между событиями был большой разрыв — сбрасываем baseline
    if (now - last_mot_ts > 1200) {
      last_mot_ts = now;
      last_mot_x = ax; last_mot_y = ay; last_mot_z = az;
      return;
    }

    // оценка "рывка": сумма модулей дельт по осям (гравитация частично компенсируется разностью)
    var jerk = Math.abs(ax - last_mot_x) + Math.abs(ay - last_mot_y) + Math.abs(az - last_mot_z);

    last_mot_ts = now;
    last_mot_x = ax; last_mot_y = ay; last_mot_z = az;

    // пороги: iOS часто даёт чуть "мягче" значения → порог выше не нужен
    var ua = navigator.userAgent || '';
    var isiOS = /iPhone|iPad|iPod/i.test(ua);

    var TH = isiOS ? 12.5 : 11.0;   // порог рывка (m/s^2)
    var WINDOW = 650;              // окно детекции
    var COOLDOWN = 1100;           // антиспам

    if (jerk > TH) {
      if (now - last_shake_ts < COOLDOWN) return;

      if (!shake_window_ts || (now - shake_window_ts) > WINDOW) {
        shake_window_ts = now;
        shake_hits = 0;
      }

      shake_hits++;

      // требуем 2 сильных рывка в окне — так меньше ложных срабатываний
      if (shake_hits >= 2) {
        last_shake_ts = now;
        shake_hits = 0;
        shake_window_ts = 0;

        doShakeEffect();
      }
    }
  }

  function startMotion() {
    if (motion_active) return;
    if (typeof window.DeviceMotionEvent === 'undefined') return;

    try {
      // passive снижает влияние на scroll
      window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
      motion_active = true;
    } catch (e) {
      try {
        window.addEventListener('devicemotion', onDeviceMotion, false);
        motion_active = true;
      } catch (e2) {}
    }
  }

  function stopMotion() {
    if (!motion_active) return;
    try { window.removeEventListener('devicemotion', onDeviceMotion, { passive: true }); } catch (e) {}
    try { window.removeEventListener('devicemotion', onDeviceMotion, false); } catch (e2) {}
    motion_active = false;
  }

  function ensureMotion() {
    if (!shake_enabled) return;

    if (motion_ready) { startMotion(); return; }

    // iOS 13+ требует запрос разрешения только по пользовательскому действию
    if (typeof window.DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      if (motion_ask_bound) return;
      motion_ask_bound = true;

      var ask = function () {
        try { document.removeEventListener('click', ask, true); } catch (e1) {}
        try { document.removeEventListener('touchend', ask, true); } catch (e2) {}
        motion_ask_bound = false;

        try {
          DeviceMotionEvent.requestPermission().then(function (res) {
            if (res === 'granted') {
              motion_ready = true;
              startMotion();
            }
          }).catch(function () {});
        } catch (e3) {}
      };

      try { document.addEventListener('click', ask, true); } catch (e4) {}
      try { document.addEventListener('touchend', ask, true); } catch (e5) {}
      return;
    }

    // Android/Chrome и большинство WebView — сразу
    motion_ready = true;
    startMotion();
  }

  // --- i18n (Settings labels) ---

  function snowfx_detect_lang() {
    var l = '';
    try {
      if (window.Lampa && Lampa.Storage) {
        if (typeof Lampa.Storage.lang === 'function') l = Lampa.Storage.lang();
        else if (typeof Lampa.Storage.get === 'function') l = Lampa.Storage.get('language') || Lampa.Storage.get('lang') || Lampa.Storage.get('locale');
      }
    } catch (e) {}

    if (!l) {
      try { l = (navigator.language || navigator.userLanguage || '').toLowerCase(); } catch (e2) {}
    }

    l = (l || 'ru').toString().toLowerCase();
    if (l.indexOf('en') === 0) return 'en';
    if (l.indexOf('uk') === 0 || l.indexOf('ua') === 0) return 'uk';
    if (l.indexOf('ru') === 0) return 'ru';
    return 'ru';
  }

  var SNOWFX_LANG = snowfx_detect_lang();
  var SNOWFX_I18N = {
    ru: {
      component: 'Снег',

      enabled_name: 'Снег на экранах',
      enabled_desc: 'Главная / Фильмы / Сериалы / Категории',

      in_card_name: 'Снег в карточке',
      in_card_desc: 'Показывать снег на странице деталей фильма/сериала',

      density_name: 'Плотность снега',
      density_desc: 'На Tizen плотность ограничена',

      flake_name: 'Тип снежинок',
      flake_desc: 'Выбор вида снежинок. На Tizen можно включить снежинки, но возможны лаги.',

      size_name: 'Размер снежинок',
      size_desc: 'Применяется ко всем видам. На Tizen большие размеры ограничены для снижения нагрузки.',

      fall_speed_name: 'Скорость падения',
      fall_speed_desc: 'Скорость движения падающих снежинок. На Tizen быстрый режим ограничен.',

      settle_name: 'Оседание на карточках',
      settle_desc: 'При прокрутке оседание сбрасывается. На Tizen принудительно Выкл.',

      settle_speed_name: 'Скорость оседания',
      settle_speed_desc: 'Скорость накопления "снежных точек" (работает только если оседание включено).',

      shake_name: 'Стряхивание снега',
      shake_desc: 'На смартфоне можно стряхнуть снег потряхиванием',

      on: 'Вкл',
      off: 'Выкл',
      yes: 'Да',
      no: 'Нет',
      auto: 'Авто',

      density_low: 'Мало',
      density_mid: 'Средне',
      density_high: 'Много',

      style_dots: 'Точки',
      style_flakes: 'Снежинки',
      style_mixed: 'Смешанные',

      size_small: 'Маленькие',
      size_medium: 'Средние',
      size_large: 'Большие',
      size_huge: 'Огромные',

      speed_slow: 'Медленная',
      speed_medium: 'Средняя',
      speed_fast: 'Быстрая'
    },

    en: {
      component: 'Snow',

      enabled_name: 'Snow on screens',
      enabled_desc: 'Home / Movies / Series / Categories',

      in_card_name: 'Snow inside cards',
      in_card_desc: 'Show snow on the details page',

      density_name: 'Snow density',
      density_desc: 'On Tizen, density is limited',

      flake_name: 'Flake type',
      flake_desc: 'Choose the flake style. On Tizen, flakes may cause stutter.',

      size_name: 'Flake size',
      size_desc: 'Applies to all styles. On Tizen, large sizes are limited to reduce load.',

      fall_speed_name: 'Fall speed',
      fall_speed_desc: 'Speed of falling flakes. On Tizen, fast mode is limited.',

      settle_name: 'Settle on cards',
      settle_desc: 'Settling resets while scrolling. Forced Off on Tizen.',

      settle_speed_name: 'Settle speed',
      settle_speed_desc: 'How fast settled "snow dots" accumulate (works only when settling is enabled).',

      shake_name: 'Shake to clear',
      shake_desc: 'On mobile you can shake to clear snow',

      on: 'On',
      off: 'Off',
      yes: 'Yes',
      no: 'No',
      auto: 'Auto',

      density_low: 'Low',
      density_mid: 'Medium',
      density_high: 'High',

      style_dots: 'Dots',
      style_flakes: 'Flakes',
      style_mixed: 'Mixed',

      size_small: 'Small',
      size_medium: 'Medium',
      size_large: 'Large',
      size_huge: 'Huge',

      speed_slow: 'Slow',
      speed_medium: 'Medium',
      speed_fast: 'Fast'
    },

    uk: {
      component: 'Сніг',

      enabled_name: 'Сніг на екранах',
      enabled_desc: 'Головна / Фільми / Серіали / Категорії',

      in_card_name: 'Сніг у картці',
      in_card_desc: 'Показувати сніг на сторінці деталей фільму/серіалу',

      density_name: 'Щільність снігу',
      density_desc: 'На Tizen щільність обмежена',

      flake_name: 'Тип сніжинок',
      flake_desc: 'Вибір виду сніжинок. На Tizen можливі підгальмовування.',

      size_name: 'Розмір сніжинок',
      size_desc: 'Застосовується до всіх видів. На Tizen великі розміри обмежені для зниження навантаження.',

      fall_speed_name: 'Швидкість падіння',
      fall_speed_desc: 'Швидкість руху падаючих сніжинок. На Tizen швидкий режим обмежено.',

      settle_name: 'Осідання на картках',
      settle_desc: 'Під час прокрутки осідання скидається. На Tizen примусово Вимк.',

      settle_speed_name: 'Швидкість осідання',
      settle_speed_desc: 'Швидкість накопичення "снігових точок" (працює лише якщо осідання увімкнено).',

      shake_name: 'Струсити сніг',
      shake_desc: 'На смартфоні можна струсити сніг потряхуванням',

      on: 'Увімк',
      off: 'Вимк',
      yes: 'Так',
      no: 'Ні',
      auto: 'Авто',

      density_low: 'Мало',
      density_mid: 'Середньо',
      density_high: 'Багато',

      style_dots: 'Точки',
      style_flakes: 'Сніжинки',
      style_mixed: 'Змішані',

      size_small: 'Малі',
      size_medium: 'Середні',
      size_large: 'Великі',
      size_huge: 'Величезні',

      speed_slow: 'Повільна',
      speed_medium: 'Середня',
      speed_fast: 'Швидка'
    }
  };

  function snowfx_t(key) {
    var dict = SNOWFX_I18N[SNOWFX_LANG] || SNOWFX_I18N.ru;
    return (dict && dict[key]) || (SNOWFX_I18N.ru && SNOWFX_I18N.ru[key]) || key;
  }

// --- Settings UI ---
  function addSettingsUI() {
    injectSnowIconCSS();
    if (!window.Lampa || !Lampa.SettingsApi) return;

    var onoff = { 0: snowfx_t('off'), 1: snowfx_t('on') };
    var yesno = { 0: snowfx_t('no'), 1: snowfx_t('yes') };
    var density_vals = { 0: snowfx_t('auto'), 1: snowfx_t('density_low'), 2: snowfx_t('density_mid'), 3: snowfx_t('density_high') };
    var style_vals = { 0: snowfx_t('auto'), 1: snowfx_t('style_dots'), 2: snowfx_t('style_flakes'), 3: snowfx_t('style_mixed') };
    var size_vals = { 0: snowfx_t('auto'), 1: snowfx_t('size_small'), 2: snowfx_t('size_medium'), 3: snowfx_t('size_large'), 4: snowfx_t('size_huge') };
    var speed_vals = { 0: snowfx_t('auto'), 1: snowfx_t('speed_slow'), 2: snowfx_t('speed_medium'), 3: snowfx_t('speed_fast') };

    try {
      Lampa.SettingsApi.addComponent({
        component: 'snowfx',
        name: snowfx_t('component'),
        icon: SNOW_ICON
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_ENABLED,
          type: 'select',
          values: onoff,
          "default": 1
        },
        field: {
          name: snowfx_t('enabled_name'),
          description: snowfx_t('enabled_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_IN_CARD,
          type: 'select',
          values: yesno,
          "default": 0
        },
        field: {
          name: snowfx_t('in_card_name'),
          description: snowfx_t('in_card_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_DENSITY,
          type: 'select',
          values: density_vals,
          "default": 0
        },
        field: {
          name: snowfx_t('density_name'),
          description: snowfx_t('density_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_FLAKE,
          type: 'select',
          values: style_vals,
          "default": 0
        },
        field: {
          name: snowfx_t('flake_name'),
          description: snowfx_t('flake_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_SIZE,
          type: 'select',
          values: size_vals,
          "default": 0
        },
        field: {
          name: snowfx_t('size_name'),
          description: snowfx_t('size_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_FALL_SPEED,
          type: 'select',
          values: speed_vals,
          "default": 0
        },
        field: {
          name: snowfx_t('fall_speed_name'),
          description: snowfx_t('fall_speed_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_SETTLE,
          type: 'select',
          values: onoff,
          "default": 1
        },
        field: {
          name: snowfx_t('settle_name'),
          description: snowfx_t('settle_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_SETTLE_SPEED,
          type: 'select',
          values: speed_vals,
          "default": 0
        },
        field: {
          name: snowfx_t('settle_speed_name'),
          description: snowfx_t('settle_speed_desc')
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'snowfx',
        param: {
          name: KEY_SHAKE,
          type: 'select',
          values: onoff,
          "default": 1
        },
        field: {
          name: snowfx_t('shake_name'),
          description: snowfx_t('shake_desc')
        }
      });
    } catch (e) {}
  }

  // --- Lampa hooks ---
  function bindLampaHooks() {
    if (!window.Lampa) return;

    try {
      if (Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('activity', function (e) {
          if (!e || e.type !== 'start') return;
          in_details_activity = isDetailsActivity(e);
          on_allowed_screen = isAllowedActivity(e) || in_details_activity;

          // сброс пробника скролла при смене экрана
          try { probeEl = null; probeTop = null; } catch (e0) {}

          applyConfigAndState(true);

          // обновим shake сразу, без ожидания watcher
          try {
            var t = isTizen();
            var sd = (!t && isMobileUA()) ? 1 : 0;
            var shv = num(storageGet(KEY_SHAKE, sd), sd) | 0;
            setShakeEnabled(!!shv);
          } catch (e3) {}
        });
      }
    } catch (e1) {}

    try {
      if (Lampa.Player && Lampa.Player.listener && Lampa.Player.listener.follow) {
        Lampa.Player.listener.follow('start', function () {
          in_player = true;
          applyConfigAndState(true);
        });
        Lampa.Player.listener.follow('destroy', function () {
          in_player = false;
          applyConfigAndState(true);
        });

        // другие имена событий (в разных сборках/плеерах)
        var _end_events = ['stop', 'end', 'close', 'exit', 'back'];
        for (var i = 0; i < _end_events.length; i++) {
          try {
            Lampa.Player.listener.follow(_end_events[i], function () {
              in_player = false;
              applyConfigAndState(true);
            });
          } catch (e3) {}
        }
      }
    } catch (e2) {}
  }

  // --- apply state ---
  function applyConfigAndState(resetAcc) {
    var cfg = computeConfig();

    cfg_tizen = !!cfg.tizen;
    cfg_fps = cfg.fps;
    cfg_flakes = cfg.flakes;

    // синхронизируем настройку \"Стряхивание\" (важно: если включили в настройках, когда оверлей открыт, эффект временно выключен и слушатель иначе не стартанёт)
    try {
      var sd = (!cfg_tizen && isMobileUA()) ? 1 : 0;
      var shv = num(storageGet(KEY_SHAKE, sd), sd) ? 1 : 0;
      setShakeEnabled(shv);
    } catch (e0) {}

    // размер снежинок
    var prev_size_mult = cfg_size_mult;
    cfg_size_mult = (typeof cfg.size_mult === 'number') ? cfg.size_mult : 1.0;
    if (!cfg_size_mult || cfg_size_mult <= 0) cfg_size_mult = 1.0;

    // скорость падения снежинок
    var prev_fall_mult = cfg_fall_mult;
    cfg_fall_mult = (typeof cfg.fall_mult === 'number') ? cfg.fall_mult : 1.0;
    if (!cfg_fall_mult || cfg_fall_mult <= 0) cfg_fall_mult = 1.0;

    // скорость оседания (интенсивность накопления)
    cfg_settle_intensity = (typeof cfg.settle_intensity === 'number') ? cfg.settle_intensity : 1.0;
    if (cfg_settle_intensity < 0) cfg_settle_intensity = 0;

    // settle: на tizen принудительно 0
    // В карточке (детали) оседание принудительно выключаем — иначе возможны артефакты
    // (оседание на скрытые/невидимые карточки и элементы интерфейса).
    var detailsNow = in_details_activity || isDetailsScreen();
    var prev_settle_effective = cfg_settle;
    cfg_settle_user = cfg_tizen ? 0 : (cfg.settle ? 1 : 0);
    cfg_settle = (cfg_settle_user && !detailsNow) ? 1 : 0;
    if (prev_settle_effective && !cfg_settle) {
      clearAccumulationRuntime('settle_off');
    }

    // тип снежинок
    var next_style = (cfg.flake_style | 0);
    if (next_style < 0) next_style = 0;
    if (next_style > 3) next_style = 3;
    var style_changed = (cfg_flake_style !== next_style);
    cfg_flake_style = next_style;

    // снег в карточке (детали)
    cfg_in_card = cfg.in_card ? 1 : 0;

    // Предупреждение для Tizen при включении "Снежинки/Смешанные"
    if (cfg_tizen && (cfg_flake_style === 2 || cfg_flake_style === 3) && !window.__snowfx_tizen_flake_warned__) {
      window.__snowfx_tizen_flake_warned__ = 1;
      try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show('Внимание: снежинки на Tizen могут вызывать лаги'); } catch (e) {}
    }
    if (resetAcc) resetAccumulationHard('apply');

    var size_changed = (Math.abs((prev_size_mult || 1) - (cfg_size_mult || 1)) > 0.001);
    var fall_changed = (Math.abs((prev_fall_mult || 1) - (cfg_fall_mult || 1)) > 0.001);

    if (running) {
      if (style_changed || size_changed) {
        flakes = [];
      } else if (fall_changed) {
        // масштабируем текущую скорость падения без пересоздания снежинок
        var prev = (prev_fall_mult || 1);
        if (!prev || prev <= 0) prev = 1;
        var ratio = (cfg_fall_mult || 1) / prev;
        try {
          for (var i = 0; i < flakes.length; i++) {
            flakes[i].vy *= ratio;
          }
        } catch (e0) {}
      }
      applyFlakeCount(cfg_flakes);
      if (fallCanvas && fallCtx && accCanvas && accCtx) resize();
    }

    if (shouldRunNow()) startEngine();
    else stopEngine();
  }

  // --- watcher (настройки/оверлей/изменения) ---
  var last_enabled = null;
  var last_density = null;
  var last_flake = null;
  var last_settle = null;
  var last_size = null;
  var last_settle_speed = null;
  var last_fall_speed = null;
  var last_shake = null;
  var last_in_card = null;
  var last_overlay = null;

  function startWatcher() {
    setInterval(function () {
      overlay_open = detectOverlayOpen();

      var tizen = isTizen();
      var settleDefault = tizen ? 0 : 1;

      var en = num(storageGet(KEY_ENABLED, 1), 1) | 0;
      var de = num(storageGet(KEY_DENSITY, 0), 0) | 0;
      var fd = tizen ? 1 : 0;
      var fl = num(storageGet(KEY_FLAKE, fd), fd) | 0;
      if (fl < 0) fl = 0;
      if (fl > 3) fl = 3;
      // На Tizen по умолчанию "Точки", но пользователь может выбрать "Снежинки/Смешанные" (с ограничениями)
      if (tizen && fl === 0) fl = 1;
      var se = num(storageGet(KEY_SETTLE, settleDefault), settleDefault) | 0;

      var sz = num(storageGet(KEY_SIZE, 0), 0) | 0;
      if (sz < 0) sz = 0;
      if (sz > 4) sz = 4;
      if (tizen && sz >= 3) sz = 2;

      var ss = num(storageGet(KEY_SETTLE_SPEED, 0), 0) | 0;
      if (ss < 0) ss = 0;
      if (ss > 3) ss = 3;

      var fs = num(storageGet(KEY_FALL_SPEED, 0), 0) | 0;
      if (fs < 0) fs = 0;
      if (fs > 3) fs = 3;

      var sd = (!tizen && isMobileUA()) ? 1 : 0;
      var sh = num(storageGet(KEY_SHAKE, sd), sd) | 0;
      var ic = num(storageGet(KEY_IN_CARD, 0), 0) | 0;
      ic = ic ? 1 : 0;
      var ov = overlay_open ? 1 : 0;

      // фоллбек: иногда после плеера флаг не сбрасывается (внешний/внутренний плеер)
      var player_fix = 0;
      if (in_player && !document.hidden) {
        if (!detectActuallyInPlayer()) {
          in_player = false;
          player_fix = 1;
        }
      }

      if (en !== last_enabled || de !== last_density || fl !== last_flake || se !== last_settle || sz !== last_size || ss !== last_settle_speed || fs !== last_fall_speed || sh !== last_shake || ic !== last_in_card || ov !== last_overlay || player_fix) {
        last_enabled = en;
        last_density = de;
        last_flake = fl;
        last_settle = se;
        last_size = sz;
        last_settle_speed = ss;
        last_fall_speed = fs;
        last_shake = sh;
        last_in_card = ic;
        last_overlay = ov;
        applyConfigAndState(true);
      }
    }, 650);
  }

  function bindVisibility() {
    try {
      document.addEventListener('visibilitychange', function () {
        overlay_open = detectOverlayOpen();

        // при возврате из внешнего приложения/плеера иногда не приходит destroy
        var need_reset = false;
        if (!document.hidden) {
          if (in_player && !detectActuallyInPlayer()) {
            in_player = false;
            need_reset = true;
          }
        }

        applyConfigAndState(need_reset);
      }, false);
    } catch (e) {}
  }

  function bindResume() {
    if (window.__snowfx_resume_bound__) return;
    window.__snowfx_resume_bound__ = true;

    var onResume = function () {
      overlay_open = detectOverlayOpen();

      // На resume/focus лучше принудительно пересоздавать канвасы
      if (in_player && !detectActuallyInPlayer()) in_player = false;

      applyConfigAndState(true);
    };

    try { window.addEventListener('focus', onResume, true); } catch (e1) {}
    try { window.addEventListener('pageshow', onResume, true); } catch (e2) {}
    try { document.addEventListener('resume', onResume, true); } catch (e3) {}
  }

  // --- bootstrap ---
  var tries = 0;
  function boot() {
    tries++;

    addSettingsUI();
    bindLampaHooks();
    bindVisibility();
    bindResume();
    bindScrollReset();

    if (!window.__snowfx_watcher_started__) {
      window.__snowfx_watcher_started__ = true;
      startWatcher();
    }

    overlay_open = detectOverlayOpen();
    applyConfigAndState(false);

    try {
      var t = isTizen();
      var sd = (!t && isMobileUA()) ? 1 : 0;
      setShakeEnabled(!!num(storageGet(KEY_SHAKE, sd), sd));
    } catch (e) {}

    if (!window.Lampa && tries < 20) setTimeout(boot, 300);
  }

  boot();
})();
