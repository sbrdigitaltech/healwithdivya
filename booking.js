/* =====================================================================
   Booking panel — two-step slot picker with an optional voice note.
   No backend: the confirmed state hands the details off to WhatsApp.
   ===================================================================== */
(function () {
  'use strict';

  var WHATSAPP_NUMBER = '919871386099';

  /* Consulting hours, keyed by weekday (1 = Mon … 6 = Sat). */
  var SLOTS_BY_WEEKDAY = {
    1: ['8:00 am', '9:00 am', '10:00 am', '5:30 pm', '6:30 pm', '7:30 pm'],
    2: ['8:00 am', '10:00 am', '6:30 pm', '7:30 pm'],
    3: ['9:00 am', '10:00 am', '5:30 pm', '6:30 pm', '7:30 pm'],
    4: ['8:00 am', '9:00 am', '6:30 pm'],
    5: ['8:00 am', '9:00 am', '10:00 am', '5:30 pm', '7:30 pm'],
    6: ['8:00 am', '9:00 am', '10:00 am']
  };

  var CONCERNS = ['Neck', 'Low back', 'Knee', 'Shoulder', 'Sports injury', 'Post-surgery', 'Something else'];

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* The next six consulting days (Mon–Sat), starting tomorrow. */
  function upcomingDays() {
    var out = [];
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    while (out.length < 6) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0) continue; // closed Sunday
      out.push({
        dow: DOW[d.getDay()],
        date: d.getDate() + ' ' + MONTH[d.getMonth()],
        weekday: d.getDay()
      });
    }
    return out;
  }

  var days = upcomingDays();
  var state = { step: 1, day: 0, slot: null, concern: null, hasAudio: false };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    wizard: $('wizard'), step1: $('step1'), step2: $('step2'), confirmed: $('confirmed'),
    days: $('days'), slots: $('slots'), concerns: $('concerns'),
    toStep2: $('toStep2'), backToStep1: $('backToStep1'), confirmBtn: $('confirmBtn'),
    slotSummary: $('slotSummary'), bookedSummary: $('bookedSummary'), concernSummary: $('concernSummary'),
    nameField: $('nameField'), noteField: $('noteField'),
    recBtn: $('recBtn'), recIcon: $('recIcon'), recTitle: $('recTitle'), recHint: $('recHint'),
    recPlayback: $('recPlayback'),
    whatsappBtn: $('whatsappBtn'), resetBtn: $('resetBtn'),
    stepBars: document.querySelectorAll('[data-step-bar]')
  };

  /* ---------------------------------------------------------------- days */
  function renderDays() {
    els.days.innerHTML = '';
    days.forEach(function (d, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.setAttribute('aria-pressed', String(state.day === i));
      b.innerHTML = '<span class="day__dow">' + d.dow + '</span><span class="day__date">' + d.date + '</span>';
      b.addEventListener('click', function () {
        state.day = i;
        state.slot = null;
        renderDays();
        renderSlots();
        syncContinue();
      });
      els.days.appendChild(b);
    });
  }

  function renderSlots() {
    els.slots.innerHTML = '';
    var list = SLOTS_BY_WEEKDAY[days[state.day].weekday] || [];
    list.forEach(function (label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(state.slot === label));
      b.addEventListener('click', function () {
        state.slot = label;
        renderSlots();
        syncContinue();
      });
      els.slots.appendChild(b);
    });
  }

  function syncContinue() { els.toStep2.disabled = !state.slot; }

  /* ------------------------------------------------------------ concerns */
  function renderConcerns() {
    els.concerns.innerHTML = '';
    CONCERNS.forEach(function (label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(state.concern === label));
      b.addEventListener('click', function () {
        state.concern = state.concern === label ? null : label;
        renderConcerns();
      });
      els.concerns.appendChild(b);
    });
  }

  /* ---------------------------------------------------------------- steps */
  function showStep(n) {
    state.step = n;
    els.step1.hidden = n !== 1;
    els.step2.hidden = n !== 2;
    Array.prototype.forEach.call(els.stepBars, function (bar) {
      bar.classList.toggle('is-on', n >= Number(bar.getAttribute('data-step-bar')));
    });
    if (n === 2) els.slotSummary.textContent = slotLine();
  }

  function slotLine() { return days[state.day].date + ' · ' + (state.slot || '') + ' IST'; }

  /* ------------------------------------------------------------ recording */
  var rec = null, stream = null, chunks = [], timer = null, secs = 0, recording = false, micDenied = false;

  function mmss(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  function paintRecorder() {
    els.recBtn.classList.toggle('is-recording', recording);
    els.recIcon.textContent = recording ? 'stop' : 'mic';
    els.recBtn.setAttribute('aria-label', recording ? 'Stop recording' : 'Record a voice note');
    if (recording) {
      els.recTitle.innerHTML = '<span class="recorder__dot"></span>Recording ' + mmss(secs);
      els.recHint.textContent = 'Tap to stop';
    } else {
      els.recTitle.textContent = state.hasAudio ? 'Voice note ready' : 'Record a voice note';
      els.recHint.textContent = micDenied
        ? 'Mic blocked — type your note instead'
        : '20 seconds is plenty. Optional.';
    }
  }

  els.recBtn.addEventListener('click', function () {
    if (recording) {
      if (rec) rec.stop();
      clearInterval(timer);
      recording = false;
      paintRecorder();
      return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      micDenied = true;
      paintRecorder();
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      chunks = [];
      rec = new MediaRecorder(s);
      rec.ondataavailable = function (e) { chunks.push(e.data); };
      rec.onstop = function () {
        els.recPlayback.src = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
        els.recPlayback.hidden = false;
        state.hasAudio = true;
        stream.getTracks().forEach(function (t) { t.stop(); });
        paintRecorder();
      };
      rec.start();
      recording = true;
      micDenied = false;
      secs = 0;
      state.hasAudio = false;
      els.recPlayback.hidden = true;
      paintRecorder();
      timer = setInterval(function () { secs += 1; paintRecorder(); }, 1000);
    }).catch(function () {
      micDenied = true;
      paintRecorder();
    });
  });

  /* ------------------------------------------------------------- controls */
  els.nameField.addEventListener('input', function () {
    els.confirmBtn.disabled = !els.nameField.value.trim();
  });

  els.toStep2.addEventListener('click', function () { showStep(2); });
  els.backToStep1.addEventListener('click', function () { showStep(1); });

  els.confirmBtn.addEventListener('click', function () {
    var name = els.nameField.value.trim();
    var note = els.noteField.value.trim();
    var concern = state.concern || 'Assessment';

    els.bookedSummary.textContent = name + ' — ' + slotLine() + '. Confirmation on WhatsApp.';
    els.concernSummary.textContent = concern + (state.hasAudio ? ' · voice note recorded' : '');

    var msg = 'Hi Divya, I would like to book a consultation.\n\n'
      + 'Name: ' + name + '\n'
      + 'Slot: ' + slotLine() + '\n'
      + 'Concern: ' + concern
      + (note ? '\nDetails: ' + note : '')
      + (state.hasAudio ? '\n(I recorded a voice note — sending it here next.)' : '');
    els.whatsappBtn.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);

    els.wizard.hidden = true;
    els.confirmed.hidden = false;
  });

  els.resetBtn.addEventListener('click', function () {
    state = { step: 1, day: 0, slot: null, concern: null, hasAudio: false };
    els.nameField.value = '';
    els.noteField.value = '';
    els.confirmBtn.disabled = true;
    els.recPlayback.hidden = true;
    els.recPlayback.removeAttribute('src');
    secs = 0;
    paintRecorder();
    renderDays();
    renderSlots();
    renderConcerns();
    syncContinue();
    showStep(1);
    els.confirmed.hidden = true;
    els.wizard.hidden = false;
  });

  window.addEventListener('pagehide', function () {
    clearInterval(timer);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
  });

  /* ----------------------------------------------------------------- init */
  renderDays();
  renderSlots();
  renderConcerns();
  syncContinue();
  paintRecorder();
  showStep(1);
})();
