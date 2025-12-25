(function () {
  'use strict';

  // Mini plugin: show User-Agent + basic env info
  // Lampa compatible (SettingsApi)
  if (window.__ua_mini_plugin_loaded__) return;
  window.__ua_mini_plugin_loaded__ = true;

  var KEY_SHOW = 'ua_mini_show';

  // last known Lampa activity event (for debugging)
  var last_activity = null;
  var last_activity_ts = 0;
  // last non-overlay screen (useful because user opens Settings to press the button)
  var last_content_activity = null;
  var last_content_activity_ts = 0;

  function langCode() {
    try {
      if (window.Lampa && Lampa.Storage) {
        if (typeof Lampa.Storage.lang === 'function') {
          var ll = Lampa.Storage.lang();
          if (ll) return String(ll).toLowerCase();
        }
        if (typeof Lampa.Storage.get === 'function') {
          var l = Lampa.Storage.get('language', '');
          if (l) return String(l).toLowerCase();
        }
      }
    } catch (e) {}
    var n = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
    if (n.indexOf('uk') === 0 || n.indexOf('ua') === 0) return 'ua';
    if (n.indexOf('en') === 0) return 'en';
    return 'ru';
  }

  var I18N = {
    ru: {
      title: 'User-Agent',
      show: 'Показать',
      show_desc: 'Покажет User-Agent и базовую информацию об окружении. Также пытается скопировать в буфер.',
      activity: 'Активность',
      activity2: 'Последний экран',
      press: 'Нажмите',
      done: 'UA показан (и скопирован, если возможно)'
    },
    en: {
      title: 'User-Agent',
      show: 'Show',
      show_desc: 'Shows User-Agent and basic environment info. Also tries to copy to clipboard.',
      activity: 'Activity',
      activity2: 'Last screen',
      press: 'Press',
      done: 'UA shown (and copied if possible)'
    },
    ua: {
      title: 'User-Agent',
      show: 'Показати',
      show_desc: 'Показує User-Agent і базову інформацію про оточення. Також намагається скопіювати в буфер.',
      activity: 'Активність',
      activity2: 'Останній екран',
      press: 'Натисніть',
      done: 'UA показано (і скопійовано, якщо можливо)'
    }
  };

  function isDisallowedComponentName(c) {
    c = (c || '').toString().toLowerCase();
    return (
      c.indexOf('player') !== -1 ||
      c.indexOf('settings') !== -1 ||
      c.indexOf('select') !== -1 ||
      c.indexOf('keyboard') !== -1 ||
      c.indexOf('search') !== -1
    );
  }

  function bindActivity() {
    try {
      if (!window.Lampa || !Lampa.Listener || !Lampa.Listener.follow) return false;
      if (bindActivity._bound) return true;
      bindActivity._bound = true;

      Lampa.Listener.follow('activity', function (e) {
        // store last start activity (most useful)
        try {
          if (e && e.type === 'start') {
            last_activity = e;
            last_activity_ts = Date.now();

            // also store last content screen (so we can see it even after opening Settings)
            var c = (e.component || (e.object && e.object.component) || '').toString();
            if (!isDisallowedComponentName(c)) {
              last_content_activity = e;
              last_content_activity_ts = last_activity_ts;
            }
          }
        } catch (err) {}
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  function activitySummary(e, ts) {
    if (!e) return 'n/a';
    var c = '';
    try {
      c = (e.component || (e.object && e.object.component) || e.name || '').toString();
    } catch (e) {}

    var t = '';
    try { t = (e.type || '').toString(); } catch (e2) {}

    var extra = '';
    try {
      extra = (e.url || e.hash || (e.object && e.object.url) || '').toString();
    } catch (e3) {}

    var ago = '';
    try {
      if (ts) {
        var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
        ago = ' (' + s + 's ago)';
      }
    } catch (e4) {}

    var base = [t, c].filter(Boolean).join(' / ');
    if (!base) base = c || t || 'n/a';
    if (extra) base += ' | ' + extra;
    return base + ago;
  }

  function t(key) {
    var l = langCode();
    return (I18N[l] && I18N[l][key]) || I18N.ru[key] || key;
  }

  function safeStorageGet(key, def) {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage.get(key, def);
    } catch (e) {}
    try {
      var v = localStorage.getItem(key);
      return v === null ? def : v;
    } catch (e2) {}
    return def;
  }

  function safeStorageSet(key, val) {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') return Lampa.Storage.set(key, val);
    } catch (e) {}
    try { localStorage.setItem(key, String(val)); } catch (e2) {}
  }

  function platformFlags() {
    var res = [];
    try {
      if (window.Lampa && Lampa.Platform && Lampa.Platform.is) {
        ['android','tizen','webos','orsay','windows','macos','linux','browser'].forEach(function (p) {
          try { if (Lampa.Platform.is(p)) res.push(p); } catch (e) {}
        });
      }
    } catch (e2) {}
    return res.length ? res.join(', ') : 'unknown';
  }

  function canvasSupport() {
    try {
      var c = document.createElement('canvas');
      var ctx = null;
      try { ctx = c.getContext('2d', { alpha: true }); } catch (e) {}
      if (!ctx) { try { ctx = c.getContext('2d'); } catch (e2) {} }
      return !!ctx;
    } catch (e3) {
      return false;
    }
  }

  function getInfo() {
    var lines = [];
    lines.push('UA: ' + (navigator.userAgent || ''));
    lines.push('Lang: ' + (navigator.language || ''));
    lines.push('Platform: ' + platformFlags());
    // Lampa screen/component
    try { bindActivity(); } catch (e0) {}
    lines.push(t('activity') + ': ' + activitySummary(last_activity, last_activity_ts));
    lines.push(t('activity2') + ': ' + activitySummary(last_content_activity, last_content_activity_ts));
    lines.push('DPR: ' + (window.devicePixelRatio || 1));
    lines.push('inner: ' + (window.innerWidth || 0) + 'x' + (window.innerHeight || 0));
    try {
      var de = document.documentElement || {};
      lines.push('client: ' + (de.clientWidth || 0) + 'x' + (de.clientHeight || 0));
    } catch (e) {
      lines.push('client: n/a');
    }
    lines.push('Canvas2D: ' + (canvasSupport() ? 'yes' : 'no'));
    return lines.join('\n');
  }

  function copyToClipboard(text) {
    // best-effort
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) {}
      document.body.removeChild(ta);
      return ok;
    } catch (e3) {}
    return false;
  }

  function showInfo() {
    var info = getInfo();
    try { console.log('[UA MINI]\n' + info); } catch (e) {}

    // Alert works everywhere, including Android TV WebView.
    try { alert(info); } catch (e2) {
      try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(info); } catch (e3) {}
    }

    copyToClipboard(info);
    try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(t('done')); } catch (e4) {}
  }

  function addLangPack() {
    try {
      if (!window.Lampa || !Lampa.Lang || typeof Lampa.Lang.add !== 'function') return;
      Lampa.Lang.add({
        ru: {
          ua_mini_title: I18N.ru.title,
          ua_mini_show: I18N.ru.show,
          ua_mini_show_desc: I18N.ru.show_desc,
          ua_mini_press: I18N.ru.press,
          ua_mini_done: I18N.ru.done,
          ua_mini_activity: I18N.ru.activity,
          ua_mini_activity2: I18N.ru.activity2
        },
        en: {
          ua_mini_title: I18N.en.title,
          ua_mini_show: I18N.en.show,
          ua_mini_show_desc: I18N.en.show_desc,
          ua_mini_press: I18N.en.press,
          ua_mini_done: I18N.en.done,
          ua_mini_activity: I18N.en.activity,
          ua_mini_activity2: I18N.en.activity2
        },
        ua: {
          ua_mini_title: I18N.ua.title,
          ua_mini_show: I18N.ua.show,
          ua_mini_show_desc: I18N.ua.show_desc,
          ua_mini_press: I18N.ua.press,
          ua_mini_done: I18N.ua.done,
          ua_mini_activity: I18N.ua.activity,
          ua_mini_activity2: I18N.ua.activity2
        }
      });
    } catch (e) {}
  }

  function initSettings() {
    if (!window.Lampa || !Lampa.SettingsApi) return;

    try {
      Lampa.SettingsApi.addComponent({
        component: 'ua_mini',
        name: 'ua_mini_title',
        icon: ''
      });

      // Use a select as an "action" (portable across old SettingsApi versions)
      Lampa.SettingsApi.addParam({
        component: 'ua_mini',
        param: {
          name: KEY_SHOW,
          type: 'select',
          values: { 0: 'ua_mini_press', 1: 'ua_mini_show' },
          "default": 0
        },
        field: {
          name: 'ua_mini_show',
          description: 'ua_mini_show_desc'
        }
      });
    } catch (e) {}
  }

  function poll() {
    var last = null;

    function tick() {
      var v = safeStorageGet(KEY_SHOW, 0);
      // normalize
      v = (v === true || v === 'true') ? 1 : v;
      v = parseInt(v, 10);
      if (isNaN(v)) v = 0;

      if (v !== last) last = v;

      if (v === 1) {
        // reset immediately to allow repeated use
        safeStorageSet(KEY_SHOW, 0);
        last = 0;
        showInfo();
      }
      setTimeout(tick, 600);
    }

    tick();
  }

  // Boot
  addLangPack();
  initSettings();
  // try bind early
  try { bindActivity(); } catch (e0) {}
  poll();

})();
