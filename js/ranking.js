// ── 排行榜模組 ──
let rankingMode     = false;
let allStoriesCache = null;

async function toggleRanking() {
  if (rankingMode) { _exitRankingMode(); }
  else { _enterRankingMode(); await showRanking(); }
  clearDetail();
}

function _enterRankingMode() {
  rankingMode = true;
  $('rankBtn').textContent = '✕ 返回';
  $('rankBtn').classList.add('on');
  $('tagBar').style.display = 'none';
  $('slCountyName').textContent  = '全台靈異排行榜';
  $('slCountyCount').textContent = '';
  $('slCount').textContent       = '';
  $('storyCards').classList.add('rank-mode');
}

function _exitRankingMode() {
  rankingMode = false;
  $('rankBtn').textContent = '👁 排行';
  $('rankBtn').classList.remove('on');
  $('tagBar').style.display = '';
  $('storyCards').classList.remove('rank-mode');
  if (currentCountyId) {
    $('slCountyName').textContent  = `【${$('focusName').textContent}】異事錄`;
    $('slCountyCount').textContent = `(${currentStories.length})`;
    $('slCount').textContent       = `${currentStories.length} 則記載`;
    renderTags();
    renderStoryList(currentStories);
  } else {
    $('slCountyName').textContent  = '請點選地圖縣市';
    $('slCountyCount').textContent = '';
    $('storyCards').innerHTML = '<div class="empty-note" style="grid-column:span 2"><p>請點選地圖上的縣市<br>以翻開當地的靈異事件卷軸</p></div>';
  }
}

async function showRanking() {
  const box = $('storyCards');
  box.innerHTML = '<div class="empty-note" style="grid-column:span 2"><p>召喚靈異檔案中…</p></div>';
  if (!allStoriesCache) allStoriesCache = await fetch_json('/api/stories');
  const sorted = [...allStoriesCache].sort((a, b) => {
    if (b.scaryLevel !== a.scaryLevel) return b.scaryLevel - a.scaryLevel;
    return a.id.localeCompare(b.id);
  });
  _renderRankList(sorted);
}

function _renderRankList(stories) {
  const box = $('storyCards');
  box.innerHTML = '';
  stories.forEach((s, i) => {
    const rank    = i + 1;
    const rankCls = rank === 1 ? 'rank-num top1' : rank === 2 ? 'rank-num top2' : rank === 3 ? 'rank-num top3' : 'rank-num';
    const item    = document.createElement('div');
    item.className = 'rank-item' + (s.id === activeStoryId ? ' active' : '');
    item.id        = 'sc-' + s.id;
    item.onclick   = () => showDetail(s);
    item.innerHTML = `
      <div class="${rankCls}">${rank}</div>
      <div class="rank-info">
        <div class="rank-title">
          ${isRead(s.id) ? '<span class="sc-read-tag">已閱覽</span>' : ''}
          ${s.title}
        </div>
        <div class="rank-meta">
          <span class="rank-county">📍 ${s.countyName || s.countyId}</span>
          <span class="rank-tag">${s.tag}</span>
          <span class="rank-flames">${flames(s.scaryLevel, 'flame')}</span>
        </div>
      </div>
    `;
    box.appendChild(item);
  });
}
