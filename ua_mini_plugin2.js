(function () {
  'use strict';

  // UA mini plugin v5
  // Shows UA + basic env info (UA + Activity + Last screen).
  // If modal windows don't appear (Android TV/Mi Box), displays info in a bottom bar.
  // Does NOT touch Lampa.Lang dictionaries.

  try {
    if (window.__ua_mini_plugin_ver__ && window.__ua_mini_plugin_ver__ >= 5) return;
    window.__ua_mini_plugin_ver__ = 5;
  } catch (e) {}

  var KEY_SHOW = 'ua_mini_show';

  // last known Lampa activity event (for debugging)
  var last_activity = null;
  var last_activity_ts = 0;
  // last non-overlay screen (useful because user opens Settings to press the button)
  var last_content_activity = null;
  var last_content_activity_ts = 0;

  var activity_bound = false;

  function isDisallowedComponentName(c) {
    c = (c || '').toString().toLowerCase();
    if (!c) return false;
    return (
      c.indexOf('player') >= 0 ||
      c.indexOf('settings') >= 0 ||
      c.indexOf('search') >= 0 ||
      c.indexOf('keyboard') >= 0 ||
      c.indexOf('notice') >= 0
    );
  }

  function bindActivity() {
    if (activity_bound) return;
    activity_bound = true;

    try {
      if (!window.Lampa || !Lampa.Listener || typeof Lampa.Listener.follow !== 'function') return;

      Lampa.Listener.follow('activity', function (e) {
        try {
          if (e && e.type === 'start') {
            last_activity = e;
            last_activity_ts = Date.now();

            var c = (e.component || (e.object && e.object.component) || '').toString();
            if (!isDisallowedComponentName(c)) {
              last_content_activity = e;
              last_content_activity_ts = last_activity_ts;
            }
          }
        } catch (err) {}
      });
    } catch (e) {}
  }

  function langCode() {
    var l = '';
    try {
      if (window.Lampa && Lampa.Storage) {
        if (typeof Lampa.Storage.lang === 'function') l = Lampa.Storage.lang();
        else if (typeof Lampa.Storage.get === 'function')
          l = Lampa.Storage.get('lang') || Lampa.Storage.get('language') || Lampa.Storage.get('locale');
      }
    } catch (e) {}

    l = (l || '').toString().toLowerCase();
    if (l.indexOf('uk') === 0 || l.indexOf('ua') === 0) return 'ua';
    if (l.indexOf('en') === 0) return 'en';

    var n = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
    if (n.indexOf('uk') === 0 || n.indexOf('ua') === 0) return 'ua';
    if (n.indexOf('en') === 0) return 'en';
    return 'ru';
  }

  var I18N = {
    ru: {
      title: 'User-Agent',
      show: 'Показать',
      show_desc: 'Покажет User-Agent и базовую информацию об окружении.',
      activity: 'Активность',
      activity2: 'Последний экран',
      press: 'Нажмите',
      done: 'Готово'
    },
    en: {
      title: 'User-Agent',
      show: 'Show',
      show_desc: 'Shows User-Agent and basic environment info.',
      activity: 'Activity',
      activity2: 'Last screen',
      press: 'Press',
      done: 'Done'
    },
    ua: {
      title: 'User-Agent',
      show: 'Показати',
      show_desc: 'Показує User-Agent і базову інформацію про оточення.',
      activity: 'Активність',
      activity2: 'Останній екран',
      press: 'Натисніть',
      done: 'Готово'
    }
  };

  function t(key) {
    var l = langCode();
    return (I18N[l] && I18N[l][key]) || I18N.ru[key] || key;
  }

  function safeStorageGet(key, def) {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
        var v = Lampa.Storage.get(key);
        if (v === undefined || v === null || v === '') return def;
        return v;
      }
    } catch (e) {}
    return def;
  }

  function safeStorageSet(key, val) {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') {
        Lampa.Storage.set(key, val);
      } else {
        try {
          localStorage.setItem(key, JSON.stringify(val));
        } catch (e) {}
      }
    } catch (e) {}
  }

  function platformFlags() {
    var ua = (navigator.userAgent || '').toLowerCase();
    var p = [];
    if (ua.indexOf('tizen') >= 0) p.push('tizen');
    if (ua.indexOf('webos') >= 0) p.push('webos');
    if (ua.indexOf('android') >= 0) p.push('android');
    if (ua.indexOf('aft') >= 0 || ua.indexOf('firetv') >= 0) p.push('firetv');
    if (ua.indexOf('tv') >= 0) p.push('tv');
    if (/iphone|ipad|ipod/.test(ua)) p.push('ios');
    if (/windows/.test(ua)) p.push('windows');
    if (/mac os/.test(ua) && !/iphone|ipad|ipod/.test(ua)) p.push('mac');
    if (!p.length) p.push('unknown');
    return p.join(',');
  }

  function canCanvas2D() {
    try {
      var c = document.createElement('canvas');
      var ctx = c.getContext && (c.getContext('2d', { alpha: true }) || c.getContext('2d'));
      return !!ctx;
    } catch (e) {
      return false;
    }
  }

  function activitySummary(e, ts) {
    if (!e) return '-';
    var age = ts ? ' (' + Math.max(0, Math.round((Date.now() - ts) / 1000)) + 's ago)' : '';
    var c = e.component || (e.object && e.object.component) || '';
    var name = e.name || e.method || '';
    return [name, c].filter(Boolean).join(' / ') + age;
  }

  function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
        return;
      }
    } catch (e) {}

    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e2) {}
      document.body.removeChild(ta);
    } catch (e3) {}
  }

  function buildInfo() {
    var lines = [];
    lines.push('UA: ' + (navigator.userAgent || ''));
    lines.push('Lang: ' + (navigator.language || ''));
    lines.push('Platform: ' + platformFlags());

    try {
      bindActivity();
    } catch (e0) {}
    lines.push(t('activity') + ': ' + activitySummary(last_activity, last_activity_ts));
    lines.push(t('activity2') + ': ' + activitySummary(last_content_activity, last_content_activity_ts));

    lines.push('DPR: ' + (window.devicePixelRatio || 1));
    lines.push('Viewport: ' + (window.innerWidth || 0) + 'x' + (window.innerHeight || 0));
    try {
      var de = document.documentElement;
      lines.push('Doc: ' + (de ? de.clientWidth + 'x' + de.clientHeight : '-'));
    } catch (e1) {}
    try {
      lines.push('Screen: ' + (screen.width + 'x' + screen.height));
    } catch (e2) {}

    lines.push('Canvas2D: ' + (canCanvas2D() ? 'yes' : 'no'));
    return lines.join('\n');
  }

  // ----- Bottom bar UI (Noty-like) -----
  var BAR_ID = 'ua_mini_bar_v5';
  var CSS_ID = 'ua_mini_bar_css_v5';

  function ensureBarCss() {
    if (document.getElementById(CSS_ID)) return;
    var css =
      '#' +
      BAR_ID +
      '{position:fixed;left:0;right:0;bottom:0;max-height:70vh;z-index:2147483647;background:#7fe9b0;color:#111;padding:18px 16px;box-sizing:border-box;font-family:inherit;}' +
      '#' +
      BAR_ID +
      ' .ua_head{display:flex;align-items:center;justify-content:space-between;font-size:22px;line-height:1.2;margin-bottom:10px;font-weight:600;}' +
      '#' +
      BAR_ID +
      ' .ua_close{margin-left:12px;font-size:24px;line-height:1;padding:8px 12px;border-radius:10px;background:rgba(0,0,0,.12);cursor:pointer;}' +
      '#' +
      BAR_ID +
      ' .ua_body{background:rgba(255,255,255,.55);border-radius:12px;padding:12px;overflow:auto;max-height:55vh;}' +
      '#' +
      BAR_ID +
      ' pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:18px;line-height:1.25;}';

    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureBar() {
    ensureBarCss();
    var el = document.getElementById(BAR_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = BAR_ID;
    el.style.display = 'none';

    el.innerHTML =
      '<div class="ua_head">' +
      '<div class="ua_title"></div>' +
      '<div class="ua_close">✕</div>' +
      '</div>' +
      '<div class="ua_body"><pre class="ua_text"></pre></div>';

    document.body.appendChild(el);

    var closeBtn = el.querySelector('.ua_close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hideBar();
      });
    }

    var head = el.querySelector('.ua_head');
    if (head) {
      head.addEventListener('click', function (ev) {
        if (ev && ev.target && (ev.target.className || '').toString().indexOf('ua_close') >= 0) return;
        hideBar();
      });
    }

    // best-effort close on Esc/Back
    document.addEventListener(
      'keydown',
      function (e) {
        try {
          if (el.style.display !== 'none') {
            var k = e.key || e.code || e.keyCode;
            if (k === 'Escape' || k === 'Esc' || k === 27 || k === 'Backspace' || k === 8) {
              hideBar();
            }
          }
        } catch (err) {}
      },
      true
    );

    return el;
  }

  function showBar(title, text) {
    var el = ensureBar();
    try {
      el.querySelector('.ua_title').textContent = title || '';
      el.querySelector('.ua_text').textContent = text || '';
      el.style.display = 'block';
    } catch (e) {}
  }

  function hideBar() {
    var el = document.getElementById(BAR_ID);
    if (el) el.style.display = 'none';
  }

  function showInfo() {
    var info = buildInfo();

    function isTvLikeDevice() {
      var ua = (navigator.userAgent || '').toLowerCase();
      // common TV signatures
      if (ua.indexOf('mibox') >= 0 || ua.indexOf('mi box') >= 0) return true;
      if (ua.indexOf('android tv') >= 0) return true;
      if (ua.indexOf('aft') >= 0) return true; // Fire TV
      if (ua.indexOf('tizen') >= 0 || ua.indexOf('webos') >= 0) return true;
      // generic heuristic: landscape, big screen, and UA contains "tv"
      if (ua.indexOf('tv') >= 0 && (screen.width >= 1024 || screen.height >= 1024)) return true;
      return false;
    }

    var modalShown = false;
    // On TV-like devices prefer the bar (modal often fails to appear)
    if (!isTvLikeDevice()) {
      try {
        if (window.Lampa && Lampa.Alert && typeof Lampa.Alert.show === 'function') {
          Lampa.Alert.show(info, t('title'));
          modalShown = true;
        }
      } catch (e) {
        modalShown = false;
      }
    }

    if (!modalShown) {
      try {
        showBar(t('title'), info);
      } catch (e2) {
        try {
          alert(info);
        } catch (e3) {}
      }
    }

    copyToClipboard(info);

    try {
      if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
        Lampa.Noty.show(t('done'));
      }
    } catch (e4) {}
  }

  function addSettings() {
    try {
      if (!window.Lampa || !Lampa.SettingsApi) return;

      Lampa.SettingsApi.addComponent({
        component: 'ua_mini',
        name: t('title'),
        icon: ''
      });

      // Use select as an "action" (portable across old SettingsApi versions)
      Lampa.SettingsApi.addParam({
        component: 'ua_mini',
        param: {
          name: KEY_SHOW,
          type: 'select',
          values: { 0: t('press'), 1: t('show') },
          'default': 0
        },
        field: {
          name: t('show'),
          description: t('show_desc')
        }
      });
    } catch (e) {}
  }

  function poll() {
    var last = null;

    function tick() {
      var v = safeStorageGet(KEY_SHOW, 0);
      v = v === true ? 1 : v === false ? 0 : v;
      if (typeof v === 'string') v = parseInt(v, 10) || 0;

      if (v !== last) {
        last = v;
        if (v === 1) {
          safeStorageSet(KEY_SHOW, 0);
          showInfo();
        }
      }
      setTimeout(tick, 400);
    }

    tick();
  }

  // init
  try {
    bindActivity();
  } catch (e0) {}
  addSettings();
  poll();
})();
