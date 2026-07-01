/* ============================================================
   KHALWA — MAIN APP LOGIC (app.js)  v4.0
   • Navigation (history-aware)
   • Quran reader (load, font size, tafsir, audio)
   • Reciter picker (rendered from API.RECITERS)
   • Verse of the day — random per click + daily rotation
   • Hadith of the day — random per click + daily rotation
   • Prayer times + countdown
   • Qibla compass
   • Khalwa timer + Tasbeeh
   • Adhkar (renders from window.ADHKAR)
   • Library: Prophets / Companions / Seerah / Fiqh / 99 Names / Bookmarks
   • Mood picker — random response per click (never same twice in a row)
   • Search, Settings, Profile, Achievements, Toasts
   ============================================================ */
(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // 0. STATE
  // ──────────────────────────────────────────────────────────
  const S = global.Storage;
  const A = global.API;

  const state = {
    page: 'home',
    surah: 1,
    ayahs: [],
    reciter: S.getSettings().reciter,
    fontScale: S.getSettings().fontScale || 0,
    showTafsir: S.getSettings().showTafsir,
    audio: null,           // HTMLAudioElement
    playingAyah: null,     // ayah number
    isPlayingSurah: false,
    autoScroll: S.get('autoScroll', true),
    lastAyah: S.get('lastAyah', null), // { surah, ayah, time } — موقف التلاوة الأخير
    khalwa: {
      running: false,
      remaining: 0,
      duration: 15 * 60,
      type: 'reading',
      timer: null
    },
    tasbeeh: S.get('tasbeeh', S.DEFAULTS.tasbeeh),
    adhkarTab: 'morning',
    adhkarProgress: S.get('adhkarProgress', {}),
    companionTab: 'male',   // 'male' or 'female'
    seerahTab: 'stages',    // 'stages' or 'family'
    qibla: { bearing: null, heading: null, watching: false, watchId: null },
    mood: S.get('mood', S.DEFAULTS.mood),
    fiqhChapter: null,
    onboardIdx: 0,
    searchTimer: null,
    reminders: {
      enabled: true,
      adhanId: 'makkah',
      fajrAdhanId: 'tobar',
      beforeMinutes: [15, 5],
      adhkarMorning: true,
      adhkarEvening: true,
      notifiedToday: {},
      prePrayerVoice: true   // تذكير صوتي قبل الصلاة بـ "حي على الصلاة"
    }
  };

  const KHALWA_GUIDANCE = {
    reading: {
      title: '📖 قراءة القرآن',
      tips: [
        'اقرأ بتدبّر وتأنٍّ، فالقرآن كتاب هداية لا كتاب سباق',
        'ابدأ بالاستعاذة والبسملة قبل كل سورة',
        'حاول أن تفهم معنى كل آية تقرؤها',
        'أفضل أوقات القراءة: بعد الفجر وبين الأذان والإقامة',
        'اجعل لك ورداً يومياً لا تتركه مهما كان الانشغال',
        'اقرأ بتدبّر ولو آيات قليلة خير من كثير بلا فهم',
        'احرص على المراجعة والحفظ ولو نصف صفحة يومياً'
      ],
      virtue: 'قال الله تعالى: ﴿إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ﴾ [الإسراء:٩]',
      suggestions: ['سورة الكهف يوم الجمعة', 'سورة الملك قبل النوم', 'سورة البقرة في البيت', 'آية الكرسي بعد كل صلاة', 'ختم القرآن كل شهر', 'قراءة جزء يومياً'],
      recommendedSurahs: [
        { name: 'سورة البقرة', reason: 'سيدة القرآن، لا يستطيعها البطلة' },
        { name: 'سورة الكهف', reason: 'نور بين الجمعتين' },
        { name: 'سورة الملك', reason: 'المانعة من عذاب القبر' },
        { name: 'سورة يس', reason: 'قلب القرآن' },
        { name: 'سورة الرحمن', reason: 'عروس القرآن' },
        { name: 'سورة الواقعة', reason: 'تجعل صاحبها غير فقير' }
      ],
      // محتوى متنوع لضمان بقاء المستخدم
      plan: [
        { time: '٥ دقائق', task: 'استعاذة + بسملة + قراءة الفاتحة بتدبر + آية الكرسي' },
        { time: '٥ دقائق', task: 'قراءة آخر آيتين من سورة البقرة مع التفكر في معانيهما' },
        { time: '٥ دقائق', task: 'قراءة سورة الإخلاص والمعوذتين ٣ مرات + دعاء ختم القرآن' }
      ],
      reflections: [
        'تأمل: القرآن كلام الله، فكيف تقرأ كلام من تحب بلا تدبر؟',
        'كل حرف بحسنة، والحسنة بعشر أمثالها، فلا تُقلّل من قراءة قليلة',
        'القرآن شفاء ورحمة، فاجعله دواءك في كل حال',
        'من قرأ القرآن وهو حافظ له كان مع السفرة الكرام البررة',
        'اقرأ بخشوع، فالقلب الخاشع يفهم ما لا يفهمه القلب الغافل'
      ]
    },
    dhikr: {
      title: '📿 الذكر',
      tips: [
        'اذكر الله بقلب حاضر ولسان ذاكر',
        'لا تشترط الطهارة للذكر لكنها أفضل',
        'اجعل لك ورداً من الذكر لا تتركه',
        'الذكر أفضل من الصدقة والجهاد عند بعض العلماء',
        'أفضل الذكر لا إله إلا الله وأفضل الدعاء الاستغفار',
        'لا تكثر الذكر بلا حضور قلب فقليل مع الحضور خير من كثير بدونه'
      ],
      virtue: 'قال الله تعالى: ﴿وَلَذِكْرُ اللَّهِ أَكْبَرُ﴾ [العنكبوت:٤٥] وقال: ﴿الَّذِينَ يَذْكُرُونَ اللَّهَ قِيَامًا وَقُعُودًا وَعَلَىٰ جُنُوبِهِمْ﴾ [آل عمران:١٩١]',
      suggestions: ['سبحان الله وبحمده 100 مرة', 'لا إله إلا الله 100 مرة', 'أستغفر الله 100 مرة', 'اللهم صل على محمد 10 مرات', 'سبحان الله العظيم وبحمده', 'لا حول ولا قوة إلا بالله'],
      adhkarList: [
        { text: 'سُبْحَانَ اللهِ', count: 33, desc: 'تسبيح بعد الصلاة', virtue: 'تملأ الميزان' },
        { text: 'الْحَمْدُ لِلَّهِ', count: 33, desc: 'حمد بعد الصلاة', virtue: 'تملأ الميزان' },
        { text: 'اللهُ أَكْبَرُ', count: 34, desc: 'تكبير بعد الصلاة', virtue: 'تكبير يكفر الذنوب' },
        { text: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', count: 10, desc: 'كلمة التوحيد', virtue: 'كانت له عدل عشر رقاب' },
        { text: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ', count: 10, desc: 'كلمتان حبيبتان للرحمن', virtue: 'خفيفتان على اللسان، ثقيلتان في الميزان' },
        { text: 'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ', count: 100, desc: 'سيد الاستغفار', virtue: 'يفرج الكرب ويبارك في الرزق' },
        { text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ', count: 10, desc: 'كنز من كنوز الجنة', virtue: 'دواء للهم والكرب' },
        { text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', count: 10, desc: 'الصلاة على النبي ﷺ', virtue: 'من صلى عليه صلى الله عليه بها عشراً' }
      ],
      reflections: [
        'تأمل: قلبك يطمئن بذكر الله، فلا تترك الذكر ولو لساعة',
        'الذاكر لله كالغاني في صفائه، والغافل كالفاقد لروحه',
        'اجعل بيتك عامراً بالذكر، فالبيت الذي يُذكر فيه الله يُضيء لأهل السماء',
        'الذكر يحفظ العبد من الشيطان، فلا تغفل فتتبعه',
        'الاستغفار في الأسحار من أعظم أسباب الرزق والمغفرة'
      ]
    },
    dua: {
      title: '🤲 الدعاء',
      tips: [
        'ابدأ بحمد الله والصلاة على النبي ﷺ',
        'ألحّ في الدعاء ولا تستعجل الإجابة',
        'ادعُ وأنت موقن بالإجابة',
        'أفضل أوقات الدعاء: السجود، آخر الليل، بين الأذان والإقامة',
        'تجنّب الاستعجال في الدعاء فإن الله يستجيب في الوقت المناسب',
        'ادعُ لوالديك والمسلمين قبل نفسك'
      ],
      virtue: 'قال النبي ﷺ: «الدعاء هو العبادة» رواه الترمذي. وقال الله تعالى: ﴿ادْعُونِي أَسْتَجِبْ لَكُمْ﴾ [غافر:٦٠]',
      suggestions: ['دعاء الاستخارة في كل أمر', 'دعاء الهم والحزن', 'دعاء الكرب', 'دعاء الاستفتاح في الصلاة', 'دعاء قبل النوم', 'دعاء بعد الفجر'],
      duas: [
        { text: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', source: 'البقرة: ٢٠١' },
        { text: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ', source: 'البخاري' },
        { text: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', source: 'طه: ٢٥-٢٦' },
        { text: 'حَسْبُنَا اللهُ وَنِعْمَ الْوَكِيلُ', source: 'آل عمران: ١٧٣' },
        { text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ', source: 'سيد الاستغفار - البخاري' },
        { text: 'رَبِّ زِدْنِي عِلْمًا', source: 'طه: ١١٤' },
        { text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَأَعُوذُ بِكَ مِنَ النَّارِ', source: 'السنة' },
        { text: 'اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ، دِقَّهُ وَجِلَّهُ، وَأَوَّلَهُ وَآخِرَهُ، وَعَلَانِيَتَهُ وَسِرَّهُ', source: 'مسلم' }
      ],
      reflections: [
        'تأمل: الله قريب يجيب دعوتك، فلا تترك الباب مفتوحاً',
        'من أبطأ عليه الرزق، فليُكثر من الاستغفار',
        'الدين في الدعاء، فمن لم يدعُ الله فقد استغنى عن ربه',
        'أفضل الدعاء: الحمد لله، فابدأ دعاءك بحمد الله',
        'لا تستعجل الإجابة، فإن الله يُؤخرها لحكمة'
      ],
      plan: [
        { time: '٥ دقائق', task: 'تحميد الله وتمجيده + الصلاة على النبي ﷺ' },
        { time: '٥ دقائق', task: 'دعاء لنفسك ولوالديك وإخوانك' },
        { time: '٥ دقائق', task: 'دعاء الاستغفار والتوبة، وختم بسيد الاستغفار' }
      ]
    },
    tafakkur: {
      title: '🌙 التفكّر',
      tips: [
        'تأمّل في خلق السماوات والأرض',
        'فكّر في نعم الله عليك وتقصيرك في شكرها',
        'تأمّل في الموت وما بعده',
        'فكّر في عظمة الله من خلال آياته في الكون',
        'اجلس في مكان هادئ وأغمض عينيك وتأمّل في عظمة الخالق',
        'تأمّل في آيات القرآن التي تدعو للتفكر',
        'فكّر في كيف أن كل شيء في الكون يسبّح الله',
        'تأمّل في رحمة الله وكيف أنها وسعت كل شيء'
      ],
      virtue: 'قال الله تعالى: ﴿وَيَتَفَكَّرُونَ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ﴾ [آل عمران:١٩١]. وقال النبي ﷺ: «تفكّر ساعة خير من قيام ليلة»',
      suggestions: ['تفكّر في خلق الإنسان', 'تفكّر في البحار والجبال', 'تفكّر في القبر والآخرة', 'تفكّر في رحمة الله وسعة مغفرته', 'تفكّر في الملائكة والجن', 'تفكّر في نعمة الأمن والأمان'],
      topics: [
        'التفكّر في خلق السماوات وبساطتها واتساعها',
        'التفكّر في نعمة البصر وكيف أن فقدانه يحجب عنك العالم',
        'التفكّر في خلق الإنسان من نطفة وتصويره في الرحم',
        'التفكّر في الماء الذي أنزله الله من السماء فأحيا به الأرض',
        'التفكّر في الشمس والقمر يجريان بأمر الله لا يتخلفان',
        'التفكّر في الليل والنهار يتعاقبان بانتظام لا يختل',
        'التفكّر في الجبال أوتاداً للأرض لئلا تميد بنا',
        'التفكّر في البحار وما فيها من عجائب ونعم',
        'التفكّر في الموت والقبر وما يلقى فيه الإنسان',
        'التفكّر في الجنة والنار والحساب والميزان'
      ],
      reflections: [
        'تأمل: لو سكن قلبك ذكر الله، لما اضطرب من أي شيء',
        'كل ما حولك آية تدل على الله، فلا تكن أعمى البصيرة',
        'نعم الله لا تُحصى، فاشكر بقلبك قبل لسانك',
        'الموت يقترب مع كل نفس، فاستعد له قبل فوات الأوان',
        'الجنة تستحق التعب، والنار تستحق الفرار'
      ],
      plan: [
        { time: '٥ دقائق', task: 'تأمل في نعمة من نعم الله (البصر، السمع، العقل)' },
        { time: '٥ دقائق', task: 'تأمل في الموت والقبر وما بعده' },
        { time: '٥ دقائق', task: 'تأمل في الجنة والنار، واختم بدعاء أن يجعلك الله من أهل الجنة' }
      ]
    }
  };

  // فضائل TASBEEH_CYCLES — تُعرض عند إتمام كل ذكر
  const TASBEEH_VIRTUES = {
    'سُبْحَانَ اللهِ': 'من قال سبحان الله مائة مرة حُطّت خطاياه وإن كانت مثل زبد البحر',
    'الْحَمْدُ لِلَّهِ': 'الحمد لله تملأ الميزان، وهي من أحب الكلام إلى الله',
    'اللَّهُ أَكْبَرُ': 'الله أكبر خير من الدنيا وما فيها، وهي تكبير يكفر الذنوب',
    'لَا إِلَهَ إِلَّا اللَّهُ': 'أفضل الذكر لا إله إلا الله، ووزنها في الميزان عظيم',
    'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ': 'كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن',
    'أَسْتَغْفِرُ اللَّهَ': 'من لزم الاستغفار جعل الله له من كل هم فرجاً، ومن كل ضيق مخرجاً',
    'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ': 'كنز من كنوز الجنة، ودواء للهم والكرب',
    'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ': 'من صلى على النبي ﷺ صلاةً صلى الله عليه بها عشراً'
  };

  // عبارات لطيفة تظهر عند إتمام كل ذكر
  const TASBEEH_KIND_PHRASES = [
    'بارك الله فيك، أحسنت الذكر',
    'تقبّل الله منك، ورفع قدرك',
    'ما أجمل ذكرك، فالقلوب تطمئن بذكر الله',
    'جعلها الله في ميزان حسناتك',
    'لقد أتممت ذكرك، فأحسن الله إليك',
    'بورك فيك، استمر على هذا الذكر',
    'ربنا تقبل منك، واجعلنا من الذاكرين',
    'نور الله قلبك بالذكر كما نوّرته بك'
  ];

  // ──────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ──────────────────────────────────────────────────────────
  const $  = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function arabicDigits(n) {
    if (typeof n !== 'number') n = parseInt(n, 10) || 0;
    const map = '٠١٢٣٤٥٦٧٨٩';
    return String(n).replace(/\d/g, d => map[+d]);
  }

  function toast(msg, type = 'info', ms = 2400) {
    const wrap = $('toastWrap');
    if (!wrap) return;
    const icons = {
      success: '✓', error: '✕', warning: '!', info: 'i'
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon" style="font-weight:800">${icons[type] || 'i'}</span><span class="toast-msg">${escapeHtml(msg)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pickRandom(arr, excludeIdx = -1) {
    if (!arr || !arr.length) return null;
    if (arr.length === 1) return { item: arr[0], index: 0 };
    let idx;
    do { idx = Math.floor(Math.random() * arr.length); } while (idx === excludeIdx);
    return { item: arr[idx], index: idx };
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function fmtTime(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  }

  // صيغة موسعة تشمل الساعات: "س د ث" أو "H:MM:SS"
  function fmtTimeHMS(totalSec) {
    if (totalSec < 0) totalSec = 0;
    totalSec = Math.floor(totalSec);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${arabicDigits(h)} س ${arabicDigits(m)} د ${arabicDigits(s)} ث`;
    }
    return `${arabicDigits(m)} د ${arabicDigits(s)} ث`;
  }

  // Convert "HH:MM" (24h) to today's Date
  function prayerDate(hhmm) {
    if (!hhmm || hhmm.indexOf(':') < 0) return null;
    const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  // ──────────────────────────────────────────────────────────
  // 2. NAVIGATION
  // ──────────────────────────────────────────────────────────
  function navTo(page) {
    if (!page) return;
    // إيقاف الخلوة العميقة عند مغادرة صفحتها
    if (state.page === 'focus' && page !== 'focus' && global.FocusMode) {
      global.FocusMode.onLeave();
    }
    state.page = page;
    $$('.page').forEach(p => p.classList.remove('on'));
    const el = $(`pg-${page}`);
    if (el) el.classList.add('on');
    $$('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.pg === page));
    if (page === 'home')        loadHome();
    else if (page === 'quran')  ensureQuranLoaded();
    else if (page === 'adhkar') renderAdhkar();
    else if (page === 'prophets')   renderProphets();
    else if (page === 'companions') renderCompanions();
    else if (page === 'seerah')     renderSeerah();
    else if (page === 'nawawi')     renderNawawi();
    else if (page === 'radio')      renderRadio();
    else if (page === 'fiqh')       renderFiqh();
    else if (page === 'asma')       renderAsma();
    else if (page === 'profile')    loadProfile();
    else if (page === 'qibla')      initQibla();
    /* ── صفحات النظام الروحاني الجديد ── */
    else if (page === 'ruhani') {
      if (global.ContextReminders) {
        global.ContextReminders.renderContextFeed();
        global.ContextReminders.renderSettings();
      }
    }
    else if (page === 'khatmah') { if (global.Khatmah) global.Khatmah.render(); }
    else if (page === 'bustan')  { if (global.Bustan) global.Bustan.render(); }
    else if (page === 'dua')     { if (global.DuaJournal) global.DuaJournal.render(); }
    else if (page === 'tawbah')  { if (global.Tawbah) global.Tawbah.render(); }
    else if (page === 'focus')   { if (global.FocusMode) global.FocusMode.render(); }
    // إيقاف أي أذكار صوتية عند تغيير الصفحة
    if (page !== 'adhkar' && global.AudioDhikr && global.AudioDhikr.isSpeaking()) {
      global.AudioDhikr.stop();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  global.navTo = navTo;

  /** تبديل تبويب الصحابة (رجال/نساء) */
  function switchCompanionTab(tab) {
    state.companionTab = tab;
    $$('.comp-tab').forEach(b => b.classList.toggle('on', b.dataset.ctab === tab));
    renderCompanions();
  }
  global.switchCompanionTab = switchCompanionTab;

  /** تبديل تبويب السيرة (مراحل/أهل البيت) */
  function switchSeerahTab(tab) {
    state.seerahTab = tab;
    $$('.seerah-tab').forEach(b => b.classList.toggle('on', b.dataset.stab === tab));
    renderSeerah();
  }
  global.switchSeerahTab = switchSeerahTab;

  // ──────────────────────────────────────────────────────────
  // 3. THEME
  // ──────────────────────────────────────────────────────────
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const tog = $('toggleDark');
    if (tog) tog.classList.toggle('on', t === 'dark');
    const val = $('darkValue');
    if (val) val.textContent = t === 'dark' ? 'مُفعّل' : 'مُعطّل';
  }
  function toggleTheme() {
    const s = S.getSettings();
    const next = s.theme === 'dark' ? 'light' : 'dark';
    S.setSettings({ theme: next });
    applyTheme(next);
  }
  global.toggleTheme = toggleTheme;

  // ──────────────────────────────────────────────────────────
  // 4. ONBOARDING
  // ──────────────────────────────────────────────────────────
  function showOnboarding() {
    const ob = $('onboardWrap');
    if (!ob) return;
    ob.classList.add('open');
    state.onboardIdx = 0;
    updateOnboard();
  }
  function updateOnboard() {
    const slides = $$('.ob-slide', $('onboardWrap'));
    const dots = $$('.ob-dot', $('onboardWrap'));
    slides.forEach((s, i) => s.classList.toggle('on', i === state.onboardIdx));
    dots.forEach((d, i) => d.classList.toggle('on', i === state.onboardIdx));
    const btn = $('obBtn');
    if (btn) btn.textContent = state.onboardIdx === slides.length - 1 ? 'ابدأ الآن' : 'التالي';
  }
  function nextOb() {
    const slides = $$('.ob-slide', $('onboardWrap'));
    if (state.onboardIdx < slides.length - 1) {
      state.onboardIdx++;
      updateOnboard();
    } else {
      $('onboardWrap').classList.remove('open');
      S.setSettings({ onboardingDone: true });
    }
  }
  global.nextOb = nextOb;

  // ──────────────────────────────────────────────────────────
  // 5. HOME — verse of the day, hadith, prayer, mood
  // ──────────────────────────────────────────────────────────
  function loadHome() {
    loadVerseOfDay();
    loadHadithOfDay();
    loadPrayerTimes();
    updateStatsStrip();
    updateMoodUI();
    // تشغيل إذاعة القرآن المصرية مباشرة في الواجهة الرئيسية — مرة واحدة فقط
    const radioWidget = document.getElementById('homeRadioWidget');
    if (radioWidget && !radioWidget.innerHTML.trim() && global.QuranRadio && typeof global.QuranRadio.render === 'function') {
      global.QuranRadio.render();
    }
    /* ── تحديث بطاقات النظام الروحاني في الرئيسية ── */
    if (global.Khatmah)     global.Khatmah.updateHomeWidget();
    if (global.Bustan)      global.Bustan.renderHomeMini();
    if (global.DuaJournal)  global.DuaJournal.renderHomeMini();
    if (global.Tawbah)      global.Tawbah.renderHomeMini();
    if (global.FocusMode)   global.FocusMode.renderHomeMini();
  }

  // ── VERSE OF THE DAY ──────────────────────────────────────
  /** Random per click AND rotates daily. The user wanted "عشوائياً" -
   *  every click picks a new random verse (with daily persistence as
   *  initial seed, so refresh on the same day shows a different verse
   *  each click until pool exhausted). */
  function loadVerseOfDay() {
    const pool = (global.VERSE_POOL || []).slice();
    if (!pool.length) return;
    const store = S.get('verse', { day: null, index: -1 });
    let idx;
    if (store.day !== todayKey() || store.index < 0) {
      // first visit today → pick random
      idx = Math.floor(Math.random() * pool.length);
      S.set('verse', { day: todayKey(), index: idx });
    } else {
      idx = store.index;
    }
    const v = pool[idx];
    global._verse = v;
    const text = $('homeVerseText');
    const ref = $('homeVerseRef');
    if (text) text.textContent = v.t.split('﴿')[0] || v.t;
    if (ref) ref.textContent = v.ref;
  }

  /** Click the verse card → load a brand new random verse */
  function shuffleVerseOfDay() {
    const pool = global.VERSE_POOL || [];
    if (!pool.length) return;
    const store = S.get('verse', { day: null, index: -1 });
    const pick = pickRandom(pool, store.index);
    if (!pick) return;
    S.set('verse', { day: todayKey(), index: pick.index });
    global._verse = pick.item;
    const text = $('homeVerseText');
    const ref = $('homeVerseRef');
    if (text) {
      text.style.opacity = 0;
      setTimeout(() => {
        text.textContent = pick.item.t.split('﴿')[0] || pick.item.t;
        ref.textContent = pick.item.ref;
        text.style.opacity = 1;
      }, 200);
    }
  }

  // ── HADITH OF THE DAY ─────────────────────────────────────
  function loadHadithOfDay() {
    const pool = global.HADITH_POOL || [];
    if (!pool.length) return;
    const store = S.get('hadith', { day: null, index: -1 });
    let idx;
    if (store.day !== todayKey() || store.index < 0) {
      idx = Math.floor(Math.random() * pool.length);
      S.set('hadith', { day: todayKey(), index: idx });
    } else {
      idx = store.index;
    }
    const h = pool[idx];
    global._hadith = h;
    const t = $('hadithText'); if (t) t.textContent = h.text;
    const i = $('hadithIsnad'); if (i) i.textContent = h.isnad;
    const s = $('hadithSrc');
    if (s) s.innerHTML = (h.src || []).map(x => `<span>${escapeHtml(x)}</span>`).join('');
    const b = $('hadithBenefit');
    if (b) b.textContent = h.ben || '';
  }

  function shuffleHadithOfDay() {
    const pool = global.HADITH_POOL || [];
    if (!pool.length) return;
    const store = S.get('hadith', { day: null, index: -1 });
    const pick = pickRandom(pool, store.index);
    if (!pick) return;
    S.set('hadith', { day: todayKey(), index: pick.index });
    global._hadith = pick.item;
    const t = $('hadithText'); if (t) t.textContent = pick.item.text;
    const i = $('hadithIsnad'); if (i) i.textContent = pick.item.isnad;
    const s = $('hadithSrc');
    if (s) s.innerHTML = (pick.item.src || []).map(x => `<span>${escapeHtml(x)}</span>`).join('');
    const b = $('hadithBenefit'); if (b) b.textContent = pick.item.ben || '';
  }

  // ── PRAYER TIMES ──────────────────────────────────────────
  async function loadPrayerTimes() {
    const s = S.getSettings();
    const grid = $('prayerGrid');
    const nextName = $('nextPName');
    const nextTime = $('nextPTime');
    const cityEl = $('prayerCity');
    if (cityEl) cityEl.textContent = s.city || 'موقعك الحالي';

    if (!s.lat || !s.lng) {
      if (nextName) nextName.textContent = 'فعّل الموقع';
      if (nextTime) nextTime.textContent = 'أو ابحث عن مدينتك من الإعدادات';
      return;
    }
    const data = await A.fetchPrayerTimes(s.lat, s.lng, s.calcMethod, s.school);
    if (!data) {
      if (nextName) nextName.textContent = 'تعذّر تحميل المواقيت';
      return;
    }
    const prayers = [
      { key: 'Fajr',    name: 'الفجر' },
      { key: 'Dhuhr',   name: 'الظهر' },
      { key: 'Asr',     name: 'العصر' },
      { key: 'Maghrib', name: 'المغرب' },
      { key: 'Isha',    name: 'العشاء' }
    ];
    // Build grid
    if (grid) {
      grid.innerHTML = prayers.map(p => `
        <div class="prayer-pill" data-key="${p.key}">
          <div class="pp-name">${p.name}</div>
          <div class="pp-time">${data[p.key]}</div>
        </div>`).join('');
    }
    updateNextPrayer(data, prayers);
    // Cache prayer data for reminder system
    global._prayerTimesData = data;
    // tick countdown every second
    if (global._prayerTicker) clearInterval(global._prayerTicker);
    global._prayerTicker = setInterval(() => updateNextPrayer(data, prayers), 1000);
  }

  function updateNextPrayer(data, prayers) {
    const now = new Date();
    let next = null, nextKey = null;
    for (const p of prayers) {
      const t = prayerDate(data[p.key]);
      if (t && t > now) { next = t; nextKey = p; break; }
    }
    if (!next) {
      // after Isha → next prayer is tomorrow's Fajr
      const t = prayerDate(data.Fajr);
      if (t) { t.setDate(t.getDate() + 1); next = t; nextKey = prayers[0]; }
    }
    const nextName = $('nextPName');
    const nextTime = $('nextPTime');
    const cd = $('nextPCountdown');
    if (nextName && nextKey) nextName.textContent = nextKey.name;
    if (nextTime && nextKey) nextTime.textContent = data[nextKey.key];
    if (cd && next) {
      const diff = Math.max(0, Math.floor((next - now) / 1000));
      cd.textContent = 'بعد ' + fmtTimeHMS(diff);
    }
    // highlight next pill
    $$('.prayer-pill').forEach(p => {
      p.classList.remove('next-pill', 'past-pill');
      if (nextKey && p.dataset.key === nextKey.key) p.classList.add('next-pill');
      else {
        const t = prayerDate(data[p.dataset.key]);
        if (t && t < now) p.classList.add('past-pill');
      }
    });
  }

  function openPrayerSettings() {
    const methods = A.CALC_METHODS;
    const s = S.getSettings();
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">إعدادات المواقيت</h3>
      <div style="margin-bottom:14px">
        <div class="label">المدينة الحالية</div>
        <div style="display:flex;gap:8px">
          <input id="cityInp" class="search-inp" style="flex:1" placeholder="ابحث عن مدينتك..." value="${escapeHtml(s.city || '')}" oninput="KHALWA.searchCity(this.value)"/>
          <button class="btn btn-sec btn-sm" onclick="KHALWA.useGeoLocation()">📍 موقعي</button>
        </div>
        <div id="cityResults" style="margin-top:8px"></div>
      </div>
      <div style="margin-bottom:14px">
        <div class="label">طريقة الحساب</div>
        <select id="methodSel" class="search-inp" style="width:100%;appearance:auto">
          ${methods.map(m => `<option value="${m.id}" ${m.id === s.calcMethod ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:14px">
        <div class="label">المذهب (للعصر)</div>
        <select id="schoolSel" class="search-inp" style="width:100%;appearance:auto">
          <option value="0" ${s.school === 0 ? 'selected' : ''}>الشافعي (القياسي)</option>
          <option value="1" ${s.school === 1 ? 'selected' : ''}>الحنفي</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" onclick="KHALWA.savePrayerSettings()">حفظ الإعدادات</button>
    `;
    openSheet(html, 'إعدادات المواقيت');
  }
  global.openPrayerSettings = openPrayerSettings;

  function searchCity(q) {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(async () => {
      const results = await A.searchCities(q);
      const wrap = $('cityResults');
      if (!wrap) return;
      if (!results.length) { wrap.innerHTML = ''; return; }
      wrap.innerHTML = results.slice(0, 5).map((r, i) =>
        `<div class="search-result" onclick="KHALWA.pickCity(${i})" data-i="${i}">
          <div style="font-weight:600">${escapeHtml(r.name)}</div>
        </div>`).join('');
      state._cityResults = results;
    }, 350);
  }
  function pickCity(i) {
    const r = state._cityResults && state._cityResults[i];
    if (!r) return;
    $('cityInp').value = r.name;
    state._pickedCity = r;
  }
  function useGeoLocation() {
    if (!navigator.geolocation) { toast('الموقع غير مدعوم', 'error'); return; }
    toast('جاري تحديد موقعك...', 'info');
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      const geo = await A.reverseGeocode(latitude, longitude);
      state._pickedCity = { lat: latitude, lng: longitude, name: geo.city + (geo.country ? '، ' + geo.country : '') };
      $('cityInp').value = state._pickedCity.name;
      toast('تم تحديد موقعك', 'success');
    }, err => {
      toast('تعذّر الوصول للموقع', 'error');
    }, { timeout: 8000, enableHighAccuracy: true });
  }
  function savePrayerSettings() {
    const method = parseInt($('methodSel').value, 10);
    const school = parseInt($('schoolSel').value, 10);
    const patch = { calcMethod: method, school };
    if (state._pickedCity) {
      patch.lat = state._pickedCity.lat;
      patch.lng = state._pickedCity.lng;
      patch.city = state._pickedCity.name;
    }
    S.setSettings(patch);
    closeSheet();
    toast('تم الحفظ', 'success');
    loadPrayerTimes();
  }

  // ── MOOD ──────────────────────────────────────────────────
  /** The user requested: "تتغير عند كل ضغطه" — every click shows
   *  a different response (never the same twice in a row). */
  function selectMood(mood) {
    const responses = (global.MOOD_RESPONSES || {})[mood] || [];
    if (!responses.length) return;
    let idx;
    if (state.mood.lastPick === mood && state.mood.lastIndex >= 0) {
      // pick different from last
      const pick = pickRandom(responses, state.mood.lastIndex);
      idx = pick.index;
    } else {
      idx = Math.floor(Math.random() * responses.length);
    }
    state.mood = { lastPick: mood, lastIndex: idx };
    S.set('mood', state.mood);
    // Update mood UI (buttons + response)
    $$('.mood-opt').forEach(b => b.classList.toggle('on', b.dataset.mood === mood));
    const r = responses[idx];
    const el = $('moodResp');
    if (el) {
      el.innerHTML = `
        <div class="mood-resp-title">${escapeHtml(r.title)}</div>
        <div class="mood-resp-text">${escapeHtml(r.text)}</div>
        <div class="mood-resp-ayah">${escapeHtml(r.ayah || '')}</div>`;
      el.classList.remove('show');
      void el.offsetWidth; // reflow
      el.classList.add('show');
    }
    // bump dhikr-ish stats (mood reflection = 1 dhikr point)
    bumpStat('dhikrCount');
    updateStatsStrip();
  }
  global.selectMood = selectMood;

  function updateMoodUI() {
    if (!state.mood.lastPick) return;
    $$('.mood-opt').forEach(b => b.classList.toggle('on', b.dataset.mood === state.mood.lastPick));
  }

  // ── STATS ─────────────────────────────────────────────────
  function bumpStat(key, delta = 1) {
    const s = S.getStats();
    s[key] = (s[key] || 0) + delta;
    S.setStats(s);
  }
  function updateStatsStrip() {
    const s = S.getStats();
    // Streak handling — increment if first visit today
    const today = todayKey();
    if (s.lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000);
      const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
      if (s.lastVisit === yKey) s.streak = (s.streak || 0) + 1;
      else s.streak = 1;
      s.lastVisit = today;
      S.setStats(s);
    }
    const setVal = (id, v) => { const el = $(id); if (el) el.textContent = arabicDigits(v); };
    setVal('statStreak', s.streak || 0);
    setVal('statKh', s.khalwaCount || 0);
    setVal('statDhikr', s.dhikrCount || 0);
  }

  // ──────────────────────────────────────────────────────────
  // 6. QURAN
  // ──────────────────────────────────────────────────────────
  function renderReciterChips() {
    // Legacy: لم تعد تُستخدم في الـ HTML الجديد، لكن نبقيها لتوافق أقدم
    const row = $('reciterRow');
    if (!row) return;
    const list = A.RECITERS;
    row.innerHTML = list.map(r =>
      `<button class="reciter-chip ${r.id === state.reciter ? 'on' : ''}" data-rec="${r.id}" onclick="pickReciter('${r.id}')">${escapeHtml(r.name)}</button>`
    ).join('');
  }

  /** تحديث اسم القارئ في الـ picker */
  function updateReciterUI() {
    const r = A.getReciter(state.reciter);
    if (!r) return;
    const nameEl = $('curReciterName');
    if (nameEl) nameEl.textContent = r.name;
    const metaEl = $('curReciterMeta');
    if (metaEl) metaEl.textContent = 'اضغط للتغيير';
  }

  /** فتح قائمة القراء في sheet */
  function openReciterList() {
    const list = A.RECITERS;
    // فئات حسب نوع المصدر
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">اختر القارئ</h3>
      <div class="surah-list-wrap">
        ${list.map(r => `
          <div class="surah-list-item ${r.id === state.reciter ? 'active' : ''}" onclick="KHALWA.pickReciter('${r.id}')">
            <div class="sli-num">${r.id === state.reciter ? '✓' : '🎙️'}</div>
            <div>
              <div class="sli-name">${escapeHtml(r.name)}</div>
              <div class="sli-meta">${r.src === 'mp3quran' ? 'تشغيل السورة كاملة' : 'تشغيل آية بآية'}</div>
            </div>
          </div>`).join('')}
      </div>`;
    openSheet(html, 'اختر القارئ');
  }
  global.openReciterList = openReciterList;

  function pickReciter(id) {
    state.reciter = id;
    S.setSettings({ reciter: id });
    updateReciterUI();
    closeSheet();
    // If currently playing audio, restart with new reciter
    if (state.audio && state.playingAyah) {
      const cur = state.playingAyah;
      stopAudio();
      // قليل من التأخير لإغلاق الـ audio القديم
      setTimeout(() => playAyah(cur), 200);
    }
  }
  global.pickReciter = pickReciter;

  function openSurahList() {
    const list = global.SURAHS || [];
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">اختر سورة</h3>
      <div class="surah-list-wrap">
        ${list.map(s => `
          <div class="surah-list-item" onclick="KHALWA.pickSurah(${s.n})">
            <div class="sli-num">${arabicDigits(s.n)}</div>
            <div>
              <div class="sli-name">${escapeHtml(s.name)}</div>
              <div class="sli-meta">${escapeHtml(s.type)} • ${arabicDigits(s.ayahs)} آيات</div>
            </div>
          </div>`).join('')}
      </div>`;
    openSheet(html, 'اختر سورة');
  }
  global.openSurahList = openSurahList;

  function pickSurah(n) {
    state.surah = n;
    closeSheet();
    loadSurah(n);
  }
  global.KHALWA_pickSurah = pickSurah;

  async function ensureQuranLoaded() {
    if (!state.ayahs.length || state.ayahs[0]?.surahNum !== state.surah) {
      await loadSurah(state.surah);
    }
  }

  async function loadSurah(n) {
    state.surah = n;
    const wrap = $('ayahsWrap');
    if (wrap) wrap.innerHTML = '<div class="spinner"></div>';
    // Update surah picker UI
    const surah = (global.SURAHS || []).find(s => s.n === n);
    if (surah) {
      const numEl = $('curSurahNum'); if (numEl) numEl.textContent = arabicDigits(surah.n);
      const nameEl = $('curSurahName'); if (nameEl) nameEl.textContent = surah.name;
      const metaEl = $('curSurahMeta'); if (metaEl) metaEl.textContent = `${surah.type} • ${arabicDigits(surah.ayahs)} آيات`;
    }
    // Update reciter picker UI
    updateReciterUI();
    // Update auto-scroll button UI
    updateAutoScrollUI();
    // Basmala visibility (surah 1 has it inside, surah 9 has none)
    const basmala = $('basmala');
    if (basmala) basmala.style.display = (n === 1 || n === 9) ? 'none' : 'block';
    // Fetch
    const ayahs = await A.fetchSurah(n);
    if (!ayahs) {
      if (wrap) wrap.innerHTML = '<div class="empty"><div class="empty-icon">📡</div><div class="empty-title">تعذّر تحميل السورة</div><div class="empty-text">تحقق من اتصالك بالإنترنت</div></div>';
      return;
    }
    state.ayahs = ayahs.map(a => ({ ...a, surahNum: n }));
    renderAyahs();
    // عرض زر استئناف إن كان موجوداً آخر موقف في هذه السورة
    updateResumeButton();
  }

  /** تحديث زر استئناف التلاوة */
  function updateResumeButton() {
    const btn = $('resumeBtn');
    if (!btn) return;
    if (state.lastAyah && state.lastAyah.surah === state.surah) {
      btn.style.display = 'inline-flex';
      btn.querySelector('span').textContent = `استئناف من الآية ${arabicDigits(state.lastAyah.ayah)}`;
    } else {
      btn.style.display = 'none';
    }
  }

  /** استئناف من آخر موقف */
  function resumeLastAyah() {
    if (!state.lastAyah) return;
    if (state.lastAyah.surah !== state.surah) {
      // تحميل السورة أولاً ثم استئناف
      pickSurah(state.lastAyah.surah);
      setTimeout(() => {
        const el = document.querySelector(`.ayah-wrap[data-num="${state.lastAyah.ayah}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        playAyah(state.lastAyah.ayah);
      }, 1200);
    } else {
      const el = document.querySelector(`.ayah-wrap[data-num="${state.lastAyah.ayah}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      playAyah(state.lastAyah.ayah);
    }
  }
  global.resumeLastAyah = resumeLastAyah;

  /** تفعيل/تعطيل السكرول التلقائي */
  function toggleAutoScroll() {
    state.autoScroll = !state.autoScroll;
    S.set('autoScroll', state.autoScroll);
    updateAutoScrollUI();
    toast(state.autoScroll ? 'تم تفعيل السكرول التلقائي' : 'تم إيقاف السكرول التلقائي', 'info', 1500);
  }
  global.toggleAutoScroll = toggleAutoScroll;

  function updateAutoScrollUI() {
    const btn = $('autoScrollBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', state.autoScroll ? 'true' : 'false');
    btn.classList.toggle('on', state.autoScroll);
  }

  function renderAyahs() {
    const wrap = $('ayahsWrap');
    if (!wrap) return;
    const baseSize = 28 + state.fontScale;
    wrap.innerHTML = state.ayahs.map(a => `
      <div class="ayah-wrap" data-num="${a.num}" id="ayah-${a.num}">
        <div class="ayah-text" style="font-size:${baseSize}px">${escapeHtml(a.text)}</div>
        ${state.showTafsir && a.tafsir ? `
          <div class="ayah-tafsir-pro">
            <div class="ayah-tafsir-hd">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>
              <span>التفسير الميسّر</span>
            </div>
            <div class="ayah-tafsir-body">${escapeHtml(a.tafsir)}</div>
          </div>` : ''}
        <div class="ayah-foot">
          <div class="ayah-num">${arabicDigits(a.num)}</div>
          <div class="ayah-acts">
            <button class="ayah-btn" data-act="play" data-num="${a.num}" onclick="KHALWA.toggleAyahAudio(${a.num})" aria-label="استماع">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="ayah-btn" data-act="bookmark" onclick="KHALWA.toggleBookmark(${a.num})" aria-label="حفظ">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="ayah-btn" onclick="KHALWA.showShareOptions(${a.num})" aria-label="مشاركة">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
        </div>
      </div>`).join('');
  }

  function changeFontSize(delta) {
    state.fontScale = Math.max(-6, Math.min(8, state.fontScale + delta));
    S.setSettings({ fontScale: state.fontScale });
    renderAyahs();
  }
  global.changeFontSize = changeFontSize;

  function toggleTafsir() {
    state.showTafsir = !state.showTafsir;
    S.setSettings({ showTafsir: state.showTafsir });
    renderAyahs();
  }
  global.toggleTafsir = toggleTafsir;

  function toggleAyahAudio(num) {
    if (state.playingAyah === num) {
      stopAudio();
      return;
    }
    stopAudio();
    playAyah(num);
  }
  global.KHALWA_toggleAyahAudio = toggleAyahAudio;

  function playAyah(num) {
    const ayah = state.ayahs.find(a => a.num === num);
    const reciterObj = A.getReciter(state.reciter);

    // Check if reciter only supports full-surah audio (mp3quran)
    if (reciterObj && reciterObj.src === 'mp3quran') {
      toast('هذا القارئ يدعم تشغيل السورة كاملة', 'info');
      playFullSurah(reciterObj);
      return;
    }

    const absNum = ayah ? ayah.absNum : num;
    const url = A.ayahAudioURL(reciterObj, absNum, state.surah, num);
    state.audio = new Audio(url);
    state.audio.play().catch(() => toast('تعذّر تشغيل الصوت', 'error'));
    state.playingAyah = num;

    // حفظ موقف التلاوة للاستئناف لاحقاً
    state.lastAyah = { surah: state.surah, ayah: num, time: Date.now() };
    S.set('lastAyah', state.lastAyah);
    updateResumeButton();

    // إزالة الكلاس "playing" من الأزرار السابقة وإبراز الآية الحالية
    $$('.ayah-btn[data-act="play"]').forEach(b => {
      b.classList.remove('playing');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    });
    $$('.ayah-wrap').forEach(w => w.classList.remove('playing-ayah'));

    const btn = document.querySelector(`.ayah-btn[data-act="play"][data-num="${num}"]`);
    if (btn) {
      btn.classList.add('playing');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }
    const ayahEl = document.querySelector(`.ayah-wrap[data-num="${num}"]`);
    if (ayahEl) ayahEl.classList.add('playing-ayah');

    // السكرول التلقائي إلى الآية الحالية
    if (state.autoScroll && ayahEl) {
      ayahEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // إظهار زر الإيقاف في شريط الصوت
    const stopBtn = $('stopBtn');
    if (stopBtn) stopBtn.style.display = 'flex';
    // تحديث أيقونة زر التشغيل في شريط الصوت
    const playerBtn = $('playerBtn');
    if (playerBtn) playerBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

    state.audio.addEventListener('ended', () => {
      // Try to play next ayah
      const idx = state.ayahs.findIndex(a => a.num === num);
      if (idx >= 0 && idx < state.ayahs.length - 1) {
        playAyah(state.ayahs[idx + 1].num);
      } else {
        stopAudio();
        toast('تمت السورة بحمد الله 🌙', 'success', 2500);
      }
    });
    state.audio.addEventListener('error', () => {
      stopAudio();
      toast('تعذّر تشغيل هذه الآية', 'error');
    });
    // Update audio bar
    if ($('audioSurahName')) {
      const s = global.SURAHS.find(s => s.n === state.surah);
      $('audioSurahName').textContent = s ? s.name : '';
    }
    if ($('audioAyahNum')) $('audioAyahNum').textContent = `الآية ${arabicDigits(num)}`;
  }

  function playFullSurah(reciterObj) {
    const url = A.surahAudioURL(reciterObj, state.surah);
    if (!url) {
      toast('تعذّر تشغيل السورة كاملة', 'error');
      return;
    }
    stopAudio();
    state.audio = new Audio(url);
    state.isPlayingSurah = true;
    state.playingAyah = 'full';
    state.audio.play().catch(() => toast('تعذّر تشغيل الصوت', 'error'));
    // Update audio bar
    if ($('audioSurahName')) {
      const s = global.SURAHS.find(s => s.n === state.surah);
      $('audioSurahName').textContent = s ? s.name : '';
    }
    if ($('audioAyahNum')) $('audioAyahNum').textContent = 'تشغيل السورة كاملة';
    state.audio.addEventListener('ended', () => {
      stopAudio();
    });
    state.audio.addEventListener('error', () => {
      stopAudio();
      toast('تعذّر تشغيل السورة', 'error');
    });
  }

  function stopAudio() {
    if (state.audio) {
      state.audio.pause();
      state.audio.src = '';
      state.audio = null;
    }
    if (state.playingAyah) {
      if (state.playingAyah !== 'full') {
        const btn = document.querySelector(`.ayah-btn[data-act="play"][data-num="${state.playingAyah}"]`);
        if (btn) {
          btn.classList.remove('playing');
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        }
        const ayahEl = document.querySelector(`.ayah-wrap[data-num="${state.playingAyah}"]`);
        if (ayahEl) ayahEl.classList.remove('playing-ayah');
      }
      state.playingAyah = null;
    }
    state.isPlayingSurah = false;
    if ($('audioAyahNum')) $('audioAyahNum').textContent = 'اضغط على آية للاستماع';
    // إخفاء زر الإيقاف
    const stopBtn = $('stopBtn');
    if (stopBtn) stopBtn.style.display = 'none';
    // إعادة أيقونة التشغيل في شريط الصوت
    const playerBtn = $('playerBtn');
    if (playerBtn) playerBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  function playSurah() {
    if (!state.ayahs.length) return;
    if (state.playingAyah) { stopAudio(); return; }
    playAyah(state.ayahs[0].num);
  }
  global.playSurah = playSurah;
  global.stopAudio = stopAudio;

  // ── BOOKMARKS ─────────────────────────────────────────────
  function toggleBookmark(num) {
    const bm = S.get('bookmarks', []);
    const surah = (global.SURAHS || []).find(s => s.n === state.surah);
    const idx = bm.findIndex(b => b.surah === state.surah && b.ayah === num);
    if (idx >= 0) {
      bm.splice(idx, 1);
      toast('أُزيلت من المحفوظات', 'info');
    } else {
      bm.push({ surah: state.surah, ayah: num, surahName: surah ? surah.name : '', text: state.ayahs.find(a => a.num === num)?.text || '' });
      toast('تم الحفظ', 'success');
    }
    S.set('bookmarks', bm);
  }
  global.KHALWA_toggleBookmark = toggleBookmark;

  function showBookmarks() {
    navTo('library');
    const bm = S.get('bookmarks', []);
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">الآيات المحفوظة</h3>
      ${bm.length ? `<div class="surah-list-wrap">${bm.map((b, i) => `
        <div class="surah-list-item" onclick="KHALWA.openBookmark(${i})">
          <div class="sli-num">${arabicDigits(b.surah)}:${arabicDigits(b.ayah)}</div>
          <div>
            <div class="sli-name">${escapeHtml(b.surahName)} — آية ${arabicDigits(b.ayah)}</div>
            <div class="sli-meta" style="font-family:var(--f-q)">${escapeHtml((b.text || '').slice(0, 80))}…</div>
          </div>
        </div>`).join('')}</div>`
      : '<div class="empty"><div class="empty-icon">🔖</div><div class="empty-title">لا توجد آيات محفوظة</div><div class="empty-text">احفظ آياتك المفضلة من صفحة القرآن</div></div>'}
    `;
    openSheet(html, 'الآيات المحفوظة');
  }
  global.showBookmarks = showBookmarks;

  function openBookmark(i) {
    const bm = S.get('bookmarks', []);
    const b = bm[i];
    if (!b) return;
    closeSheet();
    navTo('quran');
    setTimeout(() => {
      pickSurah(b.surah);
      setTimeout(() => {
        const el = document.querySelector(`.ayah-wrap[data-num="${b.ayah}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 600);
    }, 300);
  }

  // ── SHARE AYAH ────────────────────────────────────────────
  function shareAyah(num) {
    const ayah = state.ayahs.find(a => a.num === num);
    if (!ayah) return;
    const surah = (global.SURAHS || []).find(s => s.n === state.surah);
    const text = `${ayah.text}\n— ${surah ? surah.name : ''} : ${arabicDigits(num)}`;
    const url = A.ayahShareURL ? A.ayahShareURL(state.surah, num) : '';
    if (navigator.share) {
      navigator.share({ text: text + (url ? '\n' + url : '') }).catch(() => {});
    } else {
      copyText(text + (url ? '\n' + url : ''));
      toast('تم نسخ الآية', 'success');
    }
  }

  function shareAyahWithTafsir(num) {
    const ayah = state.ayahs.find(a => a.num === num);
    if (!ayah) return;
    const surah = (global.SURAHS || []).find(s => s.n === state.surah);
    let text = `${ayah.text}\n— ${surah ? surah.name : ''} : ${arabicDigits(num)}`;
    if (ayah.tafsir) text += `\n\n📌 التفسير:\n${ayah.tafsir}`;
    const url = A.ayahShareURL ? A.ayahShareURL(state.surah, num) : '';
    if (navigator.share) {
      navigator.share({ text: text + (url ? '\n' + url : '') }).catch(() => {});
    } else {
      copyText(text + (url ? '\n' + url : ''));
      toast('تم نسخ الآية مع التفسير', 'success');
    }
  }

  function showShareOptions(num) {
    const ayah = state.ayahs.find(a => a.num === num);
    if (!ayah) return;
    const surah = (global.SURAHS || []).find(s => s.n === state.surah);
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">مشاركة الآية</h3>
      <div style="font-family:var(--f-q);font-size:18px;line-height:2;margin-bottom:14px;color:var(--tx1)">${escapeHtml(ayah.text)}</div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:16px">${surah ? surah.name : ''} : ${arabicDigits(num)}</div>
      <button class="btn btn-primary btn-full" style="margin-bottom:10px" onclick="KHALWA.shareAyah(${num});closeSheet()">مشاركة الآية</button>
      <button class="btn btn-sec btn-full" style="margin-bottom:10px" onclick="KHALWA.shareAyahWithTafsir(${num});closeSheet()">مشاركة الآية مع التفسير</button>
      <button class="btn btn-ghost btn-full" onclick="closeSheet()">إلغاء</button>
    `;
    openSheet(html, 'مشاركة الآية');
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ──────────────────────────────────────────────────────────
  // 7. KHALWA TIMER + TASBEEH
  // ──────────────────────────────────────────────────────────
  function pickKType(t) {
    state.khalwa.type = t;
    $$('.kh-type').forEach(b => b.classList.toggle('on', b.dataset.kt === t));
    renderKhalwaGuidance(t);
  }
  global.pickKType = pickKType;

  function renderKhalwaGuidance(type) {
    const wrap = $('khGuidance');
    if (!wrap) return;
    const g = KHALWA_GUIDANCE[type];
    if (!g) { wrap.innerHTML = ''; return; }
    let html = `
      <div class="card kh-guidance kh-guidance-pro">
        <div class="kh-guidance-hd">
          <span class="kh-guidance-icon">${g.title.split(' ')[0]}</span>
          <div class="kh-guidance-title">${escapeHtml(g.title)}</div>
        </div>
        <div class="kh-tips-list">
          ${g.tips.map(t => `<div class="kh-tip-row"><span class="kh-tip-bullet">●</span><span>${escapeHtml(t)}</span></div>`).join('')}
        </div>
        <div class="kh-virtue-box">${escapeHtml(g.virtue)}</div>
        ${g.suggestions ? `<div class="kh-section"><div class="kh-section-hd">💡 اقتراحات</div><div class="kh-suggestions">${g.suggestions.map(s => `<span class="kh-suggestion">${escapeHtml(s)}</span>`).join('')}</div></div>` : ''}`;

    // خطة الخلوة (مضافة لتنويع المحتوى)
    if (g.plan && g.plan.length) {
      html += `
        <div class="kh-section">
          <div class="kh-section-hd">⏱️ خطة خلوتك</div>
          ${g.plan.map((p, i) => `
            <div class="kh-plan-row">
              <div class="kh-plan-time">${escapeHtml(p.time)}</div>
              <div class="kh-plan-task">${escapeHtml(p.task)}</div>
            </div>`).join('')}
        </div>`;
    }

    // تأملات (مضافة لتنويع المحتوى)
    if (g.reflections && g.reflections.length) {
      html += `
        <div class="kh-section">
          <div class="kh-section-hd">💭 تأملات</div>
          ${g.reflections.map((t, i) => `<div class="kh-reflection-row"><span class="kh-reflection-num">${arabicDigits(i + 1)}</span><span>${escapeHtml(t)}</span></div>`).join('')}
        </div>`;
    }

    // Tafakkur topics
    if (g.topics && g.topics.length) {
      html += `
        <div class="kh-section">
          <div class="kh-section-hd">🌙 موضوعات للتأمّل</div>
          ${g.topics.map((t, i) => `<div class="kh-topic-row"><span class="kh-topic-num">${arabicDigits(i + 1)}</span><span>${escapeHtml(t)}</span></div>`).join('')}
        </div>`;
    }

    // Dhikr adhkarList
    if (g.adhkarList && g.adhkarList.length) {
      html += `
        <div class="kh-section">
          <div class="kh-section-hd">📿 أذكار للقول</div>
          ${g.adhkarList.map(d => `
            <div class="kh-adhkar-row">
              <div class="kh-adhkar-text">${escapeHtml(d.text)}</div>
              <div class="kh-adhkar-foot">
                <span>${escapeHtml(d.desc)}</span>
                ${d.virtue ? `<span class="kh-adhkar-virtue">✨ ${escapeHtml(d.virtue)}</span>` : ''}
                <span class="kh-adhkar-count">${arabicDigits(d.count)} مرة</span>
              </div>
            </div>`).join('')}
        </div>`;
    }

    // Dua duas
    if (g.duas && g.duas.length) {
      html += `
        <div class="kh-section">
          <div class="kh-section-hd">🤲 أدعية مأثورة</div>
          ${g.duas.map(d => `
            <div class="kh-dua-row">
              <div class="kh-dua-text">${escapeHtml(d.text)}</div>
              <div class="kh-dua-src">📖 ${escapeHtml(d.source)}</div>
            </div>`).join('')}
        </div>`;
    }

    // Reading recommendedSurahs
    if (g.recommendedSurahs && g.recommendedSurahs.length) {
      html += `
        <div class="kh-section">
          <div class="kh-section-hd">📖 سور مُوصى بها</div>
          ${g.recommendedSurahs.map(s => `
            <div class="kh-surah-row">
              <div class="kh-surah-name">${escapeHtml(s.name)}</div>
              <div class="kh-surah-reason">${escapeHtml(s.reason)}</div>
            </div>`).join('')}
        </div>`;
    }

    html += '</div>';
    wrap.innerHTML = html;
  }

  function pickKDur(m) {
    state.khalwa.duration = m * 60;
    state.khalwa.remaining = state.khalwa.running ? state.khalwa.remaining : m * 60;
    $$('.dur-btn').forEach(b => b.classList.toggle('on', parseInt(b.dataset.dur, 10) === m));
    if (!state.khalwa.running) updateTimerDisplay();
  }
  global.pickKDur = pickKDur;

  function toggleKhalwa() {
    if (state.khalwa.running) stopKhalwa();
    else startKhalwa();
  }
  global.toggleKhalwa = toggleKhalwa;

  function startKhalwa() {
    if (state.khalwa.remaining <= 0) state.khalwa.remaining = state.khalwa.duration;
    state.khalwa.running = true;
    $('ringInner')?.classList.remove('paused');
    const btn = $('khBtn');
    if (btn) {
      btn.classList.add('running');
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> إيقاف الخلوة';
    }
    state.khalwa.timer = setInterval(() => {
      state.khalwa.remaining--;
      updateTimerDisplay();
      if (state.khalwa.remaining <= 0) {
        stopKhalwa(true);
        bumpStat('khalwaCount');
        const today = todayKey();
        const s = S.getStats();
        if (s.lastKhDate !== today) { s.lastKhDate = today; S.setStats(s); }
        updateStatsStrip();
        toast('تمت خلوتك بنجاح 🌙', 'success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    }, 1000);
  }

  function stopKhalwa(complete = false) {
    state.khalwa.running = false;
    clearInterval(state.khalwa.timer);
    $('ringInner')?.classList.add('paused');
    const btn = $('khBtn');
    if (btn) {
      btn.classList.remove('running');
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> ابدأ الخلوة';
    }
    if (!complete) state.khalwa.remaining = state.khalwa.duration;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const r = state.khalwa.remaining || state.khalwa.duration;
    const total = state.khalwa.duration || 1;
    const num = $('timerNum');
    if (num) num.textContent = fmtTime(r);
    const ring = $('khRing');
    if (ring) {
      const C = 565; // 2*PI*90
      const pct = 1 - (r / total);
      ring.style.strokeDashoffset = String(C * (1 - pct));
    }
    const status = $('timerStatus');
    if (status) status.textContent = state.khalwa.running ? 'جارية الخلوة…' : 'اضغط للبدء';
  }

  // ── TASBEEH ───────────────────────────────────────────────
  function tapTasbeeh() {
    const cycles = global.TASBEEH_CYCLES || [];
    if (!cycles.length) return;
    const cur = state.tasbeeh;
    const cycle = cycles[cur.cycleIdx] || cycles[0];
    cur.current++;
    if (cur.current >= cycle.target) {
      // إتمام دورة الذكر — اعرض فضل الذكر + عبارة لطيفة
      const virtue = TASBEEH_VIRTUES[cycle.ar] || 'أتممت ذكرك، فاحمد الله';
      const kindPhrase = TASBEEH_KIND_PHRASES[Math.floor(Math.random() * TASBEEH_KIND_PHRASES.length)];
      showTasbeehVirtue(virtue, kindPhrase, cycle.ar);
      cur.current = 0;
      cur.cycleIdx = (cur.cycleIdx + 1) % cycles.length;
      toast(`أتممت: ${cycle.trans} 🌟`, 'success');
      if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    } else if (cur.current % 10 === 0 && navigator.vibrate) {
      navigator.vibrate(20);
    }
    S.set('tasbeeh', cur);
    bumpStat('dhikrCount');
    updateStatsStrip();
    updateTasbeehUI();
    // Pulse/ripple animation on tap
    const btn = document.querySelector('.tasbeeh-outer');
    if (btn) {
      btn.classList.remove('tasbeeh-pulse');
      void btn.offsetWidth; // reflow to restart animation
      btn.classList.add('tasbeeh-pulse');
      // Brief scale animation
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => { btn.style.transform = 'scale(1)'; }, 120);
    }
    // Ripple effect
    const inner = document.querySelector('.tasbeeh-inner');
    if (inner) {
      const ripple = document.createElement('div');
      ripple.className = 'tasbeeh-ripple';
      inner.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }
  }
  global.tapTasbeeh = tapTasbeeh;

  /** عرض فضل الذكر عند إتمام دورة */
  function showTasbeehVirtue(virtue, phrase, arText) {
    const el = $('tasbeehVirtue');
    if (!el) return;
    el.innerHTML = `
      <div class="tv-hd">✨ فضل الذكر</div>
      <div class="tv-ar">${escapeHtml(arText)}</div>
      <div class="tv-body">${escapeHtml(virtue)}</div>
      <div class="tv-phrase">${escapeHtml(phrase)}</div>
    `;
    el.style.display = 'block';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    // إخفاء بعد ١٢ ثانية تلقائياً
    clearTimeout(state._tvTimer);
    state._tvTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.style.display = 'none'; }, 400);
    }, 12000);
  }

  /** سماع الذكر الحالي صوتياً — معطّل بناءً على طلب المستخدم */
  function playTasbeehAudio() {
    toast('الاستماع الصوتي معطّل', 'info', 1500);
  }
  global.playTasbeehAudio = playTasbeehAudio;

  function nextTasbeeh() {
    const cycles = global.TASBEEH_CYCLES || [];
    state.tasbeeh.cycleIdx = (state.tasbeeh.cycleIdx + 1) % cycles.length;
    state.tasbeeh.current = 0;
    S.set('tasbeeh', state.tasbeeh);
    // إخفاء فضل الذكر عند الانتقال
    const v = $('tasbeehVirtue');
    if (v) { v.classList.remove('show'); v.style.display = 'none'; }
    updateTasbeehUI();
  }
  global.nextTasbeeh = nextTasbeeh;

  function resetTasbeeh() {
    state.tasbeeh = { current: 0, cycleIdx: 0 };
    S.set('tasbeeh', state.tasbeeh);
    const v = $('tasbeehVirtue');
    if (v) { v.classList.remove('show'); v.style.display = 'none'; }
    updateTasbeehUI();
  }
  global.resetTasbeeh = resetTasbeeh;

  function updateTasbeehUI() {
    const cycles = global.TASBEEH_CYCLES || [];
    const c = cycles[state.tasbeeh.cycleIdx] || cycles[0];
    if (!c) return;
    const cnt = $('tasbeehCount'); if (cnt) cnt.textContent = arabicDigits(state.tasbeeh.current);
    const tgt = $('tasbeehTarget'); if (tgt) tgt.textContent = '/ ' + arabicDigits(c.target);
    const ar = $('tasbeehAr'); if (ar) ar.textContent = c.ar;
    // معلومات الدورة (الذكر N من M)
    const info = $('tasbeehCycleInfo');
    if (info) info.textContent = `الذكر ${arabicDigits(state.tasbeeh.cycleIdx + 1)} من ${arabicDigits(cycles.length)}`;
    const ring = $('tRing');
    // Color rotation for tasbeeh with smooth transition — لون مميز لكل ذكر
    const colors = ['#2D6A4F','#C8972A','#40916C','#92620C','#74C69D','#E8B845','#1B4332','#D4A017'];
    const colorIdx = (state.tasbeeh.cycleIdx) % colors.length;
    if (ring) {
      const C = 339;
      ring.style.transition = 'stroke 0.6s ease, stroke-dashoffset 0.3s ease';
      ring.style.strokeDashoffset = String(C * (1 - state.tasbeeh.current / c.target));
      ring.style.stroke = colors[colorIdx];
    }
    // Update tasbeeh outer button color with smooth transition
    const outer = document.querySelector('.tasbeeh-outer');
    if (outer) {
      outer.style.transition = 'border-color 0.6s ease, box-shadow 0.6s ease, transform 0.12s ease';
      outer.style.borderColor = colors[colorIdx];
      outer.style.boxShadow = `0 0 20px ${colors[colorIdx]}30`;
    }
    // Update tasbeeh count color with smooth transition
    const countEl = $('tasbeehCount');
    if (countEl) {
      countEl.style.transition = 'color 0.6s ease';
      countEl.style.color = colors[colorIdx];
    }
  }

  // ──────────────────────────────────────────────────────────
  // 8. ADHKAR
  // ──────────────────────────────────────────────────────────
  function switchAdhkarTab(tab) {
    state.adhkarTab = tab;
    $$('.adhkar-tab').forEach(b => b.classList.toggle('on', b.dataset.atab === tab));
    renderAdhkar();
  }
  global.switchAdhkarTab = switchAdhkarTab;

  function renderAdhkar() {
    const wrap = $('adhkarList');
    if (!wrap) return;
    const all = global.ADHKAR || {};
    const tab = state.adhkarTab;
    const list = all[tab] || [];
    if (!list.length) {
      wrap.innerHTML = '<div class="empty"><div class="empty-icon">📿</div><div class="empty-title">لا توجد أذكار</div></div>';
      return;
    }
    const progress = state.adhkarProgress[tab] || {};
    wrap.innerHTML = list.map((d, i) => {
      const id = d.id || i;
      const cur = Math.min(progress[id] || 0, d.count);
      const done = cur >= d.count;
      return `
        <div class="adhkar-card ${done ? 'done' : ''}" data-id="${id}" data-i="${i}">
          <div class="adhkar-card-hd">
            <div class="adhkar-src">${escapeHtml(d.src || '')}</div>
          </div>
          <div class="adhkar-ar">${escapeHtml(d.text)}</div>
          ${d.ben ? `<div class="adhkar-ben">${escapeHtml(d.ben)}</div>` : ''}
          <div class="adhkar-foot">
            <div class="adhkar-progress">
              <span class="adhkar-done-n">${arabicDigits(cur)}</span>
              <span class="adhkar-total-n">/ ${arabicDigits(d.count)}</span>
            </div>
            ${done
              ? '<button class="adhkar-check">✓ تم</button>'
              : `<button class="adhkar-tap" onclick="KHALWA.tapAdhkar('${tab}', ${i})">اضغط للذكر</button>`}
          </div>
        </div>`;
    }).join('');
    // Progress bar
    const total = list.reduce((a, d) => a + d.count, 0);
    const done = list.reduce((a, d, i) => {
      const id = d.id || i;
      return a + Math.min(progress[id] || 0, d.count);
    }, 0);
    const pf = $('adhkarPF');
    if (pf) pf.style.width = (total ? (done / total * 100) : 0) + '%';
    const pt = $('adhkarPT');
    if (pt) pt.textContent = `${arabicDigits(done)} / ${arabicDigits(total)}`;
  }

  function tapAdhkar(tab, i) {
    const all = global.ADHKAR || {};
    const list = all[tab] || [];
    const d = list[i];
    if (!d) return;
    const id = d.id || i;
    if (!state.adhkarProgress[tab]) state.adhkarProgress[tab] = {};
    state.adhkarProgress[tab][id] = (state.adhkarProgress[tab][id] || 0) + 1;
    S.set('adhkarProgress', state.adhkarProgress);
    bumpStat('dhikrCount');
    updateStatsStrip();
    if (state.adhkarProgress[tab][id] >= d.count) {
      toast('تمّ الذكر 🌟', 'success');
      if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    } else if (navigator.vibrate) navigator.vibrate(15);
    renderAdhkar();
  }

  /** تشغيل ذكر واحد صوتياً — معطّل بناءً على طلب المستخدم */
  function playOneAdhkarAudio(tab, i) {
    toast('الاستماع الصوتي للأذكار معطّل', 'info', 1500);
  }

  /** تشغيل كل أذكار القسم صوتياً — معطّل بناءً على طلب المستخدم */
  function playAllAdhkarAudio() {
    toast('الاستماع الصوتي للأذكار معطّل', 'info', 1500);
  }
  global.playAllAdhkarAudio = playAllAdhkarAudio;

  /** إيقاف تشغيل الأذكار — معطّل */
  function stopAdhkarAudio() {
    // لا شيء — الصوت معطّل
  }
  global.stopAdhkarAudio = stopAdhkarAudio;

  // ──────────────────────────────────────────────────────────
  // 9. LIBRARY: PROPHETS / COMPANIONS / SEERAH / FIQH / ASMA
  // ──────────────────────────────────────────────────────────
  function renderProphets() {
    const wrap = $('prophetsWrap');
    if (!wrap) return;
    const list = global.PROPHETS || [];
    if (!list.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">📖</div><div class="empty-title">لا توجد قصص</div></div>'; return; }
    wrap.innerHTML = `<div class="story-grid">${list.map((p, i) => `
      <div class="story-card" onclick="KHALWA.openStory('prophets', ${i})">
        <div class="story-hd">
          <div class="story-icon">${p.icon || '🌟'}</div>
          <div>
            <div class="story-name">${escapeHtml(p.name)}</div>
            <div class="story-sub">${escapeHtml(p.era || '')}</div>
          </div>
        </div>
        <div class="story-tags">${(p.tags || []).slice(0, 3).map(t => `<span class="story-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>`).join('')}</div>`;
  }

  function renderCompanions() {
    const wrap = $('companionsWrap');
    if (!wrap) return;
    const isFemale = state.companionTab === 'female';
    const list = isFemale ? (global.FEMALE_COMPANIONS || []) : (global.COMPANIONS || []);
    if (!list.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">🌟</div><div class="empty-title">لا توجد قصص</div></div>'; return; }
    const kind = isFemale ? 'female' : 'companions';
    wrap.innerHTML = `<div class="story-grid">${list.map((c, i) => `
      <div class="story-card" onclick="KHALWA.openStory('${kind}', ${i})">
        <div class="story-hd">
          <div class="story-icon">${c.icon || (isFemale ? '🌸' : '⭐')}</div>
          <div>
            <div class="story-name">${escapeHtml(c.name)}</div>
            <div class="story-sub">${escapeHtml(c.era || '')}</div>
          </div>
        </div>
        <div class="story-tags">${(c.tags || []).slice(0, 3).map(t => `<span class="story-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>`).join('')}</div>`;
  }

  function renderSeerah() {
    const wrap = $('seerahWrap');
    if (!wrap) return;

    if (state.seerahTab === 'family') {
      // عرض أهل البيت: زوجات + أبناء + بنات
      const groups = global.SEERAH_FAMILY || [];
      if (!groups.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">🏠</div><div class="empty-title">لا توجد بيانات</div></div>'; return; }
      let html = '';
      groups.forEach(g => {
        html += `
          <div class="seerah-group-card">
            <div class="seerah-group-hd">
              <span class="seerah-group-icon">${g.icon || '🏠'}</span>
              <h2 class="seerah-group-title">${escapeHtml(g.group)}</h2>
            </div>
            <div class="seerah-group-grid">
              ${g.items.map((item, i) => `
                <button class="seerah-family-card" onclick="KHALWA.openFamilyStory('${escapeHtml(g.group)}', ${i})">
                  <div class="seerah-family-icon">${g.icon || '🏠'}</div>
                  <div class="seerah-family-name">${escapeHtml(item.name)}</div>
                  <div class="seerah-family-title">${escapeHtml(item.title || '')}</div>
                </button>`).join('')}
            </div>
          </div>`;
      });
      wrap.innerHTML = html;
      return;
    }

    // مراحل السيرة (default) — تنسيق الأكورديون
    const list = global.SEERAH || [];
    if (!list.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">📖</div><div class="empty-title">لا توجد سيرة</div></div>'; return; }
    wrap.innerHTML = `
      <div class="story-accordion">
        ${list.map((s, i) => `
          <div class="accordion-card" data-idx="${i}">
            <button class="accordion-hd" onclick="KHALWA.toggleAccordion(this)" aria-expanded="false">
              <div class="accordion-hd-text">
                <div class="accordion-title">${arabicDigits(i + 1)}. ${escapeHtml(s.title)}</div>
                ${s.summary ? `<div class="accordion-summary">${escapeHtml(s.summary)}</div>` : ''}
                ${s.date ? `<div style="font-size:11px;color:var(--tx3);margin-top:4px">📅 ${escapeHtml(s.date)}</div>` : ''}
              </div>
              <svg class="accordion-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="accordion-body">
              ${(s.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  }

  /** فتح قصة فردية من أهل بيت النبي ﷺ */
  function openFamilyStory(groupName, i) {
    const groups = global.SEERAH_FAMILY || [];
    const g = groups.find(x => x.group === groupName);
    if (!g) return;
    const item = g.items[i];
    if (!item) return;
    // تحقق هل الأقسام تحتوي على summary (تنسيق الأكورديون)
    const sections = item.body || [];
    const hasAccordion = sections.some(s => s && s.summary);
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">${escapeHtml(item.name)}</h3>
      <div style="text-align:center;color:var(--tx2);font-size:13px;margin-bottom:8px">${escapeHtml(item.title || '')}</div>
      ${item.era ? `<div style="text-align:center;font-size:12px;color:var(--tx3);margin-bottom:8px">📅 ${escapeHtml(item.era)}</div>` : ''}
      <div style="text-align:center;font-size:13px;color:var(--c-accent);font-weight:700;margin-bottom:14px">${escapeHtml(g.group)}</div>
      ${item.summary ? `<div style="background:var(--c-primary-bg);border-radius:var(--r12);padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--tx2);line-height:1.7">💎 ${escapeHtml(item.summary)}</div>` : ''}
      ${hasAccordion ? `
        <div class="story-accordion">
          ${sections.map((sec, idx) => `
            <div class="accordion-card" data-idx="${idx}">
              <button class="accordion-hd" onclick="KHALWA.toggleAccordion(this)" aria-expanded="false">
                <div class="accordion-hd-text">
                  <div class="accordion-title">${escapeHtml(sec.title || `القسم ${arabicDigits(idx + 1)}`)}</div>
                  ${sec.summary ? `<div class="accordion-summary">${escapeHtml(sec.summary)}</div>` : ''}
                </div>
                <svg class="accordion-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div class="accordion-body">
                ${(sec.body || []).map(t => `<p>${escapeHtml(t)}</p>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      ` : `
        ${sections.map((p, idx) => `
          <div class="story-sec-title">${escapeHtml(p.title || `القسم ${arabicDigits(idx + 1)}`)}</div>
          <div class="story-sec-body">${(p.body || []).map(t => `<p>${escapeHtml(t)}</p>`).join('')}</div>
        `).join('')}
      `}
      ${item.lesson ? `<div class="story-lesson"><span style="font-size:24px">💡</span><div>${escapeHtml(item.lesson)}</div></div>` : ''}
    `;
    openSheet(html, item.name);
  }

  /** عرض الأحاديث الأربعين النووية */
  function renderNawawi() {
    const wrap = $('nawawiWrap');
    if (!wrap) return;
    const list = global.NAWAWI_FORTY || [];
    if (!list.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">📜</div><div class="empty-title">لا توجد أحاديث</div></div>'; return; }
    wrap.innerHTML = `<div class="story-grid">${list.map((h, i) => `
      <div class="story-card" onclick="KHALWA.openNawawiHadith(${i})">
        <div class="story-hd">
          <div class="story-icon">${h.icon || '📜'}</div>
          <div>
            <div class="story-name">${arabicDigits(h.number || (i+1))}. ${escapeHtml(h.title || '')}</div>
            <div class="story-sub">${escapeHtml(h.narrator || '')}</div>
          </div>
        </div>
        <div class="story-tags">
          ${h.grade ? `<span class="story-tag">${escapeHtml(h.grade)}</span>` : ''}
          <span class="story-tag">${escapeHtml((h.source || '').split('—')[0].trim())}</span>
        </div>
      </div>`).join('')}</div>`;
  }

  /** فتح حديث نووي فردي مع شرحه */
  function openNawawiHadith(i) {
    const list = global.NAWAWI_FORTY || [];
    const h = list[i];
    if (!h) return;
    const sections = h.explanation || [];
    const hasAccordion = sections.some(s => s && s.summary);
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">الحديث ${arabicDigits(h.number || (i+1))}: ${escapeHtml(h.title)}</h3>
      <div style="text-align:center;color:var(--tx2);font-size:13px;margin-bottom:6px">👤 ${escapeHtml(h.narrator || '')}</div>
      <div style="text-align:center;color:var(--c-accent);font-size:12px;font-weight:700;margin-bottom:14px">📚 ${escapeHtml(h.source || '')}</div>
      ${h.grade ? `<div style="text-align:center;margin-bottom:14px"><span style="background:var(--c-primary-bg);color:var(--c-primary);padding:4px 12px;border-radius:var(--rfull);font-size:11px;font-weight:700">${escapeHtml(h.grade)}</span></div>` : ''}
      ${h.summary ? `<div style="background:var(--c-primary-bg);border-radius:var(--r12);padding:12px 14px;margin-bottom:16px;font-size:13px;color:var(--tx2);line-height:1.7;border-right:3px solid var(--c-primary)">💎 ${escapeHtml(h.summary)}</div>` : ''}
      <div style="background:linear-gradient(135deg,var(--c-primary-bg) 0%,var(--surface) 100%);border:1px solid var(--c-primary);border-radius:var(--r16);padding:14px 16px;margin-bottom:16px">
        <div style="font-size:11px;color:var(--c-primary);font-weight:700;margin-bottom:8px">📜 نص الحديث</div>
        <div style="font-family:'Amiri',serif;font-size:17px;line-height:2;color:var(--tx1)">${escapeHtml(h.text)}</div>
      </div>
      ${hasAccordion ? `
        <div style="font-size:14px;font-weight:800;color:var(--c-primary);margin-bottom:8px">📖 الشرح والفوائد</div>
        <div class="story-accordion">
          ${sections.map((sec, idx) => `
            <div class="accordion-card" data-idx="${idx}">
              <button class="accordion-hd" onclick="KHALWA.toggleAccordion(this)" aria-expanded="false">
                <div class="accordion-hd-text">
                  <div class="accordion-title">${escapeHtml(sec.title || `القسم ${arabicDigits(idx + 1)}`)}</div>
                  ${sec.summary ? `<div class="accordion-summary">${escapeHtml(sec.summary)}</div>` : ''}
                </div>
                <svg class="accordion-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div class="accordion-body">
                ${(sec.body || []).map(t => `<p>${escapeHtml(t)}</p>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      ` : `
        ${sections.map(sec => `
          <div class="story-sec-title">${escapeHtml(sec.title)}</div>
          <div class="story-sec-body">${(sec.body || []).map(t => `<p>${escapeHtml(t)}</p>`).join('')}</div>
        `).join('')}
      `}
      ${h.benefits ? `<div class="story-lesson"><span style="font-size:24px">💡</span><div>${escapeHtml(h.benefits)}</div></div>` : ''}
    `;
    openSheet(html, h.title);
  }

  /** عرض صفحة إذاعة القرآن الكريم */
  function renderRadio() {
    if (global.QuranRadio && typeof global.QuranRadio.render === 'function') {
      global.QuranRadio.render();
    } else {
      const wrap = $('radioWrap');
      if (wrap) wrap.innerHTML = '<div class="empty"><div class="empty-icon">📻</div><div class="empty-title">الراديو غير متاح</div></div>';
    }
  }

  function renderFiqh() {
    const wrap = $('fiqhWrap');
    if (!wrap) return;
    const cats = global.FIQH || [];
    if (!cats.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">📚</div><div class="empty-title">لا توجد مسائل</div></div>'; return; }

    if (state.fiqhChapter != null) {
      // Show items for specific chapter
      const cat = cats[state.fiqhChapter];
      if (!cat) { state.fiqhChapter = null; renderFiqh(); return; }
      wrap.innerHTML = `
        <button class="btn btn-ghost btn-sm" onclick="KHALWA.fiqhBack()" style="margin-bottom:14px">← رجوع للأبواب</button>
        <div class="fiqh-cat-title" style="margin-bottom:12px">${escapeHtml(cat.icon || '📖')} ${escapeHtml(cat.title)} <span style="opacity:.7;font-weight:400">(${arabicDigits(cat.items.length)} مسألة)</span></div>
        ${cat.items.map((it, i) => renderFiqhItem(it, i)).join('')}
      `;
      wrap.scrollTop = 0;
    } else {
      // Show chapter list
      wrap.innerHTML = `<div class="fiqh-chapters-grid">${
        cats.map((cat, i) => `
          <button class="fiqh-chapter-btn" onclick="KHALWA.openFiqhChapter(${i})">
            <div class="fiqh-ch-icon">${cat.icon || '📖'}</div>
            <div class="fiqh-ch-title">${escapeHtml(cat.title)}</div>
            <div class="fiqh-ch-count">${arabicDigits(cat.items.length)} مسألة</div>
          </button>`
        ).join('')
      }</div>`;
    }
  }

  /** تصيير مسألة فقهية واحدة مع تصنيف الدليل */
  function renderFiqhItem(it, i) {
    // تصنيف الدليل تلقائياً حسب الكلمات الدالة
    let dalilType = 'general';
    let dalilLabel = '📌 الدليل';
    if (it.dalil) {
      const d = it.dalil;
      // أولوية: نتحقق من السنة أولاً، ثم الإجماع، ثم المذاهب، ثم القرآن (لأن نص القرآن مميز بـ ﴿)
      if (/قال النبي ﷺ|قال رسول الله|«|رواه|البخاري|مسلم|أبو داود|الترمذي|النسائي|ابن ماجه|أحمد|عن أبي|عن ابن|عن أنس|عن عائشة|عن عمر|عن علي/i.test(d)) {
        dalilType = 'sunnah';
        dalilLabel = '📜 من السنة';
      } else if (/إجماع|أجمع العلماء|اتفاق/i.test(d)) {
        dalilType = 'ijma';
        dalilLabel = '🤝 من الإجماع';
      } else if (/ذهب الحنفية|ذهب المالكية|ذهب الشافعية|ذهب الحنابلة|اتفقت المذاهب|المذاهب الأربعة|قاعدة فقهية|الأشباه|عند أبي حنيفة|عند مالك|عند الشافعي|عند أحمد/i.test(d) || (it.ref && /المغني|المجموع|روضة|بداية|الأم|المبسوط|الكافي|نيل الأوطار|الأشباه/i.test(it.ref))) {
        dalilType = 'madhahib';
        dalilLabel = '⚖️ من المذاهب';
      } else if (/قال الله تعالى:|﴿|\[[^\]]*\]/i.test(d)) {
        dalilType = 'quran';
        dalilLabel = '📖 من القرآن';
      }
    }

    return `
      <div class="fiqh-item">
        <button class="fiqh-q" onclick="KHALWA.toggleFiqh(this)">
          <span class="fiqh-q-num">${arabicDigits(i + 1)}</span>
          <span class="fiqh-q-text">${escapeHtml(it.q)}</span>
          <svg class="fiqh-q-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="fiqh-a">
          <div class="fiqh-answer-hd">💬 الجواب</div>
          <div class="fiqh-answer">${escapeHtml(it.a)}</div>
          ${it.dalil ? `
            <div class="fiqh-dalil-pro fiqh-dalil-${dalilType}">
              <div class="fiqh-dalil-hd">${dalilLabel}</div>
              <div class="fiqh-dalil-body">${escapeHtml(it.dalil)}</div>
            </div>` : ''}
          ${it.ref ? `<div class="fiqh-ref">📚 المرجع: ${escapeHtml(it.ref)}</div>` : ''}
        </div>
      </div>`;
  }

  function openFiqhChapter(idx) {
    state.fiqhChapter = idx;
    renderFiqh();
  }
  function fiqhBack() {
    state.fiqhChapter = null;
    renderFiqh();
  }

  function toggleFiqh(btn) {
    const a = btn.nextElementSibling;
    btn.classList.toggle('open');
    if (a) a.classList.toggle('open');
  }

  function renderAsma() {
    const grid = $('asmaGrid');
    if (!grid) return;
    const list = global.ASMA || [];
    if (!list.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = list.map((a, i) => `
      <div class="asma-card" onclick="KHALWA.showAsma(${i})">
        <div class="asma-n">${arabicDigits(i + 1)}</div>
        <div class="asma-ar">${escapeHtml(a.ar)}</div>
        <div class="asma-en">${escapeHtml(a.en || '')}</div>
      </div>`).join('');
  }

  function showAsma(i) {
    const a = (global.ASMA || [])[i];
    if (!a) return;
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">${escapeHtml(a.ar)}</h3>
      <div style="text-align:center;font-size:18px;color:var(--tx2);margin-bottom:14px">${escapeHtml(a.en || '')}</div>
      <div class="asma-desc-full">${escapeHtml(a.desc || a.ta || '')}</div>
    `;
    openSheet(html, a.ar);
  }

  function openStory(kind, i) {
    let list;
    if (kind === 'prophets') list = (global.PROPHETS || []);
    else if (kind === 'female') list = (global.FEMALE_COMPANIONS || []);
    else list = (global.COMPANIONS || []);
    const item = list[i];
    if (!item) return;
    // إذا كان القسم يحتوي على summary (تنسيق الأكورديون الجديد)
    const hasAccordion = (item.sections || []).some(s => s.summary);
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">${escapeHtml(item.name)}</h3>
      <div style="text-align:center;color:var(--tx2);font-size:13px;margin-bottom:8px">${escapeHtml(item.era || '')} • ${escapeHtml(item.title || '')}</div>
      <div class="story-tags" style="justify-content:center;display:flex;margin-bottom:14px">
        ${(item.tags || []).map(t => `<span class="story-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      ${hasAccordion ? `
        <div class="story-accordion">
          ${(item.sections || []).map((sec, idx) => `
            <div class="accordion-card" data-idx="${idx}">
              <button class="accordion-hd" onclick="KHALWA.toggleAccordion(this)" aria-expanded="false">
                <div class="accordion-hd-text">
                  <div class="accordion-title">${escapeHtml(sec.title)}</div>
                  ${sec.summary ? `<div class="accordion-summary">${escapeHtml(sec.summary)}</div>` : ''}
                </div>
                <svg class="accordion-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div class="accordion-body">
                ${(sec.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      ` : `
        ${(item.sections || []).map(sec => `
          <div class="story-sec-title">${escapeHtml(sec.title)}</div>
          <div class="story-sec-body">${(sec.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>
        `).join('')}
      `}
      ${item.lesson ? `<div class="story-lesson"><span style="font-size:24px">💡</span><div>${escapeHtml(item.lesson)}</div></div>` : ''}
    `;
    openSheet(html, item.name);
  }

  /** تبديل حالة أكورديون قصص الأنبياء */
  function toggleAccordion(btn) {
    const card = btn.parentElement;
    const body = card.querySelector('.accordion-body');
    const isOpen = card.classList.contains('open');
    if (isOpen) {
      card.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      body.style.maxHeight = '0';
    } else {
      card.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      body.style.maxHeight = body.scrollHeight + 'px';
    }
  }
  global.KHALWA_toggleAccordion = toggleAccordion;

  // ──────────────────────────────────────────────────────────
  // 10. QIBLA
  // ──────────────────────────────────────────────────────────
  function initQibla() {
    const s = S.getSettings();
    if (!s.lat || !s.lng) {
      // Try to get geolocation automatically
      if (navigator.geolocation) {
        toast('جاري تحديد موقعك للقبلة...', 'info');
        navigator.geolocation.getCurrentPosition(async pos => {
          const { latitude, longitude } = pos.coords;
          S.setSettings({ lat: latitude, lng: longitude });
          toast('تم تحديد موقعك', 'success');
          initQibla();
        }, () => {
          toast('فعّل موقعك أولاً من الإعدادات', 'warning');
          openPrayerSettings();
        }, { timeout: 8000, enableHighAccuracy: true });
      } else {
        toast('الموقع غير مدعوم في هذا المتصفح', 'warning');
        openPrayerSettings();
      }
      return;
    }
    const bearing = A.qiblaBearing(s.lat, s.lng);
    const dist = A.qiblaDistance(s.lat, s.lng);
    state.qibla.bearing = bearing;
    const distEl = $('qiblaDistVal');
    if (distEl) distEl.textContent = arabicDigits(dist) + ' كم';
    const degEl = $('qiblaDegVal');
    if (degEl) degEl.textContent = arabicDigits(Math.round(bearing)) + '°';
    // Rotate the kaaba needle to bearing
    const needle = $('qiblaNeedle');
    if (needle) needle.style.transform = `rotate(${bearing}deg)`;
    const arrow = $('qiblaArrow');
    if (arrow) arrow.style.transform = `rotate(${bearing}deg)`;
    const status = $('qiblaStatus');
    if (status) status.textContent = `اتجاه القبلة: ${arabicDigits(Math.round(bearing))}° من الشمال`;
    // Start compass for live orientation
    startCompass();
  }
  global.initQibla = initQibla;

  function startCompass() {
    if (state.qibla.watching) return;

    const handler = (e) => {
      let heading = null;
      if (typeof e.webkitCompassHeading === 'number') {
        heading = e.webkitCompassHeading;
      } else if (e.alpha != null) {
        // Use absolute orientation if available
        heading = (360 - e.alpha) % 360;
      }
      if (heading != null) {
        state.qibla.heading = heading;
        updateQiblaUI();
        // Hide manual fallback if device orientation works
        const manualWrap = $('qiblaManualWrap');
        if (manualWrap) manualWrap.style.display = 'none';
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires permission
        DeviceOrientationEvent.requestPermission().then(p => {
          if (p === 'granted') {
            window.addEventListener('deviceorientation', handler, true);
            state.qibla.watching = true;
            state.qibla.handler = handler;
          } else {
            toast('رفض إذن البوصلة، يُعرض الاتجاه الثابت', 'warning');
            showManualBearingFallback();
          }
        }).catch(() => {
          showManualBearingFallback();
        });
      } else {
        window.addEventListener('deviceorientationabsolute', handler, true);
        window.addEventListener('deviceorientation', handler, true);
        state.qibla.watching = true;
        state.qibla.handler = handler;
        // Check if we actually get orientation data after a timeout
        setTimeout(() => {
          if (state.qibla.heading == null) {
            showManualBearingFallback();
          }
        }, 2000);
      }
    } else {
      showManualBearingFallback();
    }
  }

  function showManualBearingFallback() {
    const wrap = $('qiblaManualWrap');
    if (!wrap) {
      // Create the manual bearing input if it doesn't exist
      const qiblaPage = $('pg-qibla');
      if (!qiblaPage) return;
      const div = document.createElement('div');
      div.id = 'qiblaManualWrap';
      div.style.cssText = 'margin-top:16px;text-align:center;';
      div.innerHTML = `
        <div style="font-size:12px;color:var(--tx3);margin-bottom:8px">البوصلة غير متاحة — أدخل الاتجاه يدوياً:</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px">
          <input id="qiblaManualBearing" type="number" min="0" max="360" placeholder="° درجة" style="width:80px;text-align:center;padding:8px;border:1px solid var(--surface2);border-radius:var(--r8);background:var(--surface);color:var(--tx1)" oninput="KHALWA.setManualBearing(this.value)"/>
          <button class="btn btn-sec btn-sm" onclick="KHALWA.setManualBearing(document.getElementById('qiblaManualBearing').value)">تطبيق</button>
        </div>`;
      qiblaPage.appendChild(div);
    } else {
      wrap.style.display = 'block';
    }
  }

  function setManualBearing(val) {
    const heading = parseFloat(val);
    if (isNaN(heading) || heading < 0 || heading > 360) {
      toast('أدخل درجة صحيحة بين 0 و 360', 'warning');
      return;
    }
    state.qibla.heading = heading % 360;
    updateQiblaUI();
  }

  function updateQiblaUI() {
    if (state.qibla.heading == null || state.qibla.bearing == null) return;
    const diff = (state.qibla.bearing - state.qibla.heading + 360) % 360;
    const arrow = $('qiblaArrow');
    if (arrow) arrow.style.transform = `rotate(${diff}deg)`;
    const needle = $('qiblaNeedle');
    if (needle) needle.style.transform = `rotate(${diff}deg)`;
    const status = $('qiblaStatus');
    if (status) {
      const aligned = Math.abs(diff) < 8 || Math.abs(diff - 360) < 8;
      status.textContent = aligned ? 'أنت متجه نحو القبلة 🕋' : 'وجّه سهمك نحو الدرجة المحددة';
      status.style.color = aligned ? 'var(--ok)' : 'var(--tx2)';
    }
  }

  // ──────────────────────────────────────────────────────────
  // 11. SEARCH
  // ──────────────────────────────────────────────────────────
  function openSearch() {
    $('searchOverlay').classList.add('open');
    setTimeout(() => $('searchInp')?.focus(), 200);
  }
  global.openSearch = openSearch;
  function closeSearch() {
    $('searchOverlay').classList.remove('open');
    if ($('searchInp')) $('searchInp').value = '';
    if ($('searchResults')) $('searchResults').innerHTML = '';
  }
  global.closeSearch = closeSearch;

  function handleSearch(q) {
    clearTimeout(state.searchTimer);
    if (!q || q.length < 2) {
      const r = $('searchResults');
      if (r) r.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">ابدأ البحث</div><div class="empty-text">ابحث في كل محتوى التطبيق</div></div>';
      return;
    }
    state.searchTimer = setTimeout(() => {
      const results = searchAll(q);
      const r = $('searchResults');
      if (!r) return;
      if (!results.length) {
        r.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">لا نتائج</div><div class="empty-text">جرّب كلمة أخرى</div></div>';
        return;
      }
      r.innerHTML = results.slice(0, 30).map(res => `
        <div class="search-result" onclick="KHALWA.openSearchResult('${res.kind}', '${res.id || ''}')">
          <div style="font-weight:700;font-size:14px;margin-bottom:3px">${escapeHtml(res.title)}</div>
          <div style="font-size:12px;color:var(--tx2)">${escapeHtml(res.snippet)}</div>
          <div style="font-size:10px;color:var(--tx3);margin-top:3px">${escapeHtml(res.kindLabel)}</div>
        </div>`).join('');
    }, 250);
  }
  global.handleSearch = handleSearch;

  function searchAll(q) {
    const ql = q.toLowerCase();
    const out = [];
    // Surahs
    (global.SURAHS || []).forEach(s => {
      if (s.name.indexOf(q) >= 0 || (s.en && s.en.toLowerCase().indexOf(ql) >= 0)) {
        out.push({ kind: 'surah', id: String(s.n), title: `سورة ${s.name}`, snippet: `${s.type} • ${s.ayahs} آيات`, kindLabel: 'القرآن الكريم' });
      }
    });
    // Prophets
    (global.PROPHETS || []).forEach((p, i) => {
      if (p.name.indexOf(q) >= 0 || (p.tags || []).some(t => t.indexOf(q) >= 0)) {
        out.push({ kind: 'prophet', id: String(i), title: p.name, snippet: p.era || '', kindLabel: 'قصص الأنبياء' });
      }
    });
    // Companions
    (global.COMPANIONS || []).forEach((c, i) => {
      if (c.name.indexOf(q) >= 0 || (c.tags || []).some(t => t.indexOf(q) >= 0)) {
        out.push({ kind: 'companion', id: String(i), title: c.name, snippet: c.era || '', kindLabel: 'الصحابة' });
      }
    });
    // Asma
    (global.ASMA || []).forEach((a, i) => {
      if (a.ar.indexOf(q) >= 0 || (a.en && a.en.toLowerCase().indexOf(ql) >= 0)) {
        out.push({ kind: 'asma', id: String(i), title: a.ar, snippet: a.en || '', kindLabel: 'الأسماء الحسنى' });
      }
    });
    // Fiqh
    (global.FIQH || []).forEach((cat, ci) => {
      (cat.items || []).forEach((it, ii) => {
        if (it.q.indexOf(q) >= 0 || it.a.indexOf(q) >= 0) {
          out.push({ kind: 'fiqh', id: `${ci}.${ii}`, title: it.q, snippet: (it.a || '').slice(0, 80) + '…', kindLabel: 'الفقه' });
        }
      });
    });
    // Adhkar
    Object.keys(global.ADHKAR || {}).forEach(tab => {
      (global.ADHKAR[tab] || []).forEach((d, i) => {
        if (d.text.indexOf(q) >= 0) {
          out.push({ kind: 'dhikr', id: `${tab}.${i}`, title: d.text.slice(0, 60), snippet: d.src || '', kindLabel: 'الأذكار' });
        }
      });
    });
    return out;
  }

  function openSearchResult(kind, id) {
    closeSearch();
    if (kind === 'surah') { navTo('quran'); pickSurah(parseInt(id, 10)); }
    else if (kind === 'prophet') { navTo('prophets'); setTimeout(() => openStory('prophets', parseInt(id, 10)), 200); }
    else if (kind === 'companion') { navTo('companions'); setTimeout(() => openStory('companions', parseInt(id, 10)), 200); }
    else if (kind === 'asma') { navTo('asma'); setTimeout(() => showAsma(parseInt(id, 10)), 200); }
    else if (kind === 'fiqh') {
      navTo('fiqh');
      const [ci, ii] = id.split('.').map(n => parseInt(n, 10));
      setTimeout(() => {
        openFiqhChapter(ci);
        setTimeout(() => {
          const items = $$('#pg-fiqh .fiqh-item');
          const item = items[ii];
          if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const btn = item.querySelector('.fiqh-q');
            if (btn && !btn.classList.contains('open')) toggleFiqh(btn);
          }
        }, 200);
      }, 300);
    }
    else if (kind === 'dhikr') {
      const [tab, i] = id.split('.');
      navTo('adhkar');
      setTimeout(() => {
        switchAdhkarTab(tab);
        setTimeout(() => {
          const cards = $$('#adhkarList .adhkar-card');
          if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      }, 200);
    }
  }

  // ──────────────────────────────────────────────────────────
  // 12. PROFILE
  // ──────────────────────────────────────────────────────────
  function loadProfile() {
    const s = S.getSettings();
    const st = S.getStats();
    const name = s.name || 'أخي الكريم';
    if ($('profileName')) $('profileName').textContent = name;
    if ($('settingsName')) $('settingsName').textContent = name;
    if ($('profileStreak')) $('profileStreak').textContent = arabicDigits(st.streak || 0);
    if ($('profileKh')) $('profileKh').textContent = arabicDigits(st.khalwaCount || 0);
    if ($('profileDhikr')) $('profileDhikr').textContent = arabicDigits(st.dhikrCount || 0);
    // Hijri date via aladhan (cached per day)
    const today = todayKey();
    if (state._hijriDay === today && state._hijriText) {
      if ($('hijriDate')) $('hijriDate').textContent = state._hijriText;
    } else {
      A.fetchPrayerTimes(s.lat, s.lng, s.calcMethod, s.school).then(data => {
        if (data && data.hijri) {
          state._hijriDay = today;
          state._hijriText = data.hijri;
          if ($('hijriDate')) $('hijriDate').textContent = data.hijri;
        }
      });
    }
    renderAchievements(st);
  }

  function renderAchievements(st) {
    const grid = $('achGrid');
    if (!grid) return;
    const achs = [
      { icon: '🌱', title: 'أول خلوة', desc: 'ابدأ أول خلوتك', unlocked: (st.khalwaCount || 0) >= 1 },
      { icon: '🔥', title: '٣ أيام', desc: 'تواصل ٣ أيام', unlocked: (st.streak || 0) >= 3 },
      { icon: '📿', title: '١٠٠ ذكر', desc: 'سبّح ١٠٠ مرة', unlocked: (st.dhikrCount || 0) >= 100 },
      { icon: '📖', title: 'قارئ', desc: 'افتتح القرآن', unlocked: state.ayahs.length > 0 },
      { icon: '🌙', title: '٧ خلوات', desc: 'أكمل ٧ خلوات', unlocked: (st.khalwaCount || 0) >= 7 },
      { icon: '⭐', title: '٧ أيام', desc: 'تواصل أسبوعاً', unlocked: (st.streak || 0) >= 7 },
      { icon: '🏆', title: '٥٠٠ ذكر', desc: '٥٠٠ مرة ذكر', unlocked: (st.dhikrCount || 0) >= 500 },
      { icon: '💎', title: '٣٠ يوماً', desc: 'شهر متواصل', unlocked: (st.streak || 0) >= 30 },
      { icon: '🕌', title: '٣٠ خلوة', desc: '٣٠ خلوتك', unlocked: (st.khalwaCount || 0) >= 30 }
    ];
    grid.innerHTML = achs.map(a => `
      <div class="ach-card ${a.unlocked ? 'unlocked' : 'locked'}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-title">${a.title}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>`).join('');
  }

  function editName() {
    const s = S.getSettings();
    const cur = s.name || '';
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">اسمك</h3>
      <input id="nameInp" class="search-inp" style="width:100%;margin-bottom:14px" value="${escapeHtml(cur)}" placeholder="اكتب اسمك"/>
      <button class="btn btn-primary btn-full" onclick="KHALWA.saveName()">حفظ</button>
    `;
    openSheet(html, 'اسمك');
    setTimeout(() => $('nameInp')?.focus(), 200);
  }
  global.editName = editName;

  function saveName() {
    const v = $('nameInp')?.value.trim();
    if (v) {
      S.setSettings({ name: v });
      toast('تم الحفظ', 'success');
    }
    closeSheet();
    loadProfile();
  }

  function shareApp() {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: 'خُلوة', text: 'تطبيق إسلامي متكامل', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast('تم نسخ الرابط', 'success');
    }
  }
  global.shareApp = shareApp;

  function showAbout() {
    openSheet(`
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">عن خُلوة</h3>
      <div style="text-align:center;font-size:60px;margin-bottom:14px">🕌</div>
      <div style="text-align:center;font-size:18px;font-weight:800;margin-bottom:6px">خُلوة — مساحتك الروحانية</div>
      <div style="text-align:center;color:var(--tx2);font-size:13px;margin-bottom:18px">الإصدار 1.0</div>
      <p style="font-size:14px;line-height:1.9;color:var(--tx1);margin-bottom:12px">تطبيق إسلامي متكامل يجمع بين القرآن الكريم بقراءات متعددة، الأذكار الشاملة، أوقات الصلاة، القبلة، قصص الأنبياء والصحابة، السيرة النبوية الكاملة، والفقه الميسّر في ١٠ أبواب.</p>
      <p style="font-size:13px;color:var(--tx2);line-height:1.8">نسأل الله أن يتقبّل منّا ومنكم صالح الأعمال.</p>
    `, 'عن خُلوة');
  }
  global.showAbout = showAbout;

  function resetData() {
    if (!confirm('هل أنت متأكد؟ سيتم حذف جميع بياناتك (الإحصائيات، المحفوظات، التقدم، الإعدادات).')) return;
    S.clearAll();
    toast('تمت إعادة الضبط', 'success');
    setTimeout(() => location.reload(), 1000);
  }
  global.resetData = resetData;

  // ──────────────────────────────────────────────────────────
  // 13. REMINDERS / NOTIFICATIONS
  // ──────────────────────────────────────────────────────────
  function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') toast('تم تفعيل الإشعارات', 'success');
      });
    }
  }

  function initReminders() {
    // Load saved reminder settings
    const settings = S.getSettings();
    if (settings.reminders) {
      state.reminders = { ...state.reminders, ...settings.reminders };
    }
    // Request notification permission
    requestNotificationPermission();
    // Reset notifiedToday if it's a new day
    const today = todayKey();
    if (state.reminders._notifiedDay !== today) {
      state.reminders.notifiedToday = {};
      state.reminders._notifiedDay = today;
    }
    // Check reminders every 30 seconds
    if (global._reminderInterval) clearInterval(global._reminderInterval);
    global._reminderInterval = setInterval(() => {
      if (!state.reminders.enabled) return;
      checkPrayerReminders();
      checkAdhkarReminders();
    }, 30000);
    // Also check immediately
    checkPrayerReminders();
    checkAdhkarReminders();
  }

  function checkPrayerReminders() {
    const s = S.getSettings();
    if (!s.lat || !s.lng) return;
    // Get cached prayer times from global if available
    const prayerData = global._prayerTimesData;
    if (!prayerData) return;
    const prayers = [
      { key: 'Fajr', name: 'الفجر' },
      { key: 'Dhuhr', name: 'الظهر' },
      { key: 'Asr', name: 'العصر' },
      { key: 'Maghrib', name: 'المغرب' },
      { key: 'Isha', name: 'العشاء' }
    ];
    const now = new Date();
    const today = todayKey();

    for (const p of prayers) {
      const t = prayerDate(prayerData[p.key]);
      if (!t) continue;
      const diffMin = Math.floor((t - now) / 60000);
      const diffSec = Math.floor((t - now) / 1000);

      for (const beforeMin of state.reminders.beforeMinutes) {
        const notifyKey = `${p.key}_${beforeMin}`;
        if (diffMin === beforeMin && diffSec <= beforeMin * 60 && diffSec > (beforeMin - 1) * 60 && !state.reminders.notifiedToday[notifyKey]) {
          state.reminders.notifiedToday[notifyKey] = true;
          const msg = `باقي ${arabicDigits(beforeMin)} دقيقة على صلاة ${p.name}`;
          toast(msg, 'warning', 4000);
          // تذكير بالإشعار النصي فقط (الصوت معطّل بناءً على طلب المستخدم)
          // Send browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('خُلوة — موعد الصلاة', { body: msg, icon: '/icon.png' });
          }
        }
      }

      // At prayer time - play adhan
      if (diffMin === 0 && diffSec <= 30 && diffSec >= 0 && !state.reminders.notifiedToday[`${p.key}_adhan`]) {
        state.reminders.notifiedToday[`${p.key}_adhan`] = true;
        const isFajr = p.key === 'Fajr';
        const adhanId = isFajr ? state.reminders.fajrAdhanId : state.reminders.adhanId;
        playAdhanSound(adhanId, isFajr);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('خُلوة — حان وقت الصلاة', { body: `حان الآن وقت صلاة ${p.name}`, icon: '/icon.png' });
        }
        /* ── تنبيه الفجر ── */
        // (كان يُسجّل نقطة في شجرة الإحسان قبل الحذف)
      }
    }
  }

  function checkAdhkarReminders() {
    const s = S.getSettings();
    if (!s.lat || !s.lng) return;
    const prayerData = global._prayerTimesData;
    if (!prayerData) return;
    const now = new Date();
    const today = todayKey();
    const fajrTime = prayerDate(prayerData.Fajr);
    const asrTime = prayerDate(prayerData.Asr);

    // Morning adhkar: 10 minutes after Fajr
    if (state.reminders.adhkarMorning && fajrTime) {
      const morningTime = new Date(fajrTime.getTime() + 10 * 60000);
      const diffMin = Math.floor((morningTime - now) / 60000);
      if (diffMin === 0 && !state.reminders.notifiedToday['adhkar_morning']) {
        state.reminders.notifiedToday['adhkar_morning'] = true;
        toast('حان وقت أذكار الصباح 🌅', 'info', 4000);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('خُلوة — أذكار الصباح', { body: 'لا تنسَ أذكار الصباح', icon: '/icon.png' });
        }
      }
    }

    // Evening adhkar: 10 minutes after Asr
    if (state.reminders.adhkarEvening && asrTime) {
      const eveningTime = new Date(asrTime.getTime() + 10 * 60000);
      const diffMin = Math.floor((eveningTime - now) / 60000);
      if (diffMin === 0 && !state.reminders.notifiedToday['adhkar_evening']) {
        state.reminders.notifiedToday['adhkar_evening'] = true;
        toast('حان وقت أذكار المساء 🌆', 'info', 4000);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('خُلوة — أذكار المساء', { body: 'لا تنسَ أذكار المساء', icon: '/icon.png' });
        }
      }
    }
  }

  function playPrayerReminder() {
    // معطّل بناءً على طلب المستخدم — لا صوت تنبيه
  }

  /** الحصول على معلومات الأذان المختار */
  function getAdhanInfo(adhanId) {
    if (A && typeof A.getAdhanInfo === 'function') {
      return A.getAdhanInfo(adhanId);
    }
    return { id: adhanId, name: 'أذان', type: 'tts', voice: adhanId };
  }

  /** تشغيل تذكير صوتي "حي على الصلاة" — معطّل بناءً على طلب المستخدم */
  function playPrePrayerReminder() {
    // الصوت معطّل — الإشعار فقط
    toast('📣 حان وقت الصلاة', 'info', 3000);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('خُلوة — وقت الصلاة', { body: 'حان وقت الصلاة', icon: '/icon.png' });
      } catch (e) {}
    }
  }

  /** تجربة الأذان — معطّل بناءً على طلب المستخدم */
  function testAdhan() {
    toast('صوت الأذان معطّل — يُمكنك الاستماع لإذاعة القرآن من قسم الراديو', 'info', 3000);
  }
  global.testAdhan = testAdhan;

  /** تشغيل الأذان — معطّل بناءً على طلب المستخدم، الإشعار النصي فقط */
  function playAdhanSound(adhanId, isFajr) {
    const info = getAdhanInfo(adhanId);
    // إيقاف أي أذان سابق
    stopAdhan();
    // إشعار نصي فقط (بدون صوت)
    toast('🕌 حان وقت الصلاة', 'info', 6000);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('خُلوة — وقت الصلاة', { body: 'حان وقت الصلاة', icon: '/icon.png' });
      } catch (e) {}
    }
  }

  function stopAdhan() {
    if (global.AudioDhikr) global.AudioDhikr.stop();
    if (state.adhanAudio) {
      try { state.adhanAudio.pause(); } catch (e) {}
      state.adhanAudio = null;
    }
    const stopBtn = $('stopAdhanBtn');
    if (stopBtn) stopBtn.style.display = 'none';
  }
  global.stopAdhan = stopAdhan;

  function saveReminderSettings() {
    S.setSettings({ reminders: state.reminders });
    toast('تم حفظ إعدادات التذكير', 'success');
  }

  function openReminderSettings() {
    const r = state.reminders;
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">إعدادات التذكير بالصلاة</h3>
      <div style="margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer">
          <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="KHALWA.toggleReminderEnabled(this.checked)"/>
          <span style="font-weight:600">تفعيل التذكير بالصلاة (إشعار نصي)</span>
        </label>
        <div style="font-size:11px;color:var(--tx3);line-height:1.6;margin-top:4px">ℹ️ التذكير بالإشعارات النصية فقط (بدون صوت). للاستماع للقرآن، افتح قسم إذاعة القرآن الكريم من الراديو.</div>
      </div>
      <div style="margin-bottom:14px">
        <div class="label">⏰ التذكير قبل الصلاة (دقائق)</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[5, 10, 15, 30].map(m => `<label style="display:flex;align-items:center;gap:4px;background:var(--surface2);padding:6px 12px;border-radius:var(--rfull);font-size:13px;cursor:pointer"><input type="checkbox" ${r.beforeMinutes.includes(m) ? 'checked' : ''} onchange="KHALWA.toggleBeforeMinute(${m}, this.checked)"/>${arabicDigits(m)} دقيقة</label>`).join('')}
        </div>
      </div>
      <div style="margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer">
          <input type="checkbox" ${r.adhkarMorning ? 'checked' : ''} onchange="KHALWA.toggleAdhkarMorning(this.checked)"/>
          <span>تذكير بأذكار الصباح</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" ${r.adhkarEvening ? 'checked' : ''} onchange="KHALWA.toggleAdhkarEvening(this.checked)"/>
          <span>تذكير بأذكار المساء</span>
        </label>
      </div>
      <button class="btn btn-primary btn-full" onclick="KHALWA.requestNotificationPermission();closeSheet()">إذن الإشعارات</button>
      <div style="margin-top:14px;padding:12px 14px;background:var(--c-primary-bg);border-radius:var(--r12);font-size:12px;color:var(--tx2);line-height:1.7">
        📻 <strong style="color:var(--c-primary)">للاستماع للقرآن:</strong> انتقل إلى قسم <strong>إذاعة القرآن الكريم</strong> من الواجهة الرئيسية أو المكتبة لاختيار إذاعة مكة أو المدينة أو مصر.
      </div>
    `;
    openSheet(html, 'إعدادات التذكير');
  }
  global.openReminderSettings = openReminderSettings;

  function toggleReminderEnabled(v) { state.reminders.enabled = v; saveReminderSettings(); }
  function setAdhanId(v) { state.reminders.adhanId = v; saveReminderSettings(); }
  function setFajrAdhanId(v) { state.reminders.fajrAdhanId = v; saveReminderSettings(); }
  function toggleBeforeMinute(m, checked) {
    if (checked && !state.reminders.beforeMinutes.includes(m)) state.reminders.beforeMinutes.push(m);
    if (!checked) state.reminders.beforeMinutes = state.reminders.beforeMinutes.filter(x => x !== m);
    saveReminderSettings();
  }
  function toggleAdhkarMorning(v) { state.reminders.adhkarMorning = v; saveReminderSettings(); }
  function toggleAdhkarEvening(v) { state.reminders.adhkarEvening = v; saveReminderSettings(); }
  function togglePrePrayerVoice(v) { state.reminders.prePrayerVoice = v; saveReminderSettings(); }

  // ──────────────────────────────────────────────────────────
  // 14. SHEET / MODAL
  // ──────────────────────────────────────────────────────────
  function openSheet(html, title) {
    const sheet = $('sheetContent');
    const overlay = $('overlayWrap');
    if (!sheet || !overlay) return;
    sheet.innerHTML = html;
    overlay.classList.add('open');
  }
  function closeSheet() {
    const overlay = $('overlayWrap');
    if (overlay) overlay.classList.remove('open');
  }
  global.closeSheet = closeSheet;

  // ──────────────────────────────────────────────────────────
  // 15. INIT
  // ──────────────────────────────────────────────────────────
  function init() {
    // Apply theme & settings
    const s = S.getSettings();
    applyTheme(s.theme);
    state.reciter = A.getReciter(s.reciter) ? s.reciter : A.RECITERS[0].id;
    state.fontScale = s.fontScale || 0;
    state.showTafsir = s.showTafsir !== false;
    // Splash
    setTimeout(() => $('splash')?.classList.add('gone'), 700);
    // Onboarding
    if (!s.onboardingDone) showOnboarding();
    // Render reciters (legacy, won't be visible)
    renderReciterChips();
    // Update reciter UI in picker
    updateReciterUI();
    updateAutoScrollUI();
    // Default surah
    loadSurah(state.surah);
    // Tasbeeh UI
    updateTasbeehUI();
    updateTimerDisplay();
    // Reminders
    initReminders();
    /* ── تهيئة وحدات النظام الروحاني الجديد ── */
    if (global.ContextReminders) {
      try { global.ContextReminders.init(); } catch(_) {}
    }
    // Activate & populate the home page (was never triggered on first load)
    navTo('home');
    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    // First visit stats
    updateStatsStrip();
  }

  // ──────────────────────────────────────────────────────────
  // 16. EXPORT PUBLIC API (for onclick handlers)
  // ──────────────────────────────────────────────────────────
  // ── VERSE / HADITH SHEETS ─────────────────────────────────
  function openVerseTafsir() {
    const v = global._verse;
    if (!v) return;
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">آية اليوم</h3>
      <div class="chip" style="margin-bottom:12px">💡 التفسير</div>
      <div style="font-family:var(--f-q);font-size:22px;line-height:2.2;margin-bottom:12px;color:var(--tx1)">${escapeHtml(v.t)}</div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:12px">${escapeHtml(v.ref)}</div>
      <div style="font-size:15px;line-height:1.9">${escapeHtml(v.tafsir || v.ta || '')}</div>
      ${v.ben ? `<div style="margin-top:14px;background:var(--c-primary-bg);padding:12px;border-radius:var(--r12);font-size:13px;line-height:1.8">💎 ${escapeHtml(v.ben)}</div>` : ''}
      <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="KHALWA.shuffleVerseOfDay();closeSheet()">🔄 آية أخرى</button>
    `;
    openSheet(html, 'آية اليوم');
  }

  function openHadithExpl() {
    const h = global._hadith;
    if (!h) return;
    const html = `
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">شرح الحديث</h3>
      <div class="hadith-text" style="margin-bottom:14px">${escapeHtml(h.text)}</div>
      <div class="hadith-isnad" style="margin-bottom:14px">${escapeHtml(h.isnad)}</div>
      <div class="hadith-badge" style="margin-bottom:10px">📖 الشرح</div>
      <p style="font-size:15px;line-height:2">${escapeHtml(h.expl || '')}</p>
      ${h.ben ? `<div style="margin-top:14px;background:var(--c-primary-bg);padding:12px;border-radius:var(--r12);font-size:13px;line-height:1.8">💎 ${escapeHtml(h.ben)}</div>` : ''}
      <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="KHALWA.shuffleHadithOfDay();closeSheet()">🔄 حديث آخر</button>
    `;
    openSheet(html, 'شرح الحديث');
  }

  global.KHALWA = {
    navTo, toggleTheme, toggleTafsir, changeFontSize,
    pickReciter, openSurahList, pickSurah, openReciterList,
    toggleAyahAudio, playSurah, playFullSurah, toggleBookmark,
    showBookmarks, openBookmark, resumeLastAyah, toggleAutoScroll, stopAudio,
    pickKType, pickKDur, toggleKhalwa,
    tapTasbeeh, nextTasbeeh, resetTasbeeh, playTasbeehAudio,
    switchAdhkarTab, tapAdhkar, playOneAdhkarAudio, playAllAdhkarAudio, stopAdhkarAudio,
    openStory, toggleFiqh, showAsma,
    openFiqhChapter, fiqhBack,
    switchCompanionTab, switchSeerahTab, openFamilyStory,
    openNawawiHadith,
    initQibla, setManualBearing,
    shareAyah, shareAyahWithTafsir, showShareOptions,
    openSearch, closeSearch, handleSearch, openSearchResult,
    editName, saveName, shareApp, showAbout, resetData,
    selectMood,
    openPrayerSettings, searchCity, pickCity, useGeoLocation, savePrayerSettings,
    loadPrayerTimes,
    shuffleVerseOfDay, shuffleHadithOfDay,
    openVerseTafsir, openHadithExpl,
    // Reminders & adhan
    initReminders, openReminderSettings, requestNotificationPermission,
    toggleReminderEnabled, setAdhanId, setFajrAdhanId,
    toggleBeforeMinute, toggleAdhkarMorning, toggleAdhkarEvening,
    togglePrePrayerVoice, testAdhan,
    getAdhanInfo, playAdhanSound, stopAdhan, playPrayerReminder, playPrePrayerReminder,
    // ── utils معروضة للوحدات الجديدة (khatmah / ihsan / dua / focus / context) ──
    toast, openSheet, closeSheet,
    arabicDigits, escapeHtml, todayKey
  };

  // Expose pickCity/pickSurah/etc directly for inline onclick
  global.KHALWA.pickCity = pickCity;
  global.KHALWA.pickSurah = pickSurah;
  global.KHALWA.useGeoLocation = useGeoLocation;
  global.KHALWA.savePrayerSettings = savePrayerSettings;
  global.KHALWA.searchCity = searchCity;
  global.KHALWA.tapAdhkar = tapAdhkar;
  global.KHALWA.openBookmark = openBookmark;
  global.KHALWA.toggleBookmark = toggleBookmark;
  global.KHALWA.toggleAyahAudio = toggleAyahAudio;
  global.KHALWA.toggleFiqh = toggleFiqh;
  global.KHALWA.showAsma = showAsma;
  global.KHALWA.openStory = openStory;
  global.KHALWA.openFamilyStory = openFamilyStory;
  global.KHALWA.toggleAccordion = toggleAccordion;
  global.KHALWA.saveName = saveName;
  global.KHALWA.openSearchResult = openSearchResult;

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for inline onclick for verse/hadith cards (defined in HTML)
  global.openSheet = openSheet;

})(window);
