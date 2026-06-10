# 台灣鬼事地圖

一個收錄全台靈異傳說的互動式網站，使用者可透過地圖點選縣市，瀏覽當地鬼故事，並支援語音朗讀與投稿功能。

🌐 線上網址：[ghost-story-map.onrender.com](https://ghost-story-map.onrender.com)

---

## 功能說明

### 互動地圖
點擊台灣地圖上的任一縣市，即可顯示該縣市收錄的靈異故事列表。目前共收錄 110 則來自全台各地的傳說。

### 故事瀏覽
每則故事包含以下資訊：
- 標題與發生地點
- 分類標籤（如：荒野魅影、都市傳說）
- 恐怖指數（1–5 顆骷髏）
- 一句話摘要與完整故事內文

### 語音朗讀
點擊故事頁面中的朗讀按鈕，可使用瀏覽器內建的語音合成功能（Web Speech API）將故事內容朗讀出來。

### 排行榜
顯示全台故事數量排名，可查看哪些縣市收錄的故事最多。

### 閱覽紀錄
網站會自動記錄使用者瀏覽過的故事，方便下次回顧。紀錄儲存於瀏覽器本地端（localStorage），不會上傳至伺服器。

### 投稿功能
使用者可透過投稿表單提交新的靈異故事。填寫縣市、標題、地點、分類、恐怖指數及故事內容後送出，表單內容會自動轉換為 JSON 格式並以電子郵件寄送給開發者。開發者審核後將故事加入資料庫並更新網站。

---

## 技術架構

| 層次 | 技術 |
|------|------|
| 前端 | HTML / CSS / Vanilla JavaScript |
| 後端 | Python Flask |
| 資料儲存 | JSON 檔案（每則故事一個 .json 檔） |
| 投稿寄信 | Web3Forms |
| 部署平台 | Render |

---

## 本地開發

### 安裝依賴

```bash
pip install -r requirements.txt
```

或使用 uv（推薦）：

```bash
uv sync
```

### 啟動伺服器

```bash
python app.py
```

瀏覽器開啟 `http://localhost:5000`

---

## 專案結構

```
ghost_story_map/
├── app.py              # Flask 後端，提供 API 路由
├── index.html          # 前端主頁面
├── requirements.txt    # Python 套件清單（供 Render 部署使用）
├── uv.lock             # uv 套件鎖定檔（供開發者快速重建環境）
├── ghost_bgm.mp3       # 背景音效
├── css/                # 樣式表
├── js/
│   ├── app.js          # 核心邏輯：地圖渲染、故事列表、投稿送出
│   ├── ranking.js      # 全台故事排行榜
│   ├── history.js      # 閱覽紀錄（localStorage）
│   └── tts.js          # 語音朗讀（Web Speech API）
├── map_data/
│   └── taiwan_map.json # 台灣 22 縣市 SVG 路徑資料
└── ghost_story/        # 故事資料（每則故事一個 JSON 檔）
```
