/* ============================================================
   KHALWA — TAWBAH MEMOIRS (tawbah.js) — v1.0
   مذكرات التوبة — مساحة سرية آمنة
   ----------------------------------------------------------------
   • دفتر سري مشفّر (XOR + base64) — لا يمكن تصديره خارج التطبيق
   • كل ذنب → آية توبة + حديث + عمل مُكفّر مخصّص
   • تتبّع الالتزام: "كم يوماً منذ تبت من هذا؟"
   • رسالة لطيفة عند انكسار التوبة: "الله يفرح بتوبتك، ابدأ من جديد"
   • يحترق تلقائياً بعد 40 يوماً (رمزٌ للتطهّر)
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.Storage;
  const BURN_AFTER_DAYS = 40;

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
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  }
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /* ─────────── تصنيفات الذنوب + المحتوى المرتبط ─────────── */
  const SIN_CATEGORIES = {
    prayer: {
      id: 'prayer', name: 'تقصير في الصلاة', icon: '🕌',
      verse: '﴿حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَىٰ﴾',
      hadith: 'الصلوات الخمس كفّارة للذنوب ما لم تُغشَ فيها الكبائر',
      expiation: 'صلِّ الفريضة في وقتها، وأتبعها بركعتين قضاءٍ لما فاتك، ثم أكثر من الاستغفار'
    },
    tongue: {
      id: 'tongue', name: 'إطلاق اللسان', icon: '🗣️',
      verse: '﴿مَّا يَلْفِظُ مِن قَوْلٍ إِلَّا لَدَيْهِ رَقِيبٌ عَتِيدٌ﴾',
      hadith: 'من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت',
      expiation: 'تصدّق بصدقةٍ سرّاً، وأكثر من قول "سبحان الله وبحمده" مئة مرة'
    },
    gaze: {
      id: 'gaze', name: 'إطلاق البصر', icon: '👁️',
      verse: '﴿قُل لِّلْمُؤْمِنِينَ يَغُضُّوا مِنْ أَبْصَارِهِمْ﴾',
      hadith: 'النظرة سهمٌ مسموم من سهام إبليس',
      expiation: 'صم يوماً تطوّعاً، واقرأ سورة النور، وأكثر من ذكر الله قبل النوم'
    },
    anger: {
      id: 'anger', name: 'الغضب والظلم', icon: '🔥',
      verse: '﴿وَالْكَاظِمِينَ الْغَيْظَ وَالْعَافِينَ عَنِ النَّاسِ﴾',
      hadith: 'ليس الشديد بالصرعة، إنما الشديد الذي يملك نفسه عند الغضب',
      expiation: 'توضّأ، واعتذر لمن ظلمته، وتصدّق على مسكين'
    },
    money: {
      id: 'money', name: 'حقوق مالية', icon: '💰',
      verse: '﴿وَآتُوا حَقَّهُ يَوْمَ حَصَادِهِ﴾',
      hadith: 'أدُّ الأمانة إلى من ائتمنك',
      expiation: 'ردّ الحقوق إلى أهلها، وأخرج زكاة ما عليك، وتصدّق بصدقةٍ جارية'
    },
    time: {
      id: 'time', name: 'إضاعة الوقت', icon: '⏰',
      verse: '﴿فَكَيْفَ إِذَا جَمَعْنَاهُمْ لِيَوْمٍ لَّا رَيْبَ فِيهِ﴾',
      hadith: 'نعمتان مغبونٌ فيهما كثيرٌ من الناس: الصحة والفراغ',
      expiation: 'اقرأ ورداً من القرآن يومياً، واحرص على أذكار الصباح والمساء'
    },
    parents: {
      id: 'parents', name: 'عقوق الوالدين', icon: '👨‍👩‍👦',
      verse: '﴿وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا﴾',
      hadith: 'رضا الرب في رضا الوالد، وسخط الرب في سخط الوالد',
      expiation: 'اتصل بوالديك، اطمئن عليهما، واطلب دعاءهما، وبرَّهما بعملٍ صالح'
    },
    other: {
      id: 'other', name: 'ذنب آخر', icon: '🤲',
      verse: '﴿قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ﴾',
      hadith: 'كل ابن آدم خطّاء، وخير الخطّائين التوابون',
      expiation: 'أكثر من الاستغفار، واتخذ عملاً صالحاً مستمراً (صدقة جارية، علم يُنتفع به)'
    }
  };

  /* ─────────── حالات التوبة ─────────── */
  const TAWBAH_STATES = {
    recognized: { id: 'recognized', name: 'اعترفت',     icon: '😔', color: '#C2880F', desc: 'أقررت بالذنب — وهذا أول الطريق' },
    repented:   { id: 'repented',   name: 'تبت',         icon: '🤲', color: '#1F8A5C', desc: 'عقدت العزم على عدم العودة' },
    steadfast:  { id: 'steadfast',  name: 'ثابت',        icon: '🌿', color: '#1E9763', desc: 'بقيت على العهد — الحمد لله' },
    relapsed:   { id: 'relapsed',   name: 'انكسرت',      icon: '🌧️', color: '#A04030', desc: 'عُدت إلى الذنب — لا تقنط، ابدأ من جديد' },
    healed:     { id: 'healed',     name: 'تُطُهّر',     icon: '✨', color: '#C7902E', desc: 'محا الله عنك — تجاوزت الـ٤٠ يوماً' }
  };

  /* ─────────── تخزين التوبة ─────────── */
  function getData() {
    return S.get('tawbah', S.DEFAULTS.tawbah);
  }
  function saveData(data) {
    S.set('tawbah', data);
  }

  /* تشفير النص قبل التخزين */
  function encryptText(text) {
    if (!text) return '';
    return S.xorEncrypt(text);
  }
  function decryptText(b64) {
    if (!b64) return '';
    return S.xorDecrypt(b64);
  }

  /* حذف التوبات التي تجاوزت 40 يوم في حالة "ثابت" أو "مُطهّر" — يحترق تلقائياً */
  function burnOldEntries() {
    const data = getData();
    const now = Date.now();
    let changed = false;
    data.entries = (data.entries || []).filter(e => {
      if (e.burnedAt) return false; // احترقت بالفعل
      // إن كانت في حالة "ثابت" أو "مُطهّر" ومضى عليها 40 يوم من آخر تحديث، تُحرق
      if ((e.state === 'steadfast' || e.state === 'healed') && e.lastStateAt) {
        const age = (now - new Date(e.lastStateAt).getTime()) / 86400000;
        if (age >= BURN_AFTER_DAYS) {
          changed = true;
          return false; // احترقت — رمزٌ للتطهّر
        }
      }
      return true;
    });
    if (changed) saveData(data);
    return changed;
  }

  /* ─────────── إضافة توبة ─────────── */
  function add(opts) {
    const data = getData();
    const entry = {
      id: 't_' + Date.now(),
      category: opts.category || 'other',
      titleEnc: encryptText((opts.title || '').trim()),
      textEnc: encryptText((opts.text || '').trim()),
      createdAt: new Date().toISOString(),
      lastStateAt: new Date().toISOString(),
      state: 'repented',
      stateHistory: [{
        state: 'recognized',
        at: new Date().toISOString(),
        note: 'اعترفت بالذنب'
      }, {
        state: 'repented',
        at: new Date().toISOString(),
        note: 'تبت إلى الله'
      }]
    };
    if (!decryptText(entry.textEnc)) return null;
    data.entries = data.entries || [];
    data.entries.unshift(entry);
    saveData(data);

    // جدد بستان الأعمال
    if (global.Bustan && global.Bustan.renewGarden) {
      global.Bustan.renewGarden();
    }
    return entry;
  }

  function update(id, patch) {
    const data = getData();
    const idx = (data.entries || []).findIndex(e => e.id === id);
    if (idx < 0) return;
    const e = data.entries[idx];
    if (patch.title !== undefined) e.titleEnc = encryptText(patch.title);
    if (patch.text !== undefined) e.textEnc = encryptText(patch.text);
    if (patch.category) e.category = patch.category;
    saveData(data);
  }

  function remove(id) {
    const data = getData();
    data.entries = (data.entries || []).filter(e => e.id !== id);
    saveData(data);
  }

  function setState(id, newState, note) {
    const data = getData();
    const idx = (data.entries || []).findIndex(e => e.id === id);
    if (idx < 0) return;
    const e = data.entries[idx];
    const prev = e.state;
    e.state = newState;
    e.lastStateAt = new Date().toISOString();
    e.stateHistory = e.stateHistory || [];
    e.stateHistory.push({ state: newState, at: e.lastStateAt, note: note || '' });

    // إن انكسرت التوبة — رسالة لطيفة
    if (newState === 'relapsed' && prev !== 'relapsed') {
      if (global.KHALWA?.toast) {
        global.KHALWA.toast('🤲 الله يفرح بتوبتك، ابدأ من جديد — بابه مفتوح', 'success', 5500);
      }
    }
    // إن ثَبتت — رسالة تشجيع
    if (newState === 'steadfast' && prev !== 'steadfast') {
      if (global.KHALWA?.toast) {
        global.KHALWA.toast('🌿 ثبتَّ على التوبة — أحبك الله', 'success', 4000);
      }
    }
    saveData(data);
  }

  /* ─────────── حالة الواجهة الداخلية ─────────── */
  const uiState = { tab: 'all', filterCat: 'all' };

  /* ════════════════════════════════════════════
      RENDER — الصفحة الكاملة
     ════════════════════════════════════════════ */
  function render() {
    const wrap = $('tawbahWrap');
    if (!wrap) return;

    // احرق التوبات القديمة أولاً
    const burned = burnOldEntries();

    const data = getData();
    const entries = data.entries || [];
    const stateCounts = { recognized: 0, repented: 0, steadfast: 0, relapsed: 0, healed: 0 };
    entries.forEach(e => { stateCounts[e.state] = (stateCounts[e.state] || 0) + 1; });

    // إحصائية
    const total = entries.length;
    const steadfastCount = stateCounts.steadfast;
    const longestSteadfast = entries.reduce((max, e) => {
      if (e.state === 'steadfast' || e.state === 'healed') {
        const days = daysSince(e.lastStateAt);
        return Math.max(max, days);
      }
      return max;
    }, 0);

    wrap.innerHTML = `
      <!-- بطاقة المقدمة -->
      <div class="tawbah-intro-card">
        <div class="tawbah-intro-emoji">🤲</div>
        <div class="tawbah-intro-body">
          <div class="tawbah-intro-title">مذكرات التوبة</div>
          <div class="tawbah-intro-desc">
            هنا مساحتك بين يدي ربك وحدَه. ما تُسرّ به يُحفظ مشفّراً لا يغادر جهازك ولا يطّلع عليه سواه. ومن ثَبَتَ أربعين يوماً، يُطوى سجلّه تلقائياً طهراً من الله، ويعود القلب نقيّاً.
          </div>
          <div class="tawbah-intro-verse">
            ﴿إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ﴾
          </div>
        </div>
      </div>

      ${burned ? `
        <div class="tawbah-burn-notice">
          🔥 طُهّرت بعض سجلاتك التراثية بعد إتمام ٤٠ يوماً من الالتزام.
          <br>الحمد لله الذي وفّقك — قلبٌ نقيّ وبداية جديدة.
        </div>` : ''}

      <!-- إحصائيات -->
      <div class="tawbah-stats-card">
        <div class="tawbah-stat-item">
          <div class="tawbah-stat-num">${arabicDigits(total)}</div>
          <div class="tawbah-stat-lbl">سجلات نشطة</div>
        </div>
        <div class="tawbah-stat-sep"></div>
        <div class="tawbah-stat-item">
          <div class="tawbah-stat-num">${arabicDigits(steadfastCount)}</div>
          <div class="tawbah-stat-lbl">ثابت الآن</div>
        </div>
        <div class="tawbah-stat-sep"></div>
        <div class="tawbah-stat-item">
          <div class="tawbah-stat-num">${arabicDigits(longestSteadfast)}</div>
          <div class="tawbah-stat-lbl">أطول التزام (يوم)</div>
        </div>
      </div>

      <!-- أزرار سريعة -->
      <div class="tawbah-quick-row">
        <button class="btn btn-primary tawbah-add-btn" onclick="Tawbah.openAdd()">
          ✍️ سجّل توبة جديدة
        </button>
      </div>

      <!-- تبويبات الحالة -->
      <div class="tawbah-state-tabs">
        <button class="tawbah-state-tab ${uiState.tab === 'all' ? 'on' : ''}" onclick="Tawbah.switchTab('all')">
          <span class="tawbah-tab-icon">📚</span>
          <span class="tawbah-tab-name">الكل</span>
          <span class="tawbah-tab-cnt">${arabicDigits(total)}</span>
        </button>
        ${Object.values(TAWBAH_STATES).map(s => `
          <button class="tawbah-state-tab ${uiState.tab === s.id ? 'on' : ''}" style="--state-color:${s.color}" onclick="Tawbah.switchTab('${s.id}')">
            <span class="tawbah-tab-icon">${s.icon}</span>
            <span class="tawbah-tab-name">${s.name}</span>
            <span class="tawbah-tab-cnt">${arabicDigits(stateCounts[s.id] || 0)}</span>
          </button>
        `).join('')}
      </div>

      <!-- القائمة -->
      <div id="tawbahListWrap">
        ${renderList()}
      </div>

      <!-- تذكير نهائي -->
      <div class="tawbah-reminder-card">
        <div class="tawbah-reminder-icon">💝</div>
        <div class="tawbah-reminder-body">
          <div class="tawbah-reminder-title">باب الله مفتوح</div>
          <div class="tawbah-reminder-text">
            ولو عُدت ألف مرّة، فالله يفرح بتوبتك في كل مرّة.
            <br>﴿وَهُوَ الَّذِي يَقْبَلُ التَّوْبَةَ عَنْ عِبَادِهِ﴾
          </div>
        </div>
      </div>
    `;
  }

  function renderList() {
    const data = getData();
    let entries = data.entries || [];

    if (uiState.tab !== 'all') {
      entries = entries.filter(e => e.state === uiState.tab);
    }
    if (uiState.filterCat !== 'all') {
      entries = entries.filter(e => e.category === uiState.filterCat);
    }

    if (!entries.length) {
      return `
        <div class="tawbah-empty">
          <div class="tawbah-empty-icon">🕊️</div>
          <div class="tawbah-empty-text">
            ${uiState.tab === 'all'
              ? 'لا سجلات بعد. ابدأ بكتابة أول توبة — وكل بدايةٍ بإذن الله مباركة.'
              : 'لا سجلات في هذه الحالة بعد.'}
          </div>
        </div>`;
    }

    return `<div class="tawbah-list">${entries.map(renderEntry).join('')}</div>`;
  }

  function renderEntry(e) {
    const cat = SIN_CATEGORIES[e.category] || SIN_CATEGORIES.other;
    const state = TAWBAH_STATES[e.state] || TAWBAH_STATES.recognized;
    const title = decryptText(e.titleEnc) || '(بدون عنوان)';
    const text = decryptText(e.textEnc) || '';
    const daysSinceRepentance = daysSince(e.lastStateAt);
    const daysToBurn = (e.state === 'steadfast' || e.state === 'healed')
      ? Math.max(0, BURN_AFTER_DAYS - daysSinceRepentance) : null;

    return `
      <div class="tawbah-entry state-${e.state}">
        <div class="tawbah-entry-hd">
          <span class="tawbah-entry-cat" style="background:${cat.icon === '🕌' ? 'var(--c-primary-bg)' : 'var(--c-accent-bg)'};color:var(--c-primary)">${cat.icon} ${cat.name}</span>
          <span class="tawbah-entry-state" style="background:${state.color}22;color:${state.color}">
            ${state.icon} ${state.name}
          </span>
        </div>
        <div class="tawbah-entry-title">${escapeHtml(title)}</div>
        ${text ? `<div class="tawbah-entry-text">${escapeHtml(text)}</div>` : ''}
        <div class="tawbah-entry-meta">
          <span>📅 ${fmtDate(e.createdAt)}</span>
          <span>⏱️ ${arabicDigits(daysSinceRepentance)} ${daysSinceRepentance === 1 ? 'يوم' : 'أيام'} منذ آخر تحديث</span>
        </div>

        <!-- الآية والحديث والعمل المكفّر -->
        <div class="tawbah-entry-guidance">
          <div class="tawbah-guidance-row">
            <div class="tawbah-guidance-lbl">📖 آية التوبة</div>
            <div class="tawbah-guidance-val tawbah-verse">${cat.verse}</div>
          </div>
          <div class="tawbah-guidance-row">
            <div class="tawbah-guidance-lbl">🌳 حديث</div>
            <div class="tawbah-guidance-val">${cat.hadith}</div>
          </div>
          <div class="tawbah-guidance-row">
            <div class="tawbah-guidance-lbl">💚 عملٌ مُكفّر</div>
            <div class="tawbah-guidance-val">${cat.expiation}</div>
          </div>
        </div>

        ${daysToBurn !== null ? `
          <div class="tawbah-burn-progress">
            <div class="tawbah-burn-lbl">
              ⏳ ${arabicDigits(daysToBurn)} ${daysToBurn === 1 ? 'يوم' : 'يوماً'} حتى يُحترق السجلّ تلقائياً (رمزٌ للتطهّر)
            </div>
            <div class="tawbah-burn-bar">
              <div class="tawbah-burn-fill" style="width:${(daysSinceRepentance / BURN_AFTER_DAYS * 100).toFixed(0)}%"></div>
            </div>
          </div>` : ''}

        <!-- أزرار التحوّل -->
        <div class="tawbah-entry-actions">
          ${e.state !== 'steadfast' ? `
            <button class="tawbah-act-btn" onclick="Tawbah.setState('${e.id}','steadfast','ثبتُّ على التوبة')">
              🌿 ثبتُّ
            </button>` : ''}
          ${e.state !== 'relapsed' ? `
            <button class="tawbah-act-btn tawbah-act-relapse" onclick="Tawbah.setState('${e.id}','relapsed','انكسرت')">
              🌧️ انكسرت
            </button>` : ''}
          <button class="tawbah-act-btn" onclick="Tawbah.edit('${e.id}')">✏️ تعديل</button>
          <button class="tawbah-act-btn tawbah-act-danger" onclick="Tawbah.confirmDelete('${e.id}')">🗑️</button>
        </div>

        <!-- سجل التحولات -->
        ${e.stateHistory && e.stateHistory.length > 1 ? `
          <details class="tawbah-history">
            <summary>📜 سجل التحولات (${arabicDigits(e.stateHistory.length)})</summary>
            <div class="tawbah-history-list">
              ${e.stateHistory.map(h => {
                const st = TAWBAH_STATES[h.state] || TAWBAH_STATES.recognized;
                return `<div class="tawbah-history-item">
                  <span class="tawbah-history-icon">${st.icon}</span>
                  <span class="tawbah-history-state">${st.name}</span>
                  <span class="tawbah-history-date">${fmtDate(h.at)}</span>
                  ${h.note ? `<span class="tawbah-history-note">${escapeHtml(h.note)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </details>` : ''}
      </div>
    `;
  }

  function switchTab(tab) {
    uiState.tab = tab;
    document.querySelectorAll('.tawbah-state-tab').forEach(t => t.classList.remove('on'));
    const target = document.querySelector(`.tawbah-state-tab[onclick*="'${tab}'"]`);
    if (target) target.classList.add('on');
    const wrap = $('tawbahListWrap');
    if (wrap) wrap.innerHTML = renderList();
  }

  /* ════════════════════════════════════════════
      MODAL — إضافة/تعديل توبة
     ════════════════════════════════════════════ */
  function openAdd(editId) {
    const editing = editId ? (getData().entries || []).find(e => e.id === editId) : null;
    const title = editing ? decryptText(editing.titleEnc) : '';
    const text = editing ? decryptText(editing.textEnc) : '';
    const cat = editing ? editing.category : 'other';

    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">${editing ? '✏️ تعديل توبة' : '🤲 سجّل توبة'}</h3>
      <p style="font-size:13px;color:var(--tx2);margin-bottom:14px;line-height:1.8">
        اكتب بصدقٍ بين يدي الله. كل ما تكتبه يُحفظ مشفّراً ولا يغادر جهازك أبداً.
        ستُذكَّر بآيةٍ وحديثٍ وعملٍ مُكفّر يناسب نوع ذنبك.
      </p>

      <div class="tawbah-form-lbl">نوع الذنب</div>
      <div class="tawbah-cat-grid">
        ${Object.values(SIN_CATEGORIES).map(c => `
          <button class="tawbah-cat-btn ${cat === c.id ? 'on' : ''}" data-cat="${c.id}" onclick="Tawbah.pickCat(this)">
            <span class="tawbah-cat-icon">${c.icon}</span>
            <span class="tawbah-cat-name">${c.name}</span>
          </button>
        `).join('')}
      </div>

      <div class="tawbah-form-lbl">عنوان مختصر (اختياري)</div>
      <input type="text" class="tawbah-form-input" id="tawbahTitle" placeholder="مثلاً: تأخر صلاة الفجر"
        value="${escapeHtml(title)}" maxlength="80"/>

      <div class="tawbah-form-lbl">تفاصيل توبتك</div>
      <textarea class="tawbah-form-textarea" id="tawbahText" rows="5"
        placeholder="اعترف بصدقٍ بين يدي الله، واكتب ما يدور في قلبك..."></textarea>
      <script>document.getElementById('tawbahText').value = ${JSON.stringify(text)};</script>

      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn btn-ghost btn-full" onclick="closeSheet()">إلغاء</button>
        <button class="btn btn-primary btn-full" onclick="Tawbah.save('${editId || ''}')">
          ${editing ? 'حفظ التعديل' : 'احفظ التوبة'}
        </button>
      </div>`;
    if (global.openSheet) global.openSheet(html);
  }

  function pickCat(btn) {
    document.querySelectorAll('.tawbah-cat-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }

  function save(editId) {
    const title = ($('tawbahTitle')?.value || '').trim();
    const text = ($('tawbahText')?.value || '').trim();
    const catBtn = document.querySelector('.tawbah-cat-btn.on');
    const cat = catBtn ? catBtn.dataset.cat : 'other';

    if (!text && !title) {
      if (global.KHALWA?.toast) global.KHALWA.toast('اكتب شيئاً ولو كلمة واحدة', 'warn');
      return;
    }

    if (editId) {
      update(editId, { title, text, category: cat });
      if (global.KHALWA?.toast) global.KHALWA.toast('✏️ تم تعديل التوبة', 'success');
    } else {
      add({ title, text, category: cat });
      if (global.KHALWA?.toast) global.KHALWA.toast('🤲 قُبلت توبتك بإذن الله — ابدأ صفحةً جديدة', 'success', 4500);
    }
    if (global.closeSheet) global.closeSheet();
    render();
  }

  function edit(id) {
    openAdd(id);
  }

  function confirmDelete(id) {
    const html = `<div class="sheet-handle"></div>
      <h3 class="sheet-title">🗑️ حذف السجل؟</h3>
      <p style="font-size:14px;color:var(--tx2);margin-bottom:18px;line-height:1.8">
        سيُحذف هذا السجلّ نهائياً من جهازك. لا يمكن استرجاعه.
        <br><br>
        إن كنت قد ثَبتَّ على توبتك، فالأفضل تركه — فسيُحترق تلقائياً بعد ٤٠ يوماً رمزاً للتطهّر.
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" onclick="closeSheet()">إبقاء</button>
        <button class="btn btn-primary btn-full" style="background:var(--err)" onclick="Tawbah.doDelete('${id}')">احذف</button>
      </div>`;
    if (global.openSheet) global.openSheet(html);
  }

  function doDelete(id) {
    remove(id);
    if (global.closeSheet) global.closeSheet();
    if (global.KHALWA?.toast) global.KHALWA.toast('تم الحذف', 'success');
    render();
  }

  /* ════════════════════════════════════════════
      HOME MINI
     ════════════════════════════════════════════ */
  function renderHomeMini() {
    const wrap = $('homeTawbahMini');
    if (!wrap) return;
    burnOldEntries();
    const data = getData();
    const entries = data.entries || [];
    const steadfast = entries.filter(e => e.state === 'steadfast').length;
    const relapsed = entries.filter(e => e.state === 'relapsed').length;

    wrap.innerHTML = `
      <div class="tawbah-home-card" onclick="navTo('tawbah')">
        <div class="tawbah-home-icon">🤲</div>
        <div class="tawbah-home-body">
          <div class="tawbah-home-title">مذكرات التوبة</div>
          ${entries.length === 0
            ? '<div class="tawbah-home-sub">ابدأ أول توبة — بابه مفتوح</div>'
            : `<div class="tawbah-home-stats">
                <span>🌿 ${arabicDigits(steadfast)} ثابت</span>
                ${relapsed > 0 ? `<span>🌧️ ${arabicDigits(relapsed)} بحاجة لعودة</span>` : ''}
              </div>`}
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      PUBLIC API
     ════════════════════════════════════════════ */
  global.Tawbah = {
    init: render,
    render,
    renderHomeMini,
    openAdd,
    pickCat,
    save,
    edit,
    confirmDelete,
    doDelete,
    setState,
    switchTab,
    SIN_CATEGORIES,
    TAWBAH_STATES,
    BURN_AFTER_DAYS
  };

})(window);
