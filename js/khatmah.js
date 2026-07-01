/* ============================================================
   KHALWA — KHATMAH PLANNER (khatmah.js)
   مخطط الختمة: حاسبة، تسجيل سريع، تعويض الفائت،
   شجرة/دائرة التقدم، النوايا، التقسيم الذكي، التحفيز.
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.Storage;
  const TOTAL_PAGES = 604;      // مصحف المدينة المنورة (الأكثر شيوعاً)
  const TOTAL_JUZ = 30;
  const TOTAL_HIZB = 60;
  const PRAYERS = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];

  /* ─────────── أدوات مساعدة ─────────── */
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
  function dateFromKey(key) {
    const [y, m, d] = key.split('-').map(n => parseInt(n, 10));
    return new Date(y, m - 1, d);
  }
  function daysBetween(a, b) {
    const ms = 1000 * 60 * 60 * 24;
    const da = (a instanceof Date) ? a : new Date(a);
    const db = (b instanceof Date) ? b : new Date(b);
    return Math.floor((db - da) / ms);
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function fmtDate(d) {
    if (!d) return '';
    const date = (d instanceof Date) ? d : new Date(d);
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ─────────── النوايا المقترحة ─────────── */
  const SUGGESTED_NIYYAH = [
    'اللهم اجعل ختمتي خالصة لوجهك الكريم',
    'اللهم تقبل مني واجعلها نوراً لي في الدنيا والآخرة',
    'اللهم اشفِ مريضي بهذه الختمة',
    'اللهم فرّج همي واكشف كربي بها',
    'اللهم ارزقني النجاح في دراستي وعلمي النافع',
    'اللهم ارزقني حفظ كتابك والعمل به',
    'اللهم اجعلها شفاعة لي ولوالديّ يوم القيامة',
    'اللهم اجعلها سبباً لاستجابة دعائي',
    'اللهم اغفر لي ولوالديّ وللمؤمنين بها',
    'اللهم ارزقني بها الزوج الصالح / الذرية الصالحة'
  ];

  /* ─────────── أحاديث التحفيز ─────────── */
  const MOTIVATION_HADITHS = [
    { text: '«من قرأ حرفاً من كتاب الله فله به حسنة، والحسنة بعشر أمثالها»', src: 'رواه الترمذي' },
    { text: '«اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعاً لأصحابه»', src: 'رواه مسلم' },
    { text: '«مثل الذي يقرأ القرآن وهو حافظ له مع السفرة الكرام البررة»', src: 'متفق عليه' },
    { text: '«لا يزال قلب المؤمن رطباً بذكر الله تعالى»', src: 'رواه الطبراني' },
    { text: '«القلوب تصدأ كما يصدأ الحديد، وجلاؤها القرآن»', src: 'رواه البيهقي' },
    { text: '«من قرأ القرآن وعمل بما فيه أُلبس والديه تاجاً يوم القيامة»', src: 'رواه أبو داود' },
    { text: '«إن الله يرفع بهذا الكتاب أقواماً ويضع به آخرين»', src: 'رواه مسلم' },
    { text: '«القرآن دواءٌ لما في الصدور، ونورٌ للقلوب»', src: 'أثر عن السلف' },
    { text: '«عليكم بكتاب الله فإنه حبل الله المتين، ونوره المبين»', src: 'رواه الطبراني' },
    { text: '«من جعل القرآن إمامهُ بلّغه الله به درجات الكرام»', src: 'أثر عن السلف' }
  ];

  /* ─────────── الحاسبة ─────────── */
  /**
   * حساب الختمة حسب الهدف والوضع
   * @param {number} goalDays - عدد الأيام المستهدفة
   * @param {string} mode - 'days' | 'prayers' | 'juz'
   * @returns {object} { pagesPerDay, info, schedule }
   */
  function calculate(goalDays, mode) {
    goalDays = Math.max(1, parseInt(goalDays, 10) || 30);
    const pagesPerDay = Math.ceil(TOTAL_PAGES / goalDays);
    let info = '';
    let schedule = null;

    if (mode === 'days') {
      info = `تحتاج لقراءة ${arabicDigits(pagesPerDay)} صفحة يومياً لإتمام الختمة خلال ${arabicDigits(goalDays)} يوماً`;
      schedule = { type: 'days', pagesPerDay, juzPerDay: +(pagesPerDay / (TOTAL_PAGES / TOTAL_JUZ)).toFixed(2) };
    } else if (mode === 'prayers') {
      const perPrayer = Math.ceil(pagesPerDay / 5);
      const remaining = pagesPerDay - perPrayer * 4;
      info = `اقرأ ${arabicDigits(perPrayer)} صفحات بعد كل صلاة من الفرائض الخمس${remaining > 0 ? ` (وزع ${arabicDigits(remaining)} صفحة زائدة)` : ''} — ${arabicDigits(pagesPerDay)} صفحة يومياً`;
      schedule = {
        type: 'prayers',
        pagesPerDay,
        perPrayer,
        distribution: PRAYERS.map((p, i) => ({ prayer: p, pages: perPrayer + (i === 0 ? remaining : 0) }))
      };
    } else if (mode === 'juz') {
      const juzPerDay = Math.max(1, Math.ceil(TOTAL_JUZ / goalDays));
      const actualPages = Math.ceil(TOTAL_PAGES / TOTAL_JUZ) * juzPerDay;
      const realDays = Math.ceil(TOTAL_PAGES / actualPages);
      info = `اقرأ ${arabicDigits(juzPerDay)} ${juzPerDay === 1 ? 'جزء' : 'أجزاء'} يومياً (≈ ${arabicDigits(actualPages)} صفحة) — ستنهي خلال ${arabicDigits(realDays)} يوماً`;
      schedule = { type: 'juz', pagesPerDay: actualPages, juzPerDay };
    }
    return { pagesPerDay, info, schedule, goalDays };
  }

  /* ─────────── الحالة ─────────── */
  function getKhatmah() {
    const data = S.get('khatmah', S.DEFAULTS.khatmah);
    return data.active;
  }
  function setKhatmah(k) {
    const data = S.get('khatmah', S.DEFAULTS.khatmah);
    data.active = k;
    S.set('khatmah', data);
  }
  function clearKhatmah() {
    const data = S.get('khatmah', S.DEFAULTS.khatmah);
    data.active = null;
    S.set('khatmah', data);
  }
  function pushHistory(khatmah) {
    const data = S.get('khatmah', S.DEFAULTS.khatmah);
    data.history = data.history || [];
    data.history.unshift({
      id: khatmah.id,
      finishedAt: new Date().toISOString(),
      days: daysBetween(khatmah.startDate, new Date()) + 1,
      niyyah: khatmah.niyyah,
      mode: khatmah.mode
    });
    if (data.history.length > 20) data.history.length = 20;
    S.set('khatmah', data);
  }

  /* ─────────── بدء ختمة جديدة ─────────── */
  function startKhatmah(opts) {
    const calc = calculate(opts.goalDays, opts.mode);
    const k = {
      id: 'k_' + Date.now(),
      goalDays: opts.goalDays,
      mode: opts.mode,
      niyyah: (opts.niyyah || '').trim() || 'اللهم اجعلها خالصة لوجهك الكريم',
      startDate: todayKey(),
      pagesPerDay: calc.pagesPerDay,
      totalRead: 0,
      lastReadDate: null,
      missedDays: 0,
      logs: {}, // { 'YYYY-M-D': pagesRead }
      schedule: calc.schedule
    };
    setKhatmah(k);
    return k;
  }

  /* ─────────── تسجيل قراءة ─────────── */
  function addPages(pages) {
    pages = Math.max(0, parseInt(pages, 10) || 0);
    if (!pages) return null;
    const k = getKhatmah();
    if (!k) return null;

    const today = todayKey();
    k.logs = k.logs || {};
    k.logs[today] = (k.logs[today] || 0) + pages;
    k.totalRead = (k.totalRead || 0) + pages;
    if (k.totalRead > TOTAL_PAGES) k.totalRead = TOTAL_PAGES;
    k.lastReadDate = today;

    // اكتشاف الأيام الفائتة (آخر مرة قراءة + 1 يوم إلى أمس)
    if (k._lastLogDate && k._lastLogDate !== today) {
      const lastDate = dateFromKey(k._lastLogDate);
      let gap = daysBetween(lastDate, new Date()) - 1;
      if (gap > 0) k.missedDays = (k.missedDays || 0) + gap;
    }
    k._lastLogDate = today;

    // إكمال الختمة
    if (k.totalRead >= TOTAL_PAGES) {
      pushHistory(k);
      clearKhatmah();
      return { completed: true, khatmah: k };
    }

    setKhatmah(k);
    return { completed: false, khatmah: k };
  }

  /* ─────────── تعويض الفائت ─────────── */
  /**
   * إعادة جدولة الذكاتب المتبقية على الأيام المتبقية
   * بحيث يستطيع المستخدم اللحاق بالهدف الأصلي إن أمكن.
   */
  function rescheduleMissed() {
    const k = getKhatmah();
    if (!k) return null;

    const remainingPages = TOTAL_PAGES - (k.totalRead || 0);
    const today = new Date();
    const start = dateFromKey(k.startDate);
    const elapsedDays = daysBetween(start, today) + 1;
    const remainingDays = Math.max(1, k.goalDays - elapsedDays);

    const newPagesPerDay = Math.ceil(remainingPages / remainingDays);
    k.pagesPerDay = Math.max(k.pagesPerDay, newPagesPerDay);
    // إعادة الجدولة حسب الوضع
    if (k.mode === 'prayers') {
      const perPrayer = Math.ceil(k.pagesPerDay / 5);
      k.schedule.perPrayer = perPrayer;
      k.schedule.distribution = PRAYERS.map((p, i) => ({
        prayer: p,
        pages: perPrayer + (i === 0 ? (k.pagesPerDay - perPrayer * 4) : 0)
      }));
    } else if (k.mode === 'juz') {
      k.schedule.juzPerDay = Math.max(1, Math.ceil(k.schedule.juzPerDay * (newPagesPerDay / k.pagesPerDay)));
    }

    setKhatmah(k);
    return k;
  }

  /* ─────────── إحصائيات ─────────── */
  function getStats() {
    const k = getKhatmah();
    if (!k) return null;
    const today = todayKey();
    const todayPages = (k.logs && k.logs[today]) || 0;
    const remainingPages = TOTAL_PAGES - (k.totalRead || 0);
    const start = dateFromKey(k.startDate);
    const elapsedDays = Math.max(1, daysBetween(start, new Date()) + 1);
    const remainingDays = Math.max(1, k.goalDays - elapsedDays + 1);
    const progress = (k.totalRead / TOTAL_PAGES) * 100;
    const todayProgress = Math.min(100, (todayPages / k.pagesPerDay) * 100);
    const projectedFinish = addDays(start, Math.ceil(remainingPages / Math.max(1, todayPages || k.pagesPerDay)));
    const isOnTrack = (todayPages >= k.pagesPerDay * Math.max(0, elapsedDays - 1));

    return {
      khatmah: k,
      todayPages,
      remainingPages,
      remainingDays,
      elapsedDays,
      progress,
      todayProgress,
      projectedFinish,
      isOnTrack,
      needsReschedule: k.missedDays > 0 && !isOnTrack
    };
  }

  /* ─────────── التحفيز اللطيف ─────────── */
  function getMotivation() {
    const k = getKhatmah();
    if (!k) return null;
    const today = todayKey();
    const lastRead = k.lastReadDate;
    if (!lastRead) return null;
    const gap = daysBetween(dateFromKey(lastRead), new Date());
    if (gap >= 2) {
      const h = MOTIVATION_HADITHS[Math.floor(Math.random() * MOTIVATION_HADITHS.length)];
      return {
        type: 'gentle',
        title: '🌸 عوداً حميداً',
        message: `لم نرك منذ ${arabicDigits(gap)} أيام يا صاحب الخلوة. لا حرج، عُد بقلبٍ نقيّ، فبدايتك الآن خيرٌ من تركك.`,
        hadith: h.text,
        src: h.src
      };
    }
    return null;
  }

  /* ════════════════════════════════════════════
      شجرة الختمة البصرية (SVG)
      تنمو طبيعياً مع التقدم: بذرة → برعم → شجيرة → شجرة → إزهار → ثمار
     ════════════════════════════════════════════ */
  function renderProgressTree(progress) {
    // progress: 0-100
    const p = Math.max(0, Math.min(100, progress));
    let stage = 'seed';
    if (p >= 95) stage = 'fruit';
    else if (p >= 75) stage = 'flower';
    else if (p >= 45) stage = 'tree';
    else if (p >= 20) stage = 'sapling';
    else if (p >= 5) stage = 'sprout';

    const stages = {
      seed: `<g>
        <ellipse cx="100" cy="180" rx="10" ry="6" fill="#8B6F47"/>
        <path d="M100 175 Q98 168 100 162 Q102 168 100 175" fill="#A3885E" stroke="#6B5337" stroke-width="0.5"/>
      </g>`,
      sprout: `<g>
        <ellipse cx="100" cy="180" rx="10" ry="6" fill="#8B6F47"/>
        <path d="M100 178 Q100 160 100 150" stroke="#5E8C3A" stroke-width="2" fill="none"/>
        <ellipse cx="93" cy="155" rx="7" ry="3" fill="#7BAE5A" transform="rotate(-30 93 155)"/>
        <ellipse cx="107" cy="155" rx="7" ry="3" fill="#7BAE5A" transform="rotate(30 107 155)"/>
      </g>`,
      sapling: `<g>
        <ellipse cx="100" cy="180" rx="12" ry="6" fill="#8B6F47"/>
        <path d="M100 178 Q98 140 100 110" stroke="#6B4423" stroke-width="3" fill="none"/>
        <ellipse cx="88" cy="125" rx="9" ry="4" fill="#7BAE5A" transform="rotate(-35 88 125)"/>
        <ellipse cx="112" cy="125" rx="9" ry="4" fill="#7BAE5A" transform="rotate(35 112 125)"/>
        <ellipse cx="90" cy="105" rx="10" ry="5" fill="#6FA84D" transform="rotate(-20 90 105)"/>
        <ellipse cx="110" cy="105" rx="10" ry="5" fill="#6FA84D" transform="rotate(20 110 105)"/>
        <ellipse cx="100" cy="92" rx="9" ry="5" fill="#82BD5F"/>
      </g>`,
      tree: `<g>
        <ellipse cx="100" cy="185" rx="20" ry="6" fill="#8B6F47"/>
        <path d="M100 185 Q97 130 100 80" stroke="#6B4423" stroke-width="6" fill="none"/>
        <path d="M100 120 Q80 110 70 95" stroke="#6B4423" stroke-width="3" fill="none"/>
        <path d="M100 120 Q120 110 130 95" stroke="#6B4423" stroke-width="3" fill="none"/>
        <path d="M100 95 Q85 85 80 75" stroke="#6B4423" stroke-width="2.5" fill="none"/>
        <path d="M100 95 Q115 85 120 75" stroke="#6B4423" stroke-width="2.5" fill="none"/>
        <ellipse cx="70" cy="88" rx="16" ry="14" fill="#6FA84D"/>
        <ellipse cx="130" cy="88" rx="16" ry="14" fill="#6FA84D"/>
        <ellipse cx="80" cy="70" rx="18" ry="16" fill="#7BAE5A"/>
        <ellipse cx="120" cy="70" rx="18" ry="16" fill="#7BAE5A"/>
        <ellipse cx="100" cy="60" rx="22" ry="20" fill="#82BD5F"/>
        <ellipse cx="100" cy="50" rx="14" ry="12" fill="#8FCB68"/>
      </g>`,
      flower: `<g>
        <ellipse cx="100" cy="185" rx="22" ry="7" fill="#8B6F47"/>
        <path d="M100 185 Q97 130 100 75" stroke="#6B4423" stroke-width="7" fill="none"/>
        <path d="M100 120 Q80 110 65 90" stroke="#6B4423" stroke-width="3.5" fill="none"/>
        <path d="M100 120 Q120 110 135 90" stroke="#6B4423" stroke-width="3.5" fill="none"/>
        <path d="M100 95 Q85 85 75 70" stroke="#6B4423" stroke-width="3" fill="none"/>
        <path d="M100 95 Q115 85 125 70" stroke="#6B4423" stroke-width="3" fill="none"/>
        <ellipse cx="65" cy="82" rx="20" ry="17" fill="#6FA84D"/>
        <ellipse cx="135" cy="82" rx="20" ry="17" fill="#6FA84D"/>
        <ellipse cx="75" cy="62" rx="22" ry="19" fill="#7BAE5A"/>
        <ellipse cx="125" cy="62" rx="22" ry="19" fill="#7BAE5A"/>
        <ellipse cx="100" cy="52" rx="26" ry="23" fill="#82BD5F"/>
        <ellipse cx="100" cy="42" rx="16" ry="14" fill="#8FCB68"/>
        <!-- أزهار -->
        <g fill="#F8B5C5" stroke="#E68BA3" stroke-width="0.4">
          <circle cx="75" cy="80" r="3.5"/><circle cx="135" cy="80" r="3.5"/>
          <circle cx="78" cy="62" r="3"/><circle cx="122" cy="62" r="3"/>
          <circle cx="85" cy="50" r="3.5"/><circle cx="115" cy="50" r="3.5"/>
          <circle cx="100" cy="38" r="4"/>
        </g>
        <g fill="#FFE08A">
          <circle cx="75" cy="80" r="1.2"/><circle cx="135" cy="80" r="1.2"/>
          <circle cx="78" cy="62" r="1"/><circle cx="122" cy="62" r="1"/>
          <circle cx="85" cy="50" r="1.2"/><circle cx="115" cy="50" r="1.2"/>
          <circle cx="100" cy="38" r="1.5"/>
        </g>
      </g>`,
      fruit: `<g>
        <ellipse cx="100" cy="185" rx="24" ry="8" fill="#8B6F47"/>
        <path d="M100 185 Q97 130 100 70" stroke="#6B4423" stroke-width="7" fill="none"/>
        <path d="M100 120 Q80 110 60 85" stroke="#6B4423" stroke-width="4" fill="none"/>
        <path d="M100 120 Q120 110 140 85" stroke="#6B4423" stroke-width="4" fill="none"/>
        <path d="M100 90 Q82 80 70 65" stroke="#6B4423" stroke-width="3" fill="none"/>
        <path d="M100 90 Q118 80 130 65" stroke="#6B4423" stroke-width="3" fill="none"/>
        <ellipse cx="60" cy="78" rx="22" ry="19" fill="#6FA84D"/>
        <ellipse cx="140" cy="78" rx="22" ry="19" fill="#6FA84D"/>
        <ellipse cx="72" cy="55" rx="24" ry="21" fill="#7BAE5A"/>
        <ellipse cx="128" cy="55" rx="24" ry="21" fill="#7BAE5A"/>
        <ellipse cx="100" cy="45" rx="28" ry="25" fill="#82BD5F"/>
        <ellipse cx="100" cy="35" rx="18" ry="15" fill="#8FCB68"/>
        <!-- ثمار -->
        <g>
          <circle cx="70" cy="78" r="4" fill="#D44545"/><circle cx="75" cy="85" r="3.5" fill="#E85555"/>
          <circle cx="140" cy="80" r="4" fill="#D44545"/><circle cx="135" cy="86" r="3.5" fill="#E85555"/>
          <circle cx="78" cy="60" r="4" fill="#E89030"/><circle cx="86" cy="68" r="3.5" fill="#F0A040"/>
          <circle cx="122" cy="60" r="4" fill="#E89030"/><circle cx="114" cy="68" r="3.5" fill="#F0A040"/>
          <circle cx="92" cy="42" r="4.5" fill="#D44545"/><circle cx="108" cy="42" r="4.5" fill="#E85555"/>
          <circle cx="100" cy="30" r="5" fill="#E89030"/>
        </g>
        <!-- هالة ذهبية -->
        <circle cx="100" cy="50" r="55" fill="none" stroke="#FBEACB" stroke-width="0.8" opacity="0.6"/>
      </g>`
    };

    const stageLabels = {
      seed: 'بذرة في الأرض',
      sprout: 'برعم صغير',
      sapling: 'شجيرة يافعة',
      tree: 'شجرة نامية',
      flower: 'شجرة مزهرة',
      fruit: 'شجرة مثمرة'
    };

    return {
      svg: `<svg viewBox="0 0 200 210" class="khatmah-tree-svg" preserveAspectRatio="xMidYEnd meet">
        <defs>
          <linearGradient id="sky-${stage}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#E8F4ED"/><stop offset="1" stop-color="#F4FCF7"/>
          </linearGradient>
          <radialGradient id="sun-${stage}" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#FBEACB" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="200" height="210" fill="url(#sky-${stage})" rx="14"/>
        <circle cx="170" cy="35" r="22" fill="url(#sun-${stage})"/>
        <circle cx="170" cy="35" r="9" fill="#FFD968"/>
        <!-- الأرض -->
        <ellipse cx="100" cy="190" rx="100" ry="22" fill="#C8A878"/>
        <ellipse cx="100" cy="188" rx="100" ry="18" fill="#D9B988"/>
        ${stages[stage]}
      </svg>`,
      stage,
      stageLabel: stageLabels[stage]
    };
  }

  /* ─────────── دائرة التقدم ─────────── */
  function renderProgressRing(progress, label) {
    const p = Math.max(0, Math.min(100, progress));
    const offset = 565 - (565 * p / 100);
    return `<svg viewBox="0 0 200 200" class="khatmah-ring-svg">
      <circle cx="100" cy="100" r="90" fill="none" stroke="var(--c-border2)" stroke-width="10" opacity="0.3"/>
      <circle cx="100" cy="100" r="90" fill="none" stroke="url(#khatmahGrad)" stroke-width="10"
        stroke-linecap="round" stroke-dasharray="565" stroke-dashoffset="${offset}"
        transform="rotate(-90 100 100)" style="transition:stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)"/>
      <defs>
        <linearGradient id="khatmahGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--c-p500)"/><stop offset="1" stop-color="var(--c-a500)"/>
        </linearGradient>
      </defs>
      <text x="100" y="95" text-anchor="middle" font-size="34" font-weight="800" fill="var(--tx1)">${arabicDigits(Math.round(p))}%</text>
      <text x="100" y="120" text-anchor="middle" font-size="11" fill="var(--tx3)">${escapeHtml(label || '')}</text>
    </svg>`;
  }

  /* ════════════════════════════════════════════
      RENDER — الصفحة الكاملة
     ════════════════════════════════════════════ */
  function render() {
    const k = getKhatmah();
    const wrap = $('khatmahWrap');
    if (!wrap) return;

    if (!k) {
      wrap.innerHTML = renderSetup();
      bindSetupEvents();
      return;
    }

    const stats = getStats();
    const treeView = renderProgressTree(stats.progress);
    wrap.innerHTML = `
      <div class="khatmah-active">
        <!-- النية -->
        <div class="khatmah-niyyah-card">
          <div class="khatmah-niyyah-label">🎯 نيّتك في هذه الختمة</div>
          <div class="khatmah-niyyah-text">«${escapeHtml(k.niyyah)}»</div>
          <div class="khatmah-niyyah-since">بدأت في ${fmtDate(k.startDate)}</div>
        </div>

        <!-- البطاقة الكبرى: الشجرة + الدائرة -->
        <div class="khatmah-visual-card">
          <div class="khatmah-tree-side">
            ${treeView.svg}
            <div class="khatmah-stage-label">${treeView.stageLabel}</div>
          </div>
          <div class="khatmah-ring-side">
            <div class="khatmah-ring-wrap">${renderProgressRing(stats.progress, 'من القرآن')}</div>
            <div class="khatmah-quick-stats">
              <div class="kqs"><div class="kqs-v">${arabicDigits(stats.todayPages)}</div><div class="kqs-l">صفحة اليوم</div></div>
              <div class="kqs"><div class="kqs-v">${arabicDigits(k.pagesPerDay)}</div><div class="kqs-l">الهدف اليومي</div></div>
              <div class="kqs"><div class="kqs-v">${arabicDigits(stats.remainingPages)}</div><div class="kqs-l">المتبقي</div></div>
              <div class="kqs"><div class="kqs-v">${arabicDigits(stats.remainingDays)}</div><div class="kqs-l">يوم متبقٍ</div></div>
            </div>
          </div>
        </div>

        <!-- شريط اليوم -->
        <div class="khatmah-today-card">
          <div class="khatmah-today-hd">
            <span>📖 ورد اليوم</span>
            <span class="khatmah-today-frac">${arabicDigits(stats.todayPages)} / ${arabicDigits(k.pagesPerDay)} صفحة</span>
          </div>
          <div class="khatmah-today-bar">
            <div class="khatmah-today-fill" style="width:${Math.min(100, stats.todayProgress)}%"></div>
          </div>
          ${stats.todayProgress >= 100 ? '<div class="khatmah-today-done">🌿 أكملت وردك اليوم، بارك الله فيك</div>' : ''}
        </div>

        <!-- التسجيل السريع -->
        <div class="khatmah-quickadd-card">
          <div class="khatmah-qa-title">➕ تسجيل سريع</div>
          <div class="khatmah-qa-grid">
            <button class="khatmah-qa-btn khatmah-qa-main" onclick="Khatmah.quickAdd(${Math.ceil(k.pagesPerDay / 5)})">
              <span class="khatmah-qa-num">+${arabicDigits(Math.ceil(k.pagesPerDay / 5))}</span>
              <span class="khatmah-qa-lbl">صفحة</span>
            </button>
            <button class="khatmah-qa-btn" onclick="Khatmah.quickAdd(1)"><span class="khatmah-qa-num">+١</span><span class="khatmah-qa-lbl">صفحة</span></button>
            <button class="khatmah-qa-btn" onclick="Khatmah.quickAdd(5)"><span class="khatmah-qa-num">+٥</span><span class="khatmah-qa-lbl">صفحات</span></button>
            <button class="khatmah-qa-btn" onclick="Khatmah.quickAdd(10)"><span class="khatmah-qa-num">+١٠</span><span class="khatmah-qa-lbl">صفحات</span></button>
            <button class="khatmah-qa-btn khatmah-qa-done" onclick="Khatmah.quickAdd(${k.pagesPerDay})">
              <span class="khatmah-qa-num">✓</span><span class="khatmah-qa-lbl">أتممت وردي</span>
            </button>
            <button class="khatmah-qa-btn khatmah-qa-juz" onclick="Khatmah.addJuz()">
              <span class="khatmah-qa-num">📖</span><span class="khatmah-qa-lbl">+١ جزء</span>
            </button>
          </div>
          <div class="khatmah-qa-custom">
            <input type="number" id="khatmahCustomPages" placeholder="عدد صفحات مخصص" min="1" max="604"/>
            <button class="btn btn-primary btn-sm" onclick="Khatmah.customAdd()">سجّل</button>
          </div>
        </div>

        ${stats.needsReschedule ? `
          <div class="khatmah-reschedule-card">
            <div class="khatmah-rs-icon">🌱</div>
            <div class="khatmah-rs-body">
              <div class="khatmah-rs-title">فاتك ${arabicDays(k.missedDays)} — لا بأس</div>
              <div class="khatmah-rs-desc">يمكننا إعادة توزيع الصفحات المتبقية على الأيام المتبقية حتى تُتم ختمتك في وقتها.</div>
            </div>
            <button class="btn btn-sec btn-sm" onclick="Khatmah.reschedule()">إعادة الجدولة</button>
          </div>` : ''}

        <!-- التقسيم الذكي -->
        <div class="khatmah-schedule-card">
          <div class="khatmah-sc-title">🗓️ التقسيم الذكي — ${modeLabel(k.mode)}</div>
          ${renderSchedule(k)}
        </div>

        <!-- توقعات -->
        <div class="khatmah-project-card ${stats.isOnTrack ? 'on-track' : 'behind'}">
          <div class="khatmah-pj-icon">${stats.isOnTrack ? '✨' : '⏳'}</div>
          <div class="khatmah-pj-body">
            <div class="khatmah-pj-title">${stats.isOnTrack ? 'ما شاء الله، أنت على المسار الصحيح' : 'تحتاج للّحاق بالهدف'}</div>
            <div class="khatmah-pj-desc">مُقدّر الانتهاء: ${fmtDate(stats.projectedFinish)}</div>
          </div>
        </div>

        <!-- التحفيز -->
        ${renderMotivation()}

        <!-- إجراءات -->
        <div class="khatmah-actions">
          <button class="btn btn-ghost btn-sm" onclick="Khatmah.confirmStop()">إيقاف الختمة</button>
          <button class="btn btn-ghost btn-sm" onclick="Khatmah.showHistory()">📜 سجل الختمات</button>
        </div>
      </div>
    `;
  }

  function arabicDays(n) {
    n = parseInt(n, 10) || 0;
    if (n === 1) return 'يوم';
    if (n === 2) return 'يومان';
    if (n <= 10) return `${arabicDigits(n)} أيام`;
    return `${arabicDigits(n)} يوماً`;
  }

  function modeLabel(mode) {
    return { days: 'ختمة بالشهور/الأيام', prayers: 'ختمة بالصلوات', juz: 'ختمة بالأجزاء' }[mode] || 'حسب الأيام';
  }

  function renderSchedule(k) {
    if (k.mode === 'prayers' && k.schedule && k.schedule.distribution) {
      return `<div class="khatmah-prayers-grid">
        ${k.schedule.distribution.map(d => `
          <div class="khatmah-prayer-row">
            <span class="khatmah-prayer-name">${d.prayer}</span>
            <span class="khatmah-prayer-pages">${arabicDigits(d.pages)} صفحة بعد الصلاة</span>
          </div>`).join('')}
      </div>`;
    } else if (k.mode === 'juz') {
      return `<div class="khatmah-juz-info">
        اقرأ ${arabicDigits(k.schedule.juzPerDay)} ${k.schedule.juzPerDay === 1 ? 'جزء' : 'أجزاء'} يومياً — ما يعادل ${arabicDigits(k.pagesPerDay)} صفحة.
        <div class="khatmah-juz-tip">💡 ابدأ من الجزء ${arabicDigits(Math.floor((k.totalRead || 0) / 20) + 1)} لتتابع تسلسل الأجزاء</div>
      </div>`;
    }
    return `<div class="khatmah-days-info">
      اقرأ ${arabicDigits(k.pagesPerDay)} صفحة يومياً، ولو وزّعتها على النهار: <strong>صفحتان بعد كل صلاة</strong> تكفيك.
      <div class="khatmah-days-tip">💡 نصيحة: اجعل لك وقتاً ثابتاً للقراءة (مثلاً بعد الفجر) حتى يصبح عادة راسخة.</div>
    </div>`;
  }

  function renderMotivation() {
    const m = getMotivation();
    if (!m) return '';
    return `<div class="khatmah-motivation-card">
      <div class="khatmah-mt-icon">🌸</div>
      <div class="khatmah-mt-title">${escapeHtml(m.title)}</div>
      <div class="khatmah-mt-msg">${escapeHtml(m.message)}</div>
      <div class="khatmah-mt-hadith">${escapeHtml(m.hadith)}</div>
      <div class="khatmah-mt-src">${escapeHtml(m.src)}</div>
    </div>`;
  }

  /* ════════════════════════════════════════════
      SETUP — صفحة بدء ختمة جديدة
     ════════════════════════════════════════════ */
  function renderSetup() {
    return `
      <div class="khatmah-setup">
        <div class="khatmah-setup-hero">
          <div class="khatmah-setup-emoji">🌳</div>
          <h2 class="khatmah-setup-h">ابدأ ختمتك المباركة</h2>
          <p class="khatmah-setup-p">حدد هدفك، اكتب نيّتك، ودع الشجرة تنمو مع كل صفحة تقرؤها. سيُعينك التطبيق بلطف على إتمامها.</p>
        </div>

        <div class="khatmah-form-card">
          <label class="khatmah-field-lbl">📅 كم يوماً تريد الختمة فيه؟</label>
          <div class="khatmah-quick-goals">
            <button class="khatmah-goal-btn" data-days="30">شهر</button>
            <button class="khatmah-goal-btn on" data-days="60">شهران</button>
            <button class="khatmah-goal-btn" data-days="90">٣ أشهر</button>
            <button class="khatmah-goal-btn" data-days="180">٦ أشهر</button>
            <button class="khatmah-goal-btn" data-days="365">سنة</button>
          </div>
          <div class="khatmah-custom-days">
            <input type="number" id="khatmahGoalDays" placeholder="أو أدخل عدد أيام مخصص" min="1" max="3650" value="60"/>
          </div>

          <label class="khatmah-field-lbl">🧠 كيف تريد تقسيم الختمة؟</label>
          <div class="khatmah-modes">
            <button class="khatmah-mode on" data-mode="days">
              <span class="khatmah-mode-icon">📅</span>
              <span class="khatmah-mode-name">حسب الأيام</span>
              <span class="khatmah-mode-desc">صفحات يومياً ثابتة</span>
            </button>
            <button class="khatmah-mode" data-mode="prayers">
              <span class="khatmah-mode-icon">🕌</span>
              <span class="khatmah-mode-name">حسب الصلوات</span>
              <span class="khatmah-mode-desc">صفحات بعد كل صلاة</span>
            </button>
            <button class="khatmah-mode" data-mode="juz">
              <span class="khatmah-mode-icon">📖</span>
              <span class="khatmah-mode-name">حسب الأجزاء</span>
              <span class="khatmah-mode-desc">جزء أو أكثر يومياً</span>
            </button>
          </div>

          <div class="khatmah-calc-preview" id="khatmahCalcPreview"></div>

          <label class="khatmah-field-lbl">🤲 نيّتك في هذه الختمة</label>
          <div class="khatmah-niyyah-suggest">
            ${SUGGESTED_NIYYAH.slice(0, 5).map(n => `
              <button class="khatmah-niyyah-chip" onclick="Khatmah.useSuggestedNiyyah(this)" data-text="${escapeHtml(n)}">${escapeHtml(n)}</button>
            `).join('')}
          </div>
          <textarea id="khatmahNiyyah" class="khatmah-niyyah-input" placeholder="اكتب نيّتك ودعاءك لهذه الختمة..." rows="3"></textarea>

          <button class="btn btn-primary btn-full khatmah-start-btn" onclick="Khatmah.confirmStart()">
            <span>🌿 ابدأ الختمة</span>
          </button>
        </div>
      </div>
    `;
  }

  function bindSetupEvents() {
    // أزرار الأهداف السريعة
    document.querySelectorAll('.khatmah-goal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.khatmah-goal-btn').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        $('khatmahGoalDays').value = btn.dataset.days;
        updateCalcPreview();
      });
    });
    // أزرار الأوضاع
    document.querySelectorAll('.khatmah-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.khatmah-mode').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        updateCalcPreview();
      });
    });
    $('khatmahGoalDays').addEventListener('input', updateCalcPreview);
    updateCalcPreview();
  }

  function updateCalcPreview() {
    const days = parseInt($('khatmahGoalDays').value, 10) || 30;
    const mode = document.querySelector('.khatmah-mode.on')?.dataset.mode || 'days';
    const calc = calculate(days, mode);
    const el = $('khatmahCalcPreview');
    if (el) {
      el.innerHTML = `<div class="khatmah-calc-box">
        <span class="khatmah-calc-icon">✨</span>
        <div class="khatmah-calc-text">${escapeHtml(calc.info)}</div>
      </div>`;
    }
  }

  function useSuggestedNiyyah(btn) {
    const ta = $('khatmahNiyyah');
    if (ta) ta.value = btn.dataset.text;
    document.querySelectorAll('.khatmah-niyyah-chip').forEach(c => c.classList.remove('on'));
    btn.classList.add('on');
  }

  function confirmStart() {
    const days = parseInt($('khatmahGoalDays').value, 10) || 60;
    const mode = document.querySelector('.khatmah-mode.on')?.dataset.mode || 'days';
    const niyyah = $('khatmahNiyyah').value.trim() || 'اللهم اجعلها خالصة لوجهك الكريم';
    startKhatmah({ goalDays: days, mode, niyyah });
    if (global.KHALWA?.toast) global.KHALWA.toast('بدأت ختمتك المباركة، بارك الله فيك 🌱', 'success', 3000);
    render();
    updateHomeWidget();
  }

  function quickAdd(pages) {
    const r = addPages(pages);
    if (!r) return;
    if (r.completed) {
      if (global.KHALWA?.toast) global.KHALWA.toast('🎉 ختمتَ القرآن! تقبل الله منك وجعله نوراً لك', 'success', 5000);
    } else {
      if (global.KHALWA?.toast) global.KHALWA.toast(`سُجّلت ${arabicDigits(pages)} صفحة`, 'success');
    }
    render();
    updateHomeWidget();
  }

  function customAdd() {
    const inp = $('khatmahCustomPages');
    if (!inp) return;
    const n = parseInt(inp.value, 10);
    if (!n || n < 1) {
      if (global.KHALWA?.toast) global.KHALWA.toast('أدخل عدداً صحيحاً', 'warning');
      return;
    }
    quickAdd(n);
    inp.value = '';
  }

  function addJuz() {
    quickAdd(Math.ceil(TOTAL_PAGES / TOTAL_JUZ)); // 21 صفحة تقريباً
  }

  function reschedule() {
    const k = rescheduleMissed();
    if (k) {
      if (global.KHALWA?.toast) global.KHALWA.toast('تمت إعادة جدولة ختمتك، استعن بالله 🌿', 'success', 3000);
      render();
      updateHomeWidget();
    }
  }

  function confirmStop() {
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">إيقاف الختمة</h3>
      <p style="font-size:14px;line-height:1.9;color:var(--tx2);margin-bottom:18px">
        سيتم إيقاف ختمتك الحالية. يمكنك بدء واحدة جديدة في أي وقت. تذكّر أن ما قرأتَه محفوظ عند الله وإن لم تُتمّه.
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" onclick="closeSheet()">إلغاء</button>
        <button class="btn btn-primary btn-full" onclick="Khatmah.stop()">نعم، أوقفها</button>
      </div>`;
    if (global.openSheet) global.openSheet(html);
  }

  function stop() {
    clearKhatmah();
    if (global.closeSheet) global.closeSheet();
    if (global.KHALWA?.toast) global.KHALWA.toast('تم إيقاف الختمة. والله يعينك على ما هو خير', 'info');
    render();
    updateHomeWidget();
  }

  function showHistory() {
    const data = S.get('khatmah', S.DEFAULTS.khatmah);
    const hist = data.history || [];
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">📜 سجل الختمات المكتملة</h3>
      ${hist.length === 0 ? `<div class="empty"><div class="empty-icon">🌱</div><div class="empty-title">لا توجد ختمات مكتملة بعد</div><div class="empty-text">أتمم ختمتك الأولى لتظهر هنا</div></div>` :
        hist.map(h => `
          <div class="khatmah-history-row">
            <div class="khatmah-history-icon">🌳</div>
            <div class="khatmah-history-body">
              <div class="khatmah-history-title">ختمة في ${arabicDigits(h.days)} يوماً</div>
              <div class="khatmah-history-niyyah">«${escapeHtml(h.niyyah)}»</div>
              <div class="khatmah-history-date">${fmtDate(h.finishedAt)}</div>
            </div>
          </div>`).join('')}
      <button class="btn btn-ghost btn-full" style="margin-top:14px" onclick="closeSheet()">إغلاق</button>`;
    if (global.openSheet) global.openSheet(html);
  }

  /* ════════════════════════════════════════════
      HOME WIDGET — بطاقة سريعة للرئيسية
     ════════════════════════════════════════════ */
  function updateHomeWidget() {
    const wrap = $('homeKhatmahWidget');
    if (!wrap) return;
    const k = getKhatmah();
    if (!k) {
      wrap.innerHTML = `<button class="khatmah-home-empty" onclick="navTo('khatmah')">
        <div class="khatmah-home-empty-icon">🌱</div>
        <div class="khatmah-home-empty-body">
          <div class="khatmah-home-empty-title">ابدأ ختمتك المباركة</div>
          <div class="khatmah-home-empty-desc">حدد هدفاً، اكتب نيّتك، ودع الشجرة تنمو معك</div>
        </div>
        <span class="khatmah-home-empty-arrow">‹</span>
      </button>`;
      return;
    }
    const stats = getStats();
    const treeView = renderProgressTree(stats.progress);
    wrap.innerHTML = `
      <div class="khatmah-home-card" onclick="navTo('khatmah')">
        <div class="khatmah-home-tree">${treeView.svg}</div>
        <div class="khatmah-home-body">
          <div class="khatmah-home-stage">${treeView.stageLabel}</div>
          <div class="khatmah-home-progress">
            <div class="khatmah-home-bar"><div class="khatmah-home-fill" style="width:${stats.progress}%"></div></div>
            <div class="khatmah-home-frac">${arabicDigits(Math.round(stats.progress))}% — ${arabicDigits(stats.remainingDays)} يوم متبقٍ</div>
          </div>
          <div class="khatmah-home-today">
            <span>اليوم: ${arabicDigits(stats.todayPages)} / ${arabicDigits(k.pagesPerDay)} صفحة</span>
            ${stats.todayProgress < 100 ? `<button class="khatmah-home-quickadd" onclick="event.stopPropagation();Khatmah.quickAdd(${Math.ceil(k.pagesPerDay / 5)})">+${arabicDigits(Math.ceil(k.pagesPerDay / 5))} صفحة</button>` : '<span class="khatmah-home-done">✓ أتممت اليوم</span>'}
          </div>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      PUBLIC API
     ════════════════════════════════════════════ */
  global.Khatmah = {
    init: render,
    render,
    calculate,
    startKhatmah,
    addPages,
    quickAdd,
    customAdd,
    addJuz,
    reschedule,
    confirmStart,
    confirmStop,
    stop,
    showHistory,
    useSuggestedNiyyah,
    updateHomeWidget,
    getKhatmah,
    getStats,
    getMotivation,
    TOTAL_PAGES,
    TOTAL_JUZ
  };

})(window);
