/* ============================================================
   KHALWA — STORAGE LAYER (storage.js)
   Abstraction over localStorage with JSON support, defaults,
   namespacing and safe accessors.
   ============================================================ */
(function (global) {
  'use strict';

  const NS = 'khalwa_v4_';
  const memoryFallback = {};

  // Check availability (Safari private mode throws)
  function lsAvailable() {
    try {
      const t = '__ktest__';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return true;
    } catch (_) { return false; }
  }
  const HAS_LS = lsAvailable();

  function getStore() { return HAS_LS ? localStorage : memoryFallback; }

  function key(k) { return NS + k; }

  function set(k, value) {
    try {
      getStore().setItem(key(k), JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  function get(k, fallback) {
    try {
      const raw = getStore().getItem(key(k));
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (_) { return fallback; }
  }

  function del(k) {
    try { getStore().removeItem(key(k)); } catch (_) {}
  }

  function clearAll() {
    try {
      const store = getStore();
      const toRemove = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.indexOf(NS) === 0) toRemove.push(k);
      }
      toRemove.forEach(k => store.removeItem(k));
    } catch (_) {}
  }

  // ── Application state defaults ─────────────────────────────
  const DEFAULTS = {
    settings: {
      theme: 'light',
      reciter: 'ar.minshawi',
      fontScale: 0,
      showTafsir: true,
      calcMethod: 3,        // Egyptian General Authority of Survey (الهيئة المصرية العامة للمساحة) - AlAdhan API method 3
      school: 0,            // Shafi
      lat: 30.0444,         // Cairo default (القاهرة)
      lng: 31.2357,
      city: 'القاهرة',
      timezone: 'Africa/Cairo',
      onboardingDone: false,
      locationPermissionAsked: false
    },
    stats: {
      streak: 0,
      khalwaCount: 0,
      dhikrCount: 0,
      lastVisit: null,
      lastKhDate: null
    },
    mood: {
      lastPick: null,
      lastIndex: -1
    },
    verse: { day: null, index: -1 }, // for verse-of-the-day rotation
    hadith: { day: null, index: -1 },
    tasbeeh: { current: 0, cycleIdx: 0 },
    adhkarProgress: {}, // tabKey → { id: count }
    bookmarks: [],      // saved ayahs
    history: [],        // last visited surahs
    /* ── النظام الروحاني الجديد ── */
    khatmah: {
      active: null,     // الختمة النشطة الحالية
      history: []       // ختمات مكتملة [{id, finishedAt, days, niyyah}]
    },
    /* { id, goalDays, mode, niyyah, startDate, pagesPerDay, totalRead, lastReadDate, missedDays, logs: {date: pages} } */
    ihsanTree: {
      growthPoints: 0,
      deedsHistory: {}, // { 'YYYY-M-D': {adhkar, fajr, khalwa, tasbeeh, khatmah, quran} }
      lastUpdated: null
    },
    duaJournal: {
      entries: [] // [{id, title, text, category, createdAt, answeredAt}]
    },
    focusMode: {
      todaySessions: 0,
      todayDate: null,
      totalSessions: 0,
      totalMinutes: 0,
      lastSessionDate: null,
      settings: {
        workMin: 25,
        breakMin: 5,
        longBreakMin: 15,
        cyclesBeforeLongBreak: 4,
        ambientSound: 'rain', // 'rain' | 'whitenoise' | 'wind' | 'recitation' | 'silence'
        blockNotifications: true,
        volume: 0.4
      }
    },
    contextReminders: {
      weatherEnabled: true,
      travelEnabled: true,
      routineEnabled: true,
      homeCity: null,         // {name, lat, lng}
      homeLat: null,
      homeLng: null,
      isTraveling: false,
      lastWeather: null,      // {condition, temp, code, time}
      lastWeatherNotify: null,
      lastTravelNotify: null,
      lastWakeNotify: null,
      lastSleepNotify: null
    },
    /* ── بستان الأعمال ── */
    bustan: {
      /* كل نوع نبات له رصيد مستقل */
      plants: {
        quran:   { count: 0, lastDate: null, streak: 0 }, // نخيل 🌴
        charity: { count: 0, lastDate: null, streak: 0 }, // ورود 🌹
        salah:   { count: 0, lastDate: null, streak: 0 }, // سنابل قمح 🌾
        dhikr:   { count: 0, lastDate: null, streak: 0 }  // عنب 🍇
      },
      history: {},          // { 'YYYY-M-D': { quran, charity, salah, dhikr } }
      gardenState: 'fresh', // 'fresh' | 'wilting' | 'dormant' | 'renewed'
      lastUpdated: null,
      lastVisit: null,
      gardenSeed: null      // معرف البذرة العشوائية للحديقة
    },
    /* ── مذكرات التوبة (مشفّرة) ── */
    tawbah: {
      entries: [],          // [{id, encrypted, iv, createdAt, state, stateHistory[], burnedAt?}]
      nightOfTawbah: null,  // ISO date of next scheduled "ليلة التوبة"
      lastNightNotify: null
    }
  };

  // ── تشفير بسيط لدفتر التوبة (XOR + base64) ──────────────
  // ملاحظة: لا يمكن تصدير البيانات من التطبيق — التشفير لمنع القراءة المباشرة من localStorage
  function xorEncrypt(text, pass) {
    if (!text) return '';
    const k = pass || 'khalwa-tawbah-2024';
    let out = '';
    for (let i = 0; i < text.length; i++) {
      out += String.fromCharCode(text.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    try { return btoa(unescape(encodeURIComponent(out))); }
    catch (_) { return out; }
  }
  function xorDecrypt(b64, pass) {
    if (!b64) return '';
    const k = pass || 'khalwa-tawbah-2024';
    let raw;
    try { raw = decodeURIComponent(escape(atob(b64))); }
    catch (_) { raw = b64; }
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    return out;
  }

  function getSettings() {
    return Object.assign({}, DEFAULTS.settings, get('settings', {}));
  }
  function setSettings(s) {
    set('settings', Object.assign({}, getSettings(), s));
  }
  function getStats() {
    return Object.assign({}, DEFAULTS.stats, get('stats', {}));
  }
  function setStats(s) {
    set('stats', Object.assign({}, getStats(), s));
  }

  // ── Public API ─────────────────────────────────────────────
  const Storage = {
    get, set, del, clearAll,
    getSettings, setSettings,
    getStats, setStats,
    xorEncrypt, xorDecrypt,
    DEFAULTS,
    available: HAS_LS
  };

  global.Storage = Storage;
})(window);
