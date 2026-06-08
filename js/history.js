// ── 閱覽紀錄模組 ──
const HISTORY_KEY = 'ghost_story_history';
const HISTORY_MAX = 20;

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function addToHistory(s) {
  const countyName = $('focusName').textContent || '';
  let hist = getHistory().filter(item => item.id !== s.id);
  hist.unshift({
    id:         s.id,
    title:      s.title,
    countyId:   s.countyId   || currentCountyId,
    countyName: countyName,
    tag:        s.tag,
    timestamp:  Date.now()
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, HISTORY_MAX)));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  const filtered = selectedTag
    ? currentStories.filter(s => s.tag === selectedTag)
    : currentStories;
  renderStoryList(filtered);
}

function isRead(id) {
  return getHistory().some(item => item.id === id);
}

function formatTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)    return '剛才';
  if (diff < 3600)  return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function renderHistory() {
  const el   = $('detailEmpty');
  const hist = getHistory();

  if (!hist.length) {
    el.style.justifyContent = 'center';
    el.style.alignItems     = 'center';
    el.innerHTML = `
      <div class="skull">☠</div>
      <h3>未翻開卷軸</h3>
      <p>請點選地圖上的縣市，<br>再從上方故事清單中選擇一則異事錄。</p>
    `;
    return;
  }

  el.style.justifyContent = 'flex-start';
  el.style.alignItems     = 'stretch';
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 22px 14px;flex-shrink:0;border-bottom:1px solid var(--border)">
      <div class="skull" style="font-size:46px; color:var(--red); opacity:0.6;">☠</div>
      <p style="font-size:15px;color:var(--dim);letter-spacing:.08em;margin:0">點選地圖繼續探索</p>
    </div>
    <div class="hist-wrap" style="overflow-y:auto;flex:1">
      <div class="hist-hd">
        <span class="hist-label">RECENT_READS ·  ${hist.length} 則</span>
        <button class="hist-clear" onclick="clearHistory()">清除紀錄</button>
      </div>
      ${hist.slice(0, 10).map(item => `
        <div class="hist-item" onclick="jumpToStory('${item.id}','${item.countyId}')">
          <div class="hist-item-title">${item.title}</div>
          <div class="hist-item-meta">
            <span class="hist-item-county">📍 ${item.countyName || item.countyId}</span>
            <span class="hist-item-time">${formatTime(item.timestamp)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function jumpToStory(storyId, countyId) {
  if (currentCountyId !== countyId) {
    const pathEl     = document.querySelector(`#county-${countyId}`);
    const countyName = pathEl ? pathEl.dataset.name : countyId;
    await selectCounty(countyId, countyName);
  }
  const story = currentStories.find(s => s.id === storyId);
  if (story) showDetail(story);
}
