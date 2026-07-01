/* ============================================================
   KHALWA — BUSTAN AL-A'MAL (bustan.js) — v1.0
   بستان الأعمال — نظام التطور الإيماني
   ----------------------------------------------------------------
   Gamification إيماني حقيقي:
   • القرآن    → أشجار نخيل 🌴
   • الصدقة    → ورود 🌹
   • الصلاة    → سنابل قمح 🌾
   • الذكر     → عنب 🍇
   البستان يتأثر بالحالة:
   • الإهمال   → ذبول
   • الاستمرار → إثمار
   • التوبة    → تجدد
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
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function daysSince(iso) {
    if (!iso) return 0;
    const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
    return Math.max(0, Math.floor(diff));
  }

  /* ─────────── مولّد seeded (Mulberry32) ─────────── */
  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function getGardenSeed(data) {
    if (data.gardenSeed) return data.gardenSeed;
    const s = Math.floor(Math.random() * 1000000) + 1;
    data.gardenSeed = s;
    S.set('bustan', data);
    return s;
  }

  /* ─────────── تعريف النباتات ─────────── */
  const PLANTS = {
    quran: {
      id: 'quran', name: 'نخلة القرآن', icon: '🌴',
      color: '#8B6F47', accent: '#C7902E',
      deedKey: 'bustan_quran',
      verse: '﴿أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَا﴾',
      desc: 'كل صفحة تقرؤها تُنبت سعفة جديدة في نخلتك المباركة'
    },
    charity: {
      id: 'charity', name: 'وردة الصدقة', icon: '🌹',
      color: '#C84A5B', accent: '#E68BA3',
      deedKey: 'bustan_charity',
      verse: '﴿مَّن ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا﴾',
      desc: 'كل صدقةٍ تُزهّر وردةً تنشر عبيرها في البستان'
    },
    salah: {
      id: 'salah', name: 'سنبلة الصلاة', icon: '🌾',
      color: '#C7902E', accent: '#EAB95C',
      deedKey: 'bustan_salah',
      verse: '﴿إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا﴾',
      desc: 'كل صلاةٍ في وقتها تُنبت سنبلةً تُثمر حبّاتٍ مباركة'
    },
    dhikr: {
      id: 'dhikr', name: 'عنقود الذكر', icon: '🍇',
      color: '#7B3F8C', accent: '#B070B8',
      deedKey: 'bustan_dhikr',
      verse: '﴿فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ﴾',
      desc: 'كل ذكرٍ يُضيف عنبةً لعنقودك الحلو'
    }
  };

  /* ─────────── حالات البستان ─────────── */
  const GARDEN_STATES = {
    fresh:   { id: 'fresh',   name: 'بستان ناضر',     icon: '🌿', desc: 'حديقتك عامرة بنعمة الله',          color: '#1E9763' },
    wilting: { id: 'wilting', name: 'ذبولٌ خفيف',     icon: '🍂', desc: 'بعض نباتاتك تنتظر عودتك',          color: '#C2880F' },
    dormant: { id: 'dormant', name: 'سكون',           icon: '🥀', desc: 'حديقتك في انتظار المطر — عُد ولو بذكر', color: '#A04030' },
    renewed: { id: 'renewed', name: 'متجدّد بالتوبة', icon: '🌱', desc: 'التوبة أنبتت بذوراً جديدة بإذن الله', color: '#1F8A5C' }
  };

  /* ─────────── مستويات كل نبات ─────────── */
  function getPlantStage(count) {
    if (count >= 100) return { id: 'paradise', name: 'جنة', icon: '🌳', level: 6 };
    if (count >= 60)  return { id: 'orchard',  name: 'بستان', icon: '🌴', level: 5 };
    if (count >= 35)  return { id: 'mature',   name: 'مثمر', icon: '🌿', level: 4 };
    if (count >= 20)  return { id: 'grown',    name: 'ناضج', icon: '🌱', level: 3 };
    if (count >= 10)  return { id: 'young',    name: 'فتي',  icon: '🌿', level: 2 };
    if (count >= 3)   return { id: 'sprout',   name: 'برعم', icon: '🌱', level: 1 };
    return { id: 'seed', name: 'بذرة', icon: '🌰', level: 0 };
  }

  /* ─────────── حساب حالة البستان ─────────── */
  function computeGardenState(data) {
    const plants = data.plants || {};
    const allDates = Object.values(plants).map(p => p.lastDate).filter(Boolean);
    if (!allDates.length) return 'fresh';
    const mostRecent = allDates.sort().pop();
    const days = daysSince(mostRecent);
    if (data.gardenState === 'renewed' && days < 1) return 'renewed';
    if (days >= 5) return 'dormant';
    if (days >= 2) return 'wilting';
    return 'fresh';
  }

  /* ─────────── إضافة عمل للبستان ─────────── */
  function addDeed(plantId, count) {
    count = count || 1;
    const plant = PLANTS[plantId];
    if (!plant) return;
    const data = S.get('bustan', S.DEFAULTS.bustan);
    data.plants = data.plants || {};
    data.plants[plantId] = data.plants[plantId] || { count: 0, lastDate: null, streak: 0 };
    const p = data.plants[plantId];

    // حساب streak (إن كان اليوم نفسه آخر مرة، يُحدّث، إن كان بالأمس يزيد، وإلا يعيد لـ1)
    const today = todayKey();
    if (p.lastDate === today) {
      // نفس اليوم — لا تغيير في streak
    } else {
      const yesterday = new Date(Date.now() - 86400000);
      const yKey = todayKey(yesterday);
      if (p.lastDate === yKey) {
        p.streak = (p.streak || 0) + 1;
      } else {
        p.streak = 1;
      }
    }

    p.count += count;
    p.lastDate = today;
    data.history = data.history || {};
    data.history[today] = data.history[today] || { quran: 0, charity: 0, salah: 0, dhikr: 0 };
    data.history[today][plantId] = (data.history[today][plantId] || 0) + count;
    data.lastUpdated = new Date().toISOString();
    data.lastVisit = today;

    // إعادة حساب حالة البستان — الاستمرار يعيدها ناضرة
    const wasDormant = data.gardenState === 'dormant' || data.gardenState === 'wilting';
    data.gardenState = computeGardenState(data);
    // إن عاد بعد سكون، فالحالة "متجدّد" ليوم واحد
    if (wasDormant) {
      data.gardenState = 'renewed';
    }

    S.set('bustan', data);

    // إشعار لطيف عند تطوّر النبات
    const newStage = getPlantStage(p.count);
    if (newStage.level === 4 && p.count - count < 35) {
      if (global.KHALWA?.toast) global.KHALWA.toast(`${plant.icon} ${plant.name} أصبح مثمراً! الحمد لله`, 'success', 3500);
    }

    if ($('bustanWrap')) render();
    if ($('homeBustanMini')) renderHomeMini();
  }

  /* ─────────── التوبة تجدّد البستان ─────────── */
  function renewGarden() {
    const data = S.get('bustan', S.DEFAULTS.bustan);
    data.gardenState = 'renewed';
    data.lastUpdated = new Date().toISOString();
    S.set('bustan', data);
    if ($('bustanWrap')) render();
    if ($('homeBustanMini')) renderHomeMini();
  }

  /* ════════════════════════════════════════════
      رسم كل نبات بشكل SVG مخصّص
     ════════════════════════════════════════════ */
  function renderPlantSVG(plantId, count, gardenState, rng) {
    const plant = PLANTS[plantId];
    const stage = getPlantStage(count);
    const wilting = gardenState === 'wilting' || gardenState === 'dormant';
    const renewed = gardenState === 'renewed';
    const lvl = stage.level;
    // ضباب التجدد: لمسة خضراء على الحواف
    const opacity = wilting ? 0.55 : (renewed ? 1 : 0.95);

    if (plantId === 'quran') return renderPalm(lvl, wilting, opacity, rng);
    if (plantId === 'charity') return renderRose(lvl, wilting, opacity, rng);
    if (plantId === 'salah') return renderWheat(lvl, wilting, opacity, rng);
    if (plantId === 'dhikr') return renderGrape(lvl, wilting, opacity, rng);
    return '';
  }

  // نخلة القرآن
  function renderPalm(level, wilting, opacity, rng) {
    const fronds = Math.min(10, 4 + level);
    const trunkH = 30 + level * 18;
    const baseY = 200;
    const trunkTop = baseY - trunkH;
    let frondsSvg = '';
    for (let i = 0; i < fronds; i++) {
      const angle = -Math.PI / 2 + (i - (fronds - 1) / 2) * 0.45 + (rng() - 0.5) * 0.15;
      const len = 36 + level * 4 + rng() * 6;
      const ex = 100 + Math.cos(angle) * len;
      const ey = trunkTop + Math.sin(angle) * len;
      const cx = 100 + Math.cos(angle) * len * 0.5;
      const cy = trunkTop + Math.sin(angle) * len * 0.5 - 8;
      const frondColor = wilting ? '#8A7A50' : '#3F6B25';
      const leaflets = 6;
      let leafletSvg = '';
      for (let j = 0; j < leaflets; j++) {
        const t = j / (leaflets - 1);
        const lx = 100 + Math.cos(angle) * len * t;
        const ly = trunkTop + Math.sin(angle) * len * t;
        const side = j % 2 === 0 ? 1 : -1;
        const lx2 = lx + Math.cos(angle + Math.PI / 2 * side) * (4 + (1 - t) * 6);
        const ly2 = ly + Math.sin(angle + Math.PI / 2 * side) * (4 + (1 - t) * 6);
        leafletSvg += `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${lx2.toFixed(1)}" y2="${ly2.toFixed(1)}" stroke="${frondColor}" stroke-width="1.2" opacity="${opacity * 0.85}" stroke-linecap="round"/>`;
      }
      frondsSvg += `<path d="M 100 ${trunkTop} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${frondColor}" stroke-width="2" fill="none" stroke-linecap="round" opacity="${opacity}"/>${leafletSvg}`;
    }
    // الجذع
    const trunkColor = wilting ? '#6B5230' : '#8B6F47';
    const trunkPath = `M ${100 - (4 + level)} ${baseY} Q ${98 - level} ${(baseY + trunkTop) / 2} ${100 - 2} ${trunkTop} L ${102} ${trunkTop} Q ${102 + level} ${(baseY + trunkTop) / 2} ${100 + (4 + level)} ${baseY} Z`;
    // ثمار التمر عند المستوى 4+
    let datesSvg = '';
    if (level >= 4 && !wilting) {
      const bunches = 2;
      for (let b = 0; b < bunches; b++) {
        const bx = 100 + (b === 0 ? -10 : 10);
        const by = trunkTop + 8;
        for (let k = 0; k < 5; k++) {
          const dx = bx + (rng() - 0.5) * 8;
          const dy = by + k * 3;
          datesSvg += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2" fill="#A04030" opacity="${opacity}"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 200 220" class="bustan-plant-svg" preserveAspectRatio="xMidYEnd meet">
      <ellipse cx="100" cy="205" rx="50" ry="8" fill="#B89868" opacity="0.6"/>
      ${datesSvg}
      <path d="${trunkPath}" fill="${trunkColor}" opacity="${opacity}"/>
      ${frondsSvg}
    </svg>`;
  }

  // وردة الصدقة
  function renderRose(level, wilting, opacity, rng) {
    const stems = Math.min(7, 1 + level);
    let svg = '';
    for (let s = 0; s < stems; s++) {
      const baseX = 100 + (s - (stems - 1) / 2) * 18;
      const baseY = 200;
      const topY = baseY - 50 - level * 8 - rng() * 12;
      const topX = baseX + (rng() - 0.5) * 12;
      const stemColor = wilting ? '#7A6E50' : '#3F8C3A';
      svg += `<path d="M ${baseX} ${baseY} Q ${baseX + (rng() - 0.5) * 8} ${(baseY + topY) / 2} ${topX} ${topY}" stroke="${stemColor}" stroke-width="2" fill="none" stroke-linecap="round" opacity="${opacity}"/>`;
      // ورقتان على الساق
      if (level >= 1) {
        svg += `<ellipse cx="${baseX + 5}" cy="${(baseY + topY) / 2}" rx="5" ry="2.5" fill="${stemColor}" opacity="${opacity * 0.7}" transform="rotate(30 ${baseX + 5} ${(baseY + topY) / 2})"/>`;
      }
      // الوردة نفسها
      if (level >= 2) {
        const roseColor = wilting ? '#9A4040' : '#C84A5B';
        const petals = 6;
        let petalsSvg = '';
        for (let p = 0; p < petals; p++) {
          const a = (p / petals) * Math.PI * 2;
          const px = topX + Math.cos(a) * 5;
          const py = topY + Math.sin(a) * 5;
          petalsSvg += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="5" ry="3" fill="${roseColor}" opacity="${opacity * 0.85}" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
        }
        svg += `<g>${petalsSvg}<circle cx="${topX}" cy="${topY}" r="3" fill="#FFE08A" opacity="${opacity}"/></g>`;
      } else {
        // برعم
        svg += `<ellipse cx="${topX}" cy="${topY}" rx="3" ry="5" fill="${wilting ? '#8A5050' : '#A04050'}" opacity="${opacity}"/>`;
      }
    }
    return `<svg viewBox="0 0 200 220" class="bustan-plant-svg" preserveAspectRatio="xMidYEnd meet">
      <ellipse cx="100" cy="205" rx="60" ry="8" fill="#B89868" opacity="0.6"/>
      ${svg}
    </svg>`;
  }

  // سنبلة الصلاة
  function renderWheat(level, wilting, opacity, rng) {
    const stalks = Math.min(15, 3 + level * 2);
    let svg = '';
    for (let s = 0; s < stalks; s++) {
      const baseX = 100 + (s - (stalks - 1) / 2) * 8;
      const baseY = 200;
      const topY = baseY - 60 - level * 6 - rng() * 8;
      const topX = baseX + (rng() - 0.5) * 4;
      const stalkColor = wilting ? '#9A8850' : '#8FA040';
      svg += `<path d="M ${baseX} ${baseY} Q ${baseX} ${(baseY + topY) / 2} ${topX} ${topY}" stroke="${stalkColor}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="${opacity}"/>`;
      // حبّات السنبلة
      if (level >= 1) {
        const grains = 5 + level;
        for (let g = 0; g < grains; g++) {
          const gy = topY + g * 4;
          const side = g % 2 === 0 ? 1 : -1;
          const gx = topX + side * 2;
          const grainColor = wilting ? '#7A6A40' : (level >= 4 ? '#EAB95C' : '#C7902E');
          svg += `<ellipse cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" rx="2" ry="3" fill="${grainColor}" opacity="${opacity}" transform="rotate(${side * 30} ${gx.toFixed(1)} ${gy.toFixed(1)})"/>`;
        }
        // شعرة السنبلة
        svg += `<line x1="${topX}" y1="${topY}" x2="${topX + (rng() - 0.5) * 4}" y2="${topY - 6}" stroke="${stalkColor}" stroke-width="0.8" opacity="${opacity * 0.7}"/>`;
      }
    }
    return `<svg viewBox="0 0 200 220" class="bustan-plant-svg" preserveAspectRatio="xMidYEnd meet">
      <ellipse cx="100" cy="205" rx="60" ry="8" fill="#B89868" opacity="0.6"/>
      ${svg}
    </svg>`;
  }

  // عنب الذكر
  function renderGrape(level, wilting, opacity, rng) {
    const vines = Math.min(5, 1 + Math.floor(level / 1.5));
    let svg = '';
    // جذع الكرمة
    const trunkColor = wilting ? '#6B5040' : '#8B6F47';
    svg += `<path d="M 100 200 Q 95 160 100 110" stroke="${trunkColor}" stroke-width="3" fill="none" stroke-linecap="round" opacity="${opacity}"/>`;
    // أوراق الكرمة
    if (level >= 1) {
      const leaves = Math.min(8, 3 + level);
      for (let l = 0; l < leaves; l++) {
        const t = l / leaves;
        const lx = 100 + (rng() - 0.5) * 30 + (l % 2 === 0 ? 15 : -15);
        const ly = 130 + t * 40;
        const leafColor = wilting ? '#7A8A50' : '#5E8C3A';
        svg += `<path d="M ${lx} ${ly} Q ${lx + 12} ${ly - 8} ${lx + 18} ${ly} Q ${lx + 12} ${ly + 8} ${lx} ${ly}" fill="${leafColor}" opacity="${opacity * 0.85}"/>`;
      }
    }
    // عناقيد العنب
    if (level >= 2) {
      const grapeColor = wilting ? '#5A3050' : '#7B3F8C';
      const grapes = 8 + level * 4;
      const clusters = Math.min(vines, 3);
      for (let c = 0; c < clusters; c++) {
        const cx = 100 + (c - (clusters - 1) / 2) * 25;
        const cy = 110 + c * 8;
        for (let g = 0; g < grapes / clusters; g++) {
          const dx = cx + (rng() - 0.5) * 12;
          const dy = cy + (g * 4);
          svg += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="3" fill="${grapeColor}" opacity="${opacity}"/>`;
          // لمعة
          svg += `<circle cx="${(dx - 0.8).toFixed(1)}" cy="${(dy - 0.8).toFixed(1)}" r="0.8" fill="#FFFFFF" opacity="${opacity * 0.5}"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 200 220" class="bustan-plant-svg" preserveAspectRatio="xMidYEnd meet">
      <ellipse cx="100" cy="205" rx="50" ry="8" fill="#B89868" opacity="0.6"/>
      ${svg}
    </svg>`;
  }

  /* ════════════════════════════════════════════
      RENDER — الصفحة الكاملة
     ════════════════════════════════════════════ */
  function render() {
    const wrap = $('bustanWrap');
    if (!wrap) return;

    const data = S.get('bustan', S.DEFAULTS.bustan);
    data.plants = data.plants || S.DEFAULTS.bustan.plants;
    const gardenState = GARDEN_STATES[computeGardenState(data)] || GARDEN_STATES.fresh;
    const seed = getGardenSeed(data);

    // إحصائيات
    const totalCount = Object.values(data.plants).reduce((s, p) => s + (p.count || 0), 0);
    const todayDeeds = (data.history || {})[todayKey()] || { quran: 0, charity: 0, salah: 0, dhikr: 0 };
    const todayTotal = Object.values(todayDeeds).reduce((s, n) => s + n, 0);
    const longestStreak = Math.max(...Object.values(data.plants).map(p => p.streak || 0), 0);

    // حساب آخر نشاط
    const allDates = Object.values(data.plants).map(p => p.lastDate).filter(Boolean).sort();
    const lastActivity = allDates.length ? allDates.pop() : null;
    const daysInactive = daysSince(lastActivity);

    wrap.innerHTML = `
      <!-- بطاقة البستان الكبرى -->
      <div class="bustan-hero-card state-${gardenState.id}">
        <div class="bustan-hero-header">
          <div class="bustan-state-badge" style="background:${gardenState.color}">
            <span>${gardenState.icon}</span>
            <span>${gardenState.name}</span>
          </div>
          <div class="bustan-total-pts">
            <div class="bustan-total-num">${arabicDigits(totalCount)}</div>
            <div class="bustan-total-lbl">عملٌ صالح مزروع</div>
          </div>
        </div>
        <div class="bustan-state-desc">${gardenState.desc}</div>

        ${gardenState.id === 'dormant' ? `
          <div class="bustan-alert">
            🥀 بستانك في سكونٍ منذ ${arabicDigits(daysInactive)} ${daysInactive === 1 ? 'يوم' : 'أيام'}.
            <br>عُد ولو بـ"سبحان الله وبحمده" — تعود النضارة بإذن الله.
          </div>` : ''}
        ${gardenState.id === 'renewed' ? `
          <div class="bustan-renewed-msg">
            🌱 التوبة جدّدت بستانك. ﴿إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ﴾
          </div>` : ''}

        <!-- شبكة النباتات -->
        <div class="bustan-grid">
          ${Object.values(PLANTS).map(plant => {
            const p = data.plants[plant.id] || { count: 0, lastDate: null, streak: 0 };
            const stage = getPlantStage(p.count);
            const rng = mulberry32(seed + plant.id.charCodeAt(0));
            const plantSvg = renderPlantSVG(plant.id, p.count, gardenState.id, rng);
            const todayCount = todayDeeds[plant.id] || 0;
            return `
              <div class="bustan-plant-card ${todayCount > 0 ? 'on' : ''}">
                <div class="bustan-plant-svg-wrap">${plantSvg}</div>
                <div class="bustan-plant-name">${plant.icon} ${plant.name}</div>
                <div class="bustan-plant-stage">${stage.icon} ${stage.name}</div>
                <div class="bustan-plant-count">${arabicDigits(p.count)} مرة</div>
                ${p.streak > 1 ? `<div class="bustan-plant-streak">🔥 ${arabicDigits(p.streak)} يوم متتالي</div>` : ''}
                <div class="bustan-plant-actions">
                  <button class="btn btn-primary btn-sm bustan-add-btn" onclick="Bustan.addDeed('${plant.id}')">
                    + زرع
                  </button>
                  ${todayCount > 0 ? `<span class="bustan-today-tag">+${arabicDigits(todayCount)} اليوم</span>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>

        <div class="bustan-verse">
          ﴿أَلَمْ تَرَ كَيْفَ ضَرَبَ اللَّهُ مَثَلًا كَلِمَةً طَيِّبَةً كَشَجَرَةٍ طَيِّبَةٍ أَصْلُهَا ثَابِتٌ وَفَرْعُهَا فِي السَّمَاءِ﴾
        </div>
      </div>

      <!-- بطاقة سريعة: إحصائيات اليوم -->
      <div class="bustan-stats-card">
        <div class="bustan-stat-item">
          <div class="bustan-stat-num">${arabicDigits(todayTotal)}</div>
          <div class="bustan-stat-lbl">أعمال اليوم</div>
        </div>
        <div class="bustan-stat-sep"></div>
        <div class="bustan-stat-item">
          <div class="bustan-stat-num">${arabicDigits(longestStreak)}</div>
          <div class="bustan-stat-lbl">أطول سلسلة</div>
        </div>
        <div class="bustan-stat-sep"></div>
        <div class="bustan-stat-item">
          <div class="bustan-stat-num">${arabicDigits(Object.values(PLANTS).filter(p => (data.plants[p.id]?.count || 0) > 0).length)}/٤</div>
          <div class="bustan-stat-lbl">أنواع مزروعة</div>
        </div>
      </div>

      <!-- بطاقات الوصف التعليمية -->
      <div class="bustan-section">
        <h3 class="bustan-section-h">🌱 أنواع نباتات البستان</h3>
        <div class="bustan-info-grid">
          ${Object.values(PLANTS).map(p => `
            <div class="bustan-info-card" style="--plant-color:${p.color};--plant-accent:${p.accent}">
              <div class="bustan-info-icon">${p.icon}</div>
              <div class="bustan-info-body">
                <div class="bustan-info-name">${p.name}</div>
                <div class="bustan-info-desc">${p.desc}</div>
                <div class="bustan-info-verse">${p.verse}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- تذكير بحالة البستان -->
      <div class="bustan-reminder-card">
        <div class="bustan-reminder-icon">💧</div>
        <div class="bustan-reminder-body">
          <div class="bustan-reminder-title">البستان كائنٌ حيّ</div>
          <div class="bustan-reminder-text">
            الاستمرار يُنمي، والإهمال يُذبّل، والتوبة تُجدّد.
            ازرع كل يوم ولو سعفةً أو وردةً أو سنبلةً أو عنقوداً.
          </div>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      HOME MINI
     ════════════════════════════════════════════ */
  function renderHomeMini() {
    const wrap = $('homeBustanMini');
    if (!wrap) return;
    const data = S.get('bustan', S.DEFAULTS.bustan);
    data.plants = data.plants || S.DEFAULTS.bustan.plants;
    const gardenState = GARDEN_STATES[computeGardenState(data)] || GARDEN_STATES.fresh;
    const totalCount = Object.values(data.plants).reduce((s, p) => s + (p.count || 0), 0);
    const seed = getGardenSeed(data);

    // رسم أصغر — نخلة واحدة (الأكثر تطوراً)
    const plantsArr = Object.values(PLANTS);
    const topPlant = plantsArr
      .map(p => ({ p, count: data.plants[p.id]?.count || 0 }))
      .sort((a, b) => b.count - a.count)[0];
    const rng = mulberry32(seed);
    const previewSvg = topPlant.count > 0
      ? renderPlantSVG(topPlant.p.id, topPlant.count, gardenState.id, rng)
      : `<svg viewBox="0 0 200 220" class="bustan-plant-svg"><ellipse cx="100" cy="205" rx="50" ry="8" fill="#B89868" opacity="0.6"/><text x="100" y="120" text-anchor="middle" font-size="48">🌱</text></svg>`;

    wrap.innerHTML = `
      <div class="bustan-home-card state-${gardenState.id}" onclick="navTo('bustan')">
        <div class="bustan-home-svg">${previewSvg}</div>
        <div class="bustan-home-body">
          <div class="bustan-home-state">${gardenState.icon} ${gardenState.name}</div>
          <div class="bustan-home-count">${arabicDigits(totalCount)} عمل مزروع</div>
          <div class="bustan-home-cta">انقر لزيارة بستانك ←</div>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      PUBLIC API
     ════════════════════════════════════════════ */
  global.Bustan = {
    init: render,
    render,
    renderHomeMini,
    addDeed,
    renewGarden,
    PLANTS,
    GARDEN_STATES
  };

})(window);
