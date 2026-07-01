/* ============================================================
   KHALWA — DEEP FOCUS MODE (focus-mode.js)
   الخلوة العميقة: مؤقت بومودورو + خلفية صوتية (مطر، ضجيج أبيض،
   رياح، تلاوة هادئة) مُولّدة عبر Web Audio API بدون ملفات خارجية.
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
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /* ─────────── الأوضاع ─────────── */
  const PHASES = {
    work:      { name: 'تركيز',   icon: '🎯', color: '#155A3D', lbl: 'وقت التركيز' },
    break:     { name: 'راحة قصيرة', icon: '☕', color: '#C7902E', lbl: 'استراحة قصيرة' },
    longBreak: { name: 'راحة طويلة', icon: '🌿', color: '#1E9763', lbl: 'استراحة طويلة' }
  };

  /* ─────────── الأصوات البيئية ─────────── */
  const SOUNDS = [
    { id: 'rain',        name: 'صوت المطر',       icon: '🌧️' },
    { id: 'whitenoise',  name: 'ضجيج أبيض',       icon: '⚪' },
    { id: 'wind',        name: 'هواء / نسيم',     icon: '🍃' },
    { id: 'ocean',       name: 'أمواج البحر',     icon: '🌊' },
    { id: 'forest',      name: 'أصوات غابة',      icon: '🌳' },
    { id: 'silence',     name: 'صمت',             icon: '🔇' }
  ];

  /* ─────────── الحالة ─────────── */
  const state = {
    phase: 'work',
    cyclesDone: 0,
    remaining: 25 * 60,
    running: false,
    timer: null,
    endTime: null
  };

  function getSettings() {
    const data = S.get('focusMode', S.DEFAULTS.focusMode);
    return Object.assign({}, S.DEFAULTS.focusMode.settings, data.settings || {});
  }
  function setSettings(patch) {
    const data = S.get('focusMode', S.DEFAULTS.focusMode);
    data.settings = Object.assign({}, data.settings, patch);
    S.set('focusMode', data);
  }
  function getStats() {
    return S.get('focusMode', S.DEFAULTS.focusMode);
  }
  function saveStats(patch) {
    const data = S.get('focusMode', S.DEFAULTS.focusMode);
    const today = todayKey();
    if (data.todayDate !== today) {
      data.todayDate = today;
      data.todaySessions = 0;
    }
    Object.assign(data, patch);
    S.set('focusMode', data);
  }

  /* ─────────── محرك الصوت (Web Audio API) ─────────── */
  let audioCtx = null;
  let audioNodes = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
      } catch (e) {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function generateWhiteNoiseBuffer(ctx) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /* مطر: ضجيج أبيض مُرشَّح + قطرات متفرقة */
  function startRain(ctx, volume) {
    const noise = ctx.createBufferSource();
    noise.buffer = generateWhiteNoiseBuffer(ctx);
    noise.loop = true;

    // فلتر تمرير عالي لمحاكاة صوت المطر
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8000;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    noise.connect(hp).connect(lp).connect(gain).connect(ctx.destination);
    noise.start();

    // قطرات متفرقة
    const dropInterval = setInterval(() => {
      if (!audioNodes) return;
      const osc = ctx.createOscillator();
      const dg = ctx.createGain();
      osc.frequency.value = 800 + Math.random() * 1200;
      osc.type = 'sine';
      dg.gain.setValueAtTime(0, ctx.currentTime);
      dg.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.005);
      dg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(dg).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }, 180);

    return { stop: () => { try { noise.stop(); } catch(_){} clearInterval(dropInterval); } };
  }

  function startWhiteNoise(ctx, volume) {
    const noise = ctx.createBufferSource();
    noise.buffer = generateWhiteNoiseBuffer(ctx);
    noise.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.5;
    noise.connect(gain).connect(ctx.destination);
    noise.start();
    return { stop: () => { try { noise.stop(); } catch(_){} } };
  }

  function startWind(ctx, volume) {
    const noise = ctx.createBufferSource();
    noise.buffer = generateWhiteNoiseBuffer(ctx);
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.value = volume * 0.4;

    // LFO لتذبذب الصوت (نسيم متفاوت)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = volume * 0.2;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    noise.connect(lp).connect(gain).connect(ctx.destination);
    noise.start();

    return { stop: () => { try { noise.stop(); lfo.stop(); } catch(_){} } };
  }

  function startOcean(ctx, volume) {
    const noise = ctx.createBufferSource();
    noise.buffer = generateWhiteNoiseBuffer(ctx);
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;

    const gain = ctx.createGain();
    gain.gain.value = volume * 0.3;

    // LFO بطيء لمحاكاة تتابع الأمواج
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = volume * 0.35;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    noise.connect(lp).connect(gain).connect(ctx.destination);
    noise.start();

    return { stop: () => { try { noise.stop(); lfo.stop(); } catch(_){} } };
  }

  function startForest(ctx, volume) {
    // أصوات طيور متفرقة + خلفية نسيم خفيف
    const noise = ctx.createBufferSource();
    noise.buffer = generateWhiteNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.2;
    noise.connect(lp).connect(gain).connect(ctx.destination);
    noise.start();

    // أصوات طيور متفرقة
    const chirpInterval = setInterval(() => {
      if (!audioNodes) return;
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!audioNodes) return;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const startFreq = 1500 + Math.random() * 2500;
          osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, ctx.currentTime + 0.05);
          osc.frequency.exponentialRampToValueAtTime(startFreq * 0.8, ctx.currentTime + 0.15);
          osc.type = 'sine';
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(volume * 0.15, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.connect(g).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }, i * 80 + Math.random() * 200);
      }
    }, 2500);

    return { stop: () => { try { noise.stop(); } catch(_){} clearInterval(chirpInterval); } };
  }

  function startSound(soundId, volume) {
    stopSound();
    if (soundId === 'silence') return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      switch (soundId) {
        case 'rain':       audioNodes = startRain(ctx, volume); break;
        case 'whitenoise': audioNodes = startWhiteNoise(ctx, volume); break;
        case 'wind':       audioNodes = startWind(ctx, volume); break;
        case 'ocean':      audioNodes = startOcean(ctx, volume); break;
        case 'forest':     audioNodes = startForest(ctx, volume); break;
      }
    } catch (e) {
      console.warn('FocusMode sound start failed:', e);
    }
  }

  function stopSound() {
    if (audioNodes) {
      try { audioNodes.stop(); } catch(_) {}
      audioNodes = null;
    }
  }

  /* ─────────── المؤقت ─────────── */
  function getPhaseDuration(phase) {
    const s = getSettings();
    if (phase === 'work') return s.workMin * 60;
    if (phase === 'break') return s.breakMin * 60;
    if (phase === 'longBreak') return s.longBreakMin * 60;
    return 25 * 60;
  }

  function setPhase(phase, opts) {
    state.phase = phase;
    state.remaining = getPhaseDuration(phase);
    state.endTime = state.running ? Date.now() + state.remaining * 1000 : null;
    updateUI();
  }

  function start() {
    if (state.running) return;
    const settings = getSettings();
    state.running = true;
    state.endTime = Date.now() + state.remaining * 1000;

    // تشغيل الصوت
    if (settings.ambientSound !== 'silence') {
      startSound(settings.ambientSound, settings.volume);
    }

    // حظر الإشعارات (إن أمكن)
    if (settings.blockNotifications && 'Notification' in window && Notification.permission === 'granted') {
      // لا يمكن منع إشعارات أخرى فعلياً، لكن نُعلن حالة DND
      document.body.classList.add('focus-dnd');
    }

    state.timer = setInterval(tick, 250);
    updateUI();
  }

  function pause() {
    if (!state.running) return;
    state.running = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    state.remaining = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
    state.endTime = null;
    stopSound();
    document.body.classList.remove('focus-dnd');
    updateUI();
  }

  function reset() {
    pause();
    state.remaining = getPhaseDuration(state.phase);
    state.cyclesDone = 0;
    updateUI();
  }

  function tick() {
    if (!state.running) return;
    const now = Date.now();
    const diff = Math.max(0, Math.round((state.endTime - now) / 1000));
    state.remaining = diff;
    if (diff <= 0) {
      onPhaseComplete();
      return;
    }
    updateUI();
  }

  function onPhaseComplete() {
    pause();
    // إشعار صوتي بسيط
    playChime();

    if (state.phase === 'work') {
      state.cyclesDone++;
      const stats = getStats();
      saveStats({
        todaySessions: (stats.todaySessions || 0) + 1,
        totalSessions: (stats.totalSessions || 0) + 1,
        totalMinutes: (stats.totalMinutes || 0) + getSettings().workMin,
        lastSessionDate: new Date().toISOString()
      });

      const settings = getSettings();
      const isLongBreak = state.cyclesDone % settings.cyclesBeforeLongBreak === 0;
      if (global.KHALWA?.toast) {
        global.KHALWA.toast(`🎯 أحسنت! أكملت جلسة تركيز. خذ ${isLongBreak ? 'راحة طويلة' : 'راحة قصيرة'} تستحقها`, 'success', 4000);
      }
      setPhase(isLongBreak ? 'longBreak' : 'break');
      // ابدأ الراحة تلقائياً
      setTimeout(start, 800);
    } else {
      if (global.KHALWA?.toast) {
        global.KHALWA.toast('🌟 انتهت الراحة. هل أنت مستعد لجلسة تركيز جديدة؟', 'info', 3500);
      }
      setPhase('work');
    }
    updateUI();
  }

  function playChime() {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      // ثلاث نغمات متناغمة (D5, F#5, A5)
      [587.33, 739.99, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t0 = ctx.currentTime + i * 0.15;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.2, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 1.3);
      });
    } catch (_) {}
  }

  function skip() {
    onPhaseComplete();
  }

  /* ════════════════════════════════════════════
      RENDER — الصفحة الكاملة
     ════════════════════════════════════════════ */
  function render() {
    const wrap = $('focusWrap');
    if (!wrap) return;
    const settings = getSettings();
    const stats = getStats();
    const phase = PHASES[state.phase];

    wrap.innerHTML = `
      <div class="focus-container">
        <!-- المؤقت -->
        <div class="focus-timer-card" style="--phase-color:${phase.color}">
          <div class="focus-phase-badge">
            <span class="focus-phase-icon">${phase.icon}</span>
            <span>${phase.lbl}</span>
            <span class="focus-cycle-info">الجلسة ${arabicDigits(state.cyclesDone + 1)}</span>
          </div>

          <div class="focus-ring-wrap">
            <svg viewBox="0 0 220 220" class="focus-ring-svg">
              <circle cx="110" cy="110" r="100" fill="none" stroke="var(--c-border2)" stroke-width="8" opacity="0.25"/>
              <circle cx="110" cy="110" r="100" fill="none" stroke="var(--phase-color)" stroke-width="8"
                stroke-linecap="round" stroke-dasharray="628"
                stroke-dashoffset="${628 - (628 * (state.remaining / getPhaseDuration(state.phase)))}"
                transform="rotate(-90 110 110)" style="transition:stroke-dashoffset .4s linear"/>
            </svg>
            <div class="focus-time-display">
              <div class="focus-time-num" id="focusTimeNum">${fmtTime(state.remaining)}</div>
              <div class="focus-time-lbl">${state.running ? 'جارية...' : (state.remaining === getPhaseDuration(state.phase) ? 'اضغط للبدء' : 'متوقفة مؤقتاً')}</div>
            </div>
          </div>

          <div class="focus-controls">
            ${state.running ? `
              <button class="focus-ctrl-btn focus-ctrl-pause" onclick="FocusMode.pause()">
                <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                <span>إيقاف مؤقت</span>
              </button>` : `
              <button class="focus-ctrl-btn focus-ctrl-start" onclick="FocusMode.start()">
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                <span>ابدأ التركيز</span>
              </button>`}
            <button class="focus-ctrl-btn focus-ctrl-skip" onclick="FocusMode.skip()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              <span>تخطّي</span>
            </button>
            <button class="focus-ctrl-btn focus-ctrl-reset" onclick="FocusMode.reset()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              <span>إعادة</span>
            </button>
          </div>
        </div>

        <!-- الأصوات البيئية -->
        <div class="focus-sounds-card">
          <div class="focus-sounds-hd">
            <span class="focus-sounds-title">🎵 الخلفية الصوتية</span>
            ${state.running && settings.ambientSound !== 'silence'
              ? `<button class="focus-sound-stop" onclick="FocusMode.stopSound()">إيقاف الصوت</button>`
              : ''}
          </div>
          <div class="focus-sounds-grid">
            ${SOUNDS.map(s => `
              <button class="focus-sound-btn ${settings.ambientSound === s.id ? 'on' : ''}" data-sound="${s.id}" onclick="FocusMode.pickSound('${s.id}')">
                <span class="focus-sound-icon">${s.icon}</span>
                <span class="focus-sound-name">${s.name}</span>
              </button>
            `).join('')}
          </div>
          <div class="focus-volume-row">
            <span class="focus-volume-lbl">🔊 مستوى الصوت</span>
            <input type="range" id="focusVolume" min="0" max="1" step="0.05" value="${settings.volume}"
              oninput="FocusMode.setVolume(this.value)" style="flex:1"/>
            <span class="focus-volume-val" id="focusVolumeVal">${arabicDigits(Math.round(settings.volume * 100))}%</span>
          </div>
        </div>

        <!-- الإحصائيات -->
        <div class="focus-stats-card">
          <div class="focus-stats-hd">📊 إحصائياتك</div>
          <div class="focus-stats-grid">
            <div class="focus-stat">
              <div class="focus-stat-v">${arabicDigits(stats.todaySessions || 0)}</div>
              <div class="focus-stat-l">جلسة اليوم</div>
            </div>
            <div class="focus-stat">
              <div class="focus-stat-v">${arabicDigits(stats.totalSessions || 0)}</div>
              <div class="focus-stat-l">جلسة كلية</div>
            </div>
            <div class="focus-stat">
              <div class="focus-stat-v">${arabicDigits(Math.floor((stats.totalMinutes || 0) / 60))}</div>
              <div class="focus-stat-l">ساعة تركيز</div>
            </div>
            <div class="focus-stat">
              <div class="focus-stat-v">${arabicDigits((stats.totalMinutes || 0) % 60)}</div>
              <div class="focus-stat-l">دقيقة إضافية</div>
            </div>
          </div>
        </div>

        <!-- الإعدادات -->
        <div class="focus-settings-card">
          <div class="focus-settings-hd">⚙️ إعدادات الجلسة</div>
          <div class="focus-set-row">
            <label>مدة التركيز</label>
            <div class="focus-set-inputs">
              <input type="number" id="focusWorkMin" value="${settings.workMin}" min="5" max="90"/>
              <span>دقيقة</span>
            </div>
          </div>
          <div class="focus-set-row">
            <label>راحة قصيرة</label>
            <div class="focus-set-inputs">
              <input type="number" id="focusBreakMin" value="${settings.breakMin}" min="1" max="30"/>
              <span>دقيقة</span>
            </div>
          </div>
          <div class="focus-set-row">
            <label>راحة طويلة</label>
            <div class="focus-set-inputs">
              <input type="number" id="focusLongBreakMin" value="${settings.longBreakMin}" min="5" max="60"/>
              <span>دقيقة</span>
            </div>
          </div>
          <div class="focus-set-row">
            <label>عدد الجلسات قبل الراحة الطويلة</label>
            <div class="focus-set-inputs">
              <input type="number" id="focusCyclesBeforeLong" value="${settings.cyclesBeforeLongBreak}" min="2" max="8"/>
              <span>جلسات</span>
            </div>
          </div>
          <label class="focus-toggle-row">
            <input type="checkbox" id="focusBlockNotif" ${settings.blockNotifications ? 'checked' : ''}/>
            <span>🤫 حظر الإشعارات أثناء التركيز</span>
          </label>
          <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="FocusMode.saveSettings()">حفظ الإعدادات</button>
        </div>

        <!-- نصيحة -->
        <div class="focus-tip-card">
          <div class="focus-tip-icon">💡</div>
          <div class="focus-tip-body">
            <strong>نصيحة الخلوة:</strong> أغلق التطبيقات المشتتة، ضع هاتفك على الوضع الصامت، واجلس في مكان هادئ. قال ابن القيم: «إذا أراد الله بالعبد خيراً فتح له باب الانقطاع إليه».
          </div>
        </div>
      </div>
    `;
  }

  function updateUI() {
    if (!$('focusWrap')) return;
    // تحديث سريع للوقت بدلاً من إعادة العرض كاملاً
    const num = $('focusTimeNum');
    if (num) num.textContent = fmtTime(state.remaining);
    const ring = document.querySelector('.focus-ring-svg circle:nth-child(2)');
    if (ring) {
      const dur = getPhaseDuration(state.phase);
      const offset = 628 - (628 * (state.remaining / dur));
      ring.setAttribute('stroke-dashoffset', offset);
    }
    // إذا تغيّرت الحالة (running ↔ paused) نعيد العرض
    const startBtn = document.querySelector('.focus-ctrl-start');
    const pauseBtn = document.querySelector('.focus-ctrl-pause');
    if (state.running && !pauseBtn) render();
    if (!state.running && !startBtn && state.remaining < getPhaseDuration(state.phase)) render();
  }

  /* ─────────── الإجراءات ─────────── */
  function pickSound(id) {
    setSettings({ ambientSound: id });
    const settings = getSettings();
    if (state.running && id !== 'silence') {
      startSound(id, settings.volume);
    } else if (id === 'silence') {
      stopSound();
    }
    render();
  }

  function setVolume(v) {
    v = parseFloat(v) || 0;
    setSettings({ volume: v });
    const valEl = $('focusVolumeVal');
    if (valEl) valEl.textContent = arabicDigits(Math.round(v * 100)) + '%';
    // إعادة تشغيل الصوت بالصوت الجديد إن كان يعمل
    const settings = getSettings();
    if (state.running && settings.ambientSound !== 'silence') {
      startSound(settings.ambientSound, v);
    }
  }

  function saveSettings() {
    const patch = {
      workMin: Math.max(5, Math.min(90, parseInt($('focusWorkMin').value, 10) || 25)),
      breakMin: Math.max(1, Math.min(30, parseInt($('focusBreakMin').value, 10) || 5)),
      longBreakMin: Math.max(5, Math.min(60, parseInt($('focusLongBreakMin').value, 10) || 15)),
      cyclesBeforeLongBreak: Math.max(2, Math.min(8, parseInt($('focusCyclesBeforeLong').value, 10) || 4)),
      blockNotifications: $('focusBlockNotif').checked
    };
    setSettings(patch);
    if (!state.running) state.remaining = getPhaseDuration(state.phase);
    if (global.KHALWA?.toast) global.KHALWA.toast('تم حفظ الإعدادات', 'success');
    render();
  }

  function requestNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }

  /* ─────────── عند مغادرة الصفحة ─────────── */
  function onLeave() {
    if (state.running) pause();
    stopSound();
    document.body.classList.remove('focus-dnd');
  }

  /* ════════════════════════════════════════════
      HOME MINI
     ════════════════════════════════════════════ */
  function renderHomeMini() {
    const wrap = $('homeFocusMini');
    if (!wrap) return;
    const stats = getStats();
    wrap.innerHTML = `
      <div class="focus-home-card" onclick="navTo('focus')">
        <div class="focus-home-icon">🎯</div>
        <div class="focus-home-body">
          <div class="focus-home-title">الخلوة العميقة</div>
          <div class="focus-home-desc">مؤقت بومودورو + أصوات بيئية مريحة</div>
          <div class="focus-home-stats">
            <span>📊 ${arabicDigits(stats.todaySessions || 0)} جلسة اليوم</span>
            <span>⏱️ ${arabicDigits(Math.floor((stats.totalMinutes || 0) / 60))} س كلية</span>
          </div>
        </div>
        <span class="focus-home-arrow">‹</span>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
      PUBLIC API
     ════════════════════════════════════════════ */
  global.FocusMode = {
    init: render,
    render,
    renderHomeMini,
    start,
    pause,
    reset,
    skip,
    pickSound,
    setVolume,
    saveSettings,
    stopSound,
    onLeave,
    requestNotificationPermission,
    PHASES,
    SOUNDS
  };

})(window);
