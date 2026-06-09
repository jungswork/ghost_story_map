# ============================================================
#  台灣鬼事地圖 — Flask 後端
#  故事資料從 ghost_story/ 資料夾讀取（每個故事一個 .json 檔）
#
#  執行方式:
#    pip install flask flask-cors
#    python app.py
#  接著在瀏覽器開啟 http://localhost:5000
#
#  新增故事：在 ghost_story/ 裡新增一個 .json 檔即可，格式參考：
#    {
#      "id": "my-story",
#      "countyId": "taipei-city",
#      "title": "故事標題",
#      "tag": "都市傳說",
#      "scaryLevel": 3,
#      "summary": "一句話摘要",
#      "location": {
#        "display": "台北市中正區某處",
#        "district": "中正區",
#        "lat": null,
#        "lng": null
#      },
#      "content": "故事內文..."
#    }
# ============================================================

import json
import uuid # 🔥 新增：用來產生隨機的故事 ID
from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ── 故事資料夾路徑 ───────────────────────────────────────────
STORY_DIR = Path("ghost_story")

# ── 台灣地圖 SVG 路徑資料 ──────────
MAP_DATA = json.loads(Path("map_data/taiwan_map.json").read_text(encoding="utf-8"))

# ── 縣市中文名稱對照表 ───────────────────────────────────────
COUNTY_NAMES = {c["id"]: c["name"] for c in MAP_DATA}

# ── 故事讀取函式 ─────────────────────────────────────────────

def load_story(filepath: Path) -> dict | None:
    """讀取並解析單一故事 JSON 檔，失敗時回傳 None 並印出警告。"""
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"⚠  無法讀取 {filepath.name}: {e}")
        return None


def load_all_stories() -> dict[str, list]:
    """
    讀取 ghost_story/ 內所有 .json 檔，依 countyId 分組。
    回傳格式：{ "taipei-city": [...], "kaohsiung-city": [...], ... }
    """
    result: dict[str, list] = {}

    if not STORY_DIR.exists():
        print(f"⚠  找不到故事資料夾 {STORY_DIR}/，請建立後重啟伺服器。")
        return result

    for f in sorted(STORY_DIR.glob("*.json")):
        story = load_story(f)
        if not story:
            continue
        county_id = story.get("countyId", "")
        if not county_id:
            print(f"⚠  {f.name} 缺少 countyId 欄位，已跳過。")
            continue
        result.setdefault(county_id, []).append(story)

    return result


# ── API 路由 ─────────────────────────────────────────────────

# 初始化時把 index.html 這個檔案傳給瀏覽器(本地 : http://localhost:5000/ 就是 "/")
@app.route("/")
def index():
    """提供前端 HTML 頁面"""
    return send_from_directory(".", "index.html")

# 提供前端播放背景音效使用
@app.route("/audio/<path:filename>")
def serve_audio(filename):
    return send_from_directory(".", filename)

# 提供前端 renderMap() 繪製 SVG 台灣地圖使用
@app.route("/api/map-data")
def get_map_data():
    """回傳台灣地圖 SVG 路徑資料（22 縣市）"""
    return jsonify(MAP_DATA)

# 提供前端顯示縣市選單清單使用（目前未被呼叫）
@app.route("/api/counties")
def get_counties():
    """回傳縣市清單（id + 中文名）"""
    return jsonify([{"id": c["id"], "name": c["name"]} for c in MAP_DATA])

# 提供前端取得全台故事資料使用（目前未被呼叫）
@app.route("/api/stories")
def get_all_stories():
    """回傳全台所有故事"""
    stories = load_all_stories()
    result = []
    for county_id, story_list in stories.items():
        for s in story_list:
            result.append({**s, "countyName": COUNTY_NAMES.get(county_id, county_id)})
    return jsonify(result)

# 提供前端 selectCounty() 點選縣市後載入該縣市故事列表使用
@app.route("/api/stories/<county_id>")
def get_stories_by_county(county_id):
    """回傳指定縣市的故事清單"""
    stories = load_all_stories()
    return jsonify(stories.get(county_id, []))

# 提供前端 init() 初始化時顯示故事總數與標記有故事的縣市使用
@app.route("/api/stats")
def get_stats():
    """回傳統計資訊：故事總數、分類計數、各縣市故事數"""
    stories = load_all_stories()
    all_stories = [s for sl in stories.values() for s in sl]

    tag_counts: dict[str, int] = {}
    for s in all_stories:
        tag_counts[s.get("tag", "未分類")] = tag_counts.get(s.get("tag", "未分類"), 0) + 1

    return jsonify({
        "total":          len(all_stories),
        "tag_counts":     tag_counts,
        "county_count":   len(stories),
        "county_counts":  {cid: len(sl) for cid, sl in stories.items()},
    })
# 提供前端投稿新故事使用
@app.route("/api/submit", methods=["POST"])
def submit_story():
    """接收前端表單，自動產生 ID 並存入 ghost_story/ 資料夾"""
    try:
        data = request.get_json()
        
        # 基本欄位驗證
        if not data or not data.get("title") or not data.get("countyId"):
            return jsonify({"success": False, "error": "缺少必填欄位"}), 400

        # 產生獨一無二的檔案 ID (例如: user-a1b2c3d4)
        story_id = f"user-{uuid.uuid4().hex[:8]}"
        
        # 依照你原本的 JSON 格式建立新字典
        new_story = {
            "id": story_id,
            "countyId": data.get("countyId"),
            "title": data.get("title"),
            "tag": data.get("tag", "未分類"),
            "scaryLevel": int(data.get("scaryLevel", 1)),
            "summary": data.get("summary", ""),
            "location": {
                "display": data.get("location", "未知"),
                "district": "",
                "lat": None,
                "lng": None
            },
            "content": data.get("content", "")
        }

        # 將資料寫入 ghost_story 資料夾
        file_path = STORY_DIR / f"{story_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(new_story, f, ensure_ascii=False, indent=2)

        return jsonify({"success": True, "id": story_id})
    
    except Exception as e:
        print(f"⚠ 投稿寫入失敗: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ── 啟動 ─────────────────────────────────────────────────────
if __name__ == "__main__":
    stories = load_all_stories()
    total = sum(len(v) for v in stories.values())
    print("🕯  台灣鬼事地圖後端啟動中...")
    print(f"📂  故事資料夾：{STORY_DIR.resolve()}")
    print(f"📖  已載入 {total} 則靈異傳說（{len(stories)} 個縣市）")
    print("🌐  請在瀏覽器開啟 http://localhost:5000")
    app.run(debug=True, port=5000)
