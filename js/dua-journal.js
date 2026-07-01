/* ============================================================
   KHALWA — DUA JOURNAL (dua-journal.js) v2.0
   دفتر الأدعية الكامل: حالات روحانية متعددة بدلاً من "تمت الإجابة"،
   تصنيفات موسّعة، أدعية مقترحة حسب الوقت والحال، تتبع رحلة كل دعاء.
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
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function daysSince(iso) {
    if (!iso) return 0;
    const d = new Date(iso);
    const today = new Date();
    return Math.max(0, Math.floor((today - d) / (1000 * 60 * 60 * 24)));
  }
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /* ─────────── التصنيفات ─────────── */
  const CATEGORIES = [
    { id: 'health',     name: 'شفاء/صحة',     icon: '🌿', color: '#1E9763' },
    { id: 'rizq',       name: 'رزق',          icon: '💚', color: '#C7902E' },
    { id: 'family',     name: 'أهل/ذرية',     icon: '👨‍👩‍👧', color: '#E68BA3' },
    { id: 'success',    name: 'نجاح/علم',     icon: '🎓', color: '#2E76A6' },
    { id: 'marriage',   name: 'زواج',         icon: '💍', color: '#D44545' },
    { id: 'protection', name: 'حفظ/أمان',     icon: '🛡️', color: '#5C6F63' },
    { id: 'forgiveness',name: 'مغفرة/توبة',   icon: '🤲', color: '#7A4E12' },
    { id: 'hajj',       name: 'حج/عمرة',      icon: '🕋', color: '#155A3D' },
    { id: 'debt',       name: 'دين/كرب',      icon: '🔓', color: '#C2880F' },
    { id: 'guidance',   name: 'هداية',        icon: '🌙', color: '#7A4E12' },
    { id: 'patience',   name: 'صبر/بلاء',     icon: '🌱', color: '#6FA84D' },
    { id: 'general',    name: 'عام',          icon: '✨', color: '#94A398' }
  ];
  function getCategory(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  /* ════════════════════════════════════════════
      الحالات الروحانية (بدلاً من "تمت الإجابة")
      كل حالة لها فلسفة وأثر قلبي خاص
     ════════════════════════════════════════════ */
  const SPIRITUAL_STATES = {
    pending: {
      id: 'pending',
      name: 'في انتظار القرب',
      short: 'منتظر',
      icon: '🤲',
      color: '#155A3D',
      bg: 'rgba(21,90,61,.08)',
      desc: 'الدعاء ما زال بين يدي الله، وأنت تنتظر الفرج بيقين',
      verse: '﴿وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ﴾',
      points: 0
    },
    peace: {
      id: 'peace',
      name: 'سَكَنَ القلب',
      short: 'سكينة',
      icon: '🌿',
      color: '#1E9763',
      bg: 'rgba(30,151,99,.12)',
      desc: 'أنزل الله السكينة في قلبك بمجرد الدعاء، فما عاد يهمك متى تتحقق، فأنت قد رضيت',
      verse: '﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾',
      points: 5
    },
    trust: {
      id: 'trust',
      name: 'توكلتُ وسلّمتُ',
      short: 'تسليم',
      icon: '🤍',
      color: '#5C6F63',
      bg: 'rgba(92,111,99,.12)',
      desc: 'بذلتَ سببك وتركْتَ النتيجة لله، ورضيتَ بما يختاره لك ربك',
      verse: '﴿وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ﴾',
      points: 7
    },
    gratitude: {
      id: 'gratitude',
      name: 'حمدتُ الله عليها',
      short: 'حمد',
      icon: '🌟',
      color: '#C7902E',
      bg: 'rgba(199,144,46,.12)',
      desc: 'سواء تحقّقت أو لم تتحقق، أنت تحمد الله في كل حال، فالحمد غاية العبادة',
      verse: '﴿إِنَّ اللَّهَ يُحِبُّ الْحَامِدِينَ﴾',
      points: 6
    },
    charity: {
      id: 'charity',
      name: 'جعلتُها صدقة جارية',
      short: 'صدقة',
      icon: '💚',
      color: '#D44545',
      bg: 'rgba(212,69,69,.10)',
      desc: 'حوّلتَ دعاءك الشخصي إلى نفعٍ عام: تصدقتَ بنية هذا الدعاء، أو شاركتَه مجهولاً ليدعو به غيرك',
      verse: '«ما نقصت صدقة من مال» — رواه مسلم',
      points: 10
    },
    answered: {
      id: 'answered',
      name: 'استُجيبت بحمد الله',
      short: 'استجابة',
      icon: '✨',
      color: '#7A4E12',
      bg: 'rgba(122,78,18,.12)',
      desc: 'رأيتَ تحقّق الدعاء بعينك، فاحمد الله ولا تنسَ فضله',
      verse: '﴿وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ﴾',
      points: 8
    }
  };

  function getState(id) {
    return SPIRITUAL_STATES[id] || SPIRITUAL_STATES.pending;
  }

  /* ─────────── أدعية مقترحة للإلهام (مصنّفة حسب الحال) ─────────── */
  const INSPIRATION_DUAS = {
    morning: [
      'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور',
      'اللهم إني أسألك علماً نافعاً، ورزقاً طيباً، وعملاً متقبّلاً',
      'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري'
    ],
    evening: [
      'اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير',
      'اللهم إني أعوذ بك من همٍّ يحني ظهري، ومن حزنٍ يقطع قلبي',
      'اللهم اجعل لنا في كل خطوة خيراً، وفي كل ليلة مغفرة'
    ],
    health: [
      'اللهم اشفِ مرضانا ومرضى المسلمين، شفاءً لا يغادر سقماً',
      'اللهم ربَّ الناس، أذهب البأس، واشفِ أنت الشافي، لا شفاء إلا شفاؤك',
      'اللهم اجعل ما أصابني طهوراً، وارزقني الصبر والاحتساب'
    ],
    rizq: [
      'اللهم اكفني بحلالك عن حرامك، وأغنني بفضلك عمَّن سواك',
      'اللهم إني أسألك رزقاً واسعاً طيباً من فضلك',
      'اللهم ارزقني وأهلي ومَن يعولني، ولا تحوجنا لأحدٍ من خلقك'
    ],
    family: [
      'اللهم أصلح لي ذريتي، واجعلهم قرة عين لي',
      'اللهم بارك لي في أهلي ومالي، واجمعني بهم في الجنة',
      'اللهم اجعل بيتي عامراً بذكرك، واملأه برحمتك'
    ],
    guidance: [
      'اللهم أرني الحق حقاً وارزقني اتباعه، وأرني الباطل باطلاً وارزقني اجتنابه',
      'اللهم اهدنا الصراط المستقيم، وثبتنا عليه',
      'اللهم اقسم لنا من خشيتك ما تحول به بيننا وبين معصيتك'
    ],
    patience: [
      'اللهم ارزقني الصبر الجميل، والاحتساب في البلاء',
      'اللهم إني أسألك فرجاً قريباً، وصبراً جميلاً، وعاقبةً حميدة',
      'اللهم اجعل بلائي طهوراً، وأجري فيه مضاعفاً'
    ],
    general: [
      'اللهم إني أسألك من الخير كله عاجله وآجله، ما علمت منه وما لم أعلم',
      'اللهم إني أعوذ بك من الهم والحزن، والعجز والكسل، والجبن والبخل',
      'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة، وقنا عذاب النار',
      'اللهم اجعلني من عبادك الذين تتنزل عليهم الرحمات',
      'اللهم إني أسألك الجنة وما قرّب إليها من قول وعمل'
    ]
  };

  function getInspiration(category) {
    const pool = INSPIRATION_DUAS[category] || INSPIRATION_DUAS.general;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ─────────── الحالة ─────────── */
  function getEntries() {
    const data = S.get('duaJournal', S.DEFAULTS.duaJournal);
    return data.entries || [];
  }
  function setEntries(entries) {
    S.set('duaJournal', { entries });
  }

  /* ─────────── إضافة دعاء ─────────── */
  function add(opts) {
    const entries = getEntries();
    const entry = {
      id: 'd_' + Date.now(),
      title: (opts.title || '').trim(),
      text: (opts.text || '').trim(),
      category: opts.category || 'general',
      createdAt: new Date().toISOString(),
      state: 'pending',           // الحالة الروحانية الحالية
      stateHistory: [{            // سجل رحلة الدعاء
        state: 'pending',
        at: new Date().toISOString(),
        note: 'كُتب الدعاء'
      }],
      tags: opts.tags || [],
      private: opts.private !== false  // افتراضياً خاص
    };
    if (!entry.text) return null;
    entries.unshift(entry);
    setEntries(entries);
    return entry;
  }

  function update(id, patch) {
    const entries = getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return;
    entries[idx] = Object.assign({}, entries[idx], patch);
    setEntries(entries);
  }
  function remove(id) {
    const entries = getEntries().filter(e => e.id !== id);
    setEntries(entries);
  }

  /* ─────────── تغيير الحالة الروحانية ─────────── */
  function setState(id, newState, note) {
    const entries = getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return;
    const state = SPIRITUAL_STATES[newState];
    if (!state) return;

    const entry = entries[idx];
    entry.state = newState;
    entry.stateHistory = entry.stateHistory || [];
    entry.stateHistory.push({
      state: newState,
      at: new Date().toISOString(),
      note: note || ''
    });

    // إن كانت الحالة لها timestamp خاص (مثل answered)
    if (newState === 'answered') entry.answeredAt = new Date().toISOString();
    if (newState === 'charity') entry.charityAt = new Date().toISOString();

    setEntries(entries);

    if (newState === 'answered' && global.KHALWA?.toast) {
      global.KHALWA.toast('الحمد لله الذي استجاب دعوتك 🌿', 'success', 3500);
    } else if (newState === 'peace' && global.KHALWA?.toast) {
      global.KHALWA.toast('أنزل الله السكينة في قلبك 🌿', 'success', 3500);
    } else if (newState === 'trust' && global.KHALWA?.toast) {
      global.KHALWA.toast('تقبل الله تسليمك، ورضِّيك بما اختار 🤍', 'success', 3500);
    } else if (newState === 'gratitude' && global.KHALWA?.toast) {
      global.KHALWA.toast('بارك الله في حمدك، وزادك من فضله 🌟', 'success', 3500);
    } else if (newState === 'charity' && global.KHALWA?.toast) {
      global.KHALWA.toast('ضاعف الله أجرك، وجعلها صدقة جارية لك 💚', 'success', 3500);
    }
  }

  /* ════════════════════════════════════════════
      RENDER — الصفحة الكاملة
     ════════════════════════════════════════════ */
  const state = { tab: 'pending', searchQ: '', filterCat: 'all' };

  function render() {
    const wrap = $('duaWrap');
    if (!wrap) return;
    const entries = getEntries();

    // إحصائيات الحالات
    const stateCounts = {};
    Object.keys(SPIRITUAL_STATES).forEach(k => stateCounts[k] = 0);
    entries.forEach(e => {
      if (stateCounts[e.state] != null) stateCounts[e.state]++;
    });

    wrap.innerHTML = `
      <div class="dua-journal">
        <!-- مقدمة -->
        <div class="dua-intro-card">
          <div class="dua-intro-emoji">🤲</div>
          <div class="dua-intro-body">
            <div class="dua-intro-title">دفتر أدعيتك الخاص</div>
            <div class="dua-intro-desc">مساحتك السرية بين يدي الله. اكتب ما في قلبك، ورافق دعاءك في رحلته من السؤال إلى السكينة.</div>
            <div class="dua-intro-verse">﴿وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ﴾</div>
            <div class="dua-intro-stats">
              <span>📝 ${arabicDigits(entries.length)} دعاء</span>
              <span>🤲 ${arabicDigits(stateCounts.pending)} منتظر</span>
              <span>🌿 ${arabicDigits(stateCounts.peace + stateCounts.trust)} في سكينة</span>
              <span>✨ ${arabicDigits(stateCounts.answered)} استُجيب</span>
            </div>
          </div>
        </div>

        <!-- أزرار سريعة -->
        <div class="dua-quick-row">
          <button class="dua-add-btn" onclick="DuaJournal.openAdd()">
            <span class="dua-add-icon">＋</span>
            <span>دعاء جديد</span>
          </button>
          <button class="dua-inspire-btn" onclick="DuaJournal.showInspiration()">
            <span>💡</span><span>إلهام</span>
          </button>
        </div>

        <!-- تبويبات الحالات الروحانية -->
        <div class="dua-state-tabs">
          ${Object.keys(SPIRITUAL_STATES).map(k => {
            const s = SPIRITUAL_STATES[k];
            const isActive = state.tab === k;
            const count = stateCounts[k];
            return `
              <button class="dua-state-tab ${isActive ? 'on' : ''}"
                style="--state-color:${s.color};--state-bg:${s.bg}"
                onclick="DuaJournal.switchTab('${k}')">
                <span class="dua-state-tab-icon">${s.icon}</span>
                <span class="dua-state-tab-name">${s.name}</span>
                <span class="dua-state-tab-cnt">${arabicDigits(count)}</span>
              </button>`;
          }).join('')}
        </div>

        <!-- فلتر التصنيفات -->
        <div class="dua-cat-filter">
          <button class="dua-cat-filter-btn ${state.filterCat === 'all' ? 'on' : ''}" onclick="DuaJournal.filterCat('all')">الكل</button>
          ${CATEGORIES.map(c => `
            <button class="dua-cat-filter-btn ${state.filterCat === c.id ? 'on' : ''}"
              style="--cat-color:${c.color}"
              onclick="DuaJournal.filterCat('${c.id}')">
              ${c.icon} ${c.name}
            </button>`).join('')}
        </div>

        <div id="duaListWrap">
          ${renderList(state.tab, entries, state.filterCat)}
        </div>

        ${entries.length === 0 ? `
          <div class="dua-empty">
            <div class="dua-empty-icon">📖</div>
            <div class="dua-empty-title">دفترك فارغ</div>
            <div class="dua-empty-text">ابدأ بكتابة أول دعاء، ورافق دعاءك في رحلته الروحية. تذكّر قول الله: ﴿ادْعُونِي أَسْتَجِبْ لَكُمْ﴾</div>
          </div>` : ''}
      </div>
    `;
  }

  function switchTab(tab) {
    state.tab = tab;
    const entries = getEntries();
    document.querySelectorAll('.dua-state-tab').forEach(t => t.classList.remove('on'));
    const target = document.querySelector(`.dua-state-tab[onclick*="'${tab}'"]`);
    if (target) target.classList.add('on');
    const wrap = $('duaListWrap');
    if (wrap) wrap.innerHTML = renderList(tab, entries, state.filterCat);
  }

  function filterCat(cat) {
    state.filterCat = cat;
    const entries = getEntries();
    document.querySelectorAll('.dua-cat-filter-btn').forEach(b => b.classList.remove('on'));
    const target = document.querySelector(`.dua-cat-filter-btn[onclick*="'${cat}'"]`);
    if (target) target.classList.add('on');
    const wrap = $('duaListWrap');
    if (wrap) wrap.innerHTML = renderList(state.tab, entries, cat);
  }

  function renderList(tab, entries, filterCat) {
    let filtered = entries.filter(e => e.state === tab);
    if (filterCat !== 'all') filtered = filtered.filter(e => e.category === filterCat);

    if (filtered.length === 0) {
      const stateObj = SPIRITUAL_STATES[tab];
      return `<div class="dua-list-empty">
        <div class="dua-list-empty-icon">${stateObj.icon}</div>
        <div class="dua-list-empty-title">لا أدعية في حالة "${stateObj.name}"</div>
        <div class="dua-list-empty-text">${escapeHtml(stateObj.desc)}</div>
      </div>`;
    }
    return `<div class="dua-list">${filtered.map(e => renderEntry(e, tab)).join('')}</div>`;
  }

  function renderEntry(e, tab) {
    const cat = getCategory(e.category);
    const stateObj = SPIRITUAL_STATES[e.state] || SPIRITUAL_STATES.pending;
    const daysOld = daysSince(e.createdAt);

    // عرض سجل رحلة الدعاء
    const historyHtml = (e.stateHistory && e.stateHistory.length > 1) ? `
      <details class="dua-history-details">
        <summary>📜 رحلة الدعاء (${arabicDigits(e.stateHistory.length)} محطات)</summary>
        <div class="dua-history-list">
          ${e.stateHistory.map(h => {
            const hs = SPIRITUAL_STATES[h.state];
            return `<div class="dua-history-item">
              <span class="dua-history-icon">${hs.icon}</span>
              <div>
                <div class="dua-history-state">${hs.name}</div>
                <div class="dua-history-time">${fmtDate(h.at)}${h.note ? ' — ' + escapeHtml(h.note) : ''}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </details>` : '';

    return `
      <div class="dua-entry state-${e.state}" style="--entry-state-color:${stateObj.color};--entry-state-bg:${stateObj.bg}">
        <div class="dua-entry-hd">
          <span class="dua-entry-cat" style="background:${cat.color}22;color:${cat.color}">
            ${cat.icon} ${cat.name}
          </span>
          <span class="dua-entry-date">${fmtDate(e.createdAt)} • ${daysOld === 0 ? 'اليوم' : 'منذ ' + arabicDigits(daysOld) + ' يوم'}</span>
        </div>
        ${e.title ? `<div class="dua-entry-title">${escapeHtml(e.title)}</div>` : ''}
        <div class="dua-entry-text">${escapeHtml(e.text)}</div>

        ${e.tags && e.tags.length ? `
          <div class="dua-entry-tags">
            ${e.tags.map(t => `<span class="dua-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>` : ''}

        <!-- شارة الحالة الحالية -->
        <div class="dua-entry-state-badge" style="background:${stateObj.bg};border-color:${stateObj.color}">
          <span class="dua-state-badge-icon">${stateObj.icon}</span>
          <div>
            <div class="dua-state-badge-name" style="color:${stateObj.color}">${stateObj.name}</div>
            <div class="dua-state-badge-desc">${escapeHtml(stateObj.desc)}</div>
          </div>
          <div class="dua-state-badge-verse">${escapeHtml(stateObj.verse)}</div>
        </div>

        ${historyHtml}

        <div class="dua-entry-actions">
          <button class="dua-act-btn dua-act-state" onclick="DuaJournal.openStatePicker('${e.id}')">
            <span>🌸</span> تغيير الحالة
          </button>
          <button class="dua-act-btn" onclick="DuaJournal.edit('${e.id}')">
            <span>✏️</span> تعديل
          </button>
          <button class="dua-act-btn dua-act-del" onclick="DuaJournal.confirmDelete('${e.id}')">
            <span>🗑️</span> حذف
          </button>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      MODAL — إضافة/تعديل
     ════════════════════════════════════════════ */
  function openAdd(editId) {
    const editing = editId ? getEntries().find(e => e.id === editId) : null;
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">${editing ? '✏️ تعديل دعاء' : '🤲 دعاء جديد'}</h3>

      <label class="dua-form-lbl">العنوان (اختياري)</label>
      <input type="text" id="duaTitle" class="dua-form-input" placeholder="عنوان مختصر لدعائك"
        value="${editing ? escapeHtml(editing.title || '') : ''}" maxlength="60"/>

      <label class="dua-form-lbl">نص الدعاء</label>
      <textarea id="duaText" class="dua-form-textarea" rows="4" placeholder="اكتب دعاءك بصدق وإخلاص...">${editing ? escapeHtml(editing.text || '') : ''}</textarea>

      ${!editing ? `
        <button class="dua-fill-inspire" onclick="DuaJournal.fillInspiration()">
          💡 املأ بدعاءٍ مُلهم
        </button>` : ''}

      <label class="dua-form-lbl">التصنيف</label>
      <div class="dua-cat-grid">
        ${CATEGORIES.map(c => `
          <button class="dua-cat-btn ${editing?.category === c.id ? 'on' : (!editing && c.id === 'general' ? 'on' : '')}"
            data-cat="${c.id}" onclick="DuaJournal.pickCat(this)">
            <span class="dua-cat-icon">${c.icon}</span>
            <span class="dua-cat-name">${c.name}</span>
          </button>
        `).join('')}
      </div>

      <label class="dua-form-lbl">وسوم (اختياري — افصل بينها بفاصلة)</label>
      <input type="text" id="duaTags" class="dua-form-input" placeholder="مثال: أمي, شفاء, عاجل"
        value="${editing?.tags ? escapeHtml(editing.tags.join(', ')) : ''}"/>

      <div class="dua-form-hint">
        💡 اجعل دعاءك صادقاً، وابدأ بحمد الله والصلاة على نبيه ﷺ. وتذكّر: ﴿وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ﴾
      </div>

      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn btn-ghost btn-full" onclick="closeSheet()">إلغاء</button>
        <button class="btn btn-primary btn-full" onclick="DuaJournal.save('${editId || ''}')">
          ${editing ? 'حفظ التعديل' : 'احفظ الدعاء'}
        </button>
      </div>`;
    if (global.openSheet) global.openSheet(html);
  }

  function fillInspiration() {
    // اعرض اختيار القسم أولاً
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">💡 اختر حال الدعاء</h3>
      <p style="font-size:13px;color:var(--tx2);margin-bottom:14px">سنختار لك دعاءً مُلهماً يلائم حالك</p>
      <div class="dua-inspire-grid">
        ${CATEGORIES.map(c => `
          <button class="dua-inspire-cat-btn" onclick="DuaJournal.useInspiration('${c.id}')">
            <span class="dua-inspire-cat-icon">${c.icon}</span>
            <span class="dua-inspire-cat-name">${c.name}</span>
          </button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-full" style="margin-top:14px" onclick="closeSheet()">إغلاق</button>`;
    if (global.openSheet) global.openSheet(html);
  }

  function useInspiration(catId) {
    const dua = getInspiration(catId);
    if (global.closeSheet) global.closeSheet();
    setTimeout(() => {
      const ta = $('duaText');
      if (ta) ta.value = dua;
      // حدّث القسم
      document.querySelectorAll('.dua-cat-btn').forEach(b => b.classList.remove('on'));
      const targetBtn = document.querySelector(`.dua-cat-btn[data-cat="${catId}"]`);
      if (targetBtn) targetBtn.classList.add('on');
    }, 350);
  }

  function pickCat(btn) {
    document.querySelectorAll('.dua-cat-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }

  function save(editId) {
    const title = $('duaTitle')?.value.trim() || '';
    const text = $('duaText')?.value.trim() || '';
    if (!text) {
      if (global.KHALWA?.toast) global.KHALWA.toast('اكتب نص الدعاء أولاً', 'warning');
      return;
    }
    const catBtn = document.querySelector('.dua-cat-btn.on');
    const category = catBtn?.dataset.cat || 'general';
    const tagsRaw = $('duaTags')?.value.trim() || '';
    const tags = tagsRaw ? tagsRaw.split(/[,،]/).map(t => t.trim()).filter(Boolean).slice(0, 5) : [];

    if (editId) {
      update(editId, { title, text, category, tags });
      if (global.KHALWA?.toast) global.KHALWA.toast('تم حفظ التعديل', 'success');
    } else {
      add({ title, text, category, tags });
      if (global.KHALWA?.toast) global.KHALWA.toast('حفظ الله دعاءك وتقبّله منك 🤲', 'success', 3000);
    }
    if (global.closeSheet) global.closeSheet();
    render();
  }

  function edit(id) {
    openAdd(id);
  }

  /* ════════════════════════════════════════════
      منتقي الحالة الروحانية (State Picker)
      بدلاً من زر واحد "تمت الإجابة"، نُعطي المستخدم خيارات
     ════════════════════════════════════════════ */
  function openStatePicker(id) {
    const entry = getEntries().find(e => e.id === id);
    if (!entry) return;
    const currentState = entry.state;

    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">🌸 حالة الدعاء</h3>
      <p style="font-size:13px;color:var(--tx2);margin-bottom:16px;line-height:1.7">
        بدلاً من أن نسأل "هل استُجيب؟"، نسأل قلبك: <strong>كيف صار حالك مع هذا الدعاء؟</strong> اختر الحالة التي تشعر بها الآن.
      </p>

      <div class="dua-state-picker-list">
        ${Object.keys(SPIRITUAL_STATES).map(k => {
          const s = SPIRITUAL_STATES[k];
          const isCurrent = k === currentState;
          return `
            <button class="dua-state-pick-btn ${isCurrent ? 'current' : ''}"
              style="--state-color:${s.color};--state-bg:${s.bg}"
              onclick="DuaJournal.pickState('${id}','${k}')">
              <div class="dua-state-pick-icon">${s.icon}</div>
              <div class="dua-state-pick-body">
                <div class="dua-state-pick-name">${s.name}${isCurrent ? ' ✓' : ''}</div>
                <div class="dua-state-pick-desc">${escapeHtml(s.desc)}</div>
                <div class="dua-state-pick-verse">${escapeHtml(s.verse)}</div>
              </div>
            </button>`;
        }).join('')}
      </div>

      ${entry.stateHistory && entry.stateHistory.length > 1 ? `
        <details class="dua-history-details" style="margin-top:14px">
          <summary>📜 رحلة الدعاء (${arabicDigits(entry.stateHistory.length)} محطات)</summary>
          <div class="dua-history-list">
            ${entry.stateHistory.map(h => {
              const hs = SPIRITUAL_STATES[h.state];
              return `<div class="dua-history-item">
                <span class="dua-history-icon">${hs.icon}</span>
                <div>
                  <div class="dua-history-state">${hs.name}</div>
                  <div class="dua-history-time">${fmtDate(h.at)}${h.note ? ' — ' + escapeHtml(h.note) : ''}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </details>` : ''}

      <button class="btn btn-ghost btn-full" style="margin-top:14px" onclick="closeSheet()">إغلاق</button>`;
    if (global.openSheet) global.openSheet(html);
  }

  function pickState(entryId, newState) {
    setState(entryId, newState);
    if (global.closeSheet) global.closeSheet();
    render();
  }

  /* ─────────── حذف ─────────── */
  function confirmDelete(id) {
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">حذف الدعاء؟</h3>
      <p style="font-size:14px;line-height:1.9;color:var(--tx2);margin-bottom:18px">
        سيُحذف هذا الدعاء نهائياً مع سجل رحلته. هل أنت متأكد؟
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" onclick="closeSheet()">إلغاء</button>
        <button class="btn btn-primary btn-full" onclick="DuaJournal.doDelete('${id}')">نعم، احذفه</button>
      </div>`;
    if (global.openSheet) global.openSheet(html);
  }

  function doDelete(id) {
    remove(id);
    if (global.closeSheet) global.closeSheet();
    if (global.KHALWA?.toast) global.KHALWA.toast('تم حذف الدعاء', 'info');
    render();
  }

  function showInspiration() {
    const dua = getInspiration('general');
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">💡 إلهام لدعائك</h3>
      <div class="dua-inspire-card">
        <div class="dua-inspire-text">«${escapeHtml(dua)}»</div>
        <div class="dua-inspire-hint">تأمّل هذا الدعاء، فإن ناسبك فاكتبه في دفترك.</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn btn-ghost btn-full" onclick="closeSheet()">إغلاق</button>
        <button class="btn btn-primary btn-full" onclick="closeSheet();DuaJournal.openAdd()">📝 اكتب دعائي الآن</button>
      </div>`;
    if (global.openSheet) global.openSheet(html);
  }

  /* ════════════════════════════════════════════
      HOME MINI
     ════════════════════════════════════════════ */
  function renderHomeMini() {
    const wrap = $('homeDuaMini');
    if (!wrap) return;
    const entries = getEntries();
    const pending = entries.filter(e => e.state === 'pending').length;
    const inPeace = entries.filter(e => ['peace', 'trust'].includes(e.state)).length;
    const answered = entries.filter(e => e.state === 'answered').length;
    const lastEntry = entries[0];

    wrap.innerHTML = `
      <div class="dua-home-card" onclick="navTo('dua')">
        <div class="dua-home-icon">🤲</div>
        <div class="dua-home-body">
          <div class="dua-home-title">دفتر الأدعية</div>
          ${lastEntry
            ? `<div class="dua-home-last">«${escapeHtml(lastEntry.text.substring(0, 50))}${lastEntry.text.length > 50 ? '…' : ''}»</div>`
            : '<div class="dua-home-last">ابدأ بكتابة أول دعاء</div>'}
          <div class="dua-home-stats">
            <span>${arabicDigits(pending)} منتظر</span>
            ${inPeace > 0 ? `<span class="dua-home-peace">🌿 ${arabicDigits(inPeace)} ساكن</span>` : ''}
            ${answered > 0 ? `<span class="dua-home-answered">✨ ${arabicDigits(answered)}</span>` : ''}
          </div>
        </div>
        <span class="dua-home-arrow">‹</span>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      PUBLIC API
     ════════════════════════════════════════════ */
  global.DuaJournal = {
    init: render,
    render,
    renderHomeMini,
    openAdd,
    fillInspiration,
    useInspiration,
    pickCat,
    save,
    edit,
    confirmDelete,
    doDelete,
    setState,
    openStatePicker,
    pickState,
    switchTab,
    filterCat,
    showInspiration,
    CATEGORIES,
    SPIRITUAL_STATES,
    getEntries,
    getInspiration
  };

})(window);
