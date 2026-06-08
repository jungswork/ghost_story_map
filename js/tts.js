// ── TTS 語音朗讀模組 ──
let ttsState        = 'idle';
let ttsUtterance    = null;
let ttsCurrentStory = null;
let ttsResumeTimer  = null;
let ttsVoices       = [];

function isTTSSupported() { return 'speechSynthesis' in window; }

function _loadVoices() { ttsVoices = speechSynthesis.getVoices(); }
if (isTTSSupported()) {
  speechSynthesis.addEventListener('voiceschanged', _loadVoices);
  _loadVoices();
}

function speakStory(s) {
  if (!isTTSSupported()) return;
  _cancelSpeech();
  ttsCurrentStory = s;
  const text = `${s.title}。${s.summary}。${s.content.replace(/\n+/g, '。')}`;
  ttsUtterance         = new SpeechSynthesisUtterance(text);
  ttsUtterance.lang    = 'zh-TW';
  ttsUtterance.rate    = 0.75;
  ttsUtterance.pitch   = 0.5;
  ttsUtterance.volume  = 1.0;
  ttsUtterance.voice =
    ttsVoices.find(v => v.name === 'Microsoft Yating - Chinese (Traditional, Taiwan)') ||
    ttsVoices.find(v => v.name === 'Meijia') ||
    ttsVoices.find(v => v.lang === 'zh-TW') ||
    ttsVoices.find(v => v.lang.startsWith('zh')) || null;
    
  ttsUtterance.onstart = () => { ttsState = 'playing'; _updateTTSUI(); _startChromeWorkaround(); };
  ttsUtterance.onend   = () => { ttsState = 'idle'; ttsUtterance = null; _updateTTSUI(); _stopChromeWorkaround(); };
  ttsUtterance.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('TTS 朗讀中斷：', e.error);
    ttsState = 'idle'; _updateTTSUI(); _stopChromeWorkaround();
  };
  window.speechSynthesis.speak(ttsUtterance);
}

function toggleTTS() {
  if (!isTTSSupported()) return;
  if (ttsState === 'idle') {
    if (ttsCurrentStory) speakStory(ttsCurrentStory);
  } else if (ttsState === 'playing') {
    window.speechSynthesis.pause(); ttsState = 'paused'; _stopChromeWorkaround(); _updateTTSUI();
  } else if (ttsState === 'paused') {
    window.speechSynthesis.resume(); ttsState = 'playing'; _startChromeWorkaround(); _updateTTSUI();
  }
}

function stopSpeech() {
  if (!isTTSSupported()) return;
  _cancelSpeech(); ttsCurrentStory = null; _updateTTSUI();
}

function _cancelSpeech() {
  window.speechSynthesis.cancel();
  ttsState = 'idle'; ttsUtterance = null; _stopChromeWorkaround();
}

function _startChromeWorkaround() {
  _stopChromeWorkaround();
  ttsResumeTimer = setInterval(() => {
    if (window.speechSynthesis.speaking && ttsState === 'playing') {
      window.speechSynthesis.pause(); window.speechSynthesis.resume();
    }
  }, 14000);
}

function _stopChromeWorkaround() {
  if (ttsResumeTimer) { clearInterval(ttsResumeTimer); ttsResumeTimer = null; }
}

function _updateTTSUI() {
  const playBtn  = $('ttsPlay');
  const stopBtn  = $('ttsStop');
  const statusEl = $('ttsStatus');
  if (!playBtn || !stopBtn || !statusEl) return;
  if (ttsState === 'playing') {
    playBtn.textContent = '⏸'; playBtn.title = '暫停朗讀'; playBtn.classList.add('on');
    stopBtn.style.opacity = '1'; stopBtn.style.pointerEvents = 'auto';
    statusEl.textContent = '▐▐ 朗讀中'; statusEl.className = 'd-tts-status show reading';
  } else if (ttsState === 'paused') {
    playBtn.textContent = '▶'; playBtn.title = '繼續朗讀'; playBtn.classList.add('on');
    stopBtn.style.opacity = '1'; stopBtn.style.pointerEvents = 'auto';
    statusEl.textContent = '‖ 已暫停'; statusEl.className = 'd-tts-status show paused';
  } else {
    playBtn.textContent = '▶'; playBtn.title = '朗讀故事'; playBtn.classList.remove('on');
    stopBtn.style.opacity = '0.3'; stopBtn.style.pointerEvents = 'none';
    statusEl.textContent = ''; statusEl.className = 'd-tts-status';
  }
}

function _buildTTSBlock() {
  if (!isTTSSupported()) return '';
  return `
    <div class="d-tts">
      <span class="d-tts-label">VOICE_READ</span>
      <button class="d-tts-btn" id="ttsPlay" title="朗讀故事" onclick="toggleTTS()">▶</button>
      <button class="d-tts-btn" id="ttsStop" title="停止朗讀" onclick="stopSpeech()" style="opacity:.3;pointer-events:none">■</button>
      <span class="d-tts-status" id="ttsStatus"></span>
    </div>`;
}
