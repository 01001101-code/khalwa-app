/* ============================================================
   KHALWA — CONTEXT-AWARE REMINDERS (context-reminders.js)
   التذكير السياقي الذكي:
   1) الطقس (Open-Meteo — مجاني بدون مفتاح API) → دعاء المطر/الريح/الحر
   2) الموقع GPS → إذا ابتعد عن مدينته يُذكّر بأذكار السفر وأحكام القصر
   3) الوقت والروتين → أذكار الاستيقاظ/النوم حسب وقت فتح التطبيق
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.Storage;

  function $(id) { return document.getElementById(id); }
  function arabicDigits(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    const map = '٠١٢٣٤٥٦٧٨٩';
    return String(n).replace(/\d/g, d => map[+d]);
  }
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ─────────── أكواد الطقس (WMO) → وصف عربي + نوع ─────────── */
  // مرجع: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
  const WMO_CODES = {
    0:  { label: 'صحو',            icon: '☀️', type: 'clear' },
    1:  { label: 'صحو غالباً',      icon: '🌤️', type: 'clear' },
    2:  { label: 'غائم جزئياً',     icon: '⛅', type: 'cloudy' },
    3:  { label: 'غائم',            icon: '☁️', type: 'cloudy' },
    45: { label: 'ضباب',            icon: '🌫️', type: 'fog' },
    48: { label: 'ضباب كثيف',       icon: '🌫️', type: 'fog' },
    51: { label: 'رذاذ خفيف',       icon: '🌦️', type: 'rain' },
    53: { label: 'رذاذ',            icon: '🌦️', type: 'rain' },
    55: { label: 'رذاذ كثيف',       icon: '🌧️', type: 'rain' },
    56: { label: 'رذاذ متجمد',      icon: '🌧️', type: 'rain' },
    57: { label: 'رذاذ متجمد كثيف', icon: '🌧️', type: 'rain' },
    61: { label: 'مطر خفيف',        icon: '🌦️', type: 'rain' },
    63: { label: 'مطر',             icon: '🌧️', type: 'rain' },
    65: { label: 'مطر غزير',        icon: '🌧️', type: 'rain' },
    66: { label: 'مطر متجمد',       icon: '🌧️', type: 'rain' },
    67: { label: 'مطر متجمد غزير',  icon: '🌧️', type: 'rain' },
    71: { label: 'ثلج خفيف',        icon: '🌨️', type: 'snow' },
    73: { label: 'ثلج',             icon: '❄️', type: 'snow' },
    75: { label: 'ثلج كثيف',        icon: '❄️', type: 'snow' },
    77: { label: 'حبيبات ثلج',      icon: '❄️', type: 'snow' },
    80: { label: 'زخات مطر',        icon: '🌧️', type: 'rain' },
    81: { label: 'زخات مطر قوية',   icon: '🌧️', type: 'rain' },
    82: { label: 'زخات مطر عنيفة',  icon: '⛈️', type: 'storm' },
    85: { label: 'زخات ثلج',        icon: '🌨️', type: 'snow' },
    86: { label: 'زخات ثلج قوية',   icon: '❄️', type: 'snow' },
    95: { label: 'عاصفة رعدية',     icon: '⛈️', type: 'storm' },
    96: { label: 'عاصفة رعدية ببرق',icon: '⛈️', type: 'storm' },
    99: { label: 'عاصفة رعدية شديدة',icon: '⛈️', type: 'storm' }
  };

  /* ─────────── الأدعية المناسبة لكل حالة طقس ─────────── */
  // شاملة لكل الأحوال: صحو، غيوم، مطر، رياح، حر، برد، ضباب، ثلج، رعد
  const WEATHER_DUA = {
    // ☀️ الصحو — شكر وحمد على نعمة الصحو
    clear: {
      title: '☀️ دعاء الصحو والصفاء',
      text: 'اللَّهُمَّ اجعل صباحنا نوراً، ومساءنا نوراً، واجعل لنا في كل يومٍ من فرحك نصيباً. الحمد لله الذي كسانا من نوره وسترنا من حرّه وبرده',
      extra: '«مَنْ لَمْ يَشْكُرِ النَّاسَ لَمْ يَشْكُرِ اللَّهَ» — رواه أبو داود. فكيف بشكره على نعمه الظاهرة كالشمس والصحو؟'
    },
    // ⛅ الغيوم — دعاء البركة في الغيث والرحمة
    cloudy: {
      title: '⛅ دعاء الغيم والغيث',
      text: 'اللَّهُمَّ اجعله غيثاً رحمة، ولا تجعله غيثاً عذاب. اللَّهُمَّ حوالينا ولا علينا، اللَّهُمَّ على الآكام والظراب وبطون الأودية ومنابت الشجر',
      extra: 'كان النبي ﷺ إذا رأى غيماً أو ريحاً عُرف ذلك في وجهه، فيقول: «اللهم إني أعوذ بك من شر ما أُرسل فيه»'
    },
    // 🌧️ المطر — دعاء المطر
    rain: {
      title: '🌧️ دعاء المطر',
      text: 'اللَّهُمَّ صَيِّباً نافعاً، اللَّهُمَّ اجعله غيثاً مغيثاً، اللهم سقيا رحمة ولا سقيا عذاب، اللهم اجعله سُقيا رحمة',
      extra: 'كان النبي ﷺ إذا مُطِروا قال: «اللهم صيباً هنيئاً». ويُسنّ أن يُخرج الإنسان بعض ثيابه ليلتمس رحمة الله في المطر'
    },
    // ⛈️ العاصفة الرعدية — دعاء الرعد والريح
    storm: {
      title: '⛈️ دعاء الرعد والعاصفة',
      text: 'اللَّهُمَّ إني أسألك خيرها، وأعوذ بك من شرها وما فيها وما أُرسلت به. سُبْحَانَ الَّذِي يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ وَالْمَلَائِكَةُ مِنْ خِيفَتِهِ',
      extra: 'كان النبي ﷺ إذا سمع الرعد قال: «سبحان الذي يسبح الرعد بحمده والملائكة من خيفته». وإذا هاجت الريح قال: «اللهم إني أسألك خيرها وخير ما فيها وخير ما أُرسلت به، وأعوذ بك من شرها»'
    },
    // ❄️ الثلج — دعاء البرد والزمهرير
    snow: {
      title: '❄️ دعاء البرد والزمهرير',
      text: 'اللَّهُمَّ ارفع عنا البرد والزمهرير، وكن لنا غوثاً وكهفاً، واجعل ما أنزلت لنا رحمة لا عذاباً. اللهم إنا نعوذ بك من زمهرير الجنة وزمهرير النار',
      extra: 'كان النبي ﷺ إذا كان يوم ريح أو بركان دعَا: «اللهم إني أسألك خير ما في هذا اليوم وخير ما بعده، وأعوذ بك من شر ما في هذا اليوم وشر ما بعده»'
    },
    // 🌫️ الضباب — دعاء نور الدرب
    fog: {
      title: '🌫️ دعاء الضباب',
      text: 'اللَّهُمَّ نوّر دروبنا، واهدنا سواء السبيل، واجعل لنا في كل ظلمة نوراً، وفي كل شدة فرجاً. ربنا آتنا من لدنك رحمة وهيّئ لنا من أمرنا رشداً',
      extra: 'الضباب تذكير بظلمات الدنيا ونور الإيمان. ﴿اللَّهُ وَلِيُّ الَّذِينَ آمَنُوا يُخْرِجُهُم مِّنَ الظُّلُمَاتِ إِلَى النُّورِ﴾'
    }
  };

  /* ─────────── أدعية الحرّ الشديد والبرد الشديد (تحتاج درجة الحرارة) ─────────── */
  const TEMP_DUA = {
    // 🥵 الحر الشديد (>38°C)
    extremeHeat: {
      title: '🥵 دعاء الحرّ الشديد',
      text: 'اللَّهُمَّ ارفع عنا حرّ الجنة وحرّ النار، وحرّ الدنيا وهمّ الدنيا. اللهم أبرِد قلوبنا بمعرفتك، وأرِح أبداننا برحمتك',
      extra: 'قال النبي ﷺ: «اشتكت النار إلى ربها فقالت: يا رب أكل بعضي بعضاً، فأذن لها بنفسين: نفس في الشتاء ونفس في الصيف، فأشدّ ما تجدون من البرد من زمهريرها، وأشدّ ما تجدون من الحر من سمومها» — متفق عليه'
    },
    // 🥶 البرد الشديد (<5°C)
    extremeCold: {
      title: '🥶 دعاء البرد الشديد',
      text: 'اللَّهُمَّ ارفع عنا زمهرير البرد، واكفنا مؤونة الشتاء، وارزقنا الدفء في الأبدان والقلوب بذكرك. اللهم استر عوراتنا وآمن روعاتنا',
      extra: 'كان عمر بن الخطاب رضي الله عنه يدعو في الشتاء: «اللهم إن كان رزقي في السماء فأنزله، وإن كان في الأرض فأخرجه»'
    },
    // 🌡️ المعتدل
    mild: null
  };

  /* ─────────── أذكار السفر وأحكام القصر والجمع (شامل) ─────────── */
  const TRAVEL_DHIKR = {
    boarding: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ، وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
    boardingSrc: 'الزخرف: 13-14',
    enteringVehicle: 'بِسْمِ اللهِ، الحَمْدُ للهِ، سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا',
    travelDua: 'اللَّهُمَّ إنا نسألك في سفرنا هذا البرَّ والتقوى، ومن العمل ما ترضى، اللهم هون علينا سفرنا هذا واطوِ عنا بُعده',
    travelDuaSrc: 'رواه مسلم',
    returning: 'آيبون تائبون عابدون لربنا حامدون',
    returningSrc: 'متفق عليه',
    enteringCity: 'اللهم بارك لنا فيما نزلنا، ونعوذ بك من شر هذا المنزل وشر أهله',
    enteringCitySrc: 'أدعية السنة',
    qasarInfo: 'يُشرع للمسافر قصر الصلاة الرباعية (الظهر، العصر، العشاء) فتصلى ركعتين بدلاً من أربع، إذا كانت مسافة السفر ≥ ٨٠ كم تقريباً (مسافة القصر). ويبدأ القصر من مغادرة عمران بلدته حتى يعود إليها.',
    jamInfo: 'يجوز للمسافر الجمع بين الصلاتين (جمع تقديم أو تأخير) لرفع الحرج: الجمع بين الظهر والعصر، وبين المغرب والعشاء. والجمع بالعصر أو المغرب أيسر.',
    travelEtiquette: 'آداب السفر: ١) التوبة قبل السفر ٢) التوكّل على الله ٣) اختيار الرفيق الصالح ٤) كثرة الذكر والدعاء ٥) الإكثار من الطاعة ٦) الصدقة قبل السفر ٧) رد المظالم',
    travelMilestones: 'مواقيت الذكر في السفر: عند الركوب، عند النزول، عند دخول البلد، عند الرجوع، في كل صلاة قصراً، عند الخوف، عند الفرح، عند الحزن.'
  };

  /* ─────────── تذكيرات لطيفة حسب مرحلة السفر ─────────── */
  const TRAVEL_PHASES = {
    departing: {
      title: '🧳 بدأت رحلتك',
      icon: '🧳',
      message: 'وفّقك الله في سفرك، وجعله سفراً مباركاً. لا تنسَ أذكار الركوب وأحكام القصر.',
      dua: TRAVEL_DHIKR.boarding,
      duaSrc: TRAVEL_DHIKR.boardingSrc,
      tips: [
        'صَلِّ ركعتين قبل خروجك',
        'اقرأ آية الكرسي على نفسك وأهلك ومالك',
        'وكّل على الله في كل خطوة'
      ]
    },
    traveling: {
      title: '🚗 أنت في الطريق',
      icon: '🚗',
      message: 'تذكّر أنك في سفر، فيُشرع لك قصر الصلاة وجمعها رفعاً للحرج. اجعل سفرك في طاعة الله.',
      dua: TRAVEL_DHIKR.travelDua,
      duaSrc: TRAVEL_DHIKR.travelDuaSrc,
      tips: [
        'الظهر والعصر: ركعتان ركعتان (قصر)',
        'العشاء: ركعتان بدل أربع',
        'يجوز الجمع بين الظهر والعصر، والمغرب والعشاء',
        'أكثر من الدعاء، فدعوة المسافر مستجابة'
      ]
    },
    arriving: {
      title: '📍 وصلت بلداً جديداً',
      icon: '📍',
      message: 'بارك الله لك في نزولك. لا تنسَ دعاء النزول وأذكار دخول المكان.',
      dua: TRAVEL_DHIKR.enteringCity,
      duaSrc: TRAVEL_DHIKR.enteringCitySrc,
      tips: [
        'قل: «اللهم إني أعوذ بك من شر هذا المنزل»',
        'صلِّ ركعتين عند نزولك',
        'إن كنت ستقيم أكثر من 4 أيام، أتمّ الصلاة'
      ]
    },
    returning: {
      title: '🏠 عوداً حميداً',
      icon: '🏠',
      message: 'الحمد لله على سلامة العودة. عُدتَ إلى بلدك، فعُد إلى إقامة الصلاة كاملة، واحمد الله على نعمته.',
      dua: TRAVEL_DHIKR.returning,
      duaSrc: TRAVEL_DHIKR.returningSrc,
      tips: [
        'صلِّ ركعتين شكراً لله على السلامة',
        'عُد إلى الصلاة تامة (٤ ركعات في الرباعية)',
        'احمد الله وأكثر من الاستغفار'
      ]
    }
  };

  /* ─────────── أذكار الاستيقاظ/النوم حسب الوقت ─────────── */
  const WAKE_DHIKR = 'الحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ';
  const SLEEP_DHIKR = 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا';

  /* ─────────── الحالة ─────────── */
  function getData() {
    return S.get('contextReminders', S.DEFAULTS.contextReminders);
  }
  function saveData(patch) {
    const data = getData();
    Object.assign(data, patch);
    S.set('contextReminders', data);
  }

  /* ─────────── مسافة بين نقطتين (Haversine) ─────────── */
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* ════════════════════════════════════════════
      1) الطقس (Open-Meteo)
     ════════════════════════════════════════════ */
  async function fetchWeather(lat, lng) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('weather fetch failed');
    const data = await resp.json();
    return {
      temp: data.current?.temperature_2m,
      code: data.current?.weather_code,
      wind: data.current?.wind_speed_10m,
      time: new Date().toISOString()
    };
  }

  async function checkWeather() {
    const data = getData();
    if (!data.weatherEnabled) return null;
    const settings = S.getSettings();
    const lat = settings.lat, lng = settings.lng;
    if (!lat || !lng) return null;

    // لا تتكرر الإشعارات في نفس اليوم لنفس نوع الطقس
    const today = todayKey();
    if (data.lastWeatherNotify === today && data.lastWeather) {
      return data.lastWeather;
    }

    try {
      const w = await fetchWeather(lat, lng);
      const wmo = WMO_CODES[w.code] || { label: 'غير معروف', icon: '🌡️', type: 'clear' };
      // تحديد نوع الطقس الكامل (مع اعتبار الحرارة)
      let fullType = wmo.type;
      let duaObj = WEATHER_DUA[wmo.type];

      // فحص درجة الحرارة: حر شديد أو برد شديد له أدعية خاصة
      const temp = w.temp;
      let tempDua = null;
      if (temp != null) {
        if (temp >= 38) tempDua = TEMP_DUA.extremeHeat;
        else if (temp <= 5) tempDua = TEMP_DUA.extremeCold;
      }

      // نختار دعاء الحرارة إن وُجد، وإلا فدعاء الطقس
      const chosenDua = tempDua || duaObj;

      const result = { ...w, ...wmo, tempDua: !!tempDua };
      saveData({ lastWeather: result });

      // إرسال إشعار يومي بحالة الطقس (شامل لكل الأحوال)
      if (chosenDua) {
        showWeatherNotification(chosenDua, result);
        saveData({ lastWeatherNotify: today });
      }
      return result;
    } catch (e) {
      console.warn('Weather fetch failed:', e);
      return null;
    }
  }

  function shouldNotifyWeather(type) {
    // نُذكّر بكل أنواع الطقس: صحو، غيوم، مطر، رياح، حر، برد، ضباب، ثلج، رعد
    return ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'].includes(type);
  }

  function showWeatherNotification(dua, weather) {
    if (global.KHALWA?.toast) {
      global.KHALWA.toast(`${dua.title} — ${weather.label} ${weather.icon}`, 'info', 6000);
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(dua.title, {
          body: dua.text,
          icon: undefined,
          tag: 'weather-dua'
        });
      } catch (_) {}
    }
    // اعرض أيضاً في بطاقة الواجهة
    showContextCard('weather', { dua, weather });
  }

  /* ════════════════════════════════════════════
      2) الموقع / السفر — تتبع حقيقي مستمر
      نستخدم watchPosition للتتبع المستمر بدلاً من getCurrentPosition.
      يكتشف 4 مراحل: departing, traveling, arriving, returning
     ════════════════════════════════════════════ */
  let watchId = null;
  let lastPosition = null;
  let currentTravelPhase = null;

  function setHomeLocation(city, lat, lng) {
    saveData({
      homeCity: city,
      homeLat: lat,
      homeLng: lng,
      isTraveling: false,
      currentTravelPhase: null,
      lastTravelNotify: null
    });
  }

  /**
   * تعيين الموقع الحالي كموقع أساسي (home) للمستخدم
   * يُستدعى عند بدء التطبيق أو من زر "تحديد موقعي"
   */
  function setHomeFromCurrentLocation() {
    if (!navigator.geolocation) {
      return Promise.resolve({ ok: false, reason: 'no-geolocation' });
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          // عكس الترميز للحصول على اسم المدينة
          let cityName = 'موقعي الحالي';
          try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=ar`);
            const data = await resp.json();
            const addr = data.address || {};
            cityName = addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || 'موقعي الحالي';
            if (addr.country) cityName = `${cityName}، ${addr.country}`;
          } catch (_) {}
          setHomeLocation(cityName, lat, lng);
          // تحديث إعدادات الصلاة أيضاً
          const settings = S.getSettings();
          S.setSettings({
            lat, lng,
            city: cityName,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || settings.timezone
          });
          resolve({ ok: true, city: cityName, lat, lng });
        },
        (err) => resolve({ ok: false, reason: err.message || 'permission-denied' }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  /**
   * بدء التتبع المستمر للموقع — يكتشف السفر تلقائياً
   */
  function startTravelWatch() {
    const data = getData();
    if (!data.travelEnabled) return;
    if (!data.homeLat) return;
    if (!navigator.geolocation) return;
    // لا تُنشئ watch مكرراً
    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosition = pos;
        handlePositionUpdate(pos);
      },
      (err) => {
        // تجاهل الأخطاء العابرة، فقط سجّلها
        console.warn('Travel watch error:', err.message);
      },
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
    );
  }
  function stopTravelWatch() {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function handlePositionUpdate(pos) {
    const data = getData();
    if (!data.travelEnabled || !data.homeLat) return;

    const dist = haversine(data.homeLat, data.homeLng, pos.coords.latitude, pos.coords.longitude);
    const today = todayKey();
    const wasTraveling = !!data.isTraveling;

    if (dist >= 80) {
      // مسافة سفر
      const phase = determineTravelPhase(dist, wasTraveling, pos.coords.speed);
      if (!wasTraveling) {
        // بدء سفر جديد
        saveData({
          isTraveling: true,
          currentTravelPhase: 'departing',
          travelStartTime: new Date().toISOString(),
          lastTravelNotify: today,
          currentDistance: dist
        });
        showTravelNotification(phase, dist);
      } else {
        // سفر جارٍ — حدّث المسافة
        saveData({ currentDistance: dist });
        // أرسل تذكير "في الطريق" مرة كل ساعتين كحد أقصى
        const lastNotifyTime = data.lastTravelInProgressNotify;
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
        if (!lastNotifyTime || new Date(lastNotifyTime).getTime() < twoHoursAgo) {
          if (currentTravelPhase !== 'traveling') {
            currentTravelPhase = 'traveling';
            saveData({ currentTravelPhase: 'traveling', lastTravelInProgressNotify: new Date().toISOString() });
            showTravelNotification(TRAVEL_PHASES.traveling, dist);
          }
        }
      }
    } else {
      // عودة إلى مدينته
      if (wasTraveling) {
        saveData({
          isTraveling: false,
          currentTravelPhase: null,
          currentDistance: dist,
          travelEndTime: new Date().toISOString()
        });
        showTravelNotification(TRAVEL_PHASES.returning, dist);
      }
    }
  }

  function determineTravelPhase(dist, wasTraveling, speed) {
    if (!wasTraveling) return TRAVEL_PHASES.departing;
    if (speed != null && speed > 5) return TRAVEL_PHASES.traveling;
    return TRAVEL_PHASES.traveling;
  }

  function showTravelNotification(phase, distance) {
    if (global.KHALWA?.toast) {
      global.KHALWA.toast(`${phase.icon} ${phase.title} — ${arabicDigits(Math.round(distance))} كم`, 'info', 7000);
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(phase.title, {
          body: phase.message,
          tag: 'travel-phase'
        });
      } catch (_) {}
    }
    showContextCard('travel', { phase, distance });
  }

  /**
   * فحص فوري للسفر (يُستدعى عند فتح صفحة المحراب)
   */
  async function checkTravel() {
    const data = getData();
    if (!data.travelEnabled || !data.homeLat) return null;
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePositionUpdate(pos);
          const updated = getData();
          resolve({
            traveling: !!updated.isTraveling,
            distance: updated.currentDistance || haversine(updated.homeLat, updated.homeLng, pos.coords.latitude, pos.coords.longitude),
            phase: updated.currentTravelPhase
          });
        },
        (err) => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  /* ════════════════════════════════════════════
      3) الروتين — الاستيقاظ/النوم
     ════════════════════════════════════════════ */
  function checkRoutine() {
    const data = getData();
    if (!data.routineEnabled) return;
    const hour = new Date().getHours();
    const today = todayKey();

    // الاستيقاظ: 4-9 صباحاً
    if (hour >= 4 && hour < 9 && data.lastWakeNotify !== today) {
      saveData({ lastWakeNotify: today });
      showRoutineCard('wake');
    }
    // النوم: 22-2 ليلاً
    else if ((hour >= 22 || hour < 2) && data.lastSleepNotify !== today) {
      saveData({ lastSleepNotify: today });
      showRoutineCard('sleep');
    }
  }

  function showRoutineCard(type) {
    if (type === 'wake') {
      if (global.KHALWA?.toast) {
        global.KHALWA.toast('☀️ صباح الخير — ابدأ يومك بأذكار الاستيقاظ', 'info', 4500);
      }
      showContextCard('wake', { dua: WAKE_DHIKR });
    } else {
      if (global.KHALWA?.toast) {
        global.KHALWA.toast('🌙 مساء الخير — اختم يومك بأذكار النوم', 'info', 4500);
      }
      showContextCard('sleep', { dua: SLEEP_DHIKR });
    }
  }

  /* ════════════════════════════════════════════
      بطاقات سياقية في الواجهة
     ════════════════════════════════════════════ */
  const contextCards = []; // بطاقات نشطة

  function showContextCard(type, payload) {
    contextCards.unshift({ type, payload, time: new Date() });
    if (contextCards.length > 5) contextCards.length = 5;
    renderContextFeed();
  }

  function renderContextFeed() {
    const wrap = $('contextFeedWrap');
    if (!wrap) return;
    if (contextCards.length === 0) {
      wrap.innerHTML = `<div class="context-empty">
        <div class="context-empty-icon">🌙</div>
        <div class="context-empty-text">لا توجد تذكيرات سياقية حالياً. سنُنبّهك بلطف عند تغيّر الطقس أو سفر أو وقت ذكر.</div>
      </div>`;
      return;
    }
    wrap.innerHTML = contextCards.map(c => renderCard(c)).join('');
  }

  function renderCard(c) {
    if (c.type === 'weather') {
      const { dua, weather } = c.payload;
      return `<div class="context-card context-weather">
        <div class="context-card-hd">
          <span class="context-card-icon">${weather.icon}</span>
          <div>
            <div class="context-card-title">${escapeHtml(dua.title)}</div>
            <div class="context-card-meta">${escapeHtml(weather.label)} • ${weather.temp ? arabicDigits(Math.round(weather.temp)) + '°' : ''}</div>
          </div>
        </div>
        <div class="context-card-text">${escapeHtml(dua.text)}</div>
        ${dua.extra ? `<div class="context-card-extra">${escapeHtml(dua.extra)}</div>` : ''}
      </div>`;
    }
    if (c.type === 'travel') {
      const { phase, distance } = c.payload;
      return `<div class="context-card context-travel">
        <div class="context-card-hd">
          <span class="context-card-icon">${phase.icon}</span>
          <div>
            <div class="context-card-title">${escapeHtml(phase.title)}</div>
            <div class="context-card-meta">على بُعد ~${arabicDigits(Math.round(distance))} كم من بلدك</div>
          </div>
        </div>
        <div class="context-card-msg">${escapeHtml(phase.message)}</div>
        <div class="context-card-text">«${escapeHtml(phase.dua)}»</div>
        <div class="context-card-src">— ${escapeHtml(phase.duaSrc)}</div>
        ${phase.tips && phase.tips.length ? `
          <div class="context-card-tips">
            <div class="context-card-tips-title">💡 تذكيرات لطيفة</div>
            <ul class="context-card-tips-list">
              ${phase.tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
            </ul>
          </div>` : ''}
        <div class="context-card-extra">
          <strong>أحكام القصر:</strong> ${escapeHtml(TRAVEL_DHIKR.qasarInfo)}
        </div>
        <div class="context-card-extra" style="margin-top:6px">
          <strong>الجمع بين الصلاتين:</strong> ${escapeHtml(TRAVEL_DHIKR.jamInfo)}
        </div>
        <div class="context-card-actions">
          <button class="btn btn-sec btn-sm" onclick="navTo('adhkar');setTimeout(()=>switchAdhkarTab('travel'),200)">📜 أذكار السفر</button>
          <button class="btn btn-sec btn-sm" onclick="ContextReminders.checkTravelNow()">🔄 إعادة الفحص</button>
        </div>
      </div>`;
    }
    if (c.type === 'wake') {
      return `<div class="context-card context-wake">
        <div class="context-card-hd">
          <span class="context-card-icon">☀️</span>
          <div>
            <div class="context-card-title">صباح الخير — أذكار الاستيقاظ</div>
            <div class="context-card-meta">ابدأ يومك بذكر الله</div>
          </div>
        </div>
        <div class="context-card-text">«${escapeHtml(c.payload.dua)}»</div>
        <div class="context-card-actions">
          <button class="btn btn-sec btn-sm" onclick="navTo('adhkar');setTimeout(()=>switchAdhkarTab('wake'),200)">📖 أذكار الاستيقاظ</button>
        </div>
      </div>`;
    }
    if (c.type === 'sleep') {
      return `<div class="context-card context-sleep">
        <div class="context-card-hd">
          <span class="context-card-icon">🌙</span>
          <div>
            <div class="context-card-title">مساء الخير — أذكار النوم</div>
            <div class="context-card-meta">اختم يومك بذكر الله</div>
          </div>
        </div>
        <div class="context-card-text">«${escapeHtml(c.payload.dua)}»</div>
        <div class="context-card-actions">
          <button class="btn btn-sec btn-sm" onclick="navTo('adhkar');setTimeout(()=>switchAdhkarTab('sleep'),200)">📖 أذكار النوم</button>
        </div>
      </div>`;
    }
    return '';
  }

  /* ════════════════════════════════════════════
      صفحة الإعدادات (داخل صفحة المحراب)
     ════════════════════════════════════════════ */
  function renderSettings() {
    const wrap = $('contextSettingsWrap');
    if (!wrap) return;
    const data = getData();
    const settings = S.getSettings();

    wrap.innerHTML = `
      <div class="context-settings">
        <!-- الموقع الحالي -->
        <div class="ctx-set-card ctx-location-card">
          <div class="ctx-set-hd">
            <span class="ctx-set-icon">📍</span>
            <div>
              <div class="ctx-set-title">موقعك الحالي</div>
              <div class="ctx-set-desc">مدينتك الأساسية التي يُقاس منها السفر</div>
            </div>
          </div>
          <div class="ctx-location-info">
            <div class="ctx-location-row">
              <span class="ctx-loc-lbl">المدينة:</span>
              <span class="ctx-loc-val">${data.homeCity ? escapeHtml(data.homeCity) : 'غير محدد — اضغط الزر أدناه'}</span>
            </div>
            ${data.homeLat ? `
              <div class="ctx-location-row">
                <span class="ctx-loc-lbl">الإحداثيات:</span>
                <span class="ctx-loc-val">${arabicDigits(data.homeLat.toFixed(4))}°، ${arabicDigits(data.homeLng.toFixed(4))}°</span>
              </div>` : ''}
            ${data.isTraveling ? `
              <div class="ctx-travel-status traveling">
                <span>🧳 أنت في سفر الآن</span>
                ${data.currentDistance ? `<span>~ ${arabicDigits(Math.round(data.currentDistance))} كم من بلدك</span>` : ''}
              </div>` : `
              <div class="ctx-travel-status home">
                <span>🏠 في بلدك الآن</span>
              </div>`}
          </div>
          <div class="ctx-location-actions">
            <button class="btn btn-primary btn-sm" onclick="ContextReminders.setLocationAsHome()">
              <span>📍</span> حدد موقعي الحالي كموطن أساسي
            </button>
            <button class="btn btn-sec btn-sm" onclick="ContextReminders.checkTravelNow()">
              <span>🔄</span> افحص السفر الآن
            </button>
          </div>
        </div>

        <div class="ctx-set-card">
          <div class="ctx-set-hd">
            <span class="ctx-set-icon">🌧️</span>
            <div>
              <div class="ctx-set-title">تذكيرات الطقس</div>
              <div class="ctx-set-desc">دعاء مناسب لكل حال: صحو، غيوم، مطر، رياح، حر، برد، ثلج، رعد</div>
            </div>
            <div class="toggle-sw ${data.weatherEnabled ? 'on' : ''}" onclick="ContextReminders.toggleWeather(this)" role="switch"></div>
          </div>
          <div class="ctx-set-meta">
            ${data.lastWeather ? `آخر طقس: ${data.lastWeather.icon} ${escapeHtml(data.lastWeather.label)} ${data.lastWeather.temp ? '• ' + arabicDigits(Math.round(data.lastWeather.temp)) + '°' : ''}` : 'لم يُجلب الطقس بعد'}
            <button class="btn btn-sec btn-sm" onclick="ContextReminders.refreshWeather()">🔄 تحديث</button>
          </div>
        </div>

        <div class="ctx-set-card">
          <div class="ctx-set-hd">
            <span class="ctx-set-icon">🚗</span>
            <div>
              <div class="ctx-set-title">تذكيرات السفر</div>
              <div class="ctx-set-desc">تتبع حقيقي للموقع: يُذكّرك بأذكار الركوب والقصر والجمع عند الابتعاد ٨٠ كم+ عن بلدك</div>
            </div>
            <div class="toggle-sw ${data.travelEnabled ? 'on' : ''}" onclick="ContextReminders.toggleTravel(this)" role="switch"></div>
          </div>
          <div class="ctx-set-meta">
            ${data.travelEnabled ? '✓ التتبع المستمر مفعّل — سيتحقق النظام من موقعك تلقائياً' : 'التتبع متوقف — فعّله ليُذكّرك عند السفر'}
          </div>
        </div>

        <div class="ctx-set-card">
          <div class="ctx-set-hd">
            <span class="ctx-set-icon">🛏️</span>
            <div>
              <div class="ctx-set-title">تذكيرات الروتين</div>
              <div class="ctx-set-desc">أذكار الاستيقاظ/النوم في الأوقات المناسبة</div>
            </div>
            <div class="toggle-sw ${data.routineEnabled ? 'on' : ''}" onclick="ContextReminders.toggleRoutine(this)" role="switch"></div>
          </div>
        </div>

        <div class="ctx-set-info">
          💡 يتم فحص الموقع بشكل مستمر في الخلفية. عند الابتعاد عن مدينتك مسافة سفر (٨٠ كم+)، يُرسل التطبيق تذكيراً لطيفاً بأذكار الركوب وأحكام القصر والجمع. وعند العودة، يُهنئك بسلامة الوصول.
        </div>
      </div>
    `;
  }

  async function setLocationAsHome() {
    if (global.KHALWA?.toast) global.KHALWA.toast('جاري تحديد موقعك الحالي...', 'info', 2000);
    const result = await setHomeFromCurrentLocation();
    if (result.ok) {
      if (global.KHALWA?.toast) global.KHALWA.toast(`تم تعيين "${result.city}" كموطنك الأساسي 📍`, 'success', 3000);
      // بدء التتبع المستمر
      startTravelWatch();
      renderSettings();
      // إعادة تحميل أوقات الصلاة
      if (global.KHALWA?.loadPrayerTimes) global.KHALWA.loadPrayerTimes();
    } else {
      const msg = result.reason === 'permission-denied'
        ? 'لم يُمنح إذن الموقع. فعّل الموقع من إعدادات المتصفح'
        : 'تعذّر تحديد موقعك';
      if (global.KHALWA?.toast) global.KHALWA.toast(msg, 'warning', 4000);
    }
  }

  async function checkTravelNow() {
    if (global.KHALWA?.toast) global.KHALWA.toast('جاري فحص موقعك...', 'info', 1500);
    const result = await checkTravel();
    if (result) {
      if (global.KHALWA?.toast) {
        const msg = result.traveling
          ? `أنت في سفر — ${arabicDigits(Math.round(result.distance))} كم من بلدك`
          : `أنت في بلدك الآن — على بُعد ${arabicDigits(Math.round(result.distance))} كم من موطنك`;
        global.KHALWA.toast(msg, 'info', 3500);
      }
    } else {
      if (global.KHALWA?.toast) global.KHALWA.toast('تعذّر فحص الموقع', 'warning');
    }
    renderSettings();
    renderContextFeed();
  }

  function toggleWeather(sw) {
    const data = getData();
    saveData({ weatherEnabled: !data.weatherEnabled });
    sw.classList.toggle('on');
  }
  function toggleTravel(sw) {
    const data = getData();
    const newVal = !data.travelEnabled;
    saveData({ travelEnabled: newVal });
    sw.classList.toggle('on');
    if (newVal) {
      startTravelWatch();
    } else {
      stopTravelWatch();
    }
  }
  function toggleRoutine(sw) {
    const data = getData();
    saveData({ routineEnabled: !data.routineEnabled });
    sw.classList.toggle('on');
  }

  async function refreshWeather() {
    if (global.KHALWA?.toast) global.KHALWA.toast('جاري تحديث الطقس...', 'info', 1500);
    const w = await checkWeather();
    if (w && global.KHALWA?.toast) {
      global.KHALWA.toast(`${w.icon} ${w.label} ${w.temp ? '• ' + arabicDigits(Math.round(w.temp)) + '°' : ''}`, 'info', 2500);
    } else if (global.KHALWA?.toast) {
      global.KHALWA.toast('تعذّر جلب الطقس', 'warning');
    }
    renderSettings();
  }

  function setHomeFromSettings() {
    const settings = S.getSettings();
    if (settings.lat && settings.city) {
      setHomeLocation(settings.city, settings.lat, settings.lng);
      if (global.KHALWA?.toast) global.KHALWA.toast(`تم تحديد ${settings.city} كمدينتك الأساسية`, 'success');
      renderSettings();
    } else {
      if (global.KHALWA?.toast) global.KHALWA.toast('حدد مدينتك أولاً من إعدادات الصلاة', 'warning');
    }
  }

  /* ════════════════════════════════════════════
      التهيئة — تُستدعى عند بدء التطبيق
      تقوم بـ:
        1) طلب إذن الموقع عند أول فتح للتطبيق
        2) تعيين الموقع الحالي كموطن أساسي (إن لم يكن محدداً)
        3) بدء التتبع المستمر للسفر
        4) فحص الطقس والروتين
     ════════════════════════════════════════════ */
  let initTimer = null;

  async function requestLocationPermission() {
    const settings = S.getSettings();
    if (settings.locationPermissionAsked) return;
    S.setSettings({ locationPermissionAsked: true });

    if (!navigator.geolocation) return;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          // المستخدم وافق — حدّد الموقع الحالي كموطن أساسي
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let cityName = 'موقعي الحالي';
          try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=ar`);
            const data = await resp.json();
            const addr = data.address || {};
            cityName = addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || 'موقعي الحالي';
            if (addr.country) cityName = `${cityName}، ${addr.country}`;
          } catch (_) {}

          // حدّث الإعدادات و الـ home location
          setHomeLocation(cityName, lat, lng);
          S.setSettings({
            lat, lng,
            city: cityName,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || settings.timezone
          });

          if (global.KHALWA?.toast) {
            global.KHALWA.toast(`تم تحديد موقعك: ${cityName} 📍`, 'success', 3000);
          }
          // أعد تحميل أوقات الصلاة بالموقع الجديد
          if (global.KHALWA?.loadPrayerTimes) global.KHALWA.loadPrayerTimes();
          // ابدأ التتبع المستمر
          startTravelWatch();
          resolve(true);
        },
        (err) => {
          // المستخدم رفض — نبقي القاهرة كافتراضي ونُظهر تلميحاً
          if (global.KHALWA?.toast) {
            global.KHALWA.toast('للحصول على تذكيرات السفر وأوقات الصلاة الدقيقة، فعّل الموقع من إعدادات المتصفح', 'info', 4500);
          }
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  async function init() {
    // فحص روتين فوري
    checkRoutine();

    // طلب إذن الموقع عند بدء التطبيق (مرة واحدة)
    setTimeout(() => { requestLocationPermission().catch(()=>{}); }, 2000);

    // فحص طقس بعد 5 ثوانٍ من بدء التطبيق
    setTimeout(() => { checkWeather().catch(()=>{}); }, 5000);

    // بدء التتبع المستمر للموقع (إن كان home محدداً)
    setTimeout(() => { startTravelWatch(); }, 6000);

    // فحص دوري كل 30 دقيقة
    if (initTimer) clearInterval(initTimer);
    initTimer = setInterval(() => {
      checkWeather().catch(()=>{});
      checkRoutine();
    }, 30 * 60 * 1000);
  }

  /* ════════════════════════════════════════════
      PUBLIC API
     ════════════════════════════════════════════ */
  global.ContextReminders = {
    init,
    renderSettings,
    renderContextFeed,
    toggleWeather,
    toggleTravel,
    toggleRoutine,
    refreshWeather,
    setHomeFromSettings,
    setHomeLocation,
    setHomeFromCurrentLocation,
    setLocationAsHome,
    checkWeather,
    checkTravel,
    checkTravelNow,
    checkRoutine,
    startTravelWatch,
    stopTravelWatch,
    requestLocationPermission,
    WMO_CODES,
    WEATHER_DUA,
    TEMP_DUA,
    TRAVEL_DHIKR,
    TRAVEL_PHASES
  };

})(window);
