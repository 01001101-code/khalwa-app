/* ============================================================
   KHALWA — إذاعة القرآن الكريم المباشرة (quran-radio.js) v3.0
   بث مباشر حقيقي لإذاعة القرآن الكريم المصرية (ماسبيرو) — FM 98.2
   - إذاعة الحرمين الشريفين تمت إزالتها بناءً على طلب المستخدم
   - الإذاعة معروضة مباشرة في الواجهة الرئيسية لسهولة الوصول
   - دعم HTML5 Audio + تبديل تلقائي بين عدة مصادر بث
   - يعمل على جميع المتصفحات (Chrome, Safari, Firefox, Edge, iOS, Android)
   - تحديث ديناميكي لاسم الإذاعة الحالية والمستوى الصوتي
   ============================================================ */
(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // قائمة الإذاعات — إذاعة واحدة فقط بناءً على طلب المستخدم
  // المصدر الأساسي: stream.radiojar.com (نفس المصدر المُعتمد
  // والمؤكَّد من الموقع الرسمي mp3quran.net API ومن makkahlive.net)
  //   - مصر (ماسبيرو) FM 98.2 : https://stream.radiojar.com/8s5u5tpdtwzuv
  // المصادر الاحتياطية: backup.qurango.net (تلاوات قرّاء بصوت مباشر)
  // ──────────────────────────────────────────────────────────
  const RADIO_STATIONS = [
    {
      id: 'quran_egypt',
      name: 'إذاعة القرآن الكريم المصرية - FM 98.2',
      short: 'القرآن الكريم - مصر FM 98.2',
      icon: '🎙️',
      country: 'مصر',
      // البث الرسمي لإذاعة القرآن الكريم المصرية (ماسبيرو) — هذا هو نفس
      // الرابط المؤكَّد من makkahlive.net ومواقع البث العربية المتخصصة
      streams: [
        'https://stream.radiojar.com/8s5u5tpdtwzuv',                          // البث الرسمي HTTPS
        'http://stream.radiojar.com/8s5u5tpdtwzuv',                          // نسخة HTTP بديلة (تُستخدم فقط لو الصفحة نفسها http/file)
        'https://backup.qurango.net/radio/mahmoud_khalil_alhussary',          // محمود خليل الحصري
        'https://backup.qurango.net/radio/abdulbasit_abdulsamad',             // عبدالباسط عبدالصمد
        'https://backup.qurango.net/radio/mustafa_ismail'                     // مصطفى إسماعيل
      ],
      desc: 'البث الرسمي لإذاعة القرآن الكريم المصرية (ماسبيرو) FM 98.2 من القاهرة — تلاوات كبار قرّاء مصر: عبدالباسط، الحصري، المنشاوي، مصطفى إسماعيل'
    }
  ];

  // ──────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────
  const state = {
    audio: null,
    hls: null,
    currentStationId: null,
    isPlaying: false,
    isLoading: false,
    volume: 1.0,
    hlsSupported: typeof Hls !== 'undefined',
    attemptId: 0 // يمنع تضارب المحاولات المتزامنة (سباق) عند تبديل المصادر بسرعة على الهاتف
  };

  // ──────────────────────────────────────────────────────────
  // فلترة المصادر بحسب بروتوكول الصفحة الحالية: على صفحة HTTPS لا فائدة
  // أبداً من تجربة مصدر http:// عادي لأن المتصفح يحظره فوراً (Mixed
  // Content) — تجربته فقط تُضيّع وقتاً قبل الانتقال للمصدر الصحيح،
  // وهذا التأخير يكون أوضح على شبكة الهاتف الأبطأ من شبكة اللابتوب
  function getUsableStreams(station) {
    const isSecurePage = global.location && global.location.protocol === 'https:';
    if (!isSecurePage) return station.streams;
    return station.streams.filter(function (url) {
      return url.indexOf('http://') !== 0;
    });
  }

  // ──────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────
  function findStation(id) {
    return RADIO_STATIONS.find(s => s.id === id);
  }

  function destroyHls() {
    if (state.hls) {
      try { state.hls.destroy(); } catch (e) {}
      state.hls = null;
    }
  }

  function stopAudio() {
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.src = '';
        state.audio.load();
      } catch (e) {}
    }
    destroyHls();
    state.isPlaying = false;
    state.isLoading = false;
  }

  // ──────────────────────────────────────────────────────────
  // PLAY A STATION — يجرب كل المصادر بالتتابع حتى يعمل أحدها
  // ──────────────────────────────────────────────────────────
  function playStation(stationId) {
    const station = findStation(stationId);
    if (!station) {
      if (global.KHALWA && global.KHALWA.toast) {
        global.KHALWA.toast('الإذاعة غير متوفرة', 'error');
      }
      return false;
    }

    // Stop any current playback
    stopAudio();

    state.currentStationId = stationId;
    state.isLoading = true;
    state.streamIdx = 0; // ابدأ بأول مصدر
    state.attemptId += 1; // محاولة جديدة — أي نداء متأخر من محاولة سابقة (مصدر/إذاعة سابقة) يُتجاهل تلقائياً
    const myAttempt = state.attemptId;
    updateUI();

    // Create audio element if not yet
    if (!state.audio) {
      state.audio = new Audio();
      state.audio.preload = 'auto';
      // Note: not setting crossOrigin — most radio servers don't return CORS headers
      // and audio playback works fine without it for HTML5 Audio.

      state.audio.addEventListener('playing', function() {
        state.isPlaying = true;
        state.isLoading = false;
        updateUI();
      });

      state.audio.addEventListener('waiting', function() {
        state.isLoading = true;
        updateUI();
      });

      state.audio.addEventListener('canplay', function() {
        // Stream is ready — start playing if not already
        if (!state.isPlaying && state.currentStationId) {
          state.audio.play().catch(function(){ /* handled by error */ });
        }
      });

      state.audio.addEventListener('pause', function() {
        // فقط نُحدث الحالة إذا لم نكن في وسط محاولة مصدر جديد
        if (!state.switchingStream) {
          state.isPlaying = false;
          state.isLoading = false;
          updateUI();
        }
      });

      state.audio.addEventListener('error', function(e) {
        console.warn('Radio audio error on stream #' + state.streamIdx + ':', e);
        // جرّب المصدر التالي (لنفس المحاولة الحالية فقط)
        tryNextStream(station, state.attemptId);
      });

      state.audio.addEventListener('stalled', function() {
        state.isLoading = true;
        updateUI();
      });
    }

    state.audio.volume = state.volume;

    if (global.KHALWA && global.KHALWA.toast) {
      global.KHALWA.toast('📻 جاري تشغيل: ' + station.short, 'info', 3000);
    }

    // ابدأ تشغيل أول مصدر
    tryStream(station, 0, myAttempt);
    return true;
  }

  /** جرّب مصدراً محدداً من قائمة المصادر */
  function tryStream(station, idx, attemptId) {
    if (typeof attemptId !== 'number') attemptId = state.attemptId;
    const streams = getUsableStreams(station);
    if (!station || !streams.length) return;
    if (idx >= streams.length) {
      // نفدت كل المصادر
      if (state.attemptId !== attemptId) return; // محاولة قديمة، تم تجاوزها
      state.isLoading = false;
      state.isPlaying = false;
      state.switchingStream = false;
      clearTimeout(state._streamTimeout);
      if (global.KHALWA && global.KHALWA.toast) {
        global.KHALWA.toast('تعذّر تشغيل البث لهذه الإذاعة — تحقق من الإنترنت وحاول مرة أخرى', 'warning', 4000);
      }
      updateUI();
      return;
    }
    state.streamIdx = idx;
    state.switchingStream = true;
    state.isLoading = true;
    updateUI();

    const url = streams[idx];
    console.log('📻 Trying stream #' + idx + ' (' + station.short + '):', url);

    try {
      // Clear any previous source first
      state.audio.removeAttribute('src');
      state.audio.src = url;
      state.audio.load();

      // Some browsers require explicit play() call after setting src
      const p = state.audio.play();
      if (p && typeof p.catch === 'function') {
        p.then(function() {
          if (state.attemptId !== attemptId) return; // محاولة قديمة، تم تجاوزها
          // نجح التشغيل
          state.switchingStream = false;
          state.isLoading = false;
          state.isPlaying = true;
          clearTimeout(state._streamTimeout);
          console.log('✅ Stream #' + idx + ' is playing:', url);
          updateUI();
        }).catch(function(err) {
          if (state.attemptId !== attemptId) return; // محاولة قديمة، تم تجاوزها
          console.warn('⚠️ Stream #' + idx + ' play() rejected:', err.name || err.message);
          // جرّب المصدر التالي بدون أي تأخير (التأخير يبطّئ التبديل خصوصاً على الهاتف)
          if (state.currentStationId === station.id) tryNextStream(station, attemptId);
        });
      } else {
        state.switchingStream = false;
      }
    } catch (e) {
      console.warn('⚠️ Exception trying stream #' + idx + ':', e);
      tryNextStream(station, attemptId);
    }

    // مهلة أمان: إذا لم يبدأ التشغيل خلال 8 ثوان، جرّب المصدر التالي
    // (مهلة أقصر من السابق لتسريع التبديل بين المصادر، فهذا مهم خصوصاً
    // على شبكة الهاتف حيث الانتظار الطويل يبدو كأن الراديو "لا يعمل")
    clearTimeout(state._streamTimeout);
    state._streamTimeout = setTimeout(function() {
      if (state.attemptId !== attemptId) return; // محاولة قديمة، تم تجاوزها
      if (state.isLoading && state.currentStationId === station.id) {
        console.warn('⏰ Stream #' + idx + ' timeout (8s) — trying next');
        tryNextStream(station, attemptId);
      }
    }, 8000);
  }

  /** انتقل إلى المصدر التالي */
  function tryNextStream(station, attemptId) {
    if (typeof attemptId !== 'number') attemptId = state.attemptId;
    if (state.attemptId !== attemptId) return; // محاولة قديمة، تم تجاوزها
    if (!station) return;
    const streams = getUsableStreams(station);
    const nextIdx = (state.streamIdx || 0) + 1;
    if (nextIdx < streams.length) {
      console.log('Falling back to stream #' + nextIdx);
      tryStream(station, nextIdx, attemptId);
    } else {
      // نفدت كل المصادر
      clearTimeout(state._streamTimeout);
      state.switchingStream = false;
      state.isLoading = false;
      state.isPlaying = false;
      if (global.KHALWA && global.KHALWA.toast) {
        global.KHALWA.toast('تعذّر تشغيل البث لهذه الإذاعة — حاول إذاعة أخرى', 'warning', 4000);
      }
      updateUI();
    }
  }

  function tryHls(station) {
    // لم نعد نستخدم HLS منفصل — المصادر المتعددة في القائمة تكفي
    tryNextStream(station);
  }

  // ──────────────────────────────────────────────────────────
  // TOGGLE PLAY/PAUSE
  // ──────────────────────────────────────────────────────────
  function togglePlay() {
    if (!state.currentStationId) {
      // Play first station by default
      if (RADIO_STATIONS.length) playStation(RADIO_STATIONS[0].id);
      return;
    }
    if (state.isPlaying) {
      if (state.audio) state.audio.pause();
    } else {
      if (state.audio) {
        state.isLoading = true;
        updateUI();
        const p = state.audio.play();
        if (p && p.catch) p.catch(function(){ state.isLoading = false; updateUI(); });
      }
    }
  }

  function stop() {
    stopAudio();
    state.currentStationId = null;
    updateUI();
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    if (state.audio) state.audio.volume = state.volume;
    updateVolumeUI();
  }

  // ──────────────────────────────────────────────────────────
  // UI UPDATE
  // ──────────────────────────────────────────────────────────
  function updateUI() {
    const station = state.currentStationId ? findStation(state.currentStationId) : null;

    // Now playing card
    const npIcon = document.getElementById('radioNpIcon');
    const npName = document.getElementById('radioNpName');
    const npCountry = document.getElementById('radioNpCountry');
    const npStatus = document.getElementById('radioNpStatus');
    const playBtn = document.getElementById('radioPlayBtn');
    const playBtnIcon = document.getElementById('radioPlayBtnIcon');
    const stopBtn = document.getElementById('radioStopBtn');
    const vizBars = document.querySelectorAll('.radio-viz-bar');

    if (npIcon && station) npIcon.textContent = station.icon;
    if (npName) npName.textContent = station ? station.name : 'لم يتم اختيار إذاعة';
    if (npCountry) npCountry.textContent = station ? (station.country + ' — ' + station.desc) : 'اختر إذاعة من القائمة لبدء الاستماع';

    let statusText = 'متوقف';
    if (state.isLoading) statusText = '⏳ جاري الاتصال بالبث...';
    else if (state.isPlaying) statusText = '🔴 على الهواء الآن';
    if (npStatus) npStatus.textContent = statusText;

    if (playBtnIcon) {
      if (state.isLoading) {
        playBtnIcon.innerHTML = '<div class="radio-spinner"></div>';
      } else if (state.isPlaying) {
        playBtnIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      } else {
        playBtnIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      }
    }

    if (stopBtn) stopBtn.style.display = (station || state.isPlaying) ? 'flex' : 'none';

    // Visualizer animation
    if (vizBars.length) {
      vizBars.forEach(b => b.style.animationPlayState = state.isPlaying ? 'running' : 'paused');
    }

    // Station list — highlight current
    document.querySelectorAll('.radio-station-card').forEach(card => {
      const id = card.getAttribute('data-station-id');
      card.classList.toggle('playing', id === state.currentStationId && state.isPlaying);
      card.classList.toggle('current', id === state.currentStationId);
    });
  }

  function updateVolumeUI() {
    const volSlider = document.getElementById('radioVolSlider');
    if (volSlider) volSlider.value = state.volume * 100;
  }

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  function render() {
    // عرض الراديو مباشرة في الواجهة الرئيسية
    const wrap = document.getElementById('homeRadioWidget') || document.getElementById('radioWrap');
    if (!wrap) return;

    const station = RADIO_STATIONS[0]; // إذاعة واحدة فقط
    const usableCount = getUsableStreams(station).length;
    let html = '';

    // Now Playing Card — تصميم مدمج للواجهة الرئيسية
    html += `
      <div class="radio-now-playing">
        <div class="radio-np-icon" id="radioNpIcon">${station.icon}</div>
        <div class="radio-np-info">
          <div class="radio-np-name" id="radioNpName">${station.name}</div>
          <div class="radio-np-country" id="radioNpCountry">${station.desc}</div>
          <div class="radio-np-status" id="radioNpStatus">متوقف</div>
        </div>
        <div class="radio-viz">
          <div class="radio-viz-bar"></div>
          <div class="radio-viz-bar"></div>
          <div class="radio-viz-bar"></div>
          <div class="radio-viz-bar"></div>
          <div class="radio-viz-bar"></div>
        </div>
      </div>

      <div class="radio-controls">
        <button class="radio-play-btn" id="radioPlayBtn" onclick="QuranRadio.togglePlay()" aria-label="تشغيل/إيقاف">
          <span id="radioPlayBtnIcon"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
        </button>
        <button class="radio-stop-btn" id="radioStopBtn" onclick="QuranRadio.stop()" aria-label="إيقاف" style="display:none">
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
        <div class="radio-vol-wrap">
          <svg class="radio-vol-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <input type="range" min="0" max="100" value="100" id="radioVolSlider" class="radio-vol-slider" oninput="QuranRadio.setVolume(this.value/100)" aria-label="مستوى الصوت"/>
        </div>
      </div>

      <div style="margin-top:12px;padding:10px 14px;background:var(--c-primary-bg);border-radius:var(--r12);font-size:12px;color:var(--tx2);line-height:1.7">
        📡 <strong style="color:var(--c-primary)">بث مباشر حقيقي ٢٤/٧:</strong> إذاعة القرآن الكريم المصرية (ماسبيرو) FM 98.2 تبث مباشرة من القاهرة. يجرّب التطبيق عدة مصادر بث تلقائياً حتى يجد عاملاً.
      </div>
      <div style="margin-top:8px;padding:10px 14px;background:var(--surface2);border-radius:var(--r12);font-size:11px;color:var(--tx3);line-height:1.7">
        🔧 <strong>ملاحظة:</strong> إذا لم يعمل البث المباشر، سيلجأ التطبيق تلقائياً إلى مصادر بديلة (تلاوات من كبار القرّاء). تأكد من اتصال إنترنت مستقر.
      </div>
    `;

    wrap.innerHTML = html;
    // لا نشغّل تلقائياً — المستخدم يضغط زر التشغيل بنفسه
    // لكن لو كانت الإذاعة تعمل من قبل، نُحدث الواجهة فقط
    if (state.currentStationId) {
      updateUI();
    }
  }

  // ──────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────
  global.QuranRadio = {
    init: render,
    render,
    playStation,
    togglePlay,
    stop,
    setVolume,
    getStations: function() { return RADIO_STATIONS.slice(); },
    getCurrentStation: function() { return state.currentStationId ? findStation(state.currentStationId) : null; },
    isPlaying: function() { return state.isPlaying; }
  };

})(window);
