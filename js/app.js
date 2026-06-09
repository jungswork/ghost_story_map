// ── 狀態 ──
let currentCountyId = null;
let currentStories  = [];
let activeStoryId   = null;
let selectedTag     = null;
let countyCountMap  = {};
let audio           = null;
let isPlaying       = false;
let isOverviewLoaded = false;
let globalStoriesMap = {}; //用來記住所有故事的詳細資料

// ── XSS 防護：escape HTML 特殊字元 ──
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 切換總覽表顯示/隱藏
async function toggleOverview() {
  const modal = document.getElementById('overviewModal');
  
  if (modal.style.display === 'none' || modal.style.display === '') {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // 鎖定背景滾動
    
    // 如果尚未載入過資料，則進行 Fetch
    if (!isOverviewLoaded) {
      await loadOverviewData();
    }
  } else {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // 恢復背景滾動
  }
}
// 獲取資料並渲染分類折疊列表
async function loadOverviewData() {
  const container = document.getElementById('overviewContainer');
  
  try {
    const res = await fetch('/api/stories');
    if (!res.ok) throw new Error('Network response was not ok');
    const allStories = await res.json();
    
// 依據 tag 分組
    const groupedStories = {};
    allStories.forEach(story => {
      globalStoriesMap[story.id] = story; // 把故事存進字典，方便點擊時調用

      const tag = story.tag || '未分類';
      if (!groupedStories[tag]) {
        groupedStories[tag] = [];
      }
      groupedStories[tag].push(story);
    });

    let htmlContent = '<div class="overview-categories">';
    
// 針對每個分類標籤迭代
    for (const [tag, stories] of Object.entries(groupedStories)) {
      // 幫每個 tag 產生一個安全的 HTML ID（去除空格等）
      const safeTagId = 'tag-' + tag.replace(/[^a-zA-Z0-9一-龥]/g, '-');
      const safeTag   = escapeHtml(tag);
      
      // 生成折疊按鈕 (Button)
      htmlContent += `
        <div class="overview-group">
          <button class="overview-tag-btn" onclick="toggleTagGroup('${safeTagId}')">
            <span class="tag-icon">📂</span> ${safeTag}
            <span class="tag-count">(${stories.length} 則檔案) ▾</span>
          </button>
          
          <div class="overview-stories" id="${safeTagId}" style="display: none;">
            <table class="overview-table">
              <thead>
                <tr>
                  <th width="15%">發生縣市</th>
                  <th width="25%">故事標題</th>
                  <th width="45%">摘要描述</th>
                  <th width="15%">驚嚇指數</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      // 生成該分類下的故事
      stories.forEach(s => {
        const skulls = '☠'.repeat(s.scaryLevel || 1) + '－'.repeat(5 - (s.scaryLevel || 1));
        
        htmlContent += `
                <tr style="cursor: pointer; transition: background 0.3s;" 
                    onclick="openStoryFromOverview('${escapeHtml(s.id)}')" 
                    onmouseover="this.style.background='rgba(220, 38, 38, 0.1)'" 
                    onmouseout="this.style.background='transparent'">
                  <td>${escapeHtml(s.countyName || '未知')}</td>
                  <td><strong style="color:var(--red);">${escapeHtml(s.title)}</strong></td>
                  <td style="color:var(--dim);">${escapeHtml(s.summary)}</td>
                  <td style="letter-spacing:2px; font-size:0.8rem;">${skulls}</td>
                </tr>
        `;
      });
      
      htmlContent += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    } // for 迴圈結束
    
    htmlContent += '</div>';
    container.innerHTML = htmlContent;
    isOverviewLoaded = true;

  } catch (error) {
    console.error("載入總覽資料失敗:", error);
    container.innerHTML = `<p style="color:var(--red); text-align:center;">⚠ 陰陽交界連線中斷，無法讀取資料...</p>`;
  }
}

// 點擊分類時：展開或收合該分類的故事列表
function toggleTagGroup(tagId) {
  const groupDiv = document.getElementById(tagId);
  // 若為隱藏狀態則顯示，反之亦然
  if (groupDiv.style.display === 'none') {
    groupDiv.style.display = 'block';
  } else {
    groupDiv.style.display = 'none';
  }
}

// 從總覽表點擊故事時的處理函式
async function openStoryFromOverview(storyId) {
  const story = globalStoriesMap[storyId];
  if (!story) return;

  // 1. 關閉總覽彈出視窗
  toggleOverview();

  // 關鍵修復：在等待網路抓資料前，立刻送出無聲指令解鎖瀏覽器語音權限
  if ('speechSynthesis' in window) {
    const unlockAudio = new SpeechSynthesisUtterance('');
    unlockAudio.volume = 0;
    window.speechSynthesis.speak(unlockAudio);
  }

  // 2. 切換縣市
  if (currentCountyId !== story.countyId) {
    // 傳入 true，告訴 selectCounty「不要清空畫面跟中斷語音」
    await selectCounty(story.countyId, story.countyName || '未知', true);
  }

  // 3. 展開故事詳情並開始朗讀
  showDetail(story);
}


// ── 工具函式 ──
const $ = id => document.getElementById(id);
const fetch_json = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

function flames(n, cls) {
  return Array.from({length:5}, (_,i) =>
    `<span class="${cls}${i<n?' lit':''}">${i<n?'🔥':'🔥'}</span>`
  ).join('');
}

// ── 初始化 & 地圖 ──
async function init() {
  try {
    const [mapData, stats] = await Promise.all([
      fetch_json('/api/map-data'),
      fetch_json('/api/stats'),
    ]);
    countyCountMap = stats.county_counts || {};
    $('statsPill').textContent = `已收錄 ${stats.total} 宗異事`;
    renderMap(mapData);
  } catch (err) {
    console.error('初始化失敗:', err);
    $('statsPill').textContent = '⚠ 資料載入失敗，請重新整理頁面';
  }
}

// SVG helper
function _svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function renderMap(counties) {
  const g = $('counties-group');
  g.innerHTML = '';

  // ── 離島 Inset 設定 ──
  const INSET = {
    'kinmen-county': {
      scale: 1.8,
      transform: 'translate(279, 195) scale(1.8)', 
      frame: { x: -5, y: 475, w: 110, h: 110 },
      label: '金門', lx: 2, ly: 495,
    },
    'lienchiang-county': {
      scale: 1.6,
      transform: 'translate(-442, 318) scale(1.6)', 
      frame: { x: 445, y: -5, w: 165, h: 140 }, 
      label: '連江', lx: 452, ly: 20,
    },
  };

  counties.forEach(c => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', c.path);
    path.setAttribute('id', 'county-' + c.id);
    path.dataset.id   = c.id;
    path.dataset.name = c.name;
    if (countyCountMap[c.id] > 0) path.classList.add('has-stories');
    path.addEventListener('click', () => selectCounty(c.id, c.name));
    path.addEventListener('mouseenter', () => showTooltip(c.name));
    path.addEventListener('mouseleave', hideTooltip);

    const inset = INSET[c.id];
    if (inset) {
      const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      grp.setAttribute('transform', inset.transform);

      // 1. 氛圍底框（純保留虛線及底色）
      const bgRect = _svgEl('rect', {
        x: inset.frame.x, y: inset.frame.y,
        width: inset.frame.w, height: inset.frame.h,
        fill: 'rgba(139,0,0,0.04)',
        stroke: 'rgba(201,146,42,0.4)',
        'stroke-width': 1.5 / inset.scale,
        'stroke-dasharray': (4 / inset.scale) + ',' + (4 / inset.scale),
        rx: 4 / inset.scale,
      });
      bgRect.style.pointerEvents = 'none';

      // 2. 金色主題標籤 (字體放大兩倍)
      const txt = _svgEl('text', {
        x: inset.lx, y: inset.ly,
        'font-size': 24 / inset.scale, 
        fill: '#c9922a',
        'font-family': 'var(--serif)',
        'font-weight': 'bold',
        'letter-spacing': 4 / inset.scale,
      });
      txt.textContent = inset.label;
      txt.style.pointerEvents = 'none';

      grp.appendChild(bgRect);
      grp.appendChild(path);
      grp.appendChild(txt);
      g.appendChild(grp);
    } else {
      g.appendChild(path);
    }
  });
}

function showTooltip(name) {
  $('tooltip-name').textContent = name;
  $('map-tooltip').classList.add('show');
}
function hideTooltip() {
  $('map-tooltip').classList.remove('show');
}

// ── 選擇縣市 ──
async function selectCounty(id, name, preventClear = false) {
  if (rankingMode) {
    rankingMode = false;
    $('rankBtn').textContent = '👁 排行';
    $('rankBtn').classList.remove('on');
    $('tagBar').style.display = '';
    $('storyCards').classList.remove('rank-mode');
  }
  currentCountyId = id;
  selectedTag     = null;
  activeStoryId   = null;

  document.querySelectorAll('#counties-group path').forEach(p => p.classList.remove('selected'));
  const el = $('county-' + id);
  if (el) el.classList.add('selected');

  $('focusName').textContent    = name;
  $('slCountyName').textContent = `【${name}】異事錄`;

  currentStories = await fetch_json(`/api/stories/${id}`);
  $('slCount').textContent       = `${currentStories.length} 則記載`;
  $('slCountyCount').textContent = `(${currentStories.length})`;

  renderTags();
  renderStoryList(currentStories);
  // 如果是從總覽跳過來的（preventClear 為 true），就不要清空畫面跟中斷語音
  if (!preventClear) {
    clearDetail();
  }
}

// ── 標籤篩選 ──
function renderTags() {
  const bar = $('tagBar');
  bar.innerHTML = '';
  const tags = [...new Set(currentStories.map(s => s.tag))];
  if (!tags.length) return;
  addTagBtn('全部', null, true, bar);
  tags.forEach(t => addTagBtn(t, t, false, bar));
}

function addTagBtn(label, val, active, container) {
  const btn = document.createElement('button');
  btn.className   = 'tag-btn' + (active ? ' active' : '');
  btn.textContent = label;
  btn.onclick = () => {
    selectedTag = val;
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = val ? currentStories.filter(s => s.tag === val) : currentStories;
    renderStoryList(filtered);
  };
  container.appendChild(btn);
}

function _markCardRead(id) {
  const card = $('sc-' + id);
  if (!card) return;
  const top = card.querySelector('.sc-top');
  if (top && !top.querySelector('.sc-read-tag')) {
    const badge = document.createElement('span');
    badge.className   = 'sc-read-tag';
    badge.textContent = '已閱覽';
    top.insertBefore(badge, top.firstChild);
  }
}

// ── 故事列表 ──
function renderStoryList(stories) {
  const box = $('storyCards');
  if (!stories.length) {
    box.innerHTML = '<div class="empty-note" style="grid-column:span 2"><p>此區域暫無該分類的靈異記載。</p></div>';
    return;
  }
  box.innerHTML = '';
  stories.forEach(s => {
    const card     = document.createElement('div');
    card.className = 'story-card' + (s.id === activeStoryId ? ' active' : '');
    card.id        = 'sc-' + s.id;
    card.onclick   = () => showDetail(s);
    const locDisplay = s.location?.display ?? s.location;
    card.innerHTML = `
      <div class="sc-top">
        ${isRead(s.id) ? '<span class="sc-read-tag">已閱覽</span>' : ''}
        <div class="sc-title">${escapeHtml(s.title)}</div>
        <div class="sc-tag">${escapeHtml(s.tag)}</div>
      </div>
      <div class="sc-loc">📍 ${escapeHtml(locDisplay)}</div>
      <div class="sc-flames">${flames(s.scaryLevel, 'flame')}</div>
    `;
    box.appendChild(card);
  });
}

// ── 故事詳情 ──
function showDetail(s) {
  activeStoryId   = s.id;
  ttsCurrentStory = s;
  addToHistory(s);
  _markCardRead(s.id);

  document.querySelectorAll('.story-card').forEach(c => c.classList.remove('active'));
  const card = $('sc-' + s.id);
  if (card) { card.classList.add('active'); card.scrollIntoView({block:'nearest'}); }

  $('detailEmpty').style.display = 'none';
  const inner = $('detailInner');
  inner.style.display = 'block';

  const locDisplay = s.location?.display ?? s.location;
  // content 以換行分段，每段 escape 後包進 <p>
  const paras = s.content.split(/\n+/).filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p)}</p>`).join('');

  inner.innerHTML = `
    <div class="d-meta">
      <div class="d-tag">${escapeHtml(s.tag)}</div>
      <div class="d-id">ID: ${escapeHtml(s.id.toUpperCase())}</div>
    </div>
    <div class="d-title">${escapeHtml(s.title)}</div>
    <div class="d-scary">
      <div class="d-scary-label">凶險指數</div>
      <div class="d-flames">${flames(s.scaryLevel, 'd-flame')}</div>
    </div>
    <hr class="d-divider">
    ${_buildTTSBlock()}
    <div class="d-loc">📍 <span><strong>邪祟現世地：</strong>${escapeHtml(locDisplay)}</span></div>
    <div class="d-summary">「${escapeHtml(s.summary)}」</div>
    <div class="d-body">${paras}</div>
    <div class="d-warn">
      <div class="d-warn-icon">⚠</div>
      <div class="d-warn-text">民俗傳說僅供休閒與文化考證，深夜請勿輕易前往事發地點探險，生人迴避，切勿以身試法。</div>
    </div>
  `;

  $('storyDetail').scrollTop = 0;
  setTimeout(() => speakStory(s), 100);
}

function clearDetail() {
  activeStoryId = null;
  _cancelSpeech();
  ttsCurrentStory = null;
  renderHistory();
  $('detailEmpty').style.display = 'flex';
  $('detailInner').style.display = 'none';
}

// ── 背景音效 ──
function toggleSound() {
  if (!audio) {
    audio = new Audio('/audio/ghost_bgm.mp3');
    audio.loop   = true;
    audio.volume = 0;
    audio.play()
      .then(() => {
        isPlaying = true;
        updateSoundUI();
        let vol = 0;
        const fadeIn = setInterval(() => {
          vol = Math.min(vol + 0.02, 0.3);
          audio.volume = vol;
          if (vol >= 0.3) clearInterval(fadeIn);
        }, 100);
      })
      .catch(err => {
        console.error('音效載入失敗:', err);
        alert('音效載入失敗，請確認 ghost_bgm.mp3 已放在專案根目錄。');
      });
    return;
  }
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    audio.play().catch(err => console.error('音效播放失敗:', err));
    isPlaying = true;
  }
  updateSoundUI();
}

function updateSoundUI() {
  const btn = $('soundBtn');
  $('soundIcon').textContent  = isPlaying ? '🔊' : '🔇';
  $('soundLabel').textContent = isPlaying ? '靈異氛圍：啟動中' : '開啟靈異氛圍音效';
  btn.classList.toggle('on', isPlaying);
}

// ── 投稿功能 ──

// 切換投稿表單顯示/隱藏
function toggleSubmitForm() {
  const modal = document.getElementById('submitModal');
  if (modal.style.display === 'none' || modal.style.display === '') {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // 如果縣市選單還是空的，從 mapData 抓取並自動填入
    const select = document.getElementById('formCounty');
    if (select.options.length <= 1) {
      fetch_json('/api/map-data').then(data => {
        data.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
      });
    }
  } else {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// 處理表單送出（透過 Web3Forms 寄信給開發者）
async function submitNewStory(event) {
  event.preventDefault();
  const btn = document.getElementById('formSubmitBtn');
  btn.textContent = '傳送中...';
  btn.disabled = true;

  // 收集表單資料
  const countyEl  = document.getElementById('formCounty');
  const countyName = countyEl.selectedOptions[0]?.text || countyEl.value;

  const storyData = {
    countyId:   countyEl.value,
    countyName: countyName,
    title:      document.getElementById('formTitle').value,
    tag:        document.getElementById('formTag').value,
    scaryLevel: parseInt(document.getElementById('formScary').value) || 1,
    summary:    document.getElementById('formSummary').value,
    location: {
      display:  document.getElementById('formLoc').value,
      district: '',
      lat:      null,
      lng:      null
    },
    content:    document.getElementById('formContent').value
  };

  // 組成讓開發者可直接複製的 JSON 字串
  const jsonPreview = JSON.stringify(storyData, null, 2);

  // Web3Forms payload
  const payload = {
    access_key: '8352f00e-7b65-4d7d-933f-9631c1e709ed',
    subject:    `【新投稿】${storyData.title}（${countyName}）`,
    from_name:  '台灣鬼事地圖投稿系統',
    message:    [
      `縣市：${countyName}`,
      `標題：${storyData.title}`,
      `分類：${storyData.tag}`,
      `恐怖指數：${storyData.scaryLevel}`,
      `地點：${storyData.location.display}`,
      `摘要：${storyData.summary}`,
      ``,
      `內文：`,
      storyData.content,
      ``,
      `--- JSON（直接複製貼入 ghost_story/）---`,
      jsonPreview
    ].join('\n')
  };

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.success) {
      alert('📜 靈異卷軸已送出！\n待開發者審核通過後即會出現在地圖上，感謝你的投稿。');
      document.getElementById('submitForm').reset();
      toggleSubmitForm();
      allStoriesCache = null;
    } else {
      alert('⚠ 投稿失敗：' + (result.message || '未知錯誤'));
    }
  } catch (error) {
    console.error('送出錯誤:', error);
    alert('⚠ 陰陽交界連線中斷，請稍後再試。');
  } finally {
    btn.textContent = '🩸 封印進地圖 (送出)';
    btn.disabled = false;
  }
}
