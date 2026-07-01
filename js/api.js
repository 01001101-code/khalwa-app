/* ============================================================
   KHALWA — API LAYER (api.js)
   • Quran reciters (multi-CDN: islamic.network + everyayah + mp3quran)
   • Quran text & audio (alquran.cloud / islamic.network / everyayah / mp3quran)
   • Prayer times (aladhan.com)
   • Qibla calculation (geodesic)
   • Adhan sounds
   • Geocoding (nominatim)
   All functions return Promises with graceful offline fallback.
   ============================================================ */
(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // RECITERS — multi-CDN audio sources
  // src: "cdn128"    => cdn.islamic.network/quran/audio/128/{id}/{absNum}.mp3
  // src: "cdn64"     => cdn.islamic.network/quran/audio/64/{id}/{absNum}.mp3
  // src: "everyayah" => everyayah.com/data/{id}/SSSAAA.mp3  (ayah-by-ayah)
  // src: "mp3quran"  => server{N}.mp3quran.net/{code}/SSS.mp3  (full surah)
  // NOTE: مشاري العفاسي محذوف نهائياً بناءً على طلب المستخدم.
  // ──────────────────────────────────────────────────────────
  const RECITERS = [
    { id: 'ar.minshawi',              name: 'المنشاوي',              src: 'cdn128' },
    { id: 'Minshawy_Mujawwad_64kbps', name: 'المنشاوي المجوّد',      src: 'everyayah' },
    { id: 'ar.husary',                name: 'محمود الحصري',          src: 'cdn128' },
    { id: 'ar.husarymujawwad',        name: 'الحصري المجوّد',        src: 'cdn128' },
    { id: 'Abdul_Basit_Mujawwad_128kbps', name: 'عبد الباسط عبد الصمد', src: 'everyayah' },
    { id: 'ar.abdulbasitmurattal',    name: 'عبد الباسط مرتل',       src: 'cdn64' },
    { id: 'ar.shaatree',              name: 'أبو بكر الشاطري',       src: 'cdn128' },
    { id: 'ar.ahmedajamy',            name: 'أحمد العجمي',           src: 'cdn128' },
    { id: 'ar.saoodshuraym',          name: 'سعود الشريم',           src: 'cdn64' },
    { id: 'Muhammad_Ayyoub_128kbps',  name: 'محمد أيوب',             src: 'everyayah' },
    { id: 'ar.mahermuaiqly',          name: 'ماهر المعيقلي',         src: 'cdn128' },
    { id: 'Nasser_Alqatami_128kbps',  name: 'ناصر القطامي',          src: 'everyayah' },
    { id: 'Yasser_Ad-Dussary_128kbps',name: 'ياسر الدوسري',          src: 'everyayah' },
    { id: 'Ghamadi_40kbps',           name: 'سعد الغامدي',           src: 'everyayah' },
    { id: 'ar.aymanswoaid',           name: 'أيمن سويد',             src: 'cdn64' },
    { id: 'ar.hanirifai',             name: 'هاني الرفاعي',          src: 'cdn64' },
    { id: 'ar.muhammadjibreel',       name: 'محمد جبريل',            src: 'cdn128' },
    { id: 'Muhammad_AbdulKareem_128kbps', name: 'محمد عبدالكريم',    src: 'everyayah' },
    { id: 'Mohammad_al_Tablaway_128kbps', name: 'الطبلاوي (مرتل)',     src: 'everyayah' },
    /* ── الطبلاوي المجوّد (نفس التسجيل — تجويد الطبلاوي معروف) ── */
    { id: 'Mohammad_al_Tablaway_64kbps', name: 'الطبلاوي المجوّد',     src: 'everyayah' },
    /* ── علي جابر (مصدر everyayah — مُختبَر ويعمل) ─ـ */
    { id: 'Ali_Jaber_64kbps', name: 'علي جابر',     src: 'everyayah' },
    { id: 'Fares_Abbad_64kbps',       name: 'فارس عباد',             src: 'everyayah' },
    /* ── mp3quran full-surah reciters (مختبَرة وتعمل) ── */
    { id: 'abkr',  name: 'إدريس أبكر',         src: 'mp3quran', srv: 6,  code: 'abkr' },
    { id: 'jleel', name: 'خالد الجليل',         src: 'mp3quran', srv: 10, code: 'jleel' },
    { id: 'balilah', name: 'بندر بليلة',        src: 'mp3quran', srv: 6,  code: 'balilah' },
    { id: 'lhdan', name: 'محمد الليحدان',       src: 'mp3quran', srv: 8,  code: 'lhdan' },
    /* ── other available reciters ── */
    { id: 'ar.abdurrahmaansudais',    name: 'عبدالرحمن السديس',      src: 'cdn64' },
    { id: 'ar.hudhaify',              name: 'علي الحذيفي',           src: 'cdn128' },
    { id: 'ar.abdullahbasfar',        name: 'عبد الله بصفر',         src: 'cdn64' },
    { id: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps', name: 'خالد القحطاني', src: 'everyayah' },
    { id: 'Abdullah_Matroud_128kbps',  name: 'عبدالله المطرود',       src: 'everyayah' },
  ];

  // ──────────────────────────────────────────────────────────
  // ADHAN SOUNDS — نظام مزدوج: تلاوة صوتية (TTS) + رابط مخصص اختياري
  // نظراً لعدم توفر روابط أذان صوتية موثوقة عبر الإنترنت،
  // نستخدم تقنية TTS لتلاوة نص الأذان بشكل احترافي،
  // مع إمكانية إضافة رابط مخصص لكل مؤذن.
  // ──────────────────────────────────────────────────────────
  const ADHAN_LIST = [
    { id: 'tobar',      name: 'أذان نصر الدين طوبار',          type: 'tts', voice: 'tobar' },
    { id: 'makkah',     name: 'أذان الحرم المكي (علي الملا)',    type: 'tts', voice: 'makkah' },
    { id: 'madinah',    name: 'أذان الحرم المدني (السريحي)',     type: 'tts', voice: 'madinah' },
    { id: 'naqshbandi', name: 'أذان النقشبندي',                 type: 'tts', voice: 'naqshbandi' },
    { id: 'abdulbasit', name: 'أذان عبد الباسط عبد الصمد',      type: 'tts', voice: 'abdulbasit' },
    { id: 'refat',      name: 'أذان محمد رفعت',                 type: 'tts', voice: 'refat' },
    { id: 'mulla',      name: 'أذان الملا',                     type: 'tts', voice: 'mulla' },
    { id: 'sirihi',     name: 'أذان عبد المجيد السريحي',         type: 'tts', voice: 'sirihi' }
  ];

  // ملفات تعريف الأصوات (سرعة، طبقة، وقفات) لكل مؤذن
  const ADHAN_VOICES = {
    tobar:      { rate: 0.65, pitch: 0.85, gap: 350 },  // نصر الدين طوبار - بطيء ومهدّئ
    makkah:     { rate: 0.72, pitch: 0.95, gap: 280 },  // علي الملا - متوسط
    madinah:    { rate: 0.70, pitch: 0.90, gap: 320 },  // السريحي - متوسط
    naqshbandi: { rate: 0.60, pitch: 0.80, gap: 400 },  // النقشبندي - بطيء وعميق
    abdulbasit: { rate: 0.68, pitch: 0.88, gap: 350 },  // عبد الباسط - مجوّد
    refat:      { rate: 0.63, pitch: 0.82, gap: 380 },  // محمد رفعت - بطيء كلاسيكي
    mulla:      { rate: 0.75, pitch: 1.00, gap: 250 },  // الملا - أسرع
    sirihi:     { rate: 0.70, pitch: 0.92, gap: 300 }   // السريحي - متوسط
  };

  // نص الأذان الكامل (الصلاوات العادية + الفجر)
  const ADHAN_TEXT_REGULAR = [
    'اللهُ أكبر، اللهُ أكبر',
    'اللهُ أكبر، اللهُ أكبر',
    'أشهدُ أن لا إله إلا الله',
    'أشهدُ أن لا إله إلا الله',
    'أشهدُ أن محمداً رسولُ الله',
    'أشهدُ أن محمداً رسولُ الله',
    'حيَّ على الصلاة',
    'حيَّ على الصلاة',
    'حيَّ على الفلاح',
    'حيَّ على الفلاح',
    'اللهُ أكبر، اللهُ أكبر',
    'لا إله إلا الله'
  ];
  const ADHAN_TEXT_FAJR = [
    'اللهُ أكبر، اللهُ أكبر',
    'اللهُ أكبر، اللهُ أكبر',
    'أشهدُ أن لا إله إلا الله',
    'أشهدُ أن لا إله إلا الله',
    'أشهدُ أن محمداً رسولُ الله',
    'أشهدُ أن محمداً رسولُ الله',
    'حيَّ على الصلاة',
    'حيَّ على الصلاة',
    'حيَّ على الفلاح',
    'حيَّ على الفلاح',
    'الصلاةُ خيرٌ من النوم',
    'الصلاةُ خيرٌ من النوم',
    'اللهُ أكبر، اللهُ أكبر',
    'لا إله إلا الله'
  ];

  // Fajr-specific adhan (default: نصر الدين طوبار)
  const FAJR_ADHAN_DEFAULT = 'tobar';

  // ──────────────────────────────────────────────────────────
  // PRE-PRAYER REMINDER — حي على الصلاة (يُلقى عبر TTS)
  // ──────────────────────────────────────────────────────────
  const PRE_PRAYER_REMINDER_TEXT = 'حيَّ على الصلاة، حيَّ على الفلاح. اللهُ أكبر، اللهُ أكبر. لا إله إلا الله.';
  const PRE_PRAYER_REMINDER_LABEL = 'حي على الصلاة — تذكير صوتي';

  // ──────────────────────────────────────────────────────────
  // AYAH-NUMBER LOOKUP TABLE (absolute → surah:ayahInSurah)
  // ──────────────────────────────────────────────────────────
  let _ayahLookup = null;

  function buildAyahLookup() {
    if (_ayahLookup) return _ayahLookup;
    _ayahLookup = {};
    const surahs = global.SURAHS || [];
    let absNum = 1;
    for (const s of surahs) {
      for (let a = 1; a <= s.ayahs; a++) {
        _ayahLookup[absNum] = { surah: s.n, ayah: a };
        absNum++;
      }
    }
    return _ayahLookup;
  }

  // ──────────────────────────────────────────────────────────
  // ENDPOINTS
  // ──────────────────────────────────────────────────────────
  const EP = {
    surahList:   'https://api.alquran.cloud/v1/surah',
    ayahText:    (n) => `https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`,
    ayahTafsir:  (n) => `https://api.alquran.cloud/v1/surah/${n}/ar.muyassar`,
    cdn128:      (id, absNum) => `https://cdn.islamic.network/quran/audio/128/${id}/${absNum}.mp3`,
    cdn64:       (id, absNum) => `https://cdn.islamic.network/quran/audio/64/${id}/${absNum}.mp3`,
    everyayah:   (id, surahNum, ayahNum) =>
      `https://www.everyayah.com/data/${id}/${String(surahNum).padStart(3,'0')}${String(ayahNum).padStart(3,'0')}.mp3`,
    mp3quran:    (srv, code, surahNum) =>
      `https://server${srv}.mp3quran.net/${code}/${String(surahNum).padStart(3,'0')}.mp3`,
    audioSurah:  (id, n) => `https://cdn.islamic.network/quran/audiosurah/${id}/${n}.mp3`,
    prayerTimes: (lat, lng, method, school, date) =>
      `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`,
    reverseGeo:  (lat, lng) =>
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
    searchGeo:   (q) =>
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&accept-language=ar&limit=5`
  };

  const KAABA = { lat: 21.4225, lng: 39.8262 };

  // ──────────────────────────────────────────────────────────
  // NETWORK HELPERS
  // ──────────────────────────────────────────────────────────
  function timeoutFetch(url, opts = {}, ms = 12000) {
    return new Promise((resolve, reject) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => { ctrl.abort(); reject(new Error('timeout')); }, ms);
      fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
        .then(r => { clearTimeout(t); resolve(r); })
        .catch(e => { clearTimeout(t); reject(e); });
    });
  }

  async function getJSON(url, ms) {
    try {
      const r = await timeoutFetch(url, {}, ms);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────
  // QURAN
  // ──────────────────────────────────────────────────────────
  async function fetchSurah(n) {
    const [textRes, tafsirRes] = await Promise.all([
      getJSON(EP.ayahText(n)),
      getJSON(EP.ayahTafsir(n))
    ]);
    if (!textRes || !textRes.data || !textRes.data.ayahs) return null;
    const ayahs = textRes.data.ayahs;
    const tafsirAyahs = (tafsirRes && tafsirRes.data && tafsirRes.data.ayahs) || [];
    return ayahs.map((a, i) => ({
      num: a.numberInSurah,
      absNum: a.number,
      text: a.text,
      tafsir: tafsirAyahs[i] ? tafsirAyahs[i].text : '',
      sajdah: a.sajda || false,
      juz: a.juz,
      page: a.page
    }));
  }

  function ayahAudioURL(reciterObj, absNum, surahNum, ayahInSurah) {
    if (!reciterObj) return '';
    const src = reciterObj.src || 'cdn128';
    switch (src) {
      case 'cdn128':
        return EP.cdn128(reciterObj.id, absNum);
      case 'cdn64':
        return EP.cdn64(reciterObj.id, absNum);
      case 'everyayah':
        if (surahNum && ayahInSurah) {
          return EP.everyayah(reciterObj.id, surahNum, ayahInSurah);
        }
        var lookup = buildAyahLookup();
        var info = lookup[absNum];
        if (info) return EP.everyayah(reciterObj.id, info.surah, info.ayah);
        return EP.cdn128(reciterObj.id, absNum);
      case 'mp3quran':
        // mp3quran is full-surah only; return surah URL
        return EP.mp3quran(reciterObj.srv, reciterObj.code, surahNum || 1);
      default:
        return EP.cdn128(reciterObj.id, absNum);
    }
  }

  /** Full-surah audio URL — supports all source types. */
  function surahAudioURL(reciterObj, surahNum) {
    if (!reciterObj) return '';
    var src = reciterObj.src || 'cdn128';
    if (src === 'mp3quran') {
      return EP.mp3quran(reciterObj.srv, reciterObj.code, surahNum);
    }
    return EP.audioSurah(reciterObj.id, surahNum);
  }

  function ayahShareURL(surahNum, ayahNum) {
    return `https://quran.com/${surahNum}/${ayahNum}`;
  }

  function getReciter(id) {
    return RECITERS.find(r => r.id === id) || RECITERS[0];
  }

  // ──────────────────────────────────────────────────────────
  // PRAYER TIMES
  // ──────────────────────────────────────────────────────────
  async function fetchPrayerTimes(lat, lng, method, school) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = today.getFullYear();
    const date = `${dd}-${mm}-${yy}`;
    const res = await getJSON(EP.prayerTimes(lat, lng, method, school, date));
    if (!res || !res.data) return null;
    const t = res.data.timings;
    const hijri = res.data.date && res.data.date.hijri
      ? `${res.data.date.hijri.day} ${res.data.date.hijri.month.ar} ${res.data.date.hijri.year}هـ`
      : '';
    return {
      Fajr:    cleanTime(t.Fajr),
      Sunrise: cleanTime(t.Sunrise),
      Dhuhr:   cleanTime(t.Dhuhr),
      Asr:     cleanTime(t.Asr),
      Maghrib: cleanTime(t.Maghrib),
      Isha:    cleanTime(t.Isha),
      date,
      hijri
    };
  }

  function cleanTime(s) {
    if (!s) return '--:--';
    return String(s).split(' ')[0];
  }

  // ──────────────────────────────────────────────────────────
  // QIBLA
  // ──────────────────────────────────────────────────────────
  function qiblaBearing(lat, lng) {
    const φ1 = toRad(lat);
    const φ2 = toRad(KAABA.lat);
    const Δλ = toRad(KAABA.lng - lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  }

  function qiblaDistance(lat, lng) {
    const R = 6371;
    const φ1 = toRad(lat);
    const φ2 = toRad(KAABA.lat);
    const Δφ = toRad(KAABA.lat - lat);
    const Δλ = toRad(KAABA.lng - lng);
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  // ──────────────────────────────────────────────────────────
  // GEOCODING
  // ──────────────────────────────────────────────────────────
  async function reverseGeocode(lat, lng) {
    const data = await getJSON(EP.reverseGeo(lat, lng));
    if (!data || !data.address) return { city: 'موقعك الحالي', country: '' };
    const a = data.address;
    const city = a.city || a.town || a.village || a.county || a.state || 'موقعك الحالي';
    const country = a.country || '';
    return { city, country };
  }

  async function searchCities(query) {
    if (!query || query.length < 2) return [];
    const data = await getJSON(EP.searchGeo(query), 8000);
    if (!data || !Array.isArray(data)) return [];
    return data.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      name: r.display_name ? r.display_name.split(',').slice(0, 3).join('،') : 'موقع'
    }));
  }

  // ──────────────────────────────────────────────────────────
  // PRAYER CALCULATION METHODS
  // ──────────────────────────────────────────────────────────
  const CALC_METHODS = [
    { id: 1, name: 'رابطة العالم الإسلامي' },
    { id: 2, name: 'الهيئة الإسلامية لأمريكا الشمالية (ISNA)' },
    { id: 3, name: 'مصر - الهيئة المصرية العامة للمساحة' },
    { id: 4, name: 'أم القرى - مكة المكرمة' },
    { id: 5, name: 'الجامعة الإسلامية بالمدينة المنورة' },
    { id: 8, name: 'الخليج - الكويت' },
    { id: 9, name: 'قطر' },
    { id: 10, name: 'سنغافورة' },
    { id: 12, name: 'فرنسا' },
    { id: 13, name: 'تركيا - ديانت' },
    { id: 14, name: 'روسيا' },
    { id: 15, name: 'موهميت (ألمانيا/ديانة)' },
    { id: 16, name: 'تونس' },
    { id: 17, name: 'الجزائر' },
    { id: 18, name: 'الكويت (محمدية)' },
    { id: 19, name: 'دبي' },
    { id: 21, name: 'جمعية الجالية الإسلامية بأمريكا الشمالية' },
    { id: 23, name: 'الهيئة الإسلامية بأمريكا الشمالية (طلاق)' }
  ];

  // ──────────────────────────────────────────────────────────
  // ADHAN HELPER — يرجع بيانات الأذان المختار
  // ──────────────────────────────────────────────────────────
  function getAdhanInfo(adhanId) {
    const a = ADHAN_LIST.find(x => x.id === adhanId);
    return a || ADHAN_LIST[0];
  }

  // ──────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────
  global.API = {
    RECITERS,
    ADHAN_LIST,
    ADHAN_VOICES,
    ADHAN_TEXT_REGULAR,
    ADHAN_TEXT_FAJR,
    FAJR_ADHAN_DEFAULT,
    PRE_PRAYER_REMINDER_TEXT,
    PRE_PRAYER_REMINDER_LABEL,
    CALC_METHODS,
    KAABA,
    fetchSurah,
    ayahAudioURL,
    getReciter,
    surahAudioURL,
    ayahShareURL,
    fetchPrayerTimes,
    qiblaBearing,
    qiblaDistance,
    reverseGeocode,
    searchCities,
    getAdhanInfo
  };
})(window);
